# API Endpoint Implementation Plan: POST /api/sequences/ai-generate

## 1. Endpoint Overview

**Purpose:** Generate a personalized yoga sequence using AI assistance based on a user's text prompt and optional parameters (difficulty, duration, focus areas).

**Key Features:**

- Accepts a natural language prompt describing the desired sequence
- Optional filters for difficulty level, duration, and focus areas
- Returns a preview of the generated sequence (not automatically saved)
- Rate limited to 5 generations per user per hour
- **MVP Implementation:** Uses mock data instead of real AI service

**Business Context:** This endpoint powers the AI sequence generation feature (FR-4 in PRD), allowing authenticated users to quickly create personalized yoga sequences without manually selecting each pose.

---

## 2. Request Details

### HTTP Method

`POST`

### URL Structure

```
/api/sequences/ai-generate
```

### Authentication

**Required:** User must be authenticated (checked via `locals.supabase.auth.getUser()`)

### Request Body

**Content-Type:** `application/json`

**Structure:**

```json
{
  "prompt": "Create a 20-minute morning flow for beginners focusing on gentle stretching and energy",
  "difficulty": "beginner",
  "duration": 20,
  "focus": ["flexibility", "energy"]
}
```

### Parameters

| Parameter    | Type            | Required | Validation Rules                                                                |
| ------------ | --------------- | -------- | ------------------------------------------------------------------------------- |
| `prompt`     | string          | Yes      | Min 1 char, max 500 chars, trimmed                                              |
| `difficulty` | string          | No       | Must be one of: `beginner`, `intermediate`, `advanced`                          |
| `duration`   | number          | No       | Integer between 5 and 90 (minutes)                                              |
| `focus`      | Array\<string\> | No       | Max 5 items, each max 50 chars, lowercase, trimmed, non-empty array if provided |

---

## 3. Used Types

### From `src/types.ts`

**Command Model (Input):**

```typescript
AiGenerateSequenceCommand {
  prompt: string;
  difficulty?: "beginner" | "intermediate" | "advanced";
  duration?: number;
  focus?: Array<string>;
}
```

**Response DTOs:**

```typescript
AiGenerateSequenceResponseDto {
  sequence: AiGeneratedSequenceDto;
  metadata: {
    totalDuration: number;
    poseCount: number;
    aiModel: string;
  };
}

AiGeneratedSequenceDto {
  name: string;
  description: string;
  poses: Array<AiGeneratedPoseDto>;
}

AiGeneratedPoseDto {
  poseId: string;
  poseName: string;
  sanskritName: string | null;
  imageUrl: string | null;
  duration: number;
  instructions: string;
}
```

**Error DTOs:**

```typescript
ErrorResponseDto;
ValidationErrorResponseDto;
```

**Database Types (used internally):**

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
  "sequence": {
    "name": "Morning Energy Flow",
    "description": "A gentle 20-minute sequence to wake up your body and energize your day",
    "poses": [
      {
        "poseId": "123e4567-e89b-12d3-a456-426614174000",
        "poseName": "Child's Pose",
        "sanskritName": "Balasana",
        "imageUrl": "https://storage.supabase.co/...",
        "duration": 120,
        "instructions": "Start in a restful position, knees wide, forehead to mat. Breathe deeply and settle into the pose."
      },
      {
        "poseId": "223e4567-e89b-12d3-a456-426614174001",
        "poseName": "Cat-Cow Stretch",
        "sanskritName": "Marjaryasana-Bitilasana",
        "imageUrl": "https://storage.supabase.co/...",
        "duration": 90,
        "instructions": "Flow between cat and cow poses, syncing breath with movement. Inhale for cow, exhale for cat."
      }
    ]
  },
  "metadata": {
    "totalDuration": 1200,
    "poseCount": 8,
    "aiModel": "mock-generator-v1"
  }
}
```

### Error Responses

**401 Unauthorized** - User not authenticated

```json
{
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Authentication required to generate sequences",
    "details": {}
  }
}
```

**400 Bad Request** - Invalid input

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request parameters",
    "details": {
      "fields": {
        "prompt": ["Prompt must be between 1 and 500 characters"],
        "duration": ["Duration must be between 5 and 90 minutes"]
      }
    }
  }
}
```

**429 Too Many Requests** - Rate limit exceeded

