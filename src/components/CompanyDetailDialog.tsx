import { useEffect, useState, useCallback, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import supabase from "@/lib/supabase";
import type { Company, Area, CompanyMembership, LessonAssignment } from "@/types/db";
import AreaFormModal from "./AreaFormModal";
import MembershipFormModal from "./MembershipFormModal";
import LessonAssignModal from "./LessonAssignModal";
import DeleteConfirmationDialog from "./DeleteConfirmationDialog";
import { Pencil, Trash2, Plus, Users, Loader2, FolderOpen, BookOpen } from "lucide-react";

interface LessonAssignmentRow extends LessonAssignment {
  lesson_title?: string;
  lesson_level?: string;
  lesson_mandatory?: boolean;
  area_name?: string | null;
}

interface CompanyDetailDialogProps {
  company: Company;
  open: boolean;
  onClose: () => void;
  initialTab?: string;
  onDataChange?: () => void;
}

export default function CompanyDetailDialog({ company, open, onClose, initialTab = "members", onDataChange }: CompanyDetailDialogProps) {
  const [activeTab, setActiveTab] = useState(initialTab);
  const [areas, setAreas] = useState<Area[]>([]);
  const [memberships, setMemberships] = useState<CompanyMembership[]>([]);
  const [membersTotal, setMembersTotal] = useState(0);
  const [areasTotal, setAreasTotal] = useState(0);
  const [memberPage, setMemberPage] = useState(1);
  const [areaPage, setAreaPage] = useState(1);
  const [memberSearch, setMemberSearch] = useState("");
  const [areaSearch, setAreaSearch] = useState("");
  const [areaFilter, setAreaFilter] = useState("__all__");
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [loadingAreas, setLoadingAreas] = useState(false);
  const [areaModalOpen, setAreaModalOpen] = useState(false);
  const [editingArea, setEditingArea] = useState<Area | null>(null);
  const [memberModalOpen, setMemberModalOpen] = useState(false);
  const [memberProfileIds, setMemberProfileIds] = useState<string[]>([]);
  const [areaDeleteDialog, setAreaDeleteDialog] = useState<{ isOpen: boolean; id: string | null }>({ isOpen: false, id: null });
  const [memberDeleteDialog, setMemberDeleteDialog] = useState<{ isOpen: boolean; id: string | null }>({ isOpen: false, id: null });
  const [updatingRows, setUpdatingRows] = useState<Set<string>>(new Set());
  const [lessonAssignments, setLessonAssignments] = useState<LessonAssignmentRow[]>([]);
  const [lessonsTotal, setLessonsTotal] = useState(0);
  const [lessonPage, setLessonPage] = useState(1);
  const [lessonSearch, setLessonSearch] = useState("");
  const [loadingLessons, setLoadingLessons] = useState(false);
  const [lessonAreaFilter, setLessonAreaFilter] = useState("__all__");
  const [lessonAssignOpen, setLessonAssignOpen] = useState(false);
  const [lessonDeleteDialog, setLessonDeleteDialog] = useState<{ isOpen: boolean; id: string | null }>({ isOpen: false, id: null });
  const { toast } = useToast();
  const PAGE_SIZE = 10;
  const loadedRef = useRef(false);
  const prevCompanyIdRef = useRef<string>("");

  const loadAreas = useCallback(async (silent = false) => {
    if (!silent) setLoadingAreas(true);
    try {
      const from = (areaPage - 1) * PAGE_SIZE;
      const { data, error } = await supabase.rpc("get_company_areas", {
        p_company_id: company.id,
        p_search: areaSearch,
        p_limit: PAGE_SIZE,
        p_offset: from,
      });
      if (error) throw error;
      setAreas((data as any)?.data || []);
      setAreasTotal((data as any)?.total || 0);
    } catch (err) {
      console.error(err);
      if (!silent) toast({ title: "Error", description: "No se pudieron cargar las áreas." });
    } finally {
      if (!silent) setLoadingAreas(false);
    }
  }, [company.id, areaPage, areaSearch, toast]);

  const loadAllAreas = useCallback(async () => {
    const { data, error } = await supabase.rpc("get_company_areas", {
      p_company_id: company.id,
      p_search: "",
      p_limit: 200,
      p_offset: 0,
    });
    if (!error && data) setAreas((data as any)?.data || []);
  }, [company.id]);

  const loadMembers = useCallback(async (silent = false) => {
    if (!silent) setLoadingMembers(true);
    try {
      const from = (memberPage - 1) * PAGE_SIZE;
      const { data, error } = await supabase.rpc("get_company_members", {
        p_company_id: company.id,
        p_area_id: areaFilter === "__all__" || areaFilter === "__none__" ? null : areaFilter,
        p_search: memberSearch,
        p_limit: PAGE_SIZE,
        p_offset: from,
      });
      if (error) throw error;

      let resultData = (data as any)?.data || [];
      const resultTotal = (data as any)?.total || 0;

      if (areaFilter === "__none__") {
        resultData = resultData.filter((m: CompanyMembership) => m.area_id === null);
      }

      setMemberships(resultData);
      setMembersTotal(areaFilter === "__none__" ? resultData.length : resultTotal);
    } catch (err) {
      console.error(err);
      if (!silent) toast({ title: "Error", description: "No se pudieron cargar los miembros." });
    } finally {
      if (!silent) setLoadingMembers(false);
    }
  }, [company.id, memberPage, memberSearch, areaFilter, toast]);

  const loadLessons = useCallback(async (silent = false) => {
    if (!silent) setLoadingLessons(true);
    try {
      const from = (lessonPage - 1) * PAGE_SIZE;
      let query = supabase
        .from("lesson_assignments")
        .select("id, lesson_id, company_id, area_id, assigned_by, created_at, lessons!lesson_id(title, level, mandatory), areas!area_id(name)", { count: "exact" })
        .eq("company_id", company.id)
        .range(from, from + PAGE_SIZE - 1)
        .order("created_at", { ascending: false });
      if (lessonAreaFilter !== "__all__") {
        if (lessonAreaFilter === "__none__") {
          query = query.is("area_id", null);
        } else {
          query = query.eq("area_id", lessonAreaFilter);
        }
      }
      const { data, error, count } = await query;
      if (error) throw error;
      const rows: LessonAssignmentRow[] = (data || []).map((r: any) => ({
        id: r.id,
        lesson_id: r.lesson_id,
        company_id: r.company_id,
        area_id: r.area_id,
        assigned_by: r.assigned_by,
        created_at: r.created_at,
        lesson_title: r.lessons?.title ?? null,
        lesson_level: r.lessons?.level ?? null,
        lesson_mandatory: r.lessons?.mandatory ?? null,
        area_name: r.areas?.name ?? null,
      }));
      setLessonAssignments(rows);
      setLessonsTotal(count || 0);
    } catch (err) {
      console.error(err);
      if (!silent) toast({ title: "Error", description: "No se pudieron cargar los cursos." });
    } finally {
      if (!silent) setLoadingLessons(false);
    }
  }, [company.id, lessonPage, lessonAreaFilter, toast]);

  useEffect(() => {
    if (open) {
      setActiveTab(initialTab);
      if (company.id !== prevCompanyIdRef.current || !loadedRef.current) {
        prevCompanyIdRef.current = company.id;
        loadedRef.current = true;
        loadAllAreas();
        loadMembers();
        loadAreas();
        loadLessons();
      }
    }
  }, [open, company.id, loadAllAreas, loadMembers, loadAreas, loadLessons, initialTab]);

  useEffect(() => {
    if (loadedRef.current) loadAreas(true);
  }, [areaPage, areaSearch, loadAreas]);

  useEffect(() => {
    if (loadedRef.current) loadMembers(true);
  }, [memberPage, memberSearch, areaFilter, loadMembers]);

  useEffect(() => {
    if (loadedRef.current) loadLessons(true);
  }, [lessonPage, lessonAreaFilter, loadLessons]);

  const filterByArea = (areaId: string) => {
    setAreaFilter(areaId);
    setMemberPage(1);
    setActiveTab("members");
  };

  const openMemberModal = async () => {
    const { data } = await supabase
      .from("company_memberships")
      .select("profile_id")
      .eq("company_id", company.id);
    setMemberProfileIds((data || []).map((r: any) => r.profile_id));
    openMemberModal();
  };

  const handleSaveArea = async (data: { name: string; active: boolean }) => {
    try {
      if (editingArea) {
        const { error } = await supabase.from("areas").update(data).eq("id", editingArea.id);
        if (error) throw error;
        toast({ title: "Guardado", description: "Área actualizada correctamente." });
        setAreas((prev) => prev.map((a) => a.id === editingArea.id ? { ...a, ...data } : a));
      } else {
        const { error } = await supabase.from("areas").insert({ ...data, company_id: company.id });
        if (error) throw error;
        toast({ title: "Creada", description: "Área creada correctamente." });
        loadAreas();
        loadAllAreas();
      }
      onDataChange?.();
      setAreaModalOpen(false);
    } catch (err) {
      console.error(err);
      toast({ title: "Error", description: "No se pudo guardar el área." });
    }
  };

  const handleDeleteArea = async () => {
    if (!areaDeleteDialog.id) return;
    try {
      const { error } = await supabase.from("areas").delete().eq("id", areaDeleteDialog.id);
      if (error) throw error;
      toast({ title: "Eliminada", description: "Área eliminada correctamente." });
      setAreas((prev) => prev.filter((a) => a.id !== areaDeleteDialog.id));
      setAreasTotal((prev) => Math.max(0, prev - 1));
      loadAllAreas();
      onDataChange?.();
    } catch (err) {
      console.error(err);
      toast({ title: "Error", description: "No se pudo eliminar el área." });
    }
  };

  const handleAddMember = async (data: { profile_id: string; area_id: string | null }) => {
    try {
      const { data: inserted, error } = await supabase
        .from("company_memberships")
        .insert({
          company_id: company.id,
          profile_id: data.profile_id,
          area_id: data.area_id,
          active: true,
        })
        .select("*, profiles(name, last_name, email), areas(name)")
        .single();
      if (error) {
        if (error.code === "23505") {
          toast({ title: "Duplicado", description: "Este usuario ya pertenece a esa área en esta empresa." });
        } else {
          throw error;
        }
        return;
      }
      const newMember: CompanyMembership = {
        ...(inserted as any),
        profile_name: (inserted as any)?.profiles?.name ?? null,
        profile_last_name: (inserted as any)?.profiles?.last_name ?? null,
        profile_email: (inserted as any)?.profiles?.email ?? null,
        area_name: (inserted as any)?.areas?.name ?? null,
      };
      setMemberships((prev) => [newMember, ...prev]);
      setMembersTotal((prev) => prev + 1);
      onDataChange?.();
      toast({ title: "Agregado", description: "Miembro agregado correctamente." });
      setMemberModalOpen(false);
    } catch (err) {
      console.error(err);
      toast({ title: "Error", description: "No se pudo agregar el miembro." });
    }
  };

  const handleChangeArea = async (membershipId: string, newAreaId: string | null) => {
    const membership = memberships.find((m) => m.id === membershipId);
    if (!membership) return;

    const oldAreaId = membership.area_id;
    const oldAreaName = membership.area_name;
    const newAreaName = newAreaId ? areas.find((a) => a.id === newAreaId)?.name ?? null : null;

    setMemberships((prev) =>
      prev.map((m) =>
        m.id === membershipId ? { ...m, area_id: newAreaId, area_name: newAreaName } : m
      )
    );
    setUpdatingRows((prev) => new Set(prev).add(membershipId));

    try {
      const { error } = await supabase
        .from("company_memberships")
        .update({ area_id: newAreaId })
        .eq("id", membershipId);
      if (error) throw error;
    } catch {
      setMemberships((prev) =>
        prev.map((m) =>
          m.id === membershipId ? { ...m, area_id: oldAreaId, area_name: oldAreaName } : m
        )
      );
      toast({ title: "Error", description: "No se pudo cambiar el área." });
    } finally {
      setUpdatingRows((prev) => {
        const next = new Set(prev);
        next.delete(membershipId);
        return next;
      });
    }
  };

  const handleToggleActive = async (m: CompanyMembership) => {
    const newActive = !m.active;
    setMemberships((prev) =>
      prev.map((mem) => (mem.id === m.id ? { ...mem, active: newActive } : mem))
    );
    try {
      const { error } = await supabase.from("company_memberships").update({ active: newActive }).eq("id", m.id);
      if (error) throw error;
      toast({ title: "Actualizado", description: newActive ? "Miembro activado." : "Miembro desactivado." });
    } catch {
      setMemberships((prev) =>
        prev.map((mem) => (mem.id === m.id ? { ...mem, active: !newActive } : mem))
      );
      toast({ title: "Error", description: "No se pudo actualizar el miembro." });
    }
  };

  const handleDeleteMember = async () => {
    if (!memberDeleteDialog.id) return;
    const deletedId = memberDeleteDialog.id;
    const deletedMember = memberships.find((m) => m.id === deletedId);
    setMemberships((prev) => prev.filter((m) => m.id !== deletedId));
    setMembersTotal((prev) => Math.max(0, prev - 1));
    try {
      const { error } = await supabase.from("company_memberships").delete().eq("id", deletedId);
      if (error) throw error;
      onDataChange?.();
      toast({ title: "Eliminado", description: "Miembro eliminado correctamente." });
    } catch {
      if (deletedMember) {
        setMemberships((prev) => [...prev, deletedMember]);
        setMembersTotal((prev) => prev + 1);
      }
      toast({ title: "Error", description: "No se pudo eliminar el miembro." });
    }
  };

  const totalMemberPages = Math.max(1, Math.ceil(membersTotal / PAGE_SIZE));
  const totalAreaPages = Math.max(1, Math.ceil(areasTotal / PAGE_SIZE));
  const totalLessonPages = Math.max(1, Math.ceil(lessonsTotal / PAGE_SIZE));
  const assignedLessonIds = lessonAssignments.map((la) => la.lesson_id);

  const handleDeleteLesson = async () => {
    if (!lessonDeleteDialog.id) return;
    const deletedId = lessonDeleteDialog.id;
    const deletedAssignment = lessonAssignments.find((la) => la.id === deletedId);
    setLessonAssignments((prev) => prev.filter((la) => la.id !== deletedId));
    setLessonsTotal((prev) => Math.max(0, prev - 1));
    try {
      const { error } = await supabase.from("lesson_assignments").delete().eq("id", deletedId);
      if (error) throw error;
      onDataChange?.();
      toast({ title: "Desasignado", description: "Curso desasignado correctamente." });
    } catch {
      if (deletedAssignment) {
        setLessonAssignments((prev) => [...prev, deletedAssignment]);
        setLessonsTotal((prev) => prev + 1);
      }
      toast({ title: "Error", description: "No se pudo desasignar el curso." });
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>{company.name}</DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 overflow-hidden flex flex-col">
          <TabsList className="justify-start">
            <TabsTrigger value="members">Miembros ({membersTotal})</TabsTrigger>
            <TabsTrigger value="areas">Areas ({areasTotal})</TabsTrigger>
            <TabsTrigger value="lessons">Cursos ({lessonsTotal})</TabsTrigger>
          </TabsList>

          <TabsContent value="members" forceMount className="flex-1 overflow-auto mt-2 data-[state=inactive]:hidden">
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <Input
                  placeholder="Buscar por nombre o email..."
                  value={memberSearch}
                  onChange={(e) => { setMemberSearch(e.target.value); setMemberPage(1); }}
                  className="max-w-xs"
                />
                <Select value={areaFilter} onValueChange={(v) => { setAreaFilter(v); setMemberPage(1); }}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="Todas las areas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">Todas las areas</SelectItem>
                    <SelectItem value="__none__">Sin area especifica</SelectItem>
                    {areas.filter((a) => a.active).map((a) => (
                      <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="flex-1" />
                <Button size="sm" onClick={() => openMemberModal()}>
                  <Plus className="w-4 h-4 mr-1" /> Agregar Miembro
                </Button>
              </div>

              <div className="border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nombre</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Area</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Desde</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loadingMembers ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-6 text-muted-foreground">Cargando...</TableCell>
                      </TableRow>
                    ) : memberships.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6}>
                          <div className="flex flex-col items-center justify-center py-8 text-center">
                            <div className="rounded-full bg-muted p-3 mb-3">
                              <Users className="w-6 h-6 text-muted-foreground" />
                            </div>
                            <p className="font-medium">Aun no hay miembros asignados</p>
                            <p className="text-sm text-muted-foreground mt-1 mb-3">
                              Agrega personas a esta empresa para que puedan acceder a los cursos asignados.
                            </p>
                            <Button size="sm" onClick={() => openMemberModal()}>
                              <Plus className="w-4 h-4 mr-1" /> Agregar Primer Miembro
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      memberships.map((m) => {
                        const isUpdating = updatingRows.has(m.id);
                        return (
                          <TableRow
                            key={m.id}
                            className={cn(
                              "transition-colors duration-300",
                              isUpdating && "bg-muted/50"
                            )}
                          >
                            <TableCell className={cn("font-medium", isUpdating && "text-muted-foreground")}>
                              {m.profile_name} {m.profile_last_name}
                            </TableCell>
                            <TableCell className={cn("text-muted-foreground", isUpdating && "opacity-50")}>
                              {m.profile_email}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1.5">
                                <Select
                                  value={m.area_id ?? "__none__"}
                                  onValueChange={(v) => handleChangeArea(m.id, v === "__none__" ? null : v)}
                                  disabled={isUpdating}
                                >
                                  <SelectTrigger className={cn("h-8 w-[160px] text-xs", isUpdating && "opacity-50")}>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="__none__">Sin area</SelectItem>
                                    {areas.filter((a) => a.active).map((a) => (
                                      <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                {isUpdating && <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant={m.active ? "default" : "secondary"}>
                                {m.active ? "Activo" : "Inactivo"}
                              </Badge>
                            </TableCell>
                            <TableCell>{new Date(m.created_at).toLocaleDateString("es-MX")}</TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-1">
                                <Button variant="ghost" size="sm" onClick={() => handleToggleActive(m)} disabled={isUpdating}>
                                  {m.active ? "Desactivar" : "Activar"}
                                </Button>
                                <Button variant="ghost" size="icon" title="Eliminar" onClick={() => setMemberDeleteDialog({ isOpen: true, id: m.id })} disabled={isUpdating}>
                                  <Trash2 className="w-4 h-4 text-destructive" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>

              {totalMemberPages > 1 && (
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    Pagina {memberPage} de {totalMemberPages} ({membersTotal} total)
                  </p>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" disabled={memberPage <= 1} onClick={() => setMemberPage((p) => p - 1)}>
                      Anterior
                    </Button>
                    <Button variant="outline" size="sm" disabled={memberPage >= totalMemberPages} onClick={() => setMemberPage((p) => p + 1)}>
                      Siguiente
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="areas" forceMount className="flex-1 overflow-auto mt-2 data-[state=inactive]:hidden">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Input
                  placeholder="Buscar area..."
                  value={areaSearch}
                  onChange={(e) => { setAreaSearch(e.target.value); setAreaPage(1); }}
                  className="max-w-xs"
                />
                <Button size="sm" onClick={() => { setEditingArea(null); setAreaModalOpen(true); }}>
                  <Plus className="w-4 h-4 mr-1" /> Nueva Area
                </Button>
              </div>

              <div className="border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nombre</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead className="text-center">Miembros</TableHead>
                      <TableHead className="text-center">Cursos</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loadingAreas ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-6 text-muted-foreground">Cargando...</TableCell>
                      </TableRow>
                    ) : areas.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5}>
                          <div className="flex flex-col items-center justify-center py-8 text-center">
                            <div className="rounded-full bg-muted p-3 mb-3">
                              <FolderOpen className="w-6 h-6 text-muted-foreground" />
                            </div>
                            <p className="font-medium">Organiza a tus miembros</p>
                            <p className="text-sm text-muted-foreground mt-1 mb-3">
                              Crea areas para agrupar miembros y asignar cursos especificos a cada grupo.
                            </p>
                            <Button size="sm" onClick={() => { setEditingArea(null); setAreaModalOpen(true); }}>
                              <Plus className="w-4 h-4 mr-1" /> Crear Primera Area
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      areas.map((a) => (
                        <TableRow key={a.id}>
                          <TableCell className="font-medium">{a.name}</TableCell>
                          <TableCell>
                            <Badge variant={a.active ? "default" : "secondary"}>
                              {a.active ? "Activa" : "Inactiva"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center">{a.member_count ?? 0}</TableCell>
                          <TableCell className="text-center">{a.lesson_count ?? 0}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button variant="ghost" size="icon" title="Ver miembros de esta area" onClick={() => filterByArea(a.id)}>
                                <Users className="w-4 h-4" />
                              </Button>
                              <Button variant="ghost" size="icon" title="Editar" onClick={() => { setEditingArea(a); setAreaModalOpen(true); }}>
                                <Pencil className="w-4 h-4" />
                              </Button>
                              <Button variant="ghost" size="icon" title="Eliminar" onClick={() => setAreaDeleteDialog({ isOpen: true, id: a.id })}>
                                <Trash2 className="w-4 h-4 text-destructive" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>

              {totalAreaPages > 1 && (
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    Pagina {areaPage} de {totalAreaPages} ({areasTotal} total)
                  </p>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" disabled={areaPage <= 1} onClick={() => setAreaPage((p) => p - 1)}>
                      Anterior
                    </Button>
                    <Button variant="outline" size="sm" disabled={areaPage >= totalAreaPages} onClick={() => setAreaPage((p) => p + 1)}>
                      Siguiente
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="lessons" forceMount className="flex-1 overflow-auto mt-2 data-[state=inactive]:hidden">
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <Select value={lessonAreaFilter} onValueChange={(v) => { setLessonAreaFilter(v); setLessonPage(1); }}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="Todas las areas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">Todas las areas</SelectItem>
                    <SelectItem value="__none__">Sin area especifica</SelectItem>
                    {areas.filter((a) => a.active).map((a) => (
                      <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="flex-1" />
                <Button size="sm" onClick={() => setLessonAssignOpen(true)}>
                  <Plus className="w-4 h-4 mr-1" /> Asignar Curso
                </Button>
              </div>

              <div className="border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Titulo</TableHead>
                      <TableHead>Nivel</TableHead>
                      <TableHead>Obligatoria</TableHead>
                      <TableHead>Area</TableHead>
                      <TableHead>Asignado</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loadingLessons ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-6 text-muted-foreground">Cargando...</TableCell>
                      </TableRow>
                    ) : lessonAssignments.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6}>
                          <div className="flex flex-col items-center justify-center py-8 text-center">
                            <div className="rounded-full bg-muted p-3 mb-3">
                              <BookOpen className="w-6 h-6 text-muted-foreground" />
                            </div>
                            <p className="font-medium">Asigna cursos para que aprendan</p>
                            <p className="text-sm text-muted-foreground mt-1 mb-3">
                              Selecciona los cursos que esta empresa debe completar. Puedes asignarlos a toda la empresa o a un area especifica.
                            </p>
                            <Button size="sm" onClick={() => setLessonAssignOpen(true)}>
                              <Plus className="w-4 h-4 mr-1" /> Asignar Primer Curso
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      lessonAssignments.map((la) => (
                        <TableRow key={la.id}>
                          <TableCell className="font-medium">{la.lesson_title ?? "—"}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{la.lesson_level ?? "—"}</Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant={la.lesson_mandatory ? "default" : "secondary"}>
                              {la.lesson_mandatory ? "Si" : "No"}
                            </Badge>
                          </TableCell>
                          <TableCell>{la.area_name ?? <span className="text-muted-foreground italic">Toda la empresa</span>}</TableCell>
                          <TableCell className="text-muted-foreground text-sm">
                            {new Date(la.created_at).toLocaleDateString("es-MX")}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button variant="ghost" size="icon" title="Desasignar" onClick={() => setLessonDeleteDialog({ isOpen: true, id: la.id })}>
                              <Trash2 className="w-4 h-4 text-destructive" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>

              {totalLessonPages > 1 && (
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    Pagina {lessonPage} de {totalLessonPages} ({lessonsTotal} total)
                  </p>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" disabled={lessonPage <= 1} onClick={() => setLessonPage((p) => p - 1)}>
                      Anterior
                    </Button>
                    <Button variant="outline" size="sm" disabled={lessonPage >= totalLessonPages} onClick={() => setLessonPage((p) => p + 1)}>
                      Siguiente
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>

        <AreaFormModal isOpen={areaModalOpen} onClose={() => setAreaModalOpen(false)} onSave={handleSaveArea} area={editingArea} />
        <MembershipFormModal isOpen={memberModalOpen} onClose={() => setMemberModalOpen(false)} onSave={handleAddMember} areas={areas} excludeProfileIds={memberProfileIds} />
        <DeleteConfirmationDialog
          isOpen={areaDeleteDialog.isOpen}
          onClose={() => setAreaDeleteDialog({ isOpen: false, id: null })}
          onConfirm={handleDeleteArea}
          title="Eliminar area"
          description="Se eliminaran las membresias y asignaciones de cursos de esta area."
        />
        <DeleteConfirmationDialog
          isOpen={memberDeleteDialog.isOpen}
          onClose={() => setMemberDeleteDialog({ isOpen: false, id: null })}
          onConfirm={handleDeleteMember}
          title="Eliminar miembro"
          description="Se eliminara la membresia de este usuario de esta empresa/area."
        />
        <LessonAssignModal
          isOpen={lessonAssignOpen}
          onClose={() => setLessonAssignOpen(false)}
          companyId={company.id}
          areas={areas}
          assignedLessonIds={assignedLessonIds}
          onAssigned={() => loadLessons()}
        />
        <DeleteConfirmationDialog
          isOpen={lessonDeleteDialog.isOpen}
          onClose={() => setLessonDeleteDialog({ isOpen: false, id: null })}
          onConfirm={handleDeleteLesson}
          title="Desasignar curso"
          description="Este curso dejará de estar asignado a esta empresa."
        />
      </DialogContent>
    </Dialog>
  );
}
