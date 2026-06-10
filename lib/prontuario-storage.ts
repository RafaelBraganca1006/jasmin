import type {
  ProntuarioModel,
  FichaClinicaModel,
  CobrancaItem,
  OdontogramaModel,
  DenteModel,
  PatientSummary,
  ConsultaRef,
} from "@/lib/types-prontuario";
import { procedimentosRealizados } from "@/lib/types-prontuario";
import type { PatientData, AgAppointment } from "@/lib/types-jasmin";
import { prontuarioToMarkdown } from "@/lib/prontuario-markdown";

/**
 * Persistência do prontuário no localStorage, vinculada ao appointment.id.
 * (Camada 4 — decisão LGPD: nada de banco; dados clínicos ficam no browser.)
 *
 * Duas chaves:
 *  - jasmin_prontuarios     : Record<appointmentId, ProntuarioModel>  (JSON estruturado)
 *  - jasmin_prontuarios_md  : Record<appointmentId, string>           (Markdown derivado)
 *
 * O .md é gerado deterministicamente de prontuarioToMarkdown — nunca via LLM.
 */

const KEY_JSON = "jasmin_prontuarios";
const KEY_MD = "jasmin_prontuarios_md";
const KEY_TX = "jasmin_transcricoes";
const KEY_APPTS = "jasmin_appointments";
const KEY_OD = "jasmin_odontogramas";

type Id = string | number;
const k = (id: Id): string => String(id);

function readMap<T>(key: string): Record<string, T> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as Record<string, T>) : {};
  } catch {
    return {};
  }
}

function writeMap<T>(key: string, map: Record<string, T>): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(map));
  } catch {
    /* quota / serialização — ignora silenciosamente */
  }
}

/** Salva o ProntuarioModel (JSON) e o .md derivado para um agendamento. */
export function saveProntuario(appointmentId: Id, model: ProntuarioModel): void {
  const jsonMap = readMap<ProntuarioModel>(KEY_JSON);
  jsonMap[k(appointmentId)] = model;
  writeMap(KEY_JSON, jsonMap);

  const mdMap = readMap<string>(KEY_MD);
  mdMap[k(appointmentId)] = prontuarioToMarkdown(model);
  writeMap(KEY_MD, mdMap);
}

/**
 * Salva a transcrição da consulta (Linked Evidence depende dela para destacar
 * os fragmentos ao reabrir o prontuário). Fica numa chave separada — não entra
 * no ProntuarioModel nem no .md.
 */
export function saveTranscript(appointmentId: Id, transcript: string): void {
  const map = readMap<string>(KEY_TX);
  map[k(appointmentId)] = transcript;
  writeMap(KEY_TX, map);
}

/** Retorna a transcrição salva, ou "". */
export function getTranscript(appointmentId: Id): string {
  const map = readMap<string>(KEY_TX);
  return map[k(appointmentId)] ?? "";
}

/**
 * Apaga todo o dado clínico vinculado a um agendamento: o ProntuarioModel (JSON),
 * o .md derivado e a transcrição. Usado ao excluir uma consulta (LGPD: o dado
 * sai do browser de fato, sem registro órfão).
 */
export function deleteProntuario(appointmentId: Id): void {
  const id = k(appointmentId);
  for (const key of [KEY_JSON, KEY_MD, KEY_TX]) {
    const map = readMap<unknown>(key);
    if (id in map) {
      delete map[id];
      writeMap(key, map);
    }
  }
}

/** Retorna o ProntuarioModel salvo, ou null. */
export function getProntuario(appointmentId: Id): ProntuarioModel | null {
  const jsonMap = readMap<ProntuarioModel>(KEY_JSON);
  return jsonMap[k(appointmentId)] ?? null;
}

/** Retorna o Markdown salvo (uso futuro: agente de cobrança), ou "". */
export function getProntuarioMd(appointmentId: Id): string {
  const mdMap = readMap<string>(KEY_MD);
  return mdMap[k(appointmentId)] ?? "";
}

/** True se há prontuário salvo para o agendamento (ex.: badge na agenda). */
export function hasProntuario(appointmentId: Id): boolean {
  const jsonMap = readMap<ProntuarioModel>(KEY_JSON);
  return Boolean(jsonMap[k(appointmentId)]);
}

/**
 * Concatena os .md de uma lista de agendamentos (consultas anteriores do mesmo
 * paciente) para alimentar o passo 5 do agente. Ignora ids sem prontuário.
 */
export function getHistoricoMd(appointmentIds: Id[]): string {
  const mdMap = readMap<string>(KEY_MD);
  const blocos = appointmentIds
    .map((id) => mdMap[k(id)])
    .filter((s): s is string => Boolean(s));
  return blocos.join("\n\n---\n\n");
}

