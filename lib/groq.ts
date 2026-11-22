import Groq from "groq-sdk";

/**
 * Cliente Groq compartilhado, criado sob demanda (lazy).
 * A key vem de GROQ_API_KEY (.env.local). Instanciar no topo do módulo fazia
 * `next build` falhar sem a variável; agora o erro só ocorre no primeiro uso,
 * e as rotas já checam a key antes de chamar.
 */
let _client: Groq | undefined;
const client = () => (_client ??= new Groq({ apiKey: process.env.GROQ_API_KEY }));

/**
 * Fallback para o OpenRouter (modelos grátis) quando o Groq falha por limite (429), erro 5xx
 * ou rede. Só entra em ação se OPENROUTER_API_KEY estiver no .env.local.
 * LLM_FORCE_FALLBACK=1 pula o Groq (útil para testar o fallback).
 * A transcrição (whisper) não tem fallback: o OpenRouter não faz speech-to-text.
 */
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const OPENROUTER_MODELS = [
  process.env.OPENROUTER_MODEL || "google/gemma-4-31b-it:free",
  "google/gemma-4-26b-a4b-it:free",
  "nvidia/nemotron-3.5-super-vl:free",
];

export const hasLlmFallback = () => !!process.env.OPENROUTER_API_KEY;

function shouldFallback(err: unknown): boolean {
  const e = err as { status?: number; message?: string } | undefined;
  if (typeof e?.status === "number") return e.status === 429 || e.status >= 500;
  return /rate limit|too many requests|fetch failed|ECONN|ETIMEDOUT|network/i.test(e?.message ?? "");
}

class OpenRouterError extends Error {
  constructor(message: string, public status?: number) { super(message); }
}

/** Remove cercas ```json e texto em volta, deixando só o objeto JSON. */
function cleanJson(content: string): string {
  const a = content.indexOf("{");
  const b = content.lastIndexOf("}");
  return a >= 0 && b > a ? content.slice(a, b + 1) : content;
}

async function* sseChunks(body: ReadableStream<Uint8Array>) {
  const reader = body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let nl: number;
    while ((nl = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (!line.startsWith("data:")) continue; // ignora comentários ": OPENROUTER PROCESSING"
      const data = line.slice(5).trim();
      if (data === "[DONE]") return;
      try { yield JSON.parse(data); } catch { /* linha parcial/ruído */ }
    }
  }
}

async function openRouterCreate(params: Record<string, unknown>) {
  // Parâmetros específicos do Groq/gpt-oss não existem nos modelos de fallback.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { model: _m, reasoning_effort: _r, ...rest } = params;
  const res = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ ...rest, model: OPENROUTER_MODELS[0], models: OPENROUTER_MODELS }),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new OpenRouterError(`OpenRouter ${res.status}: ${txt.slice(0, 300)}`, res.status);
  }
  if (params.stream) return sseChunks(res.body!);
  const json = await res.json();
  if (json?.error) throw new OpenRouterError(`OpenRouter: ${json.error.message ?? "erro"}`, json.error.code);
  const msg = json?.choices?.[0]?.message;
  if (msg && typeof msg.content === "string" && params.response_format) msg.content = cleanJson(msg.content);
  return json;
}

async function createWithFallback(params: Record<string, unknown>, opts?: unknown) {
  if (hasLlmFallback() && process.env.LLM_FORCE_FALLBACK === "1") return openRouterCreate(params);
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return await client().chat.completions.create(params as any, opts as any);
  } catch (err) {
    if (!hasLlmFallback() || !shouldFallback(err)) throw err;
    console.warn("[llm] Groq falhou, usando OpenRouter:", (err as Error)?.message?.slice(0, 120));
    return openRouterCreate(params);
  }
}

const chatWithFallback = { completions: { create: createWithFallback } };

export const groq = new Proxy({} as Groq, {
  get(_t, prop, receiver) {
    if (prop === "chat") return chatWithFallback;
    return Reflect.get(client(), prop, receiver);
  },
});

/**
 * Modelos usados no pipeline (centralizados para trocar fácil).
 * O Groq aposenta modelos de tempos em tempos (o llama-3.3-70b-versatile saiu): para trocar
 * sem mexer no código, defina GROQ_MODEL / GROQ_MODEL_TRANSCRIPTION no .env.local.
 * Modelos disponíveis para a sua key: https://console.groq.com/docs/models
 */
export const MODELS = {
  /** Speech-to-text — alta acurácia em PT-BR */
  transcription: process.env.GROQ_MODEL_TRANSCRIPTION || "whisper-large-v3",
  /** Estruturação clínica do texto (prontuário, cobrança, chat) */
  structuring: process.env.GROQ_MODEL || "openai/gpt-oss-120b",
};

/**
 * Parâmetros extras por modelo. Os modelos gpt-oss "pensam" antes de responder; esforço baixo
 * mantém a resposta rápida e gasta bem menos tokens do limite grátis (extração de dados não
 * precisa de raciocínio longo).
 */
export function llmParams(): { reasoning_effort?: "low" } {
  return MODELS.structuring.startsWith("openai/gpt-oss") ? { reasoning_effort: "low" } : {};
}
