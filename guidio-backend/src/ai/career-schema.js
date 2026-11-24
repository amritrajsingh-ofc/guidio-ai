import { z } from "zod";

export const careerPlanSchema = z.object({
  primaryRole: z.string().trim().min(2).max(100),

  alternativeRoles: z
    .array(z.string().trim().min(2).max(100))
    .min(1)
    .max(3),

  summary: z.string().trim().min(30).max(1500),

  readinessScore: z.number().int().min(0).max(100),

  strengths: z.array(z.string().trim().min(2).max(180)).min(1).max(8),

  prioritySkills: z.array(z.string().trim().min(2).max(120)).min(1).max(12),

  roadmap: z
    .array(
      z.object({
        phase: z.string().trim().min(2).max(80),
        duration: z.string().trim().min(2).max(80),
        goal: z.string().trim().min(5).max(250),
        topics: z.array(z.string().trim().min(2).max(120)).min(1).max(10),
        outcome: z.string().trim().min(5).max(250),
      })
    )
    .min(3)
    .max(6),

  projects: z
    .array(
      z.object({
        title: z.string().trim().min(2).max(120),
        description: z.string().trim().min(10).max(500),
        skills: z.array(z.string().trim().min(2).max(100)).min(1).max(10),
        difficulty: z.enum(["Beginner", "Intermediate", "Advanced"]),
      })
    )
    .min(2)
    .max(5),

  interviewTopics: z
    .array(z.string().trim().min(2).max(160))
    .min(3)
    .max(15),

  advice: z.string().trim().min(30).max(1200),
});