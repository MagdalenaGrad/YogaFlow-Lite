import type { APIRoute } from "astro";

import { updateSequencePoseSchema, uuidParamSchema } from "../../../../../lib/validation/sequence-poses.validation";
import { updateSequencePose, removeSequencePose } from "../../../../../lib/services/sequence-poses.service";
import type { ErrorResponseDto, ValidationErrorResponseDto } from "../../../../../types";

export const prerender = false;

/**
 * PATCH /api/sequences/{sequenceId}/poses/{sequencePoseId}
 * Update pose metadata (position, duration, instructions)
 */
export const PATCH: APIRoute = async ({ locals, params, request }) => {
  try {
    // 1. Check authentication
    const supabase = locals.supabase;

    if (!supabase) {
      const errorResponse: ErrorResponseDto = {
        error: {
          code: "INTERNAL_ERROR",
          message: "Supabase client is not available",
          details: {},
        },
      };

      return new Response(JSON.stringify(errorResponse), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      const errorResponse: ErrorResponseDto = {
        error: {
          code: "UNAUTHORIZED",
          message: "Authentication required",
          details: {},
        },
      };

      return new Response(JSON.stringify(errorResponse), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    // 2. Validate path parameters
    const sequenceIdValidation = uuidParamSchema.safeParse(params.sequenceId);
    const sequencePoseIdValidation = uuidParamSchema.safeParse(params.sequencePoseId);

    if (!sequenceIdValidation.success || !sequencePoseIdValidation.success) {
      const fields: Record<string, Array<string>> = {};
      if (!sequenceIdValidation.success) {
        fields.sequenceId = sequenceIdValidation.error.errors.map((e) => e.message);
      }
      if (!sequencePoseIdValidation.success) {
        fields.sequencePoseId = sequencePoseIdValidation.error.errors.map((e) => e.message);
      }

      const errorResponse: ValidationErrorResponseDto = {
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid path parameters",
          details: { fields },
        },
      };

      return new Response(JSON.stringify(errorResponse), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const sequenceId = sequenceIdValidation.data;
    const sequencePoseId = sequencePoseIdValidation.data;

    // 3. Parse and validate request body
    let requestBody;

    try {
      requestBody = await request.json();
    } catch {
      const errorResponse: ErrorResponseDto = {
        error: {
          code: "INVALID_JSON",
          message: "Invalid JSON in request body",
          details: {},
        },
      };

      return new Response(JSON.stringify(errorResponse), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const validationResult = updateSequencePoseSchema.safeParse(requestBody);

    if (!validationResult.success) {
      const fieldErrors = validationResult.error.flatten().fieldErrors;

      const formattedFieldErrors = Object.entries(fieldErrors).reduce<Record<string, Array<string>>>(
        (accumulator, [field, errors]) => {
          if (!errors) {
            return accumulator;
          }

          const filtered = errors.filter(Boolean);

          if (filtered.length > 0) {
            accumulator[field] = filtered;
          }

          return accumulator;
        },
        {}
      );

      const validationError: ValidationErrorResponseDto = {
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid request parameters",
          details: {
            fields: formattedFieldErrors,
          },
        },
      };

      return new Response(JSON.stringify(validationError), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // 4. Update sequence pose
    const updatedPose = await updateSequencePose(supabase, user.id, sequenceId, sequencePoseId, validationResult.data);

    // 5. Return success response
    return new Response(JSON.stringify(updatedPose), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    // Handle specific errors
    if (error instanceof Error) {
      if (error.message === "SEQUENCE_NOT_FOUND") {
        const errorResponse: ErrorResponseDto = {
          error: {
            code: "SEQUENCE_NOT_FOUND",
            message: "Sequence not found or access denied",
            details: {},
          },
        };

        return new Response(JSON.stringify(errorResponse), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        });
      }

      if (error.message === "SEQUENCE_POSE_NOT_FOUND") {
        const errorResponse: ErrorResponseDto = {
          error: {
            code: "SEQUENCE_POSE_NOT_FOUND",
            message: "Sequence pose not found",
            details: {},
          },
        };

        return new Response(JSON.stringify(errorResponse), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        });
      }

      if (error.message === "INVALID_POSITION") {
        const errorResponse: ErrorResponseDto = {
          error: {
            code: "INVALID_POSITION",
            message: "Invalid position specified",
            details: {},
          },
        };

        return new Response(JSON.stringify(errorResponse), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      if (error.message === "DURATION_AND_INSTRUCTIONS_NOT_SUPPORTED") {
        const errorResponse: ErrorResponseDto = {
          error: {
            code: "FEATURE_NOT_SUPPORTED",
            message: "Duration and instructions fields are not yet supported. Only position updates are available.",
            details: {},
          },
        };

        return new Response(JSON.stringify(errorResponse), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }
    }

    // Generic error handling
    // TODO: Replace with structured logger (pino) when available
    // eslint-disable-next-line no-console
    console.error("Error updating sequence pose:", error);

    const errorResponse: ErrorResponseDto = {
      error: {
        code: "INTERNAL_ERROR",
        message: "An unexpected error occurred while updating the pose",
        details: {},
      },
    };

    return new Response(JSON.stringify(errorResponse), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};

/**
 * DELETE /api/sequences/{sequenceId}/poses/{sequencePoseId}
 * Remove a pose from a sequence
 */
export const DELETE: APIRoute = async ({ locals, params }) => {
  try {
    // 1. Check authentication
    const supabase = locals.supabase;

    if (!supabase) {
      const errorResponse: ErrorResponseDto = {
        error: {
          code: "INTERNAL_ERROR",
          message: "Supabase client is not available",
          details: {},
        },
      };

      return new Response(JSON.stringify(errorResponse), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      const errorResponse: ErrorResponseDto = {
        error: {
          code: "UNAUTHORIZED",
          message: "Authentication required",
          details: {},
        },
      };

      return new Response(JSON.stringify(errorResponse), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    // 2. Validate path parameters
    const sequenceIdValidation = uuidParamSchema.safeParse(params.sequenceId);
    const sequencePoseIdValidation = uuidParamSchema.safeParse(params.sequencePoseId);

    if (!sequenceIdValidation.success || !sequencePoseIdValidation.success) {
      const fields: Record<string, Array<string>> = {};
      if (!sequenceIdValidation.success) {
        fields.sequenceId = sequenceIdValidation.error.errors.map((e) => e.message);
      }
      if (!sequencePoseIdValidation.success) {
        fields.sequencePoseId = sequencePoseIdValidation.error.errors.map((e) => e.message);
      }

      const errorResponse: ValidationErrorResponseDto = {
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid path parameters",
          details: { fields },
        },
      };

      return new Response(JSON.stringify(errorResponse), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const sequenceId = sequenceIdValidation.data;
    const sequencePoseId = sequencePoseIdValidation.data;

    // 3. Remove sequence pose
    await removeSequencePose(supabase, user.id, sequenceId, sequencePoseId);

    // 4. Return success response (204 No Content)
    return new Response(null, {
      status: 204,
    });
  } catch (error) {
    // Handle specific errors
    if (error instanceof Error) {
      if (error.message === "SEQUENCE_NOT_FOUND") {
        const errorResponse: ErrorResponseDto = {
          error: {
            code: "SEQUENCE_NOT_FOUND",
            message: "Sequence not found or access denied",
            details: {},
          },
        };

        return new Response(JSON.stringify(errorResponse), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        });
      }

      if (error.message === "SEQUENCE_POSE_NOT_FOUND") {
        const errorResponse: ErrorResponseDto = {
          error: {
            code: "SEQUENCE_POSE_NOT_FOUND",
            message: "Sequence pose not found",
            details: {},
          },
        };

        return new Response(JSON.stringify(errorResponse), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        });
      }
    }

    // Generic error handling
    // TODO: Replace with structured logger (pino) when available
    // eslint-disable-next-line no-console
    console.error("Error deleting sequence pose:", error);

    const errorResponse: ErrorResponseDto = {
      error: {
        code: "INTERNAL_ERROR",
        message: "An unexpected error occurred while deleting the pose",
        details: {},
      },
    };

    return new Response(JSON.stringify(errorResponse), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};
