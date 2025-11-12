import type { SupabaseClient } from "../../db/supabase.client";
import type { AddPoseToSequenceCommand, UpdateSequencePoseCommand, SequencePoseDto } from "../../types";

/**
 * Fetch sequence and verify ownership
 * Returns sequence if found and accessible, throws error otherwise
 */
async function verifySequenceOwnership(
  supabase: SupabaseClient,
  sequenceId: string,
  userId: string
): Promise<{ id: string; user_id: string }> {
  const { data, error } = await supabase
    .from("sequences")
    .select("id, user_id")
    .eq("id", sequenceId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error("SEQUENCE_NOT_FOUND");
  }

  return data;
}

/**
 * Get the current or specified pose version
 */
async function resolvePoseVersion(supabase: SupabaseClient, poseId: string, version?: number): Promise<string> {
  if (version !== undefined) {
    // Validate that the specified version exists for this pose
    const { data, error } = await supabase
      .from("pose_versions")
      .select("id")
      .eq("pose_id", poseId)
      .eq("version", version)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!data) {
      throw new Error("POSE_VERSION_NOT_FOUND");
    }

    return data.id;
  }

  // Get current version from poses table
  const { data: poseData, error: poseError } = await supabase
    .from("poses")
    .select("current_version_id")
    .eq("id", poseId)
    .maybeSingle();

  if (poseError) {
    throw poseError;
  }

  if (!poseData || !poseData.current_version_id) {
    throw new Error("POSE_NOT_FOUND");
  }

  return poseData.current_version_id;
}

/**
 * Get the next available position in a sequence (append)
 */
