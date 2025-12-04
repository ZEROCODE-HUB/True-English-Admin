import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import type { Challenge, Lesson } from "./QuizManagement";

interface CreateChallengeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Omit<Challenge, 'id' | 'lessonTitle'>) => void;
  lessons: Lesson[];
  challenge?: Challenge | null;
}

export default function CreateChallengeModal({ isOpen, onClose, onSave, lessons, challenge }: CreateChallengeModalProps) {
  const [formData, setFormData] = useState({
    titulo: "",
    nivel: "A1",
    lessonId: "",
    activo: true
  });
  const [isSaving, setIsSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (challenge) {
      setFormData({
        titulo: challenge.titulo,
        nivel: challenge.nivel,
        lessonId: challenge.lessonId,
        activo: challenge.activo
      });
    } else {
      setFormData({
        titulo: "",
        nivel: "A1",
        lessonId: "",
        activo: true
      });
    }
    setErrors({});
  }, [challenge, isOpen]);

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.titulo.trim()) newErrors.titulo = "El título es requerido";
    if (!formData.lessonId) newErrors.lessonId = "Selecciona una lección asociada";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    if (isSaving) return;
    (async () => {
      setIsSaving(true);
      try {
        await Promise.resolve(onSave({
          titulo: formData.titulo,
          nivel: formData.nivel as any,
          lessonId: formData.lessonId,
          activo: formData.activo
        }) as any);
      } finally {
        setIsSaving(false);
      }
    })();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{challenge ? "Editar Desafío" : "Crear Nuevo Desafío"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="titulo">Título</Label>
            <Input
              id="titulo"
              placeholder="Ej: Desafío de Verbos Irregulares"
              value={formData.titulo}
              onChange={(e) => setFormData((p) => ({ ...p, titulo: e.target.value }))}
              className={errors.titulo ? "border-destructive" : ""}
            />
            {errors.titulo && <p className="text-sm text-destructive">{errors.titulo}</p>}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
            <div className="space-y-2">
              <Label htmlFor="nivel">Nivel</Label>
              <Select value={formData.nivel} onValueChange={(v) => setFormData(p => ({ ...p, nivel: v as any }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="A1">A1</SelectItem>
                  <SelectItem value="A2">A2</SelectItem>
                  <SelectItem value="B1">B1</SelectItem>
                  <SelectItem value="B2">B2</SelectItem>
                  <SelectItem value="C1">C1</SelectItem>
                  <SelectItem value="C2">C2</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="lesson">Lección Asociada</Label>
              <Select value={formData.lessonId} onValueChange={(v) => setFormData(p => ({ ...p, lessonId: v }))}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Selecciona una lección" />
                </SelectTrigger>
                <SelectContent>
                  {lessons.map(l => (
                    <SelectItem key={l.id} value={l.id}>{l.titulo} - {l.nivel}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.lessonId && <p className="text-sm text-destructive">{errors.lessonId}</p>}
            </div>
          </div>

          <div className="flex items-center justify-between">
            <Label>Estado</Label>
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground">Activo</span>
              <Switch checked={formData.activo} onCheckedChange={(v) => setFormData(p => ({ ...p, activo: !!v }))} />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={onClose} disabled={isSaving}>Cancelar</Button>
            <Button type="submit" className="bg-primary hover:bg-primary-hover" disabled={isSaving}>{isSaving ? (challenge ? 'Actualizando...' : 'Creando...') : 'Crear Desafío'}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
