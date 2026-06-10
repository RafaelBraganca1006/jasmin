import { groq, MODELS } from "@/lib/groq";
import type { ProntuarioModel, ProcedimentoFaturavel } from "@/lib/types-prontuario";
import { procedimentosRealizados } from "@/lib/types-prontuario";
import { getOfficialTuss } from "@/lib/tuss-context";
import type {
  GuiaSPSADT,
  ProcedimentoGuia,
  AlertaGlosa,
  DadosPrestador,
  FonteProcedimento,
  TussSearchResult,
  TraceEvent,
} from "@/lib/types-cobranca";
import {
  searchTuss,
  getTussEntry,
  checkAutorizacaoPrevia,
  checkDocumentacaoObrigatoria,
} from "@/lib/cobranca-knowledge/rag-retriever";

/**
 * Agente de Cobrança (Camada 5) — pipeline de 4 nós sequenciais.
 *
 * Orquestração em TypeScript puro (sem LangGraph): os nós correm em sequência,
 * cada um isolado em try/catch. Falhas NUNCA interrompem o pipeline: o nó que
 * quebra deixa o campo incompleto e adiciona um alerta; o agente sempre devolve
 * uma GuiaSPSADT.
 *
 * Nós 1 e 2 usam Groq Llama (JSON mode). Nós 2 e 3 consultam o RAG
 * (rag-retriever → rag_server.py). O nó 4 é determinístico.
 *
 * Pipeline: 1 Parser · 2 TUSS Mapper · 3 Rules Checker (RAG) · 4 Builder.
 * A guia carrega alertas de glosa (informativos), não um score de risco.
 *
 * Trace: cada nó emite eventos legíveis pelo dentista (onTrace), transmitidos
 * em tempo real por SSE na rota /api/cobranca.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Trace
// ─────────────────────────────────────────────────────────────────────────────

export type EmitTrace = (ev: Omit<TraceEvent, "timestamp">) => void;

function makeEmit(onTrace?: (e: TraceEvent) => void): EmitTrace {
  return (ev) => {
    if (onTrace) onTrace({ ...ev, timestamp: new Date().toISOString() });
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers de normalização (mesmo estilo de prontuario-agent.ts)
// ─────────────────────────────────────────────────────────────────────────────

const str = (v: unknown): string => (typeof v === "string" ? v.trim() : "");
const arr = (v: unknown): string[] =>
  Array.isArray(v) ? v.map((x) => String(x).trim()).filter(Boolean) : [];
const bool = (v: unknown): boolean =>
  v === true || v === "true" || v === "sim" || v === "Sim";

const alerta = (
  tipo: AlertaGlosa["tipo"],
  campo: string,
  mensagem: string,
  acao_recomendada: string
): AlertaGlosa => ({ tipo, campo, mensagem, acao_recomendada });

// ─────────────────────────────────────────────────────────────────────────────
// Estado interno do pipeline (acumulado nó a nó)
// ─────────────────────────────────────────────────────────────────────────────

interface ParserOutput {
  procedimentos_realizados: string[];
  /**
   * Procedimentos já consolidados pelo Passo 4 (quando o prontuário é recente).
   * Quando presente, o Nó 2 usa direto (fonte "prontuario") em vez do RAG.
   * Vazio em prontuários antigos → fallback ao mapeamento por linguagem natural.
   */
  faturaveis: ProcedimentoFaturavel[];
  elemento_dental: string;
  convenio: string;
  data_atendimento: string;
  cid_codigo: string;
  cid_descricao: string;
  indicacao_clinica: string;
  requer_autorizacao_hint: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// NÓ 1 — Parser (LLM)
// ─────────────────────────────────────────────────────────────────────────────

