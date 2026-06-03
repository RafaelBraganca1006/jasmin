import { NextRequest, NextResponse } from "next/server";
import { transcribeAudio } from "@/lib/transcribe";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  if (!process.env.GROQ_API_KEY) {
    return NextResponse.json({ error: "GROQ_API_KEY não configurada." }, { status: 500 });
  }
  try {
    const form = await req.formData();
    const audio = form.get("audio");
    if (!(audio instanceof File)) {
      return NextResponse.json({ error: "Campo 'audio' ausente." }, { status: 400 });
    }
    const transcript = await transcribeAudio(audio);
    return NextResponse.json({ transcript });
  } catch (err) {
    console.error("[/api/transcribe]", err);
    const message = err instanceof Error ? err.message : "Erro na transcrição.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
