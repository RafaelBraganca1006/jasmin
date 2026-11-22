import type { ReactNode } from "react";
import { cx } from "./cx";

/** Título de seção (laranja, caixa alta, linha fina embaixo). */
export function SectionTitle({ children, action, className }: { children: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cx("ui-section-head", className)}>
      <h3 className="ui-section-title">{children}</h3>
      {action}
    </div>
  );
}

/** Seção de página/aba: título padronizado + conteúdo. */
export function Section({
  id, title, action, className, children,
}: { id?: string; title: ReactNode; action?: ReactNode; className?: string; children: ReactNode }) {
  return (
    <section id={id} className={cx("ui-section", className)}>
      <SectionTitle action={action}>{title}</SectionTitle>
      {children}
    </section>
  );
}
