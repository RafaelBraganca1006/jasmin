import { TUSS_CONTEXT_STRING, TUSS_INDEX, type TussDataEntry } from "@/lib/tuss-data";

/**
 * Acesso à tabela TUSS odontológica vigente para o pipeline.
 *
 * Os dados vêm de `lib/tuss-data.ts`, gerado em build-time por
 * `scripts/gen_tuss_context.py` a partir do XLSX em knowledge_base/ — então a
 * string já está "cacheada" como constante do módulo (lida uma vez no load,
 * nunca a cada chamada LLM). Regere com `npm run gen:tuss` se a tabela mudar.
 */

/** Bloco formatado (~370 linhas) para injetar no system prompt do Passo 4. */
export function buildTussContextString(): string {
  return TUSS_CONTEXT_STRING;
}

/** Descrição oficial + categoria de um código TUSS, ou null se não existir. */
export function getOfficialTuss(codigo: string): TussDataEntry | null {
  const c = (codigo ?? "").trim();
  return c && TUSS_INDEX[c] ? TUSS_INDEX[c] : null;
}

/** True se o código existe na tabela TUSS odontológica vigente. */
export function isKnownTussCode(codigo: string): boolean {
  return getOfficialTuss(codigo) !== null;
}

export { TUSS_INDEX };
export type { TussDataEntry };