```json
{
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "You have exceeded the rate limit for AI generation. Please try again later.",
    "details": {
      "limit": 5,
      "window": "1 hour",
      "retryAfter": 1234
    }
  }
}
```

**404 Not Found** - No poses available

```json
{
  "error": {
    "code": "NO_POSES_AVAILABLE",
    "message": "No poses available matching the requested criteria",
    "details": {}
  }
}
```

**500 Internal Server Error** - Server error

```json
{
  "error": {
    "code": "INTERNAL_ERROR",
    "message": "An unexpected error occurred while generating the sequence",
    "details": {}
  }
}
```

---

## 5. Data Flow

### Overview

```
Request → Auth Check → Rate Limit Check → Validation → Service → Database → Mock AI Generation → Response
```

### Detailed Steps

1. **Request Handling** (Astro API Route)

   - Extract request body JSON
   - Check authentication via `locals.supabase.auth.getUser()`
   - Return 401 if not authenticated

2. **Rate Limiting** (In-Memory Store)

   - Check user's generation count in last hour
   - If >= 5, return 429 with retry-after header
   - Otherwise, record this request timestamp

3. **Validation** (Zod Schema)

   - Validate request body against schema
   - Apply defaults and transformations
   - Return 400 if validation fails

4. **Service Layer** (`src/lib/services/ai-generation.service.ts`)

   - **MVP Mock Implementation:**
     - Generate sequence name from prompt keywords
     - Query database for poses matching difficulty/focus
     - Select 6-12 poses based on duration
     - Calculate per-pose duration (distribute total duration)
     - Generate pose-specific instructions
     - Return formatted response

5. **Database Query** (Supabase)

   ```sql
   SELECT
     poses.id,
     poses.name,
     poses.sanskrit_name,
     poses.description,
     poses.image_url,
     difficulties.name as difficulty,
     pose_types.name as type
   FROM poses
   LEFT JOIN difficulties ON poses.difficulty_id = difficulties.id
   LEFT JOIN pose_types ON poses.type_id = pose_types.id
   WHERE
     (difficulty_id = ? OR ? IS NULL)
     AND (type_id IN (SELECT id FROM pose_types WHERE name IN (?)) OR ? IS NULL)
   ORDER BY RANDOM()
   LIMIT ?
   ```

6. **Mock AI Generation Logic**

   - Extract keywords from prompt (e.g., "morning", "energy", "gentle")
   - Map keywords to pose selection criteria
   - Generate sequence name combining keywords + difficulty + duration
   - Select poses: start with warm-up, middle flow, end with cool-down
   - Distribute duration: warm-up 20%, flow 60%, cool-down 20%
   - Generate instructions per pose based on difficulty level

7. **Response**
   - Construct `AiGenerateSequenceResponseDto`
   - Return JSON with 200 status

---

## 6. Security Considerations

### Authentication & Authorization

- **Endpoint Protection:** Must verify user is authenticated via `locals.supabase.auth.getUser()`
- **User ID Extraction:** Extract `user.id` for rate limiting tracking
- **No Data Persistence:** Generated sequences are NOT automatically saved, reducing risk

### Rate Limiting

- **Strategy:** In-memory Map tracking user_id -> Array<timestamp>
- **Limit:** 5 requests per user per rolling hour window
- **Cleanup:** Periodically remove old timestamps (older than 1 hour)
- **Future Enhancement:** Move to Redis or database table for distributed rate limiting

### Input Validation & Sanitization

- **Prompt Sanitization:**

  - Trim whitespace
  - Max 500 characters to prevent abuse
  - No HTML/script injection risk (not rendered as HTML)

- **Focus Array:**

  - Max 5 items to prevent request bloat
  - Each item max 50 chars
  - Convert to lowercase for consistent matching

- **SQL Injection Protection:**
  - Use Supabase parameterized queries (built-in protection)

### Data Exposure

- Only return pose data that is publicly accessible (respects RLS policies)
- Image URLs are public CDN/Storage URLs
- No sensitive user data in response

### Denial of Service (DoS) Protection

- Rate limiting prevents excessive requests
- Duration limit (5-90 min) prevents generating extremely long sequences
- Pose count limit (6-12 poses) prevents large responses

---

## 7. Error Handling

### Validation Errors (400)

