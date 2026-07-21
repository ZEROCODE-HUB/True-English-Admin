import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { Company } from "@/types/db";

interface CompanyFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: { name: string; slug: string; active: boolean }) => void;
  company: Company | null;
}

function toSlug(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export default function CompanyFormModal({ isOpen, onClose, onSave, company }: CompanyFormModalProps) {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [active, setActive] = useState(true);
  const [slugManual, setSlugManual] = useState(false);

  useEffect(() => {
    if (company) {
      setName(company.name);
      setSlug(company.slug);
      setActive(company.active);
      setSlugManual(true);
    } else {
      setName("");
      setSlug("");
      setActive(true);
      setSlugManual(false);
    }
  }, [company, isOpen]);

  const handleNameChange = (value: string) => {
    setName(value);
    if (!slugManual) {
      setSlug(toSlug(value));
    }
  };

  const handleSlugChange = (value: string) => {
    setSlugManual(true);
    setSlug(value);
  };

  const handleSubmit = () => {
    if (!name.trim() || !slug.trim()) return;
    onSave({ name: name.trim(), slug: slug.trim(), active });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{company ? "Editar Empresa" : "Nueva Empresa"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Nombre</Label>
            <Input value={name} onChange={(e) => handleNameChange(e.target.value)} placeholder="Ej: Grupo Salinas" />
          </div>
          <div>
            <Label>Slug (identificador)</Label>
            <Input value={slug} onChange={(e) => handleSlugChange(e.target.value)} placeholder="Ej: grupo-salinas" />
            <p className="text-xs text-muted-foreground mt-1">Identificador URL-friendly. Se genera automáticamente del nombre.</p>
          </div>
          <div className="flex items-center gap-3">
            <Label>Activa</Label>
            <Switch checked={active} onCheckedChange={setActive} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={onClose}>Cancelar</Button>
            <Button onClick={handleSubmit} disabled={!name.trim() || !slug.trim()}>Guardar</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
