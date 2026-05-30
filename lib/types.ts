/**
 * Estrutura do prontuário clínico gerado pela IA.
 * Segue o padrão SOAP (Subjetivo, Objetivo, Avaliação, Plano) usado pelo SUS,
 * com campos extras específicos de odontologia.
 *
 * Obs.: os nomes/ordem dos campos serão ajustados quando tivermos o DOM real
 * do SissOnline (prints da tela da consulta).
 */
export interface ProntuarioSOAP {
  /** S — queixa e história relatada pelo paciente */
  subjetivo: string;
  /** O — achados do exame clínico */
  objetivo: string;
  /** A — hipótese diagnóstica / avaliação */
  avaliacao: string;
  /** P — conduta, procedimentos, prescrições e orientações */
  plano: string;

  /** Resumo de 1 frase da queixa principal */
  queixaPrincipal: string;
  /** Dentes envolvidos em notação FDI (ex.: "46", "36") */
  dentesEnvolvidos: string[];
  /** Procedimentos mencionados/realizados */
  procedimentos: string[];
  /** Orientações dadas ao paciente */
  orientacoes: string;

  /** Tipos de dado pessoal detectados e removidos (LGPD), sem repetir o dado */
  alertasAnonimizacao: string[];
}

export interface ProcessResult {
  transcript: string;
  soap: ProntuarioSOAP;
}
