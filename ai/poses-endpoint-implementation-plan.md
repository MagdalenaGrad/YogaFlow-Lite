# API Endpoint Implementation Plan: GET /api/poses

## 1. Endpoint Overview

**Purpose:** Retrieve a paginated list of yoga poses with optional filtering, full-text search, and sorting capabilities.

**Key Features:**

- Full-text search across pose names (English/Sanskrit) and descriptions
- Filter by difficulty level and pose type
- Pagination with configurable page size
- Sorting by name or difficulty (ascending/descending)

**Business Context:** This endpoint powers the pose library feature (FR-2 in PRD), allowing users to discover poses before creating sequences.

---

## 2. Request Details

### HTTP Method

`GET`

### URL Structure

```
/api/poses
```

### Query Parameters

| Parameter    | Type   | Required | Default | Validation Rules                                        |
| ------------ | ------ | -------- | ------- | ------------------------------------------------------- |
| `difficulty` | string | No       | -       | Must be one of: `beginner`, `intermediate`, `advanced`  |
| `type`       | string | No       | -       | Must match existing pose type name (case-insensitive)   |
| `search`     | string | No       | -       | Max 200 characters, trimmed                             |
| `page`       | number | No       | `1`     | Must be >= 1                                            |
| `limit`      | number | No       | `20`    | Must be between 1 and 100                               |
| `sort`       | string | No       | `name`  | Must be `name`, `difficulty`, `-name`, or `-difficulty` |

### Request Example

```
GET /api/poses?difficulty=beginner&search=downward&page=1&limit=20&sort=name
```

---

## 3. Used Types

### From `src/types.ts`

**Query DTO:**

```typescript
ListPosesQuery {
  difficulty?: string;
  type?: string;
  search?: string;
  page?: number;
  limit?: number;
  sort?: string;
}
```

**Response DTOs:**

```typescript
PoseDto {
  id: string;
  name: string;
  sanskritName: string | null;
  description: string | null;
  difficulty: string;        // resolved from difficulty_id
  type: string;              // resolved from type_id
  imageUrl: string | null;
  imageAlt: string;
  imageLicense: string | null;
  createdAt: string;
  updatedAt: string;
}

PosesListResponseDto {
  data: Array<PoseDto>;
  page: number;
  limit: number;
  total: number;
}
```

**Database Types:**

```typescript
PoseEntity (from Tables<"poses">)
DifficultyEntity (from Tables<"difficulties">)
PoseTypeEntity (from Tables<"pose_types">)
```

---

## 4. Response Details

### Success Response (200 OK)

**Content-Type:** `application/json`

**Body:**

```json
{
  "data": [
    {
      "id": "123e4567-e89b-12d3-a456-426614174000",
      "name": "Downward-Facing Dog",
      "sanskritName": "Adho Mukha Śvānāsana",
      "description": "An inverted V-shaped pose that stretches and strengthens the entire body.",
      "difficulty": "beginner",
      "type": "standing",
      "imageUrl": "https://storage.supabase.co/...",
      "imageAlt": "Person in Downward-Facing Dog pose",
      "imageLicense": "CC BY 4.0",
      "createdAt": "2025-01-15T10:00:00Z",
      "updatedAt": "2025-01-15T10:00:00Z"
    }
  ],
  "page": 1,
  "limit": 20,
  "total": 123
}
```

### Error Responses

