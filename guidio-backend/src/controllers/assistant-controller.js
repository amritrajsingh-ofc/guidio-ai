import { AiError, toStreamErrorEvent } from "../ai/ai-errors.js";
import { AppError } from "../utils/app-error.js";
import { logger } from "../utils/logger.js";
import { sendError, sendSuccess } from "../utils/api-response.js";

import { syncCurrentUser } from "../services/user-service.js";

import {
  createAssistantReply,
  createConversation,
  deleteConversationById,
  getConversationById,
  getConversations,
} from "../services/assistant-service.js";

export async function createNewConversation(
  req,
  res,
  next
) {
  try {
    const user = await syncCurrentUser(
      req.authenticatedUserId
    );

    const conversation =
      await createConversation(
        user.id,
        req.validatedConversationData.title
      );

    return sendSuccess(
      res,
      conversation,
      "Conversation created successfully",
      201
    );
  } catch (error) {
    return next(error);
  }
}

export async function listConversations(
  req,
  res,
  next
) {
  try {
    const user = await syncCurrentUser(
      req.authenticatedUserId
    );

    const conversations =
      await getConversations(user.id);

    return sendSuccess(
      res,
      conversations,
      "Conversations retrieved successfully"
    );
  } catch (error) {
    return next(error);
  }
}

export async function getConversation(
  req,
  res,
  next
) {
  try {
    const user = await syncCurrentUser(
      req.authenticatedUserId
    );

    const conversation =
      await getConversationById(
        req.params.conversationId,
        user.id
      );

    if (!conversation) {
      return sendError(
        res,
        "Conversation not found.",
        404
      );
    }

    return sendSuccess(
      res,
      conversation,
      "Conversation retrieved successfully"
    );
  } catch (error) {
    return next(error);
  }
}

/**
 * Streaming AI response using Server-Sent Events.
 *
 * Events: start, chunk { text }, done { data }, error { message, code, retryAfterSeconds }
 */
export async function sendMessage(req, res, next) {
  try {
    const user = await syncCurrentUser(req.authenticatedUserId);

    res.status(200);
    res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");

    if (typeof res.flushHeaders === "function") {
      res.flushHeaders();
    }

    // If the browser closes the connection (tab closed, Stop button), stop the
    // AI request too, so no free-tier quota is wasted on an answer nobody reads.
    const aiAbort = new AbortController();

    res.on("close", () => {
      if (!res.writableFinished) {
        aiAbort.abort();
      }
    });

    function sendEvent(data) {
      if (res.writableEnded || res.destroyed) {
        return;
      }

      res.write(`data: ${JSON.stringify(data)}\n\n`);
    }

    sendEvent({ type: "start" });

    const result = await createAssistantReply({
      userId: user.id,
      conversationId: req.params.conversationId,
      content: req.validatedMessageData.content,
      signal: aiAbort.signal,

      onChunk(text) {
        sendEvent({ type: "chunk", text });
      },
    });

    sendEvent({ type: "done", data: result });

    return res.end();
  } catch (error) {
    // Streaming has not started yet: use the normal JSON error handler.
    if (!res.headersSent) {
      return next(error);
    }

    // Streaming already started: report the error as an event instead.
    if (!res.writableEnded && !res.destroyed) {
      if (error instanceof AiError) {
        res.write(`data: ${JSON.stringify(toStreamErrorEvent(error))}\n\n`);
      } else {
        // Expected errors (AppError, such as "Conversation not found.") are
        // shown to the user; anything else is logged and hidden.
        if (!(error instanceof AppError)) {
          logger.error("assistant_stream_failed", { error });
        }

        const safeMessage =
          error instanceof AppError
            ? error.message
            : "Unable to generate the AI response. Please try again.";

        res.write(
          `data: ${JSON.stringify({
            type: "error",
            message: safeMessage,
            ...(error instanceof AppError && error.code ? { code: error.code } : {}),
          })}\n\n`
        );
      }

      res.end();
    }

    return undefined;
  }
}

export async function deleteConversation(
  req,
  res,
  next
) {
  try {
    const user = await syncCurrentUser(
      req.authenticatedUserId
    );

    const deletedConversation =
      await deleteConversationById(
        req.params.conversationId,
        user.id
      );

    if (!deletedConversation) {
      return sendError(
        res,
        "Conversation not found.",
        404
      );
    }

    return sendSuccess(
      res,
      null,
      "Conversation deleted successfully"
    );
  } catch (error) {
    return next(error);
  }
}