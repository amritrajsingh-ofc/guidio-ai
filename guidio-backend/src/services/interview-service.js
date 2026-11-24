import { isAiError } from "../ai/ai-errors.js";
import { aiService } from "../ai/ai-service.js";
import {
  interviewEvaluationSchema,
  interviewQuestionSchema,
  interviewSummarySchema,
} from "../ai/interview-schema.js";
import {
  createInterviewEvaluationPrompt,
  createInterviewQuestionPrompt,
  createInterviewSummaryPrompt,
} from "../ai/interview-prompt.js";
import { prisma } from "../config/prisma.js";
import { inngest } from "../inngest/client.js";
import { AppError } from "../utils/app-error.js";
import { createInFlightGuard } from "../utils/in-flight-guard.js";
import { logger } from "../utils/logger.js";

/* =========================================================
   CONSTANTS
   ========================================================= */

const TOTAL_QUESTIONS = 5;

const SESSION_DETAIL_INCLUDE = {
  questions: {
    orderBy: { order: "asc" },
    include: { answer: true },
  },
  improvementSummary: true,
};

const FALLBACK_SUMMARY =
  "Your interview is complete. Review the feedback from each answer and focus on the improvement areas before your next practice session.";

// One interview start per user at a time, and one evaluation per question.
const runStartExclusive = createInFlightGuard(
  "Your interview is already being prepared. Please wait a moment.",
);

const runAnswerExclusive = createInFlightGuard(
  "This answer is already being evaluated. Please wait a moment.",
);

/* =========================================================
   JSON SCHEMAS SENT TO THE AI PROVIDERS
   (the Zod schemas in interview-schema.js validate the replies)
   ========================================================= */

const questionResponseSchema = {
  type: "object",
  properties: {
    question: { type: "string" },
    questionType: { type: "string" },
    idealAnswer: { type: "string" },
  },
  required: ["question", "questionType", "idealAnswer"],
};

const evaluationResponseSchema = {
  type: "object",
  properties: {
    overallScore: { type: "integer" },
    technicalScore: { type: "integer" },
    communicationScore: { type: "integer" },
    structureScore: { type: "integer" },
    confidenceScore: { type: "integer" },
    relevanceScore: { type: "integer" },
    strengths: {
      type: "array",
      items: { type: "string" },
    },
    improvements: {
      type: "array",
      items: { type: "string" },
    },
    feedback: { type: "string" },
  },
  required: [
    "overallScore",
    "technicalScore",
    "communicationScore",
    "structureScore",
    "confidenceScore",
    "relevanceScore",
    "strengths",
    "improvements",
    "feedback",
  ],
};

const summaryResponseSchema = {
  type: "object",
  properties: {
    overallScore: { type: "integer" },
    summary: { type: "string" },
    strengths: {
      type: "array",
      items: { type: "string" },
    },
    improvements: {
      type: "array",
      items: { type: "string" },
    },
  },
  required: ["overallScore", "summary", "strengths", "improvements"],
};

/* =========================================================
   AI HELPERS (nothing is saved here)
   ========================================================= */

/**
 * The student's profile, used only to pitch questions and feedback to the
 * student's field. It is optional: if it cannot be loaded, the interview
 * still works from the target role alone.
 */
async function getStudentProfile(userId) {
  try {
    return await prisma.studentProfile.findUnique({
      where: { userId },
      select: {
        education: true,
        degree: true,
        graduationYear: true,
        experienceLevel: true,
        targetRole: true,
        skills: true,
        interests: true,
      },
    });
  } catch (error) {
    logger.warn("interview_profile_context_failed", { userId, error });
    return null;
  }
}

/**
 * Asks the AI for the next question. Returns validated data only.
 * Saving is done by the caller, together with other writes, so a failure
 * never leaves a half-finished interview behind.
 */
function generateQuestionData({
  interviewType,
  targetRole,
  difficulty,
  questionNumber,
  totalQuestions,
  previousQuestions,
  studentProfile,
}) {
  return aiService.generateJson({
    feature: "interview-question",
    prompt: createInterviewQuestionPrompt({
      interviewType,
      targetRole,
      difficulty,
      questionNumber,
      totalQuestions,
      previousQuestions,
      studentProfile,
    }),
    jsonSchema: questionResponseSchema,
    schema: interviewQuestionSchema,
  });
}

/* =========================================================
   CREATE SESSION
   ========================================================= */

/**
 * The first question is generated BEFORE anything is saved. If the AI fails,
 * no empty session is created. The session and its first question are then
 * saved in one nested write.
 */
