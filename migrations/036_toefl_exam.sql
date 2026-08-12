-- Migration: 036_toefl_exam.sql
-- Purpose: Soporte para el examen de práctica/simulacro TOEFL.
-- Agrega un nuevo valor 'toefl' al enum question_kind y crea la tabla
-- toefl_exam_config para definir el simulacro.

-- =============================================================================
-- 1. NUEVO VALOR EN ENUM question_kind
-- =============================================================================
ALTER TYPE public.question_kind ADD VALUE IF NOT EXISTS 'toefl';

-- =============================================================================
-- 2. TABLA toefl_exam_config
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.toefl_exam_config (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title            TEXT NOT NULL,
  duration_minutes INT NOT NULL DEFAULT 60,
  passing_score    INT NOT NULL DEFAULT 0,
  question_count   INT NOT NULL DEFAULT 0,
  active           BOOLEAN NOT NULL DEFAULT true,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_toefl_exam_config_updated_at
  BEFORE UPDATE ON public.toefl_exam_config
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =============================================================================
-- 3. RLS
-- =============================================================================
ALTER TABLE public.toefl_exam_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "toefl_exam_config_select_auth" ON public.toefl_exam_config;
CREATE POLICY "toefl_exam_config_select_auth"
  ON public.toefl_exam_config FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "toefl_exam_config_insert_admin" ON public.toefl_exam_config;
CREATE POLICY "toefl_exam_config_insert_admin"
  ON public.toefl_exam_config FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "toefl_exam_config_update_admin" ON public.toefl_exam_config;
CREATE POLICY "toefl_exam_config_update_admin"
  ON public.toefl_exam_config FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "toefl_exam_config_delete_admin" ON public.toefl_exam_config;
CREATE POLICY "toefl_exam_config_delete_admin"
  ON public.toefl_exam_config FOR DELETE TO authenticated
  USING (public.is_admin());

-- =============================================================================
-- FIN DE MIGRACION 036
-- =============================================================================
