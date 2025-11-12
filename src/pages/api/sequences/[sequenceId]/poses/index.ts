import type { APIRoute } from "astro";

import { addPoseToSequenceSchema, uuidParamSchema } from "../../../../../lib/validation/sequence-poses.validation";
import { addPoseToSequence } from "../../../../../lib/services/sequence-poses.service";
import type { ErrorResponseDto, ValidationErrorResponseDto } from "../../../../../types";

export const prerender = false;

export const POST: APIRoute = async ({ locals, params, request }) => {
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

    // 2. Validate path parameter
    const sequenceIdValidation = uuidParamSchema.safeParse(params.sequenceId);

    if (!sequenceIdValidation.success) {
      const errorResponse: ValidationErrorResponseDto = {
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid sequence ID",
          details: {
            fields: {
              sequenceId: sequenceIdValidation.error.errors.map((e) => e.message),
            },
          },
        },
      };

      return new Response(JSON.stringify(errorResponse), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const sequenceId = sequenceIdValidation.data;

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

    const validationResult = addPoseToSequenceSchema.safeParse(requestBody);

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

    // 4. Add pose to sequence
    const sequencePose = await addPoseToSequence(supabase, user.id, sequenceId, validationResult.data);

    // 5. Return success response
    return new Response(JSON.stringify(sequencePose), {
      status: 201,
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

      if (error.message === "POSE_NOT_FOUND") {
        const errorResponse: ErrorResponseDto = {
          error: {
            code: "POSE_NOT_FOUND",
            message: "Pose not found",
            details: {},
          },
        };

        return new Response(JSON.stringify(errorResponse), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      if (error.message === "POSE_VERSION_NOT_FOUND") {
        const errorResponse: ErrorResponseDto = {
          error: {
            code: "POSE_VERSION_NOT_FOUND",
            message: "Specified pose version not found",
            details: {},
          },
        };

        return new Response(JSON.stringify(errorResponse), {
          status: 400,
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
    }

    // Generic error handling
    // TODO: Replace with structured logger (pino) when available
    // eslint-disable-next-line no-console
    console.error("Error adding pose to sequence:", error);

    const errorResponse: ErrorResponseDto = {
      error: {
        code: "INTERNAL_ERROR",
        message: "An unexpected error occurred while adding the pose",
        details: {},
      },
    };

    return new Response(JSON.stringify(errorResponse), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};
