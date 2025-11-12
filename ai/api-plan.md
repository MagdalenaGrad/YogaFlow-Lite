# REST API Plan

## 1. Resources

| Resource         | DB Table              | Description                                                             |
| ---------------- | --------------------- | ----------------------------------------------------------------------- |
| poses            | poses / pose_versions | Public yoga pose catalog (immutable versions referenced in sequences)   |
| sequences        | sequences             | User-created collections of poses                                       |
| sequencePoses    | sequence_poses        | Junction table entries – pose instances inside a sequence with ordering |
| practiceSessions | practice_sessions     | Records of a user practicing a sequence                                 |
| auth             | N/A (Supabase Auth)   | Registration & login wrappers (optional convenience)                    |

---

## 2. Endpoints

### 2.1 Poses (read-only)

| Method | Path                                     | Description                                 |
| ------ | ---------------------------------------- | ------------------------------------------- |
| GET    | `/api/poses`                             | List poses with optional filtering & search |
| GET    | `/api/poses/{poseId}`                    | Get single pose (latest version)            |
| GET    | `/api/poses/{poseId}/versions/{version}` | Get specific pose version                   |

**Query parameters (GET /api/poses)**

| Name         | Type   | Notes                                               |
| ------------ | ------ | --------------------------------------------------- |
| `difficulty` | string | `beginner\|intermediate\|advanced`                  |
| `type`       | string | e.g. `standing`                                     |
| `search`     | string | Full-text search over name / Sanskrit / description |
| `page`       | number | Page index (default 1)                              |
| `limit`      | number | Items per page (default 20, max 100)                |
| `sort`       | string | `name\|difficulty` (prefix with `-` for DESC)       |

**Response – 200 OK**

```json
{
  "data": [
    {
      "id": "uuid",
      "name": "Downward-Facing Dog",
      "sanskritName": "Adho Mukha Śvānāsana",
      "description": "…",
      "difficulty": "beginner",
      "type": "standing",
      "imageUrl": "https://…",
      "imageAlt": "Downward-Facing Dog Pose"
    }
  ],
  "page": 1,
  "limit": 20,
  "total": 123
}
```

### 2.2 Sequences

| Method | Path                          | Description                                 |
| ------ | ----------------------------- | ------------------------------------------- |
| GET    | `/api/sequences`              | List current user’s sequences               |
| POST   | `/api/sequences`              | Create new sequence                         |
| GET    | `/api/sequences/{sequenceId}` | Get sequence details incl. poses            |
| PATCH  | `/api/sequences/{sequenceId}` | Update sequence metadata (name, visibility) |
| DELETE | `/api/sequences/{sequenceId}` | Delete sequence                             |

**POST /api/sequences – request**

```json
{
  "name": "Morning Energy"
}
```

**Response – 201 Created**

```json
{
  "id": "uuid",
  "name": "Morning Energy",
  "visibility": "private",
  "createdAt": "2025-11-11T10:00:00Z"
}
```

### 2.3 Sequence Poses (nested)

| Method | Path                                                 | Description                    |
| ------ | ---------------------------------------------------- | ------------------------------ |
| POST   | `/api/sequences/{sequenceId}/poses`                  | Add pose to sequence           |
| PATCH  | `/api/sequences/{sequenceId}/poses/{sequencePoseId}` | Reorder / update pose instance |
| DELETE | `/api/sequences/{sequenceId}/poses/{sequencePoseId}` | Remove pose from sequence      |

**POST body**

```json
{
  "poseId": "uuid", // canonical pose id
  "poseVersion": 3, // optional – defaults to current
  "position": 4 // optional – append if omitted
}
```

### 2.4 Practice Sessions

| Method | Path                                 | Description                                  |
| ------ | ------------------------------------ | -------------------------------------------- |
| POST   | `/api/practice-sessions`             | Start a new practice session                 |
| PATCH  | `/api/practice-sessions/{sessionId}` | End / update session (set endedAt, duration) |
| GET    | `/api/practice-sessions`             | List user sessions (filter by sequence)      |

**POST body**

```json
{
  "sequenceId": "uuid",
  "startedAt": "2025-11-11T12:00:00Z"
}
```

### 2.5 AI Sequence Generation

| Method | Path                         | Description                                       |
| ------ | ---------------------------- | ------------------------------------------------- |
| POST   | `/api/sequences/ai-generate` | Generate a yoga sequence using AI based on prompt |

**POST body**