| Scenario             | Error Message                                                 | Field      |
| -------------------- | ------------------------------------------------------------- | ---------- |
| Missing prompt       | "Prompt is required"                                          | prompt     |
| Prompt too short     | "Prompt must be at least 1 character"                         | prompt     |
| Prompt too long      | "Prompt must be 500 characters or less"                       | prompt     |
| Invalid difficulty   | "Difficulty must be one of: beginner, intermediate, advanced" | difficulty |
| Duration too short   | "Duration must be at least 5 minutes"                         | duration   |
| Duration too long    | "Duration must be 90 minutes or less"                         | duration   |
| Too many focus items | "Focus must contain at most 5 items"                          | focus      |
| Focus item too long  | "Each focus item must be 50 characters or less"               | focus      |
| Invalid JSON         | "Invalid JSON in request body"                                | -          |

### Authentication Errors (401)

| Scenario      | Handling Strategy            | Log Level |
| ------------- | ---------------------------- | --------- |
| No auth token | Return 401 with message      | info      |
| Invalid token | Return 401 with message      | warn      |
| Expired token | Return 401 with refresh hint | info      |

### Rate Limit Errors (429)

| Scenario       | Handling Strategy                                 | Log Level |
| -------------- | ------------------------------------------------- | --------- |
| Limit exceeded | Return 429 with retryAfter and current limit info | warn      |

### Resource Errors (404)

| Scenario                   | Handling Strategy               | Log Level |
| -------------------------- | ------------------------------- | --------- |
| No poses in database       | Return 404 with helpful message | error     |
| No poses matching criteria | Return 404 with suggestion      | info      |

### Database Errors (500)

| Scenario                    | Handling Strategy                  | Log Level |
| --------------------------- | ---------------------------------- | --------- |
| Database connection failure | Return 500, log error with context | error     |
| Query timeout               | Return 500, log slow query details | warn      |
| Unexpected database error   | Return 500, log full error         | error     |

### Logging Strategy

**Request Logging (info):**

```typescript
{
  level: "info",
  event: "ai_generation_request",
  userId: "uuid",
  prompt: "morning flow...",
  difficulty: "beginner",
  duration: 20,
  requestId: "req_abc123",
  timestamp: "2025-11-12T12:00:00Z"
}
```

**Rate Limit Logging (warn):**

```typescript
{
  level: "warn",
  event: "ai_generation_rate_limit",
  userId: "uuid",
  requestCount: 6,
  timeWindow: "1 hour",
  requestId: "req_abc123",
  timestamp: "2025-11-12T12:00:00Z"
}
```

**Success Logging (info):**

```typescript
{
  level: "info",
  event: "ai_generation_success",
  userId: "uuid",
  poseCount: 8,
  totalDuration: 1200,
  generationType: "mock",
  requestId: "req_abc123",
  timestamp: "2025-11-12T12:00:00Z"
}
```

**Error Logging (error):**

```typescript
{
  level: "error",
  event: "ai_generation_error",
  error: {
    name: "DatabaseError",
    message: "...",
    stack: "..."
  },
  context: {
    userId: "uuid",
    prompt: "...",
    requestId: "req_abc123"
  },
  timestamp: "2025-11-12T12:00:00Z"
}
```

---

## 8. Performance Considerations

### Optimization Strategies

**Database Level:**

- ✅ **Use existing indexes:**
  - `idx_poses_difficulty` on `difficulty_id`
  - `idx_poses_type` on `type_id`
- ✅ **Limit query results:** Only fetch needed poses (6-12 based on duration)
- ✅ **Select specific columns:** Don't use `SELECT *`

**Query Optimization:**

```typescript
// Good: Select only needed columns and limit results
.select('id, name, sanskrit_name, description, image_url, difficulties(name), pose_types(name)')
.limit(12)

// Avoid: Select all columns and fetch too many rows
.select('*')
```

**Mock Generation Performance:**

- Pre-compute keyword mappings (difficulty level → pose type preferences)
- Use deterministic random selection (seed-based for consistent results)
- Cache pose query results for 5 minutes (if same criteria)

**Rate Limiting Performance:**

- In-memory Map for fast lookups (O(1))
- Periodic cleanup of expired timestamps (run every 10 minutes)
- Lazy cleanup: remove old timestamps on read

### Performance Targets

