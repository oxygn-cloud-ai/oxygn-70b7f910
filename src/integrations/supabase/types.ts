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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      cyg_assistant_files: {
        Row: {
          assistant_row_id: string | null
          created_at: string
          file_size: number | null
          mime_type: string | null
          openai_file_id: string | null
          original_filename: string
          row_id: string
          storage_path: string
          upload_status: string | null
        }
        Insert: {
          assistant_row_id?: string | null
          created_at?: string
          file_size?: number | null
          mime_type?: string | null
          openai_file_id?: string | null
          original_filename: string
          row_id?: string
          storage_path: string
          upload_status?: string | null
        }
        Update: {
          assistant_row_id?: string | null
          created_at?: string
          file_size?: number | null
          mime_type?: string | null
          openai_file_id?: string | null
          original_filename?: string
          row_id?: string
          storage_path?: string
          upload_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cyg_assistant_files_assistant_row_id_fkey"
            columns: ["assistant_row_id"]
            isOneToOne: false
            referencedRelation: "cyg_assistants"
            referencedColumns: ["row_id"]
          },
        ]
      }
      cyg_assistant_tool_defaults: {
        Row: {
          code_interpreter_enabled: boolean | null
          created_at: string
          file_search_enabled: boolean | null
          function_calling_enabled: boolean | null
          row_id: string
          updated_at: string
        }
        Insert: {
          code_interpreter_enabled?: boolean | null
          created_at?: string
          file_search_enabled?: boolean | null
          function_calling_enabled?: boolean | null
          row_id?: string
          updated_at?: string
        }
        Update: {
          code_interpreter_enabled?: boolean | null
          created_at?: string
          file_search_enabled?: boolean | null
          function_calling_enabled?: boolean | null
          row_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      cyg_assistants: {
        Row: {
          code_interpreter_enabled: boolean | null
          confluence_enabled: boolean | null
          created_at: string
          file_search_enabled: boolean | null
          function_calling_enabled: boolean | null
          instructions: string | null
          last_error: string | null
          last_instantiated_at: string | null
          max_tokens_override: string | null
          model_override: string | null
          name: string
          openai_assistant_id: string | null
          owner_id: string | null
          prompt_row_id: string | null
          row_id: string
          shared_vector_store_row_id: string | null
          status: string | null
          temperature_override: string | null
          top_p_override: string | null
          updated_at: string
          use_global_tool_defaults: boolean | null
          use_shared_vector_store: boolean | null
          vector_store_id: string | null
        }
        Insert: {
          code_interpreter_enabled?: boolean | null
          confluence_enabled?: boolean | null
          created_at?: string
          file_search_enabled?: boolean | null
          function_calling_enabled?: boolean | null
          instructions?: string | null
          last_error?: string | null
          last_instantiated_at?: string | null
          max_tokens_override?: string | null
          model_override?: string | null
          name?: string
          openai_assistant_id?: string | null
          owner_id?: string | null
          prompt_row_id?: string | null
          row_id?: string
          shared_vector_store_row_id?: string | null
          status?: string | null
          temperature_override?: string | null
          top_p_override?: string | null
          updated_at?: string
          use_global_tool_defaults?: boolean | null
          use_shared_vector_store?: boolean | null
          vector_store_id?: string | null
        }
        Update: {
          code_interpreter_enabled?: boolean | null
          confluence_enabled?: boolean | null
          created_at?: string
          file_search_enabled?: boolean | null
          function_calling_enabled?: boolean | null
          instructions?: string | null
          last_error?: string | null
          last_instantiated_at?: string | null
          max_tokens_override?: string | null
          model_override?: string | null
          name?: string
          openai_assistant_id?: string | null
          owner_id?: string | null
          prompt_row_id?: string | null
          row_id?: string
          shared_vector_store_row_id?: string | null
          status?: string | null
          temperature_override?: string | null
          top_p_override?: string | null
          updated_at?: string
          use_global_tool_defaults?: boolean | null
          use_shared_vector_store?: boolean | null
          vector_store_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cyg_assistants_prompt_row_id_fkey"
            columns: ["prompt_row_id"]
            isOneToOne: true
            referencedRelation: "cyg_prompts"
            referencedColumns: ["row_id"]
          },
          {
            foreignKeyName: "cyg_assistants_shared_vector_store_row_id_fkey"
            columns: ["shared_vector_store_row_id"]
            isOneToOne: false
            referencedRelation: "cyg_vector_stores"
            referencedColumns: ["row_id"]
          },
        ]
      }
      cyg_confluence_pages: {
        Row: {
          assistant_row_id: string | null
          content_html: string | null
          content_text: string | null
          created_at: string
          last_synced_at: string | null
          openai_file_id: string | null
          page_id: string
          page_title: string
          page_url: string | null
          parent_page_id: string | null
          prompt_row_id: string | null
          row_id: string
          space_key: string | null
          space_name: string | null
          sync_status: string | null
          updated_at: string
        }
        Insert: {
          assistant_row_id?: string | null
          content_html?: string | null
          content_text?: string | null
          created_at?: string
          last_synced_at?: string | null
          openai_file_id?: string | null
          page_id: string
          page_title: string
          page_url?: string | null
          parent_page_id?: string | null
          prompt_row_id?: string | null
          row_id?: string
          space_key?: string | null
          space_name?: string | null
          sync_status?: string | null
          updated_at?: string
        }
        Update: {
          assistant_row_id?: string | null
          content_html?: string | null
          content_text?: string | null
          created_at?: string
          last_synced_at?: string | null
          openai_file_id?: string | null
          page_id?: string
          page_title?: string
          page_url?: string | null
          parent_page_id?: string | null
          prompt_row_id?: string | null
          row_id?: string
          space_key?: string | null
          space_name?: string | null
          sync_status?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cyg_confluence_pages_assistant_row_id_fkey"
            columns: ["assistant_row_id"]
            isOneToOne: false
            referencedRelation: "cyg_assistants"
            referencedColumns: ["row_id"]
          },
          {
            foreignKeyName: "cyg_confluence_pages_prompt_row_id_fkey"
            columns: ["prompt_row_id"]
            isOneToOne: false
            referencedRelation: "cyg_prompts"
            referencedColumns: ["row_id"]
          },
        ]
      }
      cyg_model_defaults: {
        Row: {
          created_at: string
          frequency_penalty: string | null
          frequency_penalty_on: boolean | null
          logit_bias: string | null
          logit_bias_on: boolean | null
          max_tokens: string | null
          max_tokens_on: boolean | null
          model_id: string
          n: string | null
          n_on: boolean | null
          o_user: string | null
          o_user_on: boolean | null
          presence_penalty: string | null
          presence_penalty_on: boolean | null
          response_format: string | null
          response_format_on: boolean | null
          row_id: string
          stop: string | null
          stop_on: boolean | null
          stream: boolean | null
          stream_on: boolean | null
          temperature: string | null
          temperature_on: boolean | null
          top_p: string | null
          top_p_on: boolean | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          frequency_penalty?: string | null
          frequency_penalty_on?: boolean | null
          logit_bias?: string | null
          logit_bias_on?: boolean | null
          max_tokens?: string | null
          max_tokens_on?: boolean | null
          model_id: string
          n?: string | null
          n_on?: boolean | null
          o_user?: string | null
          o_user_on?: boolean | null
          presence_penalty?: string | null
          presence_penalty_on?: boolean | null
          response_format?: string | null
          response_format_on?: boolean | null
          row_id?: string
          stop?: string | null
          stop_on?: boolean | null
          stream?: boolean | null
          stream_on?: boolean | null
          temperature?: string | null
          temperature_on?: boolean | null
          top_p?: string | null
          top_p_on?: boolean | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          frequency_penalty?: string | null
          frequency_penalty_on?: boolean | null
          logit_bias?: string | null
          logit_bias_on?: boolean | null
          max_tokens?: string | null
          max_tokens_on?: boolean | null
          model_id?: string
          n?: string | null
          n_on?: boolean | null
          o_user?: string | null
          o_user_on?: boolean | null
          presence_penalty?: string | null
          presence_penalty_on?: boolean | null
          response_format?: string | null
          response_format_on?: boolean | null
          row_id?: string
          stop?: string | null
          stop_on?: boolean | null
          stream?: boolean | null
          stream_on?: boolean | null
          temperature?: string | null
          temperature_on?: boolean | null
          top_p?: string | null
          top_p_on?: boolean | null
          updated_at?: string
        }
        Relationships: []
      }
      cyg_models: {
        Row: {
          created_at: string
          is_active: boolean | null
          model_id: string
          model_name: string
          provider: string | null
          row_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          is_active?: boolean | null
          model_id: string
          model_name: string
          provider?: string | null
          row_id?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          is_active?: boolean | null
          model_id?: string
          model_name?: string
          provider?: string | null
          row_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      cyg_prompts: {
        Row: {
          admin_prompt_result: string | null
          best_of: string | null
          best_of_on: boolean | null
          child_thread_strategy: string | null
          confluence_enabled: boolean | null
          context_length: string | null
          context_length_on: boolean | null
          created_at: string
          default_child_thread_strategy: string | null
          echo: boolean | null
          echo_on: boolean | null
          frequency_penalty: string | null
          frequency_penalty_on: boolean | null
          input_admin_prompt: string | null
          input_user_prompt: string | null
          is_assistant: boolean | null
          is_deleted: boolean | null
          is_legacy: boolean | null
          is_private: boolean | null
          logit_bias: string | null
          logit_bias_on: boolean | null
          logprobs: string | null
          logprobs_on: boolean | null
          max_tokens: string | null
          max_tokens_on: boolean | null
          model: string | null
          model_on: boolean | null
          n: string | null
          n_on: boolean | null
          note: string | null
          o_user: string | null
          o_user_on: boolean | null
          output_response: string | null
          owner_id: string | null
          parent_row_id: string | null
          position: number | null
          presence_penalty: string | null
          presence_penalty_on: boolean | null
          prompt_name: string
          response_format: string | null
          response_format_on: boolean | null
          row_id: string
          settings_expanded: boolean | null
          stop: string | null
          stop_on: boolean | null
          stream: boolean | null
          stream_on: boolean | null
          suffix: string | null
          suffix_on: boolean | null
          temperature: string | null
          temperature_on: boolean | null
          thread_mode: string | null
          top_p: string | null
          top_p_on: boolean | null
          updated_at: string
          user_prompt_result: string | null
          web_search_on: boolean | null
        }
        Insert: {
          admin_prompt_result?: string | null
          best_of?: string | null
          best_of_on?: boolean | null
          child_thread_strategy?: string | null
          confluence_enabled?: boolean | null
          context_length?: string | null
          context_length_on?: boolean | null
          created_at?: string
          default_child_thread_strategy?: string | null
          echo?: boolean | null
          echo_on?: boolean | null
          frequency_penalty?: string | null
          frequency_penalty_on?: boolean | null
          input_admin_prompt?: string | null
          input_user_prompt?: string | null
          is_assistant?: boolean | null
          is_deleted?: boolean | null
          is_legacy?: boolean | null
          is_private?: boolean | null
          logit_bias?: string | null
          logit_bias_on?: boolean | null
          logprobs?: string | null
          logprobs_on?: boolean | null
          max_tokens?: string | null
          max_tokens_on?: boolean | null
          model?: string | null
          model_on?: boolean | null
          n?: string | null
          n_on?: boolean | null
          note?: string | null
          o_user?: string | null
          o_user_on?: boolean | null
          output_response?: string | null
          owner_id?: string | null
          parent_row_id?: string | null
          position?: number | null
          presence_penalty?: string | null
          presence_penalty_on?: boolean | null
          prompt_name?: string
          response_format?: string | null
          response_format_on?: boolean | null
          row_id?: string
          settings_expanded?: boolean | null
          stop?: string | null
          stop_on?: boolean | null
          stream?: boolean | null
          stream_on?: boolean | null
          suffix?: string | null
          suffix_on?: boolean | null
          temperature?: string | null
          temperature_on?: boolean | null
          thread_mode?: string | null
          top_p?: string | null
          top_p_on?: boolean | null
          updated_at?: string
          user_prompt_result?: string | null
          web_search_on?: boolean | null
        }
        Update: {
          admin_prompt_result?: string | null
          best_of?: string | null
          best_of_on?: boolean | null
          child_thread_strategy?: string | null
          confluence_enabled?: boolean | null
          context_length?: string | null
          context_length_on?: boolean | null
          created_at?: string
          default_child_thread_strategy?: string | null
          echo?: boolean | null
          echo_on?: boolean | null
          frequency_penalty?: string | null
          frequency_penalty_on?: boolean | null
          input_admin_prompt?: string | null
          input_user_prompt?: string | null
          is_assistant?: boolean | null
          is_deleted?: boolean | null
          is_legacy?: boolean | null
          is_private?: boolean | null
          logit_bias?: string | null
          logit_bias_on?: boolean | null
          logprobs?: string | null
          logprobs_on?: boolean | null
          max_tokens?: string | null
          max_tokens_on?: boolean | null
          model?: string | null
          model_on?: boolean | null
          n?: string | null
          n_on?: boolean | null
          note?: string | null
          o_user?: string | null
          o_user_on?: boolean | null
          output_response?: string | null
          owner_id?: string | null
          parent_row_id?: string | null
          position?: number | null
          presence_penalty?: string | null
          presence_penalty_on?: boolean | null
          prompt_name?: string
          response_format?: string | null
          response_format_on?: boolean | null
          row_id?: string
          settings_expanded?: boolean | null
          stop?: string | null
          stop_on?: boolean | null
          stream?: boolean | null
          stream_on?: boolean | null
          suffix?: string | null
          suffix_on?: boolean | null
          temperature?: string | null
          temperature_on?: boolean | null
          thread_mode?: string | null
          top_p?: string | null
          top_p_on?: boolean | null
          updated_at?: string
          user_prompt_result?: string | null
          web_search_on?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "cyg_prompts_parent_row_id_fkey"
            columns: ["parent_row_id"]
            isOneToOne: false
            referencedRelation: "cyg_prompts"
            referencedColumns: ["row_id"]
          },
        ]
      }
      cyg_settings: {
        Row: {
          created_at: string
          row_id: string
          setting_description: string | null
          setting_key: string
          setting_value: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          row_id?: string
          setting_description?: string | null
          setting_key: string
          setting_value?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          row_id?: string
          setting_description?: string | null
          setting_key?: string
          setting_value?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      cyg_threads: {
        Row: {
          assistant_row_id: string | null
          child_prompt_row_id: string | null
          created_at: string
          is_active: boolean | null
          last_message_at: string | null
          message_count: number | null
          name: string | null
          openai_thread_id: string
          owner_id: string | null
          row_id: string
        }
        Insert: {
          assistant_row_id?: string | null
          child_prompt_row_id?: string | null
          created_at?: string
          is_active?: boolean | null
          last_message_at?: string | null
          message_count?: number | null
          name?: string | null
          openai_thread_id: string
          owner_id?: string | null
          row_id?: string
        }
        Update: {
          assistant_row_id?: string | null
          child_prompt_row_id?: string | null
          created_at?: string
          is_active?: boolean | null
          last_message_at?: string | null
          message_count?: number | null
          name?: string | null
          openai_thread_id?: string
          owner_id?: string | null
          row_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cyg_threads_assistant_row_id_fkey"
            columns: ["assistant_row_id"]
            isOneToOne: false
            referencedRelation: "cyg_assistants"
            referencedColumns: ["row_id"]
          },
          {
            foreignKeyName: "cyg_threads_child_prompt_row_id_fkey"
            columns: ["child_prompt_row_id"]
            isOneToOne: false
            referencedRelation: "cyg_prompts"
            referencedColumns: ["row_id"]
          },
        ]
      }
      cyg_vector_stores: {
        Row: {
          created_at: string
          description: string | null
          is_shared: boolean | null
          name: string
          openai_vector_store_id: string | null
          row_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          is_shared?: boolean | null
          name: string
          openai_vector_store_id?: string | null
          row_id?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          is_shared?: boolean | null
          name?: string
          openai_vector_store_id?: string | null
          row_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      projects: {
        Row: {
          created_at: string
          is_private: boolean | null
          owner_id: string | null
          project_description: string | null
          project_id: string | null
          project_name: string
          project_row_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          is_private?: boolean | null
          owner_id?: string | null
          project_description?: string | null
          project_id?: string | null
          project_name?: string
          project_row_id?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          is_private?: boolean | null
          owner_id?: string | null
          project_description?: string | null
          project_id?: string | null
          project_name?: string
          project_row_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      resource_shares: {
        Row: {
          created_at: string
          id: string
          permission: string
          resource_id: string
          resource_type: string
          shared_by_user_id: string | null
          shared_with_user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          permission?: string
          resource_id: string
          resource_type: string
          shared_by_user_id?: string | null
          shared_with_user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          permission?: string
          resource_id?: string
          resource_type?: string
          shared_by_user_id?: string | null
          shared_with_user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_edit_resource: {
        Args: { _resource_id: string; _resource_type: string }
        Returns: boolean
      }
      can_read_resource: {
        Args: { _resource_id: string; _resource_type: string }
        Returns: boolean
      }
      current_user_has_allowed_domain: { Args: never; Returns: boolean }
      is_admin: { Args: { _user_id?: string }; Returns: boolean }
      is_allowed_domain: { Args: { email: string }; Returns: boolean }
      owns_prompt: {
        Args: { _prompt_id: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user"
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
    Enums: {
      app_role: ["admin", "user"],
    },
  },
} as const
