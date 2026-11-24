
import { z } from "zod";
import { sendError } from "../utils/api-response.js";
import {
  INVALID_CHARACTERS_MESSAGE,
  isMultiLineText,
  isSingleLineText,
} from "./text-rules.js";

const createConversationSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1)
    .max(100)
    .refine(isSingleLineText, INVALID_CHARACTERS_MESSAGE)
    .optional(),
});

const createMessageSchema = z.object({
  content: z
    .string()
    .trim()
    .min(1)
    .max(5000)
    .refine(isMultiLineText, INVALID_CHARACTERS_MESSAGE),
});

export function validateCreateConversation(req, res, next) {
  const result = createConversationSchema.safeParse(req.body);

  if (!result.success) {
    return sendError(
      res,
      "Invalid conversation data.",
      400,
      result.error.flatten()
    );
  }

  req.validatedConversationData = result.data;

  return next();
}

export function validateCreateMessage(req, res, next) {
  const result = createMessageSchema.safeParse(req.body);

  if (!result.success) {
    return sendError(
      res,
      "Your message must contain between 1 and 5000 characters.",
      400,
      result.error.flatten()
    );
  }

  req.validatedMessageData = result.data;

  return next();
}
