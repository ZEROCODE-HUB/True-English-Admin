import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import type { ChallengeQuestion } from "./QuizManagement";

interface CreateChallengeQuestionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Omit<ChallengeQuestion, 'id' | 'challengeId'> & { imageFile?: File | null; audioFile?: File | null }) => void;
  question?: ChallengeQuestion | null;
}

export default function CreateChallengeQuestionModal({ isOpen, onClose, onSave, question }: CreateChallengeQuestionModalProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [pregunta, setPregunta] = useState("");
  const [imagen, setImagen] = useState<string | undefined>(undefined);
  const [audio, setAudio] = useState<string | undefined>(undefined);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [opciones, setOpciones] = useState<string[]>(["", ""]);
  const [respuestaCorrecta, setRespuestaCorrecta] = useState<number>(1);
  const [activa, setActiva] = useState(true);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const audioInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (question) {
      setPregunta(question.pregunta);
      setImagen(question.imagen);
      setAudio(question.audio);
      setOpciones(question.opciones.length ? question.opciones : ["", ""]);
      setRespuestaCorrecta(question.respuestaCorrecta);
      setActiva(question.activa);
    } else {
      setPregunta("");
      setImagen(undefined);
      setAudio(undefined);
      setOpciones(["", ""]);
      setRespuestaCorrecta(1);
      setActiva(true);
    }
  }, [question, isOpen]);

  const handleAddOption = () => setOpciones(prev => [...prev, ""]);
  const handleRemoveOption = (index: number) => {
    if (opciones.length <= 2) return;
    setOpciones(prev => prev.filter((_, i) => i !== index));
    if (respuestaCorrecta > opciones.length - 1) setRespuestaCorrecta(1);
  };

  const handleImageFile = (file?: File) => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    setImagen(url);
    setImageFile(file);
  };

  const handleAudioFile = (file?: File) => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    setAudio(url);
    setAudioFile(file);
  };

  const validate = () => {
    if (!pregunta.trim()) return false;
    const filledOptions = opciones.filter(o => o.trim() !== "");
    if (filledOptions.length < 2) return false;
    if (respuestaCorrecta < 1 || respuestaCorrecta > opciones.length) return false;
    return true;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    if (isSaving) return;
    (async () => {
      setIsSaving(true);
      try {
        await Promise.resolve(onSave({
          pregunta: pregunta.trim(),
          imagen,
          audio,
          imageFile,
          audioFile,
          opciones: opciones.map(o => o.trim()),
          respuestaCorrecta,
          activa
        }) as any);
      } finally {
        setIsSaving(false);
      }
    })();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{question ? "Editar Pregunta de Desafío" : "Nueva Pregunta de Desafío"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="pregunta">Pregunta *</Label>
            <Textarea id="pregunta" placeholder="Escribe la pregunta aquí..." value={pregunta} onChange={e => setPregunta(e.target.value)} />
          </div>

          <div className="flex gap-3">
            <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleImageFile(e.target.files?.[0])} />
            <Button type="button" variant="outline" onClick={() => imageInputRef.current?.click()}>Subir Imagen</Button>
            <input ref={audioInputRef} type="file" accept="audio/*" className="hidden" onChange={(e) => handleAudioFile(e.target.files?.[0])} />
            <Button type="button" variant="outline" onClick={() => audioInputRef.current?.click()}>Subir Audio</Button>
          </div>

          <div className="space-y-2">
            <Label>Opciones de Respuesta *</Label>
            <div className="space-y-3">
              {opciones.map((opt, idx) => (
                <div key={idx} className="flex items-center gap-3">
                  <div className="w-6 text-right">{idx + 1}.</div>
                  <Input value={opt} onChange={e => setOpciones(prev => prev.map((p, i) => i === idx ? e.target.value : p))} placeholder={`Opción ${idx + 1}`} />
                  {opciones.length > 2 && <Button type="button" variant="ghost" onClick={() => handleRemoveOption(idx)}>Eliminar</Button>}
                </div>
              ))}
            </div>
            <div className="flex justify-end">
              <Button type="button" onClick={handleAddOption}>+ Agregar Opción</Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Respuesta Correcta *</Label>
            <div className="flex gap-3">
              {opciones.map((_, idx) => (
                <label key={idx} className="inline-flex items-center gap-2">
                  <input type="radio" name="respuesta" checked={respuestaCorrecta === idx + 1} onChange={() => setRespuestaCorrecta(idx + 1)} />
                  <span>Opción {idx + 1}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={onClose} disabled={isSaving}>Cancelar</Button>
            <Button type="submit" className="bg-primary hover:bg-primary-hover" disabled={isSaving}>{isSaving ? 'Guardando...' : (question ? 'Actualizar Pregunta' : 'Crear Pregunta')}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
