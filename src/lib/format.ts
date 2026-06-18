import { format } from "date-fns";

// ms -> "Xh Ym"
export const msToHumanHours = (ms: unknown) => {
  const v = Number(ms) || 0;
  if (v <= 0) return "0h 0m";
  const totalMin = Math.floor(v / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return `${h}h ${m}m`;
};

// ms -> horas decimales (para Excel como número real)
export const msToDecimalHours = (ms: unknown) =>
  Math.round(((Number(ms) || 0) / 3600000) * 10) / 10;

// Formatea fecha (date-only "YYYY-MM-DD" o ISO) como dd/MM/yyyy de forma segura
export const fmtDate = (d?: string | null) => {
  if (!d) return "";
  const dt = new Date(d.length <= 10 ? `${d}T00:00:00` : d);
  return isNaN(dt.getTime()) ? "" : format(dt, "dd/MM/yyyy");
};
