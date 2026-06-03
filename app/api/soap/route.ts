import { NextRequest, NextResponse } from "next/server";
import { structureTranscript } from "@/lib/structure";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  if (!process.env.GROQ_API_KEY) {
    return NextResponse.json({ error: "GROQ_API_KEY não configurada." }, { status: 500 });
  }
  try {
    const body = (await req.json()) as { transcript?: unknown };
    if (typeof body.transcript !== "string" || !body.transcript.trim()) {
      return NextResponse.json({ error: "Envie { transcript: string }." }, { status: 400 });
    }
    const soap = await structureTranscript(body.transcript);
    return NextResponse.json({ soap });
  } catch (err) {
    console.error("[/api/soap]", err);
    const message = err instanceof Error ? err.message : "Erro na estruturação.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
