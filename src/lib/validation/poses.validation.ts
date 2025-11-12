import { z } from "zod";

/**
 * Schema for validating query parameters for the poses listing endpoint.
 *
 * - difficulty: optional, must be one of the supported difficulty labels
 * - type: optional, up to 50 characters (pose type name)
 * - search: optional, up to 200 characters and trimmed before use
 * - page: coerced to number, must be >= 1, defaults to 1
 * - limit: coerced to number, between 1 and 100, defaults to 20
 * - sort: optional, must be one of the supported fields/directions, defaults to "name"
 */
export const listPosesQuerySchema = z
  .object({
    difficulty: z.enum(["beginner", "intermediate", "advanced"]).optional(),
    type: z
      .string()
      .trim()
      .min(1, { message: "Type must not be empty" })
      .max(50, { message: "Type must be 50 characters or less" })
      .optional(),
    search: z.string().trim().max(200, { message: "Search query must be 200 characters or less" }).optional(),
    page: z.coerce.number().int().min(1, { message: "Page must be greater than or equal to 1" }).default(1),
    limit: z.coerce
      .number()
      .int()
      .min(1, { message: "Limit must be at least 1" })
      .max(100, { message: "Limit must be between 1 and 100" })
      .default(20),
    sort: z.enum(["name", "difficulty", "-name", "-difficulty"]).optional().default("name"),
  })
  .transform((value) => ({
    ...value,
    type: value.type?.toLowerCase(),
    search: value.search?.trim(),
  }));

export type ListPosesQueryInput = z.infer<typeof listPosesQuerySchema>;
