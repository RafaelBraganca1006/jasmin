/** Utilitários compartilhados da agenda (page.tsx e Agenda.tsx). */

export const CONSULT_TYPES = ["Consulta", "Avaliação", "Retorno", "Check-up", "Emergência"] as const;

/** Cores por tipo de consulta. `accent` é a cor sólida (barra lateral / pontos). */
export const aptColors = (
  type: string
): { bg: string; border: string; color: string; accent: string } => {
  const t = type.toLowerCase().trim();
  if (t === "retorno") return { bg: "rgba(59,130,246,0.1)", border: "rgba(59,130,246,0.25)", color: "#1d4ed8", accent: "#3b82f6" };
  if (t === "emergência") return { bg: "rgba(239,68,68,0.1)", border: "rgba(239,68,68,0.25)", color: "#b91c1c", accent: "#ef4444" };
  if (t === "check-up") return { bg: "rgba(34,197,94,0.1)", border: "rgba(34,197,94,0.25)", color: "#166534", accent: "#22c55e" };
  // Consulta e Avaliação → laranja do design system
  return { bg: "rgba(252,94,14,0.09)", border: "rgba(252,94,14,0.22)", color: "#b84c0f", accent: "#fc5e0e" };
};

export const pad2 = (n: number) => String(n).padStart(2, "0");

export const toDateKey = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

export const fromDateKey = (key: string) => {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
};

export const addDays = (d: Date, n: number) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};

/** Segunda-feira da semana de `date`, à meia-noite. */
export const getWeekStart = (date: Date) => {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day));
  d.setHours(0, 0, 0, 0);
  return d;
};

export const getWeekDays = (date: Date) =>
  Array.from({ length: 7 }, (_, i) => addDays(getWeekStart(date), i));

/** "09:30" a partir de minutos desde 00:00. */
export const minToHM = (min: number) => `${pad2(Math.floor(min / 60))}:${pad2(min % 60)}`;

export const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
