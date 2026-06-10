/**
 * Tipos do prontuário estruturado (Camada 2/3/4).
 *
 * São independentes de `lib/types.ts` (ProntuarioSOAP segue intacto).
 * O ProntuarioModel é o produto final do pipeline de 5 passos do agente
 * e a unidade de persistência (JSON + .md) por agendamento.
 */

/** Um elemento dental do odontograma, em notação FDI. */
export interface DenteModel {
  /** Notação FDI, ex.: "46" */
  elemento: string;
  /** Estado clínico, ex.: "cárie oclusal profunda", "restaurado", "ausente" */
  status: string;
  observacao?: string;
}

/** Passo 1 — Anamnese. */
export interface AnamneseModel {
  queixa_principal: string;
  historico_medico?: string;
  medicamentos?: string[];
  alergias: string[];
  habitos?: string;
  comorbidades?: string;
}

/** Passo 2 — Exame clínico. */
export interface ExameModel {
  extraoral?: string;
  intraoral?: string;
  periodonto?: string;
  oclusao?: string;
  odontograma: DenteModel[];
  laudo_radiologico?: string;
}

/** Passo 3 — Diagnóstico e CID-10 odontológico (faixa K00–K14). */
export interface DiagnosticoModel {
  cid_codigo: string;
  cid_descricao: string;
  elemento_dental: string;
  confirmado_por_raio_x: boolean;
}

/**
 * Um procedimento FATURÁVEL ao convênio, consolidado pelo Passo 4 a partir das
 * etapas técnicas e da tabela TUSS no contexto do LLM.
 */
export interface ProcedimentoFaturavel {
  /** Código TUSS encontrado na tabela. "MANUAL" quando não encontrado com confiança. */
  codigo_tuss: string;
  /** Descrição oficial do procedimento TUSS. */
  descricao: string;
  /** Notação FDI do dente tratado, ou "". */
  elemento_dental: string;
  quantidade: number;
  /** Etapas técnicas de `procedimentos_realizados` consolidadas neste item. */
  inclui_etapas: string[];
  /** True quando o LLM não encontrou o código com confiança (revisão humana). */
  requer_revisao: boolean;
  /** Por que o LLM escolheu este código. */
  justificativa: string;
}

/** Passo 4 — Plano de tratamento e evolução. */
export interface PlanoModel {
  /**
   * O que o dentista fez tecnicamente, em linguagem clínica, sem interpretação.
   * Ex.: ["abertura coronária", "preparo QM", "pasta hidróxido cálcio", "Coltosol"].
   */
  procedimentos_realizados: string[];
  /** O que deve ir para a guia de cobrança — consolidado pelo LLM via tabela TUSS. */
  procedimentos_faturaveis: ProcedimentoFaturavel[];
  /**
   * @deprecated Campo legado (prontuários gerados antes da consolidação faturável).
   * Leia via `procedimentosRealizados(plano)` para compatibilidade.
   */
  procedimentos?: string[];
  materiais?: string;
  anestesia?: string;
  pos_operatorio?: string;
  proxima_consulta?: string;
}

/**
 * Lista de procedimentos realizados, com fallback ao campo legado `procedimentos`
 * (prontuários antigos). Use em qualquer leitor que antes lia `plano.procedimentos`.
 */
export function procedimentosRealizados(plano?: Partial<PlanoModel> | null): string[] {
  if (!plano) return [];
  if (plano.procedimentos_realizados?.length) return plano.procedimentos_realizados;
  return plano.procedimentos ?? [];
}

/** Passo 5 — Revisor de gaps e alertas clínicos. */
export interface AlertasModel {
  gaps: string[];
  alertas_clinicos: string[];
  inconsistencias: string[];
  requer_confirmacao: boolean;
}

/** Metadados para o futuro agente de cobrança (derivados deterministicamente). */
export interface MetadataCobranca {
  convenio_nome?: string;
  carteirinha?: string;
  raio_x_realizado: boolean;
  raio_x_inicial_final?: boolean;
  sessoes_realizadas: number;
  requer_autorizacao_previa: boolean;
}

