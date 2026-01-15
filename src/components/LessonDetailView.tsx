import { useState, useEffect, useCallback, useRef } from "react";
import DOMPurify from 'dompurify';
import { ArrowLeft, Plus, Edit, Trash2, Upload, Eye, EyeOff, FileText, BookOpen, ChevronUp, ChevronDown, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Lesson, Note, Exercise, ExerciseOption, RPCGetLessonDetailResponse, RPCContentItem } from '@/types/db';
import { supabase } from "@/lib/supabase";
import ReactQuill from 'react-quill';
import DeleteConfirmationDialog from "./DeleteConfirmationDialog";
import { useToast } from "@/hooks/use-toast";

interface LessonDetailViewProps {
  lesson: Lesson;
  onBack: () => void;
  onUpdate: (lesson: Lesson) => void;
}

type ContentItem = (Note & { type: 'note' }) | (Exercise & { type: 'exercise' });

const exerciseTypes = [
  "Vocabulario y pronunciación",
  "Gramática y Ortografía",
  "Comprensión auditiva",
  "Comprensión lectora",
  "Expresión escrita",
  "Expresión oral"
];

export default function LessonDetailView({ lesson, onBack, onUpdate }: LessonDetailViewProps) {
  const [currentLesson, setCurrentLesson] = useState<Lesson>({
    ...lesson,
    notas: lesson.notas || [],
    ejercicios: lesson.ejercicios || []
  });
  const [isNoteModalOpen, setIsNoteModalOpen] = useState(false);
  const [isExerciseModalOpen, setIsExerciseModalOpen] = useState(false);
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [editingExercise, setEditingExercise] = useState<Exercise | null>(null);
  const [deleteDialog, setDeleteDialog] = useState<{
    isOpen: boolean;
    onConfirm: () => void;
  }>({ isOpen: false, onConfirm: () => { } });
  const { toast } = useToast();

  const [noteForm, setNoteForm] = useState({
    titulo: "",
    descripcion: "",
    imagenes: [] as string[],
    audios: [] as string[],
    imagenFile: null as File | null,
    audioFile: null as File | null,
    activo: true
  });

  const [exerciseForm, setExerciseForm] = useState({
    descripcion: "",
    tipo: exerciseTypes[0],
    contenido: "",
    imagenes: [] as string[],
    audios: [] as string[],
    imagenFile: null as File | null,
    audioFile: null as File | null,
    opciones: [] as ExerciseOption[],
    respuestaCorrecta: "",
    obligatorio: false,
    activo: true
  });

  // previews for selected or existing media
  const [noteImagePreview, setNoteImagePreview] = useState<string | null>(null);
  const [noteAudioPreview, setNoteAudioPreview] = useState<string | null>(null);
  const [exerciseImagePreview, setExerciseImagePreview] = useState<string | null>(null);
  const [exerciseAudioPreview, setExerciseAudioPreview] = useState<string | null>(null);

  // input refs for hidden file inputs
  const noteImageInputRef = useRef<HTMLInputElement | null>(null);
  const noteAudioInputRef = useRef<HTMLInputElement | null>(null);
  const exerciseImageInputRef = useRef<HTMLInputElement | null>(null);
  const exerciseAudioInputRef = useRef<HTMLInputElement | null>(null);

  // update previews when noteForm changes
  useEffect(() => {
    let imgUrl: string | null = null;
    let audioUrl: string | null = null;

    if (noteForm.imagenFile) {
      imgUrl = URL.createObjectURL(noteForm.imagenFile);
      setNoteImagePreview(imgUrl);
    } else if (noteForm.imagenes && noteForm.imagenes.length > 0) {
      setNoteImagePreview(noteForm.imagenes[0]);
    } else {
      setNoteImagePreview(null);
    }

    if (noteForm.audioFile) {
      audioUrl = URL.createObjectURL(noteForm.audioFile);
      setNoteAudioPreview(audioUrl);
    } else if (noteForm.audios && noteForm.audios.length > 0) {
      setNoteAudioPreview(noteForm.audios[0]);
    } else {
      setNoteAudioPreview(null);
    }

    return () => {
      if (imgUrl) URL.revokeObjectURL(imgUrl);
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
  }, [noteForm.imagenFile, noteForm.imagenes, noteForm.audioFile, noteForm.audios]);

  // update previews when exerciseForm changes
  useEffect(() => {
    let imgUrl: string | null = null;
    let audioUrl: string | null = null;

    if (exerciseForm.imagenFile) {
      imgUrl = URL.createObjectURL(exerciseForm.imagenFile);
      setExerciseImagePreview(imgUrl);
    } else if (exerciseForm.imagenes && exerciseForm.imagenes.length > 0) {
      setExerciseImagePreview(exerciseForm.imagenes[0]);
    } else {
      setExerciseImagePreview(null);
    }

    if (exerciseForm.audioFile) {
      audioUrl = URL.createObjectURL(exerciseForm.audioFile);
      setExerciseAudioPreview(audioUrl);
    } else if (exerciseForm.audios && exerciseForm.audios.length > 0) {
      setExerciseAudioPreview(exerciseForm.audios[0]);
    } else {
      setExerciseAudioPreview(null);
    }

    return () => {
      if (imgUrl) URL.revokeObjectURL(imgUrl);
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
  }, [exerciseForm.imagenFile, exerciseForm.imagenes, exerciseForm.audioFile, exerciseForm.audios]);

  // Storage bucket name (create this bucket in Supabase storage)
  const STORAGE_BUCKET = 'lesson-media';

  // Helper to upload a single file to Supabase storage and return its public URL
  const uploadFile = async (file: File, path: string) => {
    const filePath = `${path}/${Date.now()}_${file.name}`;
    const { error: upErr } = await supabase.storage.from(STORAGE_BUCKET).upload(filePath, file, { cacheControl: '3600', upsert: false });
    if (upErr) throw upErr;
    const { data: urlData, error: urlErr } = await supabase.storage.from(STORAGE_BUCKET).getPublicUrl(filePath);
    if (urlErr) throw urlErr;
    return urlData.publicUrl;
  };

  const loadDetail = useCallback(async () => {
    try {
      const { data, error } = await supabase.rpc('get_lesson_detail', { p_lesson_id: lesson.id });
      if (error) throw error;
      const payload = data as RPCGetLessonDetailResponse;
      const core = payload.lesson;
      const content: RPCContentItem[] = payload.content || [];

      const notas: Note[] = content.filter((c) => c.kind === 'note').map((n) => ({
        id: n.id,
        titulo: n.title || '',
        descripcion: n.content || '',
        imagenes: n.image_url ? [n.image_url] : [],
        audios: n.audio_url ? [n.audio_url] : [],
        activo: n.active || false,
        orden: n.order || 0,
        points: (n.points ?? 0) as number
      }));

      const ejercicios: Exercise[] = content.filter((c) => c.kind === 'exercise').map((e) => ({
        id: e.id,
        descripcion: e.title || '',
        tipo: (e.type && exerciseTypes.includes(e.type)) ? e.type : exerciseTypes[0],
        contenido: e.content || '',
        imagenes: e.image_url ? [e.image_url] : [],
        audios: e.audio_url ? [e.audio_url] : [],
        opciones: (e.options || []).map((o) => ({ id: o.id, texto: o.text })),
        respuestaCorrecta: e.correct_option_id || '',
        obligatorio: e.mandatory || false,
        activo: e.active || false,
        orden: e.order || 0
        ,
        points: (e.points ?? 0) as number
      }));

      setCurrentLesson({
        id: core.id,
        titulo: core.title,
        descripcion: core.description,
        nivelAsociado: core.level,
        obligatoria: core.mandatory,
        fechaCreacion: core.created_at,
        notas,
        ejercicios
      });
    } catch (err) {
      console.error('loadDetail error', err);
      toast({ title: 'Error', description: 'No se pudo cargar el detalle de la lección.' });
    }
  }, [lesson.id, toast]);

  const [isNoteSaving, setIsNoteSaving] = useState(false);
  const [isExerciseSaving, setIsExerciseSaving] = useState(false);

  useEffect(() => {
    loadDetail();
  }, [loadDetail]);

  // Combine notes and exercises into a single sorted array
  const contentItems: ContentItem[] = [
    ...currentLesson.notas.map(note => ({ ...note, type: 'note' as const })),
    ...currentLesson.ejercicios.map(exercise => ({ ...exercise, type: 'exercise' as const }))
  ].sort((a, b) => a.orden - b.orden);

  const handleCreateNote = () => {
    setEditingNote(null);
    setNoteForm({ titulo: "", descripcion: "", imagenes: [], audios: [], imagenFile: null, audioFile: null, activo: true, points: 0 });
    setIsNoteModalOpen(true);
  };

  const handleEditNote = (note: Note) => {
    setEditingNote(note);
    setNoteForm({
      titulo: note.titulo,
      descripcion: note.descripcion,
      imagenes: note.imagenes,
      audios: note.audios,
      imagenFile: null,
      audioFile: null,
      activo: note.activo,
      points: note.points ?? 0
    });
    setIsNoteModalOpen(true);
  };

  const handleSaveNote = () => {
    if (isNoteSaving) return;
    if (!noteForm.titulo.trim()) {
      toast({
        title: "Error",
        description: "El título es requerido",
        variant: "destructive"
      });
      return;
    }
    (async () => {
      setIsNoteSaving(true);
      try {
        // upload files if provided (note)
        let imageUrl: string | null = noteForm.imagenes[0] || null;
        let audioUrl: string | null = noteForm.audios[0] || null;

        if (noteForm.imagenFile) {
          imageUrl = await uploadFile(noteForm.imagenFile, `lessons/${currentLesson.id}/notes`);
        }
        if (noteForm.audioFile) {
          audioUrl = await uploadFile(noteForm.audioFile, `lessons/${currentLesson.id}/notes`);
        }

        if (editingNote) {
          const { error } = await supabase.from('notes').update({
            title: noteForm.titulo,
            content: noteForm.descripcion,
            image_url: imageUrl,
            audio_url: audioUrl,
            active: noteForm.activo,
            points: (noteForm as any).points ?? 0
          }).eq('id', editingNote.id);
          if (error) throw error;
          toast({ title: 'Nota actualizada', description: 'La nota ha sido actualizada correctamente.' });
        } else {
          const order = currentLesson.notas.length + currentLesson.ejercicios.length;
          const { error } = await supabase.from('notes').insert([{
            lesson_id: currentLesson.id,
            title: noteForm.titulo,
            content: noteForm.descripcion,
            image_url: imageUrl,
            audio_url: audioUrl,
            active: noteForm.activo,
            points: (noteForm as any).points ?? 0,
            "order": order
          }]);
          if (error) throw error;
          toast({ title: 'Nota creada', description: 'La nota ha sido creada correctamente.' });
        }
        setIsNoteModalOpen(false);
        setEditingNote(null);
        await loadDetail();
      } catch (err) {
        console.error(err);
        toast({ title: 'Error', description: 'No se pudo guardar la nota.' });
      } finally {
        setIsNoteSaving(false);
      }
    })();
  };

  const handleDeleteNote = (noteId: string) => {
    setDeleteDialog({
      isOpen: true,
      onConfirm: () => {
        (async () => {
          try {
            const { error } = await supabase.from('notes').delete().eq('id', noteId);
            if (error) throw error;
            toast({ title: 'Nota eliminada', description: 'La nota ha sido eliminada correctamente.' });
            await loadDetail();
          } catch (err) {
            console.error(err);
            toast({ title: 'Error', description: 'No se pudo eliminar la nota.' });
          }
        })();
      },
    });
  };

  const handleToggleNoteActive = (noteId: string) => {
    (async () => {
      try {
        const note = currentLesson.notas.find(n => n.id === noteId);
        if (!note) return;
        const { error } = await supabase.from('notes').update({ active: !note.activo }).eq('id', noteId);
        if (error) throw error;
        toast({ title: 'Estado actualizado', description: 'El estado de la nota ha sido actualizado.' });
        await loadDetail();
      } catch (err) {
        console.error(err);
        toast({ title: 'Error', description: 'No se pudo actualizar el estado.' });
      }
    })();
  };

  const handleCreateExercise = () => {
    setEditingExercise(null);
    setExerciseForm({
      descripcion: "",
      tipo: exerciseTypes[0],
      contenido: "",
      imagenes: [],
      audios: [],
      imagenFile: null,
      audioFile: null,
      opciones: [],
      respuestaCorrecta: "",
      obligatorio: false,
      activo: true,
      points: 0
    });
    setIsExerciseModalOpen(true);
  };

  const handleEditExercise = (exercise: Exercise) => {
    setEditingExercise(exercise);
    setExerciseForm({
      descripcion: exercise.descripcion,
      tipo: exerciseTypes.includes(exercise.tipo) ? exercise.tipo : exerciseTypes[0],
      contenido: exercise.contenido,
      imagenes: exercise.imagenes,
      audios: exercise.audios,
      imagenFile: null,
      audioFile: null,
      opciones: exercise.opciones,
      respuestaCorrecta: exercise.respuestaCorrecta,
      obligatorio: exercise.obligatorio,
      activo: exercise.activo,
      points: exercise.points ?? 0
    });
    setIsExerciseModalOpen(true);
  };

  const handleSaveExercise = () => {
    if (isExerciseSaving) return;
    if (!exerciseForm.descripcion.trim()) {
      toast({
        title: "Error",
        description: "La descripción es requerida",
        variant: "destructive"
      });
      return;
    }

    if (exerciseForm.opciones.length < 2) {
      toast({
        title: "Error",
        description: "Se necesitan al menos 2 opciones de respuesta",
        variant: "destructive"
      });
      return;
    }

    if (!exerciseForm.respuestaCorrecta) {
      toast({
        title: "Error",
        description: "Debe seleccionar una respuesta correcta",
        variant: "destructive"
      });
      return;
    }

    (async () => {
      setIsExerciseSaving(true);
      try {
        // upload files if provided (exercise)
        let imageUrl: string | null = exerciseForm.imagenes[0] || null;
        let audioUrl: string | null = exerciseForm.audios[0] || null;

        if (exerciseForm.imagenFile) {
          imageUrl = await uploadFile(exerciseForm.imagenFile, `lessons/${currentLesson.id}/exercises`);
        }
        if (exerciseForm.audioFile) {
          audioUrl = await uploadFile(exerciseForm.audioFile, `lessons/${currentLesson.id}/exercises`);
        }

        if (editingExercise) {
          // update exercise
          const { error: upErr } = await supabase.from('exercises').update({
            description: exerciseForm.descripcion,
            type: exerciseForm.tipo,
            content: exerciseForm.contenido,
            image_url: imageUrl,
            audio_url: audioUrl,
            mandatory: exerciseForm.obligatorio,
            active: exerciseForm.activo,
            points: (exerciseForm as any).points ?? 0,
            "order": editingExercise.orden
          }).eq('id', editingExercise.id);
          if (upErr) throw upErr;

          // replace options: delete old and insert new
          const { error: delOptErr } = await supabase.from('exercise_options').delete().eq('exercise_id', editingExercise.id);
          if (delOptErr) throw delOptErr;

          const inserted: Array<{ id: string; text: string }> = [];
          for (let i = 0; i < exerciseForm.opciones.length; i++) {
            const opt = exerciseForm.opciones[i];
            const { data: insData, error: insErr } = await supabase.from('exercise_options').insert([{ exercise_id: editingExercise.id, text: opt.texto, "order": i }]).select().single();
            if (insErr) throw insErr;
            inserted.push({ id: (insData as { id: string; text: string }).id, text: (insData as { id: string; text: string }).text });
          }

          // update correct_option_id using the index of the selected option
          const selectedIndex = exerciseForm.opciones.findIndex(p => p.id === exerciseForm.respuestaCorrecta);
          const correctOpt = inserted[selectedIndex] || inserted[0];
          if (correctOpt) {
            const { error: updCor } = await supabase.from('exercises').update({ correct_option_id: correctOpt.id }).eq('id', editingExercise.id);
            if (updCor) throw updCor;
          }

          toast({ title: 'Ejercicio actualizado', description: 'El ejercicio ha sido actualizado correctamente.' });
        } else {
          // create exercise
          const order = currentLesson.notas.length + currentLesson.ejercicios.length;
          const { data: exData, error: exErr } = await supabase.from('exercises').insert([{
            lesson_id: currentLesson.id,
            description: exerciseForm.descripcion,
            type: exerciseForm.tipo,
            content: exerciseForm.contenido,
            image_url: imageUrl,
            audio_url: audioUrl,
            mandatory: exerciseForm.obligatorio,
            active: exerciseForm.activo,
            points: (exerciseForm as any).points ?? 0,
            "order": order
          }]).select().single();
          if (exErr) throw exErr;

          const inserted: Array<{ id: string; text: string }> = [];
          for (let i = 0; i < exerciseForm.opciones.length; i++) {
            const opt = exerciseForm.opciones[i];
            const { data: insData, error: insErr } = await supabase.from('exercise_options').insert([{ exercise_id: exData.id, text: opt.texto, "order": i }]).select().single();
            if (insErr) throw insErr;
            inserted.push({ id: (insData as { id: string; text: string }).id, text: (insData as { id: string; text: string }).text });
          }

          // update correct_option_id using the index of the selected option
          const idx = exerciseForm.opciones.findIndex(o => o.id === exerciseForm.respuestaCorrecta);
          const correctOpt = inserted[idx] || inserted[0];
          if (correctOpt) {
            const { error: updCor } = await supabase.from('exercises').update({ correct_option_id: correctOpt.id }).eq('id', exData.id);
            if (updCor) throw updCor;
          }

          toast({ title: 'Ejercicio creado', description: 'El ejercicio ha sido creado correctamente.' });
        }

        setIsExerciseModalOpen(false);
        setEditingExercise(null);
        await loadDetail();
      } catch (err) {
        console.error(err);
        toast({ title: 'Error', description: 'No se pudo guardar el ejercicio.' });
      } finally {
        setIsExerciseSaving(false);
      }
    })();
  };

  const handleDeleteExercise = (exerciseId: string) => {
    setDeleteDialog({
      isOpen: true,
      onConfirm: () => {
        (async () => {
          try {
            const { error } = await supabase.from('exercises').delete().eq('id', exerciseId);
            if (error) throw error;
            toast({ title: 'Ejercicio eliminado', description: 'El ejercicio ha sido eliminado correctamente.' });
            await loadDetail();
          } catch (err) {
            console.error(err);
            toast({ title: 'Error', description: 'No se pudo eliminar el ejercicio.' });
          }
        })();
      },
    });
  };

  const handleToggleExerciseActive = (exerciseId: string) => {
    (async () => {
      try {
        const ex = currentLesson.ejercicios.find(e => e.id === exerciseId);
        if (!ex) return;
        const { error } = await supabase.from('exercises').update({ active: !ex.activo }).eq('id', exerciseId);
        if (error) throw error;
        toast({ title: 'Estado actualizado', description: 'El estado del ejercicio ha sido actualizado.' });
        await loadDetail();
      } catch (err) {
        console.error(err);
        toast({ title: 'Error', description: 'No se pudo actualizar el estado.' });
      }
    })();
  };

  const handleMoveUp = (itemId: string) => {
    const currentIndex = contentItems.findIndex(item => item.id === itemId);
    if (currentIndex <= 0) return;

    const updatedLesson = { ...currentLesson };
    const reorderedItems = [...contentItems];

    // Swap with previous item
    [reorderedItems[currentIndex - 1], reorderedItems[currentIndex]] =
      [reorderedItems[currentIndex], reorderedItems[currentIndex - 1]];

    // Update orden values for all items
    reorderedItems.forEach((item, index) => {
      item.orden = index;
    });

    // Separate back into notes and exercises
    updatedLesson.notas = reorderedItems
      .filter((item): item is Note & { type: 'note' } => item.type === 'note')
      .map(({ type, ...note }) => note);

    updatedLesson.ejercicios = reorderedItems
      .filter((item): item is Exercise & { type: 'exercise' } => item.type === 'exercise')
      .map(({ type, ...exercise }) => exercise);

    setCurrentLesson(updatedLesson);
    // persist orders
    (async () => {
      try {
        // update notes
        for (const n of updatedLesson.notas) {
          await supabase.from('notes').update({ "order": n.orden }).eq('id', n.id);
        }
        for (const e of updatedLesson.ejercicios) {
          await supabase.from('exercises').update({ "order": e.orden }).eq('id', e.id);
        }
        await loadDetail();
      } catch (err) {
        console.error('Error updating order', err);
        toast({ title: 'Error', description: 'No se pudo actualizar el orden.' });
      }
    })();
  };

  const handleMoveDown = (itemId: string) => {
    const currentIndex = contentItems.findIndex(item => item.id === itemId);
    if (currentIndex >= contentItems.length - 1) return;

    const updatedLesson = { ...currentLesson };
    const reorderedItems = [...contentItems];

    // Swap with next item
    [reorderedItems[currentIndex], reorderedItems[currentIndex + 1]] =
      [reorderedItems[currentIndex + 1], reorderedItems[currentIndex]];

    // Update orden values for all items
    reorderedItems.forEach((item, index) => {
      item.orden = index;
    });

    // Separate back into notes and exercises
    updatedLesson.notas = reorderedItems
      .filter((item): item is Note & { type: 'note' } => item.type === 'note')
      .map(({ type, ...note }) => note);

    updatedLesson.ejercicios = reorderedItems
      .filter((item): item is Exercise & { type: 'exercise' } => item.type === 'exercise')
      .map(({ type, ...exercise }) => exercise);

    setCurrentLesson(updatedLesson);
    (async () => {
      try {
        for (const n of updatedLesson.notas) {
          await supabase.from('notes').update({ "order": n.orden }).eq('id', n.id);
        }
        for (const e of updatedLesson.ejercicios) {
          await supabase.from('exercises').update({ "order": e.orden }).eq('id', e.id);
        }
        await loadDetail();
      } catch (err) {
        console.error('Error updating order', err);
        toast({ title: 'Error', description: 'No se pudo actualizar el orden.' });
      }
    })();
  };

  const addOption = () => {
    const newOption: ExerciseOption = {
      id: Date.now().toString(),
      texto: ""
    };
    setExerciseForm(prev => ({
      ...prev,
      opciones: [...prev.opciones, newOption]
    }));
  };

  const removeOption = (optionId: string) => {
    setExerciseForm(prev => ({
      ...prev,
      opciones: prev.opciones.filter(opt => opt.id !== optionId),
      respuestaCorrecta: prev.respuestaCorrecta === optionId ? "" : prev.respuestaCorrecta
    }));
  };

  const updateOption = (optionId: string, texto: string) => {
    setExerciseForm(prev => ({
      ...prev,
      opciones: prev.opciones.map(opt =>
        opt.id === optionId ? { ...opt, texto } : opt
      )
    }));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" onClick={onBack}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Volver a Lecciones
        </Button>
        <div>
          <h1 className="text-3xl font-bold text-foreground">{currentLesson.titulo}</h1>
          <p className="text-muted-foreground">{currentLesson.descripcion}</p>
        </div>
      </div>

      <div className="flex gap-4">
        <Badge className="bg-primary text-primary-foreground">
          Nivel {currentLesson.nivelAsociado}
        </Badge>
        <Badge variant={currentLesson.obligatoria ? "default" : "secondary"}>
          {currentLesson.obligatoria ? "Obligatoria" : "Opcional"}
        </Badge>
      </div>

      <Card className="shadow-card">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Contenido de la Lección ({contentItems.length})</CardTitle>
          <div className="flex gap-2">
            <Button onClick={handleCreateNote} size="sm" variant="outline">
              <FileText className="w-4 h-4 mr-2" />
              Nueva Nota
            </Button>
            <Button onClick={handleCreateExercise} size="sm">
              <BookOpen className="w-4 h-4 mr-2" />
              Nuevo Ejercicio
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {contentItems.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              No hay contenido creado. Usa los botones "Nueva Nota" o "Nuevo Ejercicio" para comenzar.
            </p>
          ) : (
            <div className="space-y-4">
              {contentItems.map((item, index) => (
                <ContentItem
                  key={item.id}
                  item={item}
                  isFirst={index === 0}
                  isLast={index === contentItems.length - 1}
                  onMoveUp={handleMoveUp}
                  onMoveDown={handleMoveDown}
                  onEditNote={handleEditNote}
                  onDeleteNote={handleDeleteNote}
                  onToggleNoteActive={handleToggleNoteActive}
                  onEditExercise={handleEditExercise}
                  onDeleteExercise={handleDeleteExercise}
                  onToggleExerciseActive={handleToggleExerciseActive}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Note Modal */}
      <Dialog open={isNoteModalOpen} onOpenChange={setIsNoteModalOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingNote ? "Editar Nota" : "Nueva Nota"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Título *</Label>
              <Input
                value={noteForm.titulo}
                onChange={(e) => setNoteForm(prev => ({ ...prev, titulo: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Descripción</Label>
              <Textarea
                value={noteForm.descripcion}
                onChange={(e) => setNoteForm(prev => ({ ...prev, descripcion: e.target.value }))}
                rows={6}
                placeholder="Escribe el contenido de la nota aquí..."
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Imágenes</Label>
                <div className="border-2 border-dashed border-muted rounded-lg p-4 text-center min-h-28 flex flex-col items-center justify-center">
                  {/* Show upload icon/label only when there is no saved image and no selected file */}
                  {(!noteForm.imagenes || noteForm.imagenes.length === 0) && !noteForm.imagenFile ? (
                    <>
                      <Upload className="w-6 h-6 mx-auto mb-2 text-muted-foreground" />
                      <p className="text-xs text-muted-foreground">Imagen</p>
                    </>
                  ) : null}

                  {noteForm.imagenFile && <p className="text-xs mt-2">Archivo: {noteForm.imagenFile.name}</p>}
                  {/* Preview either selected local file or saved remote url */}
                  {noteImagePreview && (
                    <div className="mt-2 w-full flex justify-center">
                      <img src={noteImagePreview} alt="preview" className="max-h-28 rounded object-contain" />
                    </div>
                  )}

                  <div className="flex flex-col items-center justify-center gap-2 mt-2">
                    <input ref={noteImageInputRef} className="hidden" type="file" accept="image/*" onChange={(e) => setNoteForm(prev => ({ ...prev, imagenFile: e.target.files && e.target.files[0] || null }))} />
                    <Button size="sm" variant="outline" onClick={() => noteImageInputRef.current?.click()}>Seleccionar imagen</Button>
                    <Button size="sm" variant="ghost" onClick={() => setNoteForm(prev => ({ ...prev, imagenFile: null }))}>Quitar selección</Button>
                    {noteForm.imagenes && noteForm.imagenes.length > 0 && (
                      <Button size="sm" variant="destructive" onClick={() => setNoteForm(prev => ({ ...prev, imagenes: [] }))}>Eliminar guardada</Button>
                    )}
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Audio</Label>
                <div className="border-2 border-dashed border-muted rounded-lg p-4 text-center min-h-28 flex flex-col items-center justify-center">
                  {(!noteForm.audios || noteForm.audios.length === 0) && !noteForm.audioFile ? (
                    <>
                      <Upload className="w-6 h-6 mx-auto mb-2 text-muted-foreground" />
                      <p className="text-xs text-muted-foreground">Audio</p>
                    </>
                  ) : null}

                  {noteForm.audioFile && <p className="text-xs mt-2">Archivo: {noteForm.audioFile.name}</p>}
                  {noteAudioPreview && (
                    <div className="mt-2 w-full flex justify-center">
                      <audio controls src={noteAudioPreview} className="mx-auto" />
                    </div>
                  )}

                  <div className="flex flex-col items-center justify-center gap-2 mt-2">
                    <input ref={noteAudioInputRef} className="hidden" type="file" accept="audio/*" onChange={(e) => setNoteForm(prev => ({ ...prev, audioFile: e.target.files && e.target.files[0] || null }))} />
                    <Button size="sm" variant="outline" onClick={() => noteAudioInputRef.current?.click()}>Seleccionar audio</Button>
                    <Button size="sm" variant="ghost" onClick={() => setNoteForm(prev => ({ ...prev, audioFile: null }))}>Quitar selección</Button>
                    {noteForm.audios && noteForm.audios.length > 0 && (
                      <Button size="sm" variant="destructive" onClick={() => setNoteForm(prev => ({ ...prev, audios: [] }))}>Eliminar guardada</Button>
                    )}
                  </div>
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                checked={noteForm.activo}
                onCheckedChange={(checked) => setNoteForm(prev => ({ ...prev, activo: checked }))}
              />
              <Label>Nota Activa</Label>
            </div>

            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setIsNoteModalOpen(false)} disabled={isNoteSaving}>
                Cancelar
              </Button>
              <Button onClick={handleSaveNote} disabled={isNoteSaving}>
                {isNoteSaving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />{editingNote ? 'Actualizando...' : 'Guardando...'}</> : (editingNote ? "Actualizar" : "Crear") + ' Nota'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Exercise Modal */}
      <Dialog open={isExerciseModalOpen} onOpenChange={setIsExerciseModalOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingExercise ? "Editar Ejercicio" : "Nuevo Ejercicio"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-6">
            <div className="space-y-2">
              <Label>Descripción del Ejercicio *</Label>
              <Input
                value={exerciseForm.descripcion}
                onChange={(e) => setExerciseForm(prev => ({ ...prev, descripcion: e.target.value }))}
                placeholder="Describe brevemente el ejercicio..."
              />
            </div>

            <div className="space-y-2">
              <Label>Tipo de Ejercicio</Label>
              <Select
                value={exerciseForm.tipo}
                onValueChange={(value) => setExerciseForm(prev => ({ ...prev, tipo: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {exerciseTypes.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Contenido del Ejercicio</Label>
              <div className="border rounded-md">
                <ReactQuill
                  value={exerciseForm.contenido}
                  onChange={(value) => setExerciseForm(prev => ({ ...prev, contenido: value }))}
                  placeholder="Escribe el contenido del ejercicio aquí..."
                  theme="snow"
                  modules={{
                    toolbar: [
                      [{ 'header': [1, 2, 3, false] }],
                      ['bold', 'italic', 'underline', 'strike'],
                      [{ 'list': 'ordered' }, { 'list': 'bullet' }],
                      [{ 'color': [] }, { 'background': [] }],
                      ['link', 'image'],
                      ['clean']
                    ],
                  }}
                  style={{ minHeight: '200px' }}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Imágenes</Label>
                <div className="border-2 border-dashed border-muted rounded-lg p-4 text-center min-h-28 flex flex-col items-center justify-center">
                  {(!exerciseForm.imagenes || exerciseForm.imagenes.length === 0) && !exerciseForm.imagenFile ? (
                    <>
                      <Upload className="w-6 h-6 mx-auto mb-2 text-muted-foreground" />
                      <p className="text-xs text-muted-foreground">Imagen</p>
                    </>
                  ) : null}

                  {exerciseForm.imagenFile && <p className="text-xs mt-2">Archivo: {exerciseForm.imagenFile.name}</p>}
                  {exerciseImagePreview && (
                    <div className="mt-2 w-full flex justify-center">
                      <img src={exerciseImagePreview} alt="preview" className="max-h-28 rounded object-contain" />
                    </div>
                  )}

                  <div className="flex flex-col items-center justify-center gap-2 mt-2">
                    <input ref={exerciseImageInputRef} className="hidden" type="file" accept="image/*" onChange={(e) => setExerciseForm(prev => ({ ...prev, imagenFile: e.target.files && e.target.files[0] || null }))} />
                    <Button size="sm" variant="outline" onClick={() => exerciseImageInputRef.current?.click()}>Seleccionar imagen</Button>
                    <Button size="sm" variant="ghost" onClick={() => setExerciseForm(prev => ({ ...prev, imagenFile: null }))}>Quitar selección</Button>
                    {exerciseForm.imagenes && exerciseForm.imagenes.length > 0 && (
                      <Button size="sm" variant="destructive" onClick={() => setExerciseForm(prev => ({ ...prev, imagenes: [] }))}>Eliminar guardada</Button>
                    )}
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Audio</Label>
                <div className="border-2 border-dashed border-muted rounded-lg p-4 text-center min-h-28 flex flex-col items-center justify-center">
                  {(!exerciseForm.audios || exerciseForm.audios.length === 0) && !exerciseForm.audioFile ? (
                    <>
                      <Upload className="w-6 h-6 mx-auto mb-2 text-muted-foreground" />
                      <p className="text-xs text-muted-foreground">Audio</p>
                    </>
                  ) : null}

                  {exerciseForm.audioFile && <p className="text-xs mt-2">Archivo: {exerciseForm.audioFile.name}</p>}
                  {exerciseAudioPreview && (
                    <div className="mt-2 w-full flex justify-center">
                      <audio controls src={exerciseAudioPreview} className="mx-auto" />
                    </div>
                  )}

                  <div className="flex flex-col items-center justify-center gap-2 mt-2">
                    <input ref={exerciseAudioInputRef} className="hidden" type="file" accept="audio/*" onChange={(e) => setExerciseForm(prev => ({ ...prev, audioFile: e.target.files && e.target.files[0] || null }))} />
                    <Button size="sm" variant="outline" onClick={() => exerciseAudioInputRef.current?.click()}>Seleccionar audio</Button>
                    <Button size="sm" variant="ghost" onClick={() => setExerciseForm(prev => ({ ...prev, audioFile: null }))}>Quitar selección</Button>
                    {exerciseForm.audios && exerciseForm.audios.length > 0 && (
                      <Button size="sm" variant="destructive" onClick={() => setExerciseForm(prev => ({ ...prev, audios: [] }))}>Eliminar guardada</Button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <Label>Opciones de Respuesta</Label>
                <Button type="button" onClick={addOption} variant="outline" size="sm">
                  <Plus className="w-4 h-4 mr-2" />
                  Agregar Opción
                </Button>
              </div>

              {exerciseForm.opciones.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">
                  Agrega al menos 2 opciones de respuesta
                </p>
              ) : (
                <div className="space-y-3">
                  {exerciseForm.opciones.map((option, index) => (
                    <div key={option.id} className="flex items-center gap-3 p-3 border rounded-lg">
                      <div className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="correctAnswer"
                          checked={exerciseForm.respuestaCorrecta === option.id}
                          onChange={() => setExerciseForm(prev => ({ ...prev, respuestaCorrecta: option.id }))}
                          className="w-4 h-4"
                        />
                        <Label className="text-sm">Opción {index + 1}</Label>
                      </div>
                      <Input
                        value={option.texto}
                        onChange={(e) => updateOption(option.id, e.target.value)}
                        placeholder={`Texto de la opción ${index + 1}...`}
                        className="flex-1"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => removeOption(option.id)}
                        className="text-destructive"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Switch
                  checked={exerciseForm.obligatorio}
                  onCheckedChange={(checked) => setExerciseForm(prev => ({ ...prev, obligatorio: checked }))}
                />
                <Label>Ejercicio Obligatorio</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  checked={exerciseForm.activo}
                  onCheckedChange={(checked) => setExerciseForm(prev => ({ ...prev, activo: checked }))}
                />
                <Label>Ejercicio Activo</Label>
              </div>
              <div className="space-y-2">
                <Label htmlFor="exercise-points">Puntos Ganados</Label>
                <Input id="exercise-points" type="number" min={0} step={1} value={String((exerciseForm as any).points ?? 0)} onChange={(e) => setExerciseForm(prev => ({ ...prev, points: Math.max(0, parseInt(e.target.value || '0') || 0) }))} />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button variant="outline" onClick={() => setIsExerciseModalOpen(false)} disabled={isExerciseSaving}>
                Cancelar
              </Button>
              <Button onClick={handleSaveExercise} disabled={isExerciseSaving}>
                {isExerciseSaving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />{editingExercise ? 'Actualizando...' : 'Guardando...'}</> : (editingExercise ? "Actualizar" : "Crear") + ' Ejercicio'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <DeleteConfirmationDialog
        isOpen={deleteDialog.isOpen}
        onClose={() => setDeleteDialog({ ...deleteDialog, isOpen: false })}
        onConfirm={deleteDialog.onConfirm}
      />
    </div>
  );
}

// Content Item Component
function ContentItem({
  item,
  isFirst,
  isLast,
  onMoveUp,
  onMoveDown,
  onEditNote,
  onDeleteNote,
  onToggleNoteActive,
  onEditExercise,
  onDeleteExercise,
  onToggleExerciseActive
}: {
  item: ContentItem;
  isFirst: boolean;
  isLast: boolean;
  onMoveUp: (id: string) => void;
  onMoveDown: (id: string) => void;
  onEditNote: (note: Note) => void;
  onDeleteNote: (id: string) => void;
  onToggleNoteActive: (id: string) => void;
  onEditExercise: (exercise: Exercise) => void;
  onDeleteExercise: (id: string) => void;
  onToggleExerciseActive: (id: string) => void;
}) {
  return (
    <div className={`border rounded-lg p-4 ${!item.activo ? 'opacity-50 bg-muted/30' : ''}`}>
      <div className="flex justify-between items-start gap-4">
        <div className="flex items-start gap-3 flex-1">
          <div className="flex flex-col gap-1 mt-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onMoveUp(item.id)}
              disabled={isFirst}
              className="h-7 w-7 p-0"
              title="Subir"
            >
              <ChevronUp className="w-4 h-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onMoveDown(item.id)}
              disabled={isLast}
              className="h-7 w-7 p-0"
              title="Bajar"
            >
              <ChevronDown className="w-4 h-4" />
            </Button>
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              {item.type === 'note' ? (
                <FileText className="w-4 h-4 text-blue-500" />
              ) : (
                <BookOpen className="w-4 h-4 text-green-500" />
              )}
              <h3 className="font-semibold">
                {item.type === 'note' ? (item as Note).titulo : (item as Exercise).descripcion}
              </h3>
              {!item.activo && <EyeOff className="w-4 h-4 text-muted-foreground" />}
            </div>

            {item.type === 'note' ? (
              <div>
                <p className="text-sm text-muted-foreground mb-2">
                  {(item as Note).descripcion}
                </p>
                <div className="flex gap-2">
                  {(item as Note).imagenes.length > 0 && (
                    <Badge variant="outline">
                      {(item as Note).imagenes.length} imagen(es)
                    </Badge>
                  )}
                  {(item as Note).audios.length > 0 && (
                    <Badge variant="outline">
                      {(item as Note).audios.length} audio(s)
                    </Badge>
                  )}
                </div>
              </div>
            ) : (
              <div>
                <p className="text-sm text-muted-foreground mb-2">
                  {(item as Exercise).tipo}
                </p>
                {/* Render rich text content (stored as HTML) */}
                {(item as Exercise).contenido ? (
                  // Sanitize HTML before rendering to avoid XSS
                  <div
                    className="prose prose-sm min-h-[4rem] max-h-24 overflow-hidden mb-2"
                    dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize((item as Exercise).contenido) }}
                  />
                ) : null}
                <div className="flex gap-2">
                  <Badge variant={(item as Exercise).obligatorio ? "default" : "secondary"}>
                    {(item as Exercise).obligatorio ? "Obligatorio" : "Opcional"}
                  </Badge>
                  <Badge variant="outline">
                    {(item as Exercise).opciones.length} opciones
                  </Badge>
                </div>
              </div>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => item.type === 'note' ? onToggleNoteActive(item.id) : onToggleExerciseActive(item.id)}
            title={item.activo ? "Desactivar" : "Activar"}
          >
            {item.activo ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => item.type === 'note' ? onEditNote(item as Note) : onEditExercise(item as Exercise)}
          >
            <Edit className="w-4 h-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => item.type === 'note' ? onDeleteNote(item.id) : onDeleteExercise(item.id)}
            className="text-destructive"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}