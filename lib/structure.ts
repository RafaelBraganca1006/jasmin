import { groq, MODELS } from "@/lib/groq";
import type { ProntuarioSOAP } from "@/lib/types";

const SYSTEM_PROMPT = `Você é um assistente de documentação clínica odontológica para o SUS (Brasil).
Recebe a TRANSCRIÇÃO BRUTA de uma consulta (diálogo entre dentista e paciente) e produz um registro clínico estruturado.

REGRAS DE PRIVACIDADE (LGPD) — OBRIGATÓRIO:
- NUNCA inclua dados que identifiquem o paciente: nome, CPF, CNS/Cartão SUS, RG, telefone, e-mail, endereço, data de nascimento ou nomes de familiares.
- Se algum identificador aparecer na transcrição, substitua por [REMOVIDO] no texto e registre o TIPO em "alertasAnonimizacao" (ex.: "nome", "CPF") — sem repetir o valor.
- Mantenha apenas informação clínica relevante.

FORMATO CLÍNICO (padrão SOAP + odontologia):
- subjetivo: queixa e história relatada pelo paciente, em linguagem clínica.
- objetivo: achados do exame clínico (dentes, faces, lesões, mobilidade, etc.).
- avaliacao: hipótese diagnóstica / avaliação clínica.
- plano: conduta, procedimentos realizados ou planejados, prescrições e orientações.
- queixaPrincipal: resumo em UMA frase.
- dentesEnvolvidos: notação FDI (ex.: "46", "36"); array vazio se nenhum dente for citado.
- procedimentos: lista de procedimentos mencionados.
- orientacoes: orientações dadas ao paciente.

ESTILO:
- Português clínico, conciso, impessoal, em terceira pessoa.
- NÃO invente informação que não esteja na transcrição. Se algo não foi dito, use "" (string vazia) ou [] (array vazio).
- Use terminologia odontológica correta e notação FDI para dentes.

SAÍDA:
Responda SOMENTE com um objeto JSON válido (sem markdown, sem comentários) contendo EXATAMENTE estas chaves:
subjetivo, objetivo, avaliacao, plano, queixaPrincipal, dentesEnvolvidos, procedimentos, orientacoes, alertasAnonimizacao.`;

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
};

/** Garante que todas as chaves existem e têm o tipo certo. */
function normalize(raw: Partial<ProntuarioSOAP>): ProntuarioSOAP {
  const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  const arr = (v: unknown) =>
    Array.isArray(v) ? v.map((x) => String(x).trim()).filter(Boolean) : [];

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
  };
}

/**
 * Transforma a transcrição bruta em prontuário SOAP estruturado e anonimizado.
 */
export async function structureTranscript(
  transcript: string
): Promise<ProntuarioSOAP> {
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
    // Se o modelo devolver algo não-JSON, não quebramos o fluxo.
    return { ...EMPTY };
  }
}
