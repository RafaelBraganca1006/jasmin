import { NextRequest, NextResponse } from "next/server";
import { HumanMessage, AIMessage } from "@langchain/core/messages";
import { createJasminGraph, buildSystemPrompt } from "@/lib/jasmin-graph";
import { groq, MODELS } from "@/lib/groq";
import type { StorageSnapshot } from "@/lib/chat-snapshot";
import type { ChatMessage, JasminChip } from "@/lib/chat-context";

// LangGraph + Groq — precisa de Node e tempo.
export const runtime = "nodejs";
export const maxDuration = 60;

interface ChatBody {
  messages?: ChatMessage[];
  chips?: JasminChip[];
  dentistaNome?: string;
  storageSnapshot?: StorageSnapshot;
}

const EMPTY_SNAPSHOT: StorageSnapshot = {
  patients: [],
  appointments: [],
  prontuarios: {},
  prontuariosMd: {},
};

const enc = new TextEncoder();

type GroqMsg = { role: "system" | "user" | "assistant"; content: string };

/** Resumo curto do output de uma tool para o evento [[TOOL_RESULT]]. */
function toolSummary(output: unknown): string {
  const text = typeof output === "string" ? output : JSON.stringify(output ?? "");
  const firstLine = text.split("\n").find((l) => l.trim()) ?? "";
  const clean = firstLine.replace(/[*#[\]|]/g, "").trim();
  return clean.length > 70 ? `${clean.slice(0, 67)}…` : clean || "concluído";
}

/** Data de hoje por extenso em PT-BR. */
function dataHojeExtenso(): string {
  const s = new Date().toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function isRateLimit(err: unknown): boolean {
  const e = err as { status?: number; message?: string } | undefined;
  return e?.status === 429 || /rate limit|too many requests/i.test(e?.message ?? "");
}

export async function POST(req: NextRequest) {
  if (!process.env.GROQ_API_KEY) {
    return NextResponse.json(
      { error: "GROQ_API_KEY não configurada. Adicione em .env.local e reinicie o servidor." },
      { status: 500 }
    );
  }

  const body = (await req.json().catch(() => ({}))) as ChatBody;
  const messages = Array.isArray(body.messages) ? body.messages : [];
  const chips = Array.isArray(body.chips) ? body.chips : [];
  const dentistaNome = (body.dentistaNome || "Dr(a).").trim();
  const snapshot = body.storageSnapshot ?? EMPTY_SNAPSHOT;

  const lastUser = [...messages].reverse().find((m) => m.role === "user");
  if (!lastUser) {
    return NextResponse.json({ error: "Nenhuma mensagem do usuário." }, { status: 400 });
  }

  const contextoAtivo = chips
    .map((c) => c.markdownContent)
    .filter(Boolean)
    .join("\n\n---\n\n");
  const dataHoje = dataHojeExtenso();

  const lcMessages = messages
    .filter((m) => m.content.trim())
    .map((m) => (m.role === "user" ? new HumanMessage(m.content) : new AIMessage(m.content)));

  const graph = createJasminGraph({ snapshot });

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (s: string) => controller.enqueue(enc.encode(s));
      let respostaFinal = "";
      const toolOutputs: string[] = [];
      let rateLimited = false;
      let needFallback = false;

      /**
       * Fallback: responde SEM ferramentas, reaproveitando os resultados de tools
       * já obtidos. Usado quando o turno final vem vazio ou o Groq falha a chamada
       * de função ("Failed to call a function"). Garante que sempre há resposta.
       */
      const fallbackAnswer = async (): Promise<string> => {
        const toolNote = toolOutputs.length
          ? `\n\nResultados já obtidos das ferramentas (use-os para responder):\n${toolOutputs.join("\n\n")}`
          : "";
        const sys =
          buildSystemPrompt({ contextoAtivo, dataHoje }) +
          toolNote +
          "\n\nIMPORTANTE: você está SEM acesso às ferramentas agora. Responda usando SOMENTE os dados acima (resultados de ferramentas e contexto selecionado) e o histórico da conversa." +
          " NUNCA invente pacientes, nomes, diagnósticos, doenças, consultas ou datas — se os dados disponíveis não bastarem, diga claramente que não encontrou essa informação e sugira selecionar o contexto na tela." +
          " Você pode responder dúvidas gerais de odontologia/medicina sem inventar dados da clínica. Não escreva planos nem liste passos — responda direto à pergunta.";
        const gmsgs: GroqMsg[] = [
          { role: "system", content: sys },
          ...messages
            .filter((m) => m.content.trim())
            .map((m) => ({ role: m.role, content: m.content }) as GroqMsg),
        ];
        let txt = "";
        const completion = await groq.chat.completions.create({
          model: MODELS.structuring,
          temperature: 0.1,
          stream: true,
          messages: gmsgs,
        });
        for await (const part of completion) {
          const delta = part.choices[0]?.delta?.content ?? "";
          if (delta) {
            txt += delta;
            send(delta);
          }
        }
        return txt;
      };

      try {
        const eventStream = graph.streamEvents(
          { messages: lcMessages, contextoAtivo, dentistaNome, dataHoje },
          { version: "v2" }
        );

        for await (const ev of eventStream) {
          if (ev.event === "on_chat_model_stream") {
            const chunk = ev.data?.chunk;
            const content = typeof chunk?.content === "string" ? chunk.content : "";
            if (content) {
              respostaFinal += content;
              send(content);
            }
          } else if (ev.event === "on_chat_model_end") {
            // Turno que chamou tool: seu texto é só "preâmbulo". Descarta no cliente.
            const out = ev.data?.output;
            const toolCalls = out?.tool_calls ?? [];
            if (Array.isArray(toolCalls) && toolCalls.length > 0) {
              respostaFinal = "";
              send("[[RESET]]");
            }
          } else if (ev.event === "on_tool_start") {
            send(`[[TOOL_START:${ev.name}]]`);
          } else if (ev.event === "on_tool_end") {
            const raw = ev.data?.output?.content ?? ev.data?.output;
            const txt = typeof raw === "string" ? raw : JSON.stringify(raw ?? "");
            toolOutputs.push(`${ev.name}: ${txt.slice(0, 1500)}`);
            send(`[[TOOL_RESULT:${ev.name}|${toolSummary(raw)}]]`);
            send(`[[TOOL_DONE:${ev.name}]]`);
          }
        }
      } catch (err) {
        console.error("[/api/chat] graph error:", err);
        if (isRateLimit(err)) {
          rateLimited = true;
          send("[[RESET]]");
          send("Limite de requisições do Groq atingido. Aguarde alguns segundos e tente novamente.");
        } else {
          // Falha de chamada de função / geração — cai no fallback sem tools.
          needFallback = true;
        }
      }

      // Turno final vazio também aciona o fallback.
      if (!rateLimited && !respostaFinal.trim()) needFallback = true;

      if (needFallback && !rateLimited) {
        try {
          send("[[RESET]]");
          respostaFinal = await fallbackAnswer();
        } catch (err) {
          console.error("[/api/chat] fallback error:", err);
          send(
            isRateLimit(err)
              ? "Limite de requisições do Groq atingido. Aguarde alguns segundos e tente novamente."
              : "Não consegui gerar a resposta. Tente reformular a pergunta."
          );
          respostaFinal = "";
        }
      }

      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
