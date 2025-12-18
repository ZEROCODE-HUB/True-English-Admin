import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Lesson } from '@/types/db';

interface LessonFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (lessonData: Omit<Lesson, 'id' | 'fechaCreacion' | 'notas' | 'ejercicios'>) => void;
  lesson?: Lesson | null;
}

export default function LessonFormModal({ isOpen, onClose, onSave, lesson }: LessonFormModalProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({
    titulo: "",
    descripcion: "",
    nivelAsociado: "A1",
    obligatoria: false
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (lesson) {
      setFormData({
        titulo: lesson.titulo,
        descripcion: lesson.descripcion,
        nivelAsociado: lesson.nivelAsociado,
        obligatoria: lesson.obligatoria,
        points: lesson.points ?? 0
      });
    } else {
      setFormData({
        titulo: "",
        descripcion: "",
        nivelAsociado: "A1",
        obligatoria: false,
        points: 0
      });
    }
    setErrors({});
  }, [lesson, isOpen]);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.titulo.trim()) newErrors.titulo = "El título es requerido";
    if (!formData.descripcion.trim()) newErrors.descripcion = "La descripción es requerida";
    if (typeof formData.points !== 'number' || Number.isNaN(formData.points) || formData.points < 0) newErrors.points = 'Puntos inválidos';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving) return;
    if (!validateForm()) return;
    (async () => {
      setIsSaving(true);
      try {
        await Promise.resolve(onSave(formData) as any);
        onClose();
      } finally {
        setIsSaving(false);
      }
    })();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {lesson ? "Editar Lección" : "Crear Nueva Lección"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="titulo">Título de la Lección *</Label>
            <Input
              id="titulo"
              value={formData.titulo}
              onChange={(e) => setFormData(prev => ({ ...prev, titulo: e.target.value }))}
              className={errors.titulo ? "border-destructive" : ""}
            />
            {errors.titulo && <p className="text-sm text-destructive">{errors.titulo}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="descripcion">Descripción corta *</Label>
            <Textarea
              id="descripcion"
              value={formData.descripcion}
              onChange={(e) => setFormData(prev => ({ ...prev, descripcion: e.target.value }))}
              className={errors.descripcion ? "border-destructive" : ""}
              rows={3}
            />
            {errors.descripcion && <p className="text-sm text-destructive">{errors.descripcion}</p>}
          </div>

          <div className="space-y-2">
            <Label>Nivel Asociado</Label>
            <Select
              value={formData.nivelAsociado}
              onValueChange={(value) => setFormData(prev => ({ ...prev, nivelAsociado: value }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="A1">A1 - Principiante</SelectItem>
                <SelectItem value="A2">A2 - Elemental</SelectItem>
                <SelectItem value="B1">B1 - Intermedio</SelectItem>
                <SelectItem value="B2">B2 - Intermedio Alto</SelectItem>
                <SelectItem value="C1">C1 - Avanzado</SelectItem>
                <SelectItem value="C2">C2 - Competencia</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              id="obligatoria"
              checked={formData.obligatoria}
              onCheckedChange={(checked) => setFormData(prev => ({ ...prev, obligatoria: checked }))}
            />
            <Label htmlFor="obligatoria">Lección Obligatoria</Label>
          </div>

          <div className="space-y-2">
            <Label htmlFor="points">Puntos Ganados</Label>
            <Input
              id="points"
              type="number"
              min={0}
              step={1}
              value={String(formData.points ?? 0)}
              onChange={(e) => setFormData(prev => ({ ...prev, points: Math.max(0, parseInt(e.target.value || '0') || 0) }))}
              className={errors.points ? "border-destructive" : ""}
            />
            {errors.points && <p className="text-sm text-destructive">{errors.points}</p>}
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={onClose} disabled={isSaving}>
              Cancelar
            </Button>
            <Button type="submit" className="bg-primary hover:bg-primary-hover" disabled={isSaving}>
              {isSaving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />{lesson ? 'Actualizando...' : 'Creando...'}</> : (lesson ? "Actualizar" : "Crear") + ' Lección'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}