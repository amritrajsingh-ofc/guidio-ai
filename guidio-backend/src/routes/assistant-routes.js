
import { Router } from "express";

import {
  createNewConversation,
  deleteConversation,
  getConversation,
  listConversations,
  sendMessage,
} from "../controllers/assistant-controller.js";

import { requireAuth } from "../middleware/require-auth.js";
import { validateObjectId } from "../middleware/validate-object-id.js";

import {
  validateCreateConversation,
  validateCreateMessage,
} from "../middleware/validate-assistant.js";

import { aiLimiter, writeLimiter } from "../middleware/rate-limiters.js";

const assistantRouter = Router();

assistantRouter.post(
  "/conversations",
  requireAuth,
  writeLimiter,
  validateCreateConversation,
  createNewConversation
);

assistantRouter.get("/conversations", requireAuth, listConversations);

assistantRouter.get(
  "/conversations/:conversationId",
  requireAuth,
  validateObjectId("conversationId"),
  getConversation
);

assistantRouter.post(
  "/conversations/:conversationId/messages",
  requireAuth,
  validateObjectId("conversationId"),
  aiLimiter,
  validateCreateMessage,
  sendMessage
);

assistantRouter.delete(
  "/conversations/:conversationId",
  requireAuth,
  validateObjectId("conversationId"),
  writeLimiter,
  deleteConversation
);

export default assistantRouter;
