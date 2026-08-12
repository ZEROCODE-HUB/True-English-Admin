-- Migration: 039_backfill_program_to_legacy_quizzes.sql
-- Purpose: Asocia preguntas y desafíos existentes (program_id NULL) a su línea correcta.
-- Ejecutar DESPUÉS de 038 y después de crear las líneas Kids/TOEFL en /programs.
-- Idempotente: usa WHERE program_id IS NULL (no sobreescribe).

-- =============================================================================
-- 1. PREGUNTAS SIN LÍNEA → Estándar
-- =============================================================================
UPDATE public.questions q
SET program_id = p.id
FROM public.programs p
WHERE p.slug = 'estandar'
  AND q.program_id IS NULL;

-- =============================================================================
-- 2. PREGUNTAS TOEFL SIN LÍNEA → línea TOEFL
-- =============================================================================
UPDATE public.questions q
SET program_id = p.id
FROM public.programs p
WHERE p.slug = 'toefl'
  AND q.kind = 'toefl'
  AND q.program_id IS NULL;

-- =============================================================================
-- 3. DESAFÍOS SIN LÍNEA → Estándar
-- =============================================================================
UPDATE public.challenges c
SET program_id = p.id
FROM public.programs p
WHERE p.slug = 'estandar'
  AND c.program_id IS NULL;

-- =============================================================================
-- FIN DE MIGRACION 039
-- =============================================================================
