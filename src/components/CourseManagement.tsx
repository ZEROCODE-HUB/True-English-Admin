import { useState, useEffect } from "react";
import { Plus, Edit, Eye, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import LessonFormModal from "./LessonFormModal";
import LessonDetailView from "./LessonDetailView";
import { supabase } from "@/lib/supabase";
import DeleteConfirmationDialog from "./DeleteConfirmationDialog";
import { useToast } from "@/hooks/use-toast";
import type { Lesson, Note, Exercise, ExerciseOption, RPCLessonCore, RPCGetLessonDetailResponse, RPCContentItem } from '@/types/db';

// lessons will be loaded from Supabase

const levelColors = {
  A1: "bg-red-100 text-red-800",
  A2: "bg-orange-100 text-orange-800",
  B1: "bg-yellow-100 text-yellow-800",
  B2: "bg-blue-100 text-blue-800",
  C1: "bg-green-100 text-green-800",
  C2: "bg-purple-100 text-purple-800"
};

export default function CourseManagement() {
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedLevel, setSelectedLevel] = useState<string>("all");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingLesson, setEditingLesson] = useState<Lesson | null>(null);
  const [selectedLesson, setSelectedLesson] = useState<Lesson | null>(null);
  const [deleteDialog, setDeleteDialog] = useState<{
    isOpen: boolean;
    onConfirm: () => void;
  }>({ isOpen: false, onConfirm: () => { } });
  const { toast } = useToast();

  useEffect(() => {
    const fetchLessons = async () => {
      try {
        const { data, error } = await supabase.rpc('get_lessons', { p_search: '', p_level: 'all', p_limit: 100, p_offset: 0 });
        if (error) throw error;
        const payload = data as { data?: RPCLessonCore[]; count?: number } | null;
        const items = payload?.data || [];
        const mapped = items.map((l: RPCLessonCore) => ({
          id: l.id,
          titulo: l.title,
          descripcion: l.description,
          nivelAsociado: l.level,
          obligatoria: l.mandatory,
          fechaCreacion: l.created_at,
          notas: [],
          ejercicios: []
        }));
        setLessons(mapped);
      } catch (err) {
        console.error('Error fetching lessons', err);
        toast({ title: 'Error', description: 'No se pudieron cargar las lecciones.' });
      }
    };

    fetchLessons();
  }, [toast]);

  const filteredLessons = lessons.filter(lesson => {
    const matchesSearch = lesson.titulo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lesson.descripcion.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesLevel = selectedLevel === "all" || lesson.nivelAsociado === selectedLevel;
    return matchesSearch && matchesLevel;
  });

  const handleCreateLesson = () => {
    setEditingLesson(null);
    setIsModalOpen(true);
  };

  const handleEditLesson = (lesson: Lesson) => {
    setEditingLesson(lesson);
    setIsModalOpen(true);
  };

  const handleViewLesson = (lesson: Lesson) => {
    // fetch detail payload via RPC and set selectedLesson mapped to UI model
    (async () => {
      try {
        const { data, error } = await supabase.rpc('get_lesson_detail', { p_lesson_id: lesson.id });
        if (error) throw error;
        const payload = data as RPCGetLessonDetailResponse;
        const core = payload.lesson;
        const content: RPCContentItem[] = payload.content || [];

        const notas = content.filter((c) => c.kind === 'note').map((n) => ({
          id: n.id,
          titulo: n.title || '',
          descripcion: n.content || '',
          imagenes: n.image_url ? [n.image_url] : [],
          audios: n.audio_url ? [n.audio_url] : [],
          activo: n.active || false,
          orden: n.order || 0
        }));

        const ejercicios = content.filter((c) => c.kind === 'exercise').map((e) => ({
          id: e.id,
          descripcion: e.title || '',
          tipo: e.type || '',
          contenido: e.content || '',
          imagenes: e.image_url ? [e.image_url] : [],
          audios: e.audio_url ? [e.audio_url] : [],
          opciones: (e.options || []).map((o) => ({ id: o.id, texto: o.text })),
          respuestaCorrecta: e.correct_option_id || '',
          obligatorio: e.mandatory || false,
          activo: e.active || false,
          orden: e.order || 0
        }));

        const mappedLesson: Lesson = {
          id: core.id,
          titulo: core.title,
          descripcion: core.description,
          nivelAsociado: core.level,
          obligatoria: core.mandatory,
          fechaCreacion: core.created_at,
          notas,
          ejercicios
        };

        setSelectedLesson(mappedLesson);
      } catch (err) {
        console.error(err);
        toast({ title: 'Error', description: 'No se pudo cargar el detalle de la lección.' });
      }
    })();
  };

  const handleDeleteLesson = (lessonId: string) => {
    setDeleteDialog({
      isOpen: true,
      onConfirm: () => {
        (async () => {
          try {
            const { error } = await supabase.from('lessons').delete().eq('id', lessonId);
            if (error) throw error;
            setLessons(prev => prev.filter(l => l.id !== lessonId));
            toast({ title: 'Lección eliminada', description: 'La lección ha sido eliminada correctamente.' });
          } catch (err) {
            console.error(err);
            toast({ title: 'Error', description: 'No se pudo eliminar la lección.' });
          }
        })();
      },
    });
  };

  const handleSaveLesson = async (lessonData: Omit<Lesson, 'id' | 'fechaCreacion' | 'notas' | 'ejercicios'>) => {
    try {
      if (editingLesson) {
        const { error } = await supabase.from('lessons').update({
          title: lessonData.titulo,
          description: lessonData.descripcion,
          level: lessonData.nivelAsociado,
          mandatory: lessonData.obligatoria
        }).eq('id', editingLesson.id);
        if (error) throw error;
        // update local state with edited values
        const updatedLesson: Lesson = {
          ...editingLesson,
          titulo: lessonData.titulo,
          descripcion: lessonData.descripcion,
          nivelAsociado: lessonData.nivelAsociado,
          obligatoria: lessonData.obligatoria
        };
        setLessons(prev => prev.map(l => l.id === updatedLesson.id ? updatedLesson : l));
        toast({ title: 'Lección actualizada', description: 'Los datos de la lección han sido actualizados correctamente.' });
      } else {
        const { data, error } = await supabase.from('lessons').insert([{
          title: lessonData.titulo,
          description: lessonData.descripcion,
          level: lessonData.nivelAsociado,
          mandatory: lessonData.obligatoria
        }]).select().single();
        if (error) throw error;
        setLessons(prev => [{
          id: data.id,
          titulo: data.title,
          descripcion: data.description,
          nivelAsociado: data.level,
          obligatoria: data.mandatory,
          fechaCreacion: data.created_at,
          notas: [],
          ejercicios: []
        }, ...prev]);
        toast({ title: 'Lección creada', description: 'La nueva lección ha sido creada correctamente.' });
      }
      setIsModalOpen(false);
      setEditingLesson(null);
    } catch (err) {
      console.error(err);
      toast({ title: 'Error', description: 'No se pudo guardar la lección.' });
    }
  };

  const handleUpdateLesson = (updatedLesson: Lesson) => {
    setLessons(lessons.map(lesson =>
      lesson.id === updatedLesson.id ? updatedLesson : lesson
    ));
    setSelectedLesson(updatedLesson);
  };

  if (selectedLesson) {
    return (
      <LessonDetailView
        lesson={selectedLesson}
        onBack={() => setSelectedLesson(null)}
        onUpdate={handleUpdateLesson}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Gestión de Cursos</h1>
          <p className="text-muted-foreground">Administra las lecciones y contenido educativo</p>
        </div>
        <Button onClick={handleCreateLesson} className="bg-primary hover:bg-primary-hover">
          <Plus className="w-4 h-4 mr-2" />
          Nueva Lección
        </Button>
      </div>

      <Card className="shadow-card">
        <CardHeader>
          <CardTitle>Buscar Lecciones</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <div className="flex-1">
              <Input
                placeholder="Buscar por título o descripción..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="w-48">
              <Select value={selectedLevel} onValueChange={setSelectedLevel}>
                <SelectTrigger>
                  <SelectValue placeholder="Filtrar por nivel" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los niveles</SelectItem>
                  <SelectItem value="A1">A1</SelectItem>
                  <SelectItem value="A2">A2</SelectItem>
                  <SelectItem value="B1">B1</SelectItem>
                  <SelectItem value="B2">B2</SelectItem>
                  <SelectItem value="C1">C1</SelectItem>
                  <SelectItem value="C2">C2</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-card">
        <CardHeader>
          <CardTitle>Lecciones ({filteredLessons.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Título</TableHead>
                <TableHead>Descripción</TableHead>
                <TableHead>Nivel</TableHead>
                <TableHead>Obligatoria</TableHead>
                <TableHead>Notas</TableHead>
                <TableHead>Ejercicios</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredLessons.map((lesson) => (
                <TableRow key={lesson.id}>
                  <TableCell className="font-medium">{lesson.titulo}</TableCell>
                  <TableCell className="max-w-xs truncate">{lesson.descripcion}</TableCell>
                  <TableCell>
                    <Badge className={levelColors[lesson.nivelAsociado as keyof typeof levelColors]}>
                      {lesson.nivelAsociado}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={lesson.obligatoria ? "default" : "secondary"}>
                      {lesson.obligatoria ? "Sí" : "No"}
                    </Badge>
                  </TableCell>
                  <TableCell>{lesson.notas.length}</TableCell>
                  <TableCell>{lesson.ejercicios.length}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleViewLesson(lesson)}
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEditLesson(lesson)}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDeleteLesson(lesson.id)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <LessonFormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveLesson}
        lesson={editingLesson}
      />

      <DeleteConfirmationDialog
        isOpen={deleteDialog.isOpen}
        onClose={() => setDeleteDialog({ ...deleteDialog, isOpen: false })}
        onConfirm={deleteDialog.onConfirm}
      />
    </div>
  );
}