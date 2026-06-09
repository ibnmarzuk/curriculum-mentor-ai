export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      assessment_results: {
        Row: {
          assessment_id: string
          code: string
          created_at: string
          criteria: Json
          feedback: string | null
          id: string
          passed: boolean
          score: number
          subject_path: string
          user_id: string
        }
        Insert: {
          assessment_id: string
          code?: string
          created_at?: string
          criteria?: Json
          feedback?: string | null
          id?: string
          passed?: boolean
          score?: number
          subject_path: string
          user_id: string
        }
        Update: {
          assessment_id?: string
          code?: string
          created_at?: string
          criteria?: Json
          feedback?: string | null
          id?: string
          passed?: boolean
          score?: number
          subject_path?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "assessment_results_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "assessments"
            referencedColumns: ["id"]
          },
        ]
      }
      assessments: {
        Row: {
          created_at: string
          getting_started: string | null
          id: string
          kind: string
          language: string
          prompt: string
          rubric: Json
          solution: string | null
          starter_code: string
          subject_path: string
          teaches_skills: string[]
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          getting_started?: string | null
          id?: string
          kind?: string
          language?: string
          prompt: string
          rubric?: Json
          solution?: string | null
          starter_code?: string
          subject_path: string
          teaches_skills?: string[]
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          getting_started?: string | null
          id?: string
          kind?: string
          language?: string
          prompt?: string
          rubric?: Json
          solution?: string | null
          starter_code?: string
          subject_path?: string
          teaches_skills?: string[]
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      code_attempts: {
        Row: {
          code: string
          created_at: string
          feedback: string | null
          id: string
          language: string | null
          subject_path: string
          user_id: string
        }
        Insert: {
          code: string
          created_at?: string
          feedback?: string | null
          id?: string
          language?: string | null
          subject_path: string
          user_id: string
        }
        Update: {
          code?: string
          created_at?: string
          feedback?: string | null
          id?: string
          language?: string | null
          subject_path?: string
          user_id?: string
        }
        Relationships: []
      }
      github_cache: {
        Row: {
          cache_key: string
          content: string
          fetched_at: string
        }
        Insert: {
          cache_key: string
          content: string
          fetched_at?: string
        }
        Update: {
          cache_key?: string
          content?: string
          fetched_at?: string
        }
        Relationships: []
      }
      mentor_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          role: string
          subject_path: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          role: string
          subject_path: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          role?: string
          subject_path?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      readiness_cache: {
        Row: {
          computed_at: string
          missing: string[]
          score: number
          subject_path: string
          user_id: string
        }
        Insert: {
          computed_at?: string
          missing?: string[]
          score?: number
          subject_path: string
          user_id: string
        }
        Update: {
          computed_at?: string
          missing?: string[]
          score?: number
          subject_path?: string
          user_id?: string
        }
        Relationships: []
      }
      skills: {
        Row: {
          created_at: string
          description: string | null
          level: string
          name: string
          prerequisites: string[]
          slug: string
          track: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          level: string
          name: string
          prerequisites?: string[]
          slug: string
          track: string
        }
        Update: {
          created_at?: string
          description?: string | null
          level?: string
          name?: string
          prerequisites?: string[]
          slug?: string
          track?: string
        }
        Relationships: []
      }
      subject_chunks: {
        Row: {
          chunk_idx: number
          content: string
          created_at: string
          embedding: string
          id: string
          subject_path: string
        }
        Insert: {
          chunk_idx: number
          content: string
          created_at?: string
          embedding: string
          id?: string
          subject_path: string
        }
        Update: {
          chunk_idx?: number
          content?: string
          created_at?: string
          embedding?: string
          id?: string
          subject_path?: string
        }
        Relationships: []
      }
      subject_meta: {
        Row: {
          ai_classified_at: string | null
          created_at: string
          description: string | null
          difficulty: string | null
          estimated_minutes: number | null
          framework: string | null
          language: string | null
          subject_path: string
          tags: string[]
          title: string
          updated_at: string
        }
        Insert: {
          ai_classified_at?: string | null
          created_at?: string
          description?: string | null
          difficulty?: string | null
          estimated_minutes?: number | null
          framework?: string | null
          language?: string | null
          subject_path: string
          tags?: string[]
          title: string
          updated_at?: string
        }
        Update: {
          ai_classified_at?: string | null
          created_at?: string
          description?: string | null
          difficulty?: string | null
          estimated_minutes?: number | null
          framework?: string | null
          language?: string | null
          subject_path?: string
          tags?: string[]
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      subject_progress: {
        Row: {
          completed_steps: string[]
          created_at: string
          id: string
          next_tasks: string[]
          subject_path: string
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_steps?: string[]
          created_at?: string
          id?: string
          next_tasks?: string[]
          subject_path: string
          updated_at?: string
          user_id: string
        }
        Update: {
          completed_steps?: string[]
          created_at?: string
          id?: string
          next_tasks?: string[]
          subject_path?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      subject_skills: {
        Row: {
          created_at: string
          role: string
          skill_slug: string
          subject_path: string
          weight: number
        }
        Insert: {
          created_at?: string
          role: string
          skill_slug: string
          subject_path: string
          weight?: number
        }
        Update: {
          created_at?: string
          role?: string
          skill_slug?: string
          subject_path?: string
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "subject_skills_skill_slug_fkey"
            columns: ["skill_slug"]
            isOneToOne: false
            referencedRelation: "skills"
            referencedColumns: ["slug"]
          },
        ]
      }
      tracks: {
        Row: {
          created_at: string
          description: string | null
          level: string
          name: string
          skill_slugs: string[]
          slug: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          level: string
          name: string
          skill_slugs?: string[]
          slug: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          description?: string | null
          level?: string
          name?: string
          skill_slugs?: string[]
          slug?: string
          sort_order?: number
        }
        Relationships: []
      }
      user_skill_mastery: {
        Row: {
          evidence: Json
          mastery: number
          skill_slug: string
          updated_at: string
          user_id: string
        }
        Insert: {
          evidence?: Json
          mastery?: number
          skill_slug: string
          updated_at?: string
          user_id: string
        }
        Update: {
          evidence?: Json
          mastery?: number
          skill_slug?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_skill_mastery_skill_slug_fkey"
            columns: ["skill_slug"]
            isOneToOne: false
            referencedRelation: "skills"
            referencedColumns: ["slug"]
          },
        ]
      }
      user_track_enrollment: {
        Row: {
          current_skill_slug: string | null
          started_at: string
          track_slug: string
          updated_at: string
          user_id: string
        }
        Insert: {
          current_skill_slug?: string | null
          started_at?: string
          track_slug: string
          updated_at?: string
          user_id: string
        }
        Update: {
          current_skill_slug?: string | null
          started_at?: string
          track_slug?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_track_enrollment_track_slug_fkey"
            columns: ["track_slug"]
            isOneToOne: false
            referencedRelation: "tracks"
            referencedColumns: ["slug"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      match_subject_chunks: {
        Args: {
          filter_language?: string
          match_count?: number
          query_embedding: string
        }
        Returns: {
          chunk_idx: number
          content: string
          similarity: number
          subject_path: string
        }[]
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
