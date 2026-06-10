import { NextRequest, NextResponse } from "next/server";
import { gerarProntuario, type GerarProntuarioInput } from "@/lib/prontuario-agent";
import type { IdentificacaoModel } from "@/lib/types-prontuario";

// Pipeline de 5 chamadas Groq sequenciais — precisa de Node e tempo.
export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * POST /api/prontuario
 *
 * Body JSON:
 *   {
 *     transcript: string,                 // obrigatório
 *     paciente?: Partial<IdentificacaoModel>,
 *     laudo?: string,
 *     historicoMd?: string
 *   }
 *
 * Resposta: { prontuario: ProntuarioModel, falhasParciais: string[] }
 */
export async function POST(req: NextRequest) {
  if (!process.env.GROQ_API_KEY) {
    return NextResponse.json(
      { error: "GROQ_API_KEY não configurada. Adicione em .env.local e reinicie o servidor." },
      { status: 500 }
    );
  }

  try {
    const body = (await req.json().catch(() => ({}))) as {
      transcript?: unknown;
      paciente?: Partial<IdentificacaoModel>;
      laudo?: unknown;
      historicoMd?: unknown;
    };

    if (typeof body.transcript !== "string" || !body.transcript.trim()) {
      return NextResponse.json({ error: "Envie { transcript: string }." }, { status: 400 });
    }

    const input: GerarProntuarioInput = {
      transcript: body.transcript,
      paciente: body.paciente,
      laudo: typeof body.laudo === "string" ? body.laudo : undefined,
      historicoMd: typeof body.historicoMd === "string" ? body.historicoMd : undefined,
    };

    const { prontuario, falhasParciais } = await gerarProntuario(input);
    return NextResponse.json({ prontuario, falhasParciais });
  } catch (err) {
    console.error("[/api/prontuario]", err);
    const message = err instanceof Error ? err.message : "Erro ao gerar o prontuário.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
