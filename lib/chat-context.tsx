"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type Dispatch,
  type SetStateAction,
} from "react";

/**
 * Estado global do Jasmin Assistant: conversas (histórico com múltiplos chats),
 * chips de contexto, abertura/maximização do painel e modo seletor. Fica acima
 * da /consulta para persistir durante a sessão mesmo se o painel fechar/abrir.
 */

export type ChipType = "consulta" | "paciente" | "odontograma" | "agenda_dia" | "documento";

export interface JasminChip {
  id: string;
  type: ChipType;
  label: string;
  /** Markdown injetado no system prompt do agente. */
  markdownContent: string;
  metadata: {
    appointmentId?: number;
    patientId?: string;
    date?: string;
  };
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  /** Contexto anexado a esta mensagem (versão leve — só para exibir as pills). */
  attachments?: { id: string; type: ChipType; label: string }[];
  /** Tools usadas nesta resposta (nome + resumo), exibidas como trace minimalista. */
  toolRuns?: { name: string; summary: string }[];
  /** Tool em execução agora (transitório, limpo ao fim do stream). */
  pendingTool?: string;
}

export interface Conversation {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
}

interface ChatContextValue {
  chips: JasminChip[];
  isOpen: boolean;
  isMaximized: boolean;
  isSelectingContext: boolean;
  isDragging: boolean;
  messages: ChatMessage[];
  conversations: Conversation[];
  activeChatId: string;
  addChip: (chip: JasminChip) => void;
  removeChip: (id: string) => void;
  clearChips: () => void;
  clearMessages: () => void;
  newChat: () => void;
  switchChat: (id: string) => void;
  deleteChat: (id: string) => void;
  renameChat: (id: string, title: string) => void;
  setIsOpen: (v: boolean) => void;
  setIsMaximized: (v: boolean) => void;
  setIsSelectingContext: (v: boolean) => void;
  setIsDragging: (v: boolean) => void;
  setMessages: Dispatch<SetStateAction<ChatMessage[]>>;
}

const ChatContext = createContext<ChatContextValue | null>(null);

const CHATS_KEY = "jasmin_chats";
const ACTIVE_KEY = "jasmin_active_chat";
const LEGACY_KEY = "jasmin_chat_history";
const DEFAULT_TITLE = "Novo chat";

const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const newConversation = (): Conversation => {
  const now = Date.now();
  return { id: uid(), title: DEFAULT_TITLE, messages: [], createdAt: now, updatedAt: now };
};

/** Título derivado da 1ª mensagem do usuário (enquanto ainda for o padrão). */
function deriveTitle(current: string, msgs: ChatMessage[]): string {
  if (current && current !== DEFAULT_TITLE) return current;
  const firstUser = msgs.find((m) => m.role === "user" && m.content.trim());
  if (!firstUser) return current || DEFAULT_TITLE;
  const t = firstUser.content.trim().replace(/\s+/g, " ");
  return t.length > 42 ? `${t.slice(0, 42)}…` : t;
}

/** Carrega as conversas do localStorage, migrando o formato antigo se preciso. */
function loadConversations(): { conversations: Conversation[]; activeChatId: string } {
  try {
    const raw = localStorage.getItem(CHATS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Conversation[];
      if (Array.isArray(parsed) && parsed.length) {
        const active = localStorage.getItem(ACTIVE_KEY) ?? parsed[0].id;
        const exists = parsed.some((c) => c.id === active);
        return { conversations: parsed, activeChatId: exists ? active : parsed[0].id };
      }
    }
    // Migração do formato antigo (uma lista única de mensagens).
    const legacy = localStorage.getItem(LEGACY_KEY);
    if (legacy) {
      const msgs = JSON.parse(legacy) as ChatMessage[];
      localStorage.removeItem(LEGACY_KEY);
      if (Array.isArray(msgs) && msgs.length) {
        const conv = newConversation();
        conv.messages = msgs;
        conv.title = deriveTitle(DEFAULT_TITLE, msgs);
        return { conversations: [conv], activeChatId: conv.id };
      }
    }
  } catch {
    /* ignora */
  }
  const conv = newConversation();
  return { conversations: [conv], activeChatId: conv.id };
}

