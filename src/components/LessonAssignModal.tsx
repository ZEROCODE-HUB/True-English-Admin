import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import supabase from "@/lib/supabase";
import type { Area } from "@/types/db";
import { Loader2 } from "lucide-react";

interface LessonOption {
  id: string;
  title: string;
  level: string;
  mandatory: boolean;
}

interface LessonAssignModalProps {
  isOpen: boolean;
  onClose: () => void;
  companyId: string;
  areas: Area[];
  assignedLessonIds: string[];
  onAssigned: () => void;
}

export default function LessonAssignModal({ isOpen, onClose, companyId, areas, assignedLessonIds, onAssigned }: LessonAssignModalProps) {
  const [search, setSearch] = useState("");
  const [lessons, setLessons] = useState<LessonOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedLesson, setSelectedLesson] = useState<LessonOption | null>(null);
  const [selectedAreaId, setSelectedAreaId] = useState<string>("__none__");
  const [assigning, setAssigning] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setSearch("");
      setLessons([]);
      setSelectedLesson(null);
      setSelectedAreaId("__none__");
    }
  }, [isOpen]);

  const loadLessons = useCallback(async () => {
    if (search.length < 2) {
      setLessons([]);
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc("get_lessons", {
        p_search: search,
        p_level: "all",
        p_limit: 20,
        p_offset: 0,
      });
      if (error) throw error;
      const items = ((data as any)?.data || []) as LessonOption[];
      setLessons(items);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    const timer = setTimeout(() => loadLessons(), 300);
    return () => clearTimeout(timer);
  }, [loadLessons]);

  const handleAssign = async () => {
    if (!selectedLesson) return;
    setAssigning(true);
    try {
      const { error } = await supabase.from("lesson_assignments").insert({
        lesson_id: selectedLesson.id,
        company_id: companyId,
        area_id: selectedAreaId === "__none__" ? null : selectedAreaId,
      });
      if (error) {
        if (error.code === "23505") {
          return;
        }
        throw error;
      }
      onAssigned();
      onClose();
    } catch (e) {
      console.error(e);
    } finally {
      setAssigning(false);
    }
  };

  const availableLessons = lessons.filter((l) => !assignedLessonIds.includes(l.id));

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Asignar Curso</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Buscar curso</Label>
            <Input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setSelectedLesson(null); }}
              placeholder="Titulo del curso..."
            />
            {loading && <p className="text-xs text-muted-foreground mt-1">Buscando...</p>}
            {!selectedLesson && availableLessons.length > 0 && (
              <ScrollArea className="h-40 border rounded-md mt-1">
                {availableLessons.map((l) => (
                  <button
                    key={l.id}
                    className="w-full text-left px-3 py-2 hover:bg-accent text-sm flex items-center justify-between"
                    onClick={() => setSelectedLesson(l)}
                  >
                    <span>{l.title}</span>
                    <Badge variant="outline" className="text-xs">{l.level}</Badge>
                  </button>
                ))}
              </ScrollArea>
            )}
            {!selectedLesson && search.length >= 2 && availableLessons.length === 0 && !loading && (
              <p className="text-xs text-muted-foreground mt-1">No se encontraron cursos disponibles.</p>
            )}
            {selectedLesson && (
              <div className="flex items-center gap-2 mt-1">
                <p className="text-xs text-green-600">
                  Seleccionado: {selectedLesson.title}
                </p>
                <Badge variant="outline" className="text-xs">{selectedLesson.level}</Badge>
              </div>
            )}
          </div>

          <div>
            <Label>Area (opcional)</Label>
            <Select value={selectedAreaId} onValueChange={setSelectedAreaId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecciona un area" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Toda la empresa</SelectItem>
                {areas.filter((a) => a.active).map((a) => (
                  <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={onClose}>Cancelar</Button>
            <Button onClick={handleAssign} disabled={!selectedLesson || assigning}>
              {assigning && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
              Asignar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
