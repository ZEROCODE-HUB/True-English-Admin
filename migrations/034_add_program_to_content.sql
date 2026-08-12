-- Migration: 034_add_program_to_content.sql
-- Purpose: Asocia el contenido existente al programa "Estándar".
-- Agrega columna program_id a lessons, ai_topics, questions, challenges,
-- ai_conversations y profiles.
-- Seedea el programa Estándar con niveles A1-C2 y config de puntos.

-- =============================================================================
-- 1. AGREGAR COLUMNA program_id A LAS TABLAS DE CONTENIDO
-- =============================================================================
ALTER TABLE public.lessons
  ADD COLUMN IF NOT EXISTS program_id UUID REFERENCES public.programs(id) ON DELETE SET NULL;

ALTER TABLE public.ai_topics
  ADD COLUMN IF NOT EXISTS program_id UUID REFERENCES public.programs(id) ON DELETE SET NULL;

ALTER TABLE public.questions
  ADD COLUMN IF NOT EXISTS program_id UUID REFERENCES public.programs(id) ON DELETE SET NULL;

ALTER TABLE public.challenges
  ADD COLUMN IF NOT EXISTS program_id UUID REFERENCES public.programs(id) ON DELETE SET NULL;

ALTER TABLE public.ai_conversations
  ADD COLUMN IF NOT EXISTS program_id UUID REFERENCES public.programs(id) ON DELETE SET NULL;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS program_id UUID REFERENCES public.programs(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_lessons_program ON public.lessons(program_id);
CREATE INDEX IF NOT EXISTS idx_ai_topics_program ON public.ai_topics(program_id);
CREATE INDEX IF NOT EXISTS idx_questions_program ON public.questions(program_id);
CREATE INDEX IF NOT EXISTS idx_challenges_program ON public.challenges(program_id);
CREATE INDEX IF NOT EXISTS idx_ai_conversations_program ON public.ai_conversations(program_id);
CREATE INDEX IF NOT EXISTS idx_profiles_program ON public.profiles(program_id);

-- =============================================================================
-- 2. SEED: PROGRAMA ESTANDAR
-- =============================================================================
INSERT INTO public.programs (name, slug, description, has_level_progression, sort_order)
VALUES ('Estándar', 'estandar', 'Ruta estándar del Marco Común Europeo (A1-C2)', true, 0)
ON CONFLICT (slug) DO NOTHING;

-- =============================================================================
-- 3. MIGRAR CONTENIDO EXISTENTE AL PROGRAMA ESTANDAR
-- =============================================================================
UPDATE public.lessons l
SET program_id = p.id
FROM public.programs p
WHERE p.slug = 'estandar' AND l.program_id IS NULL;

UPDATE public.ai_topics t
SET program_id = p.id
FROM public.programs p
WHERE p.slug = 'estandar' AND t.program_id IS NULL;

UPDATE public.questions q
SET program_id = p.id
FROM public.programs p
WHERE p.slug = 'estandar' AND q.program_id IS NULL;

UPDATE public.challenges c
SET program_id = p.id
FROM public.programs p
WHERE p.slug = 'estandar' AND c.program_id IS NULL;

UPDATE public.ai_conversations ac
SET program_id = p.id
FROM public.programs p
WHERE p.slug = 'estandar' AND ac.program_id IS NULL;

UPDATE public.profiles pr
SET program_id = p.id
FROM public.programs p
WHERE p.slug = 'estandar' AND pr.program_id IS NULL;

-- =============================================================================
-- 4. NIVELES DEL PROGRAMA ESTANDAR (A1-C2)
-- =============================================================================
INSERT INTO public.program_levels (program_id, level, label, sort_order)
SELECT p.id, v.level, v.level, v.ord
FROM public.programs p
CROSS JOIN (VALUES ('A1', 0), ('A2', 1), ('B1', 2), ('B2', 3), ('C1', 4), ('C2', 5)) AS v(level, ord)
WHERE p.slug = 'estandar'
ON CONFLICT (program_id, level) DO NOTHING;

-- =============================================================================
-- 5. CONFIG DE PUNTOS REQUERIDOS (0 = sin requisito hasta configurar)
-- =============================================================================
INSERT INTO public.program_level_config (program_id, level, points_required)
SELECT p.id, v.level, 0
FROM public.programs p
CROSS JOIN (VALUES ('A1'), ('A2'), ('B1'), ('B2'), ('C1'), ('C2')) AS v(level)
WHERE p.slug = 'estandar'
ON CONFLICT (program_id, level) DO NOTHING;

-- =============================================================================
-- FIN DE MIGRACION 034
-- =============================================================================
