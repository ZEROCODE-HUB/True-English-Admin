-- Migration: 011_quizzes_schema.sql
-- Propósito: corrección mínima para el módulo de Quizzes/Desafíos.
-- Se limita a garantizar la integridad referencial entre `questions` y `challenges`.

-- NOTA: la migración 001 ya crea las tablas principales usadas por este módulo
-- (`lessons`, `questions`, `question_options`, `challenges`, `exercises`, etc.).
-- Por tanto esta migración NO crea tablas nuevas.

-- Asegurar FK: questions.challenge_id -> challenges.id
-- Seguridad adicional: verificar que la tabla `questions` y la columna
-- `challenge_id` existan, y que no haya filas huérfanas antes de crear la FK.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'questions')
     AND EXISTS (
       SELECT 1 FROM information_schema.columns
       WHERE table_name = 'questions' AND column_name = 'challenge_id'
     ) THEN

    -- No crear la constraint si ya existe
    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint c
      JOIN pg_class t ON c.conrelid = t.oid
      WHERE c.conname = 'fk_questions_challenge' AND t.relname = 'questions'
    ) THEN

      -- Comprobar que no existen preguntas con challenge_id que apunten a un challenge inexistente
      IF NOT EXISTS (
        SELECT 1 FROM questions q
        WHERE q.challenge_id IS NOT NULL
          AND NOT EXISTS (SELECT 1 FROM challenges c WHERE c.id = q.challenge_id)
      ) THEN
        ALTER TABLE questions
          ADD CONSTRAINT fk_questions_challenge
          FOREIGN KEY (challenge_id) REFERENCES challenges(id) ON DELETE CASCADE;
      ELSE
        RAISE NOTICE 'No se crea fk_questions_challenge: existen preguntas con challenge_id que no tienen challenge asociado. Revisar datos.';
      END IF;

    END IF;
  END IF;
END $$;

-- Fin de migración 011 (sin cambios adicionales)
