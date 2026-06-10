"use client";

import { useEffect, useRef, useState } from "react";
import { useChat, type Conversation } from "@/lib/chat-context";

interface Props {
  onClose: () => void;
  /** Variante enxuta usada na sidebar do modo maximizado. */
  compact?: boolean;
}

const fmtWhen = (ts: number): string => {
  const d = new Date(ts);
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  if (sameDay) return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" });
};

const preview = (c: Conversation): string => {
  const last = [...c.messages].reverse().find((m) => m.content.trim());
  if (!last) return "Sem mensagens ainda";
  const t = last.content.trim().replace(/\s+/g, " ");
  return t.length > 60 ? `${t.slice(0, 60)}…` : t;
};

/** Lista de conversas — overlay (card) ou sidebar enxuta (maximizado). */
export default function ChatHistory({ onClose, compact = false }: Props) {
  const { conversations, activeChatId, newChat, switchChat, deleteChat, renameChat } = useChat();
  const ordered = [...conversations].sort((a, b) => b.updatedAt - a.updatedAt);

  const [menuId, setMenuId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);

  // Fecha o menu ao clicar fora.
  useEffect(() => {
    if (!menuId) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setMenuId(null);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [menuId]);

  const startRename = (c: Conversation) => {
    setMenuId(null);
    setEditingId(c.id);
    setDraft(c.title);
  };
  const commitRename = () => {
    if (editingId) renameChat(editingId, draft);
    setEditingId(null);
  };

  return (
    <div className={`cm-history${compact ? " cm-history-compact" : ""}`} ref={rootRef}>
      <div className="cm-history-head">
        <button
          className={compact ? "cm-history-newrow" : "cm-history-new"}
          onClick={() => {
            newChat();
            onClose();
          }}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="15" height="15">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Novo chat
        </button>
      </div>

      {compact && <span className="cm-history-section">Recentes</span>}

      <div className="cm-history-list">
        {ordered.map((c) => {
          const isEditing = editingId === c.id;
          return (
            <div
              key={c.id}
              className={`cm-history-item${c.id === activeChatId ? " cm-history-item-active" : ""}`}
              onClick={() => {
                if (isEditing) return;
                switchChat(c.id);
                onClose();
              }}
              role="button"
              tabIndex={0}
            >
              <div className="cm-history-item-main">
                {isEditing ? (
                  <input
                    className="cm-history-rename"
                    autoFocus
                    value={draft}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => setDraft(e.target.value)}
                    onBlur={commitRename}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        commitRename();
                      } else if (e.key === "Escape") {
                        setEditingId(null);
                      }
                    }}
                  />
                ) : (
                  <span className="cm-history-item-title">{c.title}</span>
                )}
                {!compact && !isEditing && <span className="cm-history-item-preview">{preview(c)}</span>}
              </div>

              {!compact && !isEditing && <span className="cm-history-item-when">{fmtWhen(c.updatedAt)}</span>}

              {!isEditing && (
                <span className="cm-history-menuwrap">
                  <span
                    className="cm-history-kebab"
                    role="button"
                    tabIndex={0}
                    aria-label="Opções da conversa"
                    onClick={(e) => {
                      e.stopPropagation();
                      setMenuId((cur) => (cur === c.id ? null : c.id));
                    }}
                  >
                    <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
                      <circle cx="5" cy="12" r="1.6" />
                      <circle cx="12" cy="12" r="1.6" />
                      <circle cx="19" cy="12" r="1.6" />
                    </svg>
                  </span>
                  {menuId === c.id && (
                    <div className="cm-history-menu" onClick={(e) => e.stopPropagation()}>
                      <button className="cm-history-menu-item" onClick={() => startRename(c)}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="14" height="14">
                          <path d="M12 20h9" />
                          <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z" />
                        </svg>
                        Renomear
                      </button>
                      <button
                        className="cm-history-menu-item cm-history-menu-danger"
                        onClick={() => {
                          setMenuId(null);
                          deleteChat(c.id);
                        }}
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="14" height="14">
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                        </svg>
                        Apagar
                      </button>
                    </div>
                  )}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