**400 Bad Request** - Invalid query parameters

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid query parameters",
    "details": {
      "fields": {
        "difficulty": ["Must be one of: beginner, intermediate, advanced"],
        "limit": ["Must be between 1 and 100"]
      }
    }
  }
}
```

**500 Internal Server Error** - Database or server error

```json
{
  "error": {
    "code": "INTERNAL_ERROR",
    "message": "An unexpected error occurred",
    "details": {}
  }
}
```

---

## 5. Data Flow

### Overview

```
Request → Validation → Service → Database → Transform → Response
```

### Detailed Steps

1. **Request Handling** (Astro API Route)

   - Extract query parameters from `Astro.url.searchParams`
   - Parse and coerce types (strings to numbers)

2. **Validation** (Zod Schema)

   - Validate query parameter types and constraints
   - Apply defaults for page (1) and limit (20)
   - Return 400 if validation fails

3. **Service Layer** (`src/lib/services/poses.service.ts`)

   - Build Supabase query with filters
   - Apply full-text search if `search` parameter provided
   - Apply difficulty and type filters
   - Apply sorting
   - Apply pagination (offset/limit)
   - Execute two queries:
     - Count query (for total)
     - Data query (for paginated results)

4. **Database Query** (Supabase)

   ```sql
   SELECT
     poses.id,
     poses.name,
     poses.sanskrit_name,
     poses.description,
     poses.image_url,
     poses.image_alt,
     poses.image_license,
     poses.created_at,
     poses.updated_at,
     difficulties.name as difficulty,
     pose_types.name as type
   FROM poses
   LEFT JOIN difficulties ON poses.difficulty_id = difficulties.id
   LEFT JOIN pose_types ON poses.type_id = pose_types.id
   WHERE
     (difficulty_id = ? OR ? IS NULL)
     AND (type_id = ? OR ? IS NULL)
     AND (tsv @@ to_tsquery('simple', ?) OR ? IS NULL)
   ORDER BY ? ?
   LIMIT ?
   OFFSET ?
   ```

5. **Transformation**

   - Map database rows to `PoseDto` (convert snake_case to camelCase)
   - Resolve difficulty/type IDs to names
   - Format timestamps to ISO 8601

6. **Response**
   - Construct `PosesListResponseDto`
   - Return JSON with 200 status

---

## 6. Security Considerations

### Authentication & Authorization

- Endpoint should be protected by Supabase Auth. Accessible only to authenticated users.

### Data Validation

- **Input Sanitization:**

  - Trim whitespace from `search` parameter
  - Escape special characters in full-text search query
  - Validate enum values (difficulty) against whitelist
  - Validate numeric bounds (page >= 1, limit between 1-100)

- **SQL Injection Protection:**

  - Use Supabase client parameterized queries (built-in protection)
  - Do NOT concatenate user input directly into queries

- **Rate Limiting:**
  - Consider implementing rate limiting for search queries (future)
  - Monitor for abuse patterns (excessive pagination)

### Privacy & Data Exposure

- Image URLs should be CDN/Storage URLs, not internal paths
- License information included for legal compliance

---

## 7. Error Handling

### Validation Errors (400)

| Scenario              | Error Message                                               | Field      |
| --------------------- | ----------------------------------------------------------- | ---------- |
| Invalid difficulty    | "Must be one of: beginner, intermediate, advanced"          | difficulty |
| Invalid page          | "Page must be greater than or equal to 1"                   | page       |
| Invalid limit         | "Limit must be between 1 and 100"                           | limit      |
| Invalid sort field    | "Sort must be one of: name, difficulty, -name, -difficulty" | sort       |
| Search query too long | "Search query must be 200 characters or less"               | search     |

### Database Errors (500)

| Scenario                        | Handling Strategy                    | Log Level |
| ------------------------------- | ------------------------------------ | --------- |
| Database connection failure     | Return 500, log error with context   | error     |
| Query timeout                   | Return 500, log slow query details   | warn      |
| Join failure (missing ref data) | Return 500, log data integrity issue | error     |

### Logging Strategy

**Request Logging (info):**

```typescript
{
  level: "info",
  event: "poses_list_request",
  method: "GET",
  path: "/api/poses",
  query: { difficulty: "beginner", page: 1, limit: 20 },
  requestId: "req_abc123",
  timestamp: "2025-11-11T12:00:00Z"
}
```

**Error Logging (error):**

```typescript
{
  level: "error",
  event: "poses_list_error",
  error: {
    name: "PostgresError",
    message: "...",
    code: "...",
    stack: "..."
  },
  context: {
    query: { ... },
    requestId: "req_abc123"
  },
  timestamp: "2025-11-11T12:00:00Z"
}
```

---

## 8. Performance Considerations

### Optimization Strategies

**Database Level:**

- ✅ **Use existing indexes:**
  - `idx_poses_difficulty` on `difficulty_id`
  - `idx_poses_type` on `type_id`
  - `idx_poses_tsv` (GIN) for full-text search
- ✅ **Efficient pagination:** Use OFFSET/LIMIT
- ✅ **Count optimization:** Separate count query (avoid counting in every request for large datasets)

**Query Optimization:**

```typescript
// Good: Select only needed columns
.select('id, name, sanskrit_name, ...')

