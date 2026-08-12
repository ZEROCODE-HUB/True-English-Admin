import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, Plus, X, Building2, MapPin, Globe } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command";
import type { Lesson, Company, Area, Program, ProgramLevel } from '@/types/db';
import { supabase } from "@/lib/supabase";
import { listPrograms, listProgramLevels } from "@/lib/levels";

interface AssignmentInfo {
  companyId: string;
  companyName: string;
  areaId: string | null;
  areaName: string | null;
}

interface AssignmentRow {
  companyId: string;
  areaIds: string[];
}

interface LessonFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (lessonData: Omit<Lesson, 'id' | 'fechaCreacion' | 'notas' | 'ejercicios'> & { assignments?: { companyId: string; areaId: string | null }[] }) => void;
  lesson?: Lesson | null;
  companies?: Company[];
  initialAssignments?: AssignmentInfo[];
}

/** Niveles CEFR estándar cuando una lección no tiene línea (NULL = Estándar). */
const FALLBACK_LEVELS: ProgramLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'].map((lvl, i) => ({
  id: `std-${lvl}`,
  program_id: '',
  level: lvl,
  label: lvl,
  sort_order: i + 1,
  created_at: '',
}));

export default function LessonFormModal({ isOpen, onClose, onSave, lesson, companies = [], initialAssignments = [] }: LessonFormModalProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({
    titulo: "",
    descripcion: "",
    nivelAsociado: "A1",
    obligatoria: false,
    programId: "__none__" as string,
  });
  const [programs, setPrograms] = useState<Program[]>([]);
  const [programLevels, setProgramLevels] = useState<ProgramLevel[]>([]);

  // Ref espejo de formData para lecturas dentro de callbacks async (evita closures obsoletos).
  const formDataRef = useRef(formData);
  formDataRef.current = formData;

  const [assignments, setAssignments] = useState<AssignmentRow[]>([]);
  const [companyAreas, setCompanyAreas] = useState<Record<string, Area[]>>({});
  const [openPopovers, setOpenPopovers] = useState<Record<number, boolean>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (lesson) {
      setFormData({
        titulo: lesson.titulo,
        descripcion: lesson.descripcion,
        nivelAsociado: lesson.nivelAsociado,
        obligatoria: lesson.obligatoria,
        programId: lesson.programId || "__none__",
      });
    } else {
      setFormData({
        titulo: "",
        descripcion: "",
        nivelAsociado: "A1",
        obligatoria: false,
        programId: "__none__",
      });
    }
    const grouped: Record<string, string[]> = {};
    initialAssignments.forEach(a => {
      if (!grouped[a.companyId]) grouped[a.companyId] = [];
      if (a.areaId && !grouped[a.companyId].includes(a.areaId)) {
        grouped[a.companyId].push(a.areaId);
      }
    });
    const rows: AssignmentRow[] = Object.entries(grouped).map(([companyId, areaIds]) => ({
      companyId,
      areaIds,
    }));
    setAssignments(rows);
    setCompanyAreas({});
    setOpenPopovers({});
    setErrors({});
  }, [lesson, isOpen, companies, initialAssignments]);

  useEffect(() => {
    const companyIds = assignments.map(a => a.companyId).filter(Boolean);
    companyIds.forEach(async (cid) => {
      if (companyAreas[cid]) return;
      const { data } = await supabase
        .from("areas")
        .select("id, company_id, name, active")
        .eq("company_id", cid)
        .eq("active", true)
        .order("name");
      setCompanyAreas(prev => ({ ...prev, [cid]: (data as Area[]) || [] }));
    });
  }, [assignments]);

  useEffect(() => {
    if (!isOpen) return;
    listPrograms().then((data) => {
      const activePrograms = data.filter((p) => p.active && p.has_level_progression);
      setPrograms(activePrograms);
      // Regla NULL = Estándar: si la lección no tiene línea ("__none__"), se
      // conserva tal cual. NO se auto-selecciona el primer programa de la lista.
      if (activePrograms.length > 0 && formDataRef.current.programId !== "__none__") {
        listProgramLevels(formDataRef.current.programId).then((lvl) => {
          setProgramLevels(lvl);
          if (lvl.length > 0 && !lvl.some((l) => l.level === formDataRef.current.nivelAsociado)) {
            setFormData((inner) => ({ ...inner, nivelAsociado: lvl[0].level }));
          }
        });
      }
    }).catch((err) => console.error("failed to load programs", err));
  }, [isOpen]);

  useEffect(() => {
    // Sin línea ("__none__") = Estándar: cargar los niveles del programa
    // Estándar (slug 'estandar') o fallback CEFR A1-C2 si no existe.
    if (formData.programId && formData.programId !== "__none__") {
      listProgramLevels(formData.programId).then((lvl) => {
        setProgramLevels(lvl);
        if (lvl.length > 0 && !lvl.some((l) => l.level === formDataRef.current.nivelAsociado)) {
          setFormData((prev) => ({ ...prev, nivelAsociado: lvl[0].level }));
        }
      }).catch(() => setProgramLevels([]));
      return;
    }

    const standard = programs.find((p) => p.slug === "estandar");
    if (standard) {
      listProgramLevels(standard.id).then((lvl) => {
        setProgramLevels(lvl);
        if (lvl.length > 0 && !lvl.some((l) => l.level === formDataRef.current.nivelAsociado)) {
          setFormData((prev) => ({ ...prev, nivelAsociado: lvl[0].level }));
        }
      }).catch(() => setProgramLevels(FALLBACK_LEVELS));
    } else {
      setProgramLevels(FALLBACK_LEVELS);
    }
  }, [formData.programId, programs]);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.titulo.trim()) {
      newErrors.titulo = "El título es requerido";
    } else if (formData.titulo.trim().length > 200) {
      newErrors.titulo = "El título no puede superar 200 caracteres";
    }
    if (!formData.descripcion.trim()) newErrors.descripcion = "La descripción es requerida";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving) return;
    if (!validateForm()) return;

    const result = assignments
      .filter(a => a.companyId)
      .flatMap((a) => {
        if (a.areaIds.length === 0) {
          return [{ companyId: a.companyId, areaId: null }];
        }
        return a.areaIds.map(areaId => ({ companyId: a.companyId, areaId }));
      });

    (async () => {
      setIsSaving(true);
      try {
        await Promise.resolve(onSave({ ...formData, assignments: result } as any) as any);
        onClose();
      } finally {
        setIsSaving(false);
      }
    })();
  };

  const addAssignment = () => {
    setAssignments(prev => [...prev, { companyId: "", areaIds: [] }]);
  };

  const removeAssignment = (index: number) => {
    setAssignments(prev => prev.filter((_, i) => i !== index));
  };

  const updateCompany = (index: number, companyId: string) => {
    setAssignments(prev => prev.map((a, i) => i === index ? { companyId, areaIds: [] } : a));
  };

  const toggleArea = (index: number, areaId: string) => {
    setAssignments(prev => prev.map((a, i) => {
      if (i !== index) return a;
      const next = a.areaIds.includes(areaId)
        ? a.areaIds.filter(id => id !== areaId)
        : [...a.areaIds, areaId];
      return { ...a, areaIds: next };
    }));
  };

  const selectAllAreas = (index: number) => {
    const row = assignments[index];
    if (!row?.companyId) return;
    const allAreaIds = (companyAreas[row.companyId] || []).map(a => a.id);
    setAssignments(prev => prev.map((a, i) => i === index ? { ...a, areaIds: allAreaIds } : a));
  };

  const clearAllAreas = (index: number) => {
    setAssignments(prev => prev.map((a, i) => i === index ? { ...a, areaIds: [] } : a));
  };

  const getCompanyName = (companyId: string) =>
    companies.find(c => c.id === companyId)?.name || "";

  const getAreaName = (companyId: string, areaId: string) =>
    (companyAreas[companyId] || []).find(a => a.id === areaId)?.name || "";

  const usedCompanyIds = new Set(assignments.map(a => a.companyId).filter(Boolean));

  const totalCompanies = assignments.filter(a => a.companyId).length;
  const totalAreas = assignments.reduce((sum, a) => sum + a.areaIds.length, 0);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {lesson ? "Editar Lección" : "Crear Nueva Lección"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="titulo">Título de la Lección *</Label>
            <Input
              id="titulo"
              value={formData.titulo}
              onChange={(e) => setFormData(prev => ({ ...prev, titulo: e.target.value }))}
              className={errors.titulo ? "border-destructive" : ""}
              maxLength={200}
              placeholder="Ej: Present Simple Basics"
            />
            <div className="flex justify-between">
              {errors.titulo ? (
                <p className="text-sm text-destructive">{errors.titulo}</p>
              ) : <span />}
              <p className="text-xs text-muted-foreground">{formData.titulo.length}/200</p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="descripcion">Descripción corta *</Label>
            <Textarea
              id="descripcion"
              value={formData.descripcion}
              onChange={(e) => setFormData(prev => ({ ...prev, descripcion: e.target.value }))}
              className={errors.descripcion ? "border-destructive" : ""}
              rows={2}
              placeholder="Breve descripción de la lección..."
            />
            {errors.descripcion && <p className="text-sm text-destructive">{errors.descripcion}</p>}
          </div>

          <div className="grid grid-cols-[1fr_auto] gap-4 items-end">
            <div className="space-y-2">
              <Label>Línea / Programa</Label>
              <Select
                value={formData.programId}
                onValueChange={(value) => setFormData(prev => ({ ...prev, programId: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona una línea" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Estándar (por defecto)</SelectItem>
                  {programs.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-[1fr_auto] gap-4 items-end">
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
                  {programLevels.map(l => (
                    <SelectItem key={l.id} value={l.level}>{l.label}</SelectItem>
                  ))}
                  {programLevels.length === 0 && (
                    <SelectItem value="A1" disabled>Sin niveles definidos</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2 pb-0.5">
              <Switch
                id="obligatoria"
                checked={formData.obligatoria}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, obligatoria: checked }))}
              />
              <Label htmlFor="obligatoria" className="text-sm whitespace-nowrap">Obligatoria</Label>
            </div>
          </div>

          {companies.length > 0 && (
            <div className="space-y-3 border-t pt-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-muted-foreground" />
                  <Label className="text-sm font-semibold">Asignación de Empresas</Label>
                </div>
                {assignments.length > 0 && (
                  <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                    {totalCompanies} empresa{totalCompanies > 1 ? "s" : ""}
                    {totalAreas > 0 && ` · ${totalAreas} área${totalAreas > 1 ? "s" : ""}`}
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground -mt-1">
                Sin empresas asignadas = acceso abierto para todos
              </p>

              {assignments.length === 0 ? (
                <div className="flex items-center justify-between gap-3 py-3 px-4 rounded-lg border border-dashed bg-muted/30">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Globe className="w-4 h-4 text-muted-foreground shrink-0" />
                    <p className="text-sm text-muted-foreground">
                      Acceso abierto — visible para todos los usuarios
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-1.5 shrink-0"
                    onClick={addAssignment}
                  >
                    <Plus className="w-4 h-4" />
                    Agregar empresa
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  <TooltipProvider>
                    {assignments.map((row, index) => {
                      const areas = row.companyId ? (companyAreas[row.companyId] || []) : [];
                      const availableAreas = areas.filter(a => !row.areaIds.includes(a.id));
                      const companyName = getCompanyName(row.companyId);
                      const hasAreas = areas.length > 0;
                      return (
                        <div
                          key={index}
                          className="rounded-lg border bg-card p-3 space-y-2.5"
                        >
                          <div className="flex items-center gap-2">
                            <div className="flex-1 min-w-0">
                              <Select
                                value={row.companyId}
                                onValueChange={(v) => updateCompany(index, v)}
                              >
                                <SelectTrigger className="h-9">
                                  <SelectValue placeholder="Seleccionar empresa" />
                                </SelectTrigger>
                                <SelectContent>
                                  {companies.map(c => (
                                    <SelectItem
                                      key={c.id}
                                      value={c.id}
                                      disabled={c.id !== row.companyId && usedCompanyIds.has(c.id)}
                                    >
                                      {c.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive shrink-0"
                              onClick={() => removeAssignment(index)}
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          </div>

                          {row.companyId && (
                            <div className="space-y-2">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                {row.areaIds.length > 0 ? (
                                  row.areaIds.map(areaId => (
                                    <Tooltip key={areaId}>
                                      <TooltipTrigger asChild>
                                        <Badge
                                          variant="secondary"
                                          className="gap-1 pr-1 cursor-pointer hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30 transition-colors"
                                          onClick={() => toggleArea(index, areaId)}
                                        >
                                          <MapPin className="w-3 h-3" />
                                          {getAreaName(row.companyId, areaId)}
                                          <X className="w-3 h-3" />
                                        </Badge>
                                      </TooltipTrigger>
                                      <TooltipContent>Quitar área</TooltipContent>
                                    </Tooltip>
                                  ))
                                ) : (
                                  <Badge variant="outline" className="gap-1">
                                    <Building2 className="w-3 h-3" />
                                    Toda la empresa
                                  </Badge>
                                )}
                              </div>

                              {hasAreas && (
                                <Popover
                                  open={openPopovers[index] || false}
                                  onOpenChange={(open) => setOpenPopovers(prev => ({ ...prev, [index]: open }))}
                                >
                                  <PopoverTrigger asChild>
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      className="h-8 gap-1 text-xs"
                                    >
                                      <Plus className="w-3.5 h-3.5" />
                                      Agregar área
                                    </Button>
                                  </PopoverTrigger>
                                  <PopoverContent className="w-64 p-0" align="start">
                                    <Command>
                                      <CommandInput placeholder="Buscar área..." />
                                      <CommandList>
                                        <CommandEmpty>No hay áreas disponibles.</CommandEmpty>
                                        <CommandGroup>
                                          {availableAreas.length > 1 && (
                                            <>
                                              <CommandItem
                                                value="__select_all__"
                                                onSelect={() => selectAllAreas(index)}
                                                className="cursor-pointer text-primary font-medium"
                                              >
                                                Seleccionar todas ({availableAreas.length})
                                              </CommandItem>
                                              {row.areaIds.length > 0 && (
                                                <CommandItem
                                                  value="__clear_all__"
                                                  onSelect={() => clearAllAreas(index)}
                                                  className="cursor-pointer text-muted-foreground"
                                                >
                                                  Limpiar selección
                                                </CommandItem>
                                              )}
                                            </>
                                          )}
                                          {availableAreas.map(area => (
                                            <CommandItem
                                              key={area.id}
                                              value={area.name}
                                              onSelect={() => toggleArea(index, area.id)}
                                              className="cursor-pointer"
                                            >
                                              {area.name}
                                            </CommandItem>
                                          ))}
                                        </CommandGroup>
                                      </CommandList>
                                    </Command>
                                  </PopoverContent>
                                </Popover>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </TooltipProvider>

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-full gap-1.5 border-dashed"
                    onClick={addAssignment}
                  >
                    <Plus className="w-4 h-4" />
                    Agregar otra empresa
                  </Button>
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
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
