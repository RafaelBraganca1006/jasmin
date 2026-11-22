import type { ReactNode } from "react";
import { cx } from "./cx";

/** Rótulo de campo (caixa alta, cinza). `aside` é o que fica ao lado (ex.: "2 fontes"). */
export function FieldLabel({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="ui-field-head">
      <span className="ui-label">{children}</span>
      {aside}
    </div>
  );
}

/** Campo = rótulo + conteúdo (input, texto…). */
export function Field({
  label, aside, hint, className, children,
}: { label: ReactNode; aside?: ReactNode; hint?: ReactNode; className?: string; children: ReactNode }) {
  return (
    <div className={cx("ui-field", className)}>
      <FieldLabel aside={aside}>{label}</FieldLabel>
      {hint && <p className="ui-field-hint">{hint}</p>}
      {children}
    </div>
  );
}

/** Grade de campos: 2 ou 3 colunas, colapsa em tela estreita. */
export function FieldGrid({ cols = 2, className, children }: { cols?: 2 | 3; className?: string; children: ReactNode }) {
  return <div className={cx("ui-grid", `ui-grid-${cols}`, className)}>{children}</div>;
}
