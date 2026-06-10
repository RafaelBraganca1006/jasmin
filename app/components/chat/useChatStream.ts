"use client";

import { useCallback, useState } from "react";
import { useChat, type ChatMessage } from "@/lib/chat-context";
import { buildStorageSnapshot } from "@/lib/chat-snapshot";

/**
 * Envia a mensagem ao /api/chat, lê o stream e atualiza a última mensagem do
 * agente — parseando os eventos especiais [[TOOL_START]], [[TOOL_RESULT]],
 * [[TOOL_DONE]] e [[FOLLOWUPS]] que vêm intercalados ao texto.
 */

const MARKER_RE = /\[\[(TOOL_START|TOOL_DONE|TOOL_RESULT|RESET)(:|\]\])/;

const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export function useChatStream(dentistaNome: string) {
  const { messages, setMessages, chips, clearChips } = useChat();
  const [isStreaming, setIsStreaming] = useState(false);

  const sendMessage = useCallback(
    async (text: string) => {
      const content = text.trim();
      if (!content || isStreaming) return;

      // Chips ativos viram anexo DESTA mensagem; os completos vão no corpo do
      // request; o prompt bar é esvaziado em seguida.
      const sentChips = chips;
      const attachments = sentChips.map((c) => ({ id: c.id, type: c.type, label: c.label }));

      const userMsg: ChatMessage = {
        id: uid(),
        role: "user",
        content,
        ...(attachments.length ? { attachments } : {}),
      };
      const assistantId = uid();
      const assistantMsg: ChatMessage = { id: assistantId, role: "assistant", content: "" };

      // Histórico enviado ao servidor.
      const history = [...messages, userMsg].map((m) => ({ role: m.role, content: m.content, id: m.id }));

      setMessages((prev) => [...prev, userMsg, assistantMsg]);
      clearChips();
      setIsStreaming(true);

      const patch = (fn: (m: ChatMessage) => ChatMessage) =>
        setMessages((prev) => prev.map((m) => (m.id === assistantId ? fn(m) : m)));

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: history,
            chips: sentChips,
            dentistaNome,
            storageSnapshot: buildStorageSnapshot(),
          }),
        });

        if (!res.ok || !res.body) {
          const errJson = await res.json().catch(() => ({}));
          patch((m) => ({
            ...m,
            content: m.content + `\n\n${errJson.error ?? "Falha na requisição."}`,
          }));
          return;
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        const handleMarker = (kind: string, payload: string) => {
          if (kind === "TOOL_START") {
            patch((m) => ({ ...m, pendingTool: payload }));
          } else if (kind === "TOOL_DONE") {
            patch((m) => ({ ...m, pendingTool: undefined }));
          } else if (kind === "TOOL_RESULT") {
            const sep = payload.indexOf("|");
            const name = sep >= 0 ? payload.slice(0, sep) : payload;
            const summary = sep >= 0 ? payload.slice(sep + 1) : "";
            patch((m) => ({ ...m, toolRuns: [...(m.toolRuns ?? []), { name, summary }] }));
          } else if (kind === "RESET") {
            // Turno intermediário (preâmbulo da tool call) — descarta o texto,
            // mantém os tool-runs já registrados.
            patch((m) => ({ ...m, content: "" }));
          }
        };

        const emit = (txt: string) => {
          if (txt) patch((m) => ({ ...m, content: m.content + txt }));
        };

        // Extrai marcadores completos do buffer; resto é texto. Segura qualquer
        // "[[" em aberto (marcador ainda incompleto) até chegar o "]]".
        const drain = (flush: boolean) => {
          for (;;) {
            const match = MARKER_RE.exec(buffer);
            if (match) {
              if (match.index > 0) {
                emit(buffer.slice(0, match.index));
                buffer = buffer.slice(match.index);
              }
              const end = buffer.indexOf("]]");
              if (end < 0) {
                // Marcador conhecido mas incompleto — espera mais dados.
                if (flush) buffer = "";
                return;
              }
              const inner = buffer.slice(2, end); // sem [[ e ]]
              const colon = inner.indexOf(":");
              if (colon < 0) handleMarker(inner, ""); // marcador sem payload (RESET)
              else handleMarker(inner.slice(0, colon), inner.slice(colon + 1));
              buffer = buffer.slice(end + 2);
              continue;
            }

            // Sem marcador conhecido completo. Se houver um "[[" sem "]]" depois,
            // pode ser um marcador parcial (ex.: "[[TOO") — segura a partir dele.
            const lastOpen = buffer.lastIndexOf("[[");
            if (!flush && lastOpen >= 0 && buffer.indexOf("]]", lastOpen) < 0) {
              emit(buffer.slice(0, lastOpen));
              buffer = buffer.slice(lastOpen);
              return;
            }

            // Senão, emite tudo (segurando só um "[" final solto, fora do flush).
            const safeUpto = !flush && buffer.endsWith("[") ? buffer.length - 1 : buffer.length;
            emit(buffer.slice(0, safeUpto));
            buffer = buffer.slice(safeUpto);
            return;
          }
        };

        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          drain(false);
        }
        drain(true);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Erro de conexão.";
        patch((m) => ({ ...m, content: m.content + `\n\n${msg}` }));
      } finally {
        patch((m) => ({ ...m, pendingTool: undefined }));
        setIsStreaming(false);
      }
    },
    [messages, setMessages, chips, clearChips, dentistaNome, isStreaming]
  );

  return { sendMessage, isStreaming };
}
