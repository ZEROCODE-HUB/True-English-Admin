import { useState } from "react";
import { ArrowLeft, Plus, Edit, Trash2, Upload, GripVertical, Eye, EyeOff, FileText, BookOpen } from "lucide-react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import {
  CSS,
} from '@dnd-kit/utilities';
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
import type { Lesson, Note, Exercise, ExerciseOption } from "./CourseManagement";
import ReactQuill from 'react-quill';
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
  const [currentLesson, setCurrentLesson] = useState<Lesson>(lesson);
  const [isNoteModalOpen, setIsNoteModalOpen] = useState(false);
  const [isExerciseModalOpen, setIsExerciseModalOpen] = useState(false);
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [editingExercise, setEditingExercise] = useState<Exercise | null>(null);
  const { toast } = useToast();

  const [noteForm, setNoteForm] = useState({
    titulo: "",
    descripcion: "",
    imagenes: [] as string[],
    activo: true
  });

  const [exerciseForm, setExerciseForm] = useState({
    descripcion: "",
    tipo: exerciseTypes[0],
    contenido: "",
    imagenes: [] as string[],
    audios: [] as string[],
    opciones: [] as ExerciseOption[],
    respuestaCorrecta: "",
    obligatorio: false,
    activo: true
  });

  // Combine notes and exercises into a single sorted array
  const contentItems: ContentItem[] = [
    ...currentLesson.notas.map(note => ({ ...note, type: 'note' as const })),
    ...currentLesson.ejercicios.map(exercise => ({ ...exercise, type: 'exercise' as const }))
  ].sort((a, b) => a.orden - b.orden);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleCreateNote = () => {
    setEditingNote(null);
    setNoteForm({ titulo: "", descripcion: "", imagenes: [], activo: true });
    setIsNoteModalOpen(true);
  };

  const handleEditNote = (note: Note) => {
    setEditingNote(note);
    setNoteForm({
      titulo: note.titulo,
      descripcion: note.descripcion,
      imagenes: note.imagenes,
      activo: note.activo
    });
    setIsNoteModalOpen(true);
  };

  const handleSaveNote = () => {
    if (!noteForm.titulo.trim()) {
      toast({
        title: "Error",
        description: "El título es requerido",
        variant: "destructive"
      });
      return;
    }

    const updatedLesson = { ...currentLesson };
    
    if (editingNote) {
      updatedLesson.notas = updatedLesson.notas.map(note =>
        note.id === editingNote.id ? { ...note, ...noteForm } : note
      );
    } else {
      const newNote: Note = {
        ...noteForm,
        id: Date.now().toString(),
        orden: [...updatedLesson.notas, ...updatedLesson.ejercicios].length
      };
      updatedLesson.notas = [...updatedLesson.notas, newNote];
    }

    setCurrentLesson(updatedLesson);
    onUpdate(updatedLesson);
    setIsNoteModalOpen(false);
    
    toast({
      title: editingNote ? "Nota actualizada" : "Nota creada",
      description: `La nota ha sido ${editingNote ? "actualizada" : "creada"} correctamente.`,
    });
  };

  const handleDeleteNote = (noteId: string) => {
    const updatedLesson = {
      ...currentLesson,
      notas: currentLesson.notas.filter(note => note.id !== noteId)
    };
    setCurrentLesson(updatedLesson);
    onUpdate(updatedLesson);
    
    toast({
      title: "Nota eliminada",
      description: "La nota ha sido eliminada correctamente.",
    });
  };

  const handleToggleNoteActive = (noteId: string) => {
    const updatedLesson = {
      ...currentLesson,
      notas: currentLesson.notas.map(note =>
        note.id === noteId ? { ...note, activo: !note.activo } : note
      )
    };
    setCurrentLesson(updatedLesson);
    onUpdate(updatedLesson);
    
    toast({
      title: "Estado actualizado",
      description: "El estado de la nota ha sido actualizado.",
    });
  };

  const handleCreateExercise = () => {
    setEditingExercise(null);
    setExerciseForm({ 
      descripcion: "",
      tipo: exerciseTypes[0], 
      contenido: "",
      imagenes: [],
      audios: [],
      opciones: [],
      respuestaCorrecta: "",
      obligatorio: false,
      activo: true
    });
    setIsExerciseModalOpen(true);
  };

  const handleEditExercise = (exercise: Exercise) => {
    setEditingExercise(exercise);
    setExerciseForm({
      descripcion: exercise.descripcion,
      tipo: exercise.tipo,
      contenido: exercise.contenido,
      imagenes: exercise.imagenes,
      audios: exercise.audios,
      opciones: exercise.opciones,
      respuestaCorrecta: exercise.respuestaCorrecta,
      obligatorio: exercise.obligatorio,
      activo: exercise.activo
    });
    setIsExerciseModalOpen(true);
  };

  const handleSaveExercise = () => {
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

    const updatedLesson = { ...currentLesson };
    
    if (editingExercise) {
      updatedLesson.ejercicios = updatedLesson.ejercicios.map(exercise =>
        exercise.id === editingExercise.id ? { ...exercise, ...exerciseForm } : exercise
      );
    } else {
      const newExercise: Exercise = {
        ...exerciseForm,
        id: Date.now().toString(),
        orden: [...updatedLesson.notas, ...updatedLesson.ejercicios].length
      };
      updatedLesson.ejercicios = [...updatedLesson.ejercicios, newExercise];
    }

    setCurrentLesson(updatedLesson);
    onUpdate(updatedLesson);
    setIsExerciseModalOpen(false);
    
    toast({
      title: editingExercise ? "Ejercicio actualizado" : "Ejercicio creado",
      description: `El ejercicio ha sido ${editingExercise ? "actualizado" : "creado"} correctamente.`,
    });
  };

  const handleDeleteExercise = (exerciseId: string) => {
    const updatedLesson = {
      ...currentLesson,
      ejercicios: currentLesson.ejercicios.filter(exercise => exercise.id !== exerciseId)
    };
    setCurrentLesson(updatedLesson);
    onUpdate(updatedLesson);
    
    toast({
      title: "Ejercicio eliminado",
      description: "El ejercicio ha sido eliminado correctamente.",
    });
  };

  const handleToggleExerciseActive = (exerciseId: string) => {
    const updatedLesson = {
      ...currentLesson,
      ejercicios: currentLesson.ejercicios.map(exercise =>
        exercise.id === exerciseId ? { ...exercise, activo: !exercise.activo } : exercise
      )
    };
    setCurrentLesson(updatedLesson);
    onUpdate(updatedLesson);
    
    toast({
      title: "Estado actualizado",
      description: "El estado del ejercicio ha sido actualizado.",
    });
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (active.id !== over?.id) {
      const updatedLesson = { ...currentLesson };
      const oldIndex = contentItems.findIndex(item => item.id === active.id);
      const newIndex = contentItems.findIndex(item => item.id === over?.id);
      
      const reorderedItems = arrayMove(contentItems, oldIndex, newIndex);
      
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
      onUpdate(updatedLesson);
    }
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
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={contentItems.map(item => item.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-4">
                  {contentItems.map((item) => (
                    <SortableContentItem
                      key={item.id}
                      item={item}
                      onEditNote={handleEditNote}
                      onDeleteNote={handleDeleteNote}
                      onToggleNoteActive={handleToggleNoteActive}
                      onEditExercise={handleEditExercise}
                      onDeleteExercise={handleDeleteExercise}
                      onToggleExerciseActive={handleToggleExerciseActive}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}
        </CardContent>
      </Card>

      {/* Note Modal */}
      <Dialog open={isNoteModalOpen} onOpenChange={setIsNoteModalOpen}>
        <DialogContent className="max-w-2xl">
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
            <div className="space-y-2">
              <Label>Imágenes</Label>
              <div className="border-2 border-dashed border-muted rounded-lg p-8 text-center">
                <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  Arrastra imágenes aquí o haz clic para seleccionar
                </p>
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
              <Button variant="outline" onClick={() => setIsNoteModalOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSaveNote}>
                {editingNote ? "Actualizar" : "Crear"} Nota
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
                      [{ 'list': 'ordered'}, { 'list': 'bullet' }],
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
                <div className="border-2 border-dashed border-muted rounded-lg p-4 text-center">
                  <Upload className="w-6 h-6 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-xs text-muted-foreground">Cargar imágenes</p>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Audio</Label>
                <div className="border-2 border-dashed border-muted rounded-lg p-4 text-center">
                  <Upload className="w-6 h-6 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-xs text-muted-foreground">Cargar audio</p>
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
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button variant="outline" onClick={() => setIsExerciseModalOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSaveExercise}>
                {editingExercise ? "Actualizar" : "Crear"} Ejercicio
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Sortable Content Item Component
function SortableContentItem({ 
  item, 
  onEditNote, 
  onDeleteNote, 
  onToggleNoteActive,
  onEditExercise, 
  onDeleteExercise, 
  onToggleExerciseActive 
}: {
  item: ContentItem;
  onEditNote: (note: Note) => void;
  onDeleteNote: (id: string) => void;
  onToggleNoteActive: (id: string) => void;
  onEditExercise: (exercise: Exercise) => void;
  onDeleteExercise: (id: string) => void;
  onToggleExerciseActive: (id: string) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`border rounded-lg p-4 ${!item.activo ? 'opacity-50 bg-muted/30' : ''}`}
    >
      <div className="flex justify-between items-start gap-4">
        <div className="flex items-start gap-3 flex-1">
          <div
            {...attributes}
            {...listeners}
            className="mt-1 cursor-grab text-muted-foreground hover:text-foreground"
          >
            <GripVertical className="w-5 h-5" />
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
                {(item as Note).imagenes.length > 0 && (
                  <Badge variant="outline">
                    {(item as Note).imagenes.length} imagen(es)
                  </Badge>
                )}
              </div>
            ) : (
              <div>
                <p className="text-sm text-muted-foreground mb-2">
                  {(item as Exercise).tipo}
                </p>
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