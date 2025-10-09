import { useState } from "react";
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
import { useToast } from "@/hooks/use-toast";

export interface Lesson {
  id: string;
  titulo: string;
  descripcion: string;
  nivelAsociado: string;
  obligatoria: boolean;
  fechaCreacion: Date;
  notas: Note[];
  ejercicios: Exercise[];
}

export interface Note {
  id: string;
  titulo: string;
  descripcion: string;
  imagenes: string[];
  activo: boolean;
  orden: number;
}

export interface ExerciseOption {
  id: string;
  texto: string;
}

export interface Exercise {
  id: string;
  descripcion: string;
  tipo: string;
  contenido: string; // Rich text content
  imagenes: string[];
  audios: string[];
  opciones: ExerciseOption[];
  respuestaCorrecta: string; // ID of the correct option
  obligatorio: boolean;
  activo: boolean;
  orden: number;
}

const mockLessons: Lesson[] = [
  {
    id: "1",
    titulo: "Presente Simple",
    descripcion: "Introducción al presente simple en inglés",
    nivelAsociado: "A1",
    obligatoria: true,
    fechaCreacion: new Date("2024-01-10"),
    notas: [
      {
        id: "1",
        titulo: "Formación del Presente Simple",
        descripcion: "El presente simple se forma con el verbo en infinitivo...",
        imagenes: [],
        activo: true,
        orden: 0
      }
    ],
    ejercicios: [
      {
        id: "1",
        descripcion: "Completa las oraciones con el presente simple",
        tipo: "Gramática y Ortografía",
        contenido: "Selecciona la forma correcta del verbo en presente simple.",
        imagenes: [],
        audios: [],
        opciones: [
          { id: "1", texto: "She work in the office" },
          { id: "2", texto: "She works in the office" },
          { id: "3", texto: "She working in the office" }
        ],
        respuestaCorrecta: "2",
        obligatorio: true,
        activo: true,
        orden: 1
      }
    ]
  },
  {
    id: "2",
    titulo: "Past Continuous",
    descripcion: "Uso del pasado continuo para acciones en progreso",
    nivelAsociado: "B1",
    obligatoria: false,
    fechaCreacion: new Date("2024-02-15"),
    notas: [],
    ejercicios: []
  }
];

const levelColors = {
  A1: "bg-red-100 text-red-800",
  A2: "bg-orange-100 text-orange-800",
  B1: "bg-yellow-100 text-yellow-800",
  B2: "bg-blue-100 text-blue-800",
  C1: "bg-green-100 text-green-800",
  C2: "bg-purple-100 text-purple-800"
};

export default function CourseManagement() {
  const [lessons, setLessons] = useState<Lesson[]>(mockLessons);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedLevel, setSelectedLevel] = useState<string>("all");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingLesson, setEditingLesson] = useState<Lesson | null>(null);
  const [selectedLesson, setSelectedLesson] = useState<Lesson | null>(null);
  const { toast } = useToast();

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
    setSelectedLesson(lesson);
  };

  const handleDeleteLesson = (lessonId: string) => {
    setLessons(lessons.filter(l => l.id !== lessonId));
    toast({
      title: "Lección eliminada",
      description: "La lección ha sido eliminada correctamente.",
    });
  };

  const handleSaveLesson = (lessonData: Omit<Lesson, 'id' | 'fechaCreacion' | 'notas' | 'ejercicios'>) => {
    if (editingLesson) {
      setLessons(lessons.map(lesson =>
        lesson.id === editingLesson.id
          ? { 
              ...lesson, 
              ...lessonData
            }
          : lesson
      ));
      toast({
        title: "Lección actualizada",
        description: "Los datos de la lección han sido actualizados correctamente.",
      });
    } else {
      const newLesson: Lesson = {
        ...lessonData,
        id: Date.now().toString(),
        fechaCreacion: new Date(),
        notas: [],
        ejercicios: []
      };
      setLessons([...lessons, newLesson]);
      toast({
        title: "Lección creada",
        description: "La nueva lección ha sido creada correctamente.",
      });
    }
    setIsModalOpen(false);
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
    </div>
  );
}