export function ChatProvider({ children }: { children: ReactNode }) {
  const [chips, setChips] = useState<JasminChip[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [isSelectingContext, setIsSelectingContext] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeChatId, setActiveChatId] = useState<string>("");
  const hydrated = useRef(false);
  const activeIdRef = useRef<string>("");

  useEffect(() => {
    activeIdRef.current = activeChatId;
  }, [activeChatId]);

  // Hidrata (sobrevive a reload; LGPD: tudo só no localStorage do dispositivo).
  useEffect(() => {
    const { conversations: convs, activeChatId: active } = loadConversations();
    setConversations(convs);
    setActiveChatId(active);
    activeIdRef.current = active;
    hydrated.current = true;
  }, []);

  useEffect(() => {
    if (!hydrated.current) return;
    try {
      localStorage.setItem(CHATS_KEY, JSON.stringify(conversations));
      localStorage.setItem(ACTIVE_KEY, activeChatId);
    } catch {
      /* quota — ignora */
    }
  }, [conversations, activeChatId]);

  const messages = useMemo(
    () => conversations.find((c) => c.id === activeChatId)?.messages ?? [],
    [conversations, activeChatId]
  );

  // Atualiza as mensagens da conversa ATIVA (mantém a assinatura de setState).
  const setMessages = useCallback<Dispatch<SetStateAction<ChatMessage[]>>>((action) => {
    setConversations((convs) => {
      const id = activeIdRef.current;
      return convs.map((c) => {
        if (c.id !== id) return c;
        const next =
          typeof action === "function"
            ? (action as (p: ChatMessage[]) => ChatMessage[])(c.messages)
            : action;
        return { ...c, messages: next, title: deriveTitle(c.title, next), updatedAt: Date.now() };
      });
    });
  }, []);

  const addChip = useCallback((chip: JasminChip) => {
    setChips((prev) => (prev.some((c) => c.id === chip.id) ? prev : [...prev, chip]));
  }, []);
  const removeChip = useCallback((id: string) => {
    setChips((prev) => prev.filter((c) => c.id !== id));
  }, []);
  const clearChips = useCallback(() => setChips([]), []);

  const clearMessages = useCallback(() => {
    setConversations((convs) =>
      convs.map((c) => (c.id === activeIdRef.current ? { ...c, messages: [] } : c))
    );
  }, []);

  // Novo chat — se a conversa ativa já estiver vazia, apenas reusa.
  const newChat = useCallback(() => {
    setConversations((convs) => {
      const active = convs.find((c) => c.id === activeIdRef.current);
      if (active && active.messages.length === 0) return convs;
      const conv = newConversation();
      activeIdRef.current = conv.id;
      setActiveChatId(conv.id);
      return [conv, ...convs];
    });
  }, []);

  const switchChat = useCallback((id: string) => {
    activeIdRef.current = id;
    setActiveChatId(id);
  }, []);

  const renameChat = useCallback((id: string, title: string) => {
    const t = title.trim();
    if (!t) return;
    setConversations((convs) =>
      convs.map((c) => (c.id === id ? { ...c, title: t.slice(0, 60) } : c))
    );
  }, []);

  const deleteChat = useCallback((id: string) => {
    setConversations((convs) => {
      const rest = convs.filter((c) => c.id !== id);
      if (rest.length === 0) {
        const conv = newConversation();
        activeIdRef.current = conv.id;
        setActiveChatId(conv.id);
        return [conv];
      }
      if (id === activeIdRef.current) {
        activeIdRef.current = rest[0].id;
        setActiveChatId(rest[0].id);
      }
      return rest;
    });
  }, []);

  return (
    <ChatContext.Provider
      value={{
        chips,
        isOpen,
        isMaximized,
        isSelectingContext,
        isDragging,
        messages,
        conversations,
        activeChatId,
        addChip,
        removeChip,
        clearChips,
        clearMessages,
        newChat,
        switchChat,
        deleteChat,
        renameChat,
        setIsOpen,
        setIsMaximized,
        setIsSelectingContext,
        setIsDragging,
        setMessages,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
}

export function useChat(): ChatContextValue {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error("useChat deve ser usado dentro de <ChatProvider>.");
  return ctx;
}
