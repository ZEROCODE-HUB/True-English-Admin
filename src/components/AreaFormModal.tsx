import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { Area } from "@/types/db";

interface AreaFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: { name: string; active: boolean }) => void;
  area: Area | null;
}

export default function AreaFormModal({ isOpen, onClose, onSave, area }: AreaFormModalProps) {
  const [name, setName] = useState("");
  const [active, setActive] = useState(true);

  useEffect(() => {
    if (area) {
      setName(area.name);
      setActive(area.active);
    } else {
      setName("");
      setActive(true);
    }
  }, [area, isOpen]);

  const handleSubmit = () => {
    if (!name.trim()) return;
    onSave({ name: name.trim(), active });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{area ? "Editar Área" : "Nueva Área"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Nombre</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej: Sistemas" />
          </div>
          <div className="flex items-center gap-3">
            <Label>Activa</Label>
            <Switch checked={active} onCheckedChange={setActive} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={onClose}>Cancelar</Button>
            <Button onClick={handleSubmit} disabled={!name.trim()}>Guardar</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
