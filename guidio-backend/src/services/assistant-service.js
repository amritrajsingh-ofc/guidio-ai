
import { AI_ERROR, isAiError } from "../ai/ai-errors.js";
import { aiService } from "../ai/ai-service.js";
import { buildAssistantSystemInstruction } from "../ai/assistant-prompt.js";
import { prisma } from "../config/prisma.js";
import { AppError } from "../utils/app-error.js";
import { logger } from "../utils/logger.js";

/* =========================================================
   HELPERS
   ========================================================= */

const DEFAULT_TITLE = "New conversation";

// How many earlier messages are sent to the AI as context.
const HISTORY_LIMIT = 10;

// How many characters a partial answer must contain to be saved.
const MIN_PARTIAL_CHARS = 20;

const INTERRUPTED_NOTE = "\n\n*(This response was interrupted.)*";

function createConversationTitle(content) {
  const cleanedContent = String(content || "")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleanedContent) return DEFAULT_TITLE;
  if (cleanedContent.length <= 50) return cleanedContent;

  return `${cleanedContent.slice(0, 50)}...`;
}

/** Saves the assistant message and bumps the conversation together. */
async function saveAssistantMessage(conversationId, content) {
  const [message] = await prisma.$transaction([
    prisma.assistantMessage.create({
      data: { conversationId, role: "assistant", content },
    }),
    prisma.assistantConversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    }),
  ]);

  return message;
}

/**
 * When the user stops a stream half way (Stop button or closed tab), keep what
 * they already saw, so the saved conversation matches the screen and the next
 * question has context.
 * Never throws: the original error must reach the caller.
 */
async function savePartialReply(conversationId, error) {
  // Only a deliberate stop is saved. After a provider failure the screen
  // removes the unfinished bubble and restores the draft, so saving the
  // partial text would make the history differ from what the user saw.
  if (
    !isAiError(error) ||
    error.code !== AI_ERROR.CANCELLED ||
    typeof error.partialText !== "string"
  ) {
    return;
  }

  const partial = error.partialText.trim();

  if (partial.length < MIN_PARTIAL_CHARS) return;

  try {
    await saveAssistantMessage(conversationId, `${partial}${INTERRUPTED_NOTE}`);

    logger.info("assistant_partial_reply_saved", {
      conversationId,
      reason: error.code,
    });
  } catch (saveError) {
    logger.warn("assistant_partial_reply_not_saved", { error: saveError });
  }
}

/* =========================================================
   CREATE CONVERSATION
   ========================================================= */

export async function createConversation(userId, title) {
  if (!userId) {
    throw new AppError("User authentication is required.", 401);
  }

  return prisma.assistantConversation.create({
    data: {
      userId,
      title: title?.trim() || DEFAULT_TITLE,
    },
  });
}

/* =========================================================
   GET CONVERSATIONS
   ========================================================= */

export async function getConversations(userId) {
  if (!userId) {
    throw new AppError("User authentication is required.", 401);
  }

  return prisma.assistantConversation.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      title: true,
      createdAt: true,
      updatedAt: true,
      _count: {
        select: { messages: true },
      },
    },
  });
}

/* =========================================================
   GET SINGLE CONVERSATION
   ========================================================= */

export async function getConversationById(conversationId, userId) {
  if (!conversationId || !userId) {
    return null;
  }

  return prisma.assistantConversation.findFirst({
    where: {
      id: conversationId,
      userId,
    },
    include: {
      messages: {
        orderBy: { createdAt: "asc" },
      },
    },
  });
}

/* =========================================================
   DELETE CONVERSATION
   ========================================================= */

export async function deleteConversationById(conversationId, userId) {
  const conversation = await prisma.assistantConversation.findFirst({
    where: {
      id: conversationId,
      userId,
    },
  });

  if (!conversation) {
    return null;
  }

  await prisma.assistantConversation.delete({
    where: { id: conversation.id },
  });

  return conversation;
}

/* =========================================================
   CREATE ASSISTANT REPLY (streamed)
   ========================================================= */

export async function createAssistantReply({
  userId,
  conversationId,
  content,
  onChunk,
  signal,
}) {
  if (!userId) {
    throw new AppError("User authentication is required.", 401);
  }

  if (!conversationId) {
    throw new AppError("Conversation ID is required.", 400);
  }

  const cleanContent = String(content || "").trim();

  if (!cleanContent) {
    throw new AppError("Message content cannot be empty.", 400);
  }

  // Ownership check: the conversation must belong to this user.
  // Only what is needed is loaded; the full history is not.
  const conversation = await prisma.assistantConversation.findFirst({
    where: { id: conversationId, userId },
    select: {
      id: true,
      title: true,
      _count: { select: { messages: true } },
    },
  });

  if (!conversation) {
    throw new AppError("Conversation not found.", 404, { code: "not_found" });
  }

  const isFirstMessage =
    conversation._count.messages === 0 && conversation.title === DEFAULT_TITLE;

  // Only the latest messages are needed as context.
  const recentMessages = await prisma.assistantMessage.findMany({
    where: { conversationId },
    orderBy: { createdAt: "desc" },
    take: HISTORY_LIMIT,
    select: { role: true, content: true },
  });

  recentMessages.reverse();

  // The user's message and the conversation update succeed or fail together.
  // If the AI fails later, the question is still saved and the conversation
  // still shows in the list.
  const [userMessage] = await prisma.$transaction([
    prisma.assistantMessage.create({
      data: { conversationId, role: "user", content: cleanContent },
    }),
    prisma.assistantConversation.update({
      where: { id: conversationId },
      data: isFirstMessage
        ? { title: createConversationTitle(cleanContent), updatedAt: new Date() }
        : { updatedAt: new Date() },
    }),
  ]);

  const history = [...recentMessages, userMessage].map((message) => ({
    role: message.role,
    content: message.content,
  }));

  // Optional background so answers fit the student's field and level.
  // If it cannot be loaded, the assistant still answers normally.
  const studentProfile = await prisma.studentProfile
    .findUnique({
      where: { userId },
      select: { education: true, degree: true, targetRole: true },
    })
    .catch((error) => {
      logger.warn("assistant_profile_context_failed", { userId, error });
      return null;
    });

  let aiResult;

  try {
    // Throws an AiError (rate limit, outage, timeout, cancelled...) with a
    // user-safe message. The user message is intentionally kept.
    aiResult = await aiService.streamText({
      feature: "assistant",
      system: buildAssistantSystemInstruction(studentProfile),
      messages: history,
      onChunk,
      signal,
    });
  } catch (error) {
    await savePartialReply(conversationId, error);
    throw error;
  }

  const assistantMessage = await saveAssistantMessage(
    conversationId,
    aiResult.text,
  );

  return {
    userMessage,
    assistantMessage,
  };
}
