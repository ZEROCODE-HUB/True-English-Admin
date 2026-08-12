-- Migration: 038_program_filter_and_rpcs.sql
-- Purpose: Multi-línea (Fase 2).
-- 1. get_lessons / get_ai_topics: nuevo parámetro p_program_id (TEXT, NULL = sin filtro)
--    para filtrar contenido por programa en SQL (NULL-safe, regla "NULL = Estándar").
-- 2. RPC advance_level(p_next_level): sube de nivel solo si existe en program_levels
--    de la línea y es monotónico (nunca retrocede).
-- 3. RPC complete_ai_conversation(p_ai_conv_id): otorga +1 punto exactamente una vez
--    por conversación (idempotente, patrón item_points_awarded).
-- PENDIENTE: get_lessons_with_progress (función del repo móvil) — agregar sección 4
-- cuando el equipo móvil comparta su DDL actual.

-- =============================================================================
-- 1. get_lessons: filtro por programa (p_program_id)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.get_lessons(
  p_search TEXT DEFAULT '',
  p_level TEXT DEFAULT 'all',
  p_limit INT DEFAULT 20,
  p_offset INT DEFAULT 0,
  p_program_id TEXT DEFAULT NULL
) RETURNS JSONB AS $$
  WITH filtered AS (
    SELECT *
    FROM lessons l
    WHERE
      (
        p_search IS NULL OR p_search = ''
        OR l.title ILIKE ('%' || p_search || '%')
        OR l.description ILIKE ('%' || p_search || '%')
      )
      AND (p_level IS NULL OR p_level = 'all' OR l.level::text = p_level)
      AND (
        p_program_id IS NULL
        OR l.program_id::text = p_program_id
        OR l.program_id = (SELECT p.id FROM public.programs p WHERE p.slug = p_program_id)
        OR (p_program_id = 'estandar' AND l.program_id IS NULL)
      )
  ),
  total AS (
    SELECT COUNT(*) AS cnt FROM filtered
  ),
  rows AS (
    SELECT jsonb_agg(row_to_json(t.*) :: jsonb) AS data
    FROM (
      SELECT
        l.id,
        l.title,
        l.description,
        l.level,
        l.mandatory,
        l.program_id,
        l.sort_order,
        l.created_at,
        l.updated_at,
        (SELECT COUNT(*) FROM notes n WHERE n.lesson_id = l.id) AS notes_count,
        (SELECT COUNT(*) FROM exercises e WHERE e.lesson_id = l.id) AS exercises_count
      FROM filtered l
      ORDER BY l.sort_order ASC
      LIMIT p_limit
      OFFSET p_offset
    ) t
  )
  SELECT jsonb_build_object(
    'total', (SELECT cnt FROM total),
    'data', COALESCE((SELECT data FROM rows), '[]'::jsonb)
  );
$$ LANGUAGE sql STABLE;

-- =============================================================================
-- 2. get_ai_topics: filtro por programa (p_program_id)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.get_ai_topics(
  p_level TEXT DEFAULT 'all',
  p_search TEXT DEFAULT '',
  p_limit INT DEFAULT 50,
  p_offset INT DEFAULT 0,
  p_program_id TEXT DEFAULT NULL
) RETURNS JSONB LANGUAGE sql STABLE AS $$
  WITH filtered AS (
    SELECT t.id, t.title, t.emoji, t.level, t.prompt, t.metadata, t.status, t.created_by, t.program_id, t.points, t.sort_order, t.visibility, t.created_at, t.updated_at
    FROM ai_topics t
    WHERE (p_level = 'all' OR t.level::text = p_level OR p_level IS NULL)
      AND (p_search IS NULL OR p_search = '' OR t.title ILIKE ('%' || p_search || '%'))
      AND t.status = 'active'
      AND (
        p_program_id IS NULL
        OR t.program_id::text = p_program_id
        OR t.program_id = (SELECT p.id FROM public.programs p WHERE p.slug = p_program_id)
        OR (p_program_id = 'estandar' AND t.program_id IS NULL)
      )
    ORDER BY t.sort_order ASC
    LIMIT p_limit OFFSET p_offset
  ),
  total AS (
    SELECT COUNT(*) AS cnt
    FROM ai_topics t
    WHERE (p_level = 'all' OR t.level::text = p_level OR p_level IS NULL)
      AND t.status = 'active'
      AND (p_search IS NULL OR p_search = '' OR t.title ILIKE ('%' || p_search || '%'))
      AND (
        p_program_id IS NULL
        OR t.program_id::text = p_program_id
        OR t.program_id = (SELECT p.id FROM public.programs p WHERE p.slug = p_program_id)
        OR (p_program_id = 'estandar' AND t.program_id IS NULL)
      )
  ),
  rows AS (SELECT jsonb_agg(row_to_json(t.*)::jsonb) AS data FROM filtered t)
  SELECT jsonb_build_object('total', (SELECT cnt FROM total), 'data', COALESCE((SELECT data FROM rows), '[]'::jsonb));
$$;

-- =============================================================================
-- 3. RPC advance_level(p_next_level)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.advance_level(p_next_level TEXT)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
declare
  v_uid uuid := auth.uid();
  v_program_id uuid;
  v_current_level text;
  v_current_sort int := 0;
  v_next_sort int;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  select program_id, nivel_actual into v_program_id, v_current_level
  from public.profiles
  where id = v_uid;

  if v_program_id is null then
    select id into v_program_id from public.programs where slug = 'estandar';
  end if;

  select sort_order into v_next_sort
  from public.program_levels
  where program_id = v_program_id and level = p_next_level;

  if not found then
    raise exception 'invalid level % for program %', p_next_level, v_program_id;
  end if;

  if v_current_level is not null then
    select sort_order into v_current_sort
    from public.program_levels
    where program_id = v_program_id and level = v_current_level;

    if found and v_next_sort < v_current_sort then
      raise exception 'cannot move backwards to level %', p_next_level;
    end if;
  end if;

  update public.profiles set nivel_actual = p_next_level where id = v_uid;

  return jsonb_build_object('ok', true, 'level', p_next_level);
end;
$$;

-- =============================================================================
-- 4. RPC complete_ai_conversation(p_ai_conv_id)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.complete_ai_conversation(p_ai_conv_id UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
declare
  v_uid uuid := auth.uid();
  v_awarded boolean := false;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  update public.ai_conversations
  set puntos = 1
  where id = p_ai_conv_id
    and profile_id = v_uid
    and coalesce(puntos, 0) = 0;

  if found then
    update public.profiles set puntos = coalesce(puntos, 0) + 1 where id = v_uid;
    v_awarded := true;
  end if;

  return jsonb_build_object('awarded', v_awarded);
end;
$$;

-- =============================================================================
-- 5. PENDIENTE: get_lessons_with_progress
--    Función del repo móvil (no existe en este repo ni en el dump remoto).
--    Agregar aquí (o en migración 039) el CREATE OR REPLACE con:
--      - parámetro p_program_id TEXT DEFAULT NULL
--      - filtro NULL-safe: p_program_id IS NULL OR l.program_id::text = p_program_id
--          OR l.program_id = (SELECT p.id FROM public.programs p WHERE p.slug = p_program_id)
--          OR (p_program_id = 'estandar' AND l.program_id IS NULL)
--      - campo program_id en las filas devueltas.
-- =============================================================================

-- =============================================================================
-- FIN DE MIGRACION 038
-- =============================================================================
