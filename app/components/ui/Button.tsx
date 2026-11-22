import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cx } from "./cx";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: "sm" | "md";
  icon?: ReactNode;
}

/** Botão padrão do app. Use SEMPRE este em vez de criar classes de botão por tela. */
export function Button({ variant = "secondary", size = "md", icon, className, children, type = "button", ...rest }: ButtonProps) {
  return (
    <button type={type} className={cx("ui-btn", `ui-btn-${variant}`, `ui-btn-${size}`, className)} {...rest}>
      {icon}
      {children}
    </button>
  );
}

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Obrigatório: vira aria-label e tooltip. */
  label: string;
  active?: boolean;
  /** Com contorno (para barras de ação soltas na página). */
  outline?: boolean;
}

/** Botão só com ícone (copiar, baixar, fechar…). */
export function IconButton({ label, active, outline, className, children, type = "button", ...rest }: IconButtonProps) {
  return (
    <button type={type} className={cx("ui-iconbtn", outline && "ui-iconbtn-outline", active && "ui-iconbtn-on", className)} aria-label={label} title={label} {...rest}>
      {children}
    </button>
  );
}

/**
 * Botão pequeno de ação em texto.
 *  - "accent": pílula laranja clara (ex.: "2 fontes");
 *  - "link":   texto laranja (ex.: "Ver todas →");
 *  - "neutral": texto cinza com sublinhado pontilhado.
 */
export function TextButton({
  tone = "neutral", className, children, type = "button", ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { tone?: "neutral" | "accent" | "link" }) {
  return (
    <button type={type} className={cx("ui-textbtn", tone === "accent" && "ui-textbtn-accent", tone === "link" && "ui-textbtn-link", className)} {...rest}>
      {children}
    </button>
  );
}
