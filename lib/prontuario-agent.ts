import { groq, MODELS } from "@/lib/groq";
import type {
  AnamneseModel,
  ExameModel,
  DiagnosticoModel,
  PlanoModel,
  ProcedimentoFaturavel,
  AlertasModel,
  DenteModel,
  IdentificacaoModel,
  MetadataCobranca,
  ProntuarioModel,
  EvidenciasProntuario,
  PassoResult,
} from "@/lib/types-prontuario";
import { buildTussContextString, isKnownTussCode } from "@/lib/tuss-context";

/**
 * Pipeline sequencial de 5 passos (Camada 2).
 * Cada passo é uma chamada Groq llama-3.3-70b em JSON mode, com system prompt
 * especializado. O output de cada passo alimenta o próximo. Falhas são isoladas:
 * se um passo quebra, ele devolve um default vazio + erro, e o pipeline segue.
 */

export interface GerarProntuarioInput {
  transcript: string;
  paciente?: Partial<IdentificacaoModel>;
  /** Laudo radiológico textual, se houver. */
  laudo?: string;
  /** Prontuários anteriores do mesmo paciente, concatenados em .md (passo 5). */
  historicoMd?: string;
}

export interface GerarProntuarioOutput {
  prontuario: ProntuarioModel;
  falhasParciais: string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers de normalização
// ─────────────────────────────────────────────────────────────────────────────

const str = (v: unknown): string => (typeof v === "string" ? v.trim() : "");
const optStr = (v: unknown): string | undefined => {
  const s = str(v);
  return s ? s : undefined;
};
const arr = (v: unknown): string[] =>
  Array.isArray(v) ? v.map((x) => String(x).trim()).filter(Boolean) : [];
const bool = (v: unknown): boolean => v === true || v === "true" || v === "sim" || v === "Sim";

/** Lê { evidencias: { campo: [...] } } de um JSON de passo. */
function readEvidencias(raw: unknown, keys: string[]): EvidenciasProntuario {
  const out: EvidenciasProntuario = {};
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return out;
  const obj = raw as Record<string, unknown>;
  for (const k of keys) {
    const v = obj[k];
    if (Array.isArray(v)) {
      const frags = v.map(String).map((s) => s.trim()).filter((s) => s.length >= 3).slice(0, 3);
      if (frags.length) out[k] = frags;
    }
  }
  return out;
}

/** Executa um passo: chama o LLM em JSON mode e parseia. Erros viram PassoResult.ok=false. */
async function runStep<T>(
  nome: string,
  system: string,
  user: string,
  parse: (raw: Record<string, unknown>) => T,
  fallback: T
): Promise<PassoResult<T>> {
  try {
    const completion = await groq.chat.completions.create({
      model: MODELS.structuring,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    });
    const content = completion.choices[0]?.message?.content ?? "{}";
    const raw = JSON.parse(content) as Record<string, unknown>;
    return { ok: true, data: parse(raw) };
  } catch (err) {
    const erro = err instanceof Error ? err.message : "erro desconhecido";
    return { ok: false, data: fallback, erro: `${nome}: ${erro}` };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PASSO 1 — Anamnese
// ─────────────────────────────────────────────────────────────────────────────

const SYS_ANAMNESE = `Você é um assistente de documentação clínica odontológica (Brasil, SUS).
Recebe a TRANSCRIÇÃO BRUTA de uma consulta (e, se houver, a ficha do paciente) e extrai APENAS a ANAMNESE.

Extraia estes campos:
- queixa_principal: motivo da consulta em UMA frase clínica (OBRIGATÓRIO; se nada foi dito, use "Não relatada").
- historico_medico: condições sistêmicas relevantes relatadas (ou "" se nenhuma).
- medicamentos: array de medicamentos em uso (ou []).
- alergias: array de alergias relatadas (OBRIGATÓRIO; se o paciente negou ou nada foi dito, use ["Nega" ] ou []).
- habitos: hábitos relevantes (tabagismo, bruxismo, etc.) ou "".
- comorbidades: comorbidades sistêmicas (diabetes, hipertensão, etc.) ou "".

REGRAS LGPD: NUNCA inclua nome, CPF, CNS, RG, telefone, e-mail ou endereço nos textos clínicos. Substitua por [REMOVIDO].
NÃO invente: use "" ou [] para o que não foi mencionado.

EVIDÊNCIAS: adicione o campo "evidencias" — objeto onde cada chave é um campo acima e o valor é um array (até 3) de fragmentos COPIADOS LITERALMENTE da transcrição (4-12 palavras) que embasam o campo. Use [] quando não houver trecho direto.

Responda SOMENTE com JSON válido com as chaves: queixa_principal, historico_medico, medicamentos, alergias, habitos, comorbidades, evidencias.`;

const ANAMNESE_EV_KEYS = ["queixa_principal", "historico_medico", "medicamentos", "alergias", "habitos", "comorbidades"];

function parseAnamnese(raw: Record<string, unknown>): { model: AnamneseModel; ev: EvidenciasProntuario } {
  const model: AnamneseModel = {
    queixa_principal: str(raw.queixa_principal),
    historico_medico: optStr(raw.historico_medico),
    medicamentos: arr(raw.medicamentos),
    alergias: arr(raw.alergias),
    habitos: optStr(raw.habitos),
    comorbidades: optStr(raw.comorbidades),
  };
  return { model, ev: readEvidencias(raw.evidencias, ANAMNESE_EV_KEYS) };
}

// ─────────────────────────────────────────────────────────────────────────────
// PASSO 2 — Exame clínico
// ─────────────────────────────────────────────────────────────────────────────

const SYS_EXAME = `Você é um assistente de documentação clínica odontológica (Brasil).
Recebe a TRANSCRIÇÃO da consulta e, se houver, um LAUDO RADIOLÓGICO. Extrai APENAS o EXAME CLÍNICO.

Extraia:
- extraoral: achados extraorais (face, ATM, linfonodos) ou "".
- intraoral: achados intraorais gerais (mucosa, língua, tecidos moles) ou "".
- periodonto: condição periodontal (gengiva, sangramento, bolsas, tártaro) ou "".
- oclusao: achados de oclusão ou "".
- odontograma: array de dentes citados, cada um { "elemento": "<FDI>", "status": "<estado clínico>", "observacao": "<opcional>" }. Use [] se nenhum dente foi identificado.
- laudo_radiologico: resumo do laudo radiológico, se fornecido/mencionado, ou "".

Notação dental SEMPRE FDI (ex.: 46, 11, 38). NÃO invente dentes nem achados.

EVIDÊNCIAS: adicione "evidencias" — objeto com chaves entre (extraoral, intraoral, periodonto, oclusao, odontograma, laudo_radiologico). Cada valor é um array (até 3) de fragmentos COPIADOS PALAVRA POR PALAVRA da TRANSCRIÇÃO do diálogo (o texto sob "Transcrição da consulta") — exatamente como aparecem ali, SEM reescrever, SEM corrigir, SEM traduzir do laudo. NUNCA copie do laudo radiológico nem invente frases: se o achado não tem trecho literal na transcrição, use [] para aquele campo.

Responda SOMENTE com JSON válido com as chaves: extraoral, intraoral, periodonto, oclusao, odontograma, laudo_radiologico, evidencias.`;

const EXAME_EV_KEYS = ["extraoral", "intraoral", "periodonto", "oclusao", "odontograma", "laudo_radiologico"];

function parseOdontograma(v: unknown): DenteModel[] {
  if (!Array.isArray(v)) return [];
  const out: DenteModel[] = [];
  for (const item of v) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const elemento = str(o.elemento);
    if (!elemento) continue;
    out.push({
      elemento,
      status: str(o.status) || "—",
      observacao: optStr(o.observacao),
    });
  }
  return out;
}

function parseExame(raw: Record<string, unknown>): { model: ExameModel; ev: EvidenciasProntuario } {
  const model: ExameModel = {
    extraoral: optStr(raw.extraoral),
    intraoral: optStr(raw.intraoral),
    periodonto: optStr(raw.periodonto),
    oclusao: optStr(raw.oclusao),
    odontograma: parseOdontograma(raw.odontograma),
    laudo_radiologico: optStr(raw.laudo_radiologico),
  };
  return { model, ev: readEvidencias(raw.evidencias, EXAME_EV_KEYS) };
}

// ─────────────────────────────────────────────────────────────────────────────
// PASSO 3 — Diagnóstico e CID-10 (faixa K00–K14)
// ─────────────────────────────────────────────────────────────────────────────

const CID_TABLE = `K02.0 Cárie do esmalte
K02.1 Cárie da dentina
K02.5 Cárie com exposição pulpar
K04.0 Pulpite
K04.1 Necrose da polpa
K04.2 Gangrena da polpa
K04.5 Periodontite apical crônica
K04.6 Abscesso periapical
K05.0 Gengivite aguda
K05.1 Gengivite crônica
K05.2 Periodontite aguda
K05.3 Periodontite crônica
K06.0 Recessão gengival
K08.1 Perda de dente por acidente
K08.3 Raiz dental retida
K10.2 Pericoronarite
K12.0 Estomatite aftosa recorrente`;

const SYS_DIAGNOSTICO = `Você é um assistente de codificação diagnóstica odontológica (CID-10).
Recebe o EXAME CLÍNICO estruturado e o LAUDO (se houver) e produz o DIAGNÓSTICO.

Use EXCLUSIVAMENTE esta tabela CID-10 odontológica (faixa K00–K14). NÃO invente códigos fora dela:
${CID_TABLE}

Extraia:
- cid_codigo: o código mais compatível da tabela acima (ex.: "K04.1"). Se nenhum se aplica com segurança, use "".
- cid_descricao: a descrição correspondente exata da tabela (ex.: "Necrose da polpa"). "" se cid_codigo vazio.
- elemento_dental: o dente (FDI) ao qual o diagnóstico se refere, ou "".
- confirmado_por_raio_x: true SOMENTE se o laudo/radiografia confirma o achado; senão false.

Escolha UM diagnóstico principal. Baseie-se apenas nos achados fornecidos; não extrapole.

Responda SOMENTE com JSON válido com as chaves: cid_codigo, cid_descricao, elemento_dental, confirmado_por_raio_x.`;

const CID_RE = /^K(0\d|1[0-4])\.\d$/; // K00.0 – K14.9

function parseDiagnostico(raw: Record<string, unknown>): { model: DiagnosticoModel; aviso?: string } {
  let cid_codigo = str(raw.cid_codigo).toUpperCase();
  let cid_descricao = str(raw.cid_descricao);
  let aviso: string | undefined;

  if (cid_codigo && !CID_RE.test(cid_codigo)) {
    aviso = `Diagnóstico: CID "${cid_codigo}" fora da faixa K00–K14 — descartado.`;
    cid_codigo = "";
    cid_descricao = "";
  }

  return {
    model: {
      cid_codigo,
      cid_descricao,
      elemento_dental: str(raw.elemento_dental),
      confirmado_por_raio_x: bool(raw.confirmado_por_raio_x),
    },
    aviso,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// PASSO 4 — Plano de tratamento e evolução
// ─────────────────────────────────────────────────────────────────────────────

// Montado UMA vez no load do módulo: a tabela TUSS é constante (lib/tuss-data.ts).
const SYS_PLANO = `Você é especialista em faturamento odontológico brasileiro com profundo conhecimento da tabela TUSS e das regras de cobrança de convênios de saúde. Recebe a TRANSCRIÇÃO e os outputs do EXAME e do DIAGNÓSTICO.

Sua tarefa tem DUAS partes.

PARTE A — Documentação clínica (campos do prontuário):
Extraia da transcrição TUDO que foi realizado clinicamente, sem omitir nada.
- procedimentos_realizados: array das etapas/procedimentos efetivamente feitos, em linguagem CLÍNICA técnica, capturados da transcrição sem consolidar (ex.: ["abertura coronária", "preparo químico-mecânico", "pasta de hidróxido de cálcio", "fechamento provisório com Coltosol"]). NÃO pode ser vazio se algo foi feito.
- materiais: materiais usados (ex.: "resina composta, ácido fosfórico") ou "".
- anestesia: tipo + quantidade + elemento (ex.: "lidocaína 2% com vaso, 1 tubete, bloqueio do 46") ou "".
- pos_operatorio: orientações pós-operatórias ou "".
- proxima_consulta: o que ficou agendado/planejado ou "".

ESTILO (procedimentos_realizados, materiais, anestesia, pos_operatorio, proxima_consulta): português clínico e profissional, terceira pessoa impessoal, inicial maiúscula. NÃO copie a fala coloquial — traduza para registro técnico.

PARTE B — Consolidação para faturamento (procedimentos_faturaveis):
Com base na TABELA TUSS abaixo, identifique os procedimentos FATURÁVEIS ao convênio.

TABELA TUSS ODONTOLÓGICA VIGENTE (formato: codigo | descricao | inclui: etapas já incluídas no código):
${buildTussContextString()}

REGRAS DE CONSOLIDAÇÃO — leia com atenção:
1. Etapas técnicas de um procedimento NÃO são cobradas separadamente. Abertura coronária, localização de canais, preparo químico-mecânico e instrumentação são etapas do tratamento endodôntico — não itens separados na guia.
2. Para endodontia, escolha o código por número de raízes do dente:
   - Anteriores (11-13, 21-23, 31-33, 41-43): geralmente unirradicular.
   - Pré-molares (14, 15, 24, 25, 34, 35, 44, 45): geralmente birradicular.
   - Molares (16, 17, 18, 26, 27, 28, 36, 37, 38, 46, 47, 48): geralmente multirradicular (3+ raízes).
3. Curativo de demora é faturável SEPARADO do canal APENAS quando a obturação não foi concluída na mesma sessão. Se a sessão concluiu o canal, cobre o canal completo; se foi só curativo, cobre o curativo.
4. Raio-x periapical É faturável separadamente quando realizado na consulta.
5. Anestesia NÃO é faturável separadamente — está inclusa no procedimento principal.
6. Se não encontrar código TUSS correspondente com confiança, use codigo_tuss: "MANUAL" e requer_revisao: true. NUNCA invente um código.
7. Para cada procedimento faturável, liste em inclui_etapas quais itens de procedimentos_realizados foram consolidados nele.

Cada item de procedimentos_faturaveis é um objeto:
{ "codigo_tuss": "<código da tabela ou MANUAL>", "descricao": "<descrição oficial da tabela>", "elemento_dental": "<FDI ou ''>", "quantidade": <number>, "inclui_etapas": ["<etapa de procedimentos_realizados>"], "requer_revisao": <boolean>, "justificativa": "<por que esse código>" }

EVIDÊNCIAS (campo "evidencias", e SOMENTE ele): objeto com chaves entre (procedimentos_realizados, materiais, anestesia, pos_operatorio, proxima_consulta). Cada valor é um array (até 3) de fragmentos COPIADOS PALAVRA POR PALAVRA da TRANSCRIÇÃO do diálogo — com a grafia original. A cópia literal vale SÓ aqui. NUNCA copie do Exame/Diagnóstico nem invente; se não houver trecho literal, use [].

Responda SOMENTE com JSON válido com as chaves: procedimentos_realizados, procedimentos_faturaveis, materiais, anestesia, pos_operatorio, proxima_consulta, evidencias.`;

const PLANO_EV_KEYS = ["procedimentos_realizados", "materiais", "anestesia", "pos_operatorio", "proxima_consulta"];

function parseFaturaveis(v: unknown): ProcedimentoFaturavel[] {
  if (!Array.isArray(v)) return [];
  const out: ProcedimentoFaturavel[] = [];
  for (const item of v) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const codigo_tuss = str(o.codigo_tuss).toUpperCase();
    const descricao = str(o.descricao);
    if (!codigo_tuss && !descricao) continue;

    // Defensivo: se o LLM devolveu um código que não existe na tabela vigente,
    // força revisão humana (não confiar em código alucinado).
    const isManual = codigo_tuss === "MANUAL" || !codigo_tuss;
    const requerRevisao =
      bool(o.requer_revisao) || isManual || !isKnownTussCode(codigo_tuss);

    const q = Number(o.quantidade);
    out.push({
      codigo_tuss: isManual ? "MANUAL" : codigo_tuss,
      descricao,
      elemento_dental: str(o.elemento_dental),
      quantidade: Number.isFinite(q) && q > 0 ? q : 1,
      inclui_etapas: arr(o.inclui_etapas),
      requer_revisao: requerRevisao,
      justificativa: str(o.justificativa),
    });
  }
  return out;
}

function parsePlano(raw: Record<string, unknown>): { model: PlanoModel; ev: EvidenciasProntuario } {
  const model: PlanoModel = {
    procedimentos_realizados: arr(raw.procedimentos_realizados),
    procedimentos_faturaveis: parseFaturaveis(raw.procedimentos_faturaveis),
    materiais: optStr(raw.materiais),
    anestesia: optStr(raw.anestesia),
    pos_operatorio: optStr(raw.pos_operatorio),
    proxima_consulta: optStr(raw.proxima_consulta),
  };
  return { model, ev: readEvidencias(raw.evidencias, PLANO_EV_KEYS) };
}

// ─────────────────────────────────────────────────────────────────────────────
// PASSO 5 — Revisor de gaps e alertas
// ─────────────────────────────────────────────────────────────────────────────

const SYS_ALERTAS = `Você é um REVISOR clínico odontológico rigoroso. Recebe um prontuário estruturado (anamnese, exame, diagnóstico, plano) e o histórico anterior do paciente (se houver). Sua função é detectar problemas REAIS.

Detecte e reporte SOMENTE o que for concreto e verificável a partir dos dados:
- gaps: campos obrigatórios ausentes ou vazios (ex.: "Alergias não documentadas", "Diagnóstico sem CID").
- alertas_clinicos: riscos clínicos reais (ex.: "Paciente em uso de anticoagulante com procedimento cirúrgico planejado", "Alergia a anestésico não confirmada antes de anestesia").
- inconsistencias: contradições entre seções (ex.: "Procedimento de restauração sem diagnóstico de cárie correspondente").
- requer_confirmacao: true SOMENTE se houver pelo menos um gap, alerta ou inconsistência que exija revisão humana antes de aprovar; senão false.

REGRA CRÍTICA: NÃO invente alertas para parecer útil. Se o prontuário está completo e coerente, retorne arrays VAZIOS e requer_confirmacao=false. Nada de avisos genéricos, vagos ou óbvios. Cada item deve apontar algo específico e acionável.

Responda SOMENTE com JSON válido com as chaves: gaps, alertas_clinicos, inconsistencias, requer_confirmacao.`;

function parseAlertas(raw: Record<string, unknown>): AlertasModel {
  const gaps = arr(raw.gaps);
  const alertas_clinicos = arr(raw.alertas_clinicos);
  const inconsistencias = arr(raw.inconsistencias);
  const temAlgo = gaps.length + alertas_clinicos.length + inconsistencias.length > 0;
  return {
    gaps,
    alertas_clinicos,
    inconsistencias,
    // Coerência: se há itens, requer confirmação; respeita o flag do modelo caso true.
    requer_confirmacao: bool(raw.requer_confirmacao) || temAlgo,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Montagem determinística (identificação + metadata de cobrança)
// ─────────────────────────────────────────────────────────────────────────────

function buildIdentificacao(p?: Partial<IdentificacaoModel>): IdentificacaoModel {
  return {
    nome_paciente: str(p?.nome_paciente),
    convenio: str(p?.convenio),
    carteirinha: str(p?.carteirinha),
    dentista: str(p?.dentista),
    cro: str(p?.cro),
    data: str(p?.data) || new Date().toISOString().slice(0, 10),
  };
}

function buildMetadata(
  exame: ExameModel,
  diagnostico: DiagnosticoModel,
  plano: PlanoModel,
  ident: IdentificacaoModel
): MetadataCobranca {
  // Uma radiografia faturável é prova de que o raio-x foi realizado — evita
  // falso alerta documental ("anexe a radiografia") quando ela já está na guia.
  const radiografias = (plano.procedimentos_faturaveis ?? []).filter((f) =>
    /radiograf|periapical|raio.?x|interproximal|panor/i.test(f.descricao)
  );
  const raioX =
    Boolean(exame.laudo_radiologico) ||
    diagnostico.confirmado_por_raio_x ||
    radiografias.length > 0;
  const inicialFinal = radiografias.some((f) => f.quantidade >= 2) || radiografias.length >= 2;
  return {
    convenio_nome: ident.convenio || undefined,
    carteirinha: ident.carteirinha || undefined,
    raio_x_realizado: raioX,
    raio_x_inicial_final: inicialFinal,
    sessoes_realizadas: 1,
    requer_autorizacao_previa: false,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Orquestrador
// ─────────────────────────────────────────────────────────────────────────────

const EMPTY_ANAMNESE: AnamneseModel = { queixa_principal: "", alergias: [] };
const EMPTY_EXAME: ExameModel = { odontograma: [] };
const EMPTY_DIAGNOSTICO: DiagnosticoModel = {
  cid_codigo: "", cid_descricao: "", elemento_dental: "", confirmado_por_raio_x: false,
};
const EMPTY_PLANO: PlanoModel = { procedimentos_realizados: [], procedimentos_faturaveis: [] };
const EMPTY_ALERTAS: AlertasModel = {
  gaps: [], alertas_clinicos: [], inconsistencias: [], requer_confirmacao: false,
};

export async function gerarProntuario(input: GerarProntuarioInput): Promise<GerarProntuarioOutput> {
  const { transcript } = input;
  const falhas: string[] = [];
  const evidencias: EvidenciasProntuario = {};
  const merge = (e: EvidenciasProntuario) => Object.assign(evidencias, e);

  const fichaTxt = input.paciente?.nome_paciente
    ? `\n\nFicha do paciente: convênio=${input.paciente.convenio || "—"}.`
    : "";
  const laudoTxt = input.laudo ? `\n\nLaudo radiológico:\n${input.laudo}` : "";

  // Passo 1 — Anamnese
  const s1 = await runStep(
    "Anamnese", SYS_ANAMNESE,
    `Transcrição da consulta:\n\n${transcript}${fichaTxt}`,
    parseAnamnese, { model: EMPTY_ANAMNESE, ev: {} }
  );
  if (!s1.ok && s1.erro) falhas.push(s1.erro);
  const anamnese = s1.data.model;
  merge(s1.data.ev);
  if (s1.ok) {
    if (!anamnese.queixa_principal) falhas.push("Anamnese: queixa principal ausente.");
    if (!anamnese.alergias.length) falhas.push("Anamnese: alergias não documentadas.");
  }

  // Passo 2 — Exame clínico
  const s2 = await runStep(
    "Exame", SYS_EXAME,
    `Transcrição da consulta:\n\n${transcript}${laudoTxt}`,
    parseExame, { model: EMPTY_EXAME, ev: {} }
  );
  if (!s2.ok && s2.erro) falhas.push(s2.erro);
  const exame = s2.data.model;
  merge(s2.data.ev);
  if (s2.ok && !exame.odontograma.length) {
    falhas.push("Exame: nenhum elemento dental identificado.");
  }

  // Passo 3 — Diagnóstico e CID
  const s3 = await runStep(
    "Diagnóstico", SYS_DIAGNOSTICO,
    `Exame clínico:\n${JSON.stringify(exame, null, 2)}${laudoTxt}`,
    parseDiagnostico, { model: EMPTY_DIAGNOSTICO }
  );
  if (!s3.ok && s3.erro) falhas.push(s3.erro);
  const diagnostico = s3.data.model;
  if (s3.data.aviso) falhas.push(s3.data.aviso);

  // Passo 4 — Plano, evolução e consolidação faturável
  const elementoFat = diagnostico.elemento_dental || "";
  const s4 = await runStep(
    "Plano", SYS_PLANO,
    `Transcrição da consulta:\n\n${transcript}\n\n--- Contexto estruturado (NÃO use para evidências) ---\nElemento dental do diagnóstico (FDI): ${elementoFat || "—"}\nExame:\n${JSON.stringify(exame)}\n\nDiagnóstico:\n${JSON.stringify(diagnostico)}`,
    parsePlano, { model: EMPTY_PLANO, ev: {} }
  );
  if (!s4.ok && s4.erro) falhas.push(s4.erro);
  const plano = s4.data.model;
  merge(s4.data.ev);
  if (s4.ok && !plano.procedimentos_realizados.length) {
    falhas.push("Plano: nenhum procedimento registrado.");
  }

  // Passo 5 — Revisor de gaps e alertas
  const historicoTxt = input.historicoMd
    ? `\n\nHistórico anterior do paciente:\n${input.historicoMd}`
    : "";
  const s5 = await runStep(
    "Revisor", SYS_ALERTAS,
    `Prontuário a revisar:\n\nAnamnese:\n${JSON.stringify(anamnese, null, 2)}\n\nExame:\n${JSON.stringify(exame, null, 2)}\n\nDiagnóstico:\n${JSON.stringify(diagnostico, null, 2)}\n\nPlano:\n${JSON.stringify(plano, null, 2)}${historicoTxt}`,
    parseAlertas, EMPTY_ALERTAS
  );
  if (!s5.ok && s5.erro) falhas.push(s5.erro);
  const alertas = s5.data;

  // Se houve falha parcial num passo, garante revisão humana.
  if (falhas.length) alertas.requer_confirmacao = true;

  const identificacao = buildIdentificacao(input.paciente);
  const metadata_cobranca = buildMetadata(exame, diagnostico, plano, identificacao);

  const prontuario: ProntuarioModel = {
    identificacao,
    anamnese,
    exame,
    diagnostico,
    plano,
    alertas,
    metadata_cobranca,
    assinatura_pendente: true,
    evidencias,
  };

  return { prontuario, falhasParciais: falhas };
}
