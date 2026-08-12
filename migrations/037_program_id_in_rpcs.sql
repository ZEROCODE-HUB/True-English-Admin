-- Migration: 037_program_id_in_rpcs.sql
-- Purpose: Incluye program_id en las RPCs existentes (get_lessons, get_lesson_detail,
-- get_ai_topics, get_ai_conversations_for_user, get_ai_conversation_detail)
-- para que el admin y la app móvil puedan filtrar contenido por línea/programa.

-- 1. get_lessons: agregar program_id a las filas devueltas
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

-- 2. get_lesson_detail: incluir program_id en el core de la lección
CREATE OR REPLACE FUNCTION public.get_lesson_detail(p_lesson_id UUID)
RETURNS JSONB AS $$
WITH lesson_core AS (
  SELECT id, title, description, level, mandatory, program_id, created_at, updated_at
  FROM lessons
  WHERE id = p_lesson_id
),
content_items AS (
  SELECT n."order" AS ord,
         jsonb_build_object(
           'id', n.id,
           'kind', 'note',
           'title', n.title,
           'content', n.content,
           'image_url', n.image_url,
           'audio_url', n.audio_url,
           'active', n.active,
           'order', n."order"
         ) AS item
  FROM notes n
  WHERE n.lesson_id = p_lesson_id

  UNION ALL

  SELECT e."order" AS ord,
         jsonb_build_object(
           'id', e.id,
           'kind', 'exercise',
           'title', e.description,
           'content', e.content,
           'image_url', e.image_url,
           'audio_url', e.audio_url,
           'mandatory', e.mandatory,
           'active', e.active,
           'order', e."order",
           'correct_option_id', e.correct_option_id,
           'options', COALESCE((
             SELECT jsonb_agg(jsonb_build_object('id', eo.id, 'text', eo.text, 'order', eo."order") ORDER BY eo."order")
             FROM exercise_options eo WHERE eo.exercise_id = e.id
           ), '[]'::jsonb)
         ) AS item
  FROM exercises e
  WHERE e.lesson_id = p_lesson_id
),
questions_list AS (
  SELECT q.id,
         q.title,
         q.kind,
         q.active,
         q.correct_option_id,
         q.content AS content,
         COALESCE(
           jsonb_agg(
             jsonb_build_object('id', qo.id, 'text', qo.text, 'order', qo."order")
             ORDER BY qo."order"
           ) FILTER (WHERE qo.id IS NOT NULL), '[]'::jsonb
         ) AS options
  FROM questions q
  LEFT JOIN question_options qo ON qo.question_id = q.id
  WHERE q.kind = 'lesson' AND q.lesson_id = p_lesson_id AND q.active = true
  GROUP BY q.id
)
SELECT jsonb_build_object(
  'lesson', (SELECT to_jsonb(lc) FROM lesson_core lc),
  'content', COALESCE((SELECT jsonb_agg(ci.item ORDER BY ci.ord) FROM content_items ci), '[]'::jsonb),
  'questions', COALESCE((SELECT jsonb_agg(
      jsonb_build_object(
        'id', ql.id,
        'title', ql.title,
        'kind', ql.kind,
        'active', ql.active,
        'content', ql.content,
        'correct_option_id', ql.correct_option_id,
        'options', ql.options
      ) ORDER BY ql.id
    ) FROM questions_list ql), '[]'::jsonb)
) AS full_payload;
$$ LANGUAGE sql STABLE;

-- 3. get_ai_topics: incluir program_id
CREATE OR REPLACE FUNCTION public.get_ai_topics(p_level TEXT DEFAULT 'all', p_search TEXT DEFAULT '', p_limit INT DEFAULT 50, p_offset INT DEFAULT 0)
RETURNS JSONB LANGUAGE sql STABLE AS $$
  WITH filtered AS (
    SELECT t.id, t.title, t.emoji, t.level, t.prompt, t.metadata, t.status, t.created_by, t.program_id, t.points, t.sort_order, t.visibility, t.created_at, t.updated_at
    FROM ai_topics t
    WHERE (p_level = 'all' OR t.level::text = p_level OR p_level IS NULL)
      AND (p_search IS NULL OR p_search = '' OR t.title ILIKE ('%' || p_search || '%'))
      AND t.status = 'active'
    ORDER BY t.sort_order ASC
    LIMIT p_limit OFFSET p_offset
  ),
  total AS (SELECT COUNT(*) AS cnt FROM ai_topics t WHERE (p_level = 'all' OR t.level::text = p_level OR p_level IS NULL) AND t.status = 'active' AND (p_search IS NULL OR p_search = '' OR t.title ILIKE ('%' || p_search || '%'))),
  rows AS (SELECT jsonb_agg(row_to_json(t.*)::jsonb) AS data FROM filtered t)
  SELECT jsonb_build_object('total', (SELECT cnt FROM total), 'data', COALESCE((SELECT data FROM rows), '[]'::jsonb));
$$;

-- 4. get_ai_conversations_for_user: incluir program_id
CREATE OR REPLACE FUNCTION public.get_ai_conversations_for_user(p_profile_id UUID, p_limit INT DEFAULT 50, p_offset INT DEFAULT 0)
RETURNS JSONB LANGUAGE sql STABLE AS $$
  WITH convs AS (
    SELECT * FROM ai_conversations ac WHERE ac.profile_id = p_profile_id ORDER BY ac.started_at DESC LIMIT p_limit OFFSET p_offset
  ),
  total AS (SELECT COUNT(*) AS cnt FROM ai_conversations ac WHERE ac.profile_id = p_profile_id),
  rows AS (
    SELECT jsonb_agg(row_to_json(t.*)::jsonb) AS data
    FROM (
      SELECT ac.id, ac.topic_id, ac.profile_id, ac.level, ac.program_id, ac.puntos, ac.started_at, ac.last_message_at, ac.metadata,
        (SELECT jsonb_build_object('grammar', AVG(s.grammar), 'fluency', AVG(s.fluency), 'orthography', AVG(s.orthography), 'total', AVG(s.total)) FROM ai_conversation_scores s WHERE s.ai_conversation_id = ac.id) AS score_summary
      FROM convs ac
    ) t
  )
  SELECT jsonb_build_object('total', (SELECT cnt FROM total), 'data', COALESCE((SELECT data FROM rows), '[]'::jsonb));
$$;

-- =============================================================================
-- FIN DE MIGRACION 037
-- =============================================================================
