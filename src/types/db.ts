export interface ExerciseOption {
  id: string;
  texto: string;
}

export interface Note {
  id: string;
  titulo: string;
  descripcion: string;
  imagenes: string[];
  audios: string[];
  activo: boolean;
  orden: number;
  points?: number;
}

export interface Exercise {
  id: string;
  descripcion: string;
  tipo: string;
  contenido: string;
  imagenes: string[];
  audios: string[];
  opciones: ExerciseOption[];
  respuestaCorrecta: string;
  obligatorio: boolean;
  activo: boolean;
  orden: number;
  points?: number;
}

export interface Lesson {
  id: string;
  titulo: string;
  descripcion: string;
  nivelAsociado: string;
  obligatoria: boolean;
  fechaCreacion: string | Date;
  notas: Note[];
  ejercicios: Exercise[];
  points?: number;
}

// Minimal RPC payloads (expand later if needed)
export interface RPCLessonCore {
  id: string;
  title: string;
  description: string;
  level: string;
  mandatory: boolean;
  created_at: string;
}

export interface RPCContentItem {
  id: string;
  kind: 'note' | 'exercise';
  title?: string;
  content?: string;
  image_url?: string | null;
  audio_url?: string | null;
  active?: boolean;
  order?: number;
  // exercise specific
  type?: string | null;
  options?: Array<{ id: string; text: string }>;
  correct_option_id?: string | null;
  mandatory?: boolean | null;
  points?: number | null;
}

export interface RPCGetLessonDetailResponse {
  lesson: RPCLessonCore;
  content: RPCContentItem[];
}

// Fila de avance por alumno tal como la devuelve la RPC admin_get_students_progress (snake_case)
export interface StudentProgress {
  id: string;
  name: string | null;
  last_name: string | null;
  email: string | null;
  company: string | null;
  nivel_actual: string | null;
  status: string | null;
  tipo: string | null;
  created_at: string | null;
  puntos: number;
  completed_total: number;
  lessons_total: number;
  completed_in_level: number;
  lessons_in_level: number;
  pct_avance: number;
  horas_totales_ms: number;
  horas_mes_ms: number;
  streak_count: number;
  streak_best: number;
  logros_count: number;
  ultima_actividad: string | null;
}

// ===== Enterprise / Companies =====

export interface Company {
  id: string;
  name: string;
  slug: string;
  active: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  // RPC computed fields
  member_count?: number;
  area_count?: number;
  lesson_count?: number;
}

export interface Area {
  id: string;
  company_id: string;
  name: string;
  active: boolean;
  created_at: string;
  updated_at: string;
  // RPC computed fields
  member_count?: number;
  lesson_count?: number;
}

export interface CompanyMembership {
  id: string;
  company_id: string;
  area_id: string | null;
  profile_id: string;
  active: boolean;
  created_at: string;
  // Joined fields from RPC
  profile_name?: string | null;
  profile_last_name?: string | null;
  profile_email?: string | null;
  area_name?: string | null;
}

export interface LessonAssignment {
  id: string;
  lesson_id: string;
  company_id: string;
  area_id: string | null;
  assigned_by: string | null;
  created_at: string;
}

export interface CompanyStats {
  total_members: number;
  total_areas: number;
  total_lessons_assigned: number;
  members_by_area: Array<{ area_id: string; area_name: string; member_count: number }>;
  lessons_by_area: Array<{ area_id: string; area_name: string; lesson_count: number }>;
  progress_summary: {
    total_enrollments: number;
    completed: number;
    in_progress: number;
    avg_completion_pct: number;
  };
}
