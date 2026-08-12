-- Migration: 035_fix_ai_topics_points.sql
-- Purpose: Fijar el otorgamiento de puntos por conversación IA en 1 punto.
-- No se elimina la columna points (evita romper funcionalidad existente);
-- solo se fija su valor por defecto y se actualizan los registros actuales a 1.

ALTER TABLE public.ai_topics
  ALTER COLUMN points SET DEFAULT 1;

UPDATE public.ai_topics SET points = 1;

-- =============================================================================
-- FIN DE MIGRACION 035
-- =============================================================================