/** Cabeçalho de identificação do prontuário. */
export interface IdentificacaoModel {
  nome_paciente: string;
  convenio: string;
  carteirinha: string;
  dentista: string;
  cro: string;
  /** "YYYY-MM-DD" ou rótulo de exibição */
  data: string;
}

/**
 * Linked Evidence: mapa de campo → fragmentos literais da transcrição.
 * As chaves seguem os nomes de campo de cada seção (ver EVIDENCE_LABELS no agente).
 */
export type EvidenciasProntuario = Record<string, string[]>;

/** Produto final do pipeline de 5 passos. */
export interface ProntuarioModel {
  identificacao: IdentificacaoModel;
  anamnese: AnamneseModel;
  exame: ExameModel;
  diagnostico: DiagnosticoModel;
  plano: PlanoModel;
  alertas: AlertasModel;
  metadata_cobranca: MetadataCobranca;
  assinatura_pendente: boolean;
  evidencias: EvidenciasProntuario;
}

/** Resultado de um passo do pipeline, com sinalização de falha parcial. */
export interface PassoResult<T> {
  ok: boolean;
  data: T;
  erro?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Ficha Clínica (aba do paciente) — agregado clínico vindo dos prontuários.
// A identificação/plano de saúde editáveis vêm do PatientData (jasmin_patients);
// este modelo cobre a metade clínica (merge das consultas).
// ─────────────────────────────────────────────────────────────────────────────
export interface FichaClinicaModel {
  alergias: string[];
  alertas_clinicos: string[];
  comorbidades: string;
  medicamentos: string[];
  historico_medico: string;
  habitos: string;
  /** Queixa principal da consulta mais recente. */
  queixa_principal: string;
  /** Data (YYYY-MM-DD) da consulta de onde veio a queixa/clínica. */
  ultima_consulta_data: string;
  tem_prontuario: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Cobranças (aba do paciente) — placeholder inteligente por consulta.
// ─────────────────────────────────────────────────────────────────────────────
export interface CobrancaItem {
  appointmentId: string;
  /** "YYYY-MM-DD" */
  data: string;
  /** "09:00 – 10:00" */
  horario: string;
  procedimentos: string[];
  cid_codigo: string;
  cid_descricao: string;
  convenio: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Odontograma (aba do paciente) — estado visual persistido por paciente.
// ─────────────────────────────────────────────────────────────────────────────
export type SuperficieKey = "O" | "M" | "D" | "V" | "L";
export type CondicaoSuperficie =
  | "carie"
  | "restauracao_resina"
  | "restauracao_amalgama"
  | "selante";
export type ToothLabel = "coroa" | "implante" | "canal" | "protese";

export interface DenteOdontogramaModel {
  superficies: Partial<Record<SuperficieKey, CondicaoSuperficie>>;
  labels: ToothLabel[];
  ausente: boolean;
  observacao?: string;
}

export interface OdontogramaModel {
  /** chave = número FDI do dente (ex.: 36) */
  dentes: Record<number, DenteOdontogramaModel>;
  /** ISO date da última atualização */
  ultima_atualizacao: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Resumo do paciente (lista de pacientes) — dados DERIVADOS de agendamentos +
// prontuários. A identidade (nome, idade, sexo, convênio, status) vem do
// PatientData vivo; aqui ficam só os campos agregados.
// ─────────────────────────────────────────────────────────────────────────────
export interface ConsultaRef {
  appointmentId: string;
  date: string; // "YYYY-MM-DD"
  startH: number; startM: number; endH: number; endM: number;
}

export interface PatientSummary {
  patientId: string;
  /** 1º agendamento com data >= hoje (mais próximo). */
  proximaConsulta: ConsultaRef | null;
  /** Último agendamento com data < hoje. */
  ultimaConsulta: ConsultaRef | null;
  /** plano.procedimentos[0] do prontuário mais recente, "" se nenhum. */
  ultimoProcedimento: string;
  /** Tem ao menos um prontuário salvo (para o filtro "Sem prontuário"). */
  temProntuario: boolean;
}
