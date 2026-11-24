import { sendError, sendSuccess } from "../utils/api-response.js";
import {
  createInterviewSession,
  evaluateInterviewAnswer,
  getInterviewSessionById,
  getInterviewSessions,
} from "../services/interview-service.js";
import { syncCurrentUser } from "../services/user-service.js";

export async function createInterview(req, res, next) {
  try {
    const user = await syncCurrentUser(req.authenticatedUserId);

    const result = await createInterviewSession(
      user.id,
      req.validatedInterviewData
    );

    return sendSuccess(
      res,
      result,
      "Mock interview started successfully",
      201
    );
  } catch (error) {
    return next(error);
  }
}

export async function listInterviews(req, res, next) {
  try {
    const user = await syncCurrentUser(req.authenticatedUserId);

    const interviews = await getInterviewSessions(user.id);

    return sendSuccess(
      res,
      interviews,
      "Interview history retrieved successfully"
    );
  } catch (error) {
    return next(error);
  }
}

export async function getInterview(req, res, next) {
  try {
    const user = await syncCurrentUser(req.authenticatedUserId);

    const interview = await getInterviewSessionById(
      req.params.sessionId,
      user.id
    );

    if (!interview) {
      return sendError(res, "Interview session not found.", 404);
    }

    return sendSuccess(
      res,
      interview,
      "Interview session retrieved successfully"
    );
  } catch (error) {
    return next(error);
  }
}

export async function submitInterviewAnswer(req, res, next) {
  try {
    const user = await syncCurrentUser(req.authenticatedUserId);

    const result = await evaluateInterviewAnswer({
      userId: user.id,
      sessionId: req.params.sessionId,
      questionId: req.params.questionId,
      answerText: req.validatedAnswerData.answerText,
    });

    if (!result) {
      return sendError(res, "Interview session not found.", 404);
    }

    return sendSuccess(
      res,
      result,
      result.isCompleted
        ? "Interview completed successfully"
        : "Answer evaluated successfully",
      201
    );
  } catch (error) {
    return next(error);
  }
}