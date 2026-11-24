import { z } from "zod";

export const interviewQuestionSchema = z.object({
  question: z.string().trim().min(10).max(700),
  questionType: z.string().trim().min(2).max(100),
  idealAnswer: z.string().trim().min(30).max(2500),
});

export const interviewEvaluationSchema = z.object({
  overallScore: z.number().int().min(0).max(100),
  technicalScore: z.number().int().min(0).max(100),
  communicationScore: z.number().int().min(0).max(100),
  structureScore: z.number().int().min(0).max(100),
  confidenceScore: z.number().int().min(0).max(100),
  relevanceScore: z.number().int().min(0).max(100),

  strengths: z
    .array(z.string().trim().min(3).max(250))
    .min(1)
    .max(5),

  improvements: z
    .array(z.string().trim().min(3).max(250))
    .min(1)
    .max(5),

  feedback: z.string().trim().min(30).max(1500),
});

export const interviewSummarySchema = z.object({
  overallScore: z.number().int().min(0).max(100),

  summary: z.string().trim().min(50).max(1800),

  strengths: z
    .array(z.string().trim().min(3).max(250))
    .min(1)
    .max(6),

  improvements: z
    .array(z.string().trim().min(3).max(250))
    .min(1)
    .max(6),
});