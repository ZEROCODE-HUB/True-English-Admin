-- Migration: 024_add_sort_order_to_ai_topics.sql
-- Propósito: agregar columna sort_order a ai_topics para permitir reordenamiento manual
-- desde el panel de administración.

ALTER TABLE public.ai_topics
  ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0;

-- Inicializar sort_order conservando el orden de creación actual (más antiguo = menor número)
WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at ASC) AS rn
  FROM public.ai_topics
)
UPDATE public.ai_topics
SET sort_order = ranked.rn
FROM ranked
WHERE ai_topics.id = ranked.id;

CREATE INDEX IF NOT EXISTS idx_ai_topics_sort_order ON ai_topics(sort_order);

-- Actualizar la función RPC get_ai_topics para ordenar por sort_order ASC
CREATE OR REPLACE FUNCTION public.get_ai_topics(
  p_level TEXT DEFAULT 'all',
  p_search TEXT DEFAULT '',
  p_limit INT DEFAULT 50,
  p_offset INT DEFAULT 0
)
RETURNS JSONB LANGUAGE sql STABLE AS $$
  WITH filtered AS (
    SELECT * FROM ai_topics t
    WHERE (p_level = 'all' OR t.level::text = p_level OR p_level IS NULL)
      AND (p_search IS NULL OR p_search = '' OR t.title ILIKE ('%' || p_search || '%'))
      AND t.status = 'active'
    ORDER BY t.sort_order ASC
    LIMIT p_limit OFFSET p_offset
  ),
  total AS (
    SELECT COUNT(*) AS cnt FROM ai_topics t
    WHERE (p_level = 'all' OR t.level::text = p_level OR p_level IS NULL)
      AND t.status = 'active'
      AND (p_search IS NULL OR p_search = '' OR t.title ILIKE ('%' || p_search || '%'))
  ),
  rows AS (SELECT jsonb_agg(row_to_json(t.*)::jsonb) AS data FROM filtered t)
  SELECT jsonb_build_object(
    'total', (SELECT cnt FROM total),
    'data', COALESCE((SELECT data FROM rows), '[]'::jsonb)
  );
$$;
