import type { AgAppointment, PatientData } from "@/lib/types-jasmin";
import type { ProntuarioModel } from "@/lib/types-prontuario";
import { procedimentosRealizados } from "@/lib/types-prontuario";
import type { CobrancaModel, CobrancaStatus } from "@/lib/types-cobranca";
import { getAllProntuarios } from "@/lib/prontuario-storage";
import { getAllCobrancas } from "@/lib/cobranca-storage";
import { guiaTotal } from "@/lib/cobranca-format";
import { toDateKey } from "@/lib/agenda-utils";

/**
 * Visão 360° do paciente: agrega prontuários, agenda e cobranças numa só estrutura
 * (alertas clínicos, indicadores, resumo clínico e linha do tempo). Lê o
 * localStorage UMA vez para todos os pacientes — serve a lista (sinalizadores,
 * contagem das visões) e a ficha (aba Visão Geral).
 */

export type Tone = "green" | "red" | "amber" | "blue" | "gray";

export interface TimelineItem {
  key: string;
  kind: "consulta" | "agendada" | "guia";
  /** "YYYY-MM-DD" (ordenação e exibição). */
  date: string;
  sortKey: string;
  title: string;
  subtitle?: string;
  chips: { label: string; tone: Tone }[];
  appointment?: AgAppointment;
}

export interface Financeiro {
  nGuias: number;
  /** Guias aguardando revisão/aprovação do dentista. */
  nRevisar: number;
  nGlosadas: number;
  /** Consultas com prontuário e convênio, mas sem guia gerada. */
  nSemGuia: number;
  aReceber: number;
  recebido: number;
  glosado: number;
}

export interface PatientOverview {
  alergias: string[];
  medicamentos: string[];
  comorbidades: string;
  alertasClinicos: string[];
  temProntuario: boolean;
  realizadas: number;
  semProntuario: number;
  ultimaData: string | null;
  proxima: AgAppointment | null;
  diagnostico: { cid: string; descricao: string; dente: string } | null;
  queixa: string;
  procedimentosRecentes: string[];
  continuidade: string;
  financeiro: Financeiro;
  upcoming: TimelineItem[];
  history: TimelineItem[];
}

const STATUS_LABEL: Record<CobrancaStatus, { label: string; tone: Tone }> = {
  nao_gerada: { label: "Não gerada", tone: "gray" },
  gerada: { label: "Gerada", tone: "gray" },
  revisao_pendente: { label: "Revisão pendente", tone: "amber" },
  aprovada: { label: "Aprovada", tone: "blue" },
  enviada: { label: "Enviada ao convênio", tone: "blue" },
  paga: { label: "Paga", tone: "green" },
  glosada: { label: "Glosada", tone: "red" },
};

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const startKey = (a: AgAppointment) => `${a.date} ${String(a.startH).padStart(2, "0")}:${String(a.startM).padStart(2, "0")}`;
const uniq = (l: string[]) => {
  const seen = new Set<string>();
  return l.map((s) => s.trim()).filter((s) => s && !seen.has(s.toLowerCase()) && seen.add(s.toLowerCase()));
};
/** Etapas "de apoio" que não representam o procedimento principal da consulta. */
const APOIO = /radiograf|raio.?x|anestesi|exame cl[ií]nico|sutura|selamento|polimento/i;