const SYS_PARSER = `Você é um especialista em faturamento odontológico brasileiro (TISS/ANS).
Recebe um PRONTUÁRIO em Markdown e extrai os fatos necessários para faturar a consulta.

Extraia SOMENTE o que está escrito — NÃO infira o que não está no texto. Para o que faltar, use "" ou [] ou false.

Campos:
- procedimentos_realizados: array de procedimentos efetivamente realizados, em linguagem natural curta (ex.: ["tratamento de canal", "restauração de resina"]). [] se nenhum.
- elemento_dental: o dente principal em notação FDI (ex.: "36"), ou "".
- convenio: nome do convênio/plano do paciente, ou "".
- data_atendimento: data da consulta no formato YYYY-MM-DD, ou "".
- cid_codigo: o código CID-10 registrado (faixa K00–K14), ou "".
- cid_descricao: a descrição do CID, ou "".
- indicacao_clinica: justificativa clínica do tratamento em uma frase, ou "".
- requer_autorizacao_hint: true SOMENTE se o texto menciona explicitamente autorização/guia prévia; senão false.

Responda SOMENTE com JSON válido com exatamente essas chaves.`;

async function runParser(
  prontuarioMd: string,
  model: ProntuarioModel,
  emit: EmitTrace
): Promise<{ out: ParserOutput; alertas: AlertaGlosa[] }> {
  emit({ tipo: "decision", mensagem: "Lendo prontuário da consulta..." });

  // Fallback determinístico a partir do ProntuarioModel — usado se o LLM falhar.
  const fallback: ParserOutput = {
    procedimentos_realizados: procedimentosRealizados(model.plano),
    faturaveis: model.plano?.procedimentos_faturaveis ?? [],
    elemento_dental: model.diagnostico?.elemento_dental ?? "",
    convenio:
      model.identificacao?.convenio ||
      model.metadata_cobranca?.convenio_nome ||
      "",
    data_atendimento: model.identificacao?.data ?? "",
    cid_codigo: model.diagnostico?.cid_codigo ?? "",
    cid_descricao: model.diagnostico?.cid_descricao ?? "",
    indicacao_clinica: model.anamnese?.queixa_principal ?? "",
    requer_autorizacao_hint:
      model.metadata_cobranca?.requer_autorizacao_previa ?? false,
  };

  let out = fallback;
  let alertas: AlertaGlosa[] = [];
  try {
    const completion = await groq.chat.completions.create({
      model: MODELS.structuring,
      temperature: 0.1,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYS_PARSER },
        { role: "user", content: `Prontuário:\n\n${prontuarioMd}` },
      ],
    });
    const raw = JSON.parse(
      completion.choices[0]?.message?.content ?? "{}"
    ) as Record<string, unknown>;

    out = {
      procedimentos_realizados: arr(raw.procedimentos_realizados),
      // faturaveis vêm do JSON estruturado (Passo 4), não do parser de texto.
      faturaveis: fallback.faturaveis,
      elemento_dental: str(raw.elemento_dental),
      convenio: str(raw.convenio),
      data_atendimento: str(raw.data_atendimento),
      cid_codigo: str(raw.cid_codigo).toUpperCase(),
      cid_descricao: str(raw.cid_descricao),
      indicacao_clinica: str(raw.indicacao_clinica),
      requer_autorizacao_hint: bool(raw.requer_autorizacao_hint),
    };

    // Preenche buracos do LLM com o modelo estruturado (mais confiável).
    if (!out.procedimentos_realizados.length)
      out.procedimentos_realizados = fallback.procedimentos_realizados;
    if (!out.elemento_dental) out.elemento_dental = fallback.elemento_dental;
    if (!out.convenio) out.convenio = fallback.convenio;
    if (!out.data_atendimento) out.data_atendimento = fallback.data_atendimento;
    if (!out.cid_codigo) {
      out.cid_codigo = fallback.cid_codigo;
      out.cid_descricao = fallback.cid_descricao;
    }
    if (!out.indicacao_clinica) out.indicacao_clinica = fallback.indicacao_clinica;
  } catch (err) {
    const msg = err instanceof Error ? err.message : "erro desconhecido";
    alertas = [
      alerta(
        "atencao",
        "parser",
        `Não foi possível interpretar o prontuário automaticamente (${msg}). Usados os campos estruturados.`,
        "Revise os procedimentos e o diagnóstico antes de enviar a guia."
      ),
    ];
  }

  const procoLabel = out.procedimentos_realizados[0] ?? "procedimento";
  emit({
    tipo: "decision",
    mensagem: `Identificado: ${procoLabel}${out.elemento_dental ? ` no dente ${out.elemento_dental}` : ""}`,
  });
  emit({
    tipo: "decision",
    mensagem: `Convênio: ${out.convenio || "não informado"} | CID: ${out.cid_codigo || "—"}`,
  });

  return { out, alertas };
}