// ─────────────────────────────────────────────────────────────────────────────
// Agregações por paciente (Ficha Clínica, Cobranças, Odontograma)
// ─────────────────────────────────────────────────────────────────────────────

/** Subconjunto de AgAppointment que estas funções precisam. */
interface ApptRow {
  id: number | string;
  patientId: string;
  date: string;
  startH: number; startM: number; endH: number; endM: number;
}

function readAppointments(): ApptRow[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY_APPTS);
    const arr = raw ? (JSON.parse(raw) as ApptRow[]) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

const pad2 = (n: number) => String(n).padStart(2, "0");

interface ConsultaProntuario {
  appointmentId: string;
  date: string;
  startH: number; startM: number; endH: number; endM: number;
  model: ProntuarioModel;
}

/** Prontuários de um paciente ordenados da consulta mais recente para a mais antiga. */
function consultasComProntuario(patientId: string): ConsultaProntuario[] {
  const jsonMap = readMap<ProntuarioModel>(KEY_JSON);
  const appts = readAppointments();
  const out: ConsultaProntuario[] = [];
  for (const a of appts) {
    if (a.patientId !== patientId) continue;
    const model = jsonMap[k(a.id)];
    if (!model) continue;
    out.push({
      appointmentId: k(a.id),
      date: a.date,
      startH: a.startH, startM: a.startM, endH: a.endH, endM: a.endM,
      model,
    });
  }
  out.sort(
    (x, y) =>
      y.date.localeCompare(x.date) || y.startH - x.startH || y.startM - x.startM
  );
  return out;
}

/** Une listas removendo duplicatas (case-insensitive), preservando a 1ª grafia. */
function unionList(lists: string[][]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const list of lists) {
    for (const item of list) {
      const key = item.trim().toLowerCase();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      out.push(item.trim());
    }
  }
  return out;
}

const EMPTY_FICHA: FichaClinicaModel = {
  alergias: [], alertas_clinicos: [], comorbidades: "", medicamentos: [],
  historico_medico: "", habitos: "", queixa_principal: "",
  ultima_consulta_data: "", tem_prontuario: false,
};

/**
 * Ficha clínica = merge dos prontuários do paciente.
 * - alergias: union de todas as consultas (sem duplicatas)
 * - demais campos clínicos: do prontuário mais recente que tiver aquele campo preenchido
 */
export function getFichaClinica(patientId: string): FichaClinicaModel {
  const consultas = consultasComProntuario(patientId);
  if (consultas.length === 0) return { ...EMPTY_FICHA };

  const alergias = unionList(consultas.map((c) => c.model.anamnese.alergias ?? []));

  const recentField = <T,>(pick: (m: ProntuarioModel) => T, isEmpty: (v: T) => boolean): T | undefined => {
    for (const c of consultas) {
      const v = pick(c.model);
      if (!isEmpty(v)) return v;
    }
    return undefined;
  };

  const emptyStr = (s?: string) => !s || !s.trim();
  const emptyArr = (a?: string[]) => !a || a.length === 0;

  const queixaConsulta = consultas.find((c) => !emptyStr(c.model.anamnese.queixa_principal)) ?? consultas[0];

  return {
    alergias,
    alertas_clinicos: recentField((m) => m.alertas.alertas_clinicos ?? [], emptyArr) ?? [],
    comorbidades: recentField((m) => m.anamnese.comorbidades ?? "", emptyStr) ?? "",
    medicamentos: recentField((m) => m.anamnese.medicamentos ?? [], emptyArr) ?? [],
    historico_medico: recentField((m) => m.anamnese.historico_medico ?? "", emptyStr) ?? "",
    habitos: recentField((m) => m.anamnese.habitos ?? "", emptyStr) ?? "",
    queixa_principal: queixaConsulta.model.anamnese.queixa_principal ?? "",
    ultima_consulta_data: queixaConsulta.date,
    tem_prontuario: true,
  };
}

/** Consultas do paciente COM prontuário salvo, prontas para a aba Cobranças. */
export function getCobrancas(patientId: string): CobrancaItem[] {
  return consultasComProntuario(patientId).map((c) => ({
    appointmentId: c.appointmentId,
    data: c.date,
    horario: `${pad2(c.startH)}:${pad2(c.startM)} – ${pad2(c.endH)}:${pad2(c.endM)}`,
    procedimentos: procedimentosRealizados(c.model.plano),
    cid_codigo: c.model.diagnostico.cid_codigo ?? "",
    cid_descricao: c.model.diagnostico.cid_descricao ?? "",
    convenio: c.model.metadata_cobranca.convenio_nome ?? "",
  }));
}

/** Odontograma do agente (exame) do prontuário mais recente — para o botão de merge. */
export function getProntuarioOdontograma(patientId: string): DenteModel[] {
  const consultas = consultasComProntuario(patientId);
  for (const c of consultas) {
    const od = c.model.exame.odontograma ?? [];
    if (od.length) return od;
  }
  return [];
}

