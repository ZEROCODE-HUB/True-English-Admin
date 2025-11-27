import { useState, useEffect } from "react";
import { Plus, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { LessonQuestion } from "./QuizManagement";
interface LessonQuizModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (questionData: Omit<LessonQuestion, 'id'>) => void;
  question?: LessonQuestion | null;
  lessons?: { id: string; titulo?: string; title?: string }[];
}
// use lessons passed via props (fetched by parent)
export default function LessonQuizModal({
  isOpen,
  onClose,
  onSave,
  question,
  lessons: propsLessons = []
}: LessonQuizModalProps) {
  const [formData, setFormData] = useState({
    lessonId: "",
    lessonTitle: "",
    tipo: "quizz-leccion" as "quizz-leccion" | "desafio-semanal",
    pregunta: "",
    opciones: ["", ""],
    respuestaCorrecta: 1,
    activa: true
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  useEffect(() => {
    if (question) {
      setFormData({
        lessonId: question.lessonId,
        lessonTitle: question.lessonTitle,
        tipo: question.tipo,
        pregunta: question.pregunta,
        opciones: [...question.opciones],
        respuestaCorrecta: question.respuestaCorrecta,
        activa: question.activa
      });
    } else {
      setFormData({
        lessonId: "",
        lessonTitle: "",
        tipo: "quizz-leccion",
        pregunta: "",
        opciones: ["", ""],
        respuestaCorrecta: 1,
        activa: true
      });
    }
    setErrors({});
  }, [question, isOpen]);
  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.lessonId) newErrors.lessonId = "Debes seleccionar una lección";
    if (!formData.pregunta.trim()) newErrors.pregunta = "La pregunta es requerida";
    const validOptions = formData.opciones.filter(opt => opt.trim() !== "");
    if (validOptions.length < 2) newErrors.opciones = "Debes tener al menos 2 opciones";
    if (formData.respuestaCorrecta > validOptions.length) {
      newErrors.respuestaCorrecta = "La respuesta correcta debe ser una de las opciones válidas";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validateForm()) {
      // Filter out empty options before saving
      const validOptions = formData.opciones.filter(opt => opt.trim() !== "");
      onSave({
        ...formData,
        opciones: validOptions
      });
    }
  };
  const handleLessonChange = (lessonId: string) => {
    const lesson = (propsLessons || []).find(l => l.id === lessonId);
    setFormData(prev => ({
      ...prev,
      lessonId,
      lessonTitle: (lesson && (lesson.titulo || lesson.title)) || ""
    }));
  };
  const addOption = () => {
    setFormData(prev => ({
      ...prev,
      opciones: [...prev.opciones, ""]
    }));
  };
  const removeOption = (index: number) => {
    if (formData.opciones.length > 2) {
      const newOptions = formData.opciones.filter((_, i) => i !== index);
      setFormData(prev => ({
        ...prev,
        opciones: newOptions,
        // Adjust correct answer if it was pointing to a removed option
        respuestaCorrecta: prev.respuestaCorrecta > newOptions.length ? 1 : prev.respuestaCorrecta
      }));
    }
  };
  const updateOption = (index: number, value: string) => {
    const newOptions = [...formData.opciones];
    newOptions[index] = value;
    setFormData(prev => ({
      ...prev,
      opciones: newOptions
    }));
  };
  const validOptions = formData.opciones.filter(opt => opt.trim() !== "");
  return <Dialog open={isOpen} onOpenChange={onClose}>
    <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>
          {question ? "Editar Pregunta de Lección" : "Nueva Pregunta de Lección"}
        </DialogTitle>
      </DialogHeader>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Asociar a Lección *</Label>
            <Select value={formData.lessonId} onValueChange={handleLessonChange}>
              <SelectTrigger className={errors.lessonId ? "border-destructive" : ""}>
                <SelectValue placeholder="Selecciona una lección..." />
              </SelectTrigger>
              <SelectContent>
                {(propsLessons || []).map(lesson => <SelectItem key={lesson.id} value={lesson.id}>
                  {lesson.titulo ?? lesson.title}
                </SelectItem>)}
              </SelectContent>
            </Select>
            {errors.lessonId && <p className="text-sm text-destructive">{errors.lessonId}</p>}
          </div>

          <div className="space-y-2">
            <Label>Tipo *</Label>
            <RadioGroup value={formData.tipo} onValueChange={value => setFormData(prev => ({
              ...prev,
              tipo: value as "quizz-leccion" | "desafio-semanal"
            }))} className="flex gap-6">
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="quizz-leccion" id="tipo-quiz" />
                <Label htmlFor="tipo-quiz" className="cursor-pointer">
                  Quiz de Lección
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="desafio-semanal" id="tipo-desafio" />
                <Label htmlFor="tipo-desafio" className="cursor-pointer">
                  Desafío Semanal
                </Label>
              </div>
            </RadioGroup>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="pregunta">Pregunta *</Label>
          <Textarea id="pregunta" value={formData.pregunta} onChange={e => setFormData(prev => ({
            ...prev,
            pregunta: e.target.value
          }))} className={errors.pregunta ? "border-destructive" : ""} placeholder="Escribe la pregunta aquí..." rows={3} />
          {errors.pregunta && <p className="text-sm text-destructive">{errors.pregunta}</p>}

          <div className="flex gap-2 mt-2">
            <Button type="button" variant="outline" size="sm">
              <Upload className="w-4 h-4 mr-2" />
              Subir Imagen
            </Button>
            <Button type="button" variant="outline" size="sm">
              <Upload className="w-4 h-4 mr-2" />
              Subir Audio
            </Button>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label>Opciones de Respuesta *</Label>
            <Button type="button" onClick={addOption} variant="outline" size="sm">
              <Plus className="w-4 h-4 mr-2" />
              Agregar Opción
            </Button>
          </div>

          <div className="space-y-3">
            {formData.opciones.map((opcion, index) => <div key={index} className="flex gap-3 items-center">
              <span className="text-sm font-medium w-8">
                {index + 1}.
              </span>
              <Input value={opcion} onChange={e => updateOption(index, e.target.value)} placeholder={`Opción ${index + 1}`} className="flex-1" />
              {formData.opciones.length > 2 && <Button type="button" variant="outline" size="sm" onClick={() => removeOption(index)} className="text-destructive">
                <Trash2 className="w-4 h-4" />
              </Button>}
            </div>)}
          </div>
          {errors.opciones && <p className="text-sm text-destructive">{errors.opciones}</p>}
        </div>

        <div className="space-y-3">
          <Label>Respuesta Correcta *</Label>
          <RadioGroup value={formData.respuestaCorrecta.toString()} onValueChange={value => setFormData(prev => ({
            ...prev,
            respuestaCorrecta: parseInt(value)
          }))} className="space-y-2">
            {validOptions.map((opcion, index) => <div key={index} className="flex items-center space-x-2">
              <RadioGroupItem value={(index + 1).toString()} id={`respuesta-${index + 1}`} />
              <Label htmlFor={`respuesta-${index + 1}`} className="cursor-pointer">
                Opción {index + 1}: {opcion || `Opción ${index + 1} (vacía)`}
              </Label>
            </div>)}
          </RadioGroup>
          {errors.respuestaCorrecta && <p className="text-sm text-destructive">{errors.respuestaCorrecta}</p>}
        </div>



        <div className="flex justify-end gap-3 pt-4">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" className="bg-primary hover:bg-primary-hover">
            {question ? "Actualizar" : "Crear"} Pregunta
          </Button>
        </div>
      </form>
    </DialogContent>
  </Dialog>;
}