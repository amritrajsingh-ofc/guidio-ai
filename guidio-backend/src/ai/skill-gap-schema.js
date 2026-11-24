import { z } from "zod";

export const skillGapReportSchema = z.object({
  targetRole: z.string().trim().min(2).max(120),

  matchPercentage: z.number().int().min(0).max(100),

  currentStrengths: z
    .array(z.string().trim().min(2).max(120))
    .min(1)
    .max(15),

  missingSkills: z
    .array(
      z.object({
        skill: z.string().trim().min(2).max(120),
        priority: z.enum(["High", "Medium", "Low"]),
        reason: z.string().trim().min(10).max(300),
        learningFocus: z.string().trim().min(10).max(300),
      })
    )
    .min(1)
    .max(15),

  prioritySkills: z
    .array(z.string().trim().min(2).max(120))
    .min(1)
    .max(8),

  learningPlan: z
    .array(
      z.object({
        phase: z.string().trim().min(2).max(100),
        duration: z.string().trim().min(2).max(80),
        focus: z.string().trim().min(10).max(250),
        skills: z.array(z.string().trim().min(2).max(120)).min(1).max(10),
        milestone: z.string().trim().min(10).max(250),
      })
    )
    .min(3)
    .max(6),

  projectIdeas: z
    .array(
      z.object({
        title: z.string().trim().min(2).max(120),
        description: z.string().trim().min(10).max(500),
        skills: z.array(z.string().trim().min(2).max(120)).min(1).max(10),
        difficulty: z.enum(["Beginner", "Intermediate", "Advanced"]),
      })
    )
    .min(2)
    .max(5),

  summary: z.string().trim().min(40).max(1500),
});