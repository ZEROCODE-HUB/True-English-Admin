-- Migration: 030_enterprise_schema.sql
-- Purpose: Sistema de empresas y areas organizacionales.
-- Crea tablas: companies, areas, company_memberships, lesson_assignments.
-- Agrega columna visibility a lessons.
-- Incluye: RLS policies, triggers, indices, y RPCs para el admin panel.

-- =============================================================================
-- 1. TABLA companies
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.companies (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  slug       TEXT NOT NULL UNIQUE,
  active     BOOLEAN NOT NULL DEFAULT true,
  metadata   JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_companies_slug ON public.companies(slug);
CREATE INDEX IF NOT EXISTS idx_companies_active ON public.companies(active);

CREATE TRIGGER trg_companies_updated_at
  BEFORE UPDATE ON public.companies
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =============================================================================
-- 2. TABLA areas
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.areas (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  active     BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(company_id, name)
);

CREATE INDEX IF NOT EXISTS idx_areas_company ON public.areas(company_id);

CREATE TRIGGER trg_areas_updated_at
  BEFORE UPDATE ON public.areas
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =============================================================================
-- 3. TABLA company_memberships
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.company_memberships (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  area_id    UUID REFERENCES public.areas(id) ON DELETE SET NULL,
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  active     BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(company_id, area_id, profile_id)
);

CREATE INDEX IF NOT EXISTS idx_memberships_company ON public.company_memberships(company_id);
CREATE INDEX IF NOT EXISTS idx_memberships_area ON public.company_memberships(area_id);
CREATE INDEX IF NOT EXISTS idx_memberships_profile ON public.company_memberships(profile_id);
CREATE INDEX IF NOT EXISTS idx_memberships_company_profile ON public.company_memberships(company_id, profile_id);

-- =============================================================================
-- 4. TABLA lesson_assignments
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.lesson_assignments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id   UUID NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
  company_id  UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  area_id     UUID REFERENCES public.areas(id) ON DELETE CASCADE,
  assigned_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(lesson_id, company_id, area_id)
);

CREATE INDEX IF NOT EXISTS idx_lesson_assignments_lesson ON public.lesson_assignments(lesson_id);
CREATE INDEX IF NOT EXISTS idx_lesson_assignments_company ON public.lesson_assignments(company_id);
CREATE INDEX IF NOT EXISTS idx_lesson_assignments_area ON public.lesson_assignments(area_id);
CREATE INDEX IF NOT EXISTS idx_lesson_assignments_company_area ON public.lesson_assignments(company_id, area_id);

-- =============================================================================
-- 5. ALTER lessons — agregar visibility
-- =============================================================================
ALTER TABLE public.lessons
  ADD COLUMN IF NOT EXISTS visibility TEXT NOT NULL DEFAULT 'public';

CREATE INDEX IF NOT EXISTS idx_lessons_visibility ON public.lessons(visibility);

-- =============================================================================
-- 6. ROW LEVEL SECURITY (RLS)
-- =============================================================================

-- 6.1 companies
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "companies_select_auth" ON public.companies;
CREATE POLICY "companies_select_auth"
  ON public.companies FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "companies_insert_admin" ON public.companies;
CREATE POLICY "companies_insert_admin"
  ON public.companies FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "companies_update_admin" ON public.companies;
CREATE POLICY "companies_update_admin"
  ON public.companies FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "companies_delete_admin" ON public.companies;
CREATE POLICY "companies_delete_admin"
  ON public.companies FOR DELETE TO authenticated
  USING (public.is_admin());

-- 6.2 areas
ALTER TABLE public.areas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "areas_select_auth" ON public.areas;
CREATE POLICY "areas_select_auth"
  ON public.areas FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "areas_insert_admin" ON public.areas;
CREATE POLICY "areas_insert_admin"
  ON public.areas FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "areas_update_admin" ON public.areas;
CREATE POLICY "areas_update_admin"
  ON public.areas FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "areas_delete_admin" ON public.areas;
CREATE POLICY "areas_delete_admin"
  ON public.areas FOR DELETE TO authenticated
  USING (public.is_admin());

-- 6.3 company_memberships
ALTER TABLE public.company_memberships ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "memberships_select_admin" ON public.company_memberships;
CREATE POLICY "memberships_select_admin"
  ON public.company_memberships FOR SELECT TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "memberships_select_own" ON public.company_memberships;
CREATE POLICY "memberships_select_own"
  ON public.company_memberships FOR SELECT TO authenticated
  USING (profile_id = auth.uid());

DROP POLICY IF EXISTS "memberships_insert_admin" ON public.company_memberships;
CREATE POLICY "memberships_insert_admin"
  ON public.company_memberships FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "memberships_update_admin" ON public.company_memberships;
