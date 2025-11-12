import type { APIRoute } from "astro";

import { listPosesQuerySchema } from "../../lib/validation/poses.validation";
import { getPoses } from "../../lib/services/poses.service";
import type { ErrorResponseDto, ValidationErrorResponseDto } from "../../types";

export const prerender = false;

export const GET: APIRoute = async ({ locals, url }) => {
  try {
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

    const queryParams = {
      difficulty: url.searchParams.get("difficulty") ?? undefined,
      type: url.searchParams.get("type") ?? undefined,
      search: url.searchParams.get("search") ?? undefined,
      page: url.searchParams.get("page") ?? undefined,
      limit: url.searchParams.get("limit") ?? undefined,
      sort: url.searchParams.get("sort") ?? undefined,
    };

    const validationResult = listPosesQuerySchema.safeParse(queryParams);

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
          message: "Invalid query parameters",
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

    const poses = await getPoses(supabase, validationResult.data);

    return new Response(JSON.stringify(poses), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error fetching poses", error);

    const errorResponse: ErrorResponseDto = {
      error: {
        code: "INTERNAL_ERROR",
        message: "An unexpected error occurred while fetching poses",
        details: {},
      },
    };

    return new Response(JSON.stringify(errorResponse), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};