// ─────────────────────────────────────────────────────────────────────────────
// NÓ 2 — TUSS Mapper (RAG searchTuss + LLM escolhe o melhor candidato)
// ─────────────────────────────────────────────────────────────────────────────

const SCORE_MIN_ACEITAVEL = 0.4;
// Abaixo disto, mesmo com mapeamento, avisamos para revisar (baixa confiança).
const SCORE_BAIXA_CONFIANCA = 0.6;

const SYS_TUSS = `Você é um especialista em codificação TUSS odontológica.
Para cada procedimento descrito em linguagem natural, recebe uma lista de CANDIDATOS (código TUSS + descrição) e escolhe o ÚNICO mais adequado ao contexto clínico.

Regras:
- Escolha SEMPRE entre os candidatos fornecidos — nunca invente código.
- Se nenhum candidato representa bem o procedimento, devolva codigo_tuss: "" para aquele item.

Responda SOMENTE com JSON válido: { "escolhas": [ { "indice": <number>, "codigo_tuss": "<string>" } ] }
onde "indice" é a posição do procedimento na lista (começando em 0).`;

async function runTussMapper(
  procedimentos: string[],
  elementoDental: string,
  emit: EmitTrace
): Promise<{ procedimentos: ProcedimentoGuia[]; alertas: AlertaGlosa[] }> {
  const alertas: AlertaGlosa[] = [];

  if (!procedimentos.length) {
    alertas.push(
      alerta(
        "critico",
        "procedimentos",
        "Nenhum procedimento foi identificado no prontuário.",
        "Verifique o prontuário: uma guia sem procedimento será glosada."
      )
    );
    return { procedimentos: [], alertas };
  }

  // 1) Busca candidatos para cada procedimento (RAG; fallback p/ tabela local).
  const candidatosPorProc: TussSearchResult[][] = [];
  for (const proc of procedimentos) {
    emit({
      tipo: "search",
      mensagem: `Buscando código TUSS para: ${proc}`,
      detalhes: { query: proc, collection: "tuss_procedures" },
    });
    candidatosPorProc.push(await searchTuss(proc, 3));
  }

  // 2) LLM escolhe o melhor candidato de cada (1 chamada para todos).
  const escolhas = new Map<number, string>();
  const temCandidatos = candidatosPorProc.some((c) => c.length > 0);
  if (temCandidatos) {
    try {
      const listagem = procedimentos
        .map((proc, i) => {
          const cands = candidatosPorProc[i];
          const linhas = cands.length
            ? cands
                .map((c) => `   - ${c.codigo_tuss}: ${c.descricao} (score ${c.score.toFixed(2)})`)
                .join("\n")
            : "   - (nenhum candidato)";
          return `[${i}] "${proc}"\n${linhas}`;
        })
        .join("\n\n");

      const completion = await groq.chat.completions.create({
        model: MODELS.structuring,
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYS_TUSS },
          { role: "user", content: `Procedimentos e candidatos:\n\n${listagem}` },
        ],
      });
      const raw = JSON.parse(
        completion.choices[0]?.message?.content ?? "{}"
      ) as { escolhas?: Array<{ indice?: unknown; codigo_tuss?: unknown }> };
      for (const e of raw.escolhas ?? []) {
        const idx = typeof e.indice === "number" ? e.indice : Number(e.indice);
        const cod = str(e.codigo_tuss);
        if (Number.isInteger(idx) && idx >= 0) escolhas.set(idx, cod);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "erro desconhecido";
      alertas.push(
        alerta(
          "atencao",
          "procedimentos",
          `Mapeamento TUSS automático indisponível (${msg}). Usado o melhor candidato por relevância.`,
          "Confira cada código TUSS antes de enviar."
        )
      );
    }
  }

  // 3) Monta os ProcedimentoGuia, decidindo a fonte + emite resultado.
  const out: ProcedimentoGuia[] = procedimentos.map((proc, i) => {
    const cands = candidatosPorProc[i];
    const melhor = cands[0];
    const escolhaLLM = escolhas.get(i);
    const escolhido =
      (escolhaLLM && cands.find((c) => c.codigo_tuss === escolhaLLM)) || melhor;

    if (!escolhido || escolhido.score <= SCORE_MIN_ACEITAVEL || escolhaLLM === "") {
      emit({
        tipo: "warning",
        mensagem: `Não encontrei um código TUSS seguro para "${proc}". Revisar manualmente.`,
      });
      alertas.push(
        alerta(
          "atencao",
          "procedimentos",
          `Não foi possível mapear "${proc}" para um código TUSS com segurança.`,
          "Selecione o código TUSS manualmente para este procedimento."
        )
      );
      return {
        codigo_tuss: "",
        descricao: proc,
        quantidade: 1,
        elemento_dental: elementoDental,
        fonte: "manual" as FonteProcedimento,
      };
    }

    const entry = getTussEntry(escolhido.codigo_tuss);
    const descricao = entry?.descricao_oficial ?? escolhido.descricao;
    const fonte: FonteProcedimento = escolhido.fonte === "rag" ? "rag" : "lookup";

    emit({
      tipo: "result",
      mensagem: `Encontrado em ${escolhido.source ?? "tabela"}: ${escolhido.codigo_tuss} — ${descricao}`,
      detalhes: { score: escolhido.score, source: escolhido.source, fonte },
    });
    if (escolhido.score < SCORE_BAIXA_CONFIANCA) {
      emit({
        tipo: "warning",
        mensagem: "Confiança baixa no mapeamento. Revisar manualmente.",
        detalhes: { score: escolhido.score },
      });
    }

    return {
      codigo_tuss: escolhido.codigo_tuss,
      descricao,
      quantidade: 1,
      elemento_dental: elementoDental,
      fonte,
    };
  });

  return { procedimentos: out, alertas };
}

