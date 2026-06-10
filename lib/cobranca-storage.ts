import type { CobrancaModel, CobrancaStatus, GuiaSPSADT, TraceEvent } from "@/lib/types-cobranca";

/**
 * Persistência das cobranças no localStorage (Camada 5).
 *
 * Mesma decisão LGPD do prontuário: nada de banco, dado fica no browser.
 * Chave única: jasmin_cobrancas — Record<appointmentId, CobrancaModel>.
 *
 * Mesmo padrão SSR-safe (readMap/writeMap com guarda typeof window) de
 * prontuario-storage.ts. A UI hidrata com flag `hydrated` antes de ler.
 */

const KEY = "jasmin_cobrancas";

type Id = string | number;
const k = (id: Id): string => String(id);

function readMap(): Record<string, CobrancaModel> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Record<string, CobrancaModel>) : {};
  } catch {
    return {};
  }
}

function writeMap(map: Record<string, CobrancaModel>): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(map));
  } catch {
    /* quota / serialização — ignora silenciosamente */
  }
}

/**
 * Salva a guia gerada para um agendamento, marcando status "revisao_pendente".
 * Preserva patientId/aprovado_em se já existir um registro anterior.
 */
export function saveCobranca(
  appointmentId: Id,
  guia: GuiaSPSADT,
  patientId: string,
  trace?: TraceEvent[]
): CobrancaModel {
  const map = readMap();
  const anterior = map[k(appointmentId)];
  const model: CobrancaModel = {
    appointmentId: Number(appointmentId),
    patientId: patientId || anterior?.patientId || "",
    status: "revisao_pendente",
    guia,
    gerado_em: new Date().toISOString(),
    aprovado_em: undefined,
    trace: trace ?? anterior?.trace,
  };
  map[k(appointmentId)] = model;
  writeMap(map);
  return model;
}

/** Retorna a cobrança salva, ou null. */
export function getCobranca(appointmentId: Id): CobrancaModel | null {
  return readMap()[k(appointmentId)] ?? null;
}

/**
 * Atualiza o status e carimba a data do evento correspondente:
 *  - aprovada → aprovado_em
 *  - enviada  → enviado_em
 *  - paga/glosada → baixa_em
 * Extras opcionais: valor_recebido (paga) e glosa_motivo (glosada).
 */
export function updateCobrancaStatus(
  appointmentId: Id,
  status: CobrancaStatus,
  extras?: { valor_recebido?: number; glosa_motivo?: string }
): void {
  const map = readMap();
  const atual = map[k(appointmentId)];
  if (!atual) return;
  const now = new Date().toISOString();

  atual.status = status;
  if (status === "aprovada") atual.aprovado_em = now;
  if (status === "enviada") atual.enviado_em = now;
  if (status === "paga" || status === "glosada") atual.baixa_em = now;

  if (status === "paga") {
    atual.valor_recebido = extras?.valor_recebido;
    atual.glosa_motivo = undefined;
  }
  if (status === "glosada") {
    atual.glosa_motivo = extras?.glosa_motivo;
    atual.valor_recebido = undefined;
  }
  // Voltar a uma etapa anterior limpa a baixa.
  if (status === "revisao_pendente" || status === "aprovada") {
    atual.baixa_em = undefined;
    atual.valor_recebido = undefined;
    atual.glosa_motivo = undefined;
  }

  map[k(appointmentId)] = atual;
  writeMap(map);
}

/**
 * Substitui a guia (após edição manual) e recalcula o score. Mantém o trace.
 * Se a guia estava aprovada/enviada, volta para "revisao_pendente" — o snapshot
 * aprovado mudou e precisa de nova conferência.
 */
export function updateCobrancaGuia(appointmentId: Id, guia: GuiaSPSADT): CobrancaModel | null {
  const map = readMap();
  const atual = map[k(appointmentId)];
  if (!atual) return null;

  atual.guia = guia;
  if (atual.status === "aprovada" || atual.status === "enviada" || atual.status === "paga" || atual.status === "glosada") {
    atual.status = "revisao_pendente";
    atual.aprovado_em = undefined;
    atual.enviado_em = undefined;
    atual.baixa_em = undefined;
    atual.valor_recebido = undefined;
    atual.glosa_motivo = undefined;
  }
  map[k(appointmentId)] = atual;
  writeMap(map);
  return atual;
}

/** Apaga a cobrança de um agendamento (usado ao excluir a consulta). */
export function deleteCobranca(appointmentId: Id): void {
  const map = readMap();
  if (k(appointmentId) in map) {
    delete map[k(appointmentId)];
    writeMap(map);
  }
}

/** Todas as cobranças salvas. */
export function getAllCobrancas(): CobrancaModel[] {
  return Object.values(readMap());
}

/** Cobranças de um paciente. */
export function getCobrancasByPatient(patientId: string): CobrancaModel[] {
  return Object.values(readMap()).filter((c) => c.patientId === patientId);
}
