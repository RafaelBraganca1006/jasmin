"use client";

import { useChat } from "@/lib/chat-context";
import ChatPanel from "./ChatPanel";
import ContextSelector from "./ContextSelector";

/**
 * Entrada do Jasmin Assistant: botão flutuante + painel slide-in + banner do
 * modo seletor. Renderizado pelo layout de /consulta, fora do ConsultaPage,
 * para aparecer em todas as seções (agenda, pacientes, financeiro, consulta).
 */
export default function JasminChat() {
  const { isOpen, setIsOpen, isSelectingContext } = useChat();

  return (
    <>
      <ContextSelector />

      {!isOpen && (
        <button
          className={`cm-fab${isSelectingContext ? " cm-fab-selecting" : ""}`}
          onClick={() => setIsOpen(true)}
          aria-label="Abrir Jasmin AI"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
          <span className="cm-fab-label">Jasmin AI</span>
        </button>
      )}

      <ChatPanel />
    </>
  );
}
