import Groq from "groq-sdk";

/**
 * Cliente Groq compartilhado, criado sob demanda (lazy).
 * A key vem de GROQ_API_KEY (.env.local). Instanciar no topo do módulo fazia
 * `next build` falhar sem a variável; agora o erro só ocorre no primeiro uso,
 * e as rotas já checam a key antes de chamar.
 */
let _client: Groq | undefined;
export const groq = new Proxy({} as Groq, {
  get(_t, prop, receiver) {
    _client ??= new Groq({ apiKey: process.env.GROQ_API_KEY });
    return Reflect.get(_client, prop, receiver);
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
