import Groq from "groq-sdk";

/**
 * Cliente Groq compartilhado.
 * A key vem de GROQ_API_KEY (.env.local). Se faltar, as chamadas falham
 * com erro claro tratado nas rotas.
 */
export const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

/** Modelos usados no pipeline (centralizados para trocar fácil). */
export const MODELS = {
  /** Speech-to-text — alta acurácia em PT-BR */
  transcription: "whisper-large-v3",
  /** Estruturação clínica do texto */
  structuring: "llama-3.3-70b-versatile",
} as const;
