/**
 * Tipos do Agente de Cobrança (Camada 5).
 *
 * Independentes de types-prontuario.ts — nada aqui altera os tipos do prontuário.
 * A unidade de saída do agente é a GuiaSPSADT (guia TISS SP/SADT odontológica);
 * a unidade de persistência por agendamento é o CobrancaModel.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Procedimentos e alertas
// ─────────────────────────────────────────────────────────────────────────────

/** Origem do mapeamento do código TUSS — rastreia COMO o código foi encontrado. */
export type FonteProcedimento = "prontuario" | "rag" | "lookup" | "manual";

/** Um procedimento da guia, já mapeado para TUSS. */
export interface ProcedimentoGuia {
  codigo_tuss: string;
  descricao: string;
  quantidade: number;
  /** Notação FDI, ex.: "36". "" quando não aplicável. */
  elemento_dental: string;
  valor_unitario?: number;
  /**
   * Como o código foi encontrado:
   *  - "prontuario" quando já veio consolidado pelo Passo 4 (mais confiável);
   *  - "rag"        quando o RAG (ChromaDB) escolheu o código;
   *  - "lookup"     quando veio da tabela estática de sinônimos;
   *  - "manual"     quando não foi possível mapear (exige revisão humana).
   */
  fonte: FonteProcedimento;
}

/** Severidade + alvo de um risco de glosa detectado pelo agente. */
export interface AlertaGlosa {
  tipo: "critico" | "atencao" | "info";
  /** Qual campo/área gerou o alerta (ex.: "procedimentos", "cid", "autorizacao"). */
  campo: string;
  mensagem: string;
  acao_recomendada: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Guia TISS SP/SADT
// ─────────────────────────────────────────────────────────────────────────────

export interface GuiaSPSADT {
  // Dados do prestador
  clinica_nome: string;
  clinica_cnpj: string;
  dentista_nome: string;
  dentista_cro: string;
  codigo_operadora: string;

  // Dados do beneficiário
  paciente_nome: string;
  carteirinha: string;
  convenio: string;
  plano?: string;

  // Dados do atendimento
  data_realizacao: string;
  tipo_atendimento: "consulta" | "procedimento" | "urgencia";
  numero_autorizacao?: string;
  requer_autorizacao: boolean;
  requer_autorizacao_motivo?: string;

  // Procedimentos
  procedimentos: ProcedimentoGuia[];

  // Diagnóstico
  cid_codigo: string;
  cid_descricao: string;
  indicacao_clinica: string;

  // Output do agente
  alertas_glosa: AlertaGlosa[];
  documentacao_obrigatoria: string[];
  /** Lista das regras do convênio que foram verificadas. */
  convenio_regras_aplicadas: string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Persistência
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Ciclo de vida da cobrança:
 *   nao_gerada → revisao_pendente → aprovada → enviada → paga | glosada
 * Uma guia `glosada` pode voltar a `revisao_pendente` (contestar).
 * ("gerada" é legado — mantido por compatibilidade com dados antigos.)
 */
export type CobrancaStatus =
  | "nao_gerada"
  | "gerada"
  | "revisao_pendente"
  | "aprovada"
  | "enviada"
  | "paga"
  | "glosada";

export interface CobrancaModel {
  appointmentId: number;
  patientId: string;
  status: CobrancaStatus;
  guia?: GuiaSPSADT;
  /** ISO timestamp da geração. */
  gerado_em?: string;
  /** ISO timestamp da aprovação manual. */
  aprovado_em?: string;
  /** ISO timestamp do envio ao convênio. */
  enviado_em?: string;
  /** ISO timestamp da baixa (paga ou glosada). */
  baixa_em?: string;
  /** Valor efetivamente recebido (quando paga). */
  valor_recebido?: number;
  /** Motivo da glosa (quando glosada). */
  glosa_motivo?: string;
  /** Trace das consultas ao RAG durante a geração (mostrado/colapsável na UI). */
  trace?: TraceEvent[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Trace do agente — eventos em tempo real mostrados ao dentista durante a
// geração da guia (via SSE). Linguagem simples, sem jargão técnico na mensagem.
// ─────────────────────────────────────────────────────────────────────────────

export type TraceTipo = "search" | "result" | "decision" | "warning";

export interface TraceEvent {
  timestamp: string;
  tipo: TraceTipo;
  /** Texto legível pelo dentista. */
  mensagem: string;
  /** Dados técnicos opcionais (query, source, score, página...). */
  detalhes?: Record<string, unknown>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Dados do prestador (jasmin_prestador) — origem temporária dos dados da clínica.
// Migra para a tela de Configurações global quando ela existir (só troca a chave).
// ─────────────────────────────────────────────────────────────────────────────

export interface DadosPrestador {
  clinica_nome: string;
  clinica_cnpj: string;
  dentista_nome: string;
  dentista_cro: string;
  codigo_operadora_unimed?: string;
  codigo_operadora_amil?: string;
  codigo_operadora_bradesco?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Knowledge base — tipos das tabelas estáticas e da interface RAG.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Uma entrada da tabela TUSS estática.
 * FALLBACK ONLY — usada quando o RAG (scripts/rag_server.py) está indisponível.
 * Sem regras por convênio (essas não estão nas bases públicas): apenas um flag
 * genérico de autorização para degradar graciosamente.
 */
export interface TussEntry {
  codigo_tuss: string;
  descricao_oficial: string;
  /** Termos que o dentista usa na prática (alimenta o match fuzzy). */
  sinonimos: string[];
  categoria: string;
  /** Costuma exigir autorização prévia (genérico, não por convênio). */
  requer_autorizacao: boolean;
  documentacao_obrigatoria: string[];
}

/** Resultado de uma busca de procedimento TUSS (RAG ou fallback de lookup). */
export interface TussSearchResult {
  codigo_tuss: string;
  descricao: string;
  /** Relevância 0-1 (similaridade do RAG, ou score estimado do lookup). */
  score: number;
  fonte: "lookup" | "rag";
  /** Documento de origem (nome do arquivo no RAG; "tabela local" no fallback). */
  source?: string;
}

/** Resultado de uma busca de regra/legislação (collection dental_rules). */
export interface RuleSearchResult {
  content: string;
  score: number;
  source: string;
  collection: string;
}

/** Veredito sobre autorização prévia, com a confiança derivada do score RAG. */
export interface AutorizacaoResult {
  requer: boolean;
  fonte: string;
  /** 0-1; <0.6 = baixa confiança → gerar alerta para o dentista verificar. */
  confianca: number;
}