export function createInterviewSession(userId, interviewData) {
  return runStartExclusive(userId, async () => {
    const studentProfile = await getStudentProfile(userId);

    const firstQuestion = await generateQuestionData({
      interviewType: interviewData.interviewType,
      targetRole: interviewData.targetRole,
      difficulty: interviewData.difficulty,
      questionNumber: 1,
      totalQuestions: TOTAL_QUESTIONS,
      previousQuestions: [],
      studentProfile,
    });

    const created = await prisma.interviewSession.create({
      data: {
        userId,
        interviewType: interviewData.interviewType,
        targetRole: interviewData.targetRole,
        difficulty: interviewData.difficulty,
        totalQuestions: TOTAL_QUESTIONS,
        currentQuestion: 1,
        strengths: [],
        improvements: [],
        questions: {
          create: {
            question: firstQuestion.question,
            questionType: firstQuestion.questionType,
            idealAnswer: firstQuestion.idealAnswer,
            order: 1,
          },
        },
      },
      include: {
        questions: { orderBy: { order: "asc" } },
      },
    });

    // Same response shape as before: a plain session plus the first question.
    const { questions, ...session } = created;

    return {
      session,
      firstQuestion: questions[0],
    };
  });
}

/* =========================================================
   READ
   ========================================================= */

export async function getInterviewSessions(userId) {
  return prisma.interviewSession.findMany({
    where: {
      userId,
    },
    orderBy: {
      createdAt: "desc",
    },
    select: {
      id: true,
      interviewType: true,
      targetRole: true,
      difficulty: true,
      status: true,
      totalQuestions: true,
      currentQuestion: true,
      overallScore: true,
      startedAt: true,
      completedAt: true,
      createdAt: true,
    },
  });
}

export async function getInterviewSessionById(sessionId, userId) {
  return prisma.interviewSession.findFirst({
    where: {
      id: sessionId,
      userId,
    },
    include: SESSION_DETAIL_INCLUDE,
  });
}

/* =========================================================
   SUBMIT AN ANSWER
   ========================================================= */

/**
 * Order of work (this is what prevents "stuck" interviews):
 *   1. evaluate the answer with the AI        (nothing saved yet)
 *   2. generate the next question with the AI (nothing saved yet)
 *   3. save the answer, move the session on and save the next question
 *      in ONE transaction.
 * If step 1 or 2 fails, nothing was saved, so the student can simply submit
 * the same answer again.
 */
export function evaluateInterviewAnswer({
  userId,
  sessionId,
  questionId,
  answerText,
}) {
  // Taken before any database read, so a double click is rejected cheaply.
  const lockKey = `${userId}:${sessionId}:${questionId}`;

  return runAnswerExclusive(lockKey, async () => {
    const session = await getInterviewSessionById(sessionId, userId);

    if (!session) {
      throw new AppError("Interview session not found.", 404, {
        code: "not_found",
      });
    }

    if (session.status !== "IN_PROGRESS") {
      throw new AppError("This interview session is already completed.", 400, {
        code: "interview_completed",
      });
    }

    const question = session.questions.find((item) => item.id === questionId);

    if (!question) {
      throw new AppError("Interview question not found.", 404, {
        code: "not_found",
      });
    }

    if (question.answer) {
      throw new AppError("This question has already been answered.", 400, {
        code: "already_answered",
      });
    }

    const answeredCount = session.questions.filter((item) => item.answer).length;
    const isLastQuestion = answeredCount + 1 >= session.totalQuestions;

    const studentProfile = await getStudentProfile(userId);

    // Step 1: evaluate. Validated with Zod inside the AI layer.
    const evaluation = await aiService.generateJson({
      feature: "interview-evaluation",
      prompt: createInterviewEvaluationPrompt({
        interviewType: session.interviewType,
        targetRole: session.targetRole,
        difficulty: session.difficulty,
        question: question.question,
        idealAnswer: question.idealAnswer,
        answerText,
        studentProfile,
      }),
      jsonSchema: evaluationResponseSchema,
      schema: interviewEvaluationSchema,
    });

    // Step 2: prepare the next question (not needed after the last answer).
    const nextQuestionNumber = session.currentQuestion + 1;

    const nextQuestionData = isLastQuestion
      ? null
      : await generateQuestionData({
          interviewType: session.interviewType,
          targetRole: session.targetRole,
          difficulty: session.difficulty,
          questionNumber: nextQuestionNumber,
          totalQuestions: session.totalQuestions,
          previousQuestions: session.questions.map((item) => item.question),
          studentProfile,
        });

    // Step 3: save everything or nothing.
    const { answer, nextQuestion } = await prisma.$transaction(async (tx) => {
      // Claims this turn. If another request already moved the interview on
      // (or completed it), nothing matches and the transaction is cancelled.
      const claimed = await tx.interviewSession.updateMany({
        where: {
          id: sessionId,
          userId,
          status: "IN_PROGRESS",
          currentQuestion: session.currentQuestion,
        },
        data: {
          currentQuestion: isLastQuestion
            ? session.currentQuestion
            : nextQuestionNumber,
        },
      });

      if (claimed.count !== 1) {
        throw new AppError(
          "This interview changed while your answer was being evaluated. Please reload the page.",
          409,
          { code: "interview_changed" },
        );
      }

      const savedAnswer = await tx.interviewAnswer.create({
        data: {
          questionId,
          answerText,
          overallScore: evaluation.overallScore,
          technicalScore: evaluation.technicalScore,
          communicationScore: evaluation.communicationScore,
          structureScore: evaluation.structureScore,
          confidenceScore: evaluation.confidenceScore,
          relevanceScore: evaluation.relevanceScore,
          strengths: evaluation.strengths,
          improvements: evaluation.improvements,
          feedback: evaluation.feedback,
        },
      });

      const savedQuestion = nextQuestionData
        ? await tx.interviewQuestion.create({
            data: {
              sessionId,
              question: nextQuestionData.question,
              questionType: nextQuestionData.questionType,
              idealAnswer: nextQuestionData.idealAnswer,
              order: nextQuestionNumber,
            },
          })
        : null;

      return { answer: savedAnswer, nextQuestion: savedQuestion };
    });

    if (isLastQuestion) {
      const completedSession = await completeInterviewSession(sessionId, userId);

      return {
        answer,
        isCompleted: true,
        session: completedSession,
        nextQuestion: null,
      };
    }

    const updatedSession = await prisma.interviewSession.findFirst({
      where: { id: sessionId, userId },
    });

    return {
      answer,
      isCompleted: false,
      session: updatedSession,
      nextQuestion,
    };
  });
}

