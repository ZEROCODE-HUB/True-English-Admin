import { Badge } from "@/components/ui/badge";
import { Globe } from "lucide-react";
import { cn } from "@/lib/utils";

type ProgramBadgeProps = {
  /** program_id de la fila (NULL = Estándar). */
  programId: string | null | undefined;
  /** Catálogo de programas activos para resolver el nombre. */
  programs: Array<{ id: string; name: string; slug?: string }>;
  className?: string;
  /** Muestra el nombre siempre (no truncado). Útil en tarjetas. */
  showLabel?: boolean;
};

const PROGRAM_COLORS = [
  "bg-sky-100 text-sky-800 border-sky-200",
  "bg-violet-100 text-violet-800 border-violet-200",
  "bg-emerald-100 text-emerald-800 border-emerald-200",
  "bg-amber-100 text-amber-800 border-amber-200",
  "bg-rose-100 text-rose-800 border-rose-200",
  "bg-teal-100 text-teal-800 border-teal-200",
  "bg-indigo-100 text-indigo-800 border-indigo-200",
  "bg-fuchsia-100 text-fuchsia-800 border-fuchsia-200",
];

/** Color determinista por programa (misma línea = mismo color siempre). */
function programColor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  }
  return PROGRAM_COLORS[hash % PROGRAM_COLORS.length];
}

/** Badge de Línea / Programa con la regla NULL = Estándar.
 * Sin program_id muestra "Estándar" con acento sutil; con program_id resuelve
 * el nombre y asigna un color estable por línea.
 */
export function ProgramBadge({ programId, programs, className, showLabel }: ProgramBadgeProps) {
  const program = programs.find((p) => p.id === programId);

  if (!programId || !program) {
    return (
      <Badge
        variant="outline"
        className={cn("gap-1 border-slate-200 bg-slate-50 text-slate-600 font-medium whitespace-nowrap", className)}
      >
        <Globe className="w-3 h-3" />
        Estándar
      </Badge>
    );
  }

  return (
    <Badge
      variant="outline"
      className={cn("gap-1 font-medium whitespace-nowrap", programColor(programId), className)}
      title={showLabel ? undefined : program.name}
    >
      <Globe className="w-3 h-3 shrink-0" />
      <span className={cn("truncate", !showLabel && "max-w-[120px]")}>{program.name}</span>
    </Badge>
  );
}