| Metric              | Target  | Notes                                  |
| ------------------- | ------- | -------------------------------------- |
| Response time (p95) | < 500ms | Mock generation, database query        |
| Response time (p99) | < 1s    | Including edge cases                   |
| Database query time | < 200ms | Indexed queries with small result sets |
| Rate limit check    | < 10ms  | In-memory lookup                       |

### Bottlenecks & Monitoring

**Potential Bottlenecks:**

1. Database query for poses (especially with multiple filters)
2. Mock generation logic (instruction generation)
3. Rate limiting cleanup (if not optimized)

**Monitoring:**

- Track generation request volume per hour
- Monitor rate limit hit rate (% of 429 responses)
- Track sequence generation time (p50, p95, p99)
- Alert on error rate >5%
- Monitor database query performance

---

## 9. Implementation Steps

### Step 1: Create Rate Limiting Utility

**File:** `src/lib/utils/rate-limiter.ts`

```typescript
interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfter?: number;
}

interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
}

class RateLimiter {
  private requests: Map<string, Array<number>>;
  private config: RateLimitConfig;

  constructor(config: RateLimitConfig) {
    this.requests = new Map();
    this.config = config;
  }

  check(userId: string): RateLimitResult {
    const now = Date.now();
    const windowStart = now - this.config.windowMs;

    // Get user's request timestamps
    const userRequests = this.requests.get(userId) || [];

    // Filter out expired timestamps
    const recentRequests = userRequests.filter(
      (timestamp) => timestamp > windowStart
    );

    // Check if limit exceeded
    if (recentRequests.length >= this.config.maxRequests) {
      const oldestRequest = Math.min(...recentRequests);
      const retryAfter = Math.ceil(
        (oldestRequest + this.config.windowMs - now) / 1000
      );

      return {
        allowed: false,
        remaining: 0,
        retryAfter,
      };
    }

    // Record this request
    recentRequests.push(now);
    this.requests.set(userId, recentRequests);

    return {
      allowed: true,
      remaining: this.config.maxRequests - recentRequests.length,
    };
  }

  cleanup(): void {
    const now = Date.now();
    const windowStart = now - this.config.windowMs;

    for (const [userId, timestamps] of this.requests.entries()) {
      const recentRequests = timestamps.filter(
        (timestamp) => timestamp > windowStart
      );

      if (recentRequests.length === 0) {
        this.requests.delete(userId);
      } else {
        this.requests.set(userId, recentRequests);
      }
    }
  }
}

// Export singleton instance for AI generation
export const aiGenerationRateLimiter = new RateLimiter({
  maxRequests: 5,
  windowMs: 60 * 60 * 1000, // 1 hour
});

// Periodic cleanup (run every 10 minutes)
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    aiGenerationRateLimiter.cleanup();
  }, 10 * 60 * 1000);
}
```

### Step 2: Create Validation Schema

**File:** `src/lib/validation/ai-generation.validation.ts`

```typescript
import { z } from "zod";

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
```

### Step 3: Create Mock AI Generation Service

**File:** `src/lib/services/ai-generation.service.ts`