// Avoid: Select all columns
.select('*')
```

**Caching Strategy (Future):**

- Cache popular queries (e.g., all beginner poses)
- Cache TTL: 5 minutes
- Invalidate on pose updates (rare in MVP)

### Performance Targets

| Metric              | Target    | Notes                                 |
| ------------------- | --------- | ------------------------------------- |
| Response time (p95) | < 200ms   | With full-text search                 |
| Response time (p99) | < 500ms   | Complex queries with multiple filters |
| Database query time | < 100ms   | Indexed queries                       |
| Concurrent requests | 100 req/s | MVP target                            |

### Bottlenecks & Monitoring

**Potential Bottlenecks:**

1. Full-text search on large datasets (>10,000 poses)
2. Count queries with complex filters
3. Large result sets (limit=100)

**Monitoring:**

- Track slow queries (>500ms)
- Monitor full-text search usage
- Alert on error rate >5%

---

## 9. Implementation Steps

### Step 1: Create Zod Validation Schema

**File:** `src/lib/validation/poses.validation.ts`

```typescript
import { z } from "zod";

export const listPosesQuerySchema = z.object({
  difficulty: z.enum(["beginner", "intermediate", "advanced"]).optional(),
  type: z.string().min(1).max(50).optional(),
  search: z.string().max(200).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sort: z.enum(["name", "difficulty", "-name", "-difficulty"]).default("name"),
});

export type ListPosesQueryInput = z.infer<typeof listPosesQuerySchema>;
```

### Step 2: Create Poses Service

**File:** `src/lib/services/poses.service.ts`

```typescript
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../db/database.types";
import type {
  ListPosesQuery,
  PoseDto,
  PosesListResponseDto,
} from "../../types";

