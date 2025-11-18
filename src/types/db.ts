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
}

export interface RPCGetLessonDetailResponse {
  lesson: RPCLessonCore;
  content: RPCContentItem[];
}