/* =========================================================
   COMPLETE A SESSION
   ========================================================= */

/**
 * The answers are already saved when this runs. Whatever happens with the AI
 * summary, the interview is completed: if the AI cannot produce a summary, a
 * simple one based on the average score is saved instead, so the student is
 * never stuck on the last question.
 */
export async function completeInterviewSession(sessionId, userId) {
  const session = await getInterviewSessionById(sessionId, userId);

  if (!session) {
    throw new AppError("Interview session not found.", 404, {
      code: "not_found",
    });
  }

  if (session.status === "COMPLETED") {
    return session;
  }

  const answeredQuestions = session.questions.filter((item) => item.answer);

  if (answeredQuestions.length === 0) {
    throw new AppError(
      "You need to answer at least one question before completing the interview.",
      400,
      { code: "no_answers" },
    );
  }

  const averageScore = Math.round(
    answeredQuestions.reduce((total, item) => total + item.answer.overallScore, 0) /
      answeredQuestions.length,
  );

  let summary = null;

  try {
    summary = await aiService.generateJson({
      feature: "interview-summary",
      prompt: createInterviewSummaryPrompt({
        interviewType: session.interviewType,
        targetRole: session.targetRole,
        difficulty: session.difficulty,
        answers: answeredQuestions.map((item) => ({
          question: item.question,
          answerText: item.answer.answerText,
          overallScore: item.answer.overallScore,
          strengths: item.answer.strengths,
          improvements: item.answer.improvements,
        })),
      }),
      jsonSchema: summaryResponseSchema,
      schema: interviewSummarySchema,
    });
  } catch (error) {
    // Rate limit, outage or unusable output: use the simple summary.
    if (!isAiError(error)) {
      throw error;
    }

    logger.warn("interview_summary_fallback_used", {
      sessionId,
      reason: error.code,
    });
  }

  // Only one request can complete the session (and send the event).
  const completed = await prisma.interviewSession.updateMany({
    where: { id: sessionId, userId, status: "IN_PROGRESS" },
    data: {
      status: "COMPLETED",
      overallScore: summary?.overallScore ?? averageScore,
      summary: summary?.summary ?? FALLBACK_SUMMARY,
      strengths: summary?.strengths ?? [],
      improvements: summary?.improvements ?? [],
      completedAt: new Date(),
    },
  });

  if (completed.count === 1) {
    try {
      await inngest.send({
        name: "interview/completed",
        data: { sessionId, userId },
      });
    } catch (error) {
      // The interview is already completed. Only the optional background
      // improvement summary is lost, so this must not fail the request.
      logger.warn("interview_completed_event_failed", { sessionId, error });
    }
  }

  return getInterviewSessionById(sessionId, userId);
}