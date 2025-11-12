import type { SupabaseClient } from "../../db/supabase.client";
import type { AiGenerateSequenceCommand, AiGenerateSequenceResponseDto, AiGeneratedPoseDto } from "../../types";

interface PoseRow {
  id: string;
  name: string;
  sanskrit_name: string | null;
  description: string | null;
  image_url: string | null;
  difficulties?: { name: string };
  pose_types?: { name: string };
}

/**
 * Generate sequence name from prompt keywords
 */
function generateSequenceName(prompt: string, difficulty?: string, duration?: number): string {
  const keywords = prompt.toLowerCase().split(/\s+/).slice(0, 3);
  const titleWords = keywords.map((word) => word.charAt(0).toUpperCase() + word.slice(1));

  if (duration) {
    return `${titleWords.join(" ")} (${duration}min)`;
  }

  return titleWords.join(" ") + " Flow";
}

/**
 * Generate sequence description from prompt
 */
function generateSequenceDescription(prompt: string, difficulty?: string): string {
  const level = difficulty ? `${difficulty}-level ` : "";
  return `A ${level}yoga sequence designed for: ${prompt}`;
}

/**
 * Generate pose-specific instructions based on difficulty
 */
function generatePoseInstructions(pose: PoseRow, difficulty: string): string {
  const difficultyInstructions: Record<string, string> = {
    beginner: `Gently move into ${pose.name}. Take your time and focus on your breath. Hold for comfort.`,
    intermediate: `Flow smoothly into ${pose.name}. Maintain steady breath and proper alignment.`,
    advanced: `Transition mindfully into ${pose.name}. Deepen the pose while maintaining control and breath.`,
  };

  return difficultyInstructions[difficulty] || difficultyInstructions.beginner;
}

/**
 * Distribute total duration across poses
 * 20% warmup, 60% flow, 20% cooldown
 */
function distributeDuration(totalMinutes: number, poseCount: number): Array<number> {
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

/**
 * Fetch poses from database based on filters
 */
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
    const { data: typeData } = await supabase.from("pose_types").select("id, name").in("name", focus);

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

/**
 * Generate mock AI sequence
 * MVP implementation using database queries and smart selection
 */
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
  const selectedPoses = poses.sort(() => Math.random() - 0.5).slice(0, poseCount);

  // Calculate durations for each pose
  const durations = distributeDuration(duration, poseCount);

  // Map to response DTOs
  const generatedPoses: Array<AiGeneratedPoseDto> = selectedPoses.map((pose, index) => ({
    poseId: pose.id,
    poseName: pose.name,
    sanskritName: pose.sanskrit_name,
    imageUrl: pose.image_url,
    duration: durations[index] || 60,
    instructions: generatePoseInstructions(pose, difficulty),
  }));

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
