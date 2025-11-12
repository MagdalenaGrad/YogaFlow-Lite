# API Endpoint Implementation Plan: POST /api/sequences

## 1. Endpoint Overview

Create a new yoga sequence for the authenticated user. The endpoint accepts a sequence name (and optionally visibility) and persists it in the `sequences` table, returning the created record.

## 2. Request Details

- **HTTP Method:** POST
- **URL Structure:** `/api/sequences`
- **Parameters:**
  - Required (body): `name`
  - Optional (body): `visibility`
- **Request Body (JSON):**
  ```json
  {
    "name": "Morning Energy",
    "visibility": "private"
  }
  ```
  - `name` – string, 1–100 characters, unique per user.
  - `visibility` – string enum (`private`, `unlisted`, `public`), defaults to `private`.

## 3. Used Types

From `src/types.ts`:
- `CreateSequenceCommand` – request payload `{ name: string }`.
- `UpdateSequenceCommand` (reference for `visibility` enum string).
- `SequenceInsert` – DB insert type.
- `SequenceSummaryDto` – response DTO (id, name, visibility, createdAt, updatedAt).
- `ErrorResponseDto`, `ValidationErrorResponseDto` – error formats.

## 4. Response Details

- **201 Created** with body:
  ```json
  {
    "id": "uuid",
    "name": "Morning Energy",
    "visibility": "private",
    "createdAt": "2025-11-11T10:00:00Z",
    "updatedAt": "2025-11-11T10:00:00Z"
  }
  ```
- **Error codes:**
  - 400 – validation failure (invalid name or visibility, missing name, name too long).
  - 401 – user not authenticated (no `locals.supabase` session or auth uid).
  - 409 – name already exists for the user (unique constraint violation).
  - 500 – unexpected server/database error.

## 5. Data Flow

1. Extract authenticated user ID via Supabase session (`auth.getUser()` or from `locals.supabase.auth.getUser()`).
2. Parse JSON body.
3. Validate payload via Zod schema (name length, visibility enum default).
4. Build `SequenceInsert` payload (set `visibility` default, assign `user_id`).
5. Insert into `sequences` table using Supabase client.
6. Handle unique constraint errors (name already used by user).
7. Map DB row to `SequenceSummaryDto` (convert snake_case to camelCase).
8. Return 201 response.

## 6. Security Considerations

- **Authentication:** Require authenticated user; reject requests without valid session (401).
- **Authorization:** Sequence must be tied to authenticated user (user cannot set arbitrary `user_id`).
- **Input Validation:** Guard against empty/oversized names, invalid visibility values.
- **RLS:** Ensure `sequences` table RLS allows insert for authenticated user only when `user_id = auth.uid()`.
- **Rate Limiting (future):** Optionally limit sequence creation per user to avoid abuse.

## 7. Error Handling

| Scenario | Status | Response |
|----------|--------|----------|
| Missing/invalid name | 400 | `ValidationErrorResponseDto` with field errors |
| Invalid visibility | 400 | `ValidationErrorResponseDto` |
| Unauthenticated | 401 | `ErrorResponseDto` with code `UNAUTHORIZED` |
| Duplicate name | 409 | `ErrorResponseDto` with code `CONFLICT`, message explaining name in use |
| Database error | 500 | `ErrorResponseDto` with code `INTERNAL_ERROR` |

Logging: capture validation errors at WARN level (excluding PII), server/db errors at ERROR level with request context (userId, requestId).

## 8. Performance Considerations

- Single-row insert; minimal load.
- Ensure indexes (unique `(user_id, name)`) exist (already in DB plan).
- No heavy computation, so performance risk minimal.
- Future: cache bust or notify client caches if sequence lists are cached.

## 9. Implementation Steps

1. **Validation Schema** – Create `createSequenceSchema` using Zod (name: min 1/max 100, visibility optional enum with default `private`).
2. **Service Module** – Implement `createSequence` in `src/lib/services/sequences.service.ts` (new file if absent):
   - Accept `SupabaseClient`, userId, and validated payload.
   - Insert into `sequences` table.
   - Handle unique constraint errors (`23505`).
   - Return `SequenceSummaryDto`.
3. **API Route** – `src/pages/api/sequences/index.ts` (Astro supports directories):
   - `export const POST` handler.
   - Verify user is authenticated.
   - Parse body (`await request.json()`), validate.
   - Call service, map response, send 201.
   - Catch validation/service errors and respond with appropriate status codes.
4. **Error Mapping** – Utility to translate Supabase errors to HTTP status (e.g., check `error.code === "23505"`).
5. **Logging** – Use central logger (future) or `console.error` for now; include requestId/userId when available.
6. **Manual Testing** – cURL/HTTPie/Postman tests for success, duplicate name, invalid payload, unauthenticated.

---

This plan aligns with the tech stack (Astro, TypeScript, Supabase) and project rules (use `locals.supabase`, Zod validation, proper RLS). It provides clear steps for developers to implement, validate, and test the `POST /api/sequences` endpoint.
