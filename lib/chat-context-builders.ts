"use client";

import {
  getProntuarioMd,
  getProntuario,
  getOdontograma,
  getPatients,
  getAppointments,
  getAllProntuarios,
} from "@/lib/prontuario-storage";
import type {
  ProntuarioModel,
  OdontogramaModel,
  DenteOdontogramaModel,
  SuperficieKey,
  CondicaoSuperficie,
  ToothLabel,
} from "@/lib/types-prontuario";
import { procedimentosRealizados } from "@/lib/types-prontuario";
import type { PatientData, AgAppointment } from "@/lib/types-jasmin";
import type { JasminChip } from "@/lib/chat-context";

/**
 * Geradores do markdownContent de cada tipo de chip. Rodam no cliente (leem o
 * localStorage) quando o dentista seleciona um elemento no modo seletor.
 * Cada builder devolve um JasminChip pronto, ou null se a fonte não existir.
 */

const pad2 = (n: number) => String(n).padStart(2, "0");
const fmtT = (h: number, m: number) => `${pad2(h)}:${pad2(m)}`;
const fmtDateBR = (iso: string): string => {
  const [y, m, d] = iso.split("-");
  return y && m && d ? `${d}/${m}/${y}` : iso;
};
const todayKey = (): string => {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
};

const calcAge = (iso: string): number | null => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return null;
  const t = new Date();
  let age = t.getFullYear() - y;
  if (t.getMonth() + 1 < m || (t.getMonth() + 1 === m && t.getDate() < d)) age--;
  return age >= 0 && age < 150 ? age : null;
};

const fullName = (p: PatientData) => `${p.nome} ${p.sobrenome}`.trim();
const nameOfAppt = (a: AgAppointment, patients: PatientData[]) => {
  const p = patients.find((x) => x.id === a.patientId);
  return p ? fullName(p) : a.patient;
};

/** Une listas removendo duplicatas (case-insensitive), preservando a 1ª grafia. */
function union(lists: string[][]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const list of lists) {
    for (const item of list ?? []) {
      const key = item.trim().toLowerCase();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      out.push(item.trim());
    }
  }
  return out;
}

