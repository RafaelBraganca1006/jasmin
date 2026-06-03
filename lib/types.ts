export type SOAPFieldKey =
  | "subjetivo"
  | "objetivo"
  | "avaliacao"
  | "plano"
  | "queixaPrincipal"
  | "dentesEnvolvidos"
  | "procedimentos"
  | "orientacoes";

export interface ProntuarioSOAP {
  subjetivo: string;
  objetivo: string;
  avaliacao: string;
  plano: string;
  queixaPrincipal: string;
  dentesEnvolvidos: string[];
  procedimentos: string[];
  orientacoes: string;
  alertasAnonimizacao: string[];
  /** Fragmentos literais da transcrição que embasam cada campo — Linked Evidence */
  evidencias: Partial<Record<SOAPFieldKey, string[]>>;
}

export interface ProcessResult {
  transcript: string;
  soap: ProntuarioSOAP;
}
