import { toFile } from "groq-sdk";
import { groq, MODELS } from "@/lib/groq";

/**
 * Transcreve um arquivo de áudio (PT-BR) usando Whisper no Groq.
 * Aceita o File vindo de um multipart/form-data.
 *
 * Convertemos para Buffer + toFile() porque passar o File da web direto
 * para o SDK no runtime Node pode enviar dados vazios/corrompidos
 * (Whisper então "ouve" silêncio e alucina créditos de legenda).
 */
export async function transcribeAudio(file: File): Promise<string> {
  const buffer = Buffer.from(await file.arrayBuffer());

  if (buffer.byteLength < 2048) {
    throw new Error(
      "Áudio vazio ou muito curto — o microfone provavelmente não capturou som."
    );
  }

  const upload = await toFile(buffer, file.name || "audio.webm", {
    type: file.type || "audio/webm",
  });

  const result = (await groq.audio.transcriptions.create({
    file: upload,
    model: MODELS.transcription,
    language: "pt",
    response_format: "text",
    temperature: 0,
    prompt: "Transcrição de uma consulta odontológica em português do Brasil.",
  })) as unknown as string | { text?: string };

  // Com response_format "text" o SDK retorna string; por segurança tratamos ambos.
  if (typeof result === "string") return result.trim();
  return (result.text ?? "").trim();
}