```typescript
import type { SupabaseClient } from "../../db/supabase.client";
import type {
  AiGenerateSequenceCommand,
  AiGenerateSequenceResponseDto,
  AiGeneratedPoseDto,
} from "../../types";

interface PoseRow {
  id: string;
  name: string;
  sanskrit_name: string | null;
  description: string | null;
  image_url: string | null;
  difficulties?: { name: string };
  pose_types?: { name: string };
}

function generateSequenceName(
  prompt: string,
  difficulty?: string,
  duration?: number
): string {
  const keywords = prompt.toLowerCase().split(/\s+/).slice(0, 3);
  const titleWords = keywords.map(
    (word) => word.charAt(0).toUpperCase() + word.slice(1)
  );

  if (duration) {
    return `${titleWords.join(" ")} (${duration}min)`;
  }

  return titleWords.join(" ") + " Flow";
}

function generateSequenceDescription(
  prompt: string,
  difficulty?: string
): string {
  const level = difficulty ? `${difficulty}-level ` : "";
  return `A ${level}yoga sequence designed for: ${prompt}`;
}

function generatePoseInstructions(pose: PoseRow, difficulty: string): string {
  const difficultyInstructions: Record<string, string> = {
    beginner: `Gently move into ${pose.name}. Take your time and focus on your breath. Hold for comfort.`,
    intermediate: `Flow smoothly into ${pose.name}. Maintain steady breath and proper alignment.`,
    advanced: `Transition mindfully into ${pose.name}. Deepen the pose while maintaining control and breath.`,
  };

  return difficultyInstructions[difficulty] || difficultyInstructions.beginner;
}

function distributeDuration(
  totalMinutes: number,
  poseCount: number
): Array<number> {
  const totalSeconds = totalMinutes * 60;

  // Warm-up: 20%, Flow: 60%, Cool-down: 20%
  const warmupCount = Math.ceil(poseCount * 0.2);
  const cooldownCount = Math.ceil(poseCount * 0.2);
  const flowCount = poseCount - warmupCount - cooldownCount;

  const warmupTotal = totalSeconds * 0.2;
  const flowTotal = totalSeconds * 0.6;
  const cooldownTotal = totalSeconds * 0.2;

  const durations: Array<number> = [];

  // Distribute warmup
  for (let i = 0; i < warmupCount; i++) {
    durations.push(Math.floor(warmupTotal / warmupCount));
  }

  // Distribute flow
  for (let i = 0; i < flowCount; i++) {
    durations.push(Math.floor(flowTotal / flowCount));
  }

  // Distribute cooldown
  for (let i = 0; i < cooldownCount; i++) {
    durations.push(Math.floor(cooldownTotal / cooldownCount));
  }

  return durations;
}

async function fetchPosesForSequence(
  supabase: SupabaseClient,
  difficulty?: string,
  focus?: Array<string>
): Promise<Array<PoseRow>> {
  let query = supabase
    .from("poses")
    .select(
      `
      id,
      name,
      sanskrit_name,
      description,
      image_url,
      difficulties(name),
      pose_types(name)
    `
    )
    .limit(20);

  // Filter by difficulty if specified
  if (difficulty) {
    const { data: difficultyData } = await supabase
      .from("difficulties")
      .select("id")
      .eq("name", difficulty)
      .maybeSingle();

    if (difficultyData) {
      query = query.eq("difficulty_id", difficultyData.id);
    }
  }

  // Filter by focus (pose types) if specified
  if (focus && focus.length > 0) {
    const { data: typeData } = await supabase
      .from("pose_types")
      .select("id, name")
      .in("name", focus);

    if (typeData && typeData.length > 0) {
      const typeIds = typeData.map((type) => type.id);
      query = query.in("type_id", typeIds);
    }
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  return (data || []) as Array<PoseRow>;
}

export async function generateMockSequence(
  supabase: SupabaseClient,
  command: AiGenerateSequenceCommand
): Promise<AiGenerateSequenceResponseDto> {
  const { prompt, difficulty = "beginner", duration = 20, focus } = command;

  // Fetch poses from database
  const poses = await fetchPosesForSequence(supabase, difficulty, focus);

  if (poses.length === 0) {
    throw new Error("NO_POSES_AVAILABLE");
  }

  // Calculate pose count based on duration (1 pose per 2-3 minutes)
  const poseCount = Math.min(Math.max(Math.floor(duration / 2.5), 6), 12);

  // Select random poses
  const selectedPoses = poses
    .sort(() => Math.random() - 0.5)
    .slice(0, poseCount);

  // Calculate durations for each pose
  const durations = distributeDuration(duration, poseCount);

  // Map to response DTOs
  const generatedPoses: Array<AiGeneratedPoseDto> = selectedPoses.map(
    (pose, index) => ({
      poseId: pose.id,
      poseName: pose.name,
      sanskritName: pose.sanskrit_name,
      imageUrl: pose.image_url,
      duration: durations[index] || 60,
      instructions: generatePoseInstructions(pose, difficulty),
    })
  );

  const totalDuration = durations.reduce((sum, duration) => sum + duration, 0);

  return {
    sequence: {
      name: generateSequenceName(prompt, difficulty, duration),
      description: generateSequenceDescription(prompt, difficulty),
      poses: generatedPoses,
    },
    metadata: {
      totalDuration,
      poseCount,
      aiModel: "mock-generator-v1",
    },
  };
}
```

### Step 4: Create API Route Handler

**File:** `src/pages/api/sequences/ai-generate.ts`

