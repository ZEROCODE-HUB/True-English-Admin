-- Migration: 023_add_points_to_ai_topics.sql
-- Purpose: add `points` column to ai_topics so 'Puntos Ganados' from the topic modal is persisted

alter table if exists public.ai_topics
add column if not exists points integer not null default 0;

-- Ensure updated_at trigger exists (already created in previous migrations)
