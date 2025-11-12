import { z } from "zod";

/**
 * Schema for AI sequence generation request
 *
 * - prompt: required text description of desired sequence (1-500 chars)
 * - difficulty: optional difficulty level
 * - duration: optional duration in minutes (5-90)
 * - focus: optional array of focus areas (max 5 items, each max 50 chars)
 */
export const aiGenerateSequenceSchema = z.object({
  prompt: z
    .string()
    .trim()
    .min(1, { message: "Prompt must be at least 1 character" })
    .max(500, { message: "Prompt must be 500 characters or less" }),
  difficulty: z.enum(["beginner", "intermediate", "advanced"]).optional(),
  duration: z
    .number()
    .int()
    .min(5, { message: "Duration must be at least 5 minutes" })
    .max(90, { message: "Duration must be 90 minutes or less" })
    .optional(),
  focus: z
    .array(
      z
        .string()
        .trim()
        .min(1, { message: "Focus items must not be empty" })
        .max(50, { message: "Each focus item must be 50 characters or less" })
    )
    .max(5, { message: "Focus must contain at most 5 items" })
    .optional()
    .transform((value) => value?.map((item) => item.toLowerCase())),
});

export type AiGenerateSequenceInput = z.infer<typeof aiGenerateSequenceSchema>;
