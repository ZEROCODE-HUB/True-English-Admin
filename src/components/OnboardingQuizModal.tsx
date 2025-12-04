import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { OnboardingQuestion } from "./QuizManagement";
interface OnboardingQuizModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (questionData: Omit<OnboardingQuestion, 'id'>) => void;
  question?: OnboardingQuestion | null;
}
export default function OnboardingQuizModal({
  isOpen,
  onClose,
  onSave,
  question
}: OnboardingQuizModalProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({
    pregunta: "",
    opcion1: "",
    opcion2: "",
    opcion3: "",
    opcion4: "",
    respuestaCorrecta: 1,
    incluirEnTest: true
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  useEffect(() => {
    if (question) {
      setFormData({
        pregunta: question.pregunta,
        opcion1: question.opcion1,
        opcion2: question.opcion2,
        opcion3: question.opcion3,
        opcion4: question.opcion4,
        respuestaCorrecta: question.respuestaCorrecta,
        incluirEnTest: question.incluirEnTest
      });
    } else {
      setFormData({
        pregunta: "",
        opcion1: "",
        opcion2: "",
        opcion3: "",
        opcion4: "",
        respuestaCorrecta: 1,
        incluirEnTest: true
      });
    }
    setErrors({});
  }, [question, isOpen]);
  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.pregunta.trim()) newErrors.pregunta = "La pregunta es requerida";
    if (!formData.opcion1.trim()) newErrors.opcion1 = "La opción 1 es requerida";
    if (!formData.opcion2.trim()) newErrors.opcion2 = "La opción 2 es requerida";
    if (!formData.opcion3.trim()) newErrors.opcion3 = "La opción 3 es requerida";
    if (!formData.opcion4.trim()) newErrors.opcion4 = "La opción 4 es requerida";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving) return; // prevent double submit
    if (!validateForm()) return;
    (async () => {
      setIsSaving(true);
      try {
        // Support onSave returning a promise or void
        await Promise.resolve(onSave(formData) as any);
      } finally {
        setIsSaving(false);
      }
    })();
  };
  return <Dialog open={isOpen} onOpenChange={onClose}>
    <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>
          {question ? "Editar Pregunta de Onboarding" : "Nueva Pregunta de Onboarding"}
        </DialogTitle>
      </DialogHeader>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="pregunta">Pregunta *</Label>
          <Input id="pregunta" value={formData.pregunta} onChange={e => setFormData(prev => ({
            ...prev,
            pregunta: e.target.value
          }))} className={errors.pregunta ? "border-destructive" : ""} placeholder="Escribe la pregunta aquí..." />
          {errors.pregunta && <p className="text-sm text-destructive">{errors.pregunta}</p>}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="opcion1">Opción 1 *</Label>
            <Input id="opcion1" value={formData.opcion1} onChange={e => setFormData(prev => ({
              ...prev,
              opcion1: e.target.value
            }))} className={errors.opcion1 ? "border-destructive" : ""} />
            {errors.opcion1 && <p className="text-sm text-destructive">{errors.opcion1}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="opcion2">Opción 2 *</Label>
            <Input id="opcion2" value={formData.opcion2} onChange={e => setFormData(prev => ({
              ...prev,
              opcion2: e.target.value
            }))} className={errors.opcion2 ? "border-destructive" : ""} />
            {errors.opcion2 && <p className="text-sm text-destructive">{errors.opcion2}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="opcion3">Opción 3 *</Label>
            <Input id="opcion3" value={formData.opcion3} onChange={e => setFormData(prev => ({
              ...prev,
              opcion3: e.target.value
            }))} className={errors.opcion3 ? "border-destructive" : ""} />
            {errors.opcion3 && <p className="text-sm text-destructive">{errors.opcion3}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="opcion4">Opción 4 *</Label>
            <Input id="opcion4" value={formData.opcion4} onChange={e => setFormData(prev => ({
              ...prev,
              opcion4: e.target.value
            }))} className={errors.opcion4 ? "border-destructive" : ""} />
            {errors.opcion4 && <p className="text-sm text-destructive">{errors.opcion4}</p>}
          </div>
        </div>

        <div className="space-y-3">
          <Label>Respuesta Correcta *</Label>
          <RadioGroup value={formData.respuestaCorrecta.toString()} onValueChange={value => setFormData(prev => ({
            ...prev,
            respuestaCorrecta: parseInt(value)
          }))} className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="1" id="respuesta1" />
              <Label htmlFor="respuesta1" className="cursor-pointer">
                Opción 1
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="2" id="respuesta2" />
              <Label htmlFor="respuesta2" className="cursor-pointer">
                Opción 2
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="3" id="respuesta3" />
              <Label htmlFor="respuesta3" className="cursor-pointer">
                Opción 3
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="4" id="respuesta4" />
              <Label htmlFor="respuesta4" className="cursor-pointer">
                Opción 4
              </Label>
            </div>
          </RadioGroup>
        </div>



        <div className="flex justify-end gap-3 pt-4">
          <Button type="button" variant="outline" onClick={onClose} disabled={isSaving}>
            Cancelar
          </Button>
          <Button type="submit" className="bg-primary hover:bg-primary-hover" disabled={isSaving}>
            {isSaving ? (question ? 'Actualizando...' : 'Creando...') : (question ? "Actualizar" : "Crear") + ' Pregunta'}
          </Button>
        </div>
      </form>
    </DialogContent>
  </Dialog>;
}