-- Migration: 027_add_notifications_enabled.sql
-- Purpose: store the user's push-notification preference so the toggle in the
-- mobile app's Configuración screen persists across sessions.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS notifications_enabled boolean NOT NULL DEFAULT true;
