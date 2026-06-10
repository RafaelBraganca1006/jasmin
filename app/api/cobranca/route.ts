import { NextRequest } from "next/server";
import { gerarGuiaCobranca } from "@/lib/cobranca-agent";
import type { DadosPrestador, TraceEvent } from "@/lib/types-cobranca";
import type { ProntuarioModel } from "@/lib/types-prontuario";
import type { StorageSnapshot } from "@/lib/chat-snapshot";

// Pipeline com chamadas Groq + RAG — precisa de Node e tempo.
export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * POST /api/cobranca  (Server-Sent Events)
 *
 * Faz streaming do TRACE do agente em tempo real (quais documentos ele consulta
 * enquanto gera a guia), terminando com a guia completa:
 *
 *   data: {"tipo":"search","mensagem":"...","timestamp":"..."}\n\n
 *   ...
 *   data: {"tipo":"complete","guia":{...},"trace":[...]}\n\n
 *
 * Mesma decisão LGPD do /api/chat: o dado clínico vive no browser; o cliente
 * envia um recorte (storageSnapshot). Nada é persistido no servidor.
 *
 * Body: { appointmentId: number, dadosPrestador: DadosPrestador, storageSnapshot }
 */
interface CobrancaBody {
  appointmentId?: unknown;
  dadosPrestador?: Partial<DadosPrestador>;
  storageSnapshot?: StorageSnapshot;
}

const DEFAULT_PRESTADOR: DadosPrestador = {
  clinica_nome: "",
  clinica_cnpj: "",
  dentista_nome: "Dr. Usuário",
  dentista_cro: "",
};

const enc = new TextEncoder();
const sse = (obj: unknown) => enc.encode(`data: ${JSON.stringify(obj)}\n\n`);
const now = () => new Date().toISOString();

export async function POST(req: NextRequest) {
  const fail = (mensagem: string, status = 400) =>
    new Response(
      `data: ${JSON.stringify({ tipo: "error", mensagem, timestamp: now() })}\n\n`,
      { status, headers: SSE_HEADERS }
    );

  if (!process.env.GROQ_API_KEY) {
    return fail("GROQ_API_KEY não configurada. Adicione em .env.local e reinicie.", 500);
  }

  const body = (await req.json().catch(() => ({}))) as CobrancaBody;

  const appointmentId =
    typeof body.appointmentId === "number" ? body.appointmentId : Number(body.appointmentId);
  if (!Number.isFinite(appointmentId)) return fail("Envie { appointmentId: number }.");

  const snapshot = body.storageSnapshot;
  if (!snapshot) return fail("storageSnapshot ausente.");

  const aptKey = String(appointmentId);
  const prontuarioModel: ProntuarioModel | undefined = snapshot.prontuarios?.[aptKey];
  const prontuarioMd: string = snapshot.prontuariosMd?.[aptKey] ?? "";
  if (!prontuarioModel) {
    return fail("Nenhum prontuário salvo para este agendamento. Gere o prontuário antes da cobrança.", 404);
  }

  // Resolve dados do paciente e injeta no prontuário (convênio/carteirinha/nome).
  const appt = snapshot.appointments?.find((a) => String(a.id) === aptKey);
  const patientId = appt?.patientId ?? "";
  const patient = snapshot.patients?.find((p) => p.id === patientId);
  const ident = prontuarioModel.identificacao;
  const enrichedModel: ProntuarioModel = {
    ...prontuarioModel,
    identificacao: {
      ...ident,
      nome_paciente:
        ident.nome_paciente || (patient ? `${patient.nome} ${patient.sobrenome}`.trim() : ""),
      convenio:
        ident.convenio ||
        patient?.convenio ||
        prontuarioModel.metadata_cobranca?.convenio_nome ||
        "",
    },
  };

  const dadosPrestador: DadosPrestador = { ...DEFAULT_PRESTADOR, ...(body.dadosPrestador ?? {}) };

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const trace: TraceEvent[] = [];
      const onTrace = (ev: TraceEvent) => {
        trace.push(ev);
        try {
          controller.enqueue(sse(ev));
        } catch {
          /* cliente desconectou */
        }
      };

      try {
        const guia = await gerarGuiaCobranca(prontuarioMd, enrichedModel, dadosPrestador, onTrace);
        controller.enqueue(sse({ tipo: "complete", guia, patientId, trace, timestamp: now() }));
      } catch (err) {
        console.error("[/api/cobranca]", err);
        const mensagem = err instanceof Error ? err.message : "Erro ao gerar a guia.";
        controller.enqueue(sse({ tipo: "error", mensagem, timestamp: now() }));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, { headers: SSE_HEADERS });
}

const SSE_HEADERS = {
  "Content-Type": "text/event-stream; charset=utf-8",
  "Cache-Control": "no-cache, no-transform",
  Connection: "keep-alive",
  "X-Accel-Buffering": "no",
} as const;