```typescript
import type { APIRoute } from "astro";

import { aiGenerateSequenceSchema } from "../../../lib/validation/ai-generation.validation";
import { generateMockSequence } from "../../../lib/services/ai-generation.service";
import { aiGenerationRateLimiter } from "../../../lib/utils/rate-limiter";
import type {
  ErrorResponseDto,
  ValidationErrorResponseDto,
} from "../../../types";

export const prerender = false;

export const POST: APIRoute = async ({ locals, request }) => {
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
          message: "Authentication required to generate sequences",
          details: {},
        },
      };

      return new Response(JSON.stringify(errorResponse), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    // 2. Check rate limit
    const rateLimitResult = aiGenerationRateLimiter.check(user.id);

    if (!rateLimitResult.allowed) {
      const errorResponse: ErrorResponseDto = {
        error: {
          code: "RATE_LIMIT_EXCEEDED",
          message:
            "You have exceeded the rate limit for AI generation. Please try again later.",
          details: {
            limit: 5,
            window: "1 hour",
            retryAfter: rateLimitResult.retryAfter,
          },
        },
      };

      return new Response(JSON.stringify(errorResponse), {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "Retry-After": String(rateLimitResult.retryAfter || 3600),
        },
      });
    }

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

    const validationResult = aiGenerateSequenceSchema.safeParse(requestBody);

    if (!validationResult.success) {
      const fieldErrors = validationResult.error.flatten().fieldErrors;

      const formattedFieldErrors = Object.entries(fieldErrors).reduce<
        Record<string, Array<string>>
      >((accumulator, [field, errors]) => {
        if (!errors) {
          return accumulator;
        }

        const filtered = errors.filter(Boolean);

        if (filtered.length > 0) {
          accumulator[field] = filtered;
        }

        return accumulator;
      }, {});

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

    // 4. Generate sequence
    const generatedSequence = await generateMockSequence(
      supabase,
      validationResult.data
    );

    // 5. Return success response
    return new Response(JSON.stringify(generatedSequence), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    // Handle specific errors
    if (error instanceof Error && error.message === "NO_POSES_AVAILABLE") {
      const errorResponse: ErrorResponseDto = {
        error: {
          code: "NO_POSES_AVAILABLE",
          message: "No poses available matching the requested criteria",
          details: {},
        },
      };

      return new Response(JSON.stringify(errorResponse), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Generic error handling
    console.error("Error generating AI sequence:", error);

    const errorResponse: ErrorResponseDto = {
      error: {
        code: "INTERNAL_ERROR",
        message: "An unexpected error occurred while generating the sequence",
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

### Step 5: Manual Testing Checklist

- [ ] Test with valid prompt and no optional parameters
- [ ] Test with difficulty filter (beginner, intermediate, advanced)
- [ ] Test with duration parameter (5, 20, 45, 90 minutes)
- [ ] Test with focus array (single item, multiple items)
- [ ] Test with combined parameters
- [ ] Test without authentication (should return 401)
- [ ] Test rate limiting (make 6 requests quickly, 6th should return 429)
- [ ] Test with invalid prompt (empty, too long)
- [ ] Test with invalid difficulty value
- [ ] Test with invalid duration (< 5, > 90)
- [ ] Test with too many focus items (> 5)
- [ ] Test with invalid JSON body
- [ ] Test error handling (simulate database error)
- [ ] Verify generated sequence has correct structure
- [ ] Verify total duration matches requested duration
- [ ] Verify pose count is appropriate for duration

### Step 6: Documentation

Update API documentation to include:

- Endpoint description and purpose
- Authentication requirements
- Rate limiting details
- Request body structure with examples
- Response structure with examples
- Error response formats with status codes
- Example curl requests
- Notes about MVP mock implementation

---

## 10. Follow-up Tasks

### After Initial Implementation

1. **Add logging infrastructure** using structured logger (pino)
2. **Monitor rate limit effectiveness** and adjust if needed
3. **Collect user feedback** on generated sequences
4. **Add analytics** to track AI generation usage patterns

### Future Enhancements (Post-MVP)

1. **Integrate real AI service** (OpenRouter API with Claude 3.5 Sonnet)
2. **Improve pose selection algorithm** based on user feedback
3. **Add caching** for popular prompts/patterns
4. **Implement distributed rate limiting** with Redis
5. **Add sequence variations** (generate multiple options)
6. **Personalization** based on user's practice history
7. **Enhanced error messages** with suggestions
8. **A/B testing** for different generation strategies