// ─────────────────────────────────────────────────────────────────────────────
// NÓ 2b — Faturáveis consolidados (Passo 4) → ProcedimentoGuia
//
// O Passo 4 já fez o trabalho pesado de consolidação clínica → faturável usando
// a tabela TUSS. Aqui usamos o código direto (fonte "prontuario", a mais
// confiável) e só caímos no RAG para itens MANUAL/requer_revisao.
// ─────────────────────────────────────────────────────────────────────────────

async function mapFaturaveis(
  faturaveis: ProcedimentoFaturavel[],
  elementoDental: string,
  emit: EmitTrace
): Promise<{ procedimentos: ProcedimentoGuia[]; alertas: AlertaGlosa[] }> {
  const alertas: AlertaGlosa[] = [];
  const out: ProcedimentoGuia[] = [];

  for (const f of faturaveis) {
    const dente = f.elemento_dental || elementoDental;
    const confiavel = f.codigo_tuss !== "MANUAL" && !f.requer_revisao;

    if (confiavel) {
      const oficial = getOfficialTuss(f.codigo_tuss);
      const descricao = oficial?.descricao ?? f.descricao;
      emit({
        tipo: "result",
        mensagem: `Consolidado pelo prontuário: ${f.codigo_tuss} — ${descricao}`,
        detalhes: { fonte: "prontuario", codigo: f.codigo_tuss },
      });
      out.push({
        codigo_tuss: f.codigo_tuss,
        descricao,
        quantidade: f.quantidade > 0 ? f.quantidade : 1,
        elemento_dental: dente,
        fonte: "prontuario" as FonteProcedimento,
      });
      continue;
    }

    // MANUAL / requer revisão → tenta o RAG como segunda opinião.
    const query = f.descricao || f.inclui_etapas.join(", ");
    emit({
      tipo: "search",
      mensagem: `Item marcado para revisão pelo agente. Buscando código TUSS para: ${query}`,
      detalhes: { query, collection: "tuss_procedures" },
    });
    const cands = query ? await searchTuss(query, 3) : [];
    const melhor = cands[0];

    if (melhor && melhor.score > SCORE_MIN_ACEITAVEL) {
      const entry = getTussEntry(melhor.codigo_tuss);
      const descricao = entry?.descricao_oficial ?? melhor.descricao;
      const fonte: FonteProcedimento = melhor.fonte === "rag" ? "rag" : "lookup";
      emit({
        tipo: "result",
        mensagem: `Encontrado via RAG: ${melhor.codigo_tuss} — ${descricao}`,
        detalhes: { score: melhor.score, source: melhor.source, fonte },
      });
      alertas.push(
        alerta(
          "atencao",
          "procedimentos",
          `"${query}" foi mapeado via RAG (${melhor.codigo_tuss}) — o agente do prontuário não tinha certeza.`,
          "Confirme o código TUSS deste procedimento antes de enviar."
        )
      );
      out.push({
        codigo_tuss: melhor.codigo_tuss,
        descricao,
        quantidade: f.quantidade > 0 ? f.quantidade : 1,
        elemento_dental: dente,
        fonte,
      });
    } else {
      emit({
        tipo: "warning",
        mensagem: `Não encontrei um código TUSS seguro para "${query || f.descricao}". Revisar manualmente.`,
      });
      alertas.push(
        alerta(
          "atencao",
          "procedimentos",
          `Não foi possível mapear "${query || f.descricao}" para um código TUSS com segurança.`,
          "Selecione o código TUSS manualmente para este procedimento."
        )
      );
      out.push({
        codigo_tuss: "",
        descricao: f.descricao || query,
        quantidade: f.quantidade > 0 ? f.quantidade : 1,
        elemento_dental: dente,
        fonte: "manual" as FonteProcedimento,
      });
    }
  }

  return { procedimentos: out, alertas };
}

