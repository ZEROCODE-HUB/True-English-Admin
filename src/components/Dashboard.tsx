import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";
import { Users, UserPlus, Download, Eye, Bell, BookOpen, Clock, Building2, TrendingUp, BarChart3 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import StudentDetailModal from "./StudentDetailModal";

interface KpiData {
  title: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}

const initialKpis: KpiData[] = [
  { title: "Usuarios", value: "—", icon: Users, color: "text-primary" },
  { title: "Nuevos (7d)", value: "—", icon: UserPlus, color: "text-accent" },
  { title: "Completadas Hoy", value: "—", icon: BookOpen, color: "text-success" },
  { title: "Cursos Asignados", value: "—", icon: BarChart3, color: "text-warning" },
  { title: "Tasa Completado", value: "—", icon: TrendingUp, color: "text-success" },
  { title: "Tiempo Promedio", value: "—", icon: Clock, color: "text-accent" },
];

interface Student {
  id: string;
  nombre: string;
  nivelActual: string | null;
  empresa: string | null;
  ultimaLeccion: string | null;
  puntosAcumulados: number;
  tiempoDedicado: string;
  tiempoDedicadoHuman?: string;
  correo: string;
  testsRealizados: { nombre: string; calificacion: number }[];
  logros: string[];
}

interface Notification {
  id: string;
  mensaje: string;
  tiempo: string;
  tipo: "lesson" | "exam" | "achievement";
}

export default function Dashboard() {
  const [nameFilter, setNameFilter] = useState("");
  const [levelFilter, setLevelFilter] = useState("all");
  const [selectedCompanyId, setSelectedCompanyId] = useState("all");
  const [selectedAreaId, setSelectedAreaId] = useState("all");
  const [companies, setCompanies] = useState<{ id: string; name: string }[]>([]);
  const [areas, setAreas] = useState<{ id: string; name: string }[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const itemsPerPage = 10;
  const [students, setStudents] = useState<Student[]>([]);
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [studentsTotal, setStudentsTotal] = useState(0);

  const [kpis, setKpis] = useState<KpiData[]>(initialKpis);
  const [levelStats, setLevelStats] = useState<Record<string, { count: number; percent: number }>>({});
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const isFiltered = selectedCompanyId !== "all";
  const isAreaFiltered = selectedAreaId !== "all";

  const getCompanyProfileIds = useCallback(async (companyId: string, areaId?: string): Promise<string[]> => {
    if (companyId === "all") return [];
    let query = supabase
      .from("company_memberships")
      .select("profile_id")
      .eq("company_id", companyId)
      .eq("active", true);
    if (areaId && areaId !== "all") {
      query = query.eq("area_id", areaId);
    }
    const { data } = await query;
    return (data || []).map((m: any) => m.profile_id);
  }, []);

  const loadKpis = useCallback(async () => {
    try {
      const memberProfileIds = isFiltered ? await getCompanyProfileIds(selectedCompanyId, selectedAreaId) : [];
      const hasCompany = isFiltered && memberProfileIds.length > 0;
      const noCompany = isFiltered && memberProfileIds.length === 0;

      if (noCompany) {
        setKpis(initialKpis);
        return;
      }

      const since7d = new Date();
      since7d.setDate(since7d.getDate() - 7);
      const since7dIso = since7d.toISOString();

      const now = new Date();
      const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      const endToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).toISOString();

      let membersCount = 0;
      let newCount = 0;
      let completedTodayCount = 0;
      let assignCount = 0;
      let completionRate = 0;
      let avgHours = 0;

      if (hasCompany) {
        membersCount = memberProfileIds.length;

        const [nc, ct, acRes, totalEnrollRes, completedEnrollRes, fgRes] = await Promise.all([
          supabase.from("profiles").select("id", { count: "exact" }).gte("created_at", since7dIso).in("id", memberProfileIds),
          supabase.from("enrollments").select("id", { count: "exact" }).eq("status", "completed").gte("updated_at", startToday).lte("updated_at", endToday).in("profile_id", memberProfileIds),
          supabase.from("lesson_assignments").select("lesson_id").eq("company_id", selectedCompanyId),
          supabase.from("enrollments").select("id", { count: "exact" }).in("profile_id", memberProfileIds),
          supabase.from("enrollments").select("id", { count: "exact" }).in("profile_id", memberProfileIds).eq("status", "completed"),
          supabase.from("user_total_foreground_extended").select("total_ms").in("user_id", memberProfileIds),
        ]);

        newCount = nc.count ?? 0;
        completedTodayCount = ct.count ?? 0;
        assignCount = new Set((acRes.data || []).map((r: any) => r.lesson_id)).size;

        const totalEnroll = totalEnrollRes.count ?? 0;
        const completedEnroll = completedEnrollRes.count ?? 0;
        completionRate = totalEnroll > 0 ? Math.round((completedEnroll / totalEnroll) * 100) : 0;

        const totalMs = (fgRes.data || []).reduce((sum, r) => sum + Number((r as any).total_ms ?? 0), 0);
        avgHours = memberProfileIds.length > 0 ? Math.round((totalMs / memberProfileIds.length / 3600000) * 10) / 10 : 0;
      } else {
        const [tc, nc, ct, acRes] = await Promise.all([
          supabase.from("profiles").select("id", { count: "exact" }),
          supabase.from("profiles").select("id", { count: "exact" }).gte("created_at", since7dIso),
          supabase.from("enrollments").select("id", { count: "exact" }).eq("status", "completed").gte("updated_at", startToday).lte("updated_at", endToday),
          supabase.from("lesson_assignments").select("lesson_id"),
        ]);
        membersCount = tc.count ?? 0;
        newCount = nc.count ?? 0;
        completedTodayCount = ct.count ?? 0;
        assignCount = new Set((acRes.data || []).map((r: any) => r.lesson_id)).size;
      }

      setKpis([
        { title: isFiltered ? "Miembros" : "Usuarios", value: String(membersCount), icon: isFiltered ? Building2 : Users, color: "text-primary" },
        { title: "Nuevos (7d)", value: String(newCount), icon: UserPlus, color: "text-accent" },
        { title: "Completadas Hoy", value: String(completedTodayCount), icon: BookOpen, color: "text-success" },
        { title: "Cursos Asignados", value: String(assignCount), icon: BarChart3, color: "text-warning" },
        { title: "Tasa Completado", value: isFiltered ? `${completionRate}%` : "—", icon: TrendingUp, color: "text-success" },
        { title: "Tiempo Promedio", value: isFiltered ? `${avgHours}h` : "—", icon: Clock, color: "text-accent" },
      ]);
    } catch (err) {
      console.error("failed to load dashboard kpis", err);
    }
  }, [isFiltered, selectedCompanyId, selectedAreaId, getCompanyProfileIds]);

  const loadLevelStats = useCallback(async () => {
    try {
      let query = supabase.from("profiles").select("nivel_actual");
      if (isFiltered) {
        const pids = await getCompanyProfileIds(selectedCompanyId, selectedAreaId);
        if (pids.length === 0) { setLevelStats({}); return; }
        query = query.in("id", pids);
      }
      const { data, error } = await query;
      if (error) throw error;

      const rows = data ?? [];
      const counts: Record<string, number> = {};
      const allowedLevels = new Set(["A1", "A2", "B1", "B2", "C1", "C2"]);
      rows.forEach((r: any) => {
        const raw = (r?.nivel_actual ?? "").toString().trim();
        const lvl = raw && allowedLevels.has(raw) ? raw : "Sin nivel";
        counts[lvl] = (counts[lvl] ?? 0) + 1;
      });

      const total = Object.values(counts).reduce((s, v) => s + v, 0) || 0;
      const stats: Record<string, { count: number; percent: number }> = {};
      Object.entries(counts).forEach(([lvl, count]) => {
        stats[lvl] = { count, percent: total > 0 ? Math.round((count / total) * 100) : 0 };
      });
      setLevelStats(stats);
    } catch (err) {
      console.error("failed to load level stats", err);
    }
  }, [isFiltered, selectedCompanyId, selectedAreaId, getCompanyProfileIds]);

  const loadNotifications = useCallback(async () => {
    try {
      const recentEnrollments = await supabase
        .from("enrollments")
        .select("profile_id, lesson_id, updated_at, status")
        .eq("status", "completed")
        .order("updated_at", { ascending: false })
        .limit(5);

      if (recentEnrollments.error || !recentEnrollments.data || recentEnrollments.data.length === 0) {
        setNotifications([]);
        return;
      }

      const profileIds = [...new Set(recentEnrollments.data.map((e: any) => e.profile_id))];
      const lessonIds = [...new Set(recentEnrollments.data.map((e: any) => e.lesson_id))];

      const [profilesRes, lessonsRes] = await Promise.all([
        supabase.from("profiles").select("id, name, last_name").in("id", profileIds),
        supabase.from("lessons").select("id, title").in("id", lessonIds),
      ]);

      const profilesMap: Record<string, string> = {};
      (profilesRes.data || []).forEach((p: any) => {
        profilesMap[p.id] = `${p.name ?? ""} ${p.last_name ?? ""}`.trim();
      });
      const lessonsMap: Record<string, string> = {};
      (lessonsRes.data || []).forEach((l: any) => {
        lessonsMap[l.id] = l.title;
      });

      const now = Date.now();
      const formatRelativeTime = (diffMs: number): string => {
        const secs = Math.floor(diffMs / 1000);
        const mins = Math.floor(secs / 60);
        const hours = Math.floor(mins / 60);
        const days = Math.floor(hours / 24);
        const weeks = Math.floor(days / 7);
        const months = Math.floor(days / 30);
        if (months >= 1) return `Hace ${months} mes(es)`;
        if (weeks >= 1) return `Hace ${weeks} semana(s)`;
        if (days >= 1) return `Hace ${days} día(s)`;
        if (hours >= 1) return `Hace ${hours} hora(s)`;
        if (mins >= 1) return `Hace ${mins} minuto(s)`;
        return "Hace unos segundos";
      };
      const mapped: Notification[] = recentEnrollments.data.map((e: any) => {
        const diffMs = now - new Date(e.updated_at).getTime();
        const tiempo = formatRelativeTime(diffMs);

        return {
          id: e.profile_id + e.lesson_id,
          mensaje: `${profilesMap[e.profile_id] ?? "Usuario"} completó "${lessonsMap[e.lesson_id] ?? "una lección"}"`,
          tiempo,
          tipo: "lesson" as const,
        };
      });
      setNotifications(mapped);
    } catch (err) {
      console.error("failed to load notifications", err);
    }
  }, []);

  useEffect(() => {
    const fetchCompanies = async () => {
      const { data } = await supabase
        .from("companies")
        .select("id, name")
        .eq("active", true)
        .order("name");
      setCompanies(data || []);
    };
    fetchCompanies();
  }, []);

  useEffect(() => {
    if (selectedCompanyId === "all") {
      setAreas([]);
      setSelectedAreaId("all");
      return;
    }
    const fetchAreas = async () => {
      const { data } = await supabase
        .from("areas")
        .select("id, name")
        .eq("company_id", selectedCompanyId)
        .eq("active", true)
        .order("name");
      setAreas(data || []);
      setSelectedAreaId("all");
    };
    fetchAreas();
  }, [selectedCompanyId]);

  useEffect(() => {
    loadKpis();
    loadLevelStats();
    loadNotifications();
  }, [loadKpis, loadLevelStats, loadNotifications]);

  const fetchStudents = useCallback(async (opts?: { page?: number }) => {
    setStudentsLoading(true);
    const page = opts?.page ?? currentPage;
    const from = (page - 1) * itemsPerPage;
    const to = from + itemsPerPage - 1;
    try {
      let query = supabase.from("profiles").select("*", { count: "exact" }).order("created_at", { ascending: false });

      const term = nameFilter.trim();
      if (term) {
        const like = `%${term}%`;
        query = query.or(`name.ilike.${like},last_name.ilike.${like},email.ilike.${like}`);
      }

      if (levelFilter && levelFilter !== "all") query = query.eq("nivel_actual", levelFilter);

      if (isFiltered) {
        const pids = await getCompanyProfileIds(selectedCompanyId, selectedAreaId);
        if (pids.length === 0) {
          setStudents([]);
          setStudentsTotal(0);
          setStudentsLoading(false);
          return;
        }
        query = query.in("id", pids);
      }

      query = query.range(from, to);

      const { data, error, count } = await query;
      if (error) {
        console.error("failed to fetch students", error);
        setStudents([]);
        setStudentsTotal(0);
      } else if (data) {
        const profiles = data as Record<string, unknown>[];
        const mapped: Student[] = profiles.map((p) => ({
          id: String(p["id"] ?? ""),
          nombre: `${String(p["name"] ?? "")} ${String(p["last_name"] ?? "")}`.trim(),
          nivelActual: p["nivel_actual"] && String(p["nivel_actual"]).toUpperCase() !== 'NULL' ? String(p["nivel_actual"]) : null,
          empresa: p["company"] ? String(p["company"]) : null,
          ultimaLeccion: null,
          puntosAcumulados: Number(p["puntos"] ?? 0),
          tiempoDedicado: "00:00:00",
          correo: String(p["email"] ?? ""),
          testsRealizados: [],
          logros: [],
        }));

        const msToHoursMins = (msInput: unknown) => {
          const ms = Number(msInput ?? 0);
          if (!isFinite(ms) || ms <= 0) return "0 Horas 0 Mins";
          const totalMinutes = Math.floor(ms / 60000);
          const hours = Math.floor(totalMinutes / 60);
          const minutes = totalMinutes % 60;
          return `${hours} Horas ${minutes} Mins`;
        };

        const msToHHMMSS = (msInput: unknown) => {
          const ms = Number(msInput ?? 0);
          if (!isFinite(ms) || ms <= 0) return "00:00:00";
          const totalSeconds = Math.floor(ms / 1000);
          const hours = Math.floor(totalSeconds / 3600);
          const minutes = Math.floor((totalSeconds % 3600) / 60);
          const seconds = totalSeconds % 60;
          return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
        };

        const profileIds = mapped.map((s) => s.id).filter(Boolean);
        if (profileIds.length > 0) {
          let totalsMap: Record<string, number> = {};
          try {
            const { data: totalsData } = await supabase
              .from("user_total_foreground_extended")
              .select("user_id,total_ms")
              .in("user_id", profileIds);
            if (totalsData && Array.isArray(totalsData)) {
              totalsMap = (totalsData as Record<string, unknown>[]).reduce<Record<string, number>>((acc, t) => {
                const uid = String(t["user_id"] ?? "");
                const total = Number(t["total_ms"] ?? 0);
                acc[uid] = Number.isFinite(total) ? total : 0;
                return acc;
              }, {});
            }
          } catch (err) {
            console.error("error querying user_total_foreground_extended", err);
          }

          const { data: enrollments } = await supabase
            .from("enrollments")
            .select("profile_id,lesson_id,updated_at,status")
            .in("profile_id", profileIds)
            .order("updated_at", { ascending: false });

          const latestByProfile: Record<string, string> = {};
          if (enrollments && enrollments.length > 0) {
            for (const row of enrollments as Record<string, unknown>[]) {
              const pid = String(row["profile_id"] ?? "");
              const lid = String(row["lesson_id"] ?? "");
              if (!latestByProfile[pid]) latestByProfile[pid] = lid;
            }
          }

          const lessonIds = Array.from(new Set(Object.values(latestByProfile).filter(Boolean)));
          let lessonTitles: Record<string, string> = {};
          if (lessonIds.length > 0) {
            const { data: lessonsData } = await supabase.from("lessons").select("id,title").in("id", lessonIds);
            if (lessonsData) {
              lessonTitles = (lessonsData as Record<string, unknown>[]).reduce<Record<string, string>>((acc, l) => {
                acc[String(l["id"] ?? "")] = String(l["title"] ?? l["id"]);
                return acc;
              }, {});
            }
          }

          for (const p of profiles) {
            const id = String(p["id"] ?? "");
            const idx = mapped.findIndex((s) => s.id === id);
            if (idx === -1) continue;
            const lessonId = latestByProfile[id];
            mapped[idx].ultimaLeccion = lessonId ? lessonTitles[lessonId] ?? lessonId : null;
            const totalMs = typeof totalsMap[id] === "number" && Number.isFinite(totalsMap[id]) ? totalsMap[id] : 0;
            mapped[idx].tiempoDedicado = msToHHMMSS(totalMs);
            mapped[idx].tiempoDedicadoHuman = msToHoursMins(totalMs);
          }
        }

        setStudents(mapped);
        setStudentsTotal(typeof count === "number" ? count : mapped.length);
      } else {
        setStudents([]);
        setStudentsTotal(0);
      }
    } finally {
      setStudentsLoading(false);
    }
  }, [nameFilter, levelFilter, isFiltered, selectedCompanyId, selectedAreaId, getCompanyProfileIds, currentPage]);

  useEffect(() => {
    setCurrentPage(1);
    fetchStudents({ page: 1 });
  }, [nameFilter, levelFilter, selectedCompanyId, selectedAreaId, fetchStudents]);

  useEffect(() => {
    fetchStudents({ page: currentPage });
  }, [currentPage, fetchStudents]);

  const totalPages = Math.max(1, Math.ceil(studentsTotal / itemsPerPage));

  const handleExportCSV = () => {
    const headers = ["Nombre", "Nivel Actual", "Empresa", "Última Lección", "Puntos Acumulados", "Tiempo Dedicado"];
    const csvContent = [
      headers.join(","),
      ...students.map((s) =>
        `"${s.nombre}","${s.nivelActual}","${s.empresa}","${s.ultimaLeccion}",${s.puntosAcumulados},"${s.tiempoDedicado}"`
      ),
    ].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "desempeno_alumnos.csv";
    link.click();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Panel de Control</h1>
          <p className="text-muted-foreground">Bienvenido al panel de administración de TrueEnglish Academy</p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={selectedCompanyId} onValueChange={setSelectedCompanyId}>
            <SelectTrigger className="w-[240px]">
              <Building2 className="w-4 h-4 mr-2 text-muted-foreground" />
              <SelectValue placeholder="Todas las empresas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las empresas</SelectItem>
              {companies.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedCompanyId !== "all" && areas.length > 0 && (
            <Select value={selectedAreaId} onValueChange={setSelectedAreaId}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Todas las áreas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las áreas</SelectItem>
                {areas.map((a) => (
                  <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="icon" className="relative">
                <Bell className="h-5 w-5" />
                {notifications.length > 0 && (
                  <Badge className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs">
                    {notifications.length}
                  </Badge>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-96" align="end">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-foreground">Últimas Actividades</h3>
                  <Badge variant="secondary">{notifications.length}</Badge>
                </div>
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {notifications.length === 0 && (
                    <p className="text-sm text-muted-foreground">No hay actividad reciente</p>
                  )}
                  {notifications.map((n) => (
                    <div key={n.id} className="flex gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                      <div className="flex-shrink-0 mt-1">
                        <BookOpen className="h-4 w-4 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-foreground">{n.mensaje}</p>
                        <p className="text-xs text-muted-foreground mt-1">{n.tiempo}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {kpis.map((kpi, index) => (
          <Card key={`kpi-${index}`} className="shadow-card">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground">{kpi.title}</CardTitle>
              <kpi.icon className={`h-4 w-4 ${kpi.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-xl font-bold text-foreground">{kpi.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="text-sm">Distribución por Nivel{isFiltered ? " — Empresa Seleccionada" : ""}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {Object.keys(levelStats).length === 0 ? (
              <div className="text-sm text-muted-foreground">No hay datos de niveles disponibles.</div>
            ) : (
              Object.entries(levelStats)
                .sort((a, b) => b[1].percent - a[1].percent)
                .map(([lvl, stats], idx) => {
                  const colorClass =
                    idx === 0 ? "bg-primary" : idx === 1 ? "bg-accent" : idx === 2 ? "bg-success" : idx === 3 ? "bg-warning" : "bg-muted";
                  return (
                    <div key={lvl}>
                      <div className="flex justify-between text-sm">
                        <span className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">{lvl}</Badge>
                          <span className="text-muted-foreground">{stats.count} alumnos</span>
                        </span>
                        <span className="font-medium">{stats.percent}%</span>
                      </div>
                      <div className="w-full bg-muted rounded-full h-2 mt-1">
                        <div className={`${colorClass} h-2 rounded-full transition-all`} style={{ width: `${stats.percent}%` }} />
                      </div>
                    </div>
                  );
                })
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-card">
        <CardHeader>
          <CardTitle>Desempeño de Alumnos</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4 flex-wrap">
            <div className="flex-1 min-w-[200px]">
              <Input
                placeholder="Buscar por nombre..."
                value={nameFilter}
                onChange={(e) => setNameFilter(e.target.value)}
              />
            </div>
            <div className="w-48">
              <Select value={levelFilter} onValueChange={setLevelFilter}>
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
            <Button onClick={handleExportCSV} variant="outline">
              <Download className="w-4 h-4 mr-2" />
              Exportar CSV
            </Button>
          </div>

          {studentsLoading && students.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">Cargando alumnos...</div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Nivel</TableHead>
                    <TableHead>Empresa</TableHead>
                    <TableHead>Última Lección</TableHead>
                    <TableHead>Puntos</TableHead>
                    <TableHead>Tiempo</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {students.map((student) => (
                    <TableRow key={student.id}>
                      <TableCell className="font-medium">{student.nombre || "—"}</TableCell>
                      <TableCell>{student.nivelActual ?? "Sin nivel"}</TableCell>
                      <TableCell>{student.empresa ?? "—"}</TableCell>
                      <TableCell className="max-w-[180px] truncate">{student.ultimaLeccion ?? "—"}</TableCell>
                      <TableCell>{student.puntosAcumulados}</TableCell>
                      <TableCell title={student.tiempoDedicadoHuman ?? ""}>{student.tiempoDedicado}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="outline" size="sm" onClick={() => setSelectedStudent(student)}>
                          <Eye className="w-4 h-4 mr-2" />
                          Ver más
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {students.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground py-6">
                        No se encontraron alumnos
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>

              {totalPages > 1 && (
                <Pagination>
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious
                        onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                        className={currentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                      />
                    </PaginationItem>
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                      <PaginationItem key={page}>
                        <PaginationLink
                          onClick={() => setCurrentPage(page)}
                          isActive={currentPage === page}
                          className="cursor-pointer"
                        >
                          {page}
                        </PaginationLink>
                      </PaginationItem>
                    ))}
                    <PaginationItem>
                      <PaginationNext
                        onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                        className={currentPage === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {selectedStudent && (
        <StudentDetailModal
          student={selectedStudent}
          onClose={() => setSelectedStudent(null)}
        />
      )}
    </div>
  );
}
