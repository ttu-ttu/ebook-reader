/**
 * @license BSD-3-Clause
 * Copyright (c) 2026, ッツ Reader Authors
 * All rights reserved.
 */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: '14.18';
  };
  public: {
    Tables: {
      batch_items: {
        Row: {
          book_id: string | null;
          deleted_at: string | null;
          error_reason: string | null;
          frequency: number | null;
          id: string;
          jmdict_id: number | null;
          lote_id: string | null;
          modified_at: string;
          notes: string | null;
          sentence: string;
          sentence_audio_path: string | null;
          sentence_furigana: string | null;
          sentence_meaning: string | null;
          state: string;
          updated_at: string;
          user_id: string;
          voice_text: string | null;
          word: string;
          word_audio_path: string | null;
          word_furigana: string | null;
          word_meaning: string | null;
          word_reading: string;
        };
        Insert: {
          book_id?: string | null;
          deleted_at?: string | null;
          error_reason?: string | null;
          frequency?: number | null;
          id?: string;
          jmdict_id?: number | null;
          lote_id?: string | null;
          modified_at?: string;
          notes?: string | null;
          sentence: string;
          sentence_audio_path?: string | null;
          sentence_furigana?: string | null;
          sentence_meaning?: string | null;
          state?: string;
          updated_at?: string;
          user_id?: string;
          voice_text?: string | null;
          word: string;
          word_audio_path?: string | null;
          word_furigana?: string | null;
          word_meaning?: string | null;
          word_reading: string;
        };
        Update: {
          book_id?: string | null;
          deleted_at?: string | null;
          error_reason?: string | null;
          frequency?: number | null;
          id?: string;
          jmdict_id?: number | null;
          lote_id?: string | null;
          modified_at?: string;
          notes?: string | null;
          sentence?: string;
          sentence_audio_path?: string | null;
          sentence_furigana?: string | null;
          sentence_meaning?: string | null;
          state?: string;
          updated_at?: string;
          user_id?: string;
          voice_text?: string | null;
          word?: string;
          word_audio_path?: string | null;
          word_furigana?: string | null;
          word_meaning?: string | null;
          word_reading?: string;
        };
        Relationships: [];
      };
      bookmarks: {
        Row: {
          book_id: string;
          deleted_at: string | null;
          explored_char_count: number | null;
          modified_at: string;
          progress: string | null;
          reach_char_count: number | null;
          scroll_x: number | null;
          scroll_y: number | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          book_id: string;
          deleted_at?: string | null;
          explored_char_count?: number | null;
          modified_at?: string;
          progress?: string | null;
          reach_char_count?: number | null;
          scroll_x?: number | null;
          scroll_y?: number | null;
          updated_at?: string;
          user_id?: string;
        };
        Update: {
          book_id?: string;
          deleted_at?: string | null;
          explored_char_count?: number | null;
          modified_at?: string;
          progress?: string | null;
          reach_char_count?: number | null;
          scroll_x?: number | null;
          scroll_y?: number | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      books: {
        Row: {
          characters: number;
          cover_path: string | null;
          deleted_at: string | null;
          id: string;
          modified_at: string;
          original_path: string | null;
          processed_path: string | null;
          title: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          characters?: number;
          cover_path?: string | null;
          deleted_at?: string | null;
          id: string;
          modified_at?: string;
          original_path?: string | null;
          processed_path?: string | null;
          title: string;
          updated_at?: string;
          user_id?: string;
        };
        Update: {
          characters?: number;
          cover_path?: string | null;
          deleted_at?: string | null;
          id?: string;
          modified_at?: string;
          original_path?: string | null;
          processed_path?: string | null;
          title?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      gemini_usage: {
        Row: {
          calls: number;
          day: string;
          deleted_at: string | null;
          modified_at: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          calls?: number;
          day: string;
          deleted_at?: string | null;
          modified_at?: string;
          updated_at?: string;
          user_id?: string;
        };
        Update: {
          calls?: number;
          day?: string;
          deleted_at?: string | null;
          modified_at?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      lotes: {
        Row: {
          confirmed_in_anki_at: string | null;
          deleted_at: string | null;
          device_id: string;
          exported_at: string;
          id: string;
          modified_at: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          confirmed_in_anki_at?: string | null;
          deleted_at?: string | null;
          device_id: string;
          exported_at: string;
          id?: string;
          modified_at?: string;
          updated_at?: string;
          user_id?: string;
        };
        Update: {
          confirmed_in_anki_at?: string | null;
          deleted_at?: string | null;
          device_id?: string;
          exported_at?: string;
          id?: string;
          modified_at?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      reading_goals: {
        Row: {
          character_goal: number;
          deleted_at: string | null;
          goal_end_date: string | null;
          goal_original_end_date: string | null;
          goal_start_date: string;
          modified_at: string;
          time_goal: number;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          character_goal?: number;
          deleted_at?: string | null;
          goal_end_date?: string | null;
          goal_original_end_date?: string | null;
          goal_start_date: string;
          modified_at?: string;
          time_goal?: number;
          updated_at?: string;
          user_id?: string;
        };
        Update: {
          character_goal?: number;
          deleted_at?: string | null;
          goal_end_date?: string | null;
          goal_original_end_date?: string | null;
          goal_start_date?: string;
          modified_at?: string;
          time_goal?: number;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      reading_stats: {
        Row: {
          alt_min_reading_speed: number;
          book_id: string;
          characters_read: number;
          completed_book: boolean;
          completed_data: Json | null;
          date_key: string;
          deleted_at: string | null;
          device_id: string;
          last_reading_speed: number;
          max_reading_speed: number;
          min_reading_speed: number;
          modified_at: string;
          reading_time: number;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          alt_min_reading_speed?: number;
          book_id: string;
          characters_read?: number;
          completed_book?: boolean;
          completed_data?: Json | null;
          date_key: string;
          deleted_at?: string | null;
          device_id: string;
          last_reading_speed?: number;
          max_reading_speed?: number;
          min_reading_speed?: number;
          modified_at?: string;
          reading_time?: number;
          updated_at?: string;
          user_id?: string;
        };
        Update: {
          alt_min_reading_speed?: number;
          book_id?: string;
          characters_read?: number;
          completed_book?: boolean;
          completed_data?: Json | null;
          date_key?: string;
          deleted_at?: string | null;
          device_id?: string;
          last_reading_speed?: number;
          max_reading_speed?: number;
          min_reading_speed?: number;
          modified_at?: string;
          reading_time?: number;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      translations: {
        Row: {
          deleted_at: string | null;
          modified_at: string;
          sentence: string;
          sentence_sha256: string;
          translated_at: string;
          translation: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          deleted_at?: string | null;
          modified_at?: string;
          sentence: string;
          sentence_sha256: string;
          translated_at?: string;
          translation: string;
          updated_at?: string;
          user_id?: string;
        };
        Update: {
          deleted_at?: string | null;
          modified_at?: string;
          sentence?: string;
          sentence_sha256?: string;
          translated_at?: string;
          translation?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      vocab: {
        Row: {
          deleted_at: string | null;
          interval_days: number | null;
          jmdict_id: number | null;
          leech: boolean;
          modified_at: string;
          reading: string;
          source: string;
          state: string;
          suspended: boolean;
          synced_at: string | null;
          updated_at: string;
          user_id: string;
          word: string;
        };
        Insert: {
          deleted_at?: string | null;
          interval_days?: number | null;
          jmdict_id?: number | null;
          leech?: boolean;
          modified_at?: string;
          reading: string;
          source: string;
          state: string;
          suspended?: boolean;
          synced_at?: string | null;
          updated_at?: string;
          user_id?: string;
          word: string;
        };
        Update: {
          deleted_at?: string | null;
          interval_days?: number | null;
          jmdict_id?: number | null;
          leech?: boolean;
          modified_at?: string;
          reading?: string;
          source?: string;
          state?: string;
          suspended?: boolean;
          synced_at?: string | null;
          updated_at?: string;
          user_id?: string;
          word?: string;
        };
        Relationships: [];
      };
      vocab_history: {
        Row: {
          deleted_at: string | null;
          id: string;
          known_count: number;
          learning_count: number;
          modified_at: string;
          synced_at: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          deleted_at?: string | null;
          id?: string;
          known_count?: number;
          learning_count?: number;
          modified_at?: string;
          synced_at: string;
          updated_at?: string;
          user_id?: string;
        };
        Update: {
          deleted_at?: string | null;
          id?: string;
          known_count?: number;
          learning_count?: number;
          modified_at?: string;
          synced_at?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never = never
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] & DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema['Enums']
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never = never
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema['CompositeTypes']
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never = never
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {}
  }
} as const;
