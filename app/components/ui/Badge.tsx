import type { ReactNode } from "react";
import { cx } from "./cx";

export type Tone = "neutral" | "accent" | "green" | "amber" | "red" | "blue";

/** Etiqueta pequena e reta (convênio, CID, tipo de consulta…). */
export function Tag({ tone = "neutral", children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return <span className={cx("ui-tag", `ui-tone-${tone}`, className)}>{children}</span>;
}

/** Estado em texto simples com bolinha (Aprovado, Pendente…). */
export function Status({ tone = "neutral", children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return <span className={cx("ui-status", `ui-tone-${tone}`, className)}>{children}</span>;
}
