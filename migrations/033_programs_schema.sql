-- Migration: 033_programs_schema.sql
-- Purpose: Sistema de programas/líneas (Estándar, Kids, TOEFL).
-- Crea tablas: programs, program_levels, program_level_config.
-- Incluye: RLS policies e indices.

-- =============================================================================
-- 1. TABLA programs (líneas de aprendizaje)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.programs (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  slug       TEXT NOT NULL UNIQUE,
  description TEXT,
  has_level_progression BOOLEAN NOT NULL DEFAULT true,
  active     BOOLEAN NOT NULL DEFAULT true,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_programs_slug ON public.programs(slug);
CREATE INDEX IF NOT EXISTS idx_programs_active ON public.programs(active);

CREATE TRIGGER trg_programs_updated_at
  BEFORE UPDATE ON public.programs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =============================================================================
-- 2. TABLA program_levels (niveles de cada programa)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.program_levels (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id UUID NOT NULL REFERENCES public.programs(id) ON DELETE CASCADE,
  level      TEXT NOT NULL,
  label      TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(program_id, level)
);

CREATE INDEX IF NOT EXISTS idx_program_levels_program ON public.program_levels(program_id);

-- =============================================================================
-- 3. TABLA program_level_config (puntos requeridos por nivel por programa)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.program_level_config (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id     UUID NOT NULL REFERENCES public.programs(id) ON DELETE CASCADE,
  level          TEXT NOT NULL,
  points_required INT NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(program_id, level)
);

CREATE INDEX IF NOT EXISTS idx_program_level_config_program ON public.program_level_config(program_id);

CREATE TRIGGER trg_program_level_config_updated_at
  BEFORE UPDATE ON public.program_level_config
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =============================================================================
-- 4. ROW LEVEL SECURITY (RLS)
-- =============================================================================
ALTER TABLE public.programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.program_levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.program_level_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "programs_select_auth" ON public.programs;
CREATE POLICY "programs_select_auth"
  ON public.programs FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "programs_insert_admin" ON public.programs;
CREATE POLICY "programs_insert_admin"
  ON public.programs FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "programs_update_admin" ON public.programs;
CREATE POLICY "programs_update_admin"
  ON public.programs FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "programs_delete_admin" ON public.programs;
CREATE POLICY "programs_delete_admin"
  ON public.programs FOR DELETE TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "program_levels_select_auth" ON public.program_levels;
CREATE POLICY "program_levels_select_auth"
  ON public.program_levels FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "program_levels_insert_admin" ON public.program_levels;
CREATE POLICY "program_levels_insert_admin"
  ON public.program_levels FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "program_levels_update_admin" ON public.program_levels;
CREATE POLICY "program_levels_update_admin"
  ON public.program_levels FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "program_levels_delete_admin" ON public.program_levels;
CREATE POLICY "program_levels_delete_admin"
  ON public.program_levels FOR DELETE TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "program_level_config_select_auth" ON public.program_level_config;
CREATE POLICY "program_level_config_select_auth"
  ON public.program_level_config FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "program_level_config_insert_admin" ON public.program_level_config;
CREATE POLICY "program_level_config_insert_admin"
  ON public.program_level_config FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "program_level_config_update_admin" ON public.program_level_config;
CREATE POLICY "program_level_config_update_admin"
  ON public.program_level_config FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "program_level_config_delete_admin" ON public.program_level_config;
CREATE POLICY "program_level_config_delete_admin"
  ON public.program_level_config FOR DELETE TO authenticated
  USING (public.is_admin());

-- =============================================================================
-- FIN DE MIGRACION 033
-- =============================================================================
