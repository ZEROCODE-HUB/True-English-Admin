-- Migration: 025_add_sort_order_to_lessons.sql
-- Propósito: agregar sort_order a lessons para permitir reordenamiento manual desde el admin.

ALTER TABLE public.lessons
  ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0;

-- Inicializar respetando el orden de creación actual
WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at ASC) AS rn
  FROM public.lessons
)
UPDATE public.lessons
SET sort_order = ranked.rn
FROM ranked
WHERE lessons.id = ranked.id;

CREATE INDEX IF NOT EXISTS idx_lessons_sort_order ON lessons(sort_order);

-- Actualizar get_lessons para ordenar por sort_order ASC
CREATE OR REPLACE FUNCTION public.get_lessons(
  p_search TEXT DEFAULT '',
  p_level TEXT DEFAULT 'all',
  p_limit INT DEFAULT 20,
  p_offset INT DEFAULT 0
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
