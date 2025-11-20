-- migrations/009_rls_policies.sql

-- Versión final y limpia: todas las políticas usan únicamente auth.uid()
-- (usuarios autenticados). Se han eliminado condiciones admin/service_role
-- y bloques DO/EXECUTE. Aplica este archivo en staging primero.

/* ------------------------------------------------------------------ */
/* Habilitar RLS en tablas objetivo (si no están ya habilitadas) */
/* ------------------------------------------------------------------ */
ALTER TABLE IF EXISTS public.ai_topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.ai_topic_vocab ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.ai_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.ai_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.ai_conversation_scores ENABLE ROW LEVEL SECURITY;

ALTER TABLE IF EXISTS public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.conversation_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.messages ENABLE ROW LEVEL SECURITY;

/* ------------------------------------------------------------------ */
-- Todas las políticas permiten operaciones a usuarios autenticados
-- (auth.uid() IS NOT NULL). No hay condiciones de admin/service_role.
/* ------------------------------------------------------------------ */

-- ai_topics
DROP POLICY IF EXISTS "ai_topics_select" ON public.ai_topics;
CREATE POLICY "ai_topics_select" ON public.ai_topics FOR SELECT USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "ai_topics_insert" ON public.ai_topics;
CREATE POLICY "ai_topics_insert" ON public.ai_topics FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "ai_topics_update" ON public.ai_topics;
CREATE POLICY "ai_topics_update" ON public.ai_topics FOR UPDATE USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "ai_topics_delete" ON public.ai_topics;
CREATE POLICY "ai_topics_delete" ON public.ai_topics FOR DELETE USING (auth.uid() IS NOT NULL);

-- ai_topic_vocab
DROP POLICY IF EXISTS "ai_topic_vocab_select" ON public.ai_topic_vocab;
CREATE POLICY "ai_topic_vocab_select" ON public.ai_topic_vocab FOR SELECT USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "ai_topic_vocab_insert" ON public.ai_topic_vocab;
CREATE POLICY "ai_topic_vocab_insert" ON public.ai_topic_vocab FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "ai_topic_vocab_update" ON public.ai_topic_vocab;
CREATE POLICY "ai_topic_vocab_update" ON public.ai_topic_vocab FOR UPDATE USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "ai_topic_vocab_delete" ON public.ai_topic_vocab;
CREATE POLICY "ai_topic_vocab_delete" ON public.ai_topic_vocab FOR DELETE USING (auth.uid() IS NOT NULL);

-- ai_conversations
DROP POLICY IF EXISTS "ai_conversations_select" ON public.ai_conversations;
CREATE POLICY "ai_conversations_select" ON public.ai_conversations FOR SELECT USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "ai_conversations_insert" ON public.ai_conversations;
CREATE POLICY "ai_conversations_insert" ON public.ai_conversations FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "ai_conversations_update" ON public.ai_conversations;
CREATE POLICY "ai_conversations_update" ON public.ai_conversations FOR UPDATE USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "ai_conversations_delete" ON public.ai_conversations;
CREATE POLICY "ai_conversations_delete" ON public.ai_conversations FOR DELETE USING (auth.uid() IS NOT NULL);

-- ai_messages
DROP POLICY IF EXISTS "ai_messages_select" ON public.ai_messages;
CREATE POLICY "ai_messages_select" ON public.ai_messages FOR SELECT USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "ai_messages_insert" ON public.ai_messages;
CREATE POLICY "ai_messages_insert" ON public.ai_messages FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "ai_messages_update" ON public.ai_messages;
CREATE POLICY "ai_messages_update" ON public.ai_messages FOR UPDATE USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "ai_messages_delete" ON public.ai_messages;
CREATE POLICY "ai_messages_delete" ON public.ai_messages FOR DELETE USING (auth.uid() IS NOT NULL);

-- ai_conversation_scores
DROP POLICY IF EXISTS "ai_conversation_scores_select" ON public.ai_conversation_scores;
CREATE POLICY "ai_conversation_scores_select" ON public.ai_conversation_scores FOR SELECT USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "ai_conversation_scores_insert" ON public.ai_conversation_scores;
CREATE POLICY "ai_conversation_scores_insert" ON public.ai_conversation_scores FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "ai_conversation_scores_update" ON public.ai_conversation_scores;
CREATE POLICY "ai_conversation_scores_update" ON public.ai_conversation_scores FOR UPDATE USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "ai_conversation_scores_delete" ON public.ai_conversation_scores;
CREATE POLICY "ai_conversation_scores_delete" ON public.ai_conversation_scores FOR DELETE USING (auth.uid() IS NOT NULL);


/* ------------------------------------------------------------------ */
-- Fin de archivo: políticas que solo dependen de auth.uid()
/* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */
-- He eliminado los bloques PL/pgSQL/DO que contenían EXECUTE con
-- delimitores $$ anidados (causaban errores de sintaxis en Supabase).
-- El archivo ya contiene las políticas explícitas, simples y basadas
-- únicamente en auth.uid() arriba en el fichero. Aplica ese SQL en
-- staging; si necesitas políticas más avanzadas (owner/admin/service)
-- dime y las adapto con delimitadores seguros.
/* ------------------------------------------------------------------ */
