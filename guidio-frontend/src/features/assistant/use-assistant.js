import { useEffect, useRef, useState } from "react";
import { useAuth } from "@clerk/react";
import { ApiError, apiRequest, apiStream } from "@/lib/api-client";
import { getFriendlyAiError } from "@/lib/ai";
import { useCooldown } from "@/hooks/use-cooldown";
import { buildTitleFromContent, isDefaultTitle } from "./assistant-utils";

const CONVERSATIONS_ENDPOINT = "/api/assistant/conversations";
const STREAM_CONNECT_TIMEOUT_MS = 60_000;

function conversationUrl(id) {
  return `${CONVERSATIONS_ENDPOINT}/${encodeURIComponent(id)}`;
}

/**
 * All state and API calls for the AI Student Assistant.
 *
 * Backend contract (unchanged):
 *   GET    /api/assistant/conversations
 *   POST   /api/assistant/conversations                      body {}
 *   GET    /api/assistant/conversations/:id
 *   DELETE /api/assistant/conversations/:id
 *   POST   /api/assistant/conversations/:id/messages         body { content }
 *          answers with server-sent events: start, chunk, done, error
 */
export function useAssistant() {
  const { getToken } = useAuth();
  const cooldown = useCooldown();

  // Clerk may hand out a new getToken function between renders. A ref keeps
  // our callbacks and effects from re-running because of that.
  const getTokenRef = useRef(getToken);

  const [conversations, setConversations] = useState([]);
  const [listStatus, setListStatus] = useState("loading");
  const [listReloadKey, setListReloadKey] = useState(0);

  const [activeId, setActiveId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);

  const [isSending, setIsSending] = useState(false);
  const [draft, setDraft] = useState("");
  const [sendError, setSendError] = useState(null);
  const [pageError, setPageError] = useState("");

  const sendingRef = useRef(false);
  const abortRef = useRef(null);
  const loadRequestRef = useRef(0);
  const pendingTextRef = useRef("");
  const frameRef = useRef(null);

  useEffect(() => {
    getTokenRef.current = getToken;
  }, [getToken]);

  /* -------------------------------------------------------
     Cleanup when the page is left
     ------------------------------------------------------- */

  useEffect(() => {
    return () => {
      abortRef.current?.abort();

      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
    };
  }, []);

  /* -------------------------------------------------------
     Conversation list
     ------------------------------------------------------- */

  useEffect(() => {
    const controller = new AbortController();

    async function loadConversations() {
      try {
        const token = await getTokenRef.current();
        const response = await apiRequest(CONVERSATIONS_ENDPOINT, {
          token,
          signal: controller.signal,
        });

        setConversations(Array.isArray(response?.data) ? response.data : []);
        setListStatus("ready");
      } catch (error) {
        if (error?.name === "AbortError") return;

        setListStatus("error");
      }
    }

    loadConversations();

    return () => controller.abort();
  }, [listReloadKey]);

  function retryConversationList() {
    setListStatus("loading");
    setListReloadKey((key) => key + 1);
  }

  // Quiet refresh used after a failed send, because the server may already
  // have saved the question even though no answer was produced.
  async function refreshConversations() {
    try {
      const token = await getTokenRef.current();
      const response = await apiRequest(CONVERSATIONS_ENDPOINT, { token });

      if (Array.isArray(response?.data)) {
        setConversations(response.data);
      }
    } catch {
      // The list simply stays as it is.
    }
  }

  /* -------------------------------------------------------
     Open, start and delete conversations
     ------------------------------------------------------- */

  async function selectConversation(id) {
    if (sendingRef.current || id === activeId) return;

    const requestId = ++loadRequestRef.current;

    setActiveId(id);
    setMessages([]);
    setIsLoadingMessages(true);
    setSendError(null);
    setPageError("");

    try {
      const token = await getTokenRef.current();
      const response = await apiRequest(conversationUrl(id), { token });

      if (requestId !== loadRequestRef.current) return;

      setMessages(
        Array.isArray(response?.data?.messages) ? response.data.messages : []
      );
    } catch (error) {
      if (requestId !== loadRequestRef.current) return;

      setActiveId(null);
      setPageError(error?.message || "Unable to load this conversation.");
    } finally {
      if (requestId === loadRequestRef.current) {
        setIsLoadingMessages(false);
      }
    }
  }

  // A new chat is only created on the server when the first message is sent,
  // so empty conversations are never left behind.
  function startNewChat() {
    if (sendingRef.current) return;

    loadRequestRef.current += 1;

    setActiveId(null);
    setMessages([]);
    setIsLoadingMessages(false);
    setSendError(null);
    setPageError("");
  }

  async function deleteConversation(id) {
    if (sendingRef.current) return;

    try {
      setPageError("");

      const token = await getTokenRef.current();
      await apiRequest(conversationUrl(id), { method: "DELETE", token });

      setConversations((current) =>
        current.filter((conversation) => conversation.id !== id)
      );

      if (id === activeId) {
        startNewChat();
      }
    } catch (error) {
      setPageError(error?.message || "Unable to delete the conversation.");
    }
  }

  /* -------------------------------------------------------
     Sending a message (streaming)
     ------------------------------------------------------- */

  function flushPendingText(temporaryAssistantId) {
    const text = pendingTextRef.current;
    if (!text) return;

    pendingTextRef.current = "";

    setMessages((current) =>
      current.map((message) =>
        message.id === temporaryAssistantId
          ? { ...message, content: (message.content || "") + text }
          : message
      )
    );
  }

  // Chunks arrive faster than the screen refreshes. They are collected and
  // drawn at most once per frame, which keeps long answers smooth.
  function scheduleFlush(temporaryAssistantId) {
    if (frameRef.current) return;

    frameRef.current = requestAnimationFrame(() => {
      frameRef.current = null;
      flushPendingText(temporaryAssistantId);
    });
  }

  function cancelScheduledFlush() {
    if (frameRef.current) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
  }

  async function reloadMessages(conversationId, token) {
    try {
      const response = await apiRequest(conversationUrl(conversationId), {
        token,
      });
      const saved = response?.data?.messages;

      if (!Array.isArray(saved)) return false;

      setMessages(saved);

      return saved.at(-1)?.role === "assistant";
    } catch {
      return false;
    }
  }

  async function sendMessage(rawContent) {
    const content = (typeof rawContent === "string" ? rawContent : draft).trim();

    if (!content || sendingRef.current || cooldown.isCoolingDown) return;

    sendingRef.current = true;
    setIsSending(true);
    setSendError(null);
    setPageError("");
    setDraft("");

    const controller = new AbortController();
    abortRef.current = controller;

    const stamp = Date.now();
    const temporaryUserId = `temp-user-${stamp}`;
    const temporaryAssistantId = `temp-assistant-${stamp}`;

    try {
      const token = await getTokenRef.current();

      if (!token) {
        throw new ApiError("Your session has expired. Please sign in again.", {
          status: 401,
          code: "unauthorized",
        });
      }

      let conversationId = activeId;

      if (!conversationId) {
        const created = await apiRequest(CONVERSATIONS_ENDPOINT, {
          method: "POST",
          token,
          body: {},
          signal: controller.signal,
        });

        if (!created?.data?.id) {
          throw new Error("Unable to start a new conversation.");
        }

        conversationId = created.data.id;

        setActiveId(conversationId);
        setConversations((current) => [created.data, ...current]);
      }

      const now = new Date().toISOString();

      setMessages((current) => [
        ...current,
        {
          id: temporaryUserId,
          role: "user",
          content,
          createdAt: now,
        },
        {
          id: temporaryAssistantId,
          role: "assistant",
          content: "",
          createdAt: now,
          isStreaming: true,
        },
      ]);

      const { finished } = await apiStream(
        `${conversationUrl(conversationId)}/messages`,
        {
          token,
          body: { content },
          signal: controller.signal,
          timeoutMs: STREAM_CONNECT_TIMEOUT_MS,

          onEvent(payload) {
            if (payload.type === "chunk") {
              if (payload.text) {
                pendingTextRef.current += payload.text;
                scheduleFlush(temporaryAssistantId);
              }
              return;
            }

            if (payload.type !== "done") return;

            cancelScheduledFlush();
            pendingTextRef.current = "";

            const { userMessage, assistantMessage } = payload.data || {};

            if (!userMessage || !assistantMessage) {
              throw new Error("The AI response completed incorrectly.");
            }

            setMessages((current) => [
              ...current.filter(
                (message) =>
                  message.id !== temporaryUserId &&
                  message.id !== temporaryAssistantId
              ),
              { ...userMessage, isStreaming: false },
              { ...assistantMessage, isStreaming: false },
            ]);

            const updatedAt = assistantMessage.createdAt || now;

            setConversations((current) => {
              const existing = current.find(
                (conversation) => conversation.id === conversationId
              );

              const updated = {
                ...(existing || { id: conversationId, createdAt: updatedAt }),
                title:
                  existing && !isDefaultTitle(existing.title)
                    ? existing.title
                    : buildTitleFromContent(content),
                updatedAt,
              };

              return [
                updated,
                ...current.filter(
                  (conversation) => conversation.id !== conversationId
                ),
              ];
            });
          },
        }
      );

      // The connection ended without a "done" event. Ask the server what it
      // saved, so the screen matches the saved conversation.
      if (!finished) {
        cancelScheduledFlush();
        pendingTextRef.current = "";

        const recovered = await reloadMessages(conversationId, token);

        if (!recovered) {
          throw new ApiError(
            "The connection ended before the answer was complete. Please try again.",
            { code: "network" }
          );
        }
      }
    } catch (error) {
      cancelScheduledFlush();
      pendingTextRef.current = "";

      if (error?.name === "AbortError") return;

      console.error("Assistant message failed:", error);

      // Remove the unfinished bubbles and put the text back in the box.
      setMessages((current) =>
        current.filter(
          (message) =>
            message.id !== temporaryUserId &&
            message.id !== temporaryAssistantId
        )
      );
      setDraft(content);
      setSendError(error);

      const friendly = getFriendlyAiError(error);

      if (friendly.kind === "rate_limited") {
        cooldown.start(friendly.retryAfterSeconds);
      }

      refreshConversations();
    } finally {
      sendingRef.current = false;
      abortRef.current = null;
      setIsSending(false);
    }
  }

  const activeTitle =
    conversations.find((conversation) => conversation.id === activeId)?.title ||
    "";

  return {
    conversations,
    listStatus,
    retryConversationList,
    activeId,
    activeTitle,
    messages,
    isLoadingMessages,
    isSending,
    draft,
    setDraft,
    sendError,
    dismissSendError: () => setSendError(null),
    pageError,
    dismissPageError: () => setPageError(""),
    cooldown,
    sendMessage,
    selectConversation,
    startNewChat,
    deleteConversation,
  };
}