export function buildPatientOverviews(
  patients: PatientData[],
  appointments: AgAppointment[]
): Record<string, PatientOverview> {
  const prontuarios = getAllProntuarios();
  const cobrancas = new Map<string, CobrancaModel>();
  for (const c of getAllCobrancas()) cobrancas.set(String(c.appointmentId), c);
  const todayKey = toDateKey(new Date());
  const out: Record<string, PatientOverview> = {};

  for (const p of patients) {
    const mine = appointments.filter((a) => a.patientId === p.id).sort((a, b) => startKey(b).localeCompare(startKey(a)));
    const realizadas: { apt: AgAppointment; model: ProntuarioModel }[] = [];
    let semProntuario = 0;
    const history: TimelineItem[] = [];
    const upcoming: TimelineItem[] = [];
    const fin: Financeiro = { nGuias: 0, nRevisar: 0, nGlosadas: 0, nSemGuia: 0, aReceber: 0, recebido: 0, glosado: 0 };

    for (const apt of mine) {
      const model = prontuarios[String(apt.id)];
      const feita = apt.date < todayKey || Boolean(model);
      const cob = cobrancas.get(String(apt.id));

      if (!feita) {
        upcoming.push({
          key: `a${apt.id}`,
          kind: "agendada",
          date: apt.date,
          sortKey: startKey(apt),
          title: `${apt.type || "Consulta"} agendada`,
          subtitle: `${String(apt.startH).padStart(2, "0")}:${String(apt.startM).padStart(2, "0")} – ${String(apt.endH).padStart(2, "0")}:${String(apt.endM).padStart(2, "0")}`,
          chips: [{ label: "Agendada", tone: "blue" }],
          appointment: apt,
        });
        continue;
      }

      if (model) {
        realizadas.push({ apt, model });
        const d = model.diagnostico;
        const procs = procedimentosRealizados(model.plano).filter((x) => !APOIO.test(x));
        const chips: { label: string; tone: Tone }[] = [];
        if (d?.cid_codigo) chips.push({ label: d.cid_codigo, tone: "gray" });
        chips.push(model.assinatura_pendente ? { label: "Aguardando assinatura", tone: "amber" } : { label: "Prontuário assinado", tone: "green" });
        history.push({
          key: `c${apt.id}`,
          kind: "consulta",
          date: apt.date,
          sortKey: startKey(apt),
          title: d?.cid_descricao ? `${apt.type || "Consulta"} — ${d.cid_descricao}${d.elemento_dental ? ` (dente ${d.elemento_dental})` : ""}` : apt.type || "Consulta",
          subtitle: (procs.length ? procs : procedimentosRealizados(model.plano)).slice(0, 3).join(" · ") || undefined,
          chips,
          appointment: apt,
        });
        if (p.convenio && !cob) fin.nSemGuia++;
      } else {
        semProntuario++;
        history.push({
          key: `c${apt.id}`,
          kind: "consulta",
          date: apt.date,
          sortKey: startKey(apt),
          title: `${apt.type || "Consulta"} — sem prontuário`,
          chips: [{ label: "Prontuário pendente", tone: "amber" }],
          appointment: apt,
        });
      }

      if (cob?.guia) {
        const total = guiaTotal(cob.guia);
        fin.nGuias++;
        if (cob.status === "revisao_pendente" || cob.status === "gerada") fin.nRevisar++;
        if (cob.status === "aprovada" || cob.status === "enviada") fin.aReceber += total;
        if (cob.status === "paga") fin.recebido += cob.valor_recebido ?? total;
        if (cob.status === "glosada") {
          fin.nGlosadas++;
          fin.glosado += total;
        }
        const when = (cob.baixa_em || cob.enviado_em || cob.aprovado_em || cob.gerado_em || apt.date).slice(0, 10);
        const st = STATUS_LABEL[cob.status];
        history.push({
          key: `g${apt.id}`,
          kind: "guia",
          date: when,
          sortKey: `${when} 99:98`,
          title: `Guia ${st.label.toLowerCase()}`,
          subtitle:
            cob.status === "glosada" && cob.glosa_motivo
              ? `${cob.guia.convenio} · ${brl(total)} · ${cob.glosa_motivo}`
              : `${cob.guia.convenio} · ${brl(cob.status === "paga" ? cob.valor_recebido ?? total : total)}`,
          chips: [{ label: st.label, tone: st.tone }],
          appointment: apt,
        });
      }
    }

    // ── clínico (do prontuário mais recente) ────────────────────────────────
    realizadas.sort((a, b) => startKey(b.apt).localeCompare(startKey(a.apt)));
    const ultima = realizadas[0]?.model;
    const firstOf = <T,>(pick: (m: ProntuarioModel) => T, empty: (v: T) => boolean): T | undefined => {
      for (const r of realizadas) {
        const v = pick(r.model);
        if (!empty(v)) return v;
      }
      return undefined;
    };
    const emptyStr = (s?: string) => !s || !s.trim();
    const emptyArr = (a?: string[]) => !a || a.length === 0;

    const alergias = uniq(realizadas.flatMap((r) => (r.model.anamnese.alergias ?? []).filter((a) => !/^nega/i.test(a.trim()))));
    const alertasClinicos = uniq(realizadas.flatMap((r) => r.model.alertas.alertas_clinicos ?? []));
    // O alerta "alergia a X" é redundante com os chips de alergia.
    const alertasSemAlergia = alertasClinicos.filter((a) => !/alergi/i.test(a));

    upcoming.sort((a, b) => a.sortKey.localeCompare(b.sortKey));
    history.sort((a, b) => b.sortKey.localeCompare(a.sortKey));

    out[p.id] = {
      alergias,
      medicamentos: uniq(firstOf((m) => m.anamnese.medicamentos ?? [], emptyArr) ?? []),
      comorbidades: firstOf((m) => m.anamnese.comorbidades ?? "", emptyStr) ?? "",
      alertasClinicos: alertasSemAlergia,
      temProntuario: realizadas.length > 0,
      realizadas: realizadas.length,
      semProntuario,
      ultimaData: realizadas[0]?.apt.date ?? null,
      proxima: upcoming[0]?.appointment ?? null,
      diagnostico: ultima?.diagnostico?.cid_codigo
        ? { cid: ultima.diagnostico.cid_codigo, descricao: ultima.diagnostico.cid_descricao, dente: ultima.diagnostico.elemento_dental }
        : null,
      queixa: ultima?.anamnese.queixa_principal ?? "",
      procedimentosRecentes: ultima ? procedimentosRealizados(ultima.plano).filter((x) => !APOIO.test(x)).slice(0, 4) : [],
      continuidade: ultima?.plano.proxima_consulta ?? "",
      financeiro: fin,
      upcoming,
      history,
    };
  }
  return out;
}

export const fmtBRLShort = brl;

/** "hoje", "ontem", "há 5 dias", "há 3 semanas", "há 2 meses". */
export function relativeDays(dateKey: string, now = new Date()): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const target = new Date(y, m - 1, d);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diff = Math.round((today.getTime() - target.getTime()) / 86_400_000);
  if (diff === 0) return "hoje";
  if (diff === 1) return "ontem";
  if (diff === -1) return "amanhã";
  if (diff < 0) return `em ${-diff} dias`;
  if (diff < 14) return `há ${diff} dias`;
  if (diff < 60) return `há ${Math.round(diff / 7)} semanas`;
  return `há ${Math.round(diff / 30)} meses`;
}
