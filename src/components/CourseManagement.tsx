import { useState, useEffect, useCallback } from "react";
import { Plus, Edit, Eye, Trash2, ArrowUpDown, GripVertical, SearchX, MoreHorizontal, Building2, MapPin, Lock } from "lucide-react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import LessonFormModal from "./LessonFormModal";
import LessonDetailView from "./LessonDetailView";
import { supabase } from "@/lib/supabase";
import DeleteConfirmationDialog from "./DeleteConfirmationDialog";
import { useToast } from "@/hooks/use-toast";
import type { Lesson, Note, Exercise, ExerciseOption, RPCLessonCore, RPCGetLessonDetailResponse, RPCContentItem, Company, Area } from '@/types/db';

// lessons will be loaded from Supabase

const levelColors = {
  A1: "bg-red-100 text-red-800",
  A2: "bg-orange-100 text-orange-800",
  B1: "bg-yellow-100 text-yellow-800",
  B2: "bg-blue-100 text-blue-800",
  C1: "bg-green-100 text-green-800",
  C2: "bg-purple-100 text-purple-800"
};

interface AssignmentInfo {
  companyId: string;
  companyName: string;
  areaId: string | null;
  areaName: string | null;
}

const MAX_VISIBLE_BADGES = 2;

const buildAssignedTooltip = (assignments: AssignmentInfo[]) => {
  const grouped: Record<string, string[]> = {};
  assignments.forEach(a => {
    if (!grouped[a.companyName]) grouped[a.companyName] = [];
    grouped[a.companyName].push(a.areaName || "Toda la empresa");
  });
  return Object.entries(grouped).map(([company, areas]) =>
    `• ${company} → ${areas.join(", ")}`
  ).join("\n");
};

const SortableLessonRow = ({ lesson, assignments, onView, onEdit, onDelete }: {
  lesson: Lesson;
  assignments: AssignmentInfo[];
  onView: (l: Lesson) => void;
  onEdit: (l: Lesson) => void;
  onDelete: (id: string) => void;
}) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: lesson.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };
  const hasAssignments = assignments.length > 0;
  const visibleBadges = assignments.slice(0, MAX_VISIBLE_BADGES);
  const overflowCount = assignments.length - MAX_VISIBLE_BADGES;
  const tooltipText = buildAssignedTooltip(assignments);

  return (
    <TableRow
      ref={setNodeRef}
      style={style}
      className={`transition-colors ${hasAssignments ? "border-l-[3px] border-l-primary/70 bg-primary/[0.04] hover:bg-primary/[0.08]" : "hover:bg-muted/50"}`}
    >
      <TableCell>
        <button {...attributes} {...listeners} className="cursor-grab touch-none text-muted-foreground hover:text-foreground focus:outline-none">
          <GripVertical className="w-4 h-4" />
        </button>
      </TableCell>
      <TableCell className="font-medium max-w-[220px]">
        <div className="flex items-center gap-1.5">
          {hasAssignments && <Lock className="w-3.5 h-3.5 text-primary/60 shrink-0" />}
          <span className="truncate block">{lesson.titulo}</span>
        </div>
      </TableCell>
      <TableCell className="max-w-[180px]">
        <span className="truncate block text-muted-foreground text-sm">{lesson.descripcion}</span>
      </TableCell>
      <TableCell>
        <Badge className={levelColors[lesson.nivelAsociado as keyof typeof levelColors]}>{lesson.nivelAsociado}</Badge>
      </TableCell>
      <TableCell>
        <Badge variant={lesson.obligatoria ? "default" : "secondary"} className="text-xs">{lesson.obligatoria ? "Sí" : "No"}</Badge>
      </TableCell>
      <TableCell>
        <div className="flex flex-col gap-0.5 max-w-[240px]">
          {assignments.length === 0 ? (
            <span className="text-muted-foreground text-sm italic">Público</span>
          ) : (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex flex-wrap gap-1 cursor-default">
                    {visibleBadges.map((a, i) => (
                      <Badge key={i} variant="outline" className="text-xs whitespace-nowrap gap-1">
                        <Building2 className="w-3 h-3" />
                        {a.companyName}{a.areaName ? `: ${a.areaName}` : ""}
                      </Badge>
                    ))}
                    {overflowCount > 0 && (
                      <Badge variant="secondary" className="text-xs">+{overflowCount} más</Badge>
                    )}
                  </div>
                </TooltipTrigger>
                <TooltipContent side="left" className="max-w-xs whitespace-pre-line">
                  <p className="text-xs">{tooltipText}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      </TableCell>
      <TableCell className="w-[70px] text-center text-sm tabular-nums">{lesson.notas.length}</TableCell>
      <TableCell className="w-[80px] text-center text-sm tabular-nums">{lesson.ejercicios.length}</TableCell>
      <TableCell className="text-right">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
              <MoreHorizontal className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onView(lesson)}>
              <Eye className="w-4 h-4 mr-2" /> Ver detalle
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onEdit(lesson)}>
              <Edit className="w-4 h-4 mr-2" /> Editar
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => onDelete(lesson.id)} className="text-destructive focus:text-destructive">
              <Trash2 className="w-4 h-4 mr-2" /> Eliminar
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    </TableRow>
  );
};

