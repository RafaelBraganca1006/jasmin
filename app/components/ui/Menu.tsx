"use client";

import { useState, type ReactNode } from "react";
import { cx } from "./cx";

export interface MenuItem {
  id: string;
  label: string;
  /** Selo curto à esquerda (ex.: "PDF"). */
  badge?: string;
  onSelect: () => void;
}

/** Menu suspenso: `trigger` recebe (open, toggle) e devolve o botão que abre o menu. */
export function Menu({
  trigger, items, align = "right",
}: { trigger: (open: boolean, toggle: () => void) => ReactNode; items: MenuItem[]; align?: "left" | "right" }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="ui-menu-wrap">
      {trigger(open, () => setOpen((v) => !v))}
      {open && (
        <>
          <div className="ui-menu-backdrop" onMouseDown={() => setOpen(false)} />
          <div className={cx("ui-menu", align === "left" && "ui-menu-left")} role="menu">
            {items.map((it) => (
              <button
                key={it.id}
                type="button"
                role="menuitem"
                className="ui-menu-item"
                onClick={() => { setOpen(false); it.onSelect(); }}
              >
                {it.badge && <span className="ui-menu-badge">{it.badge}</span>}
                {it.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
