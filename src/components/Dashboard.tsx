import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";
import { Users, UserPlus, Download, Eye, Bell, BookOpen, Clock } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import StudentDetailModal from "./StudentDetailModal";
// KPI state (we show two KPIs: total users and new registrations in last 7 days)
const initialKpis = [
  { title: "Usuarios Totales", value: "—", icon: Users, color: "text-primary" },
  { title: "Nuevos Registros (7 días)", value: "—", icon: UserPlus, color: "text-accent" },
];

// Keep the previous hardcoded KPI label for session time; lessons completed will be fetched

interface Student {
  id: string;
  nombre: string;
  nivelActual: string | null;
  empresa: string | null;
  ultimaLeccion: string | null;
  puntosAcumulados: number;
  tiempoDedicado: string; // HH:MM:SS
  tiempoDedicadoHuman?: string; // e.g. "2 Horas 15 Mins"
  correo: string;
  testsRealizados: { nombre: string; calificacion: number }[];
  logros: string[];
}

const initialStudents: Student[] = [];

const mockNotifications = [
  {
    id: "1",
    mensaje: "Jaime Solís terminó la lección A1 - Past Perfect",
    tiempo: "Hace 5 minutos",
    tipo: "lesson"
  },
  {
    id: "2",
    mensaje: "Andrea Gonzales aprobó el examen de Nivel A2",
    tiempo: "Hace 12 minutos",
    tipo: "exam"
  },
  {
    id: "3",
    mensaje: "Pedro Ramírez completó 10 lecciones consecutivas",
    tiempo: "Hace 1 hora",
    tipo: "achievement"
  },
  {
    id: "4",
    mensaje: "Laura Fernández alcanzó 500 puntos acumulados",
    tiempo: "Hace 2 horas",
    tipo: "achievement"
  },
  {
    id: "5",
    mensaje: "Roberto Silva terminó la lección B1 - Future Continuous",
    tiempo: "Hace 3 horas",
    tipo: "lesson"
  }
];