const EMPTY_ODONTOGRAMA: OdontogramaModel = { dentes: {}, ultima_atualizacao: "" };

/** Estado do odontograma do paciente (vazio = todos os dentes saudáveis). */
export function getOdontograma(patientId: string): OdontogramaModel {
  const map = readMap<OdontogramaModel>(KEY_OD);
  return map[patientId] ?? { ...EMPTY_ODONTOGRAMA };
}

export function saveOdontograma(patientId: string, model: OdontogramaModel): void {
  const map = readMap<OdontogramaModel>(KEY_OD);
  map[patientId] = model;
  writeMap(KEY_OD, map);
}

/** Apaga o odontograma persistido de um paciente (usado ao excluir o paciente). */
export function deleteOdontograma(patientId: string): void {
  const map = readMap<OdontogramaModel>(KEY_OD);
  if (patientId in map) {
    delete map[patientId];
    writeMap(KEY_OD, map);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Resumo do paciente (lista de pacientes)
// ─────────────────────────────────────────────────────────────────────────────

const todayKey = (): string => {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
};

const byDateDesc = (x: ApptRow, y: ApptRow) =>
  y.date.localeCompare(x.date) || y.startH - x.startH || y.startM - x.startM;
const byDateAsc = (x: ApptRow, y: ApptRow) =>
  x.date.localeCompare(y.date) || x.startH - y.startH || x.startM - y.startM;
const toRef = (a: ApptRow): ConsultaRef => ({
  appointmentId: k(a.id), date: a.date,
  startH: a.startH, startM: a.startM, endH: a.endH, endM: a.endM,
});

function summarizeOne(
  patientId: string,
  appts: ApptRow[],
  jsonMap: Record<string, ProntuarioModel>
): PatientSummary {
  const today = todayKey();
  const mine = appts.filter((a) => a.patientId === patientId);

  const futuras = mine.filter((a) => a.date >= today).sort(byDateAsc);
  const passadas = mine.filter((a) => a.date < today).sort(byDateDesc);
  const comProntuario = mine.filter((a) => jsonMap[k(a.id)]).sort(byDateDesc);

  let ultimoProcedimento = "";
  if (comProntuario.length) {
    const procs = procedimentosRealizados(jsonMap[k(comProntuario[0].id)].plano);
    ultimoProcedimento = procs[0] ?? "";
  }

  return {
    patientId,
    proximaConsulta: futuras[0] ? toRef(futuras[0]) : null,
    ultimaConsulta: passadas[0] ? toRef(passadas[0]) : null,
    ultimoProcedimento,
    temProntuario: comProntuario.length > 0,
  };
}

/**
 * Resumos de todos os pacientes que têm agendamento — lê jasmin_prontuarios
 * UMA vez. Recebe os appointments do estado vivo (consistente com a UI).
 * A lista usa esta versão (eficiente, sem N parses).
 */
export function getPatientSummaries(appointments: ApptRow[]): Record<string, PatientSummary> {
  const jsonMap = readMap<ProntuarioModel>(KEY_JSON);
  const ids = new Set<string>();
  for (const a of appointments) ids.add(a.patientId);
  const out: Record<string, PatientSummary> = {};
  for (const id of ids) out[id] = summarizeOne(id, appointments, jsonMap);
  return out;
}

/** Resumo de um paciente — self-contained (lê os stores). Uso pontual/externo. */
export function getPatientSummary(patientId: string): PatientSummary {
  const jsonMap = readMap<ProntuarioModel>(KEY_JSON);
  return summarizeOne(patientId, readAppointments(), jsonMap);
}

// ─────────────────────────────────────────────────────────────────────────────
// Leituras brutas dos stores vivos (chat: builders de contexto e snapshot).
// Uma leitura/parse por chave — eficiente o suficiente para montar o snapshot.
// ─────────────────────────────────────────────────────────────────────────────

const KEY_PATIENTS = "jasmin_patients";

/** Lista de pacientes (jasmin_patients), ou []. */
export function getPatients(): PatientData[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY_PATIENTS);
    const arr = raw ? (JSON.parse(raw) as PatientData[]) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

/** Lista de agendamentos (jasmin_appointments), ou []. */
export function getAppointments(): AgAppointment[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY_APPTS);
    const arr = raw ? (JSON.parse(raw) as AgAppointment[]) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

/** Mapa appointmentId → ProntuarioModel (jasmin_prontuarios). */
export function getAllProntuarios(): Record<string, ProntuarioModel> {
  return readMap<ProntuarioModel>(KEY_JSON);
}

/** Mapa appointmentId → markdown (jasmin_prontuarios_md). */
export function getAllProntuariosMd(): Record<string, string> {
  return readMap<string>(KEY_MD);
}