```json
{
  "prompt": "Create a 20-minute morning flow for beginners focusing on gentle stretching and energy",
  "difficulty": "beginner",
  "duration": 20,
  "focus": ["flexibility", "energy"]
}
```

**Response – 200 OK**

```json
{
  "sequence": {
    "name": "Morning Energy Flow",
    "description": "A gentle 20-minute sequence to wake up your body",
    "poses": [
      {
        "poseId": "uuid",
        "poseName": "Child's Pose",
        "duration": 120,
        "instructions": "Start in a restful position..."
      },
      {
        "poseId": "uuid",
        "poseName": "Cat-Cow Stretch",
        "duration": 90,
        "instructions": "Flow between cat and cow..."
      }
    ]
  },
  "metadata": {
    "totalDuration": 1200,
    "poseCount": 8,
    "aiModel": "anthropic/claude-3.5-sonnet"
  }
}
```

**Notes:**

- Uses OpenRouter API (configured via `OPENROUTER_API_KEY`)
- AI generates pose selection, ordering, and timing based on user prompt
- Response includes suggested sequence but does NOT auto-save
- User can review and choose to save the generated sequence
- Rate limit: 5 generations per user per hour

### 2.6 Auth Convenience Wrappers (optional)

Supabase handles `/auth/v1` but you may expose friendly wrappers:

| Method | Path                 | Description             |
| ------ | -------------------- | ----------------------- |
| POST   | `/api/auth/register` | Email + password signup |
| POST   | `/api/auth/login`    | Login                   |
| POST   | `/api/auth/logout`   | Clear cookies / headers |

---

## 3. Authentication and Authorization

TODO: will be added later

## 4. Validation & Business Logic

| Resource             | Validation / Business Rules                                                                                                                                                              |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| sequences            | `name` required, max 100 chars; unique per user (DB constraint). `visibility` enum `private\|unlisted\|public` (DB check).                                                               |
| sequencePose         | `position` must be integer ≥1 and unique per sequence (DB unique). On insert without position → append. Reorder PATCH ensures dense positions (transaction renumber).                    |
| poseId / poseVersion | Verify pose exists and version belongs to pose.                                                                                                                                          |
| practiceSessions     | `sequenceId` must belong to user; one active session per user+sequence can be enforced by checking `endedAt IS NULL`. `duration_sec` must equal `ended- started`, validated server-side. |
| aiGeneration         | `prompt` required, max 500 chars. `difficulty` must be valid enum. `duration` between 5-90 minutes. Rate limit: 5 requests/hour per user.                                                |

### Extra Business Logic

1. **Reordering Poses** – PATCH sequencePose with `{ "position": n }` triggers server transaction:
   - Lock affected rows with `FOR UPDATE`.
   - Renumber positions to maintain gap-less order.
2. **Search & Filter** – `/api/poses` leverages GIN index (`poses.tsv`) and BTREE indexes on `difficulty_id`, `type_id`.
3. **AI Sequence Generation** – POST `/api/sequences/ai-generate`:
   - Fetches all available poses from database with metadata
   - Constructs prompt with user input + available poses
   - Calls OpenRouter API (Claude 3.5 Sonnet recommended, model to be determined)
   - Validates AI response contains valid pose IDs from database
   - Returns structured sequence without saving to database
   - Rate limiting tracked via in-memory cache or Redis (per user)
   - Fallback: if AI fails, return curated default sequences

---

## Error Handling (standard across endpoints)

| HTTP Code                 | When                                              |
| ------------------------- | ------------------------------------------------- |
| 200 OK                    | Successful GET/patch                              |
| 201 Created               | Successful POST                                   |
| 204 No Content            | Successful DELETE                                 |
| 400 Bad Request           | Validation failed                                 |
| 401 Unauthorized          | No / invalid JWT                                  |
| 403 Forbidden             | Violates RLS or visibility                        |
| 404 Not Found             | Resource doesn't exist or not owned               |
| 409 Conflict              | Unique constraint (e.g., duplicate sequence name) |
| 429 Too Many Requests     | Rate limit exceeded (AI generation)               |
| 500 Internal Server Error | Unhandled exception                               |
| 503 Service Unavailable   | AI service temporarily unavailable                |

---

## Pagination, Filtering, Sorting

- **Pagination** – `page` + `limit` query params; responses include `total` for client UX.
- **Filtering** – Difficulties, types, and search on poses; `sequenceId` filter for sessions.
- **Sorting** – `sort` param supports multi-field (comma-separated), default ascending.

---

## Security Measures

