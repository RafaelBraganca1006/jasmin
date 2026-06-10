import type {
  TussSearchResult,
  TussEntry,
  RuleSearchResult,
  AutorizacaoResult,
} from "@/lib/types-cobranca";
import { TUSS_LOOKUP } from "@/lib/cobranca-knowledge/tuss-lookup";

/**
 * Interface de recuperação (retriever) que o agente de cobrança consome.
 *
 * Em operação normal fala por HTTP com o RAG server (scripts/rag_server.py,
 * porta 8001) — ChromaDB + embeddings dos documentos reais da knowledge_base/.
 * Se o servidor estiver fora do ar, cai graciosamente para o lookup estático
 * (tuss-lookup.ts) com um warning. O agente NÃO sabe a diferença.
 *
 * Arquitetura (ver discussão): busca por NOME usa vetor (semântico); busca por
 * CÓDIGO exato usa filtro de metadata no Chroma (embeddings densos erram em
 * código alfanumérico). O parâmetro codigo_tuss aciona o caminho exato.
 */

const RAG_URL = process.env.RAG_SERVER_URL ?? "http://localhost:8001";
const TIMEOUT_MS = 4000;

interface RagHit {
  content: string;
  score: number;
  source: string;
  metadata?: Record<string, unknown>;
  collection?: string;
}

let ragDownLogged = false;
function warnRagDown(err: unknown) {
  if (!ragDownLogged) {
    console.warn(
      `RAG server unavailable, using fallback (${RAG_URL}): ${err instanceof Error ? err.message : err}`
    );
    ragDownLogged = true;
  }
}

