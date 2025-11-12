# API Endpoint Implementation Plan: Sequence Pose Management

## 1. Endpoint Overview

**Purpose:** Provide CRUD-like operations for managing the association between sequences and poses, including adding a pose to a sequence, updating/reordering a pose within a sequence, and removing a pose from a sequence.

**Endpoints covered:**
- `POST /api/sequences/{sequenceId}/poses` — add a pose to a sequence
- `PATCH /api/sequences/{sequenceId}/poses/{sequencePoseId}` — update metadata (position, duration, instructions)
- `DELETE /api/sequences/{sequenceId}/poses/{sequencePoseId}` — remove a pose from a sequence

**Business Context:** Supports PRD FR-3 (Sequence Builder) allowing logged-in users to construct and manage pose order within their personal sequences.

---

## 2. Request Details

### HTTP Methods & URL Patterns

| Method | URL Pattern | Description |
| ------ | ----------- | ----------- |
| POST | `/api/sequences/{sequenceId}/poses` | Add pose to a sequence |
| PATCH | `/api/sequences/{sequenceId}/poses/{sequencePoseId}` | Update pose position/metadata |
| DELETE | `/api/sequences/{sequenceId}/poses/{sequencePoseId}` | Remove pose from sequence |

### Parameters

**Path Parameters (all endpoints):**
- `sequenceId` (UUID, required) — the parent sequence

**Additional Path Parameter (PATCH/DELETE):**
- `sequencePoseId` (UUID, required) — the specific item within the sequence

**Body – POST** (`AddPoseToSequenceCommand`)
```json
{
  "poseId": "uuid",               // required
  "poseVersion": 3,                // optional, defaults to current version
  "position": 4                    // optional, append if omitted
}
```

**Body – PATCH** (`UpdateSequencePoseCommand`)
```json
{
  "position": 2,                   // optional new position
  "duration": 90,                  // optional duration in seconds
  "instructions": "..."           // optional instructions text
}
```

**DELETE** – no request body

---

## 3. Used Types

From `src/types.ts`:

```typescript
AddPoseToSequenceCommand {
  poseId: string;
  poseVersion?: number;
  position?: number;
}

UpdateSequencePoseCommand {
  position?: number;
  duration?: number;
  instructions?: string;
}

SequencePoseDto {
  id: string;
  poseId: string;
  poseName: string;
  sanskritName: string | null;
  imageUrl: string | null;
  imageAlt: string;
  position: number;
  duration?: number;
  instructions?: string;
  addedAt: string;
}

Sequenced DTOs references SequencePoseEntity etc.
```

Database tables (`db-plan.md`):
- `sequences` (owner via `user_id`, unique name per user)
- `sequence_poses` (id, sequence_id, pose_id, pose_version_id, position, added_at)
- `pose_versions` (id, pose_id, version, metadata)
- `poses` (for metadata lookup)

---

## 4. Response Details

### POST Success (201 Created)
```json
{
  "id": "sequencePoseId",
  "poseId": "poseUUID",
  "poseName": "Warrior II",
  "sanskritName": "Virabhadrasana II",
  "imageUrl": "https://...",
  "imageAlt": "Warrior II pose",
  "position": 4,
  "duration": null,
  "instructions": null,
  "addedAt": "2025-11-11T12:00:00Z"
}
```

### PATCH Success (200 OK)
Return the updated `SequencePoseDto` with new position/duration/instructions.

### DELETE Success (204 No Content)
No body.

### Error Responses
- 400: Validation errors (invalid body, missing pose, position invalid)
- 401: Not authenticated (if Supabase `locals.supabase` has no user)
- 403: Attempt to modify sequence not owned by user (RLS or manual check)
- 404: Sequence or sequence pose not found (or not accessible)
- 409: Position conflict (duplicate position within sequence)
- 500: Unexpected server/database errors

---

## 5. Data Flow

### POST
1. Extract `sequenceId` from path, `AddPoseToSequenceCommand` from JSON body.
2. Validate body using Zod schema (poseId required, optional poseVersion/position >= 1).
3. Retrieve sequence (ensure user ownership and existence).
4. Determine pose version:
   - If provided, validate version belongs to pose
   - Else fetch `current_version_id` from `poses` (or latest version)
5. Determine insertion position:
   - If provided, ensure it’s between 1 and length+1
   - Else append to end (`max(position) + 1`)
6. Insert into `sequence_poses` (with generated UUID and `added_at = now()`).
7. Optionally, adjust positions if inserting in middle (increment subsequent positions).
8. Fetch joined data (pose metadata) to construct `SequencePoseDto` response.
9. Return 201.

