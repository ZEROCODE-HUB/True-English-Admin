# Quizzes / Challenges Schema

Este documento resume el modelo de datos del módulo de Quizzes / Desafíos, describe las tablas principales y muestra consultas SQL de ejemplo para las operaciones habituales.

## Resumen conceptual (ER simplificado)

- `lessons` (ya existe): lecciones del curso.
- `questions` (ya existe): banco de preguntas con `kind` = onboarding|level|lesson|challenge.
- `question_options` (ya existe): opciones por pregunta.
- `challenges` (ya existe): definición de un desafío asociado opcionalmente a una lección.

Nuevas tablas añadidas en `011_quizzes_schema.sql`:

- `challenge_attempts` (1:N -> profile, 1:N -> challenge)
  - Guarda cada intento/ejecución de un usuario sobre un challenge.

- `challenge_attempt_items` (1:N -> attempt, 0..1 -> question)
  - Detalle por pregunta de cada intento (opción seleccionada, si fue correcta, tiempo).

- `challenge_participants` (N:M -> profiles x challenges)
  - Registro opt-in/inscripciones de usuarios a desafíos (opcional).

- `challenge_schedules` (1:N -> challenge)
  - Ventanas de publicación / recurrencia para un challenge.

- `question_resources` (1:N -> questions)
  - Recursos relacionados con preguntas (imágenes, audios, archivos).

- `vw_challenge_leaderboard` (vista) para consultar rápidamente mejores resultados.

## Relaciones clave

- `questions.challenge_id` -> `challenges.id` (FK)
- `question_options.question_id` -> `questions.id`
- `challenge_attempts.profile_id` -> `public.profiles.id`
- `challenge_attempt_items.attempt_id` -> `challenge_attempts.id`
- `challenge_attempt_items.question_id` -> `questions.id`

## Consultas de ejemplo

1) Crear un nuevo `challenge`

```sql
INSERT INTO challenges (title, level, lesson_id, active)
VALUES ('Desafío de Verbos Irregulares', 'A2', '<LECCION_UUID>'::uuid, true)
RETURNING id;
```

2) Agregar una pregunta al banco (tipo challenge)

```sql
-- Crear la pregunta
WITH q AS (
  INSERT INTO questions (kind, challenge_id, title, content, include_in_test)
  VALUES ('challenge', '<CHALLENGE_UUID>'::uuid, 'What is the past of go?', '{}'::jsonb, true)
  RETURNING id
)
-- Añadir opciones
INSERT INTO question_options (question_id, text, "order")
SELECT q.id, v.text, v.ord
FROM q, (VALUES
  ('went', 1),
  ('goed', 2),
  ('gone', 3),
  ('going', 4)
) AS v(text, ord);

-- Opcional: actualizar correct_option_id
UPDATE questions SET correct_option_id = (
  SELECT id FROM question_options WHERE question_id = questions.id AND text = 'went' LIMIT 1
) WHERE id = (SELECT id FROM q);
```

3) Iniciar un intento de challenge (usuario empieza)

```sql
INSERT INTO challenge_attempts (profile_id, challenge_id, started_at, metadata)
VALUES ('<PROFILE_UUID>'::uuid, '<CHALLENGE_UUID>'::uuid, now(), '{"user_agent":"web"}'::jsonb)
RETURNING id;
```

4) Guardar una respuesta por pregunta (item)

```sql
INSERT INTO challenge_attempt_items (attempt_id, question_id, selected_option_id, correct, time_taken_ms, payload)
VALUES (
  '<ATTEMPT_UUID>'::uuid,
  '<QUESTION_UUID>'::uuid,
  '<OPTION_UUID>'::uuid,
  true,
  12000,
  '{"notes":"respuesta rápida"}'::jsonb
);
```

5) Finalizar intento y calcular score (ejemplo simple)

```sql
-- Supongamos que calculás el score en aplicación y luego actualizás
UPDATE challenge_attempts
SET finished_at = now(), score = 85
WHERE id = '<ATTEMPT_UUID>'::uuid;
```

6) Obtener leaderboard para un challenge

```sql
SELECT * FROM vw_challenge_leaderboard WHERE challenge_id = '<CHALLENGE_UUID>'::uuid ORDER BY best_score DESC LIMIT 50;
```

7) Obtener intentos de un usuario

```sql
SELECT * FROM challenge_attempts WHERE profile_id = '<PROFILE_UUID>'::uuid ORDER BY created_at DESC LIMIT 50;
```

## Recomendaciones de operación

- Subir imágenes/audios a Supabase Storage y guardar la `url` en `question_resources`.
- Ejecutar `REFRESH MATERIALIZED VIEW mv_challenge_leaderboard` si la convertís en materialized view.
- Usar RLS policies (ya incluidas en la migración) para que usuarios sólo vean/creén sus propios intentos. Las operaciones administradoras deben usar service_role.

## RPCs sugeridos (funciones)

- `get_challenge_detail(challenge_id uuid)` -> devuelve challenge con preguntas activas y opciones (similar a `get_lesson_detail`).
- `get_user_attempts(profile_id uuid, challenge_id uuid)` -> lista de intentos y items.
- `submit_challenge_attempt(attempt_payload jsonb)` -> función que inserta attempt + items en una transacción segura.

Si querés, genero ahora los scripts SQL para las funciones RPC mencionadas y ejemplos de triggers/constraints adicionales (p. ej. calcular `best_score` en `challenge_participants` al insertar un attempt). Dime cuál preferís que genere primero.
