"use client";

import { useChat } from "@/lib/chat-context";

/** Pills horizontais dos contextos selecionados. Cores por tipo via CSS. */
export default function ChatChips() {
  const { chips, removeChip } = useChat();
  if (chips.length === 0) return null;

  return (
    <div className="cm-chips">
      {chips.map((chip) => (
        <span key={chip.id} className={`cm-chip cm-chip-${chip.type}`} title={chip.label}>
          <span className="cm-chip-dot" aria-hidden />
          <span className="cm-chip-label">{chip.label}</span>
          <button
            className="cm-chip-x"
            onClick={() => removeChip(chip.id)}
            aria-label={`Remover ${chip.label}`}
          >
            ×
          </button>
        </span>
      ))}
    </div>
  );
}
