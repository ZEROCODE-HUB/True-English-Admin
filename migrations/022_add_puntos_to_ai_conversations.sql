-- Migration: 022_add_puntos_to_ai_conversations.sql
-- Purpose: add `puntos` column to ai_conversations to track points per conversation

alter table if exists public.ai_conversations
add column if not exists puntos integer not null default 0;

-- Update `updated_at` automatically via existing trigger on update (no trigger changes required)
