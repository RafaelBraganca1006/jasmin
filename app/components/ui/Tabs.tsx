import type { ReactNode } from "react";
import { cx } from "./cx";

export interface TabItem {
  id: string;
  label: string;
  icon?: ReactNode;
}

interface TabsProps {
  items: TabItem[];
  value: string;
  onChange: (id: string) => void;
  className?: string;
  "aria-label"?: string;
}

/**
 * Abas com sublinhado laranja no item ativo. Usa <div role="tablist"> (e não <nav>)
 * porque existe uma regra global `nav { height: ... }` do site institucional.
 */
export function Tabs({ items, value, onChange, className, ...rest }: TabsProps) {
  return (
    <div role="tablist" className={cx("ui-tabs", className)} aria-label={rest["aria-label"]}>
      {items.map((it) => (
        <button
          key={it.id}
          type="button"
          role="tab"
          aria-selected={value === it.id}
          className={cx("ui-tab", value === it.id && "ui-tab-on")}
          onClick={() => onChange(it.id)}
        >
          {it.icon}
          {it.label}
        </button>
      ))}
    </div>
  );
}