async function getNextPosition(supabase: SupabaseClient, sequenceId: string): Promise<number> {
  const { data, error } = await supabase
    .from("sequence_poses")
    .select("position")
    .eq("sequence_id", sequenceId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data ? data.position + 1 : 1;
}

/**
 * Shift positions to make room for insertion
 * For MVP, we fetch and update individually since RPC doesn't exist yet
 */
async function shiftPositionsUp(supabase: SupabaseClient, sequenceId: string, fromPosition: number): Promise<void> {
  // Fetch all poses that need to be shifted
  const { data: posesToShift, error: fetchError } = await supabase
    .from("sequence_poses")
    .select("id, position")
    .eq("sequence_id", sequenceId)
    .gte("position", fromPosition)
    .order("position", { ascending: false });

  if (fetchError) {
    throw fetchError;
  }

  // Update each position individually (not ideal, but works without SQL function)
  if (posesToShift && posesToShift.length > 0) {
    for (const pose of posesToShift) {
      const { error: updateError } = await supabase
        .from("sequence_poses")
        .update({ position: pose.position + 1 })
        .eq("id", pose.id);

      if (updateError) {
        throw updateError;
      }
    }
  }
}

/**
 * Fetch sequence pose with joined data
 */
async function fetchSequencePoseDto(supabase: SupabaseClient, sequencePoseId: string): Promise<SequencePoseDto> {
  const { data, error } = await supabase
    .from("sequence_poses")
    .select(
      `
      id,
      pose_id,
      position,
      added_at,
      poses (
        name,
        sanskrit_name,
        image_url,
        image_alt
      )
    `
    )
    .eq("id", sequencePoseId)
    .single();

  if (error) {
    throw error;
  }

  if (!data || !data.poses) {
    throw new Error("SEQUENCE_POSE_NOT_FOUND");
  }

  const pose = Array.isArray(data.poses) ? data.poses[0] : data.poses;

  return {
    id: data.id,
    poseId: data.pose_id,
    poseName: pose.name,
    sanskritName: pose.sanskrit_name,
    imageUrl: pose.image_url,
    imageAlt: pose.image_alt,
    position: data.position,
    // duration and instructions don't exist in current schema
    // They can be added later via migration
    addedAt: data.added_at,
  };
}

/**
 * Add a pose to a sequence
 */
export async function addPoseToSequence(
  supabase: SupabaseClient,
  userId: string,
  sequenceId: string,
  command: AddPoseToSequenceCommand
): Promise<SequencePoseDto> {
  // Verify sequence ownership
  await verifySequenceOwnership(supabase, sequenceId, userId);

  // Resolve pose version
  const poseVersionId = await resolvePoseVersion(supabase, command.poseId, command.poseVersion);

  // Determine insertion position
  const position = command.position ?? (await getNextPosition(supabase, sequenceId));

  // Validate position is not too high
  const maxPosition = await getNextPosition(supabase, sequenceId);
  if (position > maxPosition) {
    throw new Error("INVALID_POSITION");
  }

  // If inserting in middle, shift existing poses
  if (command.position !== undefined && command.position < maxPosition) {
    await shiftPositionsUp(supabase, sequenceId, command.position);
  }

  // Insert new sequence_pose
  const { data, error } = await supabase
    .from("sequence_poses")
    .insert({
      sequence_id: sequenceId,
      pose_id: command.poseId,
      pose_version_id: poseVersionId,
      position,
    })
    .select("id")
    .single();

  if (error) {
    throw error;
  }

  // Fetch and return the complete DTO
  return fetchSequencePoseDto(supabase, data.id);
}

/**
 * Update a pose within a sequence
 */
export async function updateSequencePose(
  supabase: SupabaseClient,
  userId: string,
  sequenceId: string,
  sequencePoseId: string,
  command: UpdateSequencePoseCommand
): Promise<SequencePoseDto> {
  // Verify sequence ownership
  await verifySequenceOwnership(supabase, sequenceId, userId);

  // Verify sequence pose exists and belongs to this sequence
  const { data: existingPose, error: fetchError } = await supabase
    .from("sequence_poses")
    .select("id, position, sequence_id")
    .eq("id", sequencePoseId)
    .eq("sequence_id", sequenceId)
    .maybeSingle();

  if (fetchError) {
    throw fetchError;
  }

  if (!existingPose) {
    throw new Error("SEQUENCE_POSE_NOT_FOUND");
  }

  // Note: duration and instructions are not in current database schema
  // They would need to be added via migration before being supported
  if (command.duration !== undefined || command.instructions !== undefined) {
    throw new Error("DURATION_AND_INSTRUCTIONS_NOT_SUPPORTED");
  }

  // Handle position change with smart reordering
  if (command.position !== undefined && command.position !== existingPose.position) {
    const maxPosition = await getNextPosition(supabase, sequenceId);

    // Validate new position is within valid range
    if (command.position < 1 || command.position >= maxPosition) {
      throw new Error("INVALID_POSITION");
    }

    const oldPosition = existingPose.position;
    const newPosition = command.position;

    // Moving down: shift poses between old and new position up by 1
    if (newPosition > oldPosition) {
      const { data: posesToShift, error: fetchError } = await supabase
        .from("sequence_poses")
        .select("id, position")
        .eq("sequence_id", sequenceId)
        .gt("position", oldPosition)
        .lte("position", newPosition)
        .order("position", { ascending: true });

      if (fetchError) {
        throw fetchError;
      }

      if (posesToShift && posesToShift.length > 0) {
        for (const pose of posesToShift) {
          const { error: updateError } = await supabase
            .from("sequence_poses")
            .update({ position: pose.position - 1 })
            .eq("id", pose.id);

          if (updateError) {
            throw updateError;
          }
        }
      }
    }

    // Moving up: shift poses between new and old position down by 1
    if (newPosition < oldPosition) {
      const { data: posesToShift, error: fetchError } = await supabase
        .from("sequence_poses")
        .select("id, position")
        .eq("sequence_id", sequenceId)
        .gte("position", newPosition)
        .lt("position", oldPosition)
        .order("position", { ascending: false });

      if (fetchError) {
        throw fetchError;
      }

      if (posesToShift && posesToShift.length > 0) {
        for (const pose of posesToShift) {
          const { error: updateError } = await supabase
            .from("sequence_poses")
            .update({ position: pose.position + 1 })
            .eq("id", pose.id);

          if (updateError) {
            throw updateError;
          }
        }
      }
    }

    // Update the target pose to new position
    const { error: updateError } = await supabase
      .from("sequence_poses")
      .update({ position: newPosition })
      .eq("id", sequencePoseId);

    if (updateError) {
      throw updateError;
    }
  }

  // Fetch and return updated DTO
  return fetchSequencePoseDto(supabase, sequencePoseId);
}

/**
 * Shift positions down after deletion to collapse gaps
 */
async function shiftPositionsDown(supabase: SupabaseClient, sequenceId: string, fromPosition: number): Promise<void> {
  // Fetch all poses after the deleted position
  const { data: posesToShift, error: fetchError } = await supabase
    .from("sequence_poses")
    .select("id, position")
    .eq("sequence_id", sequenceId)
    .gt("position", fromPosition)
    .order("position", { ascending: true });

  if (fetchError) {
    throw fetchError;
  }

  // Update each position to collapse the gap
  if (posesToShift && posesToShift.length > 0) {
    for (const pose of posesToShift) {
      const { error: updateError } = await supabase
        .from("sequence_poses")
        .update({ position: pose.position - 1 })
        .eq("id", pose.id);

      if (updateError) {
        throw updateError;
      }
    }
  }
}

/**
 * Remove a pose from a sequence
 */
export async function removeSequencePose(
  supabase: SupabaseClient,
  userId: string,
  sequenceId: string,
  sequencePoseId: string
): Promise<void> {
  // Verify sequence ownership
  await verifySequenceOwnership(supabase, sequenceId, userId);

  // Verify sequence pose exists
  const { data: existingPose, error: fetchError } = await supabase
    .from("sequence_poses")
    .select("id, position")
    .eq("id", sequencePoseId)
    .eq("sequence_id", sequenceId)
    .maybeSingle();

  if (fetchError) {
    throw fetchError;
  }

  if (!existingPose) {
    throw new Error("SEQUENCE_POSE_NOT_FOUND");
  }

  const deletedPosition = existingPose.position;

  // Delete the sequence pose
  const { error: deleteError } = await supabase.from("sequence_poses").delete().eq("id", sequencePoseId);

  if (deleteError) {
    throw deleteError;
  }

  // Collapse positions (shift down poses after deleted one)
  await shiftPositionsDown(supabase, sequenceId, deletedPosition);
}