CREATE POLICY "memberships_update_admin"
  ON public.company_memberships FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "memberships_delete_admin" ON public.company_memberships;
CREATE POLICY "memberships_delete_admin"
  ON public.company_memberships FOR DELETE TO authenticated
  USING (public.is_admin());

-- 6.4 lesson_assignments
ALTER TABLE public.lesson_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "lesson_assignments_select_auth" ON public.lesson_assignments;
CREATE POLICY "lesson_assignments_select_auth"
  ON public.lesson_assignments FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "lesson_assignments_insert_admin" ON public.lesson_assignments;
CREATE POLICY "lesson_assignments_insert_admin"
  ON public.lesson_assignments FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "lesson_assignments_delete_admin" ON public.lesson_assignments;
CREATE POLICY "lesson_assignments_delete_admin"
  ON public.lesson_assignments FOR DELETE TO authenticated
  USING (public.is_admin());

-- =============================================================================
-- 7. RPCs PARA EL ADMIN PANEL
-- =============================================================================

-- 7.1 get_companies: lista de empresas con conteos
CREATE OR REPLACE FUNCTION public.get_companies(
  p_search TEXT DEFAULT '',
  p_active TEXT DEFAULT 'all',
  p_limit INT DEFAULT 50,
  p_offset INT DEFAULT 0
) RETURNS JSONB
LANGUAGE sql STABLE
SET search_path = public
AS $$
  WITH filtered AS (
    SELECT
      c.id,
      c.name,
      c.slug,
      c.active,
      c.created_at,
      c.updated_at,
      (SELECT COUNT(*) FROM public.company_memberships cm WHERE cm.company_id = c.id AND cm.active = true) AS member_count,
      (SELECT COUNT(*) FROM public.areas a WHERE a.company_id = c.id AND a.active = true) AS area_count,
      (SELECT COUNT(*) FROM public.lesson_assignments la WHERE la.company_id = c.id) AS lesson_count
    FROM public.companies c
    WHERE
      (p_search IS NULL OR p_search = '' OR c.name ILIKE ('%' || p_search || '%') OR c.slug ILIKE ('%' || p_search || '%'))
      AND (p_active IS NULL OR p_active = 'all' OR c.active::text = p_active)
  ),
  total AS (
    SELECT COUNT(*) AS cnt FROM filtered
  ),
  rows AS (
    SELECT jsonb_agg(row_to_json(f.*)::jsonb ORDER BY f.created_at DESC) AS data
    FROM (SELECT * FROM filtered LIMIT p_limit OFFSET p_offset) f
  )
  SELECT jsonb_build_object(
    'total', (SELECT cnt FROM total),
    'data', COALESCE((SELECT data FROM rows), '[]'::jsonb)
  );
$$;

GRANT EXECUTE ON FUNCTION public.get_companies(text, text, int, int) TO authenticated;

-- 7.2 get_company_areas: areas de una empresa con conteo de miembros
CREATE OR REPLACE FUNCTION public.get_company_areas(
  p_company_id UUID,
  p_search TEXT DEFAULT '',
  p_limit INT DEFAULT 50,
  p_offset INT DEFAULT 0
) RETURNS JSONB
LANGUAGE sql STABLE
SET search_path = public
AS $$
  WITH filtered AS (
    SELECT
      a.id,
      a.company_id,
      a.name,
      a.active,
      a.created_at,
      a.updated_at,
      (SELECT COUNT(*) FROM public.company_memberships cm WHERE cm.area_id = a.id AND cm.active = true) AS member_count,
      (SELECT COUNT(*) FROM public.lesson_assignments la WHERE la.area_id = a.id) AS lesson_count
    FROM public.areas a
    WHERE
      a.company_id = p_company_id
      AND (p_search IS NULL OR p_search = '' OR a.name ILIKE ('%' || p_search || '%'))
  ),
  total AS (
    SELECT COUNT(*) AS cnt FROM filtered
  ),
  rows AS (
    SELECT jsonb_agg(row_to_json(f.*)::jsonb ORDER BY f.created_at DESC) AS data
    FROM (SELECT * FROM filtered LIMIT p_limit OFFSET p_offset) f
  )
  SELECT jsonb_build_object(
    'total', (SELECT cnt FROM total),
    'data', COALESCE((SELECT data FROM rows), '[]'::jsonb)
  );
$$;

GRANT EXECUTE ON FUNCTION public.get_company_areas(uuid, text, int, int) TO authenticated;