/** Prontuários de um paciente (mais recente → mais antigo). */
function prontuariosDoPaciente(patientId: string): { appt: AgAppointment; model: ProntuarioModel }[] {
  const appts = getAppointments();
  const map = getAllProntuarios();
  const out: { appt: AgAppointment; model: ProntuarioModel }[] = [];
  for (const a of appts) {
    if (a.patientId !== patientId) continue;
    const model = map[String(a.id)];
    if (model) out.push({ appt: a, model });
  }
  out.sort(
    (x, y) =>
      y.appt.date.localeCompare(x.appt.date) ||
      y.appt.startH - x.appt.startH ||
      y.appt.startM - x.appt.startM
  );
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// Consulta
// ─────────────────────────────────────────────────────────────────────────────

export function buildConsultaMd(appointmentId: number | string): JasminChip | null {
  const appts = getAppointments();
  const apt = appts.find((a) => String(a.id) === String(appointmentId));
  if (!apt) return null;
  const patients = getPatients();
  const nome = nameOfAppt(apt, patients);

  const md = getProntuarioMd(appointmentId);
  let markdownContent: string;
  if (md && md.trim()) {
    markdownContent = md;
  } else {
    markdownContent = [
      `# Consulta ${fmtDateBR(apt.date)} — ${nome}`,
      ``,
      `Agendamento sem prontuário salvo.`,
      ``,
      `- Paciente: ${nome}`,
      `- Data: ${fmtDateBR(apt.date)}`,
      `- Horário: ${fmtT(apt.startH, apt.startM)} – ${fmtT(apt.endH, apt.endM)}`,
      `- Tipo: ${apt.type || "Consulta"}`,
    ].join("\n");
  }

  return {
    id: `consulta:${apt.id}`,
    type: "consulta",
    label: `Consulta ${fmtDateBR(apt.date)} — ${nome}`,
    markdownContent,
    metadata: { appointmentId: apt.id, patientId: apt.patientId, date: apt.date },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Paciente
// ─────────────────────────────────────────────────────────────────────────────

export function buildPatientMd(patientId: string): JasminChip | null {
  const patients = getPatients();
  const p = patients.find((x) => x.id === patientId);
  if (!p) return null;

  const nome = fullName(p);
  const idade = calcAge(p.dataNascimento);
  const consultas = prontuariosDoPaciente(patientId);
  const appts = getAppointments().filter((a) => a.patientId === patientId);

  // Alertas: union de alergias + alertas_clinicos de todos os prontuários.
  const alertas = union([
    ...consultas.map((c) => c.model.anamnese.alergias ?? []),
    ...consultas.map((c) => c.model.alertas.alertas_clinicos ?? []),
  ]);

  // Histórico consolidado.
  const medicamentos = union(consultas.map((c) => c.model.anamnese.medicamentos ?? []));
  const comorbidades = union(
    consultas.map((c) => (c.model.anamnese.comorbidades ? [c.model.anamnese.comorbidades] : []))
  );
  const habitos = consultas.find((c) => c.model.anamnese.habitos?.trim())?.model.anamnese.habitos ?? "—";

  // Últimas 10 consultas com prontuário.
  const historico = consultas.slice(0, 10).map((c) => {
    const d = c.model.diagnostico;
    const proc = procedimentosRealizados(c.model.plano)[0] ?? d.cid_descricao ?? "Consulta";
    const cid = d.cid_codigo ? ` (${d.cid_codigo})` : "";
    return `- ${fmtDateBR(c.appt.date)}: ${proc}${cid}`;
  });

  // Próxima consulta agendada.
  const today = todayKey();
  const futuras = appts
    .filter((a) => a.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date) || a.startH - b.startH || a.startM - b.startM);
  const prox = futuras[0]
    ? `${fmtDateBR(futuras[0].date)} às ${fmtT(futuras[0].startH, futuras[0].startM)}`
    : "Nenhuma agendada";

  const markdownContent = [
    `# Paciente — ${nome}`,
    ``,
    `## Identificação`,
    `Nome: ${nome} | CPF: ${p.cpf || "—"} | Data de nascimento: ${p.dataNascimento ? fmtDateBR(p.dataNascimento) : "—"} | Idade: ${idade != null ? `${idade} anos` : "—"} | Sexo: ${p.genero || "—"}`,
    `Convênio: ${p.convenio || "Particular"} | Carteirinha: ${p.carteirinha || "—"} | Telefone: ${p.telefone || "—"}`,
    ``,
    `## Alertas clínicos`,
    alertas.length ? alertas.map((a) => `- ${a}`).join("\n") : "Nenhum alerta registrado.",
    ``,
    `## Histórico médico consolidado`,
    `**Medicamentos em uso:** ${medicamentos.length ? medicamentos.join(", ") : "—"}`,
    `**Comorbidades:** ${comorbidades.length ? comorbidades.join(", ") : "—"}`,
    `**Hábitos:** ${habitos}`,
    ``,
    `## Histórico de consultas`,
    historico.length ? historico.join("\n") : "Nenhuma consulta com prontuário salvo.",
    ``,
    `## Próxima consulta agendada`,
    prox,
  ].join("\n");

  return {
    id: `paciente:${patientId}`,
    type: "paciente",
    label: `Paciente — ${nome}`,
    markdownContent,
    metadata: { patientId },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Odontograma
// ─────────────────────────────────────────────────────────────────────────────

const FACE_NOME: Record<SuperficieKey, string> = {
  O: "oclusal",
  M: "mesial",
  D: "distal",
  V: "vestibular",
  L: "lingual",
};
const COND_NOME: Record<CondicaoSuperficie, string> = {
  carie: "cárie",
  restauracao_resina: "restauração em resina",
  restauracao_amalgama: "restauração em amálgama",
  selante: "selante",
};
const LABEL_NOME: Record<ToothLabel, string> = {
  canal: "tratamento de canal",
  coroa: "coroa",
  implante: "implante",
  protese: "prótese",
};

const QUADRANTES: { titulo: string; dentes: number[] }[] = [
  { titulo: "Superior direito (18-11)", dentes: [18, 17, 16, 15, 14, 13, 12, 11] },
  { titulo: "Superior esquerdo (21-28)", dentes: [21, 22, 23, 24, 25, 26, 27, 28] },
  { titulo: "Inferior esquerdo (31-38)", dentes: [31, 32, 33, 34, 35, 36, 37, 38] },
  { titulo: "Inferior direito (41-48)", dentes: [41, 42, 43, 44, 45, 46, 47, 48] },
];

function descreveDente(t: DenteOdontogramaModel | undefined): string {
  if (!t) return "saudável";
  if (t.ausente) return "ausente";
  const partes: string[] = [];
  for (const [face, cond] of Object.entries(t.superficies) as [SuperficieKey, CondicaoSuperficie][]) {
    partes.push(`${COND_NOME[cond]} (${FACE_NOME[face]})`);
  }
  for (const l of t.labels) partes.push(LABEL_NOME[l]);
  if (t.observacao?.trim()) partes.push(t.observacao.trim());
  return partes.length ? partes.join(", ") : "saudável";
}

export function buildOdontogramaMd(patientId: string): JasminChip | null {
  const patients = getPatients();
  const p = patients.find((x) => x.id === patientId);
  if (!p) return null;
  const nome = fullName(p);
  const od: OdontogramaModel = getOdontograma(patientId);

  let comAchados = 0;
  let ausentes = 0;
  let restauracoes = 0;
  for (const t of Object.values(od.dentes)) {
    if (t.ausente) {
      ausentes++;
      comAchados++;
      continue;
    }
    const temAchado =
      Object.keys(t.superficies).length > 0 || t.labels.length > 0 || !!t.observacao?.trim();
    if (temAchado) comAchados++;
    for (const cond of Object.values(t.superficies)) {
      if (cond === "restauracao_resina" || cond === "restauracao_amalgama") restauracoes++;
    }
  }

  const quadrantesMd = QUADRANTES.map((q) => {
    const linhas = q.dentes.map((fdi) => `- Dente ${fdi}: ${descreveDente(od.dentes[fdi])}`);
    return `### ${q.titulo}\n${linhas.join("\n")}`;
  }).join("\n\n");

  const atualizacao = od.ultima_atualizacao
    ? fmtDateBR(od.ultima_atualizacao.slice(0, 10))
    : "—";

  const markdownContent = [
    `# Odontograma — ${nome}`,
    `Última atualização: ${atualizacao}`,
    ``,
    `## Achados por quadrante`,
    ``,
    quadrantesMd,
    ``,
    `## Resumo`,
    `${comAchados} dente(s) com achados. ${ausentes} ausente(s). ${restauracoes} restauração(ões).`,
  ].join("\n");

  return {
    id: `odontograma:${patientId}`,
    type: "odontograma",
    label: `Odontograma — ${nome}`,
    markdownContent,
    metadata: { patientId },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Agenda do dia
// ─────────────────────────────────────────────────────────────────────────────

export function buildAgendaDiaMd(): JasminChip {
  const today = todayKey();
  const patients = getPatients();
  const map = getAllProntuarios();
  const doDia = getAppointments()
    .filter((a) => a.date === today)
    .sort((a, b) => a.startH - b.startH || a.startM - b.startM);

  const d = new Date();
  const dataExtenso = (() => {
    const s = d.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
    return s.charAt(0).toUpperCase() + s.slice(1);
  })();

  const linhas = doDia.map((a) => {
    const nome = nameOfAppt(a, patients);
    const p = patients.find((x) => x.id === a.patientId);
    const temProntuario = !!map[String(a.id)];
    return [
      `${fmtT(a.startH, a.startM)} — ${nome} — ${a.type || "Consulta"}`,
      `  Prontuário: ${temProntuario ? "Salvo" : "Não gerado"}`,
      `  Convênio: ${p?.convenio || "Particular"}`,
    ].join("\n");
  });

  const markdownContent = [
    `# Agenda de hoje — ${dataExtenso}`,
    ``,
    linhas.length ? linhas.join("\n\n") : "Nenhuma consulta agendada para hoje.",
    ``,
    `Total: ${doDia.length} consulta(s) agendada(s)`,
  ].join("\n");

  return {
    id: `agenda_dia:${today}`,
    type: "agenda_dia",
    label: `Agenda de hoje — ${fmtDateBR(today)}`,
    markdownContent,
    metadata: { date: today },
  };
}
