import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import supabase from "@/lib/supabase";
import type { Area } from "@/types/db";
import { Loader2, Trash2, Building2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface AssignmentInfo {
  companyId: string;
  companyName: string;
  areaId: string | null;
  areaName: string | null;
}

interface Company {
  id: string;
  name: string;
}

interface TopicAssignmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  topicId: string;
  topicTitle: string;
  currentAssignments: AssignmentInfo[];
  onAssigned: () => void;
}

export default function TopicAssignmentModal({ isOpen, onClose, topicId, topicTitle, currentAssignments, onAssigned }: TopicAssignmentModalProps) {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>("__none__");
  const [selectedAreaId, setSelectedAreaId] = useState<string>("__none__");
  const [assigning, setAssigning] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (!isOpen) return;
    setSelectedCompanyId("__none__");
    setSelectedAreaId("__none__");
    (async () => {
      const { data } = await supabase.from("companies").select("id, name").eq("active", true).order("name");
      setCompanies((data as Company[]) || []);
    })();
  }, [isOpen]);

  useEffect(() => {
    if (selectedCompanyId === "__none__") {
      setAreas([]);
      setSelectedAreaId("__none__");
      return;
    }
    (async () => {
      const { data } = await supabase.from("areas").select("id, name, company_id, active").eq("company_id", selectedCompanyId).eq("active", true).order("name");
      setAreas((data as Area[]) || []);
      setSelectedAreaId("__none__");
    })();
  }, [selectedCompanyId]);

  const handleAssign = async () => {
    if (selectedCompanyId === "__none__") return;
    setAssigning(true);
    try {
      const { error } = await supabase.from("topic_assignments").insert({
        topic_id: topicId,
        company_id: selectedCompanyId,
        area_id: selectedAreaId === "__none__" ? null : selectedAreaId,
      });
      if (error) {
        if (error.code === "23505") {
          toast({ title: "Ya existe", description: "Esta asignación ya existe." });
          return;
        }
        throw error;
      }
      toast({ title: "Asignado", description: "Tema asignado correctamente." });
      onAssigned();
      setSelectedCompanyId("__none__");
      setSelectedAreaId("__none__");
    } catch (e) {
      console.error(e);
      toast({ title: "Error", description: "No se pudo asignar el tema." });
    } finally {
      setAssigning(false);
    }
  };

  const handleDelete = async (companyId: string, areaId: string | null) => {
    const key = `${companyId}-${areaId ?? "all"}`;
    setDeleting(key);
    try {
      let query = supabase.from("topic_assignments").delete().eq("topic_id", topicId).eq("company_id", companyId);
      if (areaId) {
        query = query.eq("area_id", areaId);
      } else {
        query = query.is("area_id", null);
      }
      const { error } = await query;
      if (error) throw error;
      toast({ title: "Desasignado", description: "Asignación eliminada." });
      onAssigned();
    } catch (e) {
      console.error(e);
      toast({ title: "Error", description: "No se pudo eliminar la asignación." });
    } finally {
      setDeleting(null);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Asignar Tema: {topicTitle}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {currentAssignments.length > 0 && (
            <div>
              <Label className="text-sm font-medium">Asignaciones actuales</Label>
              <div className="mt-2 space-y-1">
                {currentAssignments.map((a, i) => {
                  const key = `${a.companyId}-${a.areaId ?? "all"}`;
                  return (
                    <div key={i} className="flex items-center justify-between p-2 border rounded-md">
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm font-medium">{a.companyName}</span>
                        {a.areaName && (
                          <>
                            <span className="text-muted-foreground">→</span>
                            <Badge variant="outline" className="text-xs">{a.areaName}</Badge>
                          </>
                        )}
                        {!a.areaName && (
                          <Badge variant="secondary" className="text-xs">Toda la empresa</Badge>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(a.companyId, a.areaId)}
                        disabled={deleting === key}
                      >
                        {deleting === key ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Trash2 className="w-4 h-4 text-destructive" />
                        )}
                      </Button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="border-t pt-4">
            <Label className="text-sm font-medium">Nueva asignación</Label>
            <div className="mt-2 space-y-3">
              <div>
                <Label>Empresa</Label>
                <Select value={selectedCompanyId} onValueChange={setSelectedCompanyId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona una empresa" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Seleccionar empresa...</SelectItem>
                    {companies.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedCompanyId !== "__none__" && areas.length > 0 && (
                <div>
                  <Label>Área (opcional)</Label>
                  <Select value={selectedAreaId} onValueChange={setSelectedAreaId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona un área" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Toda la empresa</SelectItem>
                      {areas.map((a) => (
                        <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={onClose}>Cerrar</Button>
                <Button
                  onClick={handleAssign}
                  disabled={selectedCompanyId === "__none__" || assigning}
                >
                  {assigning && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
                  Asignar
                </Button>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
