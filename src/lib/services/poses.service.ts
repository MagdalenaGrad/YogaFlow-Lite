import type { SupabaseClient } from "../../db/supabase.client";
import type { ListPosesQuery, PoseDto, PosesListResponseDto } from "../../types";

const sortFieldMap: Record<string, { column: string; ascending: boolean }> = {
  name: { column: "name", ascending: true },
  "-name": { column: "name", ascending: false },
  difficulty: { column: "difficulty_id", ascending: true },
  "-difficulty": { column: "difficulty_id", ascending: false },
};

interface FilterIds {
  difficultyId?: number;
  typeId?: number;
}

async function resolveFilterIds(
  supabase: SupabaseClient,
  { difficulty, type }: Pick<ListPosesQuery, "difficulty" | "type">
): Promise<FilterIds | "NOT_FOUND"> {
  let difficultyId: number | undefined;
  let typeId: number | undefined;

  if (difficulty) {
    const { data, error } = await supabase.from("difficulties").select("id").eq("name", difficulty).maybeSingle();

    if (error) {
      throw error;
    }

    if (!data) {
      return "NOT_FOUND";
    }

    difficultyId = data.id;
  }

  if (type) {
    const { data, error } = await supabase.from("pose_types").select("id").ilike("name", type).maybeSingle();

    if (error) {
      throw error;
    }

    if (!data) {
      return "NOT_FOUND";
    }

    typeId = data.id;
  }

  return { difficultyId, typeId };
}

function sanitizeSearchTerm(term: string): string {
  return term
    .replace(/[!@#%&|^:*"()<>~`{}[\]+\\]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .join(" ");
}

function toPoseDto(row: Record<string, any>): PoseDto {
  return {
    id: row.id,
    name: row.name,
    sanskritName: row.sanskrit_name,
    description: row.description,
    difficulty: row.difficulties?.name ?? "beginner",
    type: row.pose_types?.name ?? "unknown",
    imageUrl: row.image_url,
    imageAlt: row.image_alt,
    imageLicense: row.image_license,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getPoses(supabase: SupabaseClient, query: ListPosesQuery): Promise<PosesListResponseDto> {
  const page = query.page ?? 1;
  const limit = query.limit ?? 20;

  const filterResult = await resolveFilterIds(supabase, query);

  if (filterResult === "NOT_FOUND") {
    return {
      data: [],
      page,
      limit,
      total: 0,
    };
  }

  const { difficultyId, typeId } = filterResult;

  const sort = sortFieldMap[query.sort ?? "name"] ?? sortFieldMap.name;

  const from = (page - 1) * limit;
  const to = from + limit - 1;

  let queryBuilder = supabase
    .from("poses")
    .select(
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
    )
    .order(sort.column, { ascending: sort.ascending })
    .range(from, to);

  if (difficultyId !== undefined) {
    queryBuilder = queryBuilder.eq("difficulty_id", difficultyId);
  }

  if (typeId !== undefined) {
    queryBuilder = queryBuilder.eq("type_id", typeId);
  }

  if (query.search) {
    const sanitizedSearch = sanitizeSearchTerm(query.search);

    if (sanitizedSearch.length > 0) {
      queryBuilder = queryBuilder.textSearch("tsv", sanitizedSearch, {
        type: "plain",
        config: "simple",
      });
    }
  }

  const { data, error, count } = await queryBuilder;

  if (error) {
    throw error;
  }

  const poses = (data ?? []).map(toPoseDto);

  return {
    data: poses,
    page,
    limit,
    total: count ?? 0,
  };
}
