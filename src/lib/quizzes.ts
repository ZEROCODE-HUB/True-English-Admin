import { supabase } from './supabase';

export interface ChallengeCreatePayload {
  title: string;
  level: string;
  lesson_id?: string | null;
  active?: boolean;
  points?: number;
}

export interface QuestionOptionPayload {
  text: string;
  order?: number;
}

export interface QuestionCreatePayload {
  kind: 'onboarding' | 'level' | 'lesson' | 'challenge';
  title: string;
  lesson_id?: string | null;
  challenge_id?: string | null;
  level?: string | null;
  content?: any;
  image_url?: string | null;
  audio_url?: string | null;
  active?: boolean;
  include_in_test?: boolean;
  correct_option_id?: string | null;
  correct_option_index?: number;
  options?: QuestionOptionPayload[];
  points?: number;
}

export async function listChallenges() {
  const { data, error } = await supabase
    .from('challenges')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data;
}

export async function listLessons() {
  const { data, error } = await supabase
    .from('lessons')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

export async function listQuestions(kind?: string, filters?: Record<string, any>) {
  let builder = supabase.from('questions').select('id, title, kind, lesson_id, challenge_id, level, content, image_url, audio_url, correct_option_id, include_in_test, active, question_options!question_options_question_id_fkey(id, text, "order")');
  if (kind) builder = builder.eq('kind', kind);
  if (filters) {
    Object.entries(filters).forEach(([k, v]) => {
      if (v === null) builder = builder.is(k, null as any);
      else builder = builder.eq(k, v as any);
    });
  }
  const { data, error } = await builder.order('created_at', { ascending: false }).order('order', { foreignTable: 'question_options', ascending: true });
  if (error) throw error;
  console.debug('listQuestions', { kind, filters, count: (data || []).length });
  return data;
}

export async function listOnboardingQuestions() {
  // Explicit helper that fetches only onboarding questions with their options
  const { data, error } = await supabase
    .from('questions')
    // include `level` so callers can count by level correctly
    .select('id, title, kind, level, content, correct_option_id, active, question_options!question_options_question_id_fkey(id, text, "order")')
    .eq('kind', 'onboarding')
    .order('created_at', { ascending: false })
    .order('order', { foreignTable: 'question_options', ascending: true });
  if (error) throw error;
  console.debug('listOnboardingQuestions count', (data || []).length);
  return data;
}

export async function createChallenge(payload: ChallengeCreatePayload) {
  const { data, error } = await supabase
    .from('challenges')
    .insert([{ ...payload }])
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getChallengeWithQuestions(challengeId: string) {
  // Fetch challenge
  const { data: challenge, error: chErr } = await supabase
    .from('challenges')
    .select('*')
    .eq('id', challengeId)
    .single();
  if (chErr) throw chErr;

  // Fetch questions with nested options
  const { data: questions, error: qErr } = await supabase
    .from('questions')
    .select(
      'id, title, kind, content, correct_option_id, active, question_options!question_options_question_id_fkey(id, text, "order")'
    )
    .eq('challenge_id', challengeId)
    .order('created_at', { ascending: false });
  if (qErr) throw qErr;

  return { challenge, questions };
}

export async function createQuestionWithOptions(payload: QuestionCreatePayload) {
  // Insert question
  const { data: qData, error: qErr } = await supabase
    .from('questions')
    .insert([
      {
        kind: payload.kind,
        title: payload.title,
        lesson_id: payload.lesson_id ?? null,
        challenge_id: payload.challenge_id ?? null,
        level: payload.level ?? null,
        content: payload.content ?? {},
        image_url: payload.image_url ?? null,
        audio_url: payload.audio_url ?? null,
        active: payload.active ?? true,
        include_in_test: payload.include_in_test ?? false,
        correct_option_id: payload.correct_option_id ?? null,
      },
    ])
    .select()
    .single();

  if (qErr) throw qErr;

  const questionId = qData.id;

  // Insert options if provided
  let options = [] as any[];
  if (payload.options && payload.options.length > 0) {
    const opts = payload.options.map((o, i) => ({
      question_id: questionId,
      text: o.text,
      order: o.order ?? i,
    }));
    const { data: oData, error: oErr } = await supabase.from('question_options').insert(opts).select();
    if (oErr) throw oErr;
    options = oData;
  }

  console.debug('createQuestionWithOptions: created question', qData);
  console.debug('createQuestionWithOptions: created options', options);
  // If payload specifies a correct option by index (1-based) or id, update question.correct_option_id
  // Accept either payload.correct_option_id (string) or payload['correct_option_index'] (number)
  // correct_option_index is 1-based (UI uses 1..N)
  const correctIndex = (payload as any).correct_option_index as number | undefined;
  if (payload.correct_option_id || (typeof correctIndex === 'number' && options.length >= correctIndex && correctIndex > 0)) {
    let correctOptionId = payload.correct_option_id ?? null;
    if (!correctOptionId && typeof correctIndex === 'number') {
      const opt = options[correctIndex - 1];
      if (opt) correctOptionId = opt.id;
    }
    if (correctOptionId) {
      const { error: updErr } = await supabase.from('questions').update({ correct_option_id: correctOptionId }).eq('id', questionId);
      if (updErr) throw updErr;
      // reflect in qData
      qData.correct_option_id = correctOptionId;
    }
  }

  return { question: qData, options };
}

export async function updateQuestion(questionId: string, patch: Partial<QuestionCreatePayload>) {
  const { data, error } = await supabase.from('questions').update(patch).eq('id', questionId).select().single();
  if (error) throw error;
  return data;
}

export async function updateQuestionWithOptions(questionId: string, payload: Partial<QuestionCreatePayload>) {
  // Update question fields
  const patch: any = {};
  if (payload.title !== undefined) patch.title = payload.title;
  if (payload.level !== undefined) patch.level = payload.level;
  if (payload.lesson_id !== undefined) patch.lesson_id = payload.lesson_id ?? null;
  if (payload.challenge_id !== undefined) patch.challenge_id = payload.challenge_id ?? null;
  if (payload.content !== undefined) patch.content = payload.content;
  if (payload.image_url !== undefined) patch.image_url = payload.image_url ?? null;
  if (payload.audio_url !== undefined) patch.audio_url = payload.audio_url ?? null;

  if (payload.active !== undefined) patch.active = payload.active;
  if (payload.include_in_test !== undefined) patch.include_in_test = payload.include_in_test;

  if (Object.keys(patch).length > 0) {
    const { data: qData, error: qErr } = await supabase.from('questions').update(patch).eq('id', questionId).select().single();
    if (qErr) throw qErr;
    // continue with qData as base
  }

  // Replace options if provided
  let options: any[] = [];
  if (payload.options && payload.options.length > 0) {
    // delete existing options for question
    const { error: delErr } = await supabase.from('question_options').delete().eq('question_id', questionId);
    if (delErr) throw delErr;
    const opts = payload.options.map((o, i) => ({ question_id: questionId, text: o.text, order: o.order ?? i }));
    const { data: oData, error: oErr } = await supabase.from('question_options').insert(opts).select();
    if (oErr) throw oErr;
    options = oData;
  } else {
    // fetch existing options
    const { data: existingOpts, error: eoErr } = await supabase.from('question_options').select('*').eq('question_id', questionId).order('order', { ascending: true });
    if (eoErr) throw eoErr;
    options = existingOpts || [];
  }

  // Update correct_option_id if payload contains index or id
  const correctIndex = (payload as any).correct_option_index as number | undefined;
  const correctOptionId = payload.correct_option_id ?? (typeof correctIndex === 'number' && options.length >= correctIndex && correctIndex > 0 ? options[correctIndex - 1].id : null);
  if (correctOptionId) {
    const { error: updErr } = await supabase.from('questions').update({ correct_option_id: correctOptionId }).eq('id', questionId);
    if (updErr) throw updErr;
  }

  // return current question and options
  const { data: question, error: qFetchErr } = await supabase.from('questions').select('*').eq('id', questionId).single();
  if (qFetchErr) throw qFetchErr;
  return { question, options };
}

export async function deleteQuestion(questionId: string) {
  const { data, error } = await supabase.from('questions').delete().eq('id', questionId).select();
  if (error) throw error;
  return data;
}

export async function updateChallenge(challengeId: string, patch: Partial<ChallengeCreatePayload>) {
  const { data, error } = await supabase.from('challenges').update(patch).eq('id', challengeId).select().single();
  if (error) throw error;
  return data;
}

export async function deleteChallenge(challengeId: string) {
  const { data, error } = await supabase.from('challenges').delete().eq('id', challengeId).select();
  if (error) throw error;
  return data;
}

export async function uploadMedia(file: File, destPath: string, bucket = 'public') {
  // destPath should be something like `challenges/1234/image.png`
  const { data, error } = await supabase.storage.from(bucket).upload(destPath, file, { cacheControl: '3600', upsert: false });
  if (error) throw error;

  // Try to get public URL
  const { publicURL, error: urlErr } = supabase.storage.from(bucket).getPublicUrl(data.path);
  if (urlErr) {
    // Not fatal: return storage path so caller can handle
    return { path: data.path };
  }
  return { path: data.path, publicURL };
}

export default {
  listChallenges,
  listLessons,
  listQuestions,
  listOnboardingQuestions,
  createChallenge,
  getChallengeWithQuestions,
  createQuestionWithOptions,
  updateQuestion,
  updateQuestionWithOptions,
  deleteQuestion,
  updateChallenge,
  deleteChallenge,
  uploadMedia,
};