1. **JWT Auth** – verify in middleware, refresh tokens via Supabase.
2. **RLS** – enforced by Supabase DB (server trust boundary).
3. **Rate Limiting** – per user/IP edge middleware.
4. **Input Validation** – zod schemas on request payloads.
5. **HTTPS** – enforced in production.

---

## Error Logging & Monitoring

### Logging Strategy

**Structured Logging** – Use a centralized logger (e.g., `pino` or `winston`) with JSON format for all logs.

| Log Level | When to Use                                    | Examples                                     |
| --------- | ---------------------------------------------- | -------------------------------------------- |
| `error`   | Unhandled exceptions, critical failures        | DB connection lost, AI service timeout       |
| `warn`    | Recoverable issues, rate limit hits            | Invalid input caught by validation           |
| `info`    | Important business events                      | User created sequence, practice session ends |
| `debug`   | Development debugging (disabled in production) | Query execution time, cache hits             |
| `trace`   | Very verbose (disabled in production)          | Full request/response bodies                 |

### What to Log

**All API Requests:**

```typescript
{
  "timestamp": "2025-11-11T12:00:00Z",
  "level": "info",
  "method": "POST",
  "path": "/api/sequences",
  "userId": "uuid",
  "ip": "192.168.1.1",
  "userAgent": "Mozilla/5.0...",
  "requestId": "req_abc123", // unique per request
  "duration": 245 // ms
}
```

**Errors:**

```typescript
{
  "timestamp": "2025-11-11T12:00:00Z",
  "level": "error",
  "message": "Failed to create sequence",
  "error": {
    "name": "PostgresError",
    "message": "duplicate key value violates unique constraint",
    "code": "23505",
    "stack": "..."
  },
  "context": {
    "userId": "uuid",
    "requestId": "req_abc123",
    "endpoint": "/api/sequences",
    "payload": { "name": "Morning Flow" }
  }
}
```

**AI Generation Events:**

```typescript
{
  "timestamp": "2025-11-11T12:00:00Z",
  "level": "info",
  "event": "ai_generation",
  "userId": "uuid",
  "requestId": "req_abc123",
  "prompt": "morning flow for beginners",
  "difficulty": "beginner",
  "duration": 20,
  "aiModel": "anthropic/claude-3.5-sonnet",
  "responseTime": 3450, // ms
  "poseCount": 8,
  "success": true
}
```

**AI Sequence Save Events (for metrics tracking):**

```typescript
{
  "timestamp": "2025-11-11T12:05:00Z",
  "level": "info",
  "event": "ai_sequence_saved",
  "userId": "uuid",
  "sequenceId": "uuid",
  "generatedSequenceName": "Morning Energy Flow",
  "wasEdited": false, // whether user edited before saving
  "timeSinceGeneration": 300 // seconds
}
```

### Error Tracking Service

**Recommended:** Sentry or similar service for production error tracking

- Capture unhandled exceptions and promise rejections
- Group similar errors for easier analysis
- Track error frequency and affected users
- Alert on critical errors (e.g., DB connection failures)

**Integration Points:**

- Global error handler in Astro middleware
- Try/catch blocks around external API calls (OpenRouter)
- Database operation error handlers

### Monitoring Metrics

Track and alert on:

| Metric                     | Threshold           | Action                   |
| -------------------------- | ------------------- | ------------------------ |
| Error rate                 | > 5% of requests    | Alert on-call engineer   |
| AI generation failures     | > 20%               | Check OpenRouter status  |
| AI sequence save rate      | < 30%               | Review AI prompt quality |
| Response time (p95)        | > 2000ms            | Investigate slow queries |
| Database connection errors | Any                 | Immediate alert          |
| Rate limit hits per user   | > 10/hour           | Monitor for abuse        |
| Active practice sessions   | Track for analytics | Dashboard metric         |
| AI generation usage rate   | Track for analytics | Product success metric   |

### Implementation

**Logger Setup (src/lib/logger.ts):**

```typescript
import pino from "pino";

export const logger = pino({
  level: import.meta.env.PROD ? "info" : "debug",
  formatters: {
    level: (label) => ({ level: label }),
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  redact: ["password", "email", "authorization"], // PII protection
});
```

**Middleware Integration:**

- Add request ID generation
- Log all incoming requests
- Log response status and duration
- Catch and log unhandled errors

**Privacy Considerations:**

- Redact sensitive fields (passwords, tokens, email addresses)
- Anonymize user IDs in non-critical logs
- Comply with GDPR/privacy regulations

---

This API plan satisfies the PRD functionalities while aligning with the database schema and Astro + Supabase tech stack.
