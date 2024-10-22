export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      info: {
        Row: {
          content: string | null
          created: string
          info_key: string
        }
        Insert: {
          content?: string | null
          created?: string
          info_key: string
        }
        Update: {
          content?: string | null
          created?: string
          info_key?: string
        }
        Relationships: []
      }
      openai_models: {
        Row: {
          created: string
          is_deleted: boolean | null
          max_tokens: string | null
          model: string | null
          model_id: string
        }
        Insert: {
          created?: string
          is_deleted?: boolean | null
          max_tokens?: string | null
          model?: string | null
          model_id?: string
        }
        Update: {
          created?: string
          is_deleted?: boolean | null
          max_tokens?: string | null
          model?: string | null
          model_id?: string
        }
        Relationships: []
      }
      project_names: {
        Row: {
          created: string
          project_id: string
          project_name: string | null
        }
        Insert: {
          created?: string
          project_id?: string
          project_name?: string | null
        }
        Update: {
          created?: string
          project_id?: string
          project_name?: string | null
        }
        Relationships: []
      }
      projects: {
        Row: {
          admin_prompt_result: string | null
          batch_size: string | null
          batch_size_on: boolean | null
          best_of: string | null
          best_of_on: boolean | null
          context_length: string | null
          context_length_on: boolean | null
          created: string | null
          custom_finetune: string | null
          custom_finetune_on: boolean | null
          echo: string | null
          echo_on: boolean | null
          engine: string | null
          engine_on: boolean | null
          frequency_penalty: string | null
          frequency_penalty_on: boolean | null
          input: string | null
          input_admin_prompt: string | null
          input_on: boolean | null
          input_user_prompt: string | null
          learning_rate_multiplier: string | null
          learning_rate_multiplier_on: boolean | null
          level: number | null
          logit_bias: string | null
          logit_bias_on: boolean | null
          logprobs: string | null
          logprobs_on: boolean | null
          max_tokens: string | null
          max_tokens_on: boolean | null
          model: string | null
          model_on: boolean | null
          n: string | null
          n_epochs: number | null
          n_epochs_on: boolean | null
          n_on: boolean | null
          note: string | null
          parent_row_id: string | null
          presence_penalty: string | null
          presence_penalty_on: boolean | null
          project_id: string | null
          project_row_id: string
          prompt_name: string | null
          prompt_tokens: string | null
          prompt_tokens_on: boolean | null
          response_tokens: string | null
          response_tokens_on: boolean | null
          stop: string | null
          stop_on: boolean | null
          stream: string | null
          stream_on: boolean | null
          suffix: string | null
          suffix_on: boolean | null
          temperature: string | null
          temperature_on: boolean | null
          temperature_scaling: string | null
          temperature_scaling_on: boolean | null
          top_p: string | null
          top_p_on: boolean | null
          training_file: string | null
          training_file_on: boolean | null
          user: string | null
          user_on: boolean | null
          user_prompt_result: string | null
          validation_file: string | null
          validation_file_on: boolean | null
        }
        Insert: {
          admin_prompt_result?: string | null
          batch_size?: string | null
          batch_size_on?: boolean | null
          best_of?: string | null
          best_of_on?: boolean | null
          context_length?: string | null
          context_length_on?: boolean | null
          created?: string | null
          custom_finetune?: string | null
          custom_finetune_on?: boolean | null
          echo?: string | null
          echo_on?: boolean | null
          engine?: string | null
          engine_on?: boolean | null
          frequency_penalty?: string | null
          frequency_penalty_on?: boolean | null
          input?: string | null
          input_admin_prompt?: string | null
          input_on?: boolean | null
          input_user_prompt?: string | null
          learning_rate_multiplier?: string | null
          learning_rate_multiplier_on?: boolean | null
          level?: number | null
          logit_bias?: string | null
          logit_bias_on?: boolean | null
          logprobs?: string | null
          logprobs_on?: boolean | null
          max_tokens?: string | null
          max_tokens_on?: boolean | null
          model?: string | null
          model_on?: boolean | null
          n?: string | null
          n_epochs?: number | null
          n_epochs_on?: boolean | null
          n_on?: boolean | null
          note?: string | null
          parent_row_id?: string | null
          presence_penalty?: string | null
          presence_penalty_on?: boolean | null
          project_id?: string | null
          project_row_id?: string
          prompt_name?: string | null
          prompt_tokens?: string | null
          prompt_tokens_on?: boolean | null
          response_tokens?: string | null
          response_tokens_on?: boolean | null
          stop?: string | null
          stop_on?: boolean | null
          stream?: string | null
          stream_on?: boolean | null
          suffix?: string | null
          suffix_on?: boolean | null
          temperature?: string | null
          temperature_on?: boolean | null
          temperature_scaling?: string | null
          temperature_scaling_on?: boolean | null
          top_p?: string | null
          top_p_on?: boolean | null
          training_file?: string | null
          training_file_on?: boolean | null
          user?: string | null
          user_on?: boolean | null
          user_prompt_result?: string | null
          validation_file?: string | null
          validation_file_on?: boolean | null
        }
        Update: {
          admin_prompt_result?: string | null
          batch_size?: string | null
          batch_size_on?: boolean | null
          best_of?: string | null
          best_of_on?: boolean | null
          context_length?: string | null
          context_length_on?: boolean | null
          created?: string | null
          custom_finetune?: string | null
          custom_finetune_on?: boolean | null
          echo?: string | null
          echo_on?: boolean | null
          engine?: string | null
          engine_on?: boolean | null
          frequency_penalty?: string | null
          frequency_penalty_on?: boolean | null
          input?: string | null
          input_admin_prompt?: string | null
          input_on?: boolean | null
          input_user_prompt?: string | null
          learning_rate_multiplier?: string | null
          learning_rate_multiplier_on?: boolean | null
          level?: number | null
          logit_bias?: string | null
          logit_bias_on?: boolean | null
          logprobs?: string | null
          logprobs_on?: boolean | null
          max_tokens?: string | null
          max_tokens_on?: boolean | null
          model?: string | null
          model_on?: boolean | null
          n?: string | null
          n_epochs?: number | null
          n_epochs_on?: boolean | null
          n_on?: boolean | null
          note?: string | null
          parent_row_id?: string | null
          presence_penalty?: string | null
          presence_penalty_on?: boolean | null
          project_id?: string | null
          project_row_id?: string
          prompt_name?: string | null
          prompt_tokens?: string | null
          prompt_tokens_on?: boolean | null
          response_tokens?: string | null
          response_tokens_on?: boolean | null
          stop?: string | null
          stop_on?: boolean | null
          stream?: string | null
          stream_on?: boolean | null
          suffix?: string | null
          suffix_on?: boolean | null
          temperature?: string | null
          temperature_on?: boolean | null
          temperature_scaling?: string | null
          temperature_scaling_on?: boolean | null
          top_p?: string | null
          top_p_on?: boolean | null
          training_file?: string | null
          training_file_on?: boolean | null
          user?: string | null
          user_on?: boolean | null
          user_prompt_result?: string | null
          validation_file?: string | null
          validation_file_on?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_model"
            columns: ["model"]
            isOneToOne: false
            referencedRelation: "openai_models"
            referencedColumns: ["model"]
          },
          {
            foreignKeyName: "projects_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_names"
            referencedColumns: ["project_id"]
          },
        ]
      }
      prompts: {
        Row: {
          admin_prompt_result: string | null
          batch_size: number | null
          batch_size_on: boolean
          best_of: number | null
          best_of_on: boolean
          context_length: number | null
          context_length_on: boolean
          created: string
          custom_finetune: string | null
          custom_finetune_on: boolean
          echo: boolean
          echo_on: boolean
          engine: string | null
          engine_on: boolean
          frequency_penalty: number | null
          frequency_penalty_on: boolean
          input: string | null
          input_admin_prompt: string | null
          input_on: boolean
          input_user_prompt: string | null
          is_deleted: boolean
          learning_rate_multiplier: number | null
          learning_rate_multiplier_on: boolean
          level: number | null
          logit_bias: Json | null
          logit_bias_on: boolean
          logprobs: number | null
          logprobs_on: boolean
          max_tokens: number | null
          max_tokens_on: boolean
          model: string | null
          model_on: boolean
          n: number | null
          n_epochs: number | null
          n_epochs_on: boolean
          n_on: boolean
          note: string | null
          o_user: string | null
          o_user_on: boolean
          parent_row_id: string | null
          presence_penalty: number | null
          presence_penalty_on: boolean
          project_id: string | null
          prompt_name: string
          prompt_settings_open: boolean
          prompt_tokens: number | null
          prompt_tokens_on: boolean
          response_format: Json | null
          response_format_on: boolean
          response_tokens: number | null
          response_tokens_on: boolean
          row_id: string
          src_admin_prompt_result: Json | null
          src_input_admin_prompt: Json | null
          src_input_user_prompt: Json | null
          src_note: Json | null
          src_user_prompt_result: Json | null
          stop: string[] | null
          stop_on: boolean
          stream: boolean
          stream_on: boolean
          suffix: string | null
          suffix_on: boolean
          temperature: number | null
          temperature_on: boolean
          temperature_scaling: number | null
          temperature_scaling_on: boolean
          top_p: number | null
          top_p_on: boolean
          training_file: string | null
          training_file_on: boolean
          user_prompt_result: string | null
          validation_file: string | null
          validation_file_on: boolean
        }
        Insert: {
          admin_prompt_result?: string | null
          batch_size?: number | null
          batch_size_on?: boolean
          best_of?: number | null
          best_of_on?: boolean
          context_length?: number | null
          context_length_on?: boolean
          created?: string
          custom_finetune?: string | null
          custom_finetune_on?: boolean
          echo: boolean
          echo_on?: boolean
          engine?: string | null
          engine_on?: boolean
          frequency_penalty?: number | null
          frequency_penalty_on: boolean
          input?: string | null
          input_admin_prompt?: string | null
          input_on?: boolean
          input_user_prompt?: string | null
          is_deleted?: boolean
          learning_rate_multiplier?: number | null
          learning_rate_multiplier_on?: boolean
          level?: number | null
          logit_bias?: Json | null
          logit_bias_on?: boolean
          logprobs?: number | null
          logprobs_on?: boolean
          max_tokens?: number | null
          max_tokens_on?: boolean
          model?: string | null
          model_on?: boolean
          n?: number | null
          n_epochs?: number | null
          n_epochs_on?: boolean
          n_on?: boolean
          note?: string | null
          o_user?: string | null
          o_user_on?: boolean
          parent_row_id?: string | null
          presence_penalty?: number | null
          presence_penalty_on: boolean
          project_id?: string | null
          prompt_name: string
          prompt_settings_open?: boolean
          prompt_tokens?: number | null
          prompt_tokens_on?: boolean
          response_format?: Json | null
          response_format_on?: boolean
          response_tokens?: number | null
          response_tokens_on?: boolean
          row_id?: string
          src_admin_prompt_result?: Json | null
          src_input_admin_prompt?: Json | null
          src_input_user_prompt?: Json | null
          src_note?: Json | null
          src_user_prompt_result?: Json | null
          stop?: string[] | null
          stop_on?: boolean
          stream: boolean
          stream_on?: boolean
          suffix?: string | null
          suffix_on?: boolean
          temperature?: number | null
          temperature_on?: boolean
          temperature_scaling?: number | null
          temperature_scaling_on?: boolean
          top_p?: number | null
          top_p_on?: boolean
          training_file?: string | null
          training_file_on?: boolean
          user_prompt_result?: string | null
          validation_file?: string | null
          validation_file_on?: boolean
        }
        Update: {
          admin_prompt_result?: string | null
          batch_size?: number | null
          batch_size_on?: boolean
          best_of?: number | null
          best_of_on?: boolean
          context_length?: number | null
          context_length_on?: boolean
          created?: string
          custom_finetune?: string | null
          custom_finetune_on?: boolean
          echo?: boolean
          echo_on?: boolean
          engine?: string | null
          engine_on?: boolean
          frequency_penalty?: number | null
          frequency_penalty_on?: boolean
          input?: string | null
          input_admin_prompt?: string | null
          input_on?: boolean
          input_user_prompt?: string | null
          is_deleted?: boolean
          learning_rate_multiplier?: number | null
          learning_rate_multiplier_on?: boolean
          level?: number | null
          logit_bias?: Json | null
          logit_bias_on?: boolean
          logprobs?: number | null
          logprobs_on?: boolean
          max_tokens?: number | null
          max_tokens_on?: boolean
          model?: string | null
          model_on?: boolean
          n?: number | null
          n_epochs?: number | null
          n_epochs_on?: boolean
          n_on?: boolean
          note?: string | null
          o_user?: string | null
          o_user_on?: boolean
          parent_row_id?: string | null
          presence_penalty?: number | null
          presence_penalty_on?: boolean
          project_id?: string | null
          prompt_name?: string
          prompt_settings_open?: boolean
          prompt_tokens?: number | null
          prompt_tokens_on?: boolean
          response_format?: Json | null
          response_format_on?: boolean
          response_tokens?: number | null
          response_tokens_on?: boolean
          row_id?: string
          src_admin_prompt_result?: Json | null
          src_input_admin_prompt?: Json | null
          src_input_user_prompt?: Json | null
          src_note?: Json | null
          src_user_prompt_result?: Json | null
          stop?: string[] | null
          stop_on?: boolean
          stream?: boolean
          stream_on?: boolean
          suffix?: string | null
          suffix_on?: boolean
          temperature?: number | null
          temperature_on?: boolean
          temperature_scaling?: number | null
          temperature_scaling_on?: boolean
          top_p?: number | null
          top_p_on?: boolean
          training_file?: string | null
          training_file_on?: boolean
          user_prompt_result?: string | null
          validation_file?: string | null
          validation_file_on?: boolean
        }
        Relationships: []
      }
      proto1_info: {
        Row: {
          content: string | null
          created: string | null
          info_key: string | null
        }
        Insert: {
          content?: string | null
          created?: string | null
          info_key?: string | null
        }
        Update: {
          content?: string | null
          created?: string | null
          info_key?: string | null
        }
        Relationships: []
      }
      proto1_openai_models: {
        Row: {
          created: string | null
          is_deleted: boolean | null
          max_tokens: string | null
          model: string | null
          model_id: string | null
        }
        Insert: {
          created?: string | null
          is_deleted?: boolean | null
          max_tokens?: string | null
          model?: string | null
          model_id?: string | null
        }
        Update: {
          created?: string | null
          is_deleted?: boolean | null
          max_tokens?: string | null
          model?: string | null
          model_id?: string | null
        }
        Relationships: []
      }
      proto1_project_names: {
        Row: {
          created: string | null
          project_id: string | null
          project_name: string | null
        }
        Insert: {
          created?: string | null
          project_id?: string | null
          project_name?: string | null
        }
        Update: {
          created?: string | null
          project_id?: string | null
          project_name?: string | null
        }
        Relationships: []
      }
      proto1_projects: {
        Row: {
          admin_prompt_result: string | null
          batch_size: string | null
          batch_size_on: boolean | null
          best_of: string | null
          best_of_on: boolean | null
          context_length: string | null
          context_length_on: boolean | null
          created: string | null
          custom_finetune: string | null
          custom_finetune_on: boolean | null
          echo: string | null
          echo_on: boolean | null
          engine: string | null
          engine_on: boolean | null
          frequency_penalty: string | null
          frequency_penalty_on: boolean | null
          input: string | null
          input_admin_prompt: string | null
          input_on: boolean | null
          input_user_prompt: string | null
          learning_rate_multiplier: string | null
          learning_rate_multiplier_on: boolean | null
          level: number | null
          logit_bias: string | null
          logit_bias_on: boolean | null
          logprobs: string | null
          logprobs_on: boolean | null
          max_tokens: string | null
          max_tokens_on: boolean | null
          model: string | null
          model_on: boolean | null
          n: string | null
          n_epochs: number | null
          n_epochs_on: boolean | null
          n_on: boolean | null
          note: string | null
          parent_row_id: string | null
          presence_penalty: string | null
          presence_penalty_on: boolean | null
          project_id: string | null
          project_row_id: string | null
          prompt_name: string | null
          prompt_tokens: string | null
          prompt_tokens_on: boolean | null
          response_tokens: string | null
          response_tokens_on: boolean | null
          stop: string | null
          stop_on: boolean | null
          stream: string | null
          stream_on: boolean | null
          suffix: string | null
          suffix_on: boolean | null
          temperature: string | null
          temperature_on: boolean | null
          temperature_scaling: string | null
          temperature_scaling_on: boolean | null
          top_p: string | null
          top_p_on: boolean | null
          training_file: string | null
          training_file_on: boolean | null
          user: string | null
          user_on: boolean | null
          user_prompt_result: string | null
          validation_file: string | null
          validation_file_on: boolean | null
        }
        Insert: {
          admin_prompt_result?: string | null
          batch_size?: string | null
          batch_size_on?: boolean | null
          best_of?: string | null
          best_of_on?: boolean | null
          context_length?: string | null
          context_length_on?: boolean | null
          created?: string | null
          custom_finetune?: string | null
          custom_finetune_on?: boolean | null
          echo?: string | null
          echo_on?: boolean | null
          engine?: string | null
          engine_on?: boolean | null
          frequency_penalty?: string | null
          frequency_penalty_on?: boolean | null
          input?: string | null
          input_admin_prompt?: string | null
          input_on?: boolean | null
          input_user_prompt?: string | null
          learning_rate_multiplier?: string | null
          learning_rate_multiplier_on?: boolean | null
          level?: number | null
          logit_bias?: string | null
          logit_bias_on?: boolean | null
          logprobs?: string | null
          logprobs_on?: boolean | null
          max_tokens?: string | null
          max_tokens_on?: boolean | null
          model?: string | null
          model_on?: boolean | null
          n?: string | null
          n_epochs?: number | null
          n_epochs_on?: boolean | null
          n_on?: boolean | null
          note?: string | null
          parent_row_id?: string | null
          presence_penalty?: string | null
          presence_penalty_on?: boolean | null
          project_id?: string | null
          project_row_id?: string | null
          prompt_name?: string | null
          prompt_tokens?: string | null
          prompt_tokens_on?: boolean | null
          response_tokens?: string | null
          response_tokens_on?: boolean | null
          stop?: string | null
          stop_on?: boolean | null
          stream?: string | null
          stream_on?: boolean | null
          suffix?: string | null
          suffix_on?: boolean | null
          temperature?: string | null
          temperature_on?: boolean | null
          temperature_scaling?: string | null
          temperature_scaling_on?: boolean | null
          top_p?: string | null
          top_p_on?: boolean | null
          training_file?: string | null
          training_file_on?: boolean | null
          user?: string | null
          user_on?: boolean | null
          user_prompt_result?: string | null
          validation_file?: string | null
          validation_file_on?: boolean | null
        }
        Update: {
          admin_prompt_result?: string | null
          batch_size?: string | null
          batch_size_on?: boolean | null
          best_of?: string | null
          best_of_on?: boolean | null
          context_length?: string | null
          context_length_on?: boolean | null
          created?: string | null
          custom_finetune?: string | null
          custom_finetune_on?: boolean | null
          echo?: string | null
          echo_on?: boolean | null
          engine?: string | null
          engine_on?: boolean | null
          frequency_penalty?: string | null
          frequency_penalty_on?: boolean | null
          input?: string | null
          input_admin_prompt?: string | null
          input_on?: boolean | null
          input_user_prompt?: string | null
          learning_rate_multiplier?: string | null
          learning_rate_multiplier_on?: boolean | null
          level?: number | null
          logit_bias?: string | null
          logit_bias_on?: boolean | null
          logprobs?: string | null
          logprobs_on?: boolean | null
          max_tokens?: string | null
          max_tokens_on?: boolean | null
          model?: string | null
          model_on?: boolean | null
          n?: string | null
          n_epochs?: number | null
          n_epochs_on?: boolean | null
          n_on?: boolean | null
          note?: string | null
          parent_row_id?: string | null
          presence_penalty?: string | null
          presence_penalty_on?: boolean | null
          project_id?: string | null
          project_row_id?: string | null
          prompt_name?: string | null
          prompt_tokens?: string | null
          prompt_tokens_on?: boolean | null
          response_tokens?: string | null
          response_tokens_on?: boolean | null
          stop?: string | null
          stop_on?: boolean | null
          stream?: string | null
          stream_on?: boolean | null
          suffix?: string | null
          suffix_on?: boolean | null
          temperature?: string | null
          temperature_on?: boolean | null
          temperature_scaling?: string | null
          temperature_scaling_on?: boolean | null
          top_p?: string | null
          top_p_on?: boolean | null
          training_file?: string | null
          training_file_on?: boolean | null
          user?: string | null
          user_on?: boolean | null
          user_prompt_result?: string | null
          validation_file?: string | null
          validation_file_on?: boolean | null
        }
        Relationships: []
      }
      proto1_prompts: {
        Row: {
          admin_prompt_result: string | null
          batch_size: number | null
          batch_size_on: boolean | null
          best_of: number | null
          best_of_on: boolean | null
          context_length: number | null
          context_length_on: boolean | null
          created: string | null
          custom_finetune: string | null
          custom_finetune_on: boolean | null
          echo: boolean | null
          echo_on: boolean | null
          engine: string | null
          engine_on: boolean | null
          frequency_penalty: number | null
          frequency_penalty_on: boolean | null
          input: string | null
          input_admin_prompt: string | null
          input_on: boolean | null
          input_user_prompt: string | null
          is_deleted: boolean | null
          learning_rate_multiplier: number | null
          learning_rate_multiplier_on: boolean | null
          level: number | null
          logit_bias: Json | null
          logit_bias_on: boolean | null
          logprobs: number | null
          logprobs_on: boolean | null
          max_tokens: number | null
          max_tokens_on: boolean | null
          model: string | null
          model_on: boolean | null
          n: number | null
          n_epochs: number | null
          n_epochs_on: boolean | null
          n_on: boolean | null
          note: string | null
          o_user: string | null
          o_user_on: boolean | null
          parent_row_id: string | null
          presence_penalty: number | null
          presence_penalty_on: boolean | null
          project_id: string | null
          prompt_name: string | null
          prompt_settings_open: boolean | null
          prompt_tokens: number | null
          prompt_tokens_on: boolean | null
          response_format: Json | null
          response_format_on: boolean | null
          response_tokens: number | null
          response_tokens_on: boolean | null
          row_id: string | null
          src_admin_prompt_result: Json | null
          src_input_admin_prompt: Json | null
          src_input_user_prompt: Json | null
          src_note: Json | null
          src_user_prompt_result: Json | null
          stop: string[] | null
          stop_on: boolean | null
          stream: boolean | null
          stream_on: boolean | null
          suffix: string | null
          suffix_on: boolean | null
          temperature: number | null
          temperature_on: boolean | null
          temperature_scaling: number | null
          temperature_scaling_on: boolean | null
          top_p: number | null
          top_p_on: boolean | null
          training_file: string | null
          training_file_on: boolean | null
          user_prompt_result: string | null
          validation_file: string | null
          validation_file_on: boolean | null
        }
        Insert: {
          admin_prompt_result?: string | null
          batch_size?: number | null
          batch_size_on?: boolean | null
          best_of?: number | null
          best_of_on?: boolean | null
          context_length?: number | null
          context_length_on?: boolean | null
          created?: string | null
          custom_finetune?: string | null
          custom_finetune_on?: boolean | null
          echo?: boolean | null
          echo_on?: boolean | null
          engine?: string | null
          engine_on?: boolean | null
          frequency_penalty?: number | null
          frequency_penalty_on?: boolean | null
          input?: string | null
          input_admin_prompt?: string | null
          input_on?: boolean | null
          input_user_prompt?: string | null
          is_deleted?: boolean | null
          learning_rate_multiplier?: number | null
          learning_rate_multiplier_on?: boolean | null
          level?: number | null
          logit_bias?: Json | null
          logit_bias_on?: boolean | null
          logprobs?: number | null
          logprobs_on?: boolean | null
          max_tokens?: number | null
          max_tokens_on?: boolean | null
          model?: string | null
          model_on?: boolean | null
          n?: number | null
          n_epochs?: number | null
          n_epochs_on?: boolean | null
          n_on?: boolean | null
          note?: string | null
          o_user?: string | null
          o_user_on?: boolean | null
          parent_row_id?: string | null
          presence_penalty?: number | null
          presence_penalty_on?: boolean | null
          project_id?: string | null
          prompt_name?: string | null
          prompt_settings_open?: boolean | null
          prompt_tokens?: number | null
          prompt_tokens_on?: boolean | null
          response_format?: Json | null
          response_format_on?: boolean | null
          response_tokens?: number | null
          response_tokens_on?: boolean | null
          row_id?: string | null
          src_admin_prompt_result?: Json | null
          src_input_admin_prompt?: Json | null
          src_input_user_prompt?: Json | null
          src_note?: Json | null
          src_user_prompt_result?: Json | null
          stop?: string[] | null
          stop_on?: boolean | null
          stream?: boolean | null
          stream_on?: boolean | null
          suffix?: string | null
          suffix_on?: boolean | null
          temperature?: number | null
          temperature_on?: boolean | null
          temperature_scaling?: number | null
          temperature_scaling_on?: boolean | null
          top_p?: number | null
          top_p_on?: boolean | null
          training_file?: string | null
          training_file_on?: boolean | null
          user_prompt_result?: string | null
          validation_file?: string | null
          validation_file_on?: boolean | null
        }
        Update: {
          admin_prompt_result?: string | null
          batch_size?: number | null
          batch_size_on?: boolean | null
          best_of?: number | null
          best_of_on?: boolean | null
          context_length?: number | null
          context_length_on?: boolean | null
          created?: string | null
          custom_finetune?: string | null
          custom_finetune_on?: boolean | null
          echo?: boolean | null
          echo_on?: boolean | null
          engine?: string | null
          engine_on?: boolean | null
          frequency_penalty?: number | null
          frequency_penalty_on?: boolean | null
          input?: string | null
          input_admin_prompt?: string | null
          input_on?: boolean | null
          input_user_prompt?: string | null
          is_deleted?: boolean | null
          learning_rate_multiplier?: number | null
          learning_rate_multiplier_on?: boolean | null
          level?: number | null
          logit_bias?: Json | null
          logit_bias_on?: boolean | null
          logprobs?: number | null
          logprobs_on?: boolean | null
          max_tokens?: number | null
          max_tokens_on?: boolean | null
          model?: string | null
          model_on?: boolean | null
          n?: number | null
          n_epochs?: number | null
          n_epochs_on?: boolean | null
          n_on?: boolean | null
          note?: string | null
          o_user?: string | null
          o_user_on?: boolean | null
          parent_row_id?: string | null
          presence_penalty?: number | null
          presence_penalty_on?: boolean | null
          project_id?: string | null
          prompt_name?: string | null
          prompt_settings_open?: boolean | null
          prompt_tokens?: number | null
          prompt_tokens_on?: boolean | null
          response_format?: Json | null
          response_format_on?: boolean | null
          response_tokens?: number | null
          response_tokens_on?: boolean | null
          row_id?: string | null
          src_admin_prompt_result?: Json | null
          src_input_admin_prompt?: Json | null
          src_input_user_prompt?: Json | null
          src_note?: Json | null
          src_user_prompt_result?: Json | null
          stop?: string[] | null
          stop_on?: boolean | null
          stream?: boolean | null
          stream_on?: boolean | null
          suffix?: string | null
          suffix_on?: boolean | null
          temperature?: number | null
          temperature_on?: boolean | null
          temperature_scaling?: number | null
          temperature_scaling_on?: boolean | null
          top_p?: number | null
          top_p_on?: boolean | null
          training_file?: string | null
          training_file_on?: boolean | null
          user_prompt_result?: string | null
          validation_file?: string | null
          validation_file_on?: boolean | null
        }
        Relationships: []
      }
      proto1_records: {
        Row: {
          created_at: string | null
          id: string | null
          texts: Json | null
          texts_a: Json[] | null
        }
        Insert: {
          created_at?: string | null
          id?: string | null
          texts?: Json | null
          texts_a?: Json[] | null
        }
        Update: {
          created_at?: string | null
          id?: string | null
          texts?: Json | null
          texts_a?: Json[] | null
        }
        Relationships: []
      }
      proto1_settings: {
        Row: {
          build: string | null
          created: string | null
          def_admin_prompt: string | null
          openai_api_key: string | null
          openai_url: string | null
          setting_id: number | null
          version: string | null
        }
        Insert: {
          build?: string | null
          created?: string | null
          def_admin_prompt?: string | null
          openai_api_key?: string | null
          openai_url?: string | null
          setting_id?: number | null
          version?: string | null
        }
        Update: {
          build?: string | null
          created?: string | null
          def_admin_prompt?: string | null
          openai_api_key?: string | null
          openai_url?: string | null
          setting_id?: number | null
          version?: string | null
        }
        Relationships: []
      }
      records: {
        Row: {
          created_at: string
          id: string
          texts: Json
          texts_a: Json[] | null
        }
        Insert: {
          created_at?: string
          id?: string
          texts: Json
          texts_a?: Json[] | null
        }
        Update: {
          created_at?: string
          id?: string
          texts?: Json
          texts_a?: Json[] | null
        }
        Relationships: []
      }
      row_id_mapping: {
        Row: {
          new_row_id: string | null
          old_row_id: string | null
        }
        Insert: {
          new_row_id?: string | null
          old_row_id?: string | null
        }
        Update: {
          new_row_id?: string | null
          old_row_id?: string | null
        }
        Relationships: []
      }
      settings: {
        Row: {
          build: string | null
          created: string
          def_admin_prompt: string | null
          openai_api_key: string | null
          openai_url: string | null
          setting_id: number
          version: string | null
        }
        Insert: {
          build?: string | null
          created?: string
          def_admin_prompt?: string | null
          openai_api_key?: string | null
          openai_url?: string | null
          setting_id?: number
          version?: string | null
        }
        Update: {
          build?: string | null
          created?: string
          def_admin_prompt?: string | null
          openai_api_key?: string | null
          openai_url?: string | null
          setting_id?: number
          version?: string | null
        }
        Relationships: []
      }
      zzz_info: {
        Row: {
          content: string | null
          created: string | null
          info_key: string | null
        }
        Insert: {
          content?: string | null
          created?: string | null
          info_key?: string | null
        }
        Update: {
          content?: string | null
          created?: string | null
          info_key?: string | null
        }
        Relationships: []
      }
      zzz_openai_models: {
        Row: {
          created: string | null
          is_deleted: boolean | null
          max_tokens: string | null
          model: string | null
          model_id: string | null
        }
        Insert: {
          created?: string | null
          is_deleted?: boolean | null
          max_tokens?: string | null
          model?: string | null
          model_id?: string | null
        }
        Update: {
          created?: string | null
          is_deleted?: boolean | null
          max_tokens?: string | null
          model?: string | null
          model_id?: string | null
        }
        Relationships: []
      }
      zzz_project_names: {
        Row: {
          created: string | null
          project_id: string | null
          project_name: string | null
        }
        Insert: {
          created?: string | null
          project_id?: string | null
          project_name?: string | null
        }
        Update: {
          created?: string | null
          project_id?: string | null
          project_name?: string | null
        }
        Relationships: []
      }
      zzz_projects: {
        Row: {
          admin_prompt_result: string | null
          batch_size: string | null
          batch_size_on: boolean | null
          best_of: string | null
          best_of_on: boolean | null
          context_length: string | null
          context_length_on: boolean | null
          created: string | null
          custom_finetune: string | null
          custom_finetune_on: boolean | null
          echo: string | null
          echo_on: boolean | null
          engine: string | null
          engine_on: boolean | null
          frequency_penalty: string | null
          frequency_penalty_on: boolean | null
          input: string | null
          input_admin_prompt: string | null
          input_on: boolean | null
          input_user_prompt: string | null
          learning_rate_multiplier: string | null
          learning_rate_multiplier_on: boolean | null
          level: number | null
          logit_bias: string | null
          logit_bias_on: boolean | null
          logprobs: string | null
          logprobs_on: boolean | null
          max_tokens: string | null
          max_tokens_on: boolean | null
          model: string | null
          model_on: boolean | null
          n: string | null
          n_epochs: number | null
          n_epochs_on: boolean | null
          n_on: boolean | null
          note: string | null
          parent_row_id: string | null
          presence_penalty: string | null
          presence_penalty_on: boolean | null
          project_id: string | null
          project_row_id: string | null
          prompt_name: string | null
          prompt_tokens: string | null
          prompt_tokens_on: boolean | null
          response_tokens: string | null
          response_tokens_on: boolean | null
          stop: string | null
          stop_on: boolean | null
          stream: string | null
          stream_on: boolean | null
          suffix: string | null
          suffix_on: boolean | null
          temperature: string | null
          temperature_on: boolean | null
          temperature_scaling: string | null
          temperature_scaling_on: boolean | null
          top_p: string | null
          top_p_on: boolean | null
          training_file: string | null
          training_file_on: boolean | null
          user: string | null
          user_on: boolean | null
          user_prompt_result: string | null
          validation_file: string | null
          validation_file_on: boolean | null
        }
        Insert: {
          admin_prompt_result?: string | null
          batch_size?: string | null
          batch_size_on?: boolean | null
          best_of?: string | null
          best_of_on?: boolean | null
          context_length?: string | null
          context_length_on?: boolean | null
          created?: string | null
          custom_finetune?: string | null
          custom_finetune_on?: boolean | null
          echo?: string | null
          echo_on?: boolean | null
          engine?: string | null
          engine_on?: boolean | null
          frequency_penalty?: string | null
          frequency_penalty_on?: boolean | null
          input?: string | null
          input_admin_prompt?: string | null
          input_on?: boolean | null
          input_user_prompt?: string | null
          learning_rate_multiplier?: string | null
          learning_rate_multiplier_on?: boolean | null
          level?: number | null
          logit_bias?: string | null
          logit_bias_on?: boolean | null
          logprobs?: string | null
          logprobs_on?: boolean | null
          max_tokens?: string | null
          max_tokens_on?: boolean | null
          model?: string | null
          model_on?: boolean | null
          n?: string | null
          n_epochs?: number | null
          n_epochs_on?: boolean | null
          n_on?: boolean | null
          note?: string | null
          parent_row_id?: string | null
          presence_penalty?: string | null
          presence_penalty_on?: boolean | null
          project_id?: string | null
          project_row_id?: string | null
          prompt_name?: string | null
          prompt_tokens?: string | null
          prompt_tokens_on?: boolean | null
          response_tokens?: string | null
          response_tokens_on?: boolean | null
          stop?: string | null
          stop_on?: boolean | null
          stream?: string | null
          stream_on?: boolean | null
          suffix?: string | null
          suffix_on?: boolean | null
          temperature?: string | null
          temperature_on?: boolean | null
          temperature_scaling?: string | null
          temperature_scaling_on?: boolean | null
          top_p?: string | null
          top_p_on?: boolean | null
          training_file?: string | null
          training_file_on?: boolean | null
          user?: string | null
          user_on?: boolean | null
          user_prompt_result?: string | null
          validation_file?: string | null
          validation_file_on?: boolean | null
        }
        Update: {
          admin_prompt_result?: string | null
          batch_size?: string | null
          batch_size_on?: boolean | null
          best_of?: string | null
          best_of_on?: boolean | null
          context_length?: string | null
          context_length_on?: boolean | null
          created?: string | null
          custom_finetune?: string | null
          custom_finetune_on?: boolean | null
          echo?: string | null
          echo_on?: boolean | null
          engine?: string | null
          engine_on?: boolean | null
          frequency_penalty?: string | null
          frequency_penalty_on?: boolean | null
          input?: string | null
          input_admin_prompt?: string | null
          input_on?: boolean | null
          input_user_prompt?: string | null
          learning_rate_multiplier?: string | null
          learning_rate_multiplier_on?: boolean | null
          level?: number | null
          logit_bias?: string | null
          logit_bias_on?: boolean | null
          logprobs?: string | null
          logprobs_on?: boolean | null
          max_tokens?: string | null
          max_tokens_on?: boolean | null
          model?: string | null
          model_on?: boolean | null
          n?: string | null
          n_epochs?: number | null
          n_epochs_on?: boolean | null
          n_on?: boolean | null
          note?: string | null
          parent_row_id?: string | null
          presence_penalty?: string | null
          presence_penalty_on?: boolean | null
          project_id?: string | null
          project_row_id?: string | null
          prompt_name?: string | null
          prompt_tokens?: string | null
          prompt_tokens_on?: boolean | null
          response_tokens?: string | null
          response_tokens_on?: boolean | null
          stop?: string | null
          stop_on?: boolean | null
          stream?: string | null
          stream_on?: boolean | null
          suffix?: string | null
          suffix_on?: boolean | null
          temperature?: string | null
          temperature_on?: boolean | null
          temperature_scaling?: string | null
          temperature_scaling_on?: boolean | null
          top_p?: string | null
          top_p_on?: boolean | null
          training_file?: string | null
          training_file_on?: boolean | null
          user?: string | null
          user_on?: boolean | null
          user_prompt_result?: string | null
          validation_file?: string | null
          validation_file_on?: boolean | null
        }
        Relationships: []
      }
      zzz_prompts: {
        Row: {
          admin_prompt_result: string | null
          batch_size: number | null
          batch_size_on: boolean | null
          best_of: number | null
          best_of_on: boolean | null
          context_length: number | null
          context_length_on: boolean | null
          created: string | null
          custom_finetune: string | null
          custom_finetune_on: boolean | null
          echo: boolean | null
          echo_on: boolean | null
          engine: string | null
          engine_on: boolean | null
          frequency_penalty: number | null
          frequency_penalty_on: boolean | null
          input: string | null
          input_admin_prompt: string | null
          input_on: boolean | null
          input_user_prompt: string | null
          is_deleted: boolean | null
          learning_rate_multiplier: number | null
          learning_rate_multiplier_on: boolean | null
          level: number | null
          logit_bias: Json | null
          logit_bias_on: boolean | null
          logprobs: number | null
          logprobs_on: boolean | null
          max_tokens: number | null
          max_tokens_on: boolean | null
          model: string | null
          model_on: boolean | null
          n: number | null
          n_epochs: number | null
          n_epochs_on: boolean | null
          n_on: boolean | null
          note: string | null
          o_user: string | null
          o_user_on: boolean | null
          parent_row_id: string | null
          presence_penalty: number | null
          presence_penalty_on: boolean | null
          project_id: string | null
          prompt_name: string | null
          prompt_settings_open: boolean | null
          prompt_tokens: number | null
          prompt_tokens_on: boolean | null
          response_format: Json | null
          response_format_on: boolean | null
          response_tokens: number | null
          response_tokens_on: boolean | null
          row_id: string | null
          src_admin_prompt_result: Json | null
          src_input_admin_prompt: Json | null
          src_input_user_prompt: Json | null
          src_note: Json | null
          src_user_prompt_result: Json | null
          stop: string[] | null
          stop_on: boolean | null
          stream: boolean | null
          stream_on: boolean | null
          suffix: string | null
          suffix_on: boolean | null
          temperature: number | null
          temperature_on: boolean | null
          temperature_scaling: number | null
          temperature_scaling_on: boolean | null
          top_p: number | null
          top_p_on: boolean | null
          training_file: string | null
          training_file_on: boolean | null
          user_prompt_result: string | null
          validation_file: string | null
          validation_file_on: boolean | null
        }
        Insert: {
          admin_prompt_result?: string | null
          batch_size?: number | null
          batch_size_on?: boolean | null
          best_of?: number | null
          best_of_on?: boolean | null
          context_length?: number | null
          context_length_on?: boolean | null
          created?: string | null
          custom_finetune?: string | null
          custom_finetune_on?: boolean | null
          echo?: boolean | null
          echo_on?: boolean | null
          engine?: string | null
          engine_on?: boolean | null
          frequency_penalty?: number | null
          frequency_penalty_on?: boolean | null
          input?: string | null
          input_admin_prompt?: string | null
          input_on?: boolean | null
          input_user_prompt?: string | null
          is_deleted?: boolean | null
          learning_rate_multiplier?: number | null
          learning_rate_multiplier_on?: boolean | null
          level?: number | null
          logit_bias?: Json | null
          logit_bias_on?: boolean | null
          logprobs?: number | null
          logprobs_on?: boolean | null
          max_tokens?: number | null
          max_tokens_on?: boolean | null
          model?: string | null
          model_on?: boolean | null
          n?: number | null
          n_epochs?: number | null
          n_epochs_on?: boolean | null
          n_on?: boolean | null
          note?: string | null
          o_user?: string | null
          o_user_on?: boolean | null
          parent_row_id?: string | null
          presence_penalty?: number | null
          presence_penalty_on?: boolean | null
          project_id?: string | null
          prompt_name?: string | null
          prompt_settings_open?: boolean | null
          prompt_tokens?: number | null
          prompt_tokens_on?: boolean | null
          response_format?: Json | null
          response_format_on?: boolean | null
          response_tokens?: number | null
          response_tokens_on?: boolean | null
          row_id?: string | null
          src_admin_prompt_result?: Json | null
          src_input_admin_prompt?: Json | null
          src_input_user_prompt?: Json | null
          src_note?: Json | null
          src_user_prompt_result?: Json | null
          stop?: string[] | null
          stop_on?: boolean | null
          stream?: boolean | null
          stream_on?: boolean | null
          suffix?: string | null
          suffix_on?: boolean | null
          temperature?: number | null
          temperature_on?: boolean | null
          temperature_scaling?: number | null
          temperature_scaling_on?: boolean | null
          top_p?: number | null
          top_p_on?: boolean | null
          training_file?: string | null
          training_file_on?: boolean | null
          user_prompt_result?: string | null
          validation_file?: string | null
          validation_file_on?: boolean | null
        }
        Update: {
          admin_prompt_result?: string | null
          batch_size?: number | null
          batch_size_on?: boolean | null
          best_of?: number | null
          best_of_on?: boolean | null
          context_length?: number | null
          context_length_on?: boolean | null
          created?: string | null
          custom_finetune?: string | null
          custom_finetune_on?: boolean | null
          echo?: boolean | null
          echo_on?: boolean | null
          engine?: string | null
          engine_on?: boolean | null
          frequency_penalty?: number | null
          frequency_penalty_on?: boolean | null
          input?: string | null
          input_admin_prompt?: string | null
          input_on?: boolean | null
          input_user_prompt?: string | null
          is_deleted?: boolean | null
          learning_rate_multiplier?: number | null
          learning_rate_multiplier_on?: boolean | null
          level?: number | null
          logit_bias?: Json | null
          logit_bias_on?: boolean | null
          logprobs?: number | null
          logprobs_on?: boolean | null
          max_tokens?: number | null
          max_tokens_on?: boolean | null
          model?: string | null
          model_on?: boolean | null
          n?: number | null
          n_epochs?: number | null
          n_epochs_on?: boolean | null
          n_on?: boolean | null
          note?: string | null
          o_user?: string | null
          o_user_on?: boolean | null
          parent_row_id?: string | null
          presence_penalty?: number | null
          presence_penalty_on?: boolean | null
          project_id?: string | null
          prompt_name?: string | null
          prompt_settings_open?: boolean | null
          prompt_tokens?: number | null
          prompt_tokens_on?: boolean | null
          response_format?: Json | null
          response_format_on?: boolean | null
          response_tokens?: number | null
          response_tokens_on?: boolean | null
          row_id?: string | null
          src_admin_prompt_result?: Json | null
          src_input_admin_prompt?: Json | null
          src_input_user_prompt?: Json | null
          src_note?: Json | null
          src_user_prompt_result?: Json | null
          stop?: string[] | null
          stop_on?: boolean | null
          stream?: boolean | null
          stream_on?: boolean | null
          suffix?: string | null
          suffix_on?: boolean | null
          temperature?: number | null
          temperature_on?: boolean | null
          temperature_scaling?: number | null
          temperature_scaling_on?: boolean | null
          top_p?: number | null
          top_p_on?: boolean | null
          training_file?: string | null
          training_file_on?: boolean | null
          user_prompt_result?: string | null
          validation_file?: string | null
          validation_file_on?: boolean | null
        }
        Relationships: []
      }
      zzz_records: {
        Row: {
          created_at: string | null
          id: string | null
          texts: Json | null
          texts_a: Json[] | null
        }
        Insert: {
          created_at?: string | null
          id?: string | null
          texts?: Json | null
          texts_a?: Json[] | null
        }
        Update: {
          created_at?: string | null
          id?: string | null
          texts?: Json | null
          texts_a?: Json[] | null
        }
        Relationships: []
      }
      zzz_row_id_mapping: {
        Row: {
          new_row_id: string | null
          old_row_id: string | null
        }
        Insert: {
          new_row_id?: string | null
          old_row_id?: string | null
        }
        Update: {
          new_row_id?: string | null
          old_row_id?: string | null
        }
        Relationships: []
      }
      zzz_settings: {
        Row: {
          build: string | null
          created: string | null
          def_admin_prompt: string | null
          openai_api_key: string | null
          openai_url: string | null
          setting_id: number | null
          version: string | null
        }
        Insert: {
          build?: string | null
          created?: string | null
          def_admin_prompt?: string | null
          openai_api_key?: string | null
          openai_url?: string | null
          setting_id?: number | null
          version?: string | null
        }
        Update: {
          build?: string | null
          created?: string | null
          def_admin_prompt?: string | null
          openai_api_key?: string | null
          openai_url?: string | null
          setting_id?: number | null
          version?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type PublicSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  PublicTableNameOrOptions extends
    | keyof (PublicSchema["Tables"] & PublicSchema["Views"])
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
        Database[PublicTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
      Database[PublicTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : PublicTableNameOrOptions extends keyof (PublicSchema["Tables"] &
        PublicSchema["Views"])
    ? (PublicSchema["Tables"] &
        PublicSchema["Views"])[PublicTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  PublicTableNameOrOptions extends
    | keyof PublicSchema["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
    ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  PublicTableNameOrOptions extends
    | keyof PublicSchema["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
    ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  PublicEnumNameOrOptions extends
    | keyof PublicSchema["Enums"]
    | { schema: keyof Database },
  EnumName extends PublicEnumNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = PublicEnumNameOrOptions extends { schema: keyof Database }
  ? Database[PublicEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : PublicEnumNameOrOptions extends keyof PublicSchema["Enums"]
    ? PublicSchema["Enums"][PublicEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof PublicSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof PublicSchema["CompositeTypes"]
    ? PublicSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never
