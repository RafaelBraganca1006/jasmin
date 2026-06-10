import type { DadosPrestador } from "@/lib/types-cobranca";

/**
 * Persistência dos dados do prestador (clínica + dentista) no localStorage.
 *
 * Solução TEMPORÁRIA enquanto não existe a tela de Configurações global.
 * Chave: jasmin_prestador — um único DadosPrestador.
 *
 * Nota: quando a tela de Configurações global for implementada, estes dados
 * migram para lá sem quebrar nada — basta a UI trocar a chave de leitura.
 * O agente de cobrança lê o DadosPrestador recebido no body da API.
 */

const KEY = "jasmin_prestador";

export const DEFAULT_PRESTADOR: DadosPrestador = {
  clinica_nome: "",
  clinica_cnpj: "",
  dentista_nome: "Dr. Usuário",
  dentista_cro: "",
  codigo_operadora_unimed: "",
  codigo_operadora_amil: "",
  codigo_operadora_bradesco: "",
};

/** Lê os dados do prestador, com defaults para campos ausentes. SSR-safe. */
export function getPrestador(): DadosPrestador {
  if (typeof window === "undefined") return { ...DEFAULT_PRESTADOR };
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT_PRESTADOR };
    const parsed = JSON.parse(raw) as Partial<DadosPrestador>;
    return { ...DEFAULT_PRESTADOR, ...parsed };
  } catch {
    return { ...DEFAULT_PRESTADOR };
  }
}

/** Salva os dados do prestador. */
export function savePrestador(dados: DadosPrestador): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(dados));
  } catch {
    /* quota — ignora */
  }
}
