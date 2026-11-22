import type { ReactNode } from "react";
import { cx } from "./cx";

/** Iniciais: 1ª letra do primeiro nome + 1ª do último sobrenome. */
export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  const first = parts[0][0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return `${first}${last}`.toUpperCase();
}

/** Cor pastel estável a partir do nome (o mesmo paciente tem sempre a mesma cor). */
function colorOf(name: string): { bg: string; fg: string } {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 360;
  return { bg: `hsl(${h} 60% 92%)`, fg: `hsl(${h} 45% 36%)` };
}

/** Avatar circular com iniciais. Usado em TODA parte que mostra uma pessoa (lista, cabeçalhos, modais). */
export function Avatar({ name, size = "md", className }: { name: string; size?: "sm" | "md" | "lg" | "xl"; className?: string }) {
  const c = colorOf(name);
  return (
    <span className={cx("ui-avatar", `ui-avatar-${size}`, className)} style={{ background: c.bg, color: c.fg }} aria-hidden>
      {initialsOf(name)}
    </span>
  );
}

/**
 * Cabeçalho de paciente (avatar + nome + linhas de apoio + selo opcional).
 * Mesmo componente na ficha do paciente e na tela da consulta: o "perfil" é igual em todo o app.
 */
export function PatientHeader({
  name, lines = [], badge, layout = "inline", onClick, title, className,
}: {
  name: string;
  lines?: ReactNode[];
  badge?: ReactNode;
  /** "inline": avatar ao lado do texto. "stack": avatar em cima, centralizado (barra lateral). "compact": avatar pequeno + nome numa linha (identifica o paciente sem competir com o título). */
  layout?: "inline" | "stack" | "compact";
  /** Com onClick o cabeçalho vira um botão (ex.: abrir a ficha do paciente). */
  onClick?: () => void;
  title?: string;
  className?: string;
}) {
  const body = (
    <>
      <Avatar name={name} size={layout === "stack" ? "xl" : layout === "compact" ? "sm" : "lg"} />
      <div className="ui-pheader-text">
        <div className="ui-pheader-name">{name}</div>
        {lines.filter(Boolean).map((l, i) => (
          <div key={i} className="ui-pheader-line">{l}</div>
        ))}
        {badge && <div className="ui-pheader-badge">{badge}</div>}
      </div>
    </>
  );
  const cls = cx("ui-pheader", layout === "stack" && "ui-pheader-stack", layout === "compact" && "ui-pheader-compact", onClick && "ui-pheader-link", className);
  return onClick ? (
    <button type="button" className={cls} onClick={onClick} title={title}>{body}</button>
  ) : (
    <div className={cls}>{body}</div>
  );
}
