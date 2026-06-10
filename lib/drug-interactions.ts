/**
 * Tabela estática de interações medicamentosas relevantes para odontologia.
 * Usada pela tool consultar_interacoes_medicamentosas. O lookup casa por
 * princípio ativo (normalizado, sem acentos) com partial match.
 *
 * AVISO: orientação de apoio à decisão — nunca substitui a avaliação do médico
 * responsável pelo paciente.
 */

export interface InteracaoEntry {
  /** Princípios ativos / nomes que disparam esta entrada (minúsculos, sem acento). */
  termos: string[];
  titulo: string;
  conduta: string;
}

export const INTERACOES: InteracaoEntry[] = [
  {
    termos: ["warfarina", "acenocumarol", "marevan", "varfarina"],
    titulo: "Warfarina / Acenocumarol (anticoagulante cumarínico)",
    conduta:
      "Risco de sangramento aumentado com AINEs. Amoxicilina pode alterar o INR — monitorar. Verificar INR recente antes de procedimentos cirúrgicos.",
  },
  {
    termos: ["aas", "acido acetilsalicilico", "aspirina", "antiagregante"],
    titulo: "AAS em dose antiagregante",
    conduta:
      "Risco de sangramento em procedimentos cirúrgicos. Avaliar suspensão com o médico responsável antes de cirurgias.",
  },
  {
    termos: ["bifosfonato", "bifosfonatos", "alendronato", "zoledronato", "ibandronato", "risedronato"],
    titulo: "Bifosfonatos (alendronato, zoledronato, ibandronato)",
    conduta:
      "Risco de osteonecrose dos maxilares em exodontia e cirurgias ósseas. Alertar sempre e avaliar conduta conservadora.",
  },
  {
    termos: ["isrs", "fluoxetina", "sertralina", "escitalopram", "citalopram", "paroxetina"],
    titulo: "ISRS (fluoxetina, sertralina, escitalopram)",
    conduta:
      "Risco com tramadol — síndrome serotoninérgica. Aumentam o sangramento quando associados a AINEs.",
  },
  {
    termos: ["metformina", "glifage"],
    titulo: "Metformina",
    conduta:
      "Sem interação significativa com anestésicos odontológicos. Procedimentos de rotina são seguros.",
  },
  {
    termos: [
      "losartana", "enalapril", "anti-hipertensivo", "anti hipertensivo",
      "captopril", "ramipril", "valsartana", "candesartana", "lisinopril",
    ],
    titulo: "Losartana / Enalapril e demais anti-hipertensivos",
    conduta:
      "Sem contraindicação com articaína. Limitar epinefrina a 2 tubetes 1:100.000.",
  },
  {
    termos: ["rivaroxabana", "apixabana", "dabigatrana", "edoxabana", "anticoagulante direto", "doac"],
    titulo: "Anticoagulantes diretos (rivaroxabana, apixabana)",
    conduta:
      "Risco de sangramento significativo. Avaliar suspensão com o médico antes de cirurgias.",
  },
  {
    termos: ["corticosteroide", "corticoide", "prednisona", "prednisolona", "dexametasona", "hidrocortisona"],
    titulo: "Corticosteroides crônicos",
    conduta:
      "Risco de crise adrenal em procedimentos sob estresse. Cicatrização comprometida.",
  },
  {
    termos: ["imunossupressor", "ciclosporina", "tacrolimo", "azatioprina", "micofenolato", "metotrexato"],
    titulo: "Imunossupressores",
    conduta:
      "Risco aumentado de infecção pós-operatória. Avaliar cobertura antibiótica profilática.",
  },
];

const AVISO =
  "Atenção: esta orientação é de apoio. Sempre confirme a conduta com o médico responsável pelo paciente.";

const normalize = (s: string): string =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();

/** Consulta a tabela e devolve markdown com as interações encontradas + aviso. */
export function consultarInteracoes(medicamento: string): string {
  const q = normalize(medicamento);
  if (!q) {
    return `Informe o nome do medicamento para consultar interações.\n\n${AVISO}`;
  }

  const achados = INTERACOES.filter((e) =>
    e.termos.some((t) => q.includes(t) || t.includes(q))
  );

  if (achados.length === 0) {
    return [
      `Nenhuma interação odontológica específica cadastrada para "${medicamento}".`,
      `Isso não garante ausência de interação — avalie a anamnese completa.`,
      ``,
      AVISO,
    ].join("\n");
  }

  const blocos = achados
    .map((e) => `### ${e.titulo}\n${e.conduta}`)
    .join("\n\n");

  return `## Interações relevantes para "${medicamento}"\n\n${blocos}\n\n${AVISO}`;
}
