
import { careerPlanSchema } from "../ai/career-schema.js";
import { createCareerPrompt } from "../ai/career-prompt.js";
import { aiService } from "../ai/ai-service.js";
import { prisma } from "../config/prisma.js";
import { AppError } from "../utils/app-error.js";
import { createInFlightGuard } from "../utils/in-flight-guard.js";

const runExclusive = createInFlightGuard(
  "Your career guidance is already being generated. Please wait a moment.",
);

const careerResponseSchema = {
  type: "object",
  properties: {
    primaryRole: { type: "string" },
    alternativeRoles: {
      type: "array",
      items: { type: "string" },
    },
    summary: { type: "string" },
    readinessScore: { type: "integer" },
    strengths: {
      type: "array",
      items: { type: "string" },
    },
    prioritySkills: {
      type: "array",
      items: { type: "string" },
    },
    roadmap: {
      type: "array",
      items: {
        type: "object",
        properties: {
          phase: { type: "string" },
          duration: { type: "string" },
          goal: { type: "string" },
          topics: {
            type: "array",
            items: { type: "string" },
          },
          outcome: { type: "string" },
        },
        required: ["phase", "duration", "goal", "topics", "outcome"],
      },
    },
    projects: {
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
    interviewTopics: {
      type: "array",
      items: { type: "string" },
    },
    advice: { type: "string" },
  },
  required: [
    "primaryRole",
    "alternativeRoles",
    "summary",
    "readinessScore",
    "strengths",
    "prioritySkills",
    "roadmap",
    "projects",
    "interviewTopics",
    "advice",
  ],
};

export function generateCareerPlan(userId) {
  return runExclusive(userId, () => buildCareerPlan(userId));
}

async function buildCareerPlan(userId) {
  const profile = await prisma.studentProfile.findUnique({
    where: {
      userId,
    },
  });

  if (!profile) {
    throw new AppError(
      "Please complete your student profile before generating career guidance.",
      400,
      { code: "profile_incomplete" },
    );
  }

  const profileCompletionFields = [
    profile.education,
    profile.degree,
    profile.experienceLevel,
    profile.targetRole,
    profile.skills?.length > 0,
    profile.interests?.length > 0,
  ];

  const completedFields = profileCompletionFields.filter(Boolean).length;

  if (completedFields < 4) {
    throw new AppError(
      "Please add more profile details, especially your target role, skills, and interests, before generating career guidance.",
      400,
      { code: "profile_incomplete" },
    );
  }

  // Validated against careerPlanSchema inside the AI layer. If one provider
  // returns an incomplete plan, the next provider is tried automatically.
  const plan = await aiService.generateJson({
    feature: "career",
    prompt: createCareerPrompt(profile),
    jsonSchema: careerResponseSchema,
    schema: careerPlanSchema,
  });

  return prisma.careerPlan.create({
    data: {
      userId,
      targetRole: profile.targetRole || null,
      primaryRole: plan.primaryRole,
      alternativeRoles: plan.alternativeRoles,
      summary: plan.summary,
      readinessScore: plan.readinessScore,
      strengths: plan.strengths,
      prioritySkills: plan.prioritySkills,
      roadmap: plan.roadmap,
      projects: plan.projects,
      interviewTopics: plan.interviewTopics,
      advice: plan.advice,
    },
  });
}

export async function getCareerPlans(userId) {
  return prisma.careerPlan.findMany({
    where: {
      userId,
    },
    orderBy: {
      createdAt: "desc",
    },
    select: {
      id: true,
      targetRole: true,
      primaryRole: true,
      readinessScore: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}

export async function getCareerPlanById(planId, userId) {
  return prisma.careerPlan.findFirst({
    where: {
      id: planId,
      userId,
    },
  });
}
