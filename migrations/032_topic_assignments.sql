-- Migration: 032_topic_assignments.sql
-- Purpose: Create topic_assignments table (same pattern as lesson_assignments)
-- for assigning AI conversation topics to specific companies/areas.

-- 1. TABLA topic_assignments
CREATE TABLE IF NOT EXISTS public.topic_assignments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id    UUID NOT NULL REFERENCES public.ai_topics(id) ON DELETE CASCADE,
  company_id  UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  area_id     UUID REFERENCES public.areas(id) ON DELETE CASCADE,
  assigned_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(topic_id, company_id, area_id)
);

CREATE INDEX IF NOT EXISTS idx_topic_assignments_topic ON public.topic_assignments(topic_id);
CREATE INDEX IF NOT EXISTS idx_topic_assignments_company ON public.topic_assignments(company_id);
CREATE INDEX IF NOT EXISTS idx_topic_assignments_area ON public.topic_assignments(area_id);
CREATE INDEX IF NOT EXISTS idx_topic_assignments_company_area ON public.topic_assignments(company_id, area_id);

-- 2. ALTER ai_topics — agregar visibility
ALTER TABLE public.ai_topics
  ADD COLUMN IF NOT EXISTS visibility TEXT NOT NULL DEFAULT 'public';

CREATE INDEX IF NOT EXISTS idx_ai_topics_visibility ON public.ai_topics(visibility);

-- 3. RLS
ALTER TABLE public.topic_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "topic_assignments_select_auth" ON public.topic_assignments;
CREATE POLICY "topic_assignments_select_auth"
  ON public.topic_assignments FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "topic_assignments_insert_admin" ON public.topic_assignments;
CREATE POLICY "topic_assignments_insert_admin"
  ON public.topic_assignments FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "topic_assignments_delete_admin" ON public.topic_assignments;
CREATE POLICY "topic_assignments_delete_admin"
  ON public.topic_assignments FOR DELETE TO authenticated
  USING (public.is_admin());
