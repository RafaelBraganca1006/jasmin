"use client";

import { useEffect, useRef, useState } from "react";
import { useChat } from "@/lib/chat-context";
import { renderMarkdown } from "./markdown";

// Rótulo em andamento (gerúndio) e concluído (pretérito), por tool.
const TOOL_RUNNING: Record<string, string> = {
  search_patients: "Buscando pacientes",
  get_consultas_hoje: "Consultando a agenda de hoje",
  get_historico_paciente: "Lendo o histórico do paciente",
  get_proxima_consulta: "Buscando a próxima consulta",
  consultar_interacoes_medicamentosas: "Consultando interações medicamentosas",
};
const TOOL_DONE: Record<string, string> = {
  search_patients: "Buscou pacientes",
  get_consultas_hoje: "Consultou a agenda de hoje",
  get_historico_paciente: "Consultou o histórico do paciente",
  get_proxima_consulta: "Buscou a próxima consulta",
  consultar_interacoes_medicamentosas: "Consultou interações medicamentosas",
};
const runningLabel = (name: string) => TOOL_RUNNING[name] ?? name;
const doneLabel = (name: string) => TOOL_DONE[name] ?? name;

/** Trace minimalista (estilo Claude): linha cinza com chevron, expansível. */
function ToolTrace({ name, summary }: { name: string; summary: string }) {
  const [open, setOpen] = useState(false);
  const canExpand = Boolean(summary.trim());
  return (
    <div className="cm-trace-item">
      <button
        className={`cm-trace-row${open ? " cm-trace-row-open" : ""}`}
        onClick={() => canExpand && setOpen((o) => !o)}
      >
        <span className="cm-trace-label">{doneLabel(name)}</span>
        {canExpand && (
          <svg className="cm-trace-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" width="13" height="13">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        )}
      </button>
      {open && canExpand && <div className="cm-trace-detail">{summary}</div>}
    </div>
  );
}

interface Props {
  isStreaming: boolean;
}

export default function ChatMessages({ isStreaming }: Props) {
  const { messages } = useChat();
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  if (messages.length === 0) {
    return (
      <div className="cm-empty">
        <p className="cm-empty-title">Olá! Sou o Jasmin Assistant.</p>
        <p className="cm-empty-sub">
          Pergunte sobre pacientes, consultas, prontuários ou interações medicamentosas.
          Use o seletor de contexto para anexar elementos da tela.
        </p>
      </div>
    );
  }

  return (
    <div className="cm-messages">
      {messages.map((m, i) => {
        const isLast = i === messages.length - 1;
        if (m.role === "user") {
          return (
            <div key={m.id} className="cm-msg cm-msg-user">
              {m.attachments && m.attachments.length > 0 && (
                <div className="cm-msg-attachments">
                  {m.attachments.map((a) => (
                    <span key={a.id} className={`cm-chip cm-chip-${a.type} cm-chip-ro`} title={a.label}>
                      <span className="cm-chip-dot" aria-hidden />
                      <span className="cm-chip-label">{a.label}</span>
                    </span>
                  ))}
                </div>
              )}
              <div className="cm-bubble cm-bubble-user">{m.content}</div>
            </div>
          );
        }
        return (
          <div key={m.id} className="cm-msg cm-msg-bot">
            {m.toolRuns && m.toolRuns.length > 0 && (
              <div className="cm-trace">
                {m.toolRuns.map((t, j) => (
                  <ToolTrace key={j} name={t.name} summary={t.summary} />
                ))}
              </div>
            )}

            {m.pendingTool && (
              <div className="cm-trace-loading">
                <span className="cm-trace-spinner" aria-hidden />
                {runningLabel(m.pendingTool)}…
              </div>
            )}

            {!m.pendingTool && isLast && isStreaming && !m.content.trim() && (
              <div className="cm-trace-loading">
                <span className="cm-trace-spinner" aria-hidden />
                Pensando…
              </div>
            )}

            {m.content.trim() && (
              <div
                className="cm-bubble cm-bubble-bot"
                dangerouslySetInnerHTML={{ __html: renderMarkdown(m.content) }}
              />
            )}
          </div>
        );
      })}
      <div ref={endRef} />
    </div>
  );
}
