
import { aiService } from "../ai/ai-service.js";
import { createSkillGapPrompt } from "../ai/skill-gap-prompt.js";
import { skillGapReportSchema } from "../ai/skill-gap-schema.js";
import { prisma } from "../config/prisma.js";
import { AppError } from "../utils/app-error.js";
import { createInFlightGuard } from "../utils/in-flight-guard.js";

const runExclusive = createInFlightGuard(
  "Your skill-gap analysis is already being generated. Please wait a moment.",
);

const skillGapResponseSchema = {
  type: "object",
  properties: {
    targetRole: { type: "string" },
    matchPercentage: { type: "integer" },
    currentStrengths: {
      type: "array",
      items: { type: "string" },
    },
    missingSkills: {
      type: "array",
      items: {
        type: "object",
        properties: {
          skill: { type: "string" },
          priority: {
            type: "string",
            enum: ["High", "Medium", "Low"],
          },
          reason: { type: "string" },
          learningFocus: { type: "string" },
        },
        required: ["skill", "priority", "reason", "learningFocus"],
      },
    },
    prioritySkills: {
      type: "array",
      items: { type: "string" },
    },
    learningPlan: {
      type: "array",
      items: {
        type: "object",
        properties: {
          phase: { type: "string" },
          duration: { type: "string" },
          focus: { type: "string" },
          skills: {
            type: "array",
            items: { type: "string" },
          },
          milestone: { type: "string" },
        },
        required: ["phase", "duration", "focus", "skills", "milestone"],
      },
    },
    projectIdeas: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          description: { type: "string" },
          skills: {
            type: "array",
            items: { type: "string" },
          },
          difficulty: {
            type: "string",
            enum: ["Beginner", "Intermediate", "Advanced"],
          },
        },
        required: ["title", "description", "skills", "difficulty"],
      },
    },
    summary: { type: "string" },
  },
  required: [
    "targetRole",
    "matchPercentage",
    "currentStrengths",
    "missingSkills",
    "prioritySkills",
    "learningPlan",
    "projectIdeas",
    "summary",
  ],
};

export function generateSkillGapReport(userId) {
  return runExclusive(userId, () => buildSkillGapReport(userId));
}

async function buildSkillGapReport(userId) {
  const profile = await prisma.studentProfile.findUnique({
    where: {
      userId,
    },
  });

  if (!profile) {
    throw new AppError(
      "Please complete your student profile before analyzing your skill gap.",
      400,
      { code: "profile_incomplete" },
    );
  }

  if (!profile.targetRole || !profile.skills?.length) {
    throw new AppError(
      "Please add a target role and your current skills before analyzing your skill gap.",
      400,
      { code: "profile_incomplete" },
    );
  }

  // Validated against skillGapReportSchema inside the AI layer. If one provider
  // returns an incomplete report, the next provider is tried automatically.
  const report = await aiService.generateJson({
    feature: "skill-gap",
    prompt: createSkillGapPrompt(profile),
    jsonSchema: skillGapResponseSchema,
    schema: skillGapReportSchema,
  });

  return prisma.skillGapReport.create({
    data: {
      userId,
      targetRole: report.targetRole,
      matchPercentage: report.matchPercentage,
      currentStrengths: report.currentStrengths,
      missingSkills: report.missingSkills,
      prioritySkills: report.prioritySkills,
      learningPlan: report.learningPlan,
      projectIdeas: report.projectIdeas,
      summary: report.summary,
    },
  });
}

export async function getSkillGapReports(userId) {
  return prisma.skillGapReport.findMany({
    where: {
      userId,
    },
    orderBy: {
      createdAt: "desc",
    },
    select: {
      id: true,
      targetRole: true,
      matchPercentage: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}

export async function getSkillGapReportById(reportId, userId) {
  return prisma.skillGapReport.findFirst({
    where: {
      id: reportId,
      userId,
    },
  });
}
