import { Router } from "express";

import {
  createInterview,
  getInterview,
  listInterviews,
  submitInterviewAnswer,
} from "../controllers/interview-controller.js";

import { requireAuth } from "../middleware/require-auth.js";
import { validateObjectId } from "../middleware/validate-object-id.js";

import {
  validateCreateInterview,
  validateSubmitAnswer,
} from "../middleware/validate-interview.js";

import { interviewLimiter } from "../middleware/rate-limiters.js";

const interviewRouter = Router();

interviewRouter.post(
  "/",
  requireAuth,
  interviewLimiter,
  validateCreateInterview,
  createInterview
);

interviewRouter.get("/", requireAuth, listInterviews);

interviewRouter.get(
  "/:sessionId",
  requireAuth,
  validateObjectId("sessionId"),
  getInterview
);

interviewRouter.post(
  "/:sessionId/questions/:questionId/answer",
  requireAuth,
  validateObjectId("sessionId", "questionId"),
  interviewLimiter,
  validateSubmitAnswer,
  submitInterviewAnswer
);

export default interviewRouter;