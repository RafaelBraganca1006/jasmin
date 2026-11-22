import { TUSS_INDEX } from "@/lib/tuss-data";

/**
 * Lista curta de candidatos TUSS (~110–140 linhas, ~3k tokens) para o consolidador
 * do agente de cobrança — substitui injetar a tabela inteira (~8k tokens) no
 * prompt. 100% local e determinística, baseada na tabela OFICIAL (TUSS_INDEX,
 * gerada do XLSX em knowledge_base/), então os códigos são sempre reais.
 */

const norm = (s: string): string =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

const STOP = new Set([
  "de", "da", "do", "das", "dos", "com", "sem", "em", "para", "por", "dente", "dental", "dentario",
  "uma", "um", "na", "no", "nas", "nos", "ao", "as", "os", "ou",
]);

/** Radical grosseiro (primeiros 5 chars) — casa "restauração/restaurar", "canais/canal". */
const tokens = (s: string): string[] =>
  norm(s)
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 3 && !STOP.has(w))
    .map((w) => (w.length > 5 ? w.slice(0, 5) : w));

interface Row {
  codigo: string;
  descricao: string;
  categoria: string;
  toks: Set<string>;
}

let ROWS: Row[] | null = null;
const rows = (): Row[] =>
  (ROWS ??= Object.entries(TUSS_INDEX).map(([codigo, e]) => ({
    codigo,
    descricao: e.descricao,
    categoria: e.categoria,
    toks: new Set(tokens(e.descricao)),
  })));

/** Categorias cobertas por inteiro em toda lista curta. */
const EVERYDAY = new Set(["Dentística e Clínica", "Endodontia", "Prevenção", "Periodontia", "Diagnóstico e Radiologia"]);

/** Itens que quase toda consulta pode precisar (consulta + radiografias). */
const BASE_CODES = ["81000030", "81000065", "81000049", "81000421", "81000375", "81000405"];

/** Gatilhos: se o texto clínico casa, inclui o grupo todo (são grupos pequenos). */
const GROUPS: { re: RegExp; match: (r: Row) => boolean }[] = [
  { re: /canal|endod|pulp|obtur|instrument|odontometr|curativo/i, match: (r) => r.categoria === "Endodontia" || /curativo de demora/i.test(r.descricao) },
  { re: /restaur|resina|amalg|ionomer|cari/i, match: (r) => /^Restaura[çc][ãa]o (em resina|de am[áa]lgama|em ion[ôo]mero|atraum)/i.test(r.descricao) },
  { re: /exodont|extra[çc]|sutura|cirurg|raiz residual|siso|incluso|impactad/i, match: (r) => /^Exodontia|^Remo[çc][ãa]o de dentes/i.test(r.descricao) },
  { re: /raspagem|gengiv|periodont|t[áa]rtaro|profilaxia|polimento|fl[úu]or|selante|limpeza/i, match: (r) => r.categoria === "Periodontia" || r.categoria === "Prevenção" },
  { re: /clareament/i, match: (r) => /clareament/i.test(r.descricao) },
  { re: /coroa|pr[óo]tese|n[úu]cleo|pino|faceta/i, match: (r) => /^Coroa total|^N[úu]cleo|^Pino|^Faceta/i.test(r.descricao) },
];

export interface ShortlistInput {
  /** Etapas clínicas realizadas (procedimentos_realizados). */
  procedimentos: string[];
  /** Texto de contexto extra (diagnóstico, laudo, exame) — ajuda a ativar grupos. */
  contexto?: string;
  /** Códigos sugeridos por outras fontes (ex.: RAG). Só entram se existirem na tabela oficial. */
  extraCodes?: string[];
  /** Máximo de linhas na lista (default 140). */
  max?: number;
}

export interface TussCandidate {
  codigo: string;
  descricao: string;
}

export function buildTussShortlist({ procedimentos, contexto = "", extraCodes = [], max = 140 }: ShortlistInput): TussCandidate[] {
  const chosen = new Map<string, TussCandidate>();
  const add = (r: Row | undefined) => {
    if (r && !chosen.has(r.codigo)) chosen.set(r.codigo, { codigo: r.codigo, descricao: r.descricao });
  };
  const all = rows();
  const byCode = new Map(all.map((r) => [r.codigo, r]));

  // 1) Candidatos do RAG (já validados contra a tabela oficial).
  for (const c of extraCodes) add(byCode.get(c));

  // 2) Melhor casamento por palavras, por etapa clínica.
  for (const proc of procedimentos) {
    const q = new Set(tokens(proc));
    if (!q.size) continue;
    const scored = all
      .map((r) => {
        let hit = 0;
        for (const t of q) if (r.toks.has(t)) hit++;
        return { r, score: hit / Math.sqrt(r.toks.size || 1) };
      })
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 6);
    for (const x of scored) add(x.r);
  }

  // 2b) Categorias do dia a dia entram SEMPRE por inteiro (~107 códigos, ~2,5k
  // tokens): o erro silencioso "o código certo ficou de fora" não pode acontecer
  // nos procedimentos comuns. Só as categorias raras dependem do casamento.
  for (const r of all) if (EVERYDAY.has(r.categoria)) add(r);

  // 3) Grupos temáticos acionados pelo texto clínico (grupos pequenos, inteiros).
  const texto = `${procedimentos.join(" ; ")} ; ${contexto}`;
  for (const g of GROUPS) {
    if (g.re.test(texto)) for (const r of all) if (g.match(r)) add(r);
  }

  // 4) Itens-base (consulta e radiografias).
  for (const c of BASE_CODES) add(byCode.get(c));

  return [...chosen.values()].slice(0, max);
}

/** Formata a lista como linhas "codigo | descricao" para o prompt. */
export function formatShortlist(list: TussCandidate[]): string {
  return list.map((c) => `${c.codigo} | ${c.descricao}`).join("\n");
}

/**
 * Busca simples por palavras na tabela oficial — fallback de `searchTuss` quando
 * o RAG está fora. Devolve os melhores candidatos com score 0–1.
 */
export function searchOfficialTuss(query: string, topK: number): { codigo: string; descricao: string; score: number }[] {
  const q = new Set(tokens(query));
  if (!q.size) return [];
  return rows()
    .map((r) => {
      let hit = 0;
      for (const t of q) if (r.toks.has(t)) hit++;
      const cobertura = hit / q.size; // quanto da consulta foi coberto
      const precisao = hit / (r.toks.size || 1); // quanto da descrição foi usado
      return { codigo: r.codigo, descricao: r.descricao, score: Math.min(1, 0.7 * cobertura + 0.3 * precisao) * (hit ? 1 : 0) };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.max(0, topK));
}
