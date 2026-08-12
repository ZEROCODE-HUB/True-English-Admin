import { supabase } from './supabase';
import type { Program, ProgramLevel, ProgramLevelConfig } from '@/types/db';

// Paleta de colores por nivel (por posición dentro del programa).
const COLOR_PALETTE = [
  'bg-red-100 text-red-800',
  'bg-orange-100 text-orange-800',
  'bg-yellow-100 text-yellow-800',
  'bg-blue-100 text-blue-800',
  'bg-green-100 text-green-800',
  'bg-purple-100 text-purple-800',
  'bg-pink-100 text-pink-800',
  'bg-teal-100 text-teal-800',
  'bg-indigo-100 text-indigo-800',
];

export const getLevelColor = (level: string, levels?: Array<Pick<ProgramLevel, 'level' | 'sort_order'>>) => {
  if (levels && levels.length > 0) {
    const idx = levels.findIndex((l) => l.level === level);
    if (idx >= 0) return COLOR_PALETTE[idx % COLOR_PALETTE.length];
  }
  // Fallback: heurística por nombre de nivel A1-C2
  const map: Record<string, string> = {
    A1: COLOR_PALETTE[0],
    A2: COLOR_PALETTE[1],
    B1: COLOR_PALETTE[2],
    B2: COLOR_PALETTE[3],
    C1: COLOR_PALETTE[4],
    C2: COLOR_PALETTE[5],
  };
  return map[level] ?? 'bg-gray-100 text-gray-600';
};

export async function listPrograms(): Promise<Program[]> {
  const { data, error } = await supabase
    .from('programs')
    .select(`
      *,
      program_levels!inner(count),
      lessons(count)
    `)
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true });
  if (error) throw error;
  return (data || []).map((p) => ({
    ...p,
    level_count: p.program_levels?.[0]?.count ?? 0,
    lesson_count: p.lessons?.[0]?.count ?? 0,
  }));
}

export async function listProgramLevels(programId: string): Promise<ProgramLevel[]> {
  const { data, error } = await supabase
    .from('program_levels')
    .select('*')
    .eq('program_id', programId)
    .order('sort_order', { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function listLevelConfig(programId: string): Promise<ProgramLevelConfig[]> {
  const { data, error } = await supabase
    .from('program_level_config')
    .select('*')
    .eq('program_id', programId)
    .order('level', { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function upsertLevelConfig(
  programId: string,
  level: string,
  pointsRequired: number,
) {
  const { data, error } = await supabase
    .from('program_level_config')
    .upsert(
      { program_id: programId, level, points_required: pointsRequired },
      { onConflict: 'program_id,level' },
    )
    .select()
    .single();
  if (error) throw error;
  return data;
}
