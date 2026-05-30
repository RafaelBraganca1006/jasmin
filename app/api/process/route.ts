import { NextRequest, NextResponse } from "next/server";
import { transcribeAudio } from "@/lib/transcribe";
import { structureTranscript } from "@/lib/structure";

// Precisa de Node (SDK + manipulação de arquivo), não Edge.
export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * POST /api/process
 *
 * Dois modos de uso:
 *  1. JSON      → body { transcript: string }            (testar só a estruturação)
 *  2. Multipart → campo "audio" (arquivo)                (pipeline completo)
 *
 * Resposta: { transcript, soap }
 */
export async function POST(req: NextRequest) {
  if (!process.env.GROQ_API_KEY) {
    return NextResponse.json(
      { error: "GROQ_API_KEY não configurada. Adicione em .env.local e reinicie o servidor." },
      { status: 500 }
    );
  }

  try {
    const contentType = req.headers.get("content-type") ?? "";
    let transcript: string;

    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      const audio = form.get("audio");
      if (!(audio instanceof File)) {
        return NextResponse.json(
          { error: "Campo 'audio' ausente ou inválido no form-data." },
          { status: 400 }
        );
      }
      transcript = await transcribeAudio(audio);
    } else {
      const body = (await req.json().catch(() => ({}))) as { transcript?: unknown };
      if (typeof body.transcript !== "string" || !body.transcript.trim()) {
        return NextResponse.json(
          { error: "Envie { transcript: string } em JSON ou um arquivo 'audio' (multipart/form-data)." },
          { status: 400 }
        );
      }
      transcript = body.transcript;
    }

    const soap = await structureTranscript(transcript);
    return NextResponse.json({ transcript, soap });
  } catch (err) {
    console.error("[/api/process]", err);
    const message = err instanceof Error ? err.message : "Erro desconhecido no processamento.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
