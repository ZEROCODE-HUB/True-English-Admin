-- Migration: 008_ai_conversations_schema.sql
-- Migration: 008_ai_conversations_schema.sql
-- Propósito: esquema para el módulo de Temas de Conversación IA, instancias de conversación con IA, mensajes y puntuaciones.
-- Supuestos: existe la tabla `public.profiles` y la función `set_updated_at()` para actualizar timestamps.

-- Habilita la extensión pgcrypto para generación de UUIDs si aún no está activa.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Tipo ENUM: estado de un tema (borrador, activo, archivado)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ai_topic_status') THEN
    CREATE TYPE ai_topic_status AS ENUM ('draft','active','archived');
  END IF;
END $$;

-- Nota: este archivo reutiliza el tipo `lesson_level` definido en migraciones previas (A1..C2).

-- Tabla `ai_topics`: almacena los temas o "topics" que los usuarios pueden seleccionar para iniciar una conversación con la IA.
-- Campos clave:
--  - title: nombre del tema mostrado al usuario
--  - level: nivel asociado (A1..C2)
--  - prompt: contexto o prompt que se usará para inicializar al modelo de IA
--  - status: control de visibilidad (draft/active/archived)
CREATE TABLE IF NOT EXISTS ai_topics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  -- emoji: pequeño identificador visual para mostrar junto al título del topic (ej. "🍽️", "🏖️")
  emoji TEXT NULL,
  level lesson_level NULL,
  prompt TEXT NOT NULL, -- contexto/prompt que alimenta a la IA
  metadata JSONB DEFAULT '{}'::jsonb,
  status ai_topic_status NOT NULL DEFAULT 'draft',
  created_by UUID NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Índices para búsqueda por nivel y estado
CREATE INDEX IF NOT EXISTS idx_ai_topics_level ON ai_topics(level);
CREATE INDEX IF NOT EXISTS idx_ai_topics_status ON ai_topics(status);

-- Tabla `ai_topic_vocab`: vocabulario asociado a un tema.
-- Cada fila guarda una palabra, su definición, parte del discurso y ejemplo para ayudar al aprendizaje.
CREATE TABLE IF NOT EXISTS ai_topic_vocab (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id UUID NOT NULL REFERENCES ai_topics(id) ON DELETE CASCADE,
  word TEXT NOT NULL,
  definition TEXT NULL,
  part_of_speech TEXT NULL,
  example TEXT NULL,
  "order" INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Índices para consultas rápidas por tema o por palabra
CREATE INDEX IF NOT EXISTS idx_ai_vocab_topic ON ai_topic_vocab(topic_id);
CREATE INDEX IF NOT EXISTS idx_ai_vocab_word ON ai_topic_vocab(word);

-- Tabla `ai_conversations`: instancia de una conversación entre un usuario y la IA.
-- Guarda referencia al `topic` seleccionado, el usuario (profile_id), nivel elegido para la sesión,
-- timestamps y metadatos (por ejemplo: settings de la sesión).
CREATE TABLE IF NOT EXISTS ai_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id UUID NULL REFERENCES ai_topics(id) ON DELETE SET NULL,
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  level lesson_level NULL, -- nivel usado en la sesión (puede sobrescribir el nivel del tema)
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  last_message_at TIMESTAMP WITH TIME ZONE NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Índices para listar conversaciones de un usuario o por topic
CREATE INDEX IF NOT EXISTS idx_ai_conversations_profile ON ai_conversations(profile_id);
CREATE INDEX IF NOT EXISTS idx_ai_conversations_topic ON ai_conversations(topic_id);

-- Asegura que exista el tipo ENUM para el tipo de contenido de mensaje (text/html/markdown/audio/attachment).
-- Esto evita el error "type \"message_content_type\" does not exist" cuando se ejecuta esta migración de forma independiente.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'message_content_type') THEN
    CREATE TYPE message_content_type AS ENUM ('text','html','markdown','audio','attachment');
  END IF;
END $$;

