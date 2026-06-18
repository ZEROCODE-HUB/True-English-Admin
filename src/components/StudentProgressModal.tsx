import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Star,
  TrendingUp,
  BookOpen,
  Clock,
  CalendarClock,
  Flame,
  Award,
  CalendarDays,
} from "lucide-react";
import type { StudentProgress } from "@/types/db";
import { msToHumanHours, fmtDate } from "@/lib/format";

const levelColors: Record<string, string> = {
  A1: "bg-red-100 text-red-800",
  A2: "bg-orange-100 text-orange-800",
  B1: "bg-yellow-100 text-yellow-800",
  B2: "bg-blue-100 text-blue-800",
  C1: "bg-green-100 text-green-800",
  C2: "bg-purple-100 text-purple-800",
};

interface MetricProps {
  icon: React.ElementType;
  label: string;
  value: React.ReactNode;
  hint?: string;
}

function Metric({ icon: Icon, label, value, hint }: MetricProps) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="h-4 w-4" />
        <span className="text-xs font-medium uppercase tracking-wide">{label}</span>
      </div>
      <div className="mt-2 text-2xl font-bold text-foreground">{value}</div>
      {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}

interface Props {
  progress: StudentProgress;
  onClose: () => void;
}

export default function StudentProgressModal({ progress: s, onClose }: Props) {
  const fullName = `${s.name ?? ""} ${s.last_name ?? ""}`.trim() || "Alumno";
  const level = s.nivel_actual ?? "Sin nivel";

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Avance de {fullName}</DialogTitle>
        </DialogHeader>

        {/* Cabecera con datos del alumno */}
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          {s.email && <span>{s.email}</span>}
          <Badge className={levelColors[level] ?? "bg-gray-100 text-gray-600"}>{level}</Badge>
          {s.status && (
            <Badge variant={s.status === "activo" ? "default" : "secondary"}>
              {s.status === "activo" ? "Activo" : "Inactivo"}
            </Badge>
          )}
          {s.tipo && <Badge variant="outline">{s.tipo}</Badge>}
          {s.company && <span>· {s.company}</span>}
        </div>

        {/* % de avance del nivel */}
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-2 text-muted-foreground">
              <TrendingUp className="h-4 w-4" /> Avance del nivel {level}
            </span>
            <span className="font-semibold tabular-nums">{s.pct_avance}%</span>
          </div>
          <Progress value={s.pct_avance} className="mt-2 h-2" />
          <div className="mt-1 text-xs text-muted-foreground">
            {s.completed_in_level} de {s.lessons_in_level} lecciones de su nivel completadas
          </div>
        </div>

        {/* Métricas */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Metric icon={Star} label="Puntos" value={s.puntos} />
          <Metric
            icon={BookOpen}
            label="Lecciones"
            value={`${s.completed_total}/${s.lessons_total}`}
            hint="completadas en total"
          />
          <Metric icon={Award} label="Logros" value={s.logros_count} />
          <Metric
            icon={Clock}
            label="Horas totales"
            value={msToHumanHours(s.horas_totales_ms)}
            hint="histórico"
          />
          <Metric
            icon={CalendarClock}
            label="Horas del mes"
            value={msToHumanHours(s.horas_mes_ms)}
            hint="mes en curso"
          />
          <Metric
            icon={Flame}
            label="Racha"
            value={s.streak_count}
            hint={`Mejor racha: ${s.streak_best}`}
          />
          <Metric
            icon={CalendarDays}
            label="Última actividad"
            value={fmtDate(s.ultima_actividad) || "—"}
          />
          <Metric
            icon={CalendarDays}
            label="Registro"
            value={fmtDate(s.created_at) || "—"}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
