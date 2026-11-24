
import { z } from "zod";
import { sendError } from "../utils/api-response.js";
import {
  INVALID_CHARACTERS_MESSAGE,
  isSingleLineText,
} from "./text-rules.js";

// One-line text that must not contain control characters.
const line = (max, min = 0) =>
  z
    .string()
    .trim()
    .min(min)
    .max(max)
    .refine(isSingleLineText, INVALID_CHARACTERS_MESSAGE);

const profileSchema = z.object({
  education: line(120).optional().nullable(),
  college: line(150).optional().nullable(),
  degree: line(120).optional().nullable(),
  graduationYear: z.number().int().min(2000).max(2100).optional().nullable(),
  experienceLevel: line(60).optional().nullable(),
  targetRole: line(120).optional().nullable(),
  skills: z.array(line(60, 1)).max(50).optional(),
  interests: z.array(line(80, 1)).max(30).optional(),
});

export function validateProfile(req, res, next) {
  const result = profileSchema.safeParse(req.body);

  if (!result.success) {
    return sendError(
      res,
      "Invalid profile data.",
      400,
      result.error.flatten()
    );
  }

  req.validatedProfileData = result.data;

  return next();
}