-- Tabla `ai_messages`: mensajes generados por el usuario o por la IA dentro de una conversación AI.
-- Campos relevantes:
--  - sender_type: indica si el mensaje proviene del 'user' o de la 'ai'
--  - content / content_json: contenido textual o estructura enriquecida
--  - reply_to_message_id: referencia a mensaje padre para hilos
CREATE TABLE IF NOT EXISTS ai_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ai_conversation_id UUID NOT NULL REFERENCES ai_conversations(id) ON DELETE CASCADE,
  sender_profile_id UUID NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  sender_type TEXT NOT NULL DEFAULT 'user', -- 'user' o 'ai'
  content TEXT NULL,
  content_json JSONB DEFAULT '{}'::jsonb,
  content_type message_content_type NOT NULL DEFAULT 'text',
  metadata JSONB DEFAULT '{}'::jsonb,
  reply_to_message_id UUID NULL REFERENCES ai_messages(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Índices para cargar mensajes por conversación (orden descendente) y por remitente
CREATE INDEX IF NOT EXISTS idx_ai_messages_conv_created_at ON ai_messages(ai_conversation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_messages_sender ON ai_messages(sender_profile_id);

-- NOTA: en este esquema no se almacenan attachments ni reacciones por mensaje.
-- Si se requieren en el futuro, agregar tablas `ai_message_attachments` y `ai_message_reactions`
-- con sus índices y políticas correspondientes.

-- Tabla `ai_conversation_scores`: almacena evaluaciones de una conversación (gramática, fluidez, ortografía, total y feedback)
-- Puede ser llenada por un evaluador humano o por procesos automáticos.
CREATE TABLE IF NOT EXISTS ai_conversation_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ai_conversation_id UUID NOT NULL REFERENCES ai_conversations(id) ON DELETE CASCADE,
  evaluator_profile_id UUID NULL REFERENCES public.profiles(id) ON DELETE SET NULL, -- quien evaluó (null si fue automática)
  grammar NUMERIC NULL,
  fluency NUMERIC NULL,
  orthography NUMERIC NULL,
  total NUMERIC NULL,
  feedback TEXT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_scores_conv ON ai_conversation_scores(ai_conversation_id);

-- Triggers: actualizan el campo updated_at usando la función compartida `set_updated_at()` definida en migraciones previas
CREATE TRIGGER trg_ai_topics_updated_at BEFORE UPDATE ON ai_topics FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_ai_conversations_updated_at BEFORE UPDATE ON ai_conversations FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_ai_messages_updated_at BEFORE UPDATE ON ai_messages FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Función auxiliar: verifica si un perfil es propietario (dueño) de una conversación AI
CREATE OR REPLACE FUNCTION public.is_ai_conversation_owner(p_ai_conv_id UUID, p_profile_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE AS $$
  SELECT EXISTS(SELECT 1 FROM ai_conversations ac WHERE ac.id = p_ai_conv_id AND ac.profile_id = p_profile_id);
$$;

-- Habilita Row Level Security (RLS) en las tablas del módulo IA y define políticas básicas
-- Las políticas son conservadoras: permiten ver topics activos, crear/leer/actualizar conversaciones propias y
-- permitir que un usuario inserte mensajes si es el remitente.
ALTER TABLE ai_topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_topic_vocab ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_conversation_scores ENABLE ROW LEVEL SECURITY;

-- Políticas para `ai_topics`: cualquiera puede ver los temas activos; el creador puede insertar/editar sus propios temas
DROP POLICY IF EXISTS "AI Topics: public select active" ON ai_topics;
CREATE POLICY "AI Topics: public select active"
  ON ai_topics
  FOR SELECT
  USING (status = 'active' OR created_by = auth.uid()::uuid);

DROP POLICY IF EXISTS "AI Topics: insert by creator" ON ai_topics;
CREATE POLICY "AI Topics: insert by creator"
  ON ai_topics
  FOR INSERT
  WITH CHECK (created_by = auth.uid()::uuid);

DROP POLICY IF EXISTS "AI Topics: update own" ON ai_topics;
CREATE POLICY "AI Topics: update own"
  ON ai_topics
  FOR UPDATE
  USING (created_by = auth.uid()::uuid)
  WITH CHECK (created_by = auth.uid()::uuid);

-- Políticas para `ai_topic_vocab`: se permite seleccionar vocabulario para topics activos; sólo el owner puede insertar vocab
DROP POLICY IF EXISTS "AI Vocab: select" ON ai_topic_vocab;
CREATE POLICY "AI Vocab: select"
  ON ai_topic_vocab
  FOR SELECT
  USING (EXISTS (SELECT 1 FROM ai_topics t WHERE t.id = ai_topic_vocab.topic_id AND (t.status = 'active' OR t.created_by = auth.uid()::uuid)));

DROP POLICY IF EXISTS "AI Vocab: insert by owner" ON ai_topic_vocab;
CREATE POLICY "AI Vocab: insert by owner"
  ON ai_topic_vocab
  FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM ai_topics t WHERE t.id = ai_topic_vocab.topic_id AND t.created_by = auth.uid()::uuid));

-- Políticas para `ai_conversations`: usuarios sólo pueden ver/crear/actualizar sus propias conversaciones
DROP POLICY IF EXISTS "AI Conversations: select owner" ON ai_conversations;
CREATE POLICY "AI Conversations: select owner"
  ON ai_conversations
  FOR SELECT
  USING (profile_id = auth.uid()::uuid);

DROP POLICY IF EXISTS "AI Conversations: insert self" ON ai_conversations;
CREATE POLICY "AI Conversations: insert self"
  ON ai_conversations
  FOR INSERT
  WITH CHECK (profile_id = auth.uid()::uuid);

DROP POLICY IF EXISTS "AI Conversations: update owner" ON ai_conversations;
CREATE POLICY "AI Conversations: update owner"
  ON ai_conversations
  FOR UPDATE
  USING (profile_id = auth.uid()::uuid)
  WITH CHECK (profile_id = auth.uid()::uuid);

-- Políticas para `ai_messages`: sólo el propietario de la conversación puede leer sus mensajes; insertar está permitido si el remitente es el usuario autenticado
DROP POLICY IF EXISTS "AI Messages: select owner conv" ON ai_messages;
CREATE POLICY "AI Messages: select owner conv"
  ON ai_messages
  FOR SELECT
  USING (public.is_ai_conversation_owner(ai_conversation_id, auth.uid()::uuid));

DROP POLICY IF EXISTS "AI Messages: insert by sender" ON ai_messages;
CREATE POLICY "AI Messages: insert by sender"
  ON ai_messages
  FOR INSERT
  WITH CHECK (
    sender_type = 'user' AND sender_profile_id = auth.uid()::uuid
  );

-- Nota: los mensajes generados por la IA (insertados por el servicio) normalmente se realizan usando la service_role key
-- que bypassgea RLS. Si prefieres permitir inserciones desde un JWT con claim especial, se puede añadir una política adicional.

-- No se crean políticas para attachments/reactions porque esas tablas no existen en este esquema.

-- Políticas para `ai_conversation_scores`: el propietario de la conversación puede ver las evaluaciones
DROP POLICY IF EXISTS "AI Scores: select owner" ON ai_conversation_scores;
CREATE POLICY "AI Scores: select owner"
  ON ai_conversation_scores
  FOR SELECT
  USING (EXISTS (SELECT 1 FROM ai_conversations ac WHERE ac.id = ai_conversation_scores.ai_conversation_id AND ac.profile_id = auth.uid()::uuid));

-- RPC: función pública para listar topics activos con paginación y filtro por nivel/título
-- Devuelve un JSON con { total, data: [...] }
CREATE OR REPLACE FUNCTION public.get_ai_topics(p_level TEXT DEFAULT 'all', p_search TEXT DEFAULT '', p_limit INT DEFAULT 50, p_offset INT DEFAULT 0)
RETURNS JSONB LANGUAGE sql STABLE AS $$
  WITH filtered AS (
    SELECT * FROM ai_topics t
    WHERE (p_level = 'all' OR t.level::text = p_level OR p_level IS NULL)
      AND (p_search IS NULL OR p_search = '' OR t.title ILIKE ('%' || p_search || '%'))
      AND t.status = 'active'
    ORDER BY t.created_at DESC
    LIMIT p_limit OFFSET p_offset
  ),
  total AS (SELECT COUNT(*) AS cnt FROM ai_topics t WHERE (p_level = 'all' OR t.level::text = p_level OR p_level IS NULL) AND t.status = 'active' AND (p_search IS NULL OR p_search = '' OR t.title ILIKE ('%' || p_search || '%'))),
  rows AS (SELECT jsonb_agg(row_to_json(t.*)::jsonb) AS data FROM filtered t)
  SELECT jsonb_build_object('total', (SELECT cnt FROM total), 'data', COALESCE((SELECT data FROM rows), '[]'::jsonb));
$$;

-- RPC: obtener las conversaciones AI de un usuario con resumen de puntuaciones
-- Parámetros: p_profile_id (usuario), paginación
-- Devuelve { total, data: [...] } donde cada elemento incluye score_summary promedio
CREATE OR REPLACE FUNCTION public.get_ai_conversations_for_user(p_profile_id UUID, p_limit INT DEFAULT 50, p_offset INT DEFAULT 0)
RETURNS JSONB LANGUAGE sql STABLE AS $$
  WITH convs AS (
    SELECT * FROM ai_conversations ac WHERE ac.profile_id = p_profile_id ORDER BY ac.started_at DESC LIMIT p_limit OFFSET p_offset
  ),
  total AS (SELECT COUNT(*) AS cnt FROM ai_conversations ac WHERE ac.profile_id = p_profile_id),
  rows AS (
    SELECT jsonb_agg(row_to_json(t.*)::jsonb) AS data
    FROM (
      SELECT ac.id, ac.topic_id, ac.profile_id, ac.level, ac.started_at, ac.last_message_at, ac.metadata,
        (SELECT jsonb_build_object('grammar', AVG(s.grammar), 'fluency', AVG(s.fluency), 'orthography', AVG(s.orthography), 'total', AVG(s.total)) FROM ai_conversation_scores s WHERE s.ai_conversation_id = ac.id) AS score_summary
      FROM convs ac
    ) t
  )
  SELECT jsonb_build_object('total', (SELECT cnt FROM total), 'data', COALESCE((SELECT data FROM rows), '[]'::jsonb));
$$;

-- RPC: detalle de una conversación AI
-- Devuelve: conversation, topic (si existe), mensajes (con attachments y reacciones) y todas las puntuaciones asociadas
CREATE OR REPLACE FUNCTION public.get_ai_conversation_detail(p_ai_conv_id UUID, p_messages_limit INT DEFAULT 500)
RETURNS JSONB LANGUAGE sql STABLE AS $$
  WITH conv AS (SELECT * FROM ai_conversations WHERE id = p_ai_conv_id),
  topic AS (SELECT t.* FROM ai_topics t JOIN conv c ON t.id = c.topic_id),
  parts AS (SELECT jsonb_build_object('profile_id', c.profile_id) AS owner FROM conv c),
  msgs AS (
    -- Agrega los mensajes de la conversación (sin attachments ni reacciones)
    SELECT jsonb_agg(jsonb_build_object(
      'id', m.id,
      'sender_profile_id', m.sender_profile_id,
      'sender_type', m.sender_type,
      'content', m.content,
      'content_json', m.content_json,
      'content_type', m.content_type,
      'created_at', m.created_at
    ) ORDER BY m.created_at) AS messages
    FROM (SELECT * FROM ai_messages WHERE ai_conversation_id = p_ai_conv_id ORDER BY created_at DESC LIMIT p_messages_limit) m
  ),
  scores AS (SELECT jsonb_agg(row_to_json(s.*)::jsonb) AS scores FROM ai_conversation_scores s WHERE s.ai_conversation_id = p_ai_conv_id)
  SELECT jsonb_build_object('conversation', (SELECT to_jsonb(c) FROM conv c), 'topic', COALESCE((SELECT to_jsonb(t) FROM topic t), 'null'), 'messages', COALESCE((SELECT messages FROM msgs), '[]'::jsonb), 'scores', COALESCE((SELECT scores FROM scores), '[]'::jsonb));
$$;