// ─────────────────────────────────────────────────────────────────────────────
// NÓ 3 — Rules Checker (RAG: autorização + documentação a partir das tabelas TUSS
// e da legislação indexadas). Regras POR CONVÊNIO não estão nas bases públicas →
// sempre emite alerta genérico para o dentista confirmar com o convênio.
// ─────────────────────────────────────────────────────────────────────────────

interface RulesOutput {
  requer_autorizacao: boolean;
  requer_autorizacao_motivo?: string;
  documentacao_obrigatoria: string[];
  convenio_regras_aplicadas: string[];
  alertas: AlertaGlosa[];
}

async function runRulesChecker(
  convenio: string,
  procedimentos: ProcedimentoGuia[],
  raioXRealizado: boolean,
  emit: EmitTrace
): Promise<RulesOutput> {
  const alertas: AlertaGlosa[] = [];
  const regrasAplicadas: string[] = [];
  const docSet = new Set<string>();
  let requerAutorizacao = false;
  const motivos: string[] = [];

  for (const p of procedimentos) {
    if (!p.codigo_tuss) continue;

    // Autorização prévia (via RAG).
    emit({
      tipo: "search",
      mensagem: `Consultando regras de autorização para ${p.descricao}`,
      detalhes: { query: `autorização prévia ${p.descricao}`, collection: "dental_rules" },
    });
    const auth = await checkAutorizacaoPrevia(p.codigo_tuss, p.descricao);
    emit({
      tipo: "result",
      mensagem: `Fonte: ${auth.fonte}${auth.requer ? " — autorização prévia exigida" : " — sem exigência clara"}`,
      detalhes: { source: auth.fonte, score: auth.confianca },
    });
    regrasAplicadas.push(
      `${p.codigo_tuss}: ${auth.requer ? "autorização prévia" : "sem autorização"} (fonte: ${auth.fonte})`
    );

    if (auth.requer) {
      requerAutorizacao = true;
      motivos.push(`${p.descricao} (${p.codigo_tuss})`);
    }
    if (auth.confianca > 0 && auth.confianca < 0.6) {
      emit({
        tipo: "warning",
        mensagem: `Confiança baixa na regra de autorização de ${p.descricao}. Confirmar.`,
        detalhes: { score: auth.confianca },
      });
      alertas.push(
        alerta(
          "atencao",
          "autorizacao",
          `Regra de autorização de ${p.descricao} (${p.codigo_tuss}) encontrada com baixa confiança.`,
          "Confirme a exigência de autorização diretamente na tabela do convênio."
        )
      );
    }

    // Documentação obrigatória (via RAG).
    emit({ tipo: "search", mensagem: "Verificando documentação obrigatória..." });
    const docs = await checkDocumentacaoObrigatoria(p.codigo_tuss, p.descricao);
    for (const d of docs) docSet.add(d);
    emit({
      tipo: "result",
      mensagem: `Documentação exigida: ${docs.length ? docs.join(", ") : "nenhuma específica"}`,
      detalhes: { docs },
    });

    // Raio-x exigido mas não realizado.
    const exigeRaioX = docs.some((d) => /raio-x|radiograf|periapical|panor/i.test(d));
    if (exigeRaioX && !raioXRealizado) {
      alertas.push(
        alerta(
          "critico",
          "documentacao",
          `${p.descricao} (${p.codigo_tuss}) exige radiografia, mas o prontuário não registra raio-x realizado.`,
          "Anexe a radiografia correspondente antes de enviar — ausência gera glosa documental."
        )
      );
    }
  }

  if (requerAutorizacao) {
    alertas.push(
      alerta(
        "critico",
        "autorizacao",
        `Procedimento(s) exige(m) autorização prévia: ${motivos.join(", ")}.`,
        "Obtenha o número de autorização junto ao convênio antes de executar/enviar a guia."
      )
    );
  }

  // Regras específicas por convênio não estão nas bases públicas indexadas.
  const nomeConv = convenio || "convênio do paciente";
  emit({
    tipo: "warning",
    mensagem: `Regras específicas da ${nomeConv} não estão nas bases. Verifique diretamente com o convênio.`,
  });
  alertas.push(
    alerta(
      "info",
      "convenio",
      `Regras proprietárias da ${nomeConv} não constam nas bases públicas (TUSS/ANS) consultadas.`,
      "Confirme autorização, prazos e documentação no portal/tabela do próprio convênio."
    )
  );

  return {
    requer_autorizacao: requerAutorizacao,
    requer_autorizacao_motivo: requerAutorizacao
      ? `Autorização prévia exigida para: ${motivos.join(", ")}.`
      : undefined,
    documentacao_obrigatoria: [...docSet],
    convenio_regras_aplicadas: regrasAplicadas,
    alertas,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// NÓ 4 — Guia Builder + helpers de prestador/beneficiário
// ─────────────────────────────────────────────────────────────────────────────

function pickCodigoOperadora(convenio: string, prestador: DadosPrestador): string {
  const c = convenio.toLowerCase();
  if (c.includes("unimed")) return prestador.codigo_operadora_unimed ?? "";
  if (c.includes("amil")) return prestador.codigo_operadora_amil ?? "";
  if (c.includes("bradesco")) return prestador.codigo_operadora_bradesco ?? "";
  return "";
}

function inferTipoAtendimento(
  procedimentos: ProcedimentoGuia[]
): GuiaSPSADT["tipo_atendimento"] {
  const codigos = procedimentos.map((p) => p.codigo_tuss);
  const urgencia = ["81000260", "81000287", "81000138"];
  if (codigos.some((c) => urgencia.includes(c))) return "urgencia";
  if (procedimentos.length === 1 && procedimentos[0].codigo_tuss === "81000014")
    return "consulta";
  return "procedimento";
}

// ─────────────────────────────────────────────────────────────────────────────
// Orquestrador
// ─────────────────────────────────────────────────────────────────────────────

export async function gerarGuiaCobranca(
  prontuarioMd: string,
  prontuarioModel: ProntuarioModel,
  dadosPrestador: DadosPrestador,
  onTrace?: (e: TraceEvent) => void
): Promise<GuiaSPSADT> {
  const emit = makeEmit(onTrace);
  const alertas: AlertaGlosa[] = [];

  // NÓ 1 — Parser
  let parser: ParserOutput;
  try {
    const r = await runParser(prontuarioMd, prontuarioModel, emit);
    parser = r.out;
    alertas.push(...r.alertas);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "erro";
    alertas.push(
      alerta("critico", "parser", `Falha ao ler o prontuário (${msg}).`, "Revise manualmente a guia.")
    );
    parser = {
      procedimentos_realizados: procedimentosRealizados(prontuarioModel.plano),
      faturaveis: prontuarioModel.plano?.procedimentos_faturaveis ?? [],
      elemento_dental: prontuarioModel.diagnostico?.elemento_dental ?? "",
      convenio: prontuarioModel.identificacao?.convenio ?? "",
      data_atendimento: prontuarioModel.identificacao?.data ?? "",
      cid_codigo: prontuarioModel.diagnostico?.cid_codigo ?? "",
      cid_descricao: prontuarioModel.diagnostico?.cid_descricao ?? "",
      indicacao_clinica: prontuarioModel.anamnese?.queixa_principal ?? "",
      requer_autorizacao_hint: false,
    };
  }

  // NÓ 2 — TUSS Mapper. Se o Passo 4 já consolidou os faturáveis, usa-os direto
  // (fonte "prontuario"); senão, mapeia via RAG a partir da linguagem natural.
  let procedimentos: ProcedimentoGuia[] = [];
  try {
    const r = parser.faturaveis.length
      ? await mapFaturaveis(parser.faturaveis, parser.elemento_dental, emit)
      : await runTussMapper(parser.procedimentos_realizados, parser.elemento_dental, emit);
    procedimentos = r.procedimentos;
    alertas.push(...r.alertas);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "erro";
    alertas.push(
      alerta("critico", "procedimentos", `Falha no mapeamento TUSS (${msg}).`, "Informe os códigos TUSS manualmente.")
    );
  }

  // NÓ 3 — Rules Checker (RAG)
  let rules: RulesOutput = {
    requer_autorizacao: false,
    documentacao_obrigatoria: [],
    convenio_regras_aplicadas: [],
    alertas: [],
  };
  const raioXRealizado = prontuarioModel.metadata_cobranca?.raio_x_realizado ?? false;
  try {
    rules = await runRulesChecker(parser.convenio, procedimentos, raioXRealizado, emit);
    alertas.push(...rules.alertas);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "erro";
    alertas.push(
      alerta("critico", "convenio", `Verificação de regras falhou (${msg}).`, "Valide autorização e documentação manualmente.")
    );
  }

  const requerAutorizacao = rules.requer_autorizacao || parser.requer_autorizacao_hint;

  // NÓ 4 — Guia Builder
  emit({ tipo: "decision", mensagem: "Montando guia SP/SADT..." });
  const ident = prontuarioModel.identificacao;
  const guia: GuiaSPSADT = {
    clinica_nome: dadosPrestador.clinica_nome,
    clinica_cnpj: dadosPrestador.clinica_cnpj,
    dentista_nome: dadosPrestador.dentista_nome || ident?.dentista || "",
    dentista_cro: dadosPrestador.dentista_cro || ident?.cro || "",
    codigo_operadora: pickCodigoOperadora(parser.convenio, dadosPrestador),

    paciente_nome: ident?.nome_paciente ?? "",
    carteirinha:
      ident?.carteirinha || prontuarioModel.metadata_cobranca?.carteirinha || "",
    convenio: parser.convenio,
    plano: undefined,

    data_realizacao:
      parser.data_atendimento || ident?.data || new Date().toISOString().slice(0, 10),
    tipo_atendimento: inferTipoAtendimento(procedimentos),
    numero_autorizacao: undefined,
    requer_autorizacao: requerAutorizacao,
    requer_autorizacao_motivo: requerAutorizacao
      ? rules.requer_autorizacao_motivo ??
        "Procedimento sujeito a autorização prévia do convênio."
      : undefined,

    procedimentos,

    cid_codigo: parser.cid_codigo,
    cid_descricao: parser.cid_descricao,
    indicacao_clinica: parser.indicacao_clinica,

    alertas_glosa: alertas,
    documentacao_obrigatoria: rules.documentacao_obrigatoria,
    convenio_regras_aplicadas: rules.convenio_regras_aplicadas,
  };

  emit({
    tipo: "decision",
    mensagem: `Guia gerada com ${procedimentos.length} procedimento(s).`,
  });

  return guia;
}
