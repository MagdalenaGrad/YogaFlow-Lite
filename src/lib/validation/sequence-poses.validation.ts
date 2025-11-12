import { z } from "zod";

/**
 * Schema for adding a pose to a sequence
 *
 * - poseId: required UUID of the pose to add
 * - poseVersion: optional version number (defaults to current version)
 * - position: optional position (defaults to append at end)
 */
export const addPoseToSequenceSchema = z.object({
  poseId: z.string().uuid({ message: "Pose ID must be a valid UUID" }),
  poseVersion: z.number().int().positive({ message: "Pose version must be a positive integer" }).optional(),
  position: z.number().int().positive({ message: "Position must be a positive integer" }).optional(),
});

export type AddPoseToSequenceInput = z.infer<typeof addPoseToSequenceSchema>;

/**
 * Schema for updating a pose within a sequence
 *
 * NOTE: Currently only position is supported
 * Duration and instructions fields require database migration before they can be used
 *
 * At least one field must be provided
 * - position: new position (must be >= 1) [SUPPORTED]
 * - duration: duration in seconds (must be >= 0) [NOT YET SUPPORTED]
 * - instructions: custom instructions text [NOT YET SUPPORTED]
 */
export const updateSequencePoseSchema = z
  .object({
    position: z.number().int().positive({ message: "Position must be a positive integer" }).optional(),
    duration: z.number().int().nonnegative({ message: "Duration must be non-negative" }).optional(),
    instructions: z.string().max(1000, { message: "Instructions must be 1000 characters or less" }).optional(),
  })
  .refine((data) => data.position !== undefined || data.duration !== undefined || data.instructions !== undefined, {
    message: "At least one field (position, duration, or instructions) must be provided",
  });

export type UpdateSequencePoseInput = z.infer<typeof updateSequencePoseSchema>;

/**
 * Schema for validating path parameters (UUID)
 */
export const uuidParamSchema = z.string().uuid({ message: "Invalid UUID format" });
