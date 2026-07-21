import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import supabase from "@/lib/supabase";
import type { Area } from "@/types/db";

interface ProfileOption {
  id: string;
  name: string | null;
  last_name: string | null;
  email: string | null;
}

interface MembershipFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: { profile_id: string; area_id: string | null }) => void;
  areas: Area[];
  excludeProfileIds?: string[];
}

export default function MembershipFormModal({ isOpen, onClose, onSave, areas, excludeProfileIds = [] }: MembershipFormModalProps) {
  const [profileSearch, setProfileSearch] = useState("");
  const [profileResults, setProfileResults] = useState<ProfileOption[]>([]);
  const [selectedProfile, setSelectedProfile] = useState<ProfileOption | null>(null);
  const [selectedAreaId, setSelectedAreaId] = useState<string>("__none__");
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setProfileSearch("");
      setProfileResults([]);
      setSelectedProfile(null);
      setSelectedAreaId("__none__");
    }
  }, [isOpen]);

  useEffect(() => {
    if (profileSearch.length < 2) {
      setProfileResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const term = profileSearch.trim();
        let filter = `name.ilike.%${term}%,last_name.ilike.%${term}%,email.ilike.%${term}%`;
        const parts = term.split(/\s+/);
        if (parts.length >= 2) {
          filter += `,and(name.ilike.%${parts[0]}%,last_name.ilike.%${parts.slice(1).join(" ")}%),and(name.ilike.%${parts.slice(1).join(" ")}%,last_name.ilike.%${parts[0]}%)`;
        }
        const { data, error } = await supabase
          .from("profiles")
          .select("id, name, last_name, email")
          .or(filter)
          .limit(10);
        if (!error && data) {
          const filtered = (data as ProfileOption[]).filter((p) => !excludeProfileIds.includes(p.id));
          setProfileResults(filtered);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [profileSearch]);

  const handleSubmit = () => {
    if (!selectedProfile) return;
    onSave({
      profile_id: selectedProfile.id,
      area_id: selectedAreaId === "__none__" ? null : selectedAreaId,
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Agregar Miembro</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Buscar usuario</Label>
            <Input
              value={profileSearch}
              onChange={(e) => {
                setProfileSearch(e.target.value);
                setSelectedProfile(null);
              }}
              placeholder="Nombre, apellido o email..."
            />
            {searching && <p className="text-xs text-muted-foreground mt-1">Buscando...</p>}
            {profileResults.length > 0 && !selectedProfile && (
              <div className="border rounded-md mt-1 max-h-40 overflow-y-auto">
                {profileResults.map((p) => (
                  <button
                    key={p.id}
                    className="w-full text-left px-3 py-2 hover:bg-accent text-sm"
                    onClick={() => {
                      setSelectedProfile(p);
                      setProfileSearch(`${p.name ?? ""} ${p.last_name ?? ""} (${p.email ?? ""})`);
                      setProfileResults([]);
                    }}
                  >
                    {p.name} {p.last_name} — {p.email}
                  </button>
                ))}
              </div>
            )}
            {selectedProfile && (
              <p className="text-xs text-green-600 mt-1">
                Seleccionado: {selectedProfile.name} {selectedProfile.last_name}
              </p>
            )}
          </div>

          <div>
            <Label>Área</Label>
            <Select value={selectedAreaId} onValueChange={setSelectedAreaId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecciona un área" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Toda la empresa (sin área específica)</SelectItem>
                {areas
                  .filter((a) => a.active)
                  .map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button onClick={handleSubmit} disabled={!selectedProfile}>
              Agregar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