async function postRag(
  path: string,
  body: Record<string, unknown>
): Promise<RagHit[] | null> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    const res = await fetch(`${RAG_URL}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    clearTimeout(t);
    if (!res.ok) return null;
    return (await res.json()) as RagHit[];
  } catch (err) {
    warnRagDown(err);
    return null;
  }
}

/** Extrai um código TUSS (8 dígitos) do texto de um hit do RAG. */
function extractCodigo(hit: RagHit): string {
  const fromMeta = hit.metadata?.codigo_tuss;
  if (typeof fromMeta === "string" && fromMeta.trim()) return fromMeta.trim();
  const m = hit.content?.match(/\b(\d{8})\b/);
  return m ? m[1] : "";
}

/** Descrição curta a partir do conteúdo do hit (1º campo "Descrição:" ou início). */
function extractDescricao(hit: RagHit): string {
  const desc = hit.content?.match(/Descri[çc][ãa]o[^:]*:\s*([^|]+)/i);
  if (desc) return desc[1].trim();
  const proc = hit.content?.match(/PROCEDIMENTO\s*[|:]\s*([^|]+)/i);
  if (proc) return proc[1].trim();
  return (hit.content ?? "").slice(0, 80).trim();
}

// ─────────────────────────────────────────────────────────────────────────────
// Busca de procedimentos TUSS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Busca códigos TUSS para uma descrição em linguagem natural (semântico).
 * Passe `codigo` para um lookup EXATO por código (filtro de metadata no RAG).
 * Fallback: lookup estático por sinônimos.
 */
export async function searchTuss(
  query: string,
  topK: number,
  codigo?: string
): Promise<TussSearchResult[]> {
  const hits = await postRag("/search/tuss", {
    query: query || codigo || "",
    top_k: topK,
    codigo_tuss: codigo,
  });

  if (hits) {
    return hits
      .map((h) => ({
        codigo_tuss: extractCodigo(h),
        descricao: extractDescricao(h),
        score: h.score,
        fonte: "rag" as const,
        source: h.source,
      }))
      .filter((r) => r.codigo_tuss || r.descricao);
  }

  // Fallback estático.
  return fallbackSearchTuss(query || codigo || "", topK);
}

/** Busca de regras/legislação (collection dental_rules). Sem fallback útil. */
export async function searchRules(
  query: string,
  topK: number
): Promise<RuleSearchResult[]> {
  const hits = await postRag("/search/rules", { query, top_k: topK });
  if (!hits) return [];
  return hits.map((h) => ({
    content: h.content,
    score: h.score,
    source: h.source,
    collection: h.collection ?? "dental_rules",
  }));
}

// ─────────────────────────────────────────────────────────────────────────────
// Verificações de regra (autorização / documentação) — via RAG, com confiança
// ─────────────────────────────────────────────────────────────────────────────

const RE_SIM = /\b(sim|obrigat|exige|necess[áa]ri|requer|autoriza[çc][ãa]o\s*pr[ée]via)\b/i;
const RE_NAO = /\b(n[ãa]o|dispensa|isent)\b/i;

/**
 * Determina se um procedimento exige autorização prévia, consultando o RAG por
 * código e por regra. A confiança vem do score do RAG (>0.8 alta, 0.6-0.8 média,
 * <0.6 baixa → o agente gera alerta para o dentista verificar).
 */
export async function checkAutorizacaoPrevia(
  codigo_tuss: string,
  procedimento_descricao: string
): Promise<AutorizacaoResult> {
  const porCodigo = await searchTuss(procedimento_descricao, 3, codigo_tuss);
  const regras = await searchRules(
    `autorização prévia ${procedimento_descricao} ${codigo_tuss}`,
    3
  );

  const ragHits = [...porCodigo.filter((h) => h.fonte === "rag"), ...regras];
  if (ragHits.length === 0) {
    // RAG fora do ar → fallback estático (flag genérico).
    const entry = getTussEntry(codigo_tuss);
    if (entry) {
      return { requer: entry.requer_autorizacao, fonte: "lookup", confianca: 0.5 };
    }
    return { requer: false, fonte: "indisponível", confianca: 0 };
  }

  const top = Math.max(...ragHits.map((h) => h.score));
  // Texto agregado dos melhores hits para inspecionar menção a autorização.
  const texto = [
    ...porCodigo.map((h) => h.descricao),
    ...regras.map((r) => r.content),
  ]
    .join(" \n ")
    .toLowerCase();

  const mencionaAuth = /autoriz/.test(texto);
  const requer = mencionaAuth ? RE_SIM.test(texto) && !/autoriza[çc][ãa]o[^.]{0,12}n[ãa]o/.test(texto) : false;
  const fonteHit = regras[0]?.source || "tabela TUSS (RAG)";

  return { requer, fonte: fonteHit, confianca: top };
}

/**
 * Documentos obrigatórios para um procedimento (RX inicial/final, laudo, etc.),
 * extraídos do conteúdo retornado pelo RAG. Fallback: lookup estático.
 */
export async function checkDocumentacaoObrigatoria(
  codigo_tuss: string,
  procedimento_descricao = ""
): Promise<string[]> {
  const hits = await searchTuss(
    `${procedimento_descricao} documentação RX laudo radiografia`,
    3,
    codigo_tuss
  );
  const ragHits = hits.filter((h) => h.fonte === "rag");

  if (ragHits.length === 0) {
    const entry = getTussEntry(codigo_tuss);
    return entry ? [...entry.documentacao_obrigatoria] : [];
  }

  // Varre o conteúdo por menções a documentos exigidos.
  const texto = (await rawTussContent(codigo_tuss, procedimento_descricao)).toLowerCase();
  const docs = new Set<string>();
  if (/rx\s*inicial|radiografia inicial|periapical inicial/.test(texto)) docs.add("raio-x inicial");
  if (/rx\s*final|radiografia final|periapical final/.test(texto)) docs.add("raio-x final");
  if (/\blaudo\b/.test(texto)) docs.add("laudo");
  if (/panor[âa]mic/.test(texto)) docs.add("radiografia panorâmica");
  if (/periapical/.test(texto) && docs.size === 0) docs.add("raio-x periapical");
  if (/periograma|sondagem/.test(texto)) docs.add("periograma / sondagem periodontal");
  return [...docs];
}

/** Conteúdo bruto do melhor hit por código (para varrer documentação). */
async function rawTussContent(codigo: string, descricao: string): Promise<string> {
  const hits = await postRag("/search/tuss", {
    query: descricao || codigo,
    top_k: 3,
    codigo_tuss: codigo,
  });
  if (!hits) return "";
  return hits.map((h) => h.content).join(" \n ");
}

// ─────────────────────────────────────────────────────────────────────────────
// Fallback estático (RAG indisponível)
// ─────────────────────────────────────────────────────────────────────────────

const norm = (s: string): string =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();

function scoreEntry(entry: TussEntry, queryNorm: string): number {
  let best = 0;
  for (const termo of [entry.descricao_oficial, ...entry.sinonimos]) {
    const t = norm(termo);
    if (!t) continue;
    if (queryNorm.includes(t) || t.includes(queryNorm)) {
      const especificidade = Math.min(1, t.length / 18);
      const cobertura = queryNorm === t ? 1 : 0.85;
      const s = 0.55 + 0.45 * especificidade * cobertura;
      if (s > best) best = s;
    }
  }
  return Math.min(1, best);
}

function fallbackSearchTuss(query: string, topK: number): TussSearchResult[] {
  const q = norm(query);
  if (!q) return [];
  const scored = TUSS_LOOKUP.map((entry) => ({
    codigo_tuss: entry.codigo_tuss,
    descricao: entry.descricao_oficial,
    score: scoreEntry(entry, q),
    fonte: "lookup" as const,
    source: "tabela local",
  })).filter((r) => r.score > 0);
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, Math.max(0, topK));
}

/** Acha a entrada estática por código (fallback). */
export function getTussEntry(codigo: string): TussEntry | null {
  const c = codigo.trim();
  return TUSS_LOOKUP.find((e) => e.codigo_tuss === c) ?? null;
}

/** True se o código existe na tabela estática de fallback. */
export function validateTussCode(codigo: string): boolean {
  return getTussEntry(codigo) !== null;
}
