import { groq, MODELS } from "@/lib/groq";
import type { ProntuarioSOAP, SOAPFieldKey } from "@/lib/types";

const SYSTEM_PROMPT = `Você é um assistente de documentação clínica odontológica para o SUS (Brasil).
Recebe a TRANSCRIÇÃO BRUTA de uma consulta (diálogo entre dentista e paciente) e produz dois blocos de saída em um único JSON:
1) O PRONTUÁRIO CLÍNICO completo nos campos SOAP.
2) As EVIDÊNCIAS — citações literais da transcrição que embasam cada campo SOAP.

═══ BLOCO 1 — PRONTUÁRIO CLÍNICO (SOAP) ═══

Preencha OBRIGATORIAMENTE todos estes campos com linguagem clínica em português:
- subjetivo: queixa e história relatada pelo paciente (ex.: "Paciente relata dor espontânea no dente 36 há 3 dias, com piora ao mastigar.").
- objetivo: achados do exame clínico (dentes, faces, lesões, mobilidade, percussão, sondagem, etc.).
- avaliacao: hipótese diagnóstica ou avaliação clínica (ex.: "Provável pulpite irreversível em dente 36.").
- plano: conduta, procedimentos realizados ou planejados, prescrições e orientações (ex.: "Indicado tratamento endodôntico em dente 36.").
- queixaPrincipal: resumo em UMA frase curta (ex.: "Dor em dente 36 há 3 dias.").
- dentesEnvolvidos: array com notação FDI dos dentes citados (ex.: ["36"]); use [] se nenhum for mencionado.
- procedimentos: array com os procedimentos mencionados (ex.: ["radiografia periapical", "endodontia"]); use [] se nenhum.
- orientacoes: orientações dadas ao paciente (ex.: "Evitar mastigar do lado esquerdo até o procedimento."); use "" se nenhuma.
- alertasAnonimizacao: array com TIPOS de dado pessoal removidos (ex.: ["nome"]); use [] se nenhum.

REGRAS DE PRIVACIDADE (LGPD): NUNCA inclua nome, CPF, CNS, RG, telefone, e-mail, endereço ou data de nascimento. Substitua por [REMOVIDO] e registre o tipo em alertasAnonimizacao.

ESTILO: português clínico, conciso, impessoal, terceira pessoa. NÃO invente — use "" ou [] para o que não foi dito.

═══ BLOCO 2 — EVIDÊNCIAS (campo adicional) ═══

Após preencher todos os campos SOAP acima, adicione o campo "evidencias".
"evidencias" é um objeto onde cada chave é o nome de um campo SOAP e o valor é um array de fragmentos COPIADOS LITERALMENTE da transcrição (palavra por palavra, sem parafrasear, 4-12 palavras cada) que embasam o conteúdo daquele campo.
Use até 3 fragmentos por campo. Use [] se o campo não tiver trecho direto na transcrição.
Exemplo: { "subjetivo": ["tô com uma dor no dente faz três dias", "piora quando mastigo"], "queixaPrincipal": ["dor no dente"] }

═══ SAÍDA ═══
Responda SOMENTE com JSON válido (sem markdown, sem comentários) com EXATAMENTE estas chaves:
subjetivo, objetivo, avaliacao, plano, queixaPrincipal, dentesEnvolvidos, procedimentos, orientacoes, alertasAnonimizacao, evidencias.`;

const SOAP_FIELD_KEYS: SOAPFieldKey[] = [
  "subjetivo", "objetivo", "avaliacao", "plano",
  "queixaPrincipal", "dentesEnvolvidos", "procedimentos", "orientacoes",
];

const EMPTY: ProntuarioSOAP = {
  subjetivo: "",
  objetivo: "",
  avaliacao: "",
  plano: "",
  queixaPrincipal: "",
  dentesEnvolvidos: [],
  procedimentos: [],
  orientacoes: "",
  alertasAnonimizacao: [],
  evidencias: {},
};

function normalize(raw: Partial<ProntuarioSOAP>): ProntuarioSOAP {
  const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  const arr = (v: unknown) =>
    Array.isArray(v) ? v.map((x) => String(x).trim()).filter(Boolean) : [];

  const rawEv = raw.evidencias;
  const evidencias: ProntuarioSOAP["evidencias"] = {};
  if (rawEv && typeof rawEv === "object" && !Array.isArray(rawEv)) {
    for (const key of SOAP_FIELD_KEYS) {
      const v = (rawEv as Record<string, unknown>)[key];
      if (Array.isArray(v) && v.length > 0) {
        evidencias[key] = v.map(String).filter(Boolean);
      }
    }
  }

  return {
    subjetivo: str(raw.subjetivo),
    objetivo: str(raw.objetivo),
    avaliacao: str(raw.avaliacao),
    plano: str(raw.plano),
    queixaPrincipal: str(raw.queixaPrincipal),
    dentesEnvolvidos: arr(raw.dentesEnvolvidos),
    procedimentos: arr(raw.procedimentos),
    orientacoes: str(raw.orientacoes),
    alertasAnonimizacao: arr(raw.alertasAnonimizacao),
    evidencias,
  };
}

export async function structureTranscript(transcript: string): Promise<ProntuarioSOAP> {
  const completion = await groq.chat.completions.create({
    model: MODELS.structuring,
    temperature: 0.2,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: `Transcrição da consulta:\n\n${transcript}` },
    ],
  });

  const content = completion.choices[0]?.message?.content ?? "{}";

  try {
    return normalize(JSON.parse(content));
  } catch {
    return { ...EMPTY };
  }
}
