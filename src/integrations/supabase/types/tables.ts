export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
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
          source_info: Json | null
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
          source_info?: Json | null
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
          source_info?: Json | null
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
