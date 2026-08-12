import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import { listPrograms, listProgramLevels, listLevelConfig, upsertLevelConfig, getLevelColor } from "@/lib/levels";
import type { Program, ProgramLevel, ProgramLevelConfig } from "@/types/db";
import DeleteConfirmationDialog from "./DeleteConfirmationDialog";
import { Plus, Pencil, Trash2, Layers, Target, GitBranch, BookOpen, Sparkles, Check, ArrowRight } from "lucide-react";

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

interface ProgramFormState {
  name: string;
  slug: string;
  description: string;
  has_level_progression: boolean;
  active: boolean;
}

const emptyProgramForm = (): ProgramFormState => ({
  name: "",
  slug: "",
  description: "",
  has_level_progression: true,
  active: true,
});

const STANDARD_LEVELS = [
  ["A1", 0],
  ["A2", 1],
  ["B1", 2],
  ["B2", 3],
  ["C1", 4],
  ["C2", 5],
] as const;

export default function ProgramManagement() {
  const navigate = useNavigate();
  const [programs, setPrograms] = useState<Program[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedProgram, setSelectedProgram] = useState<Program | null>(null);

  const [programModalOpen, setProgramModalOpen] = useState(false);
  const [editingProgram, setEditingProgram] = useState<Program | null>(null);
  const [programForm, setProgramForm] = useState<ProgramFormState>(emptyProgramForm());

  const [levelModalOpen, setLevelModalOpen] = useState(false);
  const [editingLevel, setEditingLevel] = useState<ProgramLevel | null>(null);
  const [levelForm, setLevelForm] = useState({ level: "", label: "", sort_order: 0 });

  const [levels, setLevels] = useState<ProgramLevel[]>([]);
  const [config, setConfig] = useState<ProgramLevelConfig[]>([]);
  const [configDraft, setConfigDraft] = useState<Record<string, string>>({});
  const [savingConfig, setSavingConfig] = useState(false);
  const [creatingStandard, setCreatingStandard] = useState(false);

  const [deleteDialog, setDeleteDialog] = useState<{ isOpen: boolean; id: string | null; kind: "program" | "level" | null }>({ isOpen: false, id: null, kind: null });
  const { toast } = useToast();

  const loadPrograms = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listPrograms();
      setPrograms(data);
      setSelectedProgram((prev) => prev && data.some((p) => p.id === prev.id) ? prev : null);
    } catch (err) {
      console.error(err);
      toast({ title: "Error", description: "No se pudieron cargar los programas." });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadPrograms();
  }, [loadPrograms]);

  const loadProgramDetails = useCallback(async (programId: string) => {
    const [lvl, cfg] = await Promise.all([listProgramLevels(programId), listLevelConfig(programId)]);
    setLevels(lvl);
    setConfig(cfg);
    const draft: Record<string, string> = {};
    cfg.forEach((c) => { draft[c.level] = String(c.points_required); });
    setConfigDraft(draft);
  }, []);

  useEffect(() => {
    if (selectedProgram) {
      loadProgramDetails(selectedProgram.id);
    } else {
      setLevels([]);
      setConfig([]);
      setConfigDraft({});
    }
  }, [selectedProgram, loadProgramDetails]);

  const seedLevelsForProgram = async (programId: string) => {
    await supabase.from("program_levels").insert(
      STANDARD_LEVELS.map(([level, ord]) => ({ program_id: programId, level, label: level, sort_order: ord })),
    );
    await supabase.from("program_level_config").insert(
      STANDARD_LEVELS.map(([level]) => ({ program_id: programId, level, points_required: 0 })),
    );
  };

  const createStandardLine = async () => {
    setCreatingStandard(true);
    try {
      const { data, error } = await supabase
        .from("programs")
        .insert({
          name: "Estándar",
          slug: "estandar",
          description: "Línea de aprendizaje general con niveles A1-C2.",
          has_level_progression: true,
          active: true,
        })
        .select()
        .single();
      if (error) throw error;
      await seedLevelsForProgram(data.id);
      toast({ title: "Creado", description: "Línea Estándar creada con sus niveles A1-C2." });
      await loadPrograms();
      setSelectedProgram(data);
    } catch (err) {
      console.error(err);
      toast({ title: "Error", description: "No se pudo crear la línea Estándar." });
    } finally {
      setCreatingStandard(false);
    }
  };

  const openCreateProgram = () => {
    setEditingProgram(null);
    setProgramForm(emptyProgramForm());
    setProgramModalOpen(true);
  };

  const openEditProgram = (p: Program) => {
    setEditingProgram(p);
    setProgramForm({
      name: p.name,
      slug: p.slug,
      description: p.description ?? "",
      has_level_progression: p.has_level_progression,
      active: p.active,
    });
    setProgramModalOpen(true);
  };

  const handleProgramNameChange = (value: string) => {
    setProgramForm((prev) => ({
      ...prev,
      name: value,
      slug: editingProgram ? prev.slug : toSlug(value),
    }));
  };

  const handleSaveProgram = async () => {
    const payload = {
      name: programForm.name.trim(),
      slug: programForm.slug.trim(),
      description: programForm.description.trim(),
      has_level_progression: programForm.has_level_progression,
      active: programForm.active,
    };
    if (!payload.name || !payload.slug) return;
    try {
      if (editingProgram) {
        const { error } = await supabase.from("programs").update(payload).eq("id", editingProgram.id);
        if (error) throw error;
        toast({ title: "Guardado", description: "Programa actualizado correctamente." });
      } else {
        const { data, error } = await supabase.from("programs").insert(payload).select().single();
        if (error) throw error;
        if (data && programForm.has_level_progression) {
          await seedLevelsForProgram(data.id);
        }
        toast({ title: "Creado", description: "Programa creado correctamente." });
        setSelectedProgram(data);
      }
      setProgramModalOpen(false);
      loadPrograms();
    } catch (err) {
      console.error(err);
      toast({ title: "Error", description: "No se pudo guardar el programa." });
    }
  };

  const handleDelete = async () => {
    if (!deleteDialog.id || !deleteDialog.kind) return;
    try {
      if (deleteDialog.kind === "program") {
        const { error } = await supabase.from("programs").delete().eq("id", deleteDialog.id);
        if (error) throw error;
        toast({ title: "Eliminado", description: "Programa eliminado correctamente." });
        setSelectedProgram(null);
        loadPrograms();
      } else {
        const { error } = await supabase.from("program_levels").delete().eq("id", deleteDialog.id);
        if (error) throw error;
        toast({ title: "Eliminado", description: "Nivel eliminado correctamente." });
        if (selectedProgram) {
          loadProgramDetails(selectedProgram.id);
        }
      }
    } catch (err) {
      console.error(err);
      toast({ title: "Error", description: "No se pudo eliminar." });
    }
  };

  const openCreateLevel = () => {
    setEditingLevel(null);
    setLevelForm({ level: "", label: "", sort_order: levels.length });
    setLevelModalOpen(true);
  };

  const openEditLevel = (lvl: ProgramLevel) => {
    setEditingLevel(lvl);
    setLevelForm({ level: lvl.level, label: lvl.label, sort_order: lvl.sort_order });
    setLevelModalOpen(true);
  };

  const handleSaveLevel = async () => {
    if (!selectedProgram) return;
    if (!levelForm.level.trim() || !levelForm.label.trim()) return;
    const payload = {
      program_id: selectedProgram.id,
      level: levelForm.level.trim(),
      label: levelForm.label.trim(),
      sort_order: Number(levelForm.sort_order) || 0,
    };
    try {
      if (editingLevel) {
        const { error } = await supabase.from("program_levels").update(payload).eq("id", editingLevel.id);
        if (error) throw error;
        toast({ title: "Guardado", description: "Nivel actualizado correctamente." });
      } else {
        const { error } = await supabase.from("program_levels").insert(payload);
        if (error) {
          if (error.code === "23505") {
            toast({ title: "Duplicado", description: "Ese nivel ya existe en este programa." });
          } else throw error;
          return;
        }
        await supabase.from("program_level_config").upsert(
          { program_id: selectedProgram.id, level: payload.level, points_required: 0 },
          { onConflict: "program_id,level" },
        );
        toast({ title: "Creado", description: "Nivel creado correctamente." });
      }
      setLevelModalOpen(false);
      loadProgramDetails(selectedProgram.id);
    } catch (err) {
      console.error(err);
      toast({ title: "Error", description: "No se pudo guardar el nivel." });
    }
  };

  const handleSaveConfig = async () => {
    if (!selectedProgram) return;
    setSavingConfig(true);
    try {
      for (const [level, value] of Object.entries(configDraft)) {
        const points = Math.max(0, parseInt(value || "0", 10) || 0);
        await upsertLevelConfig(selectedProgram.id, level, points);
      }
      toast({ title: "Guardado", description: "Configuración de puntos actualizada." });
      loadProgramDetails(selectedProgram.id);
    } catch (err) {
      console.error(err);
      toast({ title: "Error", description: "No se pudo guardar la configuración." });
    } finally {
      setSavingConfig(false);
    }
  };

  const selectedLevels = selectedProgram?.has_level_progression ? levels : [];

  return (
    <div className="space-y-6 p-6">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <GitBranch className="h-6 w-6 text-primary" /> Programas y Niveles
          </h1>
          <p className="text-muted-foreground">
            Líneas de aprendizaje (Estándar, Kids, TOEFL), sus niveles y los puntos requeridos por nivel.
          </p>
        </div>
        <Button onClick={openCreateProgram}>
          <Plus className="h-4 w-4 mr-1" /> Nueva línea
        </Button>
      </div>

      {loading ? (
        <p className="text-muted-foreground">Cargando...</p>
      ) : programs.length === 0 ? (
        <Card className="py-16 shadow-card">
          <CardContent className="flex flex-col items-center text-center gap-4">
            <div className="h-14 w-14 rounded-full bg-gradient-primary flex items-center justify-center shadow-elegant">
              <Sparkles className="h-7 w-7 text-white" />
            </div>
            <div>
              <p className="text-lg font-semibold">Aún no hay líneas creadas</p>
              <p className="text-sm text-muted-foreground mt-1 max-w-md">
                Crea la línea Estándar con sus niveles A1-C2 automáticamente, o configura una línea personalizada como Kids o TOEFL.
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-3 pt-2">
              <Button onClick={createStandardLine} disabled={creatingStandard}>
                <Plus className="h-4 w-4 mr-1" />
                {creatingStandard ? "Creando..." : "Crear la línea Estándar"}
              </Button>
              <Button variant="outline" onClick={openCreateProgram}>
                Nueva línea personalizada
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[280px_1fr] items-start">
          {/* ============ LISTA COMPACTA DE LÍNEAS ============ */}
          <div className="space-y-2 xl:sticky xl:top-6">
            <div className="flex items-center justify-between px-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Líneas</p>
              <Badge variant="secondary">{programs.length}</Badge>
            </div>
            <div className="rounded-lg border bg-card shadow-card overflow-hidden divide-y">
              {programs.map((p) => {
                const isSelected = selectedProgram?.id === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setSelectedProgram(p)}
                    className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 text-left transition-colors cursor-pointer border-l-[3px] ${
                      isSelected
                        ? "bg-primary/10 border-l-primary"
                        : "border-l-transparent hover:bg-secondary/60"
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`h-2 w-2 rounded-full shrink-0 ${p.active ? "bg-success" : "bg-muted-foreground"}`} />
                      <div className="min-w-0">
                        <p className={`text-sm font-medium truncate ${isSelected ? "text-primary" : "text-foreground"}`}>{p.name}</p>
                        <p className="text-xs text-muted-foreground truncate">/{p.slug}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {!p.has_level_progression ? (
                        <Badge className="bg-accent/10 text-accent border-accent/20">Sin progresión</Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground whitespace-nowrap">{p.level_count ?? 0} niveles</span>
                      )}
                      {isSelected && <Check className="h-4 w-4 text-primary shrink-0" />}
                    </div>
                  </button>
                );
              })}
            </div>
            <button
              type="button"
              onClick={openCreateProgram}
              className="w-full flex items-center justify-center gap-2 rounded-lg border border-dashed px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-secondary/60 hover:text-foreground"
            >
              <Plus className="h-4 w-4" /> Nueva línea
            </button>
          </div>

          {/* ============ DETALLE ============ */}
          <div>
            {!selectedProgram ? (
              <Card className="py-16 shadow-card">
                <CardContent className="flex flex-col items-center text-center gap-3">
                  <div className="h-12 w-12 rounded-full bg-secondary flex items-center justify-center">
                    <GitBranch className="h-6 w-6 text-secondary-foreground" />
                  </div>
                  <div>
                    <p className="font-semibold">Selecciona una línea</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Haz clic en una línea de la izquierda para ver sus niveles y puntos requeridos.
                    </p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {/* Cabecera compacta del programa */}
                <Card className="shadow-card overflow-hidden">
                  <CardContent className="p-4 flex flex-wrap items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                        <GitBranch className="h-5 w-5 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h2 className="text-lg font-semibold leading-tight">{selectedProgram.name}</h2>
                          {selectedProgram.active ? (
                            <Badge className="bg-success/10 text-success border-success/20">Activa</Badge>
                          ) : (
                            <Badge className="bg-muted text-muted-foreground">Inactiva</Badge>
                          )}
                          {!selectedProgram.has_level_progression && (
                            <Badge className="bg-accent/10 text-accent border-accent/20">Sin progresión</Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">/{selectedProgram.slug}</p>
                        {selectedProgram.description && (
                          <p className="text-sm text-muted-foreground mt-1">{selectedProgram.description}</p>
                        )}
                        <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Layers className="h-3.5 w-3.5" /> {selectedProgram.level_count ?? 0} niveles
                          </span>
                          <span className="flex items-center gap-1">
                            <Target className="h-3.5 w-3.5" /> {selectedProgram.lesson_count ?? 0} lecciones
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Button variant="outline" size="sm" onClick={() => openEditProgram(selectedProgram)}>
                        <Pencil className="h-4 w-4 mr-1" /> Editar
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setDeleteDialog({ isOpen: true, id: selectedProgram.id, kind: "program" })}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                {selectedProgram.has_level_progression ? (
                  <Tabs defaultValue="levels">
                    <TabsList className="grid w-full max-w-md grid-cols-2">
                      <TabsTrigger value="levels">Niveles</TabsTrigger>
                      <TabsTrigger value="points">Puntos requeridos</TabsTrigger>
                    </TabsList>

                    {/* TAB: NIVELES */}
                    <TabsContent value="levels" className="space-y-4">
                      <Card className="shadow-card">
                        <CardContent className="p-5 space-y-4">
                          <div className="flex items-center justify-between gap-3">
                            <h3 className="font-semibold flex items-center gap-2">
                              <Layers className="h-4 w-4 text-primary" /> Niveles de {selectedProgram.name}
                            </h3>
                            <Button size="sm" onClick={openCreateLevel}>
                              <Plus className="h-4 w-4 mr-1" /> Nuevo nivel
                            </Button>
                          </div>
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Nivel</TableHead>
                                <TableHead>Etiqueta</TableHead>
                                <TableHead>Orden</TableHead>
                                <TableHead className="text-right">Acciones</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {selectedLevels.map((lvl) => (
                                <TableRow key={lvl.id}>
                                  <TableCell>
                                    <Badge className={getLevelColor(lvl.level, levels)}>{lvl.level}</Badge>
                                  </TableCell>
                                  <TableCell>{lvl.label}</TableCell>
                                  <TableCell>{lvl.sort_order}</TableCell>
                                  <TableCell className="text-right">
                                    <div className="flex justify-end gap-1">
                                      <Button variant="ghost" size="sm" onClick={() => openEditLevel(lvl)}>
                                        <Pencil className="h-4 w-4" />
                                      </Button>
                                      <Button variant="ghost" size="sm" onClick={() => setDeleteDialog({ isOpen: true, id: lvl.id, kind: "level" })}>
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    </div>
                                  </TableCell>
                                </TableRow>
                              ))}
                              {selectedLevels.length === 0 && (
                                <TableRow>
                                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                                    No hay niveles definidos.
                                  </TableCell>
                                </TableRow>
                              )}
                            </TableBody>
                          </Table>
                        </CardContent>
                      </Card>
                    </TabsContent>

                    {/* TAB: PUNTOS REQUERIDOS */}
                    <TabsContent value="points" className="space-y-4">
                      <Card className="shadow-card">
                        <CardContent className="p-5 space-y-4">
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <h3 className="font-semibold flex items-center gap-2">
                                <Target className="h-4 w-4 text-primary" /> Puntos requeridos
                              </h3>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                Puntos necesarios para desbloquear el examen de cada nivel en la app móvil.
                              </p>
                            </div>
                            <Button size="sm" onClick={handleSaveConfig} disabled={savingConfig}>
                              {savingConfig ? "Guardando..." : "Guardar"}
                            </Button>
                          </div>
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Nivel</TableHead>
                                <TableHead>Puntos requeridos</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {levels.map((lvl) => (
                                <TableRow key={lvl.id}>
                                  <TableCell>
                                    <Badge className={getLevelColor(lvl.level, levels)}>{lvl.level}</Badge>
                                  </TableCell>
                                  <TableCell>
                                    <Input
                                      type="number"
                                      min={0}
                                      className="max-w-[140px]"
                                      value={configDraft[lvl.level] ?? "0"}
                                      onChange={(e) =>
                                        setConfigDraft((prev) => ({ ...prev, [lvl.level]: e.target.value }))
                                      }
                                    />
                                  </TableCell>
                                </TableRow>
                              ))}
                              {levels.length === 0 && (
                                <TableRow>
                                  <TableCell colSpan={2} className="text-center text-muted-foreground">
                                    Define niveles primero para configurar sus puntos.
                                  </TableCell>
                                </TableRow>
                              )}
                            </TableBody>
                          </Table>
                        </CardContent>
                      </Card>
                    </TabsContent>
                  </Tabs>
                ) : (
                  // Sin progresión (TOEFL)
                  <Card className="border-accent/30 bg-accent/5 shadow-card">
                    <CardContent className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="flex items-start gap-3">
                        <BookOpen className="h-6 w-6 text-accent shrink-0" />
                        <div>
                          <p className="font-semibold">{selectedProgram.name} no tiene progresión de niveles</p>
                          <p className="text-sm text-muted-foreground mt-1">
                            Su configuración (duración, % de aprobación y banco de preguntas) se administra en la pestaña "Simulacro TOEFL" de Lecciones y Quizzes.
                          </p>
                        </div>
                      </div>
                      <Button className="shrink-0" onClick={() => navigate("/quizzes")}>
                        Ir a Simulacro TOEFL <ArrowRight className="h-4 w-4 ml-1" />
                      </Button>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ============ MODAL: PROGRAMA ============ */}
      <Dialog open={programModalOpen} onOpenChange={setProgramModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingProgram ? "Editar Línea / Programa" : "Nueva Línea / Programa"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nombre</Label>
              <Input value={programForm.name} onChange={(e) => handleProgramNameChange(e.target.value)} placeholder="Ej: Kids" />
            </div>
            <div>
              <Label>Slug (identificador)</Label>
              <Input value={programForm.slug} onChange={(e) => setProgramForm((prev) => ({ ...prev, slug: e.target.value }))} placeholder="Ej: kids" />
              <p className="text-xs text-muted-foreground mt-1">Identificador URL-friendly. Se genera automáticamente del nombre.</p>
            </div>
            <div>
              <Label>Descripción</Label>
              <Input value={programForm.description} onChange={(e) => setProgramForm((prev) => ({ ...prev, description: e.target.value }))} placeholder="Ej: Línea infantil con niveles A1-C2" />
            </div>
            <div className="flex items-center gap-3">
              <Label>Progresión de niveles</Label>
              <Switch
                checked={programForm.has_level_progression}
                onCheckedChange={(v) => setProgramForm((prev) => ({ ...prev, has_level_progression: v }))}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              {programForm.has_level_progression
                ? "Con progresión: los usuarios suben de nivel mediante exámenes (ej: Estándar, Kids)."
                : "Sin progresión: programa independiente sin exámenes de nivel (ej: TOEFL)."}
            </p>
            <div className="flex items-center gap-3">
              <Label>Activa</Label>
              <Switch checked={programForm.active} onCheckedChange={(v) => setProgramForm((prev) => ({ ...prev, active: v }))} />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setProgramModalOpen(false)}>Cancelar</Button>
              <Button onClick={handleSaveProgram} disabled={!programForm.name.trim() || !programForm.slug.trim()}>Guardar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ============ MODAL: NIVEL ============ */}
      <Dialog open={levelModalOpen} onOpenChange={setLevelModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingLevel ? "Editar Nivel" : "Nuevo Nivel"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nivel (código)</Label>
              <Input value={levelForm.level} onChange={(e) => setLevelForm((prev) => ({ ...prev, level: e.target.value }))} placeholder="Ej: A1" />
            </div>
            <div>
              <Label>Etiqueta</Label>
              <Input value={levelForm.label} onChange={(e) => setLevelForm((prev) => ({ ...prev, label: e.target.value }))} placeholder="Ej: A1 Kids" />
            </div>
            <div>
              <Label>Orden</Label>
              <Input type="number" min={0} value={String(levelForm.sort_order)} onChange={(e) => setLevelForm((prev) => ({ ...prev, sort_order: parseInt(e.target.value || "0", 10) || 0 }))} />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setLevelModalOpen(false)}>Cancelar</Button>
              <Button onClick={handleSaveLevel} disabled={!levelForm.level.trim() || !levelForm.label.trim()}>Guardar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <DeleteConfirmationDialog
        isOpen={deleteDialog.isOpen}
        onClose={() => setDeleteDialog({ isOpen: false, id: null, kind: null })}
        onConfirm={handleDelete}
        title={deleteDialog.kind === "program" ? "¿Eliminar esta línea/programa?" : "¿Eliminar este nivel?"}
        description={
          deleteDialog.kind === "program"
            ? "El contenido asociado quedará sin línea asignada. Esta acción no se puede deshacer."
            : "Esta acción no se puede deshacer."
        }
      />
    </div>
  );
}
