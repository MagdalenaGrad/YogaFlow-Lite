/**
 * Data Transfer Objects (DTOs) and Command Models for YogaFlow Lite API
 *
 * This file contains type definitions for API request/response payloads,
 * derived from database types to ensure type safety throughout the application.
 */

import type { Tables, TablesInsert, TablesUpdate } from "./db/database.types";

// =============================================================================
// DATABASE ENTITY ALIASES
// =============================================================================

export type PoseEntity = Tables<"poses">;
export type PoseVersionEntity = Tables<"pose_versions">;
export type SequenceEntity = Tables<"sequences">;
export type SequencePoseEntity = Tables<"sequence_poses">;
export type PracticeSessionEntity = Tables<"practice_sessions">;
export type DifficultyEntity = Tables<"difficulties">;
export type PoseTypeEntity = Tables<"pose_types">;
export type UserEntity = Tables<"users">;

// =============================================================================
// RESPONSE DTOs - POSES
// =============================================================================

/**
 * DTO for a single pose in API responses
 * Includes difficulty and type names instead of IDs for better API usability
 */
export interface PoseDto {
  id: string;
  name: string;
  sanskritName: string | null;
  description: string | null;
  difficulty: string; // resolved from difficulty_id
  type: string; // resolved from type_id
  imageUrl: string | null;
  imageAlt: string;
  imageLicense: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * DTO for pose version details
 */
export interface PoseVersionDto {
  id: string;
  poseId: string;
  version: number;
  name: string;
  sanskritName: string | null;
  description: string | null;
  imageUrl: string | null;
  createdAt: string;
}

/**
 * Paginated response for poses list
 */
export interface PosesListResponseDto {
  data: Array<PoseDto>;
  page: number;
  limit: number;
  total: number;
}

// =============================================================================
// RESPONSE DTOs - SEQUENCES
// =============================================================================

/**
 * DTO for a sequence summary (without poses)
 */
export interface SequenceSummaryDto {
  id: string;
  name: string;
  visibility: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * DTO for a pose within a sequence (includes position and timing)
 */
export interface SequencePoseDto {
  id: string;
  poseId: string;
  poseName: string;
  sanskritName: string | null;
  imageUrl: string | null;
  imageAlt: string;
  position: number;
  duration?: number; // optional timing in seconds
  instructions?: string; // optional custom instructions
  addedAt: string;
}

/**
 * DTO for full sequence details (includes poses)
 */
export interface SequenceDetailDto extends SequenceSummaryDto {
  poses: Array<SequencePoseDto>;
  totalDuration?: number; // sum of all pose durations
  poseCount: number;
}

/**
 * List response for sequences
 */
export interface SequencesListResponseDto {
  data: Array<SequenceSummaryDto>;
  total: number;
}

// =============================================================================
// RESPONSE DTOs - PRACTICE SESSIONS
// =============================================================================

/**
 * DTO for a practice session
 */
export interface PracticeSessionDto {
  id: string;
  sequenceId: string;
  sequenceName: string; // resolved from sequence
  startedAt: string;
  endedAt: string | null;
  durationSec: number | null;
}

/**
 * List response for practice sessions
 */
export interface PracticeSessionsListResponseDto {
  data: Array<PracticeSessionDto>;
  total: number;
}

// =============================================================================
// RESPONSE DTOs - AI GENERATION
// =============================================================================

/**
 * DTO for AI-generated pose in sequence
 */
export interface AiGeneratedPoseDto {
  poseId: string;
  poseName: string;
  sanskritName: string | null;
  imageUrl: string | null;
  duration: number; // seconds
  instructions: string;
}

/**
 * DTO for AI-generated sequence (preview before saving)
 */
export interface AiGeneratedSequenceDto {
  name: string;
  description: string;
  poses: Array<AiGeneratedPoseDto>;
}

/**
 * Response for AI sequence generation
 */
export interface AiGenerateSequenceResponseDto {
  sequence: AiGeneratedSequenceDto;
  metadata: {
    totalDuration: number;
    poseCount: number;
    aiModel: string;
  };
}

// =============================================================================
// COMMAND MODELS - SEQUENCES (create/update)
// =============================================================================

/**
 * Command to create a new sequence
 */
export interface CreateSequenceCommand {
  name: string;
}

/**
 * Command to update sequence metadata
 */
export interface UpdateSequenceCommand {
  name?: string;
  visibility?: "private" | "unlisted" | "public";
}

// =============================================================================
// COMMAND MODELS - SEQUENCE POSES (add/update/reorder)
// =============================================================================

/**
 * Command to add a pose to a sequence
 */
export interface AddPoseToSequenceCommand {
  poseId: string;
  poseVersion?: number; // optional, defaults to current version
  position?: number; // optional, appends if omitted
}

/**
 * Command to reorder/update a pose in a sequence
 */
export interface UpdateSequencePoseCommand {
  position?: number; // for reordering
  duration?: number; // optional timing
  instructions?: string; // optional custom instructions
}

// =============================================================================
// COMMAND MODELS - PRACTICE SESSIONS
// =============================================================================

/**
 * Command to start a practice session
 */
export interface StartPracticeSessionCommand {
  sequenceId: string;
  startedAt: string; // ISO 8601 timestamp
}

/**
 * Command to end/update a practice session
 */
export interface EndPracticeSessionCommand {
  endedAt: string; // ISO 8601 timestamp
  durationSec?: number; // optional, can be computed server-side
}

// =============================================================================
// COMMAND MODELS - AI GENERATION
// =============================================================================

/**
 * Command to generate a sequence with AI
 */
export interface AiGenerateSequenceCommand {
  prompt: string; // max 500 chars
  difficulty?: "beginner" | "intermediate" | "advanced";
  duration?: number; // desired duration in minutes (5-90)
  focus?: Array<string>; // optional focus areas
}

// =============================================================================
// QUERY PARAMETER DTOs
// =============================================================================

/**
 * Query parameters for listing poses
 */
export interface ListPosesQuery {
  difficulty?: string; // "beginner" | "intermediate" | "advanced"
  type?: string; // e.g., "standing", "seated"
  search?: string; // full-text search
  page?: number; // default 1
  limit?: number; // default 20, max 100
  sort?: string; // "name" | "difficulty" | "-name" | "-difficulty"
}

/**
 * Query parameters for listing practice sessions
 */
export interface ListPracticeSessionsQuery {
  sequenceId?: string; // filter by sequence
  page?: number;
  limit?: number;
}

// =============================================================================
// DATABASE INSERT/UPDATE TYPE HELPERS
// =============================================================================

/**
 * Type for inserting a new sequence into DB
 * Derived from database Insert type with required user_id
 */
export type SequenceInsert = TablesInsert<"sequences">;

/**
 * Type for updating a sequence in DB
 */
export type SequenceUpdate = TablesUpdate<"sequences">;

/**
 * Type for inserting a sequence_pose into DB
 */
export type SequencePoseInsert = TablesInsert<"sequence_poses">;

/**
 * Type for updating a sequence_pose in DB
 */
export type SequencePoseUpdate = TablesUpdate<"sequence_poses">;

/**
 * Type for inserting a practice session into DB
 */
export type PracticeSessionInsert = TablesInsert<"practice_sessions">;

/**
 * Type for updating a practice session in DB
 */
export type PracticeSessionUpdate = TablesUpdate<"practice_sessions">;

// =============================================================================
// ERROR RESPONSE DTOs
// =============================================================================

/**
 * Standard error response structure
 */
export interface ErrorResponseDto {
  error: {
    code: string; // e.g., "VALIDATION_ERROR", "NOT_FOUND"
    message: string;
    details?: Record<string, unknown>; // optional additional context
  };
}

/**
 * Validation error with field-specific messages
 */
export interface ValidationErrorResponseDto extends ErrorResponseDto {
  error: {
    code: "VALIDATION_ERROR";
    message: string;
    details: {
      fields: Record<string, Array<string>>; // field name -> array of error messages
    };
  };
}

// =============================================================================
// SUCCESS RESPONSE WRAPPER
// =============================================================================

/**
 * Generic success response wrapper (optional, can be used for consistency)
 */
export interface SuccessResponseDto<T> {
  data: T;
  message?: string;
}

// =============================================================================
// AUTHENTICATION DTOs (optional convenience wrappers)
// =============================================================================

/**
 * Command to register a new user
 */
export interface RegisterCommand {
  email: string;
  password: string;
  passwordConfirmation: string;
}

/**
 * Command to log in a user
 */
export interface LoginCommand {
  email: string;
  password: string;
}

/**
 * Response for successful authentication
 */
export interface AuthResponseDto {
  user: {
    id: string;
    email: string;
  };
  session: {
    accessToken: string;
    refreshToken: string;
    expiresAt: string;
  };
}

// =============================================================================
// TYPE GUARDS AND UTILITIES
// =============================================================================

/**
 * Type guard to check if a value is a valid difficulty
 */
export function isValidDifficulty(value: unknown): value is "beginner" | "intermediate" | "advanced" {
  return typeof value === "string" && ["beginner", "intermediate", "advanced"].includes(value);
}

/**
 * Type guard to check if a value is a valid visibility
 */
export function isValidVisibility(value: unknown): value is "private" | "unlisted" | "public" {
  return typeof value === "string" && ["private", "unlisted", "public"].includes(value);
}

/**
 * Type for pagination metadata
 */
export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

/**
 * Generic paginated response
 */
export interface PaginatedResponseDto<T> {
  data: Array<T>;
  pagination: PaginationMeta;
}
