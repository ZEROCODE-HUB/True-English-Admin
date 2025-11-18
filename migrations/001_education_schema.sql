-- Migration: 001_education_schema.sql
-- Purpose: create lessons/notes/exercises/questions/challenges schema
-- Assumes a pre-existing `public.profiles` table (auth users are managed in auth.users)

-- Enable pgcrypto for UUID generation
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Reusable trigger function to update updated_at timestamp
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Enum type for lesson levels
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'lesson_level') THEN
    CREATE TYPE lesson_level AS ENUM ('A1','A2','B1','B2','C1','C2');
  END IF;
END $$;

-- Enum for question kinds
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'question_kind') THEN
    CREATE TYPE question_kind AS ENUM ('onboarding','level','lesson','challenge');
  END IF;
END $$;

-- Lessons
CREATE TABLE IF NOT EXISTS lessons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  level lesson_level NOT NULL,
  mandatory BOOLEAN NOT NULL DEFAULT FALSE,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lessons_level ON lessons(level);

-- Notes: content pieces belonging to a lesson
CREATE TABLE IF NOT EXISTS notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id UUID NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT,
  image_url TEXT NULL,
  audio_url TEXT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  "order" INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notes_lesson_order ON notes(lesson_id, "order");

-- Exercises: activities within a lesson
CREATE TABLE IF NOT EXISTS exercises (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id UUID NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  type TEXT NOT NULL,
  content TEXT,
  image_url TEXT NULL,
  audio_url TEXT NULL,
  mandatory BOOLEAN NOT NULL DEFAULT FALSE,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  "order" INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  correct_option_id UUID NULL
);

CREATE INDEX IF NOT EXISTS idx_exercises_lesson_order ON exercises(lesson_id, "order");

-- Exercise options
CREATE TABLE IF NOT EXISTS exercise_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exercise_id UUID NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  "order" INTEGER NOT NULL DEFAULT 0
);

-- Add a FK from exercises.correct_option_id -> exercise_options.id
ALTER TABLE exercises
  ADD CONSTRAINT fk_exercises_correct_option
  FOREIGN KEY (correct_option_id) REFERENCES exercise_options(id) ON DELETE SET NULL;

-- Questions: general bank (onboarding, level, lesson, challenge)
CREATE TABLE IF NOT EXISTS questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind question_kind NOT NULL,
  lesson_id UUID NULL REFERENCES lessons(id) ON DELETE CASCADE,
  challenge_id UUID NULL,
  level lesson_level NULL,
  title TEXT NOT NULL,
  content JSONB DEFAULT '{}'::jsonb,
  image_url TEXT NULL,
  audio_url TEXT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  include_in_test BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  correct_option_id UUID NULL
);

CREATE INDEX IF NOT EXISTS idx_questions_kind_lesson ON questions(kind, lesson_id);

-- Question options
CREATE TABLE IF NOT EXISTS question_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  "order" INTEGER NOT NULL DEFAULT 0
);

-- Add FK from questions.correct_option_id -> question_options.id
ALTER TABLE questions
  ADD CONSTRAINT fk_questions_correct_option
  FOREIGN KEY (correct_option_id) REFERENCES question_options(id) ON DELETE SET NULL;

-- Challenges
CREATE TABLE IF NOT EXISTS challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  level lesson_level NOT NULL,
  lesson_id UUID NULL REFERENCES lessons(id) ON DELETE SET NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Profiles are used as users (existing table). Use profiles.id for FK references.

-- Enrollments: user progress / membership for a lesson
CREATE TABLE IF NOT EXISTS enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  lesson_id UUID NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'in-progress',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (profile_id, lesson_id)
);

CREATE INDEX IF NOT EXISTS idx_enrollments_profile ON enrollments(profile_id);

-- Attempts: store answers/results for analytics
CREATE TABLE IF NOT EXISTS attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  lesson_id UUID NULL REFERENCES lessons(id) ON DELETE CASCADE,
  question_id UUID NULL REFERENCES questions(id) ON DELETE SET NULL,
  payload JSONB NOT NULL,
  score NUMERIC NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_attempts_profile ON attempts(profile_id);

-- Triggers to update updated_at on change
CREATE TRIGGER trg_lessons_updated_at BEFORE UPDATE ON lessons FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_notes_updated_at BEFORE UPDATE ON notes FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_exercises_updated_at BEFORE UPDATE ON exercises FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_questions_updated_at BEFORE UPDATE ON questions FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_challenges_updated_at BEFORE UPDATE ON challenges FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_enrollments_updated_at BEFORE UPDATE ON enrollments FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Full-text index helper (optional) for search on lessons
CREATE INDEX IF NOT EXISTS idx_lessons_search ON lessons USING gin (to_tsvector('spanish', title || ' ' || coalesce(description, '')));



-- -----------------------------------------------------------------------------
-- Supabase-ready helper functions (RPC) for course management
-- 1) get_lessons: paginated list with counts for notes/exercises
-- 2) get_lesson_detail: full lesson payload with mixed content and nested options
-- -----------------------------------------------------------------------------

-- 1) get_lessons: devuelve { total, data: [ {lesson fields..., notes_count, exercises_count } ] }
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
        l.created_at,
        l.updated_at,
        (SELECT COUNT(*) FROM notes n WHERE n.lesson_id = l.id) AS notes_count,
        (SELECT COUNT(*) FROM exercises e WHERE e.lesson_id = l.id) AS exercises_count
      FROM filtered l
      ORDER BY l.created_at DESC
      LIMIT p_limit
      OFFSET p_offset
    ) t
  )
  SELECT jsonb_build_object(
    'total', (SELECT cnt FROM total),
    'data', COALESCE((SELECT data FROM rows), '[]'::jsonb)
  );
$$ LANGUAGE sql STABLE;

-- 2) get_lesson_detail: devuelve un json con lesson core, content (notes+exercises ordered), and questions
CREATE OR REPLACE FUNCTION public.get_lesson_detail(p_lesson_id UUID)
RETURNS JSONB AS $$
WITH lesson_core AS (
  SELECT id, title, description, level, mandatory, created_at, updated_at
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

