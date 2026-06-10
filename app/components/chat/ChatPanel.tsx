"use client";

/* eslint-disable @next/next/no-img-element */
import { useState } from "react";
import { useChat } from "@/lib/chat-context";
import { useChatStream } from "./useChatStream";
import ChatChips from "./ChatChips";
import ChatMessages from "./ChatMessages";
import ChatInput from "./ChatInput";
import ChatHistory from "./ChatHistory";

const DENTISTA_NOME = "Dr. Usuário";

export default function ChatPanel() {
  const { isOpen, isMaximized, setIsOpen, setIsMaximized } = useChat();
  const { sendMessage, isStreaming } = useChatStream(DENTISTA_NOME);
  const [showHistory, setShowHistory] = useState(false);

  const header = (
    <header className="cm-header">
      <div className="cm-brand">
        <img className="cm-brand-img" src="/favicon.png" alt="Jasmin" />
        <span className="cm-logo">Jasmin AI</span>
      </div>
      <div className="cm-header-actions">
        {!isMaximized && (
          <button
            className={`cm-icon-btn cm-tip${showHistory ? " cm-icon-btn-active" : ""}`}
            data-tooltip="Histórico"
            aria-label="Histórico de conversas"
            onClick={() => setShowHistory((v) => !v)}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
              <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
              <path d="M3 3v5h5" />
              <path d="M12 7v5l4 2" />
            </svg>
          </button>
        )}
        <button
          className="cm-icon-btn cm-tip cm-tip-right"
          data-tooltip={isMaximized ? "Minimizar" : "Maximizar"}
          aria-label={isMaximized ? "Minimizar" : "Maximizar"}
          onClick={() => setIsMaximized(!isMaximized)}
        >
          {isMaximized ? (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
              <polyline points="9 3 9 9 3 9" />
              <polyline points="15 3 15 9 21 9" />
              <polyline points="15 21 15 15 21 15" />
              <polyline points="9 21 9 15 3 15" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
              <polyline points="15 3 21 3 21 9" />
              <polyline points="9 21 3 21 3 15" />
              <line x1="21" y1="3" x2="14" y2="10" />
              <line x1="3" y1="21" x2="10" y2="14" />
            </svg>
          )}
        </button>
        <button
          className="cm-icon-btn cm-tip cm-tip-right"
          data-tooltip="Fechar"
          aria-label="Fechar"
          onClick={() => setIsOpen(false)}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
    </header>
  );

  const chat = (
    <>
      <ChatMessages isStreaming={isStreaming} />
      <ChatChips />
      <ChatInput disabled={isStreaming} onSend={sendMessage} />
    </>
  );

  return (
    <aside
      className={`cm-panel${isOpen ? " cm-panel-open" : ""}${isMaximized ? " cm-panel-max" : ""}`}
      aria-hidden={!isOpen}
    >
      {isMaximized ? (
        <div className="cm-max-body">
          <aside className="cm-max-sidebar">
            <ChatHistory compact onClose={() => {}} />
          </aside>
          <div className="cm-max-main">
            {header}
            {chat}
          </div>
        </div>
      ) : (
        <>
          {header}
          {showHistory ? <ChatHistory onClose={() => setShowHistory(false)} /> : chat}
        </>
      )}
    </aside>
  );
}
