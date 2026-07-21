import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import supabase from "@/lib/supabase";
import type { Company, Area } from "@/types/db";
import CompanyFormModal from "./CompanyFormModal";
import CompanyDetailDialog from "./CompanyDetailDialog";
import MembershipFormModal from "./MembershipFormModal";
import AreaFormModal from "./AreaFormModal";
import LessonAssignModal from "./LessonAssignModal";
import DeleteConfirmationDialog from "./DeleteConfirmationDialog";
import { MoreVertical, Eye, Pencil, Trash2, UserPlus, FolderPlus, BookOpen } from "lucide-react";

export default function CompanyManagement() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing] = useState<Company | null>(null);
  const [deleteDialog, setDeleteDialog] = useState<{ isOpen: boolean; id: string | null }>({ isOpen: false, id: null });
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  const [detailTab, setDetailTab] = useState("members");
  const [standaloneAreas, setStandaloneAreas] = useState<Area[]>([]);
  const [memberModalOpen, setMemberModalOpen] = useState(false);
  const [areaModalOpen, setAreaModalOpen] = useState(false);
  const [lessonAssignOpen, setLessonAssignOpen] = useState(false);
  const [standaloneCompany, setStandaloneCompany] = useState<Company | null>(null);
  const [standaloneAssignedIds, setStandaloneAssignedIds] = useState<string[]>([]);
  const [standaloneExcludedIds, setStandaloneExcludedIds] = useState<string[]>([]);
  const { toast } = useToast();
  const PAGE_SIZE = 20;

  const load = async () => {
    setLoading(true);
    try {
      const from = (page - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      const { data, error } = await supabase.rpc("get_companies", {
        p_search: search,
        p_active: "all",
        p_limit: PAGE_SIZE,
        p_offset: from,
      });
      if (error) throw error;
      setCompanies((data as any)?.data || []);
      setTotal((data as any)?.total || 0);
    } catch (err) {
      console.error(err);
      toast({ title: "Error", description: "No se pudieron cargar las empresas." });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [page, search]);

  const handleCreate = () => {
    setEditing(null);
    setIsModalOpen(true);
  };

  const handleEdit = (c: Company) => {
    setEditing(c);
    setIsModalOpen(true);
  };

  const handleSave = async (data: { name: string; slug: string; active: boolean }) => {
    try {
      if (editing) {
        const { error } = await supabase.from("companies").update(data).eq("id", editing.id);
        if (error) throw error;
        toast({ title: "Guardado", description: "Empresa actualizada correctamente." });
      } else {
        const { error } = await supabase.from("companies").insert(data);
        if (error) throw error;
        toast({ title: "Creada", description: "Empresa creada correctamente." });
      }
      setIsModalOpen(false);
      load();
    } catch (err) {
      console.error(err);
      toast({ title: "Error", description: "No se pudo guardar la empresa." });
    }
  };

  const handleDelete = async () => {
    if (!deleteDialog.id) return;
    try {
      const { error } = await supabase.from("companies").delete().eq("id", deleteDialog.id);
      if (error) throw error;
      toast({ title: "Eliminada", description: "Empresa eliminada correctamente." });
      load();
    } catch (err) {
      console.error(err);
      toast({ title: "Error", description: "No se pudo eliminar la empresa." });
    }
  };

  const openDetail = (c: Company, tab: string) => {
    setSelectedCompany(c);
    setDetailTab(tab);
    setShowDetail(true);
  };

  const fetchAreasForCompany = async (companyId: string) => {
    const { data } = await supabase.rpc("get_company_areas", {
      p_company_id: companyId,
      p_search: "",
      p_limit: 200,
      p_offset: 0,
    });
    return ((data as any)?.data || []) as Area[];
  };

  const openAddMember = async (c: Company) => {
    setStandaloneCompany(c);
    const [areas, members] = await Promise.all([
      fetchAreasForCompany(c.id),
      supabase.from("company_memberships").select("profile_id").eq("company_id", c.id),
    ]);
    setStandaloneAreas(areas);
    setStandaloneExcludedIds((members.data || []).map((r: any) => r.profile_id));
    setMemberModalOpen(true);
  };

  const openCreateArea = (c: Company) => {
    setStandaloneCompany(c);
    setAreaModalOpen(true);
  };

  const openAssignLesson = async (c: Company) => {
    setStandaloneCompany(c);
    const areas = await fetchAreasForCompany(c.id);
    setStandaloneAreas(areas);
    const { data } = await supabase
      .from("lesson_assignments")
      .select("lesson_id")
      .eq("company_id", c.id);
    setStandaloneAssignedIds((data || []).map((r: any) => r.lesson_id));
    setLessonAssignOpen(true);
  };

  const handleStandaloneAddMember = async (data: { profile_id: string; area_id: string | null }) => {
    if (!standaloneCompany) return;
    try {
      const { error } = await supabase.from("company_memberships").insert({
        company_id: standaloneCompany.id,
        profile_id: data.profile_id,
        area_id: data.area_id,
        active: true,
      });
      if (error) {
        if (error.code === "23505") {
          toast({ title: "Duplicado", description: "Este usuario ya pertenece a esa area en esta empresa." });
        } else throw error;
        return;
      }
      toast({ title: "Agregado", description: "Miembro agregado correctamente." });
      setMemberModalOpen(false);
      load();
    } catch (err) {
      console.error(err);
      toast({ title: "Error", description: "No se pudo agregar el miembro." });
    }
  };

  const handleStandaloneSaveArea = async (data: { name: string; active: boolean }) => {
    if (!standaloneCompany) return;
    try {
      const { error } = await supabase.from("areas").insert({ ...data, company_id: standaloneCompany.id });
      if (error) throw error;
      toast({ title: "Creada", description: "Area creada correctamente." });
      setAreaModalOpen(false);
      load();
    } catch (err) {
      console.error(err);
      toast({ title: "Error", description: "No se pudo crear el area." });
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Empresas</h1>
        <Button onClick={handleCreate}>Nueva Empresa</Button>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="mb-4">
            <Input
              placeholder="Buscar empresa..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="max-w-sm"
            />
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Slug</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-center">Miembros</TableHead>
                <TableHead className="text-center">Areas</TableHead>
                <TableHead className="text-center">Cursos</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    Cargando...
                  </TableCell>
                </TableRow>
              ) : companies.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    No se encontraron empresas.
                  </TableCell>
                </TableRow>
              ) : (
                companies.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell>
                      <button className="font-medium underline underline-offset-2 text-foreground hover:text-muted-foreground" onClick={() => openDetail(c, "members")}>
                        {c.name}
                      </button>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{c.slug}</TableCell>
                    <TableCell>
                      <Badge variant={c.active ? "default" : "secondary"}>
                        {c.active ? "Activa" : "Inactiva"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <button className="underline underline-offset-2 text-muted-foreground hover:text-foreground" onClick={() => openDetail(c, "members")}>
                        {c.member_count ?? 0}
                      </button>
                    </TableCell>
                    <TableCell className="text-center">
                      <button className="underline underline-offset-2 text-muted-foreground hover:text-foreground" onClick={() => openDetail(c, "areas")}>
                        {c.area_count ?? 0}
                      </button>
                    </TableCell>
                    <TableCell className="text-center">
                      <button className="underline underline-offset-2 text-muted-foreground hover:text-foreground" onClick={() => openDetail(c, "lessons")}>
                        {c.lesson_count ?? 0}
                      </button>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" title="Ver detalles" onClick={() => openDetail(c, "members")}>
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" title="Editar" onClick={() => handleEdit(c)}>
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" title="Agregar miembro" onClick={() => openAddMember(c)}>
                          <UserPlus className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" title="Crear area" onClick={() => openCreateArea(c)}>
                          <FolderPlus className="w-4 h-4" />
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openAssignLesson(c)}>
                              <BookOpen className="w-4 h-4 mr-2" /> Asignar Curso
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setDeleteDialog({ isOpen: true, id: c.id })} className="text-destructive focus:text-destructive">
                              <Trash2 className="w-4 h-4 mr-2" /> Eliminar
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-sm text-muted-foreground">
                Página {page} de {totalPages} ({total} total)
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                  Anterior
                </Button>
                <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                  Siguiente
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <CompanyFormModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onSave={handleSave} company={editing} />
      {selectedCompany && (
        <CompanyDetailDialog
          company={selectedCompany}
          open={showDetail}
          onClose={() => setShowDetail(false)}
          initialTab={detailTab}
          onDataChange={load}
        />
      )}
      {standaloneCompany && (
        <>
          <MembershipFormModal
            isOpen={memberModalOpen}
            onClose={() => setMemberModalOpen(false)}
            onSave={handleStandaloneAddMember}
            areas={standaloneAreas}
            excludeProfileIds={standaloneExcludedIds}
          />
          <AreaFormModal
            isOpen={areaModalOpen}
            onClose={() => setAreaModalOpen(false)}
            onSave={handleStandaloneSaveArea}
            area={null}
          />
          <LessonAssignModal
            isOpen={lessonAssignOpen}
            onClose={() => setLessonAssignOpen(false)}
            companyId={standaloneCompany.id}
            areas={standaloneAreas}
            assignedLessonIds={standaloneAssignedIds}
            onAssigned={() => { setLessonAssignOpen(false); load(); }}
          />
        </>
      )}
      <DeleteConfirmationDialog
        isOpen={deleteDialog.isOpen}
        onClose={() => setDeleteDialog({ isOpen: false, id: null })}
        onConfirm={handleDelete}
        title="Eliminar empresa"
        description="Se eliminarán todas las areas, membresías y asignaciones de esta empresa."
      />
    </div>
  );
}