export async function getPoses(
  supabase: SupabaseClient<Database>,
  query: ListPosesQuery
): Promise<PosesListResponseDto> {
  // 1. Build base query with joins
  let queryBuilder = supabase.from("poses").select(
    `
      id,
      name,
      sanskrit_name,
      description,
      image_url,
      image_alt,
      image_license,
      created_at,
      updated_at,
      difficulties(name),
      pose_types(name)
    `,
    { count: "exact" }
  );

  // 2. Apply filters
  if (query.difficulty) {
    // Subquery to get difficulty_id
    const { data: difficultyData } = await supabase
      .from("difficulties")
      .select("id")
      .eq("name", query.difficulty)
      .single();

    if (difficultyData) {
      queryBuilder = queryBuilder.eq("difficulty_id", difficultyData.id);
    }
  }

  if (query.type) {
    // Subquery to get type_id
    const { data: typeData } = await supabase
      .from("pose_types")
      .select("id")
      .ilike("name", query.type)
      .single();

    if (typeData) {
      queryBuilder = queryBuilder.eq("type_id", typeData.id);
    }
  }

  // 3. Apply full-text search
  if (query.search) {
    // Use textSearch on the tsv column
    queryBuilder = queryBuilder.textSearch("tsv", query.search, {
      type: "plain",
      config: "simple",
    });
  }

  // 4. Apply sorting
  const sortField = query.sort?.startsWith("-")
    ? query.sort.substring(1)
    : query.sort || "name";
  const ascending = !query.sort?.startsWith("-");

  if (sortField === "difficulty") {
    queryBuilder = queryBuilder.order("difficulty_id", { ascending });
  } else {
    queryBuilder = queryBuilder.order("name", { ascending });
  }

  // 5. Apply pagination
  const page = query.page || 1;
  const limit = query.limit || 20;
  const offset = (page - 1) * limit;

  queryBuilder = queryBuilder.range(offset, offset + limit - 1);

  // 6. Execute query
  const { data, error, count } = await queryBuilder;

  if (error) {
    throw error;
  }

  // 7. Transform to DTOs
  const poses: Array<PoseDto> = (data || []).map((row) => ({
    id: row.id,
    name: row.name,
    sanskritName: row.sanskrit_name,
    description: row.description,
    difficulty: row.difficulties?.name || "beginner",
    type: row.pose_types?.name || "unknown",
    imageUrl: row.image_url,
    imageAlt: row.image_alt,
    imageLicense: row.image_license,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));

  return {
    data: poses,
    page,
    limit,
    total: count || 0,
  };
}
```

### Step 3: Create API Route Handler

**File:** `src/pages/api/poses.ts`

```typescript
import type { APIRoute } from "astro";
import { listPosesQuerySchema } from "../../lib/validation/poses.validation";
import { getPoses } from "../../lib/services/poses.service";
import type { ErrorResponseDto, ValidationErrorResponseDto } from "../../types";

export const prerender = false;

export const GET: APIRoute = async ({ locals, url }) => {
  try {
    // 1. Extract query parameters
    const queryParams = {
      difficulty: url.searchParams.get("difficulty"),
      type: url.searchParams.get("type"),
      search: url.searchParams.get("search"),
      page: url.searchParams.get("page"),
      limit: url.searchParams.get("limit"),
      sort: url.searchParams.get("sort"),
    };

    // 2. Validate query parameters
    const validationResult = listPosesQuerySchema.safeParse(queryParams);

    if (!validationResult.success) {
      const validationError: ValidationErrorResponseDto = {
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid query parameters",
          details: {
            fields: validationResult.error.flatten().fieldErrors as Record<
              string,
              Array<string>
            >,
          },
        },
      };

      return new Response(JSON.stringify(validationError), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // 3. Call service
    const poses = await getPoses(locals.supabase, validationResult.data);

    // 4. Return success response
    return new Response(JSON.stringify(poses), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    // 5. Handle errors
    console.error("Error fetching poses:", error);

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
```

### Step 4: Add Unit Tests (Optional for MVP)

**File:** `src/lib/services/poses.service.test.ts`

```typescript
import { describe, it, expect, vi } from "vitest";
import { getPoses } from "./poses.service";

describe("getPoses", () => {
  it("should return paginated poses", async () => {
    // Mock Supabase client
    const mockSupabase = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          range: vi.fn(() => ({
            data: [
              /* mock data */
            ],
            count: 10,
            error: null,
          })),
        })),
      })),
    };

    const result = await getPoses(mockSupabase as any, { page: 1, limit: 20 });

    expect(result.data).toHaveLength(10);
    expect(result.page).toBe(1);
    expect(result.total).toBe(10);
  });

  it("should filter by difficulty", async () => {
    // Test difficulty filtering
  });

  it("should handle search queries", async () => {
    // Test full-text search
  });
});
```

### Step 5: Manual Testing Checklist

- [ ] Test without any query parameters (default pagination)
- [ ] Test with difficulty filter (beginner, intermediate, advanced)
- [ ] Test with type filter (standing, seated, etc.)
- [ ] Test with search query (English and Sanskrit names)
- [ ] Test with pagination (page 2, 3, etc.)
- [ ] Test with different limit values (1, 20, 100)
- [ ] Test with sorting (name, -name, difficulty, -difficulty)
- [ ] Test with combined filters
- [ ] Test with invalid parameters (should return 400)
- [ ] Test with limit > 100 (should return 400)
- [ ] Test with page < 1 (should return 400)
- [ ] Test error handling (simulate database error)

### Step 6: Documentation

Update API documentation to include:

- Example requests
- Example responses
- Query parameter descriptions
- Error response formats

---

## 10. Follow-up Tasks

### After Initial Implementation

1. **Add integration tests** with real database
2. **Implement request logging** using logger from `src/lib/logger.ts`
3. **Add response caching** (optional, if performance needs)
4. **Monitor query performance** and optimize slow queries
5. **Add request ID tracking** for debugging
6. **Implement rate limiting** (future)

### Future Enhancements (Post-MVP)

- Add more filter options (body part, health benefits)
- Implement advanced search with suggestions
- Add pose recommendations based on user preferences
- Support multiple sorting fields
- Implement GraphQL endpoint for flexible queries