export default function CourseManagement() {
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedLevel, setSelectedLevel] = useState<string>("all");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingLesson, setEditingLesson] = useState<Lesson | null>(null);
  const [selectedLesson, setSelectedLesson] = useState<Lesson | null>(null);
  const [deleteDialog, setDeleteDialog] = useState<{
    isOpen: boolean;
    onConfirm: () => void;
  }>({ isOpen: false, onConfirm: () => { } });
  const [reorderMode, setReorderMode] = useState(false);
  const [reorderedLessons, setReorderedLessons] = useState<Lesson[]>([]);
  const [isSavingOrder, setIsSavingOrder] = useState(false);
  const [assignmentsByLesson, setAssignmentsByLesson] = useState<Record<string, AssignmentInfo[]>>({});
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedCompany, setSelectedCompany] = useState<string>("all");
  const { toast } = useToast();

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleEnterReorderMode = () => {
    setReorderedLessons([...lessons]);
    setReorderMode(true);
  };

  const handleCancelReorder = () => {
    setReorderMode(false);
    setReorderedLessons([]);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setReorderedLessons((prev) => {
        const oldIndex = prev.findIndex(l => l.id === active.id);
        const newIndex = prev.findIndex(l => l.id === over.id);
        return arrayMove(prev, oldIndex, newIndex);
      });
    }
  };

  const handleSaveOrder = async () => {
    const previousOrder = [...lessons];
    setIsSavingOrder(true);
    try {
      await Promise.all(
        reorderedLessons.map((l, i) =>
          supabase.from('lessons').update({ sort_order: i + 1 }).eq('id', l.id)
        )
      );
      setLessons(reorderedLessons);
      setReorderMode(false);
      setReorderedLessons([]);
      toast({ title: 'Orden guardado', description: 'El orden de las lecciones fue actualizado.' });
    } catch (err) {
      console.error(err);
      setReorderedLessons(previousOrder);
      toast({ title: 'Error al guardar', description: 'No se pudo guardar el nuevo orden. Se revirtió al orden anterior.' });
    } finally {
      setIsSavingOrder(false);
    }
  };

  useEffect(() => {
    const fetchLessons = async () => {
      try {
        const { data, error } = await supabase.rpc('get_lessons', { p_search: '', p_level: 'all', p_limit: 100, p_offset: 0 });
        if (error) throw error;
        const payload = data as { data?: RPCLessonCore[]; count?: number } | null;
        const items = payload?.data || [];
        const mapped = items.map((l: RPCLessonCore) => ({
          id: l.id,
          titulo: l.title,
          descripcion: l.description,
          nivelAsociado: l.level,
          obligatoria: l.mandatory,
          fechaCreacion: l.created_at,
          sort_order: (l as any).sort_order ?? 0,
          notas: [],
          ejercicios: []
        }));
        setLessons(mapped);
        fetchAssignments(mapped.map(l => l.id));
      } catch (err) {
        console.error('Error fetching lessons', err);
        toast({ title: 'Error', description: 'No se pudieron cargar las lecciones.' });
      }
    };

    const fetchCompanies = async () => {
      const { data } = await supabase.from("companies").select("id, name, slug, active").eq("active", true).order("name");
      setCompanies((data as Company[]) || []);
    };

    fetchLessons();
    fetchCompanies();
  }, [toast]);

  const fetchAssignments = useCallback(async (lessonIds: string[]) => {
    if (lessonIds.length === 0) { setAssignmentsByLesson({}); return; }
    const { data } = await supabase
      .from("lesson_assignments")
      .select("lesson_id, company_id, area_id, companies!company_id(name), areas!area_id(name)")
      .in("lesson_id", lessonIds);
    const map: Record<string, AssignmentInfo[]> = {};
    (data || []).forEach((r: any) => {
      const lid = r.lesson_id;
      if (!map[lid]) map[lid] = [];
      map[lid].push({
        companyId: r.company_id,
        companyName: r.companies?.name ?? "—",
        areaId: r.area_id,
        areaName: r.areas?.name ?? null,
      });
    });
    setAssignmentsByLesson(map);
  }, []);

  const filteredLessons = lessons.filter(lesson => {
    const matchesSearch = lesson.titulo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lesson.descripcion.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesLevel = selectedLevel === "all" || lesson.nivelAsociado === selectedLevel;
    const matchesCompany = selectedCompany === "all" ||
      (assignmentsByLesson[lesson.id] || []).some(a => a.companyId === selectedCompany);
    return matchesSearch && matchesLevel && matchesCompany;
  });

  const handleCreateLesson = () => {
    setEditingLesson(null);
    setIsModalOpen(true);
  };

  const handleEditLesson = (lesson: Lesson) => {
    setEditingLesson(lesson);
    setIsModalOpen(true);
  };

  const handleViewLesson = (lesson: Lesson) => {
    // fetch detail payload via RPC and set selectedLesson mapped to UI model
    (async () => {
      try {
        const { data, error } = await supabase.rpc('get_lesson_detail', { p_lesson_id: lesson.id });
        if (error) throw error;
        const payload = data as RPCGetLessonDetailResponse;
        const core = payload.lesson;
        const content: RPCContentItem[] = payload.content || [];

        const notas = content.filter((c) => c.kind === 'note').map((n) => ({
          id: n.id,
          titulo: n.title || '',
          descripcion: n.content || '',
          imagenes: n.image_url ? [n.image_url] : [],
          audios: n.audio_url ? [n.audio_url] : [],
          activo: n.active || false,
          orden: n.order || 0
        }));

        const ejercicios = content.filter((c) => c.kind === 'exercise').map((e) => ({
          id: e.id,
          descripcion: e.title || '',
          tipo: e.type || '',
          contenido: e.content || '',
          imagenes: e.image_url ? [e.image_url] : [],
          audios: e.audio_url ? [e.audio_url] : [],
          opciones: (e.options || []).map((o) => ({ id: o.id, texto: o.text })),
          respuestaCorrecta: e.correct_option_id || '',
          obligatorio: e.mandatory || false,
          activo: e.active || false,
          orden: e.order || 0
        }));

        const mappedLesson: Lesson = {
          id: core.id,
          titulo: core.title,
          descripcion: core.description,
          nivelAsociado: core.level,
          obligatoria: core.mandatory,
          fechaCreacion: core.created_at,
          notas,
          ejercicios
        };

        setSelectedLesson(mappedLesson);
      } catch (err) {
        console.error(err);
        toast({ title: 'Error', description: 'No se pudo cargar el detalle de la lección.' });
      }
    })();
  };

  const handleDeleteLesson = (lessonId: string) => {
    setDeleteDialog({
      isOpen: true,
      onConfirm: () => {
        (async () => {
          try {
            const { error } = await supabase.from('lessons').delete().eq('id', lessonId);
            if (error) throw error;
            setLessons(prev => prev.filter(l => l.id !== lessonId));
            toast({ title: 'Lección eliminada', description: 'La lección ha sido eliminada correctamente.' });
          } catch (err) {
            console.error(err);
            toast({ title: 'Error', description: 'No se pudo eliminar la lección.' });
          }
        })();
      },
    });
  };

  const handleSaveLesson = async (lessonData: Omit<Lesson, 'id' | 'fechaCreacion' | 'notas' | 'ejercicios'> & { assignments?: { companyId: string; areaId: string | null }[] }) => {
    try {
      const newAssignments = lessonData.assignments || [];
      if (editingLesson) {
        const { error } = await supabase.from('lessons').update({
          title: lessonData.titulo,
          description: lessonData.descripcion,
          level: lessonData.nivelAsociado,
          mandatory: lessonData.obligatoria
        }).eq('id', editingLesson.id);
        if (error) throw error;

        // Diff assignments
        const { data: existing } = await supabase.from("lesson_assignments").select("company_id, area_id").eq("lesson_id", editingLesson.id);
        const existingSet = new Set((existing || []).map((r: any) => `${r.company_id}|${r.area_id || ""}`));
        const newSet = new Set(newAssignments.map(a => `${a.companyId}|${a.areaId || ""}`));

        // Delete removed
        for (const key of existingSet) {
          if (!newSet.has(key)) {
            const [cid, aid] = key.split("|");
            let q = supabase.from("lesson_assignments").delete().eq("lesson_id", editingLesson.id).eq("company_id", cid);
            if (aid) q = q.eq("area_id", aid); else q = q.is("area_id", null);
            await q;
          }
        }
        // Insert new
        for (const a of newAssignments) {
          if (!existingSet.has(`${a.companyId}|${a.areaId || ""}`)) {
            await supabase.from("lesson_assignments").insert({ lesson_id: editingLesson.id, company_id: a.companyId, area_id: a.areaId });
          }
        }

        const updatedLesson: Lesson = {
          ...editingLesson,
          titulo: lessonData.titulo,
          descripcion: lessonData.descripcion,
          nivelAsociado: lessonData.nivelAsociado,
          obligatoria: lessonData.obligatoria
        };
        setLessons(prev => prev.map(l => l.id === updatedLesson.id ? updatedLesson : l));
        fetchAssignments(lessons.map(l => l.id));
        toast({ title: 'Lección actualizada', description: 'Los datos de la lección han sido actualizados correctamente.' });
      } else {
        const maxSortOrder = lessons.reduce((max, l) => Math.max(max, (l as any).sort_order ?? 0), 0);
        const { data, error } = await supabase.from('lessons').insert([{
          title: lessonData.titulo,
          description: lessonData.descripcion,
          level: lessonData.nivelAsociado,
          mandatory: lessonData.obligatoria,
          sort_order: maxSortOrder + 1
        }]).select().single();
        if (error) throw error;

        // Insert assignments
        for (const a of newAssignments) {
          await supabase.from("lesson_assignments").insert({ lesson_id: data.id, company_id: a.companyId, area_id: a.areaId });
        }

        setLessons(prev => [{
          id: data.id,
          titulo: data.title,
          descripcion: data.description,
          nivelAsociado: data.level,
          obligatoria: data.mandatory,
          fechaCreacion: data.created_at,
          notas: [],
          ejercicios: []
        }, ...prev]);
        if (newAssignments.length > 0) fetchAssignments([data.id, ...lessons.map(l => l.id)]);
        toast({ title: 'Lección creada', description: 'La nueva lección ha sido creada correctamente.' });
      }
      setIsModalOpen(false);
      setEditingLesson(null);
    } catch (err) {
      console.error(err);
      toast({ title: 'Error', description: 'No se pudo guardar la lección.' });
    }
  };

  const handleUpdateLesson = (updatedLesson: Lesson) => {
    setLessons(lessons.map(lesson =>
      lesson.id === updatedLesson.id ? updatedLesson : lesson
    ));
    setSelectedLesson(updatedLesson);
  };

  if (selectedLesson) {
    return (
      <LessonDetailView
        lesson={selectedLesson}
        onBack={() => setSelectedLesson(null)}
        onUpdate={handleUpdateLesson}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Gestión de Cursos</h1>
          <p className="text-muted-foreground">Administra las lecciones y contenido educativo</p>
        </div>
        <div className="flex gap-2">
          {!reorderMode ? (
            <>
              {lessons.length > 1 && (
                <Button variant="outline" onClick={handleEnterReorderMode}>
                  <ArrowUpDown className="w-4 h-4 mr-2" />
                  Reordenar
                </Button>
              )}
              <Button onClick={handleCreateLesson} className="bg-primary hover:bg-primary-hover">
                <Plus className="w-4 h-4 mr-2" />
                Nueva Lección
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={handleCancelReorder} disabled={isSavingOrder}>Cancelar</Button>
              <Button onClick={handleSaveOrder} disabled={isSavingOrder}>
                {isSavingOrder ? 'Guardando...' : 'Guardar orden'}
              </Button>
            </>
          )}
        </div>
      </div>

      <Card className="shadow-card">
        <CardHeader>
          <CardTitle>Buscar Lecciones</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <div className="flex-1">
              <Input
                placeholder="Buscar por título o descripción..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="w-48">
              <Select value={selectedLevel} onValueChange={setSelectedLevel}>
                <SelectTrigger>
                  <SelectValue placeholder="Filtrar por nivel" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los niveles</SelectItem>
                  <SelectItem value="A1">A1</SelectItem>
                  <SelectItem value="A2">A2</SelectItem>
                  <SelectItem value="B1">B1</SelectItem>
                  <SelectItem value="B2">B2</SelectItem>
                  <SelectItem value="C1">C1</SelectItem>
                  <SelectItem value="C2">C2</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="w-52">
              <Select value={selectedCompany} onValueChange={setSelectedCompany}>
                <SelectTrigger>
                  <SelectValue placeholder="Filtrar por empresa" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las empresas</SelectItem>
                  {companies.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-card">
        <CardHeader>
          <CardTitle>
            Lecciones ({reorderMode ? reorderedLessons.length : filteredLessons.length})
            {reorderMode && <span className="ml-2 text-sm font-normal text-muted-foreground">— Arrastra para reordenar</span>}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {reorderMode ? (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={reorderedLessons.map(l => l.id)} strategy={verticalListSortingStrategy}>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-8"></TableHead>
                      <TableHead>Título</TableHead>
                      <TableHead>Descripción</TableHead>
                      <TableHead>Nivel</TableHead>
                      <TableHead>Obligatoria</TableHead>
                      <TableHead>Empresa</TableHead>
                      <TableHead className="text-center">Notas</TableHead>
                      <TableHead className="text-center">Ejercicios</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reorderedLessons.map((lesson) => (
                      <SortableLessonRow
                        key={lesson.id}
                        lesson={lesson}
                        assignments={assignmentsByLesson[lesson.id] || []}
                        onView={handleViewLesson}
                        onEdit={handleEditLesson}
                        onDelete={handleDeleteLesson}
                      />
                    ))}
                  </TableBody>
                </Table>
              </SortableContext>
            </DndContext>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Título</TableHead>
                  <TableHead>Descripción</TableHead>
                  <TableHead>Nivel</TableHead>
                  <TableHead>Obligatoria</TableHead>
                  <TableHead>Empresa</TableHead>
                  <TableHead className="text-center">Notas</TableHead>
                  <TableHead className="text-center">Ejercicios</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLessons.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="h-32 text-center">
                      <div className="flex flex-col items-center justify-center text-muted-foreground">
                        <SearchX className="w-10 h-10 mb-3 opacity-40" />
                        <p className="text-sm font-medium">No se encontraron lecciones</p>
                        <p className="text-xs mt-1">Intenta con otros filtros o crea una nueva lección</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                filteredLessons.map((lesson) => {
                  const assigns = assignmentsByLesson[lesson.id] || [];
                  const hasAssignments = assigns.length > 0;
                  const visibleBadges = assigns.slice(0, MAX_VISIBLE_BADGES);
                  const overflowCount = assigns.length - MAX_VISIBLE_BADGES;
                  const tooltipText = buildAssignedTooltip(assigns);
                  return (
                  <TableRow
                    key={lesson.id}
                    className={`transition-colors ${hasAssignments ? "bg-primary/[0.02] hover:bg-primary/[0.04]" : "hover:bg-muted/50"}`}
                  >
                    <TableCell className="font-medium max-w-[220px]">
                      <div className="flex items-center gap-1.5">
                        {hasAssignments && <Lock className="w-3.5 h-3.5 text-primary/60 shrink-0" />}
                        <span className="truncate block">{lesson.titulo}</span>
                      </div>
                    </TableCell>
                    <TableCell className="max-w-[180px]">
                      <span className="truncate block text-muted-foreground text-sm">{lesson.descripcion}</span>
                    </TableCell>
                    <TableCell>
                      <Badge className={levelColors[lesson.nivelAsociado as keyof typeof levelColors]}>{lesson.nivelAsociado}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={lesson.obligatoria ? "default" : "secondary"} className="text-xs">{lesson.obligatoria ? "Sí" : "No"}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-0.5 max-w-[240px]">
                        {assigns.length === 0 ? (
                          <span className="text-muted-foreground text-sm italic">Público</span>
                        ) : (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="flex flex-wrap gap-1 cursor-default">
                                  {visibleBadges.map((a, i) => (
                                    <Badge key={i} variant="outline" className="text-xs whitespace-nowrap gap-1">
                                      <Building2 className="w-3 h-3" />
                                      {a.companyName}{a.areaName ? `: ${a.areaName}` : ""}
                                    </Badge>
                                  ))}
                                  {overflowCount > 0 && (
                                    <Badge variant="secondary" className="text-xs">+{overflowCount} más</Badge>
                                  )}
                                </div>
                              </TooltipTrigger>
                              <TooltipContent side="left" className="max-w-xs whitespace-pre-line">
                                <p className="text-xs">{tooltipText}</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="w-[70px] text-center text-sm tabular-nums">{lesson.notas.length}</TableCell>
                    <TableCell className="w-[80px] text-center text-sm tabular-nums">{lesson.ejercicios.length}</TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleViewLesson(lesson)}>
                            <Eye className="w-4 h-4 mr-2" /> Ver detalle
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleEditLesson(lesson)}>
                            <Edit className="w-4 h-4 mr-2" /> Editar
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => handleDeleteLesson(lesson.id)} className="text-destructive focus:text-destructive">
                            <Trash2 className="w-4 h-4 mr-2" /> Eliminar
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                  );
                })
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <LessonFormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveLesson}
        lesson={editingLesson}
        companies={companies}
        initialAssignments={editingLesson ? (assignmentsByLesson[editingLesson.id] || []) : []}
      />

      <DeleteConfirmationDialog
        isOpen={deleteDialog.isOpen}
        onClose={() => setDeleteDialog({ ...deleteDialog, isOpen: false })}
        onConfirm={deleteDialog.onConfirm}
      />
    </div>
  );
}