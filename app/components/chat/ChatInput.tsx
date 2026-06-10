"use client";

import { useEffect, useRef, useState } from "react";
import { useChat } from "@/lib/chat-context";
import { buildDocumentChip, DocumentError } from "@/lib/extract-document";

interface Props {
  disabled: boolean;
  onSend: (text: string) => void;
}

const MAX_LINES = 4;
const LINE_PX = 22;

export default function ChatInput({ disabled, onSend }: Props) {
  const { isSelectingContext, setIsSelectingContext, addChip } = useChat();
  const [text, setText] = useState("");
  const [docError, setDocError] = useState("");
  const [loadingDoc, setLoadingDoc] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Auto-expande até 4 linhas.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, LINE_PX * MAX_LINES + 16)}px`;
  }, [text]);

  const submit = () => {
    const t = text.trim();
    if (!t || disabled) return;
    onSend(t);
    setText("");
  };

  const onPickFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (!files.length) return;
    setDocError("");
    setLoadingDoc(true);
    try {
      for (const f of files) {
        const chip = await buildDocumentChip(f);
        addChip(chip);
      }
    } catch (err) {
      setDocError(err instanceof DocumentError ? err.message : "Falha ao ler o documento.");
    } finally {
      setLoadingDoc(false);
    }
  };

  return (
    <div className="cm-composer">
      {docError && <div className="cm-doc-error">{docError}</div>}
      <div className="cm-input">
        <input
          ref={fileRef}
          type="file"
          accept=".pdf,.txt,.md,.markdown,.csv,.json,application/pdf,text/plain"
          multiple
          hidden
          onChange={onPickFile}
        />
        <div className="cm-input-tools">
          <button
            className="cm-input-btn cm-tip cm-tip-up"
            data-tooltip="Adicionar documento (PDF, TXT…)"
            aria-label="Adicionar documento"
            disabled={disabled || loadingDoc}
            onClick={() => fileRef.current?.click()}
          >
            {loadingDoc ? (
              <span className="cm-spinner" aria-hidden />
            ) : (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="15" height="15">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            )}
          </button>
          <button
            className={`cm-input-btn cm-tip cm-tip-up${isSelectingContext ? " cm-input-btn-active" : ""}`}
            data-tooltip="Selecionar contexto da tela"
            aria-label="Selecionar contexto"
            onClick={() => setIsSelectingContext(!isSelectingContext)}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="15" height="15">
              <path d="m3 3 7.07 16.97 2.51-7.39 7.39-2.51L3 3z" />
              <path d="m13 13 6 6" />
            </svg>
          </button>
        </div>

        <textarea
          ref={ref}
          className="cm-input-area"
          rows={1}
          placeholder="Pergunte sobre pacientes, consultas..."
          value={text}
          disabled={disabled}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
        />
        <button
          className="cm-send"
          onClick={submit}
          disabled={disabled || !text.trim()}
          aria-label="Enviar"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
            <line x1="22" y1="2" x2="11" y2="13" />
            <polygon points="22 2 15 22 11 13 2 9 22 2" />
          </svg>
        </button>
      </div>
    </div>
  );
}
