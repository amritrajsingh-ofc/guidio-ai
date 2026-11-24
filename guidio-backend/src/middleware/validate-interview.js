
import { z } from "zod";
import { sendError } from "../utils/api-response.js";
import {
  INVALID_CHARACTERS_MESSAGE,
  isMultiLineText,
  isSingleLineText,
} from "./text-rules.js";

const createInterviewSchema = z.object({
  interviewType: z.enum(["Technical", "HR", "Mixed"]),
  targetRole: z
    .string()
    .trim()
    .min(2)
    .max(120)
    .refine(isSingleLineText, INVALID_CHARACTERS_MESSAGE),
  difficulty: z.enum(["Beginner", "Medium", "Hard"]),
});

const submitAnswerSchema = z.object({
  answerText: z
    .string()
    .trim()
    .min(10)
    .max(8000)
    .refine(isMultiLineText, INVALID_CHARACTERS_MESSAGE),
});

export function validateCreateInterview(req, res, next) {
  const result = createInterviewSchema.safeParse(req.body);

  if (!result.success) {
    return sendError(
      res,
      "Invalid interview setup. Please check your choices.",
      400,
      result.error.flatten()
    );
  }

  req.validatedInterviewData = result.data;

  return next();
}

export function validateSubmitAnswer(req, res, next) {
  const result = submitAnswerSchema.safeParse(req.body);

  if (!result.success) {
    return sendError(
      res,
      "Your answer must contain between 10 and 8000 characters.",
      400,
      result.error.flatten()
    );
  }

  req.validatedAnswerData = result.data;

  return next();
}
