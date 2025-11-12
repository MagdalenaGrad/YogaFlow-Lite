export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Array<Json>;

export interface Database {
  graphql_public: {
    Tables: Record<never, never>;
    Views: Record<never, never>;
    Functions: {
      graphql: {
        Args: {
          extensions?: Json;
          operationName?: string;
          query?: string;
          variables?: Json;
        };
        Returns: Json;
      };
    };
    Enums: Record<never, never>;
    CompositeTypes: Record<never, never>;
  };
  public: {
    Tables: {
      difficulties: {
        Row: {
          id: number;
          name: string;
        };
        Insert: {
          id?: never;
          name: string;
        };
        Update: {
          id?: never;
          name?: string;
        };
        Relationships: [];
      };
      pose_types: {
        Row: {
          id: number;
          name: string;
        };
        Insert: {
          id?: never;
          name: string;
        };
        Update: {
          id?: never;
          name?: string;
        };
        Relationships: [];
      };
      pose_versions: {
        Row: {
          created_at: string;
          description: string | null;
          id: string;
          image_url: string | null;
          name: string;
          pose_id: string;
          sanskrit_name: string | null;
          version: number;
        };
        Insert: {
          created_at?: string;
          description?: string | null;
          id?: string;
          image_url?: string | null;
          name: string;
          pose_id: string;
          sanskrit_name?: string | null;
          version: number;
        };
        Update: {
          created_at?: string;
          description?: string | null;
          id?: string;
          image_url?: string | null;
          name?: string;
          pose_id?: string;
          sanskrit_name?: string | null;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: "pose_versions_pose_id_fkey";
            columns: ["pose_id"];
            isOneToOne: false;
            referencedRelation: "poses";
            referencedColumns: ["id"];
          },
        ];
      };
      poses: {
        Row: {
          created_at: string;
          current_version_id: string | null;
          description: string | null;
          difficulty_id: number | null;
          id: string;
          image_alt: string;
          image_license: string | null;
          image_url: string | null;
          name: string;
          sanskrit_name: string | null;
          tsv: unknown;
          type_id: number | null;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          current_version_id?: string | null;
          description?: string | null;
          difficulty_id?: number | null;
          id?: string;
          image_alt: string;
          image_license?: string | null;
          image_url?: string | null;
          name: string;
          sanskrit_name?: string | null;
          tsv?: unknown;
          type_id?: number | null;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          current_version_id?: string | null;
          description?: string | null;
          difficulty_id?: number | null;
          id?: string;
          image_alt?: string;
          image_license?: string | null;
          image_url?: string | null;
          name?: string;
          sanskrit_name?: string | null;
          tsv?: unknown;
          type_id?: number | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "fk_current_version";
            columns: ["current_version_id"];
            isOneToOne: false;
            referencedRelation: "pose_versions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "poses_difficulty_id_fkey";
            columns: ["difficulty_id"];
            isOneToOne: false;
            referencedRelation: "difficulties";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "poses_type_id_fkey";
            columns: ["type_id"];
            isOneToOne: false;
            referencedRelation: "pose_types";
            referencedColumns: ["id"];
          },
        ];
      };
      practice_sessions: {
        Row: {
          duration_sec: number | null;
          ended_at: string | null;
          id: string;
          sequence_id: string;
          started_at: string;
          user_id: string;
        };
        Insert: {
          duration_sec?: number | null;
          ended_at?: string | null;
          id?: string;
          sequence_id: string;
          started_at: string;
          user_id: string;
        };
        Update: {
          duration_sec?: number | null;
          ended_at?: string | null;
          id?: string;
          sequence_id?: string;
          started_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "practice_sessions_sequence_id_fkey";
            columns: ["sequence_id"];
            isOneToOne: false;
            referencedRelation: "sequences";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "practice_sessions_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      sequence_poses: {
        Row: {
          added_at: string;
          id: string;
          pose_id: string;
          pose_version_id: string;
          position: number;
          sequence_id: string;
        };
        Insert: {
          added_at?: string;
          id?: string;
          pose_id: string;
          pose_version_id: string;
          position: number;
          sequence_id: string;
        };
        Update: {
          added_at?: string;
          id?: string;
          pose_id?: string;
          pose_version_id?: string;
          position?: number;
          sequence_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "sequence_poses_pose_id_fkey";
            columns: ["pose_id"];
            isOneToOne: false;
            referencedRelation: "poses";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "sequence_poses_pose_version_id_fkey";
            columns: ["pose_version_id"];
            isOneToOne: false;
            referencedRelation: "pose_versions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "sequence_poses_sequence_id_fkey";
            columns: ["sequence_id"];
            isOneToOne: false;
            referencedRelation: "sequences";
            referencedColumns: ["id"];
          },
        ];
      };
      sequences: {
        Row: {
          created_at: string;
          id: string;
          name: string;
          updated_at: string;
          user_id: string;
          visibility: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          name: string;
          updated_at?: string;
          user_id: string;
          visibility?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          name?: string;
          updated_at?: string;
          user_id?: string;
          visibility?: string;
        };
        Relationships: [
          {
            foreignKeyName: "sequences_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      users: {
        Row: {
          created_at: string;
          email: string | null;
          id: string;
        };
        Insert: {
          created_at?: string;
          email?: string | null;
          id: string;
        };
        Update: {
          created_at?: string;
          email?: string | null;
          id?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<never, never>;
    Functions: Record<never, never>;
    Enums: Record<never, never>;
    CompositeTypes: Record<never, never>;
  };
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const;