-- 7.3 get_company_members: miembros de una empresa/area
CREATE OR REPLACE FUNCTION public.get_company_members(
  p_company_id UUID,
  p_area_id UUID DEFAULT NULL,
  p_search TEXT DEFAULT '',
  p_limit INT DEFAULT 50,
  p_offset INT DEFAULT 0
) RETURNS JSONB
LANGUAGE sql STABLE
SET search_path = public
AS $$
  WITH filtered AS (
    SELECT
      cm.id,
      cm.company_id,
      cm.area_id,
      cm.profile_id,
      cm.active,
      cm.created_at,
      p.name AS profile_name,
      p.last_name AS profile_last_name,
      p.email AS profile_email,
      a.name AS area_name
    FROM public.company_memberships cm
    JOIN public.profiles p ON p.id = cm.profile_id
    LEFT JOIN public.areas a ON a.id = cm.area_id
    WHERE
      cm.company_id = p_company_id
      AND (p_area_id IS NULL OR cm.area_id = p_area_id)
      AND (
        p_search IS NULL OR p_search = ''
        OR p.name ILIKE ('%' || p_search || '%')
        OR p.last_name ILIKE ('%' || p_search || '%')
        OR p.email ILIKE ('%' || p_search || '%')
      )
  ),
  total AS (
    SELECT COUNT(*) AS cnt FROM filtered
  ),
  rows AS (
    SELECT jsonb_agg(row_to_json(f.*)::jsonb ORDER BY f.created_at DESC) AS data
    FROM (SELECT * FROM filtered LIMIT p_limit OFFSET p_offset) f
  )
  SELECT jsonb_build_object(
    'total', (SELECT cnt FROM total),
    'data', COALESCE((SELECT data FROM rows), '[]'::jsonb)
  );
$$;

GRANT EXECUTE ON FUNCTION public.get_company_members(uuid, uuid, text, int, int) TO authenticated;

-- 7.4 get_company_stats: estadisticas de una empresa
CREATE OR REPLACE FUNCTION public.get_company_stats(
  p_company_id UUID
) RETURNS JSONB
LANGUAGE sql STABLE
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'total_members', (
      SELECT COUNT(*) FROM public.company_memberships cm
      WHERE cm.company_id = p_company_id AND cm.active = true
    ),
    'total_areas', (
      SELECT COUNT(*) FROM public.areas a
      WHERE a.company_id = p_company_id AND a.active = true
    ),
    'total_lessons_assigned', (
      SELECT COUNT(*) FROM public.lesson_assignments la
      WHERE la.company_id = p_company_id
    ),
    'members_by_area', (
      SELECT COALESCE(jsonb_agg(row_to_json(sub.*)::jsonb), '[]'::jsonb)
      FROM (
        SELECT
          a.id AS area_id,
          a.name AS area_name,
          COUNT(cm.id) FILTER (WHERE cm.active = true) AS member_count
        FROM public.areas a
        LEFT JOIN public.company_memberships cm ON cm.area_id = a.id
        WHERE a.company_id = p_company_id
        GROUP BY a.id, a.name
        ORDER BY member_count DESC
      ) sub
    ),
    'lessons_by_area', (
      SELECT COALESCE(jsonb_agg(row_to_json(sub.*)::jsonb), '[]'::jsonb)
      FROM (
        SELECT
          a.id AS area_id,
          a.name AS area_name,
          COUNT(la.id) AS lesson_count
        FROM public.areas a
        LEFT JOIN public.lesson_assignments la ON la.area_id = a.id
        WHERE a.company_id = p_company_id
        GROUP BY a.id, a.name
        ORDER BY lesson_count DESC
      ) sub
    ),
    'progress_summary', (
      SELECT COALESCE(jsonb_build_object(
        'total_enrollments', COUNT(e.id),
        'completed', COUNT(e.id) FILTER (WHERE e.status = 'completed'),
        'in_progress', COUNT(e.id) FILTER (WHERE e.status = 'in-progress'),
        'avg_completion_pct', CASE
          WHEN COUNT(e.id) > 0 THEN ROUND(COUNT(e.id) FILTER (WHERE e.status = 'completed')::numeric / COUNT(e.id) * 100)
          ELSE 0
        END
      ), jsonb_build_object('total_enrollments', 0, 'completed', 0, 'in_progress', 0, 'avg_completion_pct', 0))
      FROM public.company_memberships cm
      JOIN public.profiles p ON p.id = cm.profile_id
      LEFT JOIN public.enrollments e ON e.profile_id = p.id
      WHERE cm.company_id = p_company_id AND cm.active = true
    )
  );
$$;

GRANT EXECUTE ON FUNCTION public.get_company_stats(uuid) TO authenticated;

-- =============================================================================
-- FIN DE MIGRACION 030
-- =============================================================================
