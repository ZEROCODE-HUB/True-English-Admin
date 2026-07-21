-- Migration: 031_fix_enterprise_rpcs.sql
-- Purpose: Corregir RPCs del sistema enterprise.
-- 1. Agregar SECURITY DEFINER a get_company_members y get_company_areas
-- 2. Mejorar busqueda en get_company_members: buscar nombre + apellido combinado

-- =============================================================================
-- 1. get_company_members: SECURITY DEFINER + busqueda mejorada
-- =============================================================================
CREATE OR REPLACE FUNCTION public.get_company_members(
  p_company_id UUID,
  p_area_id UUID DEFAULT NULL,
  p_search TEXT DEFAULT '',
  p_limit INT DEFAULT 50,
  p_offset INT DEFAULT 0
) RETURNS JSONB
LANGUAGE sql STABLE
SECURITY DEFINER
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
        OR (p.name || ' ' || p.last_name) ILIKE ('%' || p_search || '%')
        OR (p.last_name || ' ' || p.name) ILIKE ('%' || p_search || '%')
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

-- =============================================================================
-- 2. get_company_areas: SECURITY DEFINER
-- =============================================================================
CREATE OR REPLACE FUNCTION public.get_company_areas(
  p_company_id UUID,
  p_search TEXT DEFAULT '',
  p_limit INT DEFAULT 50,
  p_offset INT DEFAULT 0
) RETURNS JSONB
LANGUAGE sql STABLE
SECURITY DEFINER
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

-- =============================================================================
-- FIN DE MIGRACION 031
-- =============================================================================
