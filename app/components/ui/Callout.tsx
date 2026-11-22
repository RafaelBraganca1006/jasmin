import type { ReactNode } from "react";
import { cx } from "./cx";
import type { Tone } from "./Badge";

/** Nota de margem para avisos: linha lateral colorida, sem caixa. */
export function Callout({ tone = "amber", title, children, className }: { tone?: Tone; title?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div className={cx("ui-callout", `ui-tone-${tone}`, className)}>
      {title && <div className="ui-callout-title">{title}</div>}
      <div className="ui-callout-body">{children}</div>
    </div>
  );
}