export default function Dashboard() {
  const [nameFilter, setNameFilter] = useState("");
  const [levelFilter, setLevelFilter] = useState("all");
  const [companyFilter, setCompanyFilter] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const itemsPerPage = 5;
  const [students, setStudents] = useState<Student[]>(initialStudents);
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [studentsTotal, setStudentsTotal] = useState(0);

  const [kpis, setKpis] = useState(initialKpis);
  const [levelStats, setLevelStats] = useState<Record<string, { count: number; percent: number }>>({});
  const [completedToday, setCompletedToday] = useState<number | null>(null);

  // Load counts from profiles: total users and new registrations in last 7 days
  const loadKpis = async () => {
    try {
      // total count
      const { count: totalCount } = await supabase.from('profiles').select('id', { count: 'exact' });

      // new in last 7 days
      const since = new Date();
      since.setDate(since.getDate() - 7);
      const sinceIso = since.toISOString();
      const { count: newCount } = await supabase.from('profiles').select('id', { count: 'exact' }).gte('created_at', sinceIso);

      setKpis([
        { title: 'Usuarios Totales', value: String(totalCount ?? 0), icon: Users, color: 'text-primary' },
        { title: 'Nuevos Registros (7 días)', value: String(newCount ?? 0), icon: UserPlus, color: 'text-accent' }
      ]);
    } catch (err) {
      console.error('failed to load dashboard kpis', err);
    }
  };

  const loadCompletedToday = async () => {
    try {
      // calculate start and end of today in UTC ISO format
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
      const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
      const startIso = start.toISOString();
      const endIso = end.toISOString();

      // count enrollments with status 'completed' where updated_at is today
      const { count, error } = await supabase
        .from('enrollments')
        .select('id', { count: 'exact' })
        .eq('status', 'completed')
        .gte('updated_at', startIso)
        .lte('updated_at', endIso);

      if (error) {
        console.error('failed to load completed today', error);
        setCompletedToday(0);
        return;
      }
      setCompletedToday(typeof count === 'number' ? count : 0);
    } catch (err) {
      console.error('failed to load completed today', err);
      setCompletedToday(0);
    }
  };

  const loadLevelStats = async () => {
    try {
      const { data, error } = await supabase.from('profiles').select('nivel_actual');
      if (error) throw error;

      const rows = data ?? [];
      const counts: Record<string, number> = {};
      const allowedLevels = new Set(["A1", "A2", "B1", "B2", "C1", "C2"]);
      rows.forEach((r: any) => {
        const raw = (r?.nivel_actual ?? "").toString().trim();
        const lvl = raw && allowedLevels.has(raw) ? raw : 'Sin nivel';
        counts[lvl] = (counts[lvl] ?? 0) + 1;
      });

      const total = Object.values(counts).reduce((s, v) => s + v, 0) || 0;
      const stats: Record<string, { count: number; percent: number }> = {};
      Object.entries(counts).forEach(([lvl, count]) => {
        const percent = total > 0 ? Math.round((count / total) * 100) : 0;
        stats[lvl] = { count, percent };
      });

      setLevelStats(stats);
    } catch (err) {
      console.error('failed to load level stats', err);
    }
  };

  useEffect(() => { loadKpis(); loadLevelStats(); loadCompletedToday(); }, []);

  // Fetch students (profiles) with server-side pagination and filters
  const fetchStudents = async (opts?: { page?: number }) => {
    setStudentsLoading(true);
    const page = opts?.page ?? currentPage;
    const from = (page - 1) * itemsPerPage;
    const to = from + itemsPerPage - 1;
    try {
      let query = supabase.from('profiles').select('*', { count: 'exact' }).order('created_at', { ascending: false });

      const term = nameFilter.trim();
      if (term) {
        const like = `%${term}%`;
        query = query.or(`name.ilike.${like},last_name.ilike.${like},email.ilike.${like}`);
      }

      if (levelFilter && levelFilter !== 'all') query = query.eq('nivel_actual', levelFilter);
      if (companyFilter && companyFilter.trim()) query = query.ilike('company', `%${companyFilter.trim()}%`);

      query = query.range(from, to);

      const { data, error, count } = await query;
      if (error) {
        console.error('failed to fetch students', error);
        setStudents([]);
        setStudentsTotal(0);
      } else if (data) {
        // map basic profile fields
        const profiles = data as Record<string, unknown>[];
        const mapped: Student[] = profiles.map((p) => ({
          id: String(p['id'] ?? ''),
          nombre: `${String(p['name'] ?? '')} ${String(p['last_name'] ?? '')}`.trim(),
          nivelActual: p['nivel_actual'] ? String(p['nivel_actual']) : null,
          empresa: p['company'] ? String(p['company']) : null,
          ultimaLeccion: null,
          puntosAcumulados: Number(p['puntos'] ?? 0),
          tiempoDedicado: '00:00:00',
          correo: String(p['email'] ?? ''),
          testsRealizados: [],
          logros: []
        }));

        // helper to format ms to "X Horas Y Mins" (no seconds)
        const msToHoursMins = (msInput: unknown) => {
          const ms = Number(msInput ?? 0);
          if (!isFinite(ms) || ms <= 0) return '0 Horas 0 Mins';
          const totalMinutes = Math.floor(ms / 60000);
          const hours = Math.floor(totalMinutes / 60);
          const minutes = totalMinutes % 60;
          return `${hours} Horas ${minutes} Mins`;
        };

        // helper to format ms to HH:MM:SS
        const msToHHMMSS = (msInput: unknown) => {
          const ms = Number(msInput ?? 0);
          if (!isFinite(ms) || ms <= 0) return '00:00:00';
          const totalSeconds = Math.floor(ms / 1000);
          const hours = Math.floor(totalSeconds / 3600);
          const minutes = Math.floor((totalSeconds % 3600) / 60);
          const seconds = totalSeconds % 60;
          const hh = String(hours).padStart(2, '0');
          const mm = String(minutes).padStart(2, '0');
          const ss = String(seconds).padStart(2, '0');
          return `${hh}:${mm}:${ss}`;
        };

        // fetch latest enrollment per profile in page
        const profileIds = mapped.map(s => s.id).filter(Boolean);
        if (profileIds.length > 0) {
          // fetch total_ms from the view `user_total_foreground_extended` for all profiles in page
          let totalsMap: Record<string, number> = {};
          try {
            const { data: totalsData, error: totalsErr } = await supabase
              .from('user_total_foreground_extended')
              .select('user_id,total_ms')
              .in('user_id', profileIds);

            if (totalsErr) {
              console.error('failed to fetch totals from view user_total_foreground_extended', totalsErr);
            } else if (totalsData && Array.isArray(totalsData)) {
              totalsMap = (totalsData as Record<string, unknown>[]).reduce<Record<string, number>>((acc, t) => {
                const uid = String(t['user_id'] ?? '');

                const total = Number(t['total_ms'] ?? 0);
                acc[uid] = Number.isFinite(total) ? total : 0;
                return acc;
              }, {} as Record<string, number>);
            }
          } catch (err) {
            console.error('error querying user_total_foreground_extended', err);
          }

          // fetch enrollments after totals (we only use enrollments to compute ultimaLeccion)
          const { data: enrollments, error: enrollErr } = await supabase
            .from('enrollments')
            .select('profile_id,lesson_id,updated_at,status')
            .in('profile_id', profileIds)
            .order('updated_at', { ascending: false });

          if (enrollErr) {
            console.error('failed to fetch enrollments', enrollErr);
          }

          // pick latest lesson_id per profile (first occurrence since ordered desc)
          const latestByProfile: Record<string, string> = {};
          if (enrollments && enrollments.length > 0) {
            for (const row of enrollments as Record<string, unknown>[]) {
              const pid = String(row['profile_id'] ?? '');
              const lid = String(row['lesson_id'] ?? '');
              if (!latestByProfile[pid]) latestByProfile[pid] = lid;
            }
          }

          // fetch lesson titles for these lesson ids (if any)
          const lessonIds = Array.from(new Set(Object.values(latestByProfile).filter(Boolean)));
          let lessonTitles: Record<string, string> = {};
          if (lessonIds.length > 0) {
            const { data: lessonsData, error: lessonsErr } = await supabase.from('lessons').select('id,title').in('id', lessonIds);
            if (lessonsErr) {
              console.error('failed to fetch lessons', lessonsErr);
            } else if (lessonsData) {
              lessonTitles = (lessonsData as Record<string, unknown>[]).reduce<Record<string, string>>((acc, l) => {
                const id = String(l['id'] ?? '');
                const title = String(l['title'] ?? id);
                acc[id] = title;
                return acc;
              }, {} as Record<string, string>);
            }
          }

          // attach latest lesson title and tiempoDedicado using totalsMap only (no fallback to profiles.total_foreground_ms)
          for (const p of profiles) {
            const id = String(p['id'] ?? '');
            const idx = mapped.findIndex(s => s.id === id);
            if (idx === -1) continue;
            const lessonId = latestByProfile[id];
            mapped[idx].ultimaLeccion = lessonId ? (lessonTitles[lessonId] ?? lessonId) : null;
            const totalMs = typeof totalsMap[id] === 'number' && Number.isFinite(totalsMap[id]) ? totalsMap[id] : 0;
            mapped[idx].tiempoDedicado = msToHHMMSS(totalMs);
            mapped[idx].tiempoDedicadoHuman = msToHoursMins(totalMs);
          }
        }

        setStudents(mapped);
        setStudentsTotal(typeof count === 'number' ? count : mapped.length);
      } else {
        setStudents([]);
        setStudentsTotal(0);
      }
    } finally {
      setStudentsLoading(false);
    }
  };

  // Re-fetch students when filters or page change
  useEffect(() => {
    setCurrentPage(1);
    fetchStudents({ page: 1 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nameFilter, levelFilter, companyFilter]);

  useEffect(() => {
    fetchStudents({ page: currentPage });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage]);

  const totalPages = Math.max(1, Math.ceil(studentsTotal / itemsPerPage));

  const handleExportCSV = () => {
    const headers = ["Nombre", "Nivel Actual", "Empresa", "Última Lección", "Puntos Acumulados", "Tiempo Dedicado"];
    const csvContent = [
      headers.join(","),
      ...students.map(s =>
        `"${s.nombre}","${s.nivelActual}","${s.empresa}","${s.ultimaLeccion}",${s.puntosAcumulados},"${s.tiempoDedicado}"`
      )
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "desempeno_alumnos.csv";
    link.click();
  };

  return <div className="space-y-6">
    <div className="flex justify-between items-start">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Panel de Control</h1>
        <p className="text-muted-foreground">Bienvenido al panel de administración de TrueEnglish Academy</p>
      </div>

      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="icon" className="relative">
            <Bell className="h-5 w-5" />
            {mockNotifications.length > 0 && (
              <Badge className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs">
                {mockNotifications.length}
              </Badge>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-96" align="end">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-foreground">Últimas Actividades</h3>
              <Badge variant="secondary">{mockNotifications.length}</Badge>
            </div>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {mockNotifications.map((notification) => (
                <div key={notification.id} className="flex gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                  <div className="flex-shrink-0 mt-1">
                    {notification.tipo === "lesson" && <BookOpen className="h-4 w-4 text-primary" />}
                    {notification.tipo === "exam" && <Users className="h-4 w-4 text-accent" />}
                    {notification.tipo === "achievement" && <Clock className="h-4 w-4 text-success" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground">{notification.mensaje}</p>
                    <p className="text-xs text-muted-foreground mt-1">{notification.tiempo}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>

    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {kpis.map((kpi, index) => (
        <Card key={`dyn-${index}`} className="shadow-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{kpi.title}</CardTitle>
            <kpi.icon className={`h-5 w-5 ${kpi.color}`} />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{kpi.value}</div>
          </CardContent>
        </Card>
      ))}

      <Card className="shadow-card">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Lecciones Completadas Hoy</CardTitle>
          <BookOpen className={`h-5 w-5 text-success`} />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-foreground">{completedToday === null ? '—' : String(completedToday)}</div>
        </CardContent>
      </Card>
    </div>

    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">


      <Card className="shadow-card">
        <CardHeader>
          <CardTitle>Estadísticas de Uso</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {Object.keys(levelStats).length === 0 ? (
              <div className="text-sm text-muted-foreground">No hay datos de niveles disponibles.</div>
            ) : (
              Object.entries(levelStats)
                .sort((a, b) => b[1].percent - a[1].percent)
                .map(([lvl, stats], idx) => {
                  const colorClass = idx === 0 ? 'bg-primary' : idx === 1 ? 'bg-accent' : idx === 2 ? 'bg-success' : idx === 3 ? 'bg-warning' : 'bg-muted';
                  return (
                    <div key={lvl}>
                      <div className="flex justify-between text-sm">
                        <span>{lvl}</span>
                        <span>{stats.percent}%</span>
                      </div>
                      <div className="w-full bg-muted rounded-full h-2">
                        <div className={`${colorClass} h-2 rounded-full`} style={{ width: `${stats.percent}%` }} />
                      </div>
                    </div>
                  );
                })
            )}
          </div>
        </CardContent>
      </Card>
    </div>

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
          <div className="flex-1 min-w-[200px]">
            <Input
              placeholder="Buscar por empresa..."
              value={companyFilter}
              onChange={(e) => setCompanyFilter(e.target.value)}
            />
          </div>
          <Button onClick={handleExportCSV} variant="outline">
            <Download className="w-4 h-4 mr-2" />
            Exportar CSV
          </Button>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Nivel Actual</TableHead>
              <TableHead>Empresa</TableHead>
              <TableHead>Última Lección</TableHead>
              <TableHead>Puntos</TableHead>
              <TableHead>Tiempo Dedicado</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {students.map((student) => (
              <TableRow key={student.id}>
                <TableCell className="font-medium">{student.nombre || '—'}</TableCell>
                <TableCell>{student.nivelActual ?? 'Sin nivel'}</TableCell>
                <TableCell>{student.empresa ?? '—'}</TableCell>
                <TableCell>{student.ultimaLeccion ?? '—'}</TableCell>
                <TableCell>{student.puntosAcumulados}</TableCell>
                <TableCell title={student.tiempoDedicadoHuman ?? ''}>{student.tiempoDedicado}</TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedStudent(student)}
                  >
                    <Eye className="w-4 h-4 mr-2" />
                    Ver más
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {totalPages > 1 && (
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
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
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  className={currentPage === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        )}
      </CardContent>
    </Card>

    {selectedStudent && (
      <StudentDetailModal
        student={selectedStudent}
        onClose={() => setSelectedStudent(null)}
      />
    )}
  </div>;
}