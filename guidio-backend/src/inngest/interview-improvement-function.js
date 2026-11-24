import { NonRetriableError, RetryAfterError } from "inngest";
import { z } from "zod";
import { inngest } from "./client.js";
import { aiService } from "../ai/ai-service.js";
import { AI_ERROR, isAiError } from "../ai/ai-errors.js";
import { prisma } from "../config/prisma.js";

const improvementSummarySchema = z.object({
  title: z.string().trim().min(5).max(150),
  summary: z.string().trim().min(40).max(1200),
  actionItems: z
    .array(z.string().trim().min(10).max(250))
    .min(3)
    .max(6),
});

const improvementResponseSchema = {
  type: "object",
  properties: {
    title: { type: "string" },
    summary: { type: "string" },
    actionItems: {
      type: "array",
      items: { type: "string" },
    },
  },
  required: ["title", "summary", "actionItems"],
};

export const createInterviewImprovementSummary = inngest.createFunction(
  {
    id: "create-interview-improvement-summary",
    name: "Create Interview Improvement Summary",
    triggers: [
      {
        event: "interview/completed",
      },
    ],
    retries: 2,
  },
  async ({ event, step, logger }) => {
    const { sessionId, userId } = event.data;

    const session = await step.run("load-completed-interview", async () => {
      return prisma.interviewSession.findFirst({
        where: {
          id: sessionId,
          userId,
          status: "COMPLETED",
        },
        include: {
          questions: {
            orderBy: {
              order: "asc",
            },
            include: {
              answer: true,
            },
          },
        },
      });
    });

    if (!session) {
      logger.warn("Completed interview session was not found.", {
        sessionId,
        userId,
      });

      return {
        skipped: true,
        reason: "Interview session not found or is not completed.",
      };
    }

    const completedAnswers = session.questions
      .filter((question) => question.answer)
      .map((question) => ({
        question: question.question,
        answerText: question.answer.answerText,
        overallScore: question.answer.overallScore,
        strengths: question.answer.strengths,
        improvements: question.answer.improvements,
      }));

    if (!completedAnswers.length) {
      return {
        skipped: true,
        reason: "No answers exist for this interview.",
      };
    }

    const answerDetails = completedAnswers
      .map(
        (answer, index) => `
Question ${index + 1}: ${answer.question}
Student answer: ${answer.answerText}
Answer score: ${answer.overallScore}/100
Strengths: ${answer.strengths.join("; ")}
Improvement areas: ${answer.improvements.join("; ")}
`
      )
      .join("\n");

    const summary = await step.run(
      "generate-improvement-summary",
      async () => {
        try {
          return await aiService.generateJson({
            feature: "interview-improvement",
            jsonSchema: improvementResponseSchema,
            schema: improvementSummarySchema,
            prompt: `
You are Guidio AI Interview Improvement Coach.

Create a short, practical improvement plan from this completed mock interview.

Interview information:
- Target role: ${session.targetRole}
- Interview type: ${session.interviewType}
- Difficulty: ${session.difficulty}
- Final score: ${session.overallScore ?? "Not available"}/100
- Existing overall strengths: ${session.strengths.join("; ") || "Not available"}
- Existing overall improvements: ${session.improvements.join("; ") || "Not available"}

Detailed answers:
${answerDetails}

Rules:
1. Create a helpful title mentioning the target role.
2. Write a clear, encouraging summary in simple language.
3. Give 3 to 6 specific action items the student can complete.
4. Do not promise job placement, selection, salary, or interview success.
5. Do not use Markdown.
6. Return only valid JSON.
`,
          });
        } catch (error) {
          if (!isAiError(error)) throw error;

          // Wait exactly as long as the provider asked, instead of guessing.
          if (error.code === AI_ERROR.RATE_LIMITED && error.retryAfterSeconds) {
            throw new RetryAfterError(
              error.message,
              Math.ceil(error.retryAfterSeconds) * 1000,
              { cause: error }
            );
          }

          // Retrying cannot fix these.
          if (
            [
              AI_ERROR.INVALID_REQUEST,
              AI_ERROR.SAFETY,
              AI_ERROR.NOT_CONFIGURED,
            ].includes(error.code)
          ) {
            throw new NonRetriableError(error.message, { cause: error });
          }

          throw error;
        }
      }
    );

    const savedSummary = await step.run(
      "save-improvement-summary",
      async () => {
        return prisma.interviewImprovementSummary.upsert({
          where: {
            sessionId,
          },
          update: {
            title: summary.title,
            summary: summary.summary,
            actionItems: summary.actionItems,
          },
          create: {
            sessionId,
            title: summary.title,
            summary: summary.summary,
            actionItems: summary.actionItems,
          },
        });
      }
    );

    return {
      success: true,
      summaryId: savedSummary.id,
      sessionId,
    };
  }
);