### PATCH
1. Extract `sequenceId`, `sequencePoseId`, and body (`UpdateSequencePoseCommand`).
2. Validate body: at least one field provided, numeric ranges (e.g., `position >= 1`, `duration >= 0`).
3. Fetch existing `sequence_pose` + sequence ownership.
4. If `position` provided and changed:
   - Start transaction (if using Supabase RPC or manual approach)
   - Adjust positions of other poses (shift up/down) to maintain contiguous order
5. Update `sequence_poses` with new fields.
6. Return updated `SequencePoseDto` (fresh fetch).

### DELETE
1. Extract `sequenceId`, `sequencePoseId`.
2. Validate existence and ownership.
3. Delete row from `sequence_poses`.
4. Optionally reorder remaining positions to close gaps.
5. Return 204.

### Service abstraction
- Create `SequencePosesService` in `src/lib/services/sequencePoses.service.ts` to encapsulate database logic (fetch, insert, reorder, delete).
- API route handles validation and uses service for DB operations.

---

## 6. Security Considerations

- **Authentication:** Require authenticated user (access token). Use `locals.supabase.auth.getUser()` or rely on RLS policies ensuring `auth.uid() = sequences.user_id`.
- **Authorization:** Ensure sequence belongs to user:
  - Either rely on RLS (tables already have RLS with owner check) or double-check ownership before operations.
- **Input Validation:** Use Zod to guard body parameters.
- **RLS Policies:** confirm `sequence_poses` has `select/insert/update/delete` policies scoped to owner as per db plan.
- **Prevent ID guessing:** even if user guesses sequencePoseId, RLS should prevent unauthorized access.

---

## 7. Error Handling

| Scenario | Status | Message | Notes |
| -------- | ------ | -------- | ----- |
| Invalid body | 400 | Validation error | Return field errors per schema |
| Sequence not found | 404 | Sequence not found | When sequence doesn’t exist / not accessible |
| Pose not found | 400 | Pose not found | When provided `poseId` doesn’t exist |
| Pose version invalid | 400 | Pose version mismatch | Provided version not tied to pose |
| Position out of range | 400 | Invalid position | e.g., > sequence length +1 |
| Position conflict | 409 | Position conflict | Another pose already at that position after adjustments |
| Unauthorized | 401 | Authentication required | `locals.supabase` lacks user |
| Database error | 500 | Internal error | Log details with request context |

**Logging**
- Info logs for operations (`sequence_pose_added`, `sequence_pose_reordered`, `sequence_pose_deleted`)
- Error logs for failures with `requestId`, `sequenceId`, `sequencePoseId`
- Integrate with planned logger (pino) when available

---

## 8. Performance Considerations

- **Transactions for reorder:** Use Supabase RPC or manual BEGIN/COMMIT via Postgres function to avoid inconsistent positions.
- **Index usage:** Ensure `sequence_poses(sequence_id, position)` index is used for reorder queries.
- **Batch updates:** Use SQL updates like `UPDATE sequence_poses SET position = position + 1 WHERE sequence_id = ? AND position >= ?` to shift positions efficiently.
- **Minimal joins:** Only join with `poses`/`pose_versions` for response when necessary.
- **Caching:** Not critical yet; sequences are user-specific and small.
- **Concurrency:** For simultaneous updates, rely on transactions to prevent race conditions.

---

## 9. Implementation Steps

1. **Define Validation Schemas** (`src/lib/validation/sequencePoses.validation.ts`)
   - `addPoseToSequenceSchema`
   - `updateSequencePoseSchema`
2. **Implement Service Layer** (`src/lib/services/sequencePoses.service.ts`)
   - Methods: `addPose`, `updatePose`, `removePose`
   - Helper functions: fetch sequence (with owner), fetch pose version, shift positions, etc.
   - Use Supabase queries with proper error handling.
3. **Create API Route** (`src/pages/api/sequences/[sequenceId]/poses/index.ts` for POST, `[sequencePoseId].ts` for PATCH/DELETE)
   - Extract params, validate, call service, return response with proper status codes.
4. **Ensure RLS Policies** (per db plan) allow operations for authenticated owners.
5. **Add Logging** using existing logger or `console` fallback (info/error).
6. **Manual Testing Plan**
   - Add pose, append and insert in middle
   - Update position (move up/down), duration, instructions
   - Delete pose and ensure positions collapse
   - Invalid pose/sequence IDs
   - Unauthorized access tests

---

## 10. Follow-up Tasks

- Add unit/integration tests when ready (service layer, API route).
- Document endpoint usage with request/response examples.
- Consider optimistic UI support (return updated list or `etag`).
- Monitor for race conditions; consider explicit locking if needed later.
