import type { PatientData, AgAppointment } from "@/lib/types-jasmin";
import type {
  ProntuarioModel,
  OdontogramaModel,
  DenteOdontogramaModel,
  ProcedimentoFaturavel,
} from "@/lib/types-prontuario";
import type { CobrancaModel, CobrancaStatus, GuiaSPSADT, ProcedimentoGuia, AlertaGlosa, DadosPrestador } from "@/lib/types-cobranca";
import { prontuarioToMarkdown } from "@/lib/prontuario-markdown";

/**
 * Dados de demonstração (modo Demo).
 *
 * Gera pacientes, agenda (passado/hoje/futuro), prontuários com transcrição e
 * evidências, odontogramas e cobranças em vários estágios — tudo relativo à
 * data de hoje, para a demo sempre parecer "viva". Escreve direto no
 * localStorage nas MESMAS chaves usadas pelo app; o chamador recarrega a página.
 *
 * Todos os nomes, CPFs, carteirinhas e CNPJ são fictícios.
 */

export const DEMO_FLAG_KEY = "jasmin_demo";

const DEMO_KEYS = [
  "jasmin_patients",
  "jasmin_appointments",
  "jasmin_prontuarios",
  "jasmin_prontuarios_md",
  "jasmin_transcricoes",
  "jasmin_odontogramas",
  "jasmin_cobrancas",
  "jasmin_prestador",
  "jasmin_documentos",
  "jasmin_chats",
  "jasmin_active_chat",
  "jasmin_chat_history",
  "jasmin_patient_view_mode",
  DEMO_FLAG_KEY,
  "jasmin_demo_ref",
];

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const pad = (n: number) => String(n).padStart(2, "0");
const isoDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fromKey = (k: string) => {
  const [y, m, d] = k.split("-").map(Number);
  return new Date(y, m - 1, d, 12, 0, 0);
};
const addDays = (d: Date, n: number) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};

const aptColors = (type: string) => {
  const t = type.toLowerCase();
  if (t === "retorno") return { bg: "rgba(59,130,246,0.1)", border: "rgba(59,130,246,0.25)", color: "#1d4ed8" };
  if (t === "emergência") return { bg: "rgba(239,68,68,0.1)", border: "rgba(239,68,68,0.25)", color: "#b91c1c" };
  if (t === "check-up") return { bg: "rgba(34,197,94,0.1)", border: "rgba(34,197,94,0.25)", color: "#166534" };
  return { bg: "rgba(252,94,14,0.09)", border: "rgba(252,94,14,0.22)", color: "#b84c0f" };
};

export const DEMO_PRESTADOR: DadosPrestador = {
  clinica_nome: "Clínica Odontológica Sorriso Vivo",
  clinica_cnpj: "12.345.678/0001-90",
  dentista_nome: "Dra. Helena Duarte",
  dentista_cro: "CRO-SP 98765",
  codigo_operadora_unimed: "100001",
  codigo_operadora_amil: "100002",
  codigo_operadora_bradesco: "100003",
};

// ─────────────────────────────────────────────────────────────────────────────
// Pacientes
// ─────────────────────────────────────────────────────────────────────────────

type Seed = [nome: string, sobrenome: string, nasc: string, genero: string, convenio: string, cidade: string, inativo?: boolean];

const PATIENT_SEEDS: Seed[] = [
  ["Maria Fernanda", "Costa", "1985-03-12", "Feminino", "Unimed", "São Paulo"],
  ["João Pedro", "Almeida", "1992-07-21", "Masculino", "Amil", "São Paulo"],
  ["Ana Beatriz", "Souza", "1978-11-05", "Feminino", "Bradesco Saúde", "Guarulhos"],
  ["Carlos Eduardo", "Lima", "1969-01-30", "Masculino", "", "São Paulo"],
  ["Larissa", "Mendes", "2001-09-14", "Feminino", "Unimed", "Osasco"],
  ["Roberto", "Nascimento", "1955-06-02", "Masculino", "SulAmérica", "São Paulo"],
  ["Camila", "Rocha", "1990-12-25", "Feminino", "Amil", "Santo André"],
  ["Pedro Henrique", "Martins", "2014-04-18", "Masculino", "Bradesco Saúde", "São Paulo"],
  ["Juliana", "Ferreira", "1983-08-09", "Feminino", "", "São Caetano do Sul"],
  ["Marcos Vinícius", "Oliveira", "1975-02-17", "Masculino", "Unimed", "São Paulo"],
  ["Fernanda", "Lopes", "1996-10-03", "Feminino", "Amil", "São Paulo"],
  ["Antônio", "Carvalho", "1948-05-27", "Masculino", "", "Barueri", true],
  ["Beatriz", "Tavares", "2005-01-22", "Feminino", "Bradesco Saúde", "São Paulo"],
  ["Rafael", "Gomes", "1988-06-11", "Masculino", "SulAmérica", "Santos"],
];

const strip = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z]/g, "");

function buildPatients(): PatientData[] {
  return PATIENT_SEEDS.map(([nome, sobrenome, nasc, genero, convenio, cidade, inativo], i) => {
    const n = i + 1;
    const first = nome.split(" ")[0];
    return {
      id: `demo-p${pad(n)}`,
      nome,
      sobrenome,
      nomePreferido: first,
      dataNascimento: nasc,
      genero,
      pronomes: genero === "Feminino" ? "ela/dela" : "ele/dele",
      cpf: `${pad(100 + n * 7).slice(-3)}.${pad(200 + n * 3).slice(-3)}.${pad(300 + n * 5).slice(-3)}-${pad(10 + n)}`,
      status: inativo ? "inativo" : "ativo",
      telefone: `(11) 9${8000 + n * 137}-${1000 + n * 291}`.slice(0, 16),
      telefoneFixo: "",
      email: `${strip(first)}.${strip(sobrenome)}@email.com`,
      contatoPreferido: "WhatsApp",
      contatoEmergencia: "",
      telefoneEmergencia: "",
      endereco: `Rua das Acácias, ${100 + n * 12}`,
      cidade,
      cep: `0${1000 + n * 37}-${100 + n * 3}`.slice(0, 9),
      convenio: convenio || undefined,
      carteirinha: convenio ? `0${String(1000000000000 + n * 7919873).slice(0, 15)}` : undefined,
      plano: convenio ? (n % 2 ? "Dental Empresarial" : "Dental Premium") : undefined,
    };
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Casos clínicos (transcrição + prontuário)
// ─────────────────────────────────────────────────────────────────────────────

type CaseKey = "A" | "B" | "C" | "D" | "E" | "F";

interface ClinicalCase {
  transcript: string;
  build: (ctx: { nome: string; convenio: string; carteirinha: string; data: string }) => ProntuarioModel;
  od: Record<number, DenteOdontogramaModel>;
  /** Procedimento faturável + valor unitário (R$) usado na guia. */
  valores: Record<string, number>;
}

const fat = (
  codigo_tuss: string,
  descricao: string,
  elemento_dental: string,
  inclui_etapas: string[],
  quantidade = 1
): ProcedimentoFaturavel => ({
  codigo_tuss,
  descricao,
  elemento_dental,
  quantidade,
  inclui_etapas,
  requer_revisao: false,
  justificativa: "Consolidado a partir das etapas técnicas descritas na consulta.",
});

const base = (
  ctx: { nome: string; convenio: string; carteirinha: string; data: string },
  parts: Omit<ProntuarioModel, "identificacao" | "assinatura_pendente" | "metadata_cobranca">,
  authRequired = false
): ProntuarioModel => {
  const radiografias = parts.plano.procedimentos_faturaveis.filter((f) => /radiograf/i.test(f.descricao));
  return {
    identificacao: {
      nome_paciente: ctx.nome,
      convenio: ctx.convenio,
      carteirinha: ctx.carteirinha,
      dentista: DEMO_PRESTADOR.dentista_nome,
      cro: DEMO_PRESTADOR.dentista_cro,
      data: ctx.data,
    },
    ...parts,
    metadata_cobranca: {
      convenio_nome: ctx.convenio || undefined,
      carteirinha: ctx.carteirinha || undefined,
      raio_x_realizado: radiografias.length > 0 || Boolean(parts.exame.laudo_radiologico),
      raio_x_inicial_final: radiografias.some((r) => r.quantidade >= 2),
      sessoes_realizadas: 1,
      requer_autorizacao_previa: authRequired,
    },
    assinatura_pendente: false,
  };
};

const CASES: Record<CaseKey, ClinicalCase> = {
  // Cárie profunda no 46 → restauração em resina
  A: {
    transcript: `Dentista: Bom dia! O que te traz aqui hoje?
Paciente: Estou com dor num dente de baixo do lado direito, principalmente quando tomo algo gelado.
Dentista: Você tem alguma alergia ou toma algum remédio?
Paciente: Tenho alergia a dipirona. Não tomo nenhum remédio contínuo.
Dentista: Vou examinar. Aqui no dente 46 tem uma cárie profunda na face oclusal, a obturação antiga caiu. Sem mobilidade, gengiva um pouco inflamada. Fiz uma radiografia periapical e a cárie está perto da polpa, sem lesão no ápice.
Dentista: Vou aplicar anestesia local com lidocaína, remover a cárie e fazer a restauração em resina composta.
Paciente: Pode fazer.
Dentista: Pronto, restauração concluída. Se sentir sensibilidade, tome um analgésico comum. Retorno em duas semanas para a limpeza.`,
    od: {
      46: { superficies: { O: "restauracao_resina" }, labels: [], ausente: false },
      36: { superficies: { O: "restauracao_amalgama", D: "restauracao_amalgama" }, labels: [], ausente: false },
    },
    valores: { "81000421": 35, "85100196": 220 },
    build: (ctx) =>
      base(ctx, {
        anamnese: {
          queixa_principal: "Dor em dente inferior direito, principalmente ao frio.",
          historico_medico: "Sem doenças sistêmicas relatadas.",
          medicamentos: [],
          alergias: ["Dipirona"],
        },
        exame: {
          intraoral: "Cárie profunda na face oclusal do 46; obturação antiga perdida. Sem mobilidade.",
          periodonto: "Gengiva marginal levemente inflamada ao redor do 46.",
          odontograma: [{ elemento: "46", status: "cárie oclusal profunda", observacao: "Obturação antiga perdida" }],
          laudo_radiologico: "Radiolucidez oclusal profunda próxima à polpa no 46; sem lesão periapical.",
        },
        diagnostico: {
          cid_codigo: "K02.1",
          cid_descricao: "Cárie da dentina",
          elemento_dental: "46",
          confirmado_por_raio_x: true,
        },
        plano: {
          procedimentos_realizados: ["radiografia periapical", "anestesia local", "remoção de tecido cariado", "restauração em resina composta oclusal"],
          procedimentos_faturaveis: [
            fat("81000421", "Radiografia periapical", "46", ["radiografia periapical"]),
            fat("85100196", "Restauração em resina fotopolimerizável 1 face", "46", ["remoção de tecido cariado", "restauração em resina composta oclusal"]),
          ],
          materiais: "Resina composta fotopolimerizável",
          anestesia: "Lidocaína 2% com epinefrina",
          pos_operatorio: "Analgésico comum se houver sensibilidade.",
          proxima_consulta: "Retorno em 2 semanas para profilaxia.",
        },
        alertas: {
          gaps: [],
          alertas_clinicos: ["Alergia a dipirona — evitar prescrição."],
          inconsistencias: [],
          requer_confirmacao: false,
        },
        evidencias: {
          queixa_principal: ["dor num dente de baixo do lado direito", "quando tomo algo gelado"],
          alergias: ["alergia a dipirona"],
          intraoral: ["cárie profunda na face oclusal", "a obturação antiga caiu"],
          odontograma: ["dente 46 tem uma cárie profunda"],
          laudo_radiologico: ["radiografia periapical", "sem lesão no ápice"],
          procedimentos_realizados: ["remover a cárie", "restauração em resina composta"],
          anestesia: ["anestesia local com lidocaína"],
          pos_operatorio: ["tome um analgésico comum"],
          proxima_consulta: ["Retorno em duas semanas para a limpeza"],
        },
      }),
  },

  // Canal no 36
  B: {
    transcript: `Dentista: Bom dia! Hoje vamos finalizar o tratamento de canal, certo? Como está a dor?
Paciente: Melhorou bastante, doutora. Só incomodava um pouco ao morder.
Dentista: Ótimo. Você usa algum medicamento atualmente?
Paciente: Tomo losartana para pressão. Não tenho alergias.
Dentista: Vou fazer uma radiografia periapical do dente 36 para conferir. O dente 36 é multirradicular, com três canais, e já estava com necrose pulpar. Vou aplicar anestesia, remover o curativo, instrumentar e irrigar os canais com hipoclorito.
Dentista: Agora estou obturando os canais com guta-percha e cimento endodôntico, e fechando com restauração provisória.
Dentista: Fiz uma nova radiografia periapical final e a obturação ficou bem condensada, sem extravasamento. Em uma semana você volta para a restauração definitiva e depois indicamos a coroa.`,
    od: {
      36: { superficies: {}, labels: ["canal"], ausente: false, observacao: "Endodontia concluída — aguardando coroa" },
      18: { superficies: {}, labels: [], ausente: true },
    },
    valores: { "81000421": 35, "85200158": 780 },
    build: (ctx) =>
      base(ctx, {
        anamnese: {
          queixa_principal: "Retorno para finalização do tratamento de canal do dente 36.",
          historico_medico: "Hipertensão controlada.",
          medicamentos: ["Losartana"],
          alergias: [],
          comorbidades: "Hipertensão arterial",
        },
        exame: {
          intraoral: "Dente 36 multirradicular com necrose pulpar, em tratamento endodôntico.",
          odontograma: [{ elemento: "36", status: "tratamento endodôntico", observacao: "Três canais obturados" }],
          laudo_radiologico: "Obturação dos três canais bem condensada, sem extravasamento, ao final do tratamento.",
        },
        diagnostico: {
          cid_codigo: "K04.1",
          cid_descricao: "Necrose da polpa",
          elemento_dental: "36",
          confirmado_por_raio_x: true,
        },
        plano: {
          procedimentos_realizados: ["radiografia periapical inicial", "anestesia", "remoção de curativo", "instrumentação e irrigação com hipoclorito", "obturação dos canais com guta-percha", "restauração provisória", "radiografia periapical final"],
          procedimentos_faturaveis: [
            fat("81000421", "Radiografia periapical", "36", ["radiografia periapical inicial", "radiografia periapical final"], 2),
            fat("85200158", "Tratamento endodôntico multirradicular", "36", ["instrumentação e irrigação com hipoclorito", "obturação dos canais com guta-percha"]),
          ],
          materiais: "Guta-percha, cimento endodôntico, hipoclorito de sódio",
          anestesia: "Anestésico local",
          proxima_consulta: "Retorno em 1 semana para restauração definitiva; avaliar coroa.",
        },
        alertas: {
          gaps: ["Registrar tipo de anestésico utilizado."],
          alertas_clinicos: [],
          inconsistencias: [],
          requer_confirmacao: false,
        },
        evidencias: {
          queixa_principal: ["finalizar o tratamento de canal"],
          medicamentos: ["losartana para pressão"],
          comorbidades: ["losartana para pressão"],
          intraoral: ["multirradicular, com três canais", "necrose pulpar"],
          laudo_radiologico: ["sem extravasamento"],
          procedimentos_realizados: ["instrumentar e irrigar os canais com hipoclorito", "obturando os canais com guta-percha e cimento endodôntico"],
          proxima_consulta: ["Em uma semana você volta para a restauração definitiva"],
        },
      }, true),
  },

  // Gengivite → raspagem + profilaxia
  C: {
    transcript: `Dentista: Olá! Vamos fazer a limpeza hoje, tudo bem? Algum incômodo?
Paciente: A gengiva sangra quando escovo, principalmente na parte de baixo.
Dentista: Você fuma ou tem algum hábito?
Paciente: Não fumo. Só uso fio dental de vez em quando.
Dentista: Estou vendo acúmulo de tártaro nos dentes anteriores inferiores e a gengiva está vermelha e inchada, com sangramento à sondagem. Não há bolsas profundas.
Dentista: Vou fazer a raspagem supragengival, o polimento coronário e uma aplicação tópica de flúor ao final.
Dentista: Terminamos. Capriche no fio dental todos os dias e escove três vezes ao dia. Volte em seis meses para o check-up.`,
    od: { 31: { superficies: {}, labels: [], ausente: false, observacao: "Cálculo supragengival" } },
    valores: { "85300047": 150, "84000198": 90, "84000090": 60 },
    build: (ctx) =>
      base(ctx, {
        anamnese: {
          queixa_principal: "Sangramento gengival à escovação.",
          alergias: [],
          habitos: "Não fumante; uso irregular de fio dental.",
        },
        exame: {
          intraoral: "Acúmulo de cálculo nos dentes anteroinferiores.",
          periodonto: "Gengiva eritematosa e edemaciada, sangramento à sondagem, sem bolsas profundas.",
          odontograma: [{ elemento: "31", status: "cálculo supragengival" }],
        },
        diagnostico: {
          cid_codigo: "K05.1",
          cid_descricao: "Gengivite crônica",
          elemento_dental: "",
          confirmado_por_raio_x: false,
        },
        plano: {
          procedimentos_realizados: ["raspagem supragengival", "polimento coronário", "aplicação tópica de flúor"],
          procedimentos_faturaveis: [
            fat("85300047", "Raspagem supra-gengival", "", ["raspagem supragengival"]),
            fat("84000198", "Profilaxia: polimento coronário", "", ["polimento coronário"]),
            fat("84000090", "Aplicação tópica de flúor", "", ["aplicação tópica de flúor"]),
          ],
          pos_operatorio: "Higiene com fio dental diariamente; escovação 3x ao dia.",
          proxima_consulta: "Check-up em 6 meses.",
        },
        alertas: { gaps: [], alertas_clinicos: [], inconsistencias: [], requer_confirmacao: false },
        evidencias: {
          queixa_principal: ["A gengiva sangra quando escovo"],
          habitos: ["Não fumo", "fio dental de vez em quando"],
          intraoral: ["acúmulo de tártaro nos dentes anteriores inferiores"],
          periodonto: ["gengiva está vermelha e inchada", "sangramento à sondagem"],
          procedimentos_realizados: ["raspagem supragengival", "polimento coronário", "aplicação tópica de flúor"],
          pos_operatorio: ["Capriche no fio dental todos os dias"],
          proxima_consulta: ["Volte em seis meses para o check-up"],
        },
      }),
  },

  // Exodontia de raiz residual (48)
  D: {
    transcript: `Dentista: Bom dia! Me conta o motivo da consulta.
Paciente: Tenho um resto de dente lá no fundo embaixo, do lado direito, que está doendo e inchou a gengiva.
Dentista: Entendi. Você tem alguma doença ou usa algum remédio?
Paciente: Não tenho nada e não tomo remédio. Alergia só a penicilina.
Dentista: No exame, o dente 48 está só com a raiz residual, com a gengiva inflamada em volta. A radiografia periapical mostra a raiz sem lesão extensa. Vou indicar a extração.
Dentista: Fiz anestesia local, luxei e removi a raiz residual do 48 sem intercorrências, e fiz a sutura com dois pontos.
Dentista: Morda a gaze por 30 minutos, evite bochechos hoje e alimentos quentes. Tome o analgésico se doer. Retorno em 7 dias para remover os pontos.`,
    od: { 48: { superficies: {}, labels: [], ausente: true, observacao: "Exodontia de raiz residual" } },
    valores: { "81000421": 35, "82000859": 260 },
    build: (ctx) =>
      base(ctx, {
        anamnese: {
          queixa_principal: "Dor e inchaço gengival em resto radicular inferior direito.",
          alergias: ["Penicilina"],
          medicamentos: [],
        },
        exame: {
          intraoral: "Dente 48 com raiz residual e gengiva inflamada ao redor.",
          odontograma: [{ elemento: "48", status: "raiz residual" }],
          laudo_radiologico: "Raiz residual do 48 sem lesão periapical extensa.",
        },
        diagnostico: {
          cid_codigo: "K08.3",
          cid_descricao: "Raiz dental retida",
          elemento_dental: "48",
          confirmado_por_raio_x: true,
        },
        plano: {
          procedimentos_realizados: ["radiografia periapical", "anestesia local", "exodontia da raiz residual do 48", "sutura com dois pontos"],
          procedimentos_faturaveis: [
            fat("81000421", "Radiografia periapical", "48", ["radiografia periapical"]),
            fat("82000859", "Exodontia de raiz residual", "48", ["exodontia da raiz residual do 48", "sutura com dois pontos"]),
          ],
          anestesia: "Anestesia local",
          pos_operatorio: "Gaze por 30 min; sem bochechos hoje; evitar alimentos quentes.",
          proxima_consulta: "Retorno em 7 dias para remoção de pontos.",
        },
        alertas: {
          gaps: [],
          alertas_clinicos: ["Alergia a penicilina — evitar amoxicilina e derivados."],
          inconsistencias: [],
          requer_confirmacao: false,
        },
        evidencias: {
          queixa_principal: ["resto de dente lá no fundo embaixo", "inchou a gengiva"],
          alergias: ["Alergia só a penicilina"],
          intraoral: ["o dente 48 está só com a raiz residual"],
          laudo_radiologico: ["A radiografia periapical mostra a raiz sem lesão extensa"],
          procedimentos_realizados: ["removi a raiz residual do 48", "sutura com dois pontos"],
          anestesia: ["Fiz anestesia local"],
          pos_operatorio: ["Morda a gaze por 30 minutos", "evite bochechos hoje"],
          proxima_consulta: ["Retorno em 7 dias para remover os pontos"],
        },
      }),
  },

  // Urgência: pulpite no 26
  E: {
    transcript: `Dentista: Pode entrar. O que está acontecendo?
Paciente: Doutora, estou com uma dor horrível no dente de cima do lado esquerdo, desde ontem. Acordei de madrugada de tanta dor e o gelado piora muito.
Dentista: Tem alguma alergia ou usa remédio?
Paciente: Nenhuma alergia. Tomei um ibuprofeno e não resolveu.
Dentista: Pelo exame, o dente 26 tem uma cárie extensa e dor ao frio que demora a passar, compatível com pulpite irreversível. Fiz uma radiografia periapical e vejo a cárie atingindo a polpa.
Dentista: Vou fazer a anestesia, abertura coronária, remoção da polpa inflamada e colocar um curativo endodôntico de urgência com selamento provisório.
Dentista: Pronto, a dor deve aliviar. Você precisa voltar em poucos dias para iniciarmos o tratamento de canal.`,
    od: { 26: { superficies: { O: "carie", M: "carie" }, labels: [], ausente: false, observacao: "Pulpite — curativo de urgência" } },
    valores: { "81000049": 180, "81000421": 35, "85200174": 140 },
    build: (ctx) =>
      base(ctx, {
        anamnese: {
          queixa_principal: "Dor intensa em dente superior esquerdo desde ontem, com despertar noturno.",
          alergias: [],
          medicamentos: ["Ibuprofeno (uso eventual)"],
        },
        exame: {
          intraoral: "Cárie extensa no 26; dor ao frio prolongada.",
          odontograma: [{ elemento: "26", status: "cárie extensa com envolvimento pulpar" }],
          laudo_radiologico: "Cárie atingindo a câmara pulpar do 26.",
        },
        diagnostico: {
          cid_codigo: "K04.0",
          cid_descricao: "Pulpite",
          elemento_dental: "26",
          confirmado_por_raio_x: true,
        },
        plano: {
          procedimentos_realizados: ["radiografia periapical", "anestesia", "abertura coronária", "pulpectomia parcial", "curativo endodôntico de urgência", "selamento provisório"],
          procedimentos_faturaveis: [
            fat("81000049", "Consulta odontológica de Urgência", "", ["consulta de urgência"]),
            fat("81000421", "Radiografia periapical", "26", ["radiografia periapical"]),
            fat("85200174", "Curativo endodôntico em situação de urgência", "26", ["abertura coronária", "curativo endodôntico de urgência", "selamento provisório"]),
          ],
          anestesia: "Anestesia local",
          proxima_consulta: "Retorno em poucos dias para iniciar o tratamento endodôntico.",
        },
        alertas: {
          gaps: ["Confirmar o tipo de anestésico e a dose utilizada."],
          alertas_clinicos: [],
          inconsistencias: [],
          requer_confirmacao: false,
        },
        evidencias: {
          queixa_principal: ["uma dor horrível no dente de cima do lado esquerdo", "Acordei de madrugada"],
          medicamentos: ["Tomei um ibuprofeno"],
          intraoral: ["o dente 26 tem uma cárie extensa", "pulpite irreversível"],
          laudo_radiologico: ["vejo a cárie atingindo a polpa"],
          procedimentos_realizados: ["abertura coronária, remoção da polpa inflamada", "curativo endodôntico de urgência"],
          proxima_consulta: ["voltar em poucos dias para iniciarmos o tratamento de canal"],
        },
      }),
  },

  // Check-up
  F: {
    transcript: `Dentista: Bom dia! Hoje é o seu check-up, certo? Como estão os dentes, algum incômodo?
Paciente: Nenhum, doutora. Só queria fazer a revisão de rotina.
Dentista: Perfeito. Alguma alergia ou medicamento de uso contínuo?
Paciente: Nada disso.
Dentista: Fiz uma radiografia interproximal e vejo uma mancha branca de cárie incipiente no dente 17, na face mesial, ainda no esmalte. Os demais dentes estão sem alterações e a gengiva está saudável.
Dentista: Vamos tratar com aplicação tópica de flúor hoje e monitorar. Mantenha a escovação com creme dental fluoretado.
Dentista: Retorno em seis meses para novo check-up.`,
    od: { 17: { superficies: { M: "selante" }, labels: [], ausente: false, observacao: "Mancha branca incipiente em monitoramento" } },
    valores: { "81000030": 120, "81000375": 45, "84000090": 60 },
    build: (ctx) =>
      base(ctx, {
        anamnese: {
          queixa_principal: "Check-up de rotina, sem queixas.",
          alergias: [],
          medicamentos: [],
        },
        exame: {
          intraoral: "Mancha branca de cárie incipiente no 17 (mesial). Demais dentes sem alterações.",
          periodonto: "Gengiva saudável.",
          odontograma: [{ elemento: "17", status: "cárie incipiente de esmalte", observacao: "Face mesial — monitorar" }],
          laudo_radiologico: "Radiografia interproximal: lesão incipiente restrita ao esmalte no 17.",
        },
        diagnostico: {
          cid_codigo: "K02.0",
          cid_descricao: "Cárie do esmalte",
          elemento_dental: "17",
          confirmado_por_raio_x: true,
        },
        plano: {
          procedimentos_realizados: ["exame clínico", "radiografia interproximal", "aplicação tópica de flúor"],
          procedimentos_faturaveis: [
            fat("81000030", "Consulta odontológica", "", ["exame clínico"]),
            fat("81000375", "Radiografia interproximal - bite-wing", "17", ["radiografia interproximal"]),
            fat("84000090", "Aplicação tópica de flúor", "", ["aplicação tópica de flúor"]),
          ],
          pos_operatorio: "Manter escovação com creme dental fluoretado.",
          proxima_consulta: "Check-up em 6 meses.",
        },
        alertas: { gaps: [], alertas_clinicos: [], inconsistencias: [], requer_confirmacao: false },
        evidencias: {
          queixa_principal: ["Só queria fazer a revisão de rotina"],
          intraoral: ["mancha branca de cárie incipiente no dente 17"],
          periodonto: ["a gengiva está saudável"],
          laudo_radiologico: ["radiografia interproximal"],
          procedimentos_realizados: ["aplicação tópica de flúor"],
          pos_operatorio: ["Mantenha a escovação com creme dental fluoretado"],
          proxima_consulta: ["Retorno em seis meses para novo check-up"],
        },
      }),
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Agenda
// ─────────────────────────────────────────────────────────────────────────────

type Slot = [dayOffset: number, h: number, m: number, durMin: number, patientIdx: number, type: string, caso: CaseKey, semProntuario?: boolean];

const SLOTS: Slot[] = [
  // hoje
  [0, 8, 0, 60, 0, "Consulta", "A"],
  [0, 9, 30, 90, 9, "Consulta", "B"],
  [0, 11, 30, 45, 4, "Retorno", "C"],
  [0, 14, 0, 60, 2, "Consulta", "D"],
  [0, 15, 30, 45, 13, "Emergência", "E"],
  [0, 16, 30, 30, 6, "Check-up", "F"],
  [0, 17, 15, 45, 1, "Avaliação", "A"],
  // passado
  [-1, 9, 0, 60, 5, "Consulta", "B"],
  [-1, 10, 30, 60, 10, "Retorno", "C"],
  [-1, 15, 0, 60, 3, "Consulta", "A"],
  [-2, 8, 30, 60, 8, "Consulta", "D"],
  [-2, 14, 0, 45, 12, "Check-up", "F"],
  [-3, 9, 0, 45, 7, "Check-up", "F"],
  [-3, 11, 0, 90, 1, "Consulta", "B"],
  [-3, 16, 0, 60, 0, "Retorno", "C"],
  [-6, 10, 0, 60, 6, "Consulta", "A"],
  [-6, 15, 0, 60, 9, "Emergência", "E"],
  [-7, 9, 0, 60, 2, "Consulta", "A"],
  [-8, 14, 0, 60, 13, "Consulta", "D"],
  [-9, 9, 30, 60, 4, "Avaliação", "A", true],
  [-10, 11, 0, 45, 10, "Check-up", "F"],
  [-13, 10, 0, 90, 5, "Consulta", "B"],
  [-14, 15, 0, 60, 11, "Retorno", "C"],
  [-16, 9, 0, 60, 3, "Consulta", "A"],
  [-20, 10, 0, 45, 8, "Check-up", "F"],
  // futuro
  [1, 9, 0, 60, 3, "Retorno", "C"],
  [1, 10, 30, 60, 8, "Consulta", "A"],
  [1, 14, 0, 60, 12, "Avaliação", "A"],
  [2, 8, 30, 45, 6, "Retorno", "C"],
  [2, 11, 0, 60, 0, "Consulta", "D"],
  [3, 9, 0, 60, 9, "Retorno", "B"],
  [3, 15, 30, 45, 7, "Check-up", "F"],
  [4, 10, 0, 60, 10, "Consulta", "A"],
  [6, 9, 30, 60, 4, "Retorno", "C"],
  [7, 14, 0, 60, 1, "Check-up", "F"],
  [8, 9, 0, 45, 13, "Retorno", "C"],
  [9, 16, 0, 60, 2, "Consulta", "B"],
];

// ─────────────────────────────────────────────────────────────────────────────
// Modos de demonstração
// ─────────────────────────────────────────────────────────────────────────────

export type DemoMode = "simples" | "completo";

export const DEMO_MODES: Record<DemoMode, { label: string; resumo: string }> = {
  simples: {
    label: "Demo simples",
    resumo: "5 pacientes, 13 consultas e 4 guias — ideal para uma apresentação curta e direta.",
  },
  completo: {
    label: "Demo completa",
    resumo: "14 pacientes, 35 consultas e 12 guias — para mostrar filtros, financeiro e volume.",
  },
};

/** Pacientes (índices em PATIENT_SEEDS) e agenda da demo simples. */
const SIMPLE_PATIENTS = [0, 1, 2, 3, 6]; // Maria, João Pedro, Ana Beatriz, Carlos, Camila
const SIMPLE_SLOTS: Slot[] = [
  // hoje
  [0, 9, 0, 60, 0, "Consulta", "A"],
  [0, 10, 30, 60, 1, "Retorno", "C"],
  [0, 14, 0, 60, 2, "Consulta", "B"],
  [0, 16, 0, 45, 3, "Check-up", "F"],
  // passado
  [-2, 9, 0, 60, 0, "Consulta", "A"],
  [-3, 14, 0, 60, 1, "Consulta", "D"],
  [-5, 10, 0, 60, 2, "Emergência", "E"],
  [-7, 15, 0, 45, 3, "Check-up", "F"],
  [-9, 11, 0, 60, 6, "Retorno", "C"],
  // futuro
  [1, 9, 0, 60, 3, "Retorno", "C"],
  [2, 10, 0, 60, 6, "Consulta", "A"],
  [3, 14, 0, 60, 1, "Retorno", "B"],
  [5, 9, 30, 60, 0, "Retorno", "C"],
];
/** Estágio das guias (da mais antiga para a mais recente): uma de cada, para mostrar o ciclo. */
const SIMPLE_STATUS: CobrancaStatus[] = ["paga", "glosada", "enviada", "revisao_pendente"];

// ─────────────────────────────────────────────────────────────────────────────
// Cobranças
// ─────────────────────────────────────────────────────────────────────────────

const OPERADORA: Record<string, string> = {
  Unimed: DEMO_PRESTADOR.codigo_operadora_unimed ?? "",
  Amil: DEMO_PRESTADOR.codigo_operadora_amil ?? "",
  "Bradesco Saúde": DEMO_PRESTADOR.codigo_operadora_bradesco ?? "",
  SulAmérica: "100004",
};

function buildGuia(p: ProntuarioModel, valores: Record<string, number>, patient: PatientData, alertas: AlertaGlosa[]): GuiaSPSADT {
  const procedimentos: ProcedimentoGuia[] = p.plano.procedimentos_faturaveis.map((f) => ({
    codigo_tuss: f.codigo_tuss,
    descricao: f.descricao,
    quantidade: f.quantidade,
    elemento_dental: f.elemento_dental,
    valor_unitario: valores[f.codigo_tuss],
    fonte: "prontuario",
  }));
  const urgencia = procedimentos.some((x) => x.codigo_tuss === "81000049");
  return {
    clinica_nome: DEMO_PRESTADOR.clinica_nome,
    clinica_cnpj: DEMO_PRESTADOR.clinica_cnpj,
    dentista_nome: DEMO_PRESTADOR.dentista_nome,
    dentista_cro: DEMO_PRESTADOR.dentista_cro,
    codigo_operadora: OPERADORA[patient.convenio ?? ""] ?? "",
    paciente_nome: `${patient.nome} ${patient.sobrenome}`,
    carteirinha: patient.carteirinha ?? "",
    convenio: patient.convenio ?? "",
    plano: patient.plano,
    data_realizacao: p.identificacao.data,
    tipo_atendimento: urgencia ? "urgencia" : "procedimento",
    requer_autorizacao: p.metadata_cobranca.requer_autorizacao_previa,
    requer_autorizacao_motivo: p.metadata_cobranca.requer_autorizacao_previa
      ? "Tratamento endodôntico costuma exigir autorização prévia."
      : undefined,
    numero_autorizacao: p.metadata_cobranca.requer_autorizacao_previa ? "AUT-2026-" + (10000 + p.identificacao.data.length * 137) : undefined,
    procedimentos,
    cid_codigo: p.diagnostico.cid_codigo,
    cid_descricao: p.diagnostico.cid_descricao,
    indicacao_clinica: p.anamnese.queixa_principal,
    alertas_glosa: alertas,
    documentacao_obrigatoria: p.metadata_cobranca.raio_x_realizado ? ["Radiografia periapical anexada"] : [],
    convenio_regras_aplicadas: ["RN ANS 465/2021 — Rol de Procedimentos", "Tabela TUSS odontológica vigente"],
  };
}

function statusForIndex(i: number, n: number): CobrancaStatus {
  if (i % 5 === 3) return "glosada";
  const r = i / n;
  if (r < 0.4) return "paga";
  if (r < 0.65) return "enviada";
  if (r < 0.85) return "aprovada";
  return "revisao_pendente";
}

const GLOSA_MOTIVOS = [
  "Radiografia comprobatória não anexada à guia.",
  "Procedimento sem autorização prévia da operadora.",
];

// ─────────────────────────────────────────────────────────────────────────────
// Montagem
// ─────────────────────────────────────────────────────────────────────────────

export interface DemoBundle {
  patients: PatientData[];
  appointments: AgAppointment[];
  prontuarios: Record<string, ProntuarioModel>;
  prontuariosMd: Record<string, string>;
  transcricoes: Record<string, string>;
  odontogramas: Record<string, OdontogramaModel>;
  cobrancas: Record<string, CobrancaModel>;
  prestador: DadosPrestador;
}

/**
 * `now` = relógio real; `ref` = dia que vira o "hoje" da demo (ex.: o dia da apresentação).
 * Quando `ref` é futuro, o dia de referência fica inteiro por fazer (para gravar ao vivo) e
 * tudo antes dele já aparece como realizado, com prontuário.
 */
export function buildDemoData(now: Date = new Date(), mode: DemoMode = "completo", ref?: Date): DemoBundle {
  const base = ref ?? now;
  const refIsFuture = isoDate(base) > isoDate(now);
  const allPatients = buildPatients();
  const patients = mode === "simples" ? SIMPLE_PATIENTS.map((i) => allPatients[i]) : allPatients;
  const slots = mode === "simples" ? SIMPLE_SLOTS : SLOTS;
  const appointments: AgAppointment[] = [];
  const prontuarios: Record<string, ProntuarioModel> = {};
  const prontuariosMd: Record<string, string> = {};
  const transcricoes: Record<string, string> = {};
  const odontogramas: Record<string, OdontogramaModel> = {};
  const cobrancas: Record<string, CobrancaModel> = {};

  const nowMin = now.getHours() * 60 + now.getMinutes();
  const completed: { id: number; patient: PatientData; caso: CaseKey; data: string; at: number }[] = [];
  let seq = 0;

  for (const [off, h, m, dur, pi, type, caso, semPront] of slots) {
    const day = addDays(base, off);
    if (day.getDay() === 0) continue; // sem domingo
    const date = isoDate(day);
    const patient = allPatients[pi];
    const startMin = h * 60 + m;
    const endMin = startMin + dur;
    seq += 1;
    const id = 9_000_000 + seq;
    const c = aptColors(type);
    appointments.push({
      id,
      patient: `${patient.nome} ${patient.sobrenome}`,
      patientId: patient.id,
      date,
      startH: h,
      startM: m,
      endH: Math.floor(endMin / 60),
      endM: endMin % 60,
      type,
      bg: c.bg,
      border: c.border,
      color: c.color,
    });

    const isPast = off < 0 || (off === 0 && !refIsFuture && endMin <= nowMin);
    if (!isPast || semPront) continue;

    const cs = CASES[caso];
    const model = cs.build({
      nome: `${patient.nome} ${patient.sobrenome}`,
      convenio: patient.convenio ?? "",
      carteirinha: patient.carteirinha ?? "",
      data: date,
    });
    // Consultas de hoje simulam prontuários NOVOS: sem faturáveis consolidados. Ao
    // gerar a guia, o agente de cobrança faz a consolidação TUSS ao vivo.
    if (off === 0) model.plano.procedimentos_faturaveis = [];
    prontuarios[String(id)] = model;
    prontuariosMd[String(id)] = prontuarioToMarkdown(model);
    transcricoes[String(id)] = cs.transcript;
    completed.push({ id, patient, caso, data: date, at: day.getTime() + startMin * 60_000 });

    // Odontograma do paciente = merge dos casos dele
    const od = odontogramas[patient.id] ?? { dentes: {}, ultima_atualizacao: new Date(day.getTime()).toISOString() };
    for (const [tooth, d] of Object.entries(cs.od)) od.dentes[Number(tooth)] = d;
    odontogramas[patient.id] = od;
  }

  // Detalhes extras de odontograma para dar "vida" à aba
  const extras: Record<string, Record<number, DenteOdontogramaModel>> = {
    "demo-p01": { 14: { superficies: { O: "restauracao_resina" }, labels: [], ausente: false }, 37: { superficies: {}, labels: ["coroa"], ausente: false } },
    "demo-p06": { 11: { superficies: {}, labels: ["protese"], ausente: false }, 21: { superficies: {}, labels: ["protese"], ausente: false }, 36: { superficies: {}, labels: ["implante"], ausente: false } },
    "demo-p10": { 16: { superficies: { O: "restauracao_amalgama" }, labels: [], ausente: false }, 25: { superficies: { D: "carie" }, labels: [], ausente: false } },
  };
  for (const [pid, teeth] of Object.entries(extras)) {
    if (!patients.some((p) => p.id === pid)) continue;
    const od = odontogramas[pid] ?? { dentes: {}, ultima_atualizacao: base.toISOString() };
    for (const [t, d] of Object.entries(teeth)) od.dentes[Number(t)] ??= d;
    odontogramas[pid] = od;
  }

  // Cobranças: só consultas passadas (não de hoje) de pacientes com convênio.
  // As de hoje ficam sem guia para o dentista gerar ao vivo na demo.
  const todayKey = isoDate(base);
  const billable = completed
    .filter((c) => c.patient.convenio && c.data < todayKey)
    .sort((a, b) => a.at - b.at);
  billable.forEach((c, i) => {
    const status = mode === "simples" ? SIMPLE_STATUS[i] ?? statusForIndex(i, billable.length) : statusForIndex(i, billable.length);
    const model = prontuarios[String(c.id)];
    const alertas: AlertaGlosa[] = [];
    if (status === "revisao_pendente" && i % 2 === 0) {
      alertas.push({
        tipo: "atencao",
        campo: "documentacao",
        mensagem: "Confirme se a radiografia está anexada ao prontuário antes do envio.",
        acao_recomendada: "Anexar a radiografia periapical à guia.",
      });
    }
    if (status === "revisao_pendente" && c.caso === "B") {
      alertas.push({
        tipo: "critico",
        campo: "autorizacao",
        mensagem: "Tratamento endodôntico multirradicular normalmente exige autorização prévia.",
        acao_recomendada: "Registrar o número da autorização na guia.",
      });
    }
    const guia = buildGuia(model, CASES[c.caso].valores, c.patient, alertas);
    const total = guia.procedimentos.reduce((s, p) => s + (p.valor_unitario ?? 0) * p.quantidade, 0);
    const geradoEm = new Date(c.at + 3 * 3600_000).toISOString();
    const cob: CobrancaModel = {
      appointmentId: c.id,
      patientId: c.patient.id,
      status,
      guia,
      gerado_em: geradoEm,
      trace: [
        { timestamp: geradoEm, tipo: "search", mensagem: "Consultando a tabela TUSS para os procedimentos do prontuário." },
        { timestamp: geradoEm, tipo: "decision", mensagem: "Procedimentos já consolidados no prontuário — usando os códigos TUSS registrados." },
      ],
    };
    if (status !== "revisao_pendente") cob.aprovado_em = new Date(c.at + 24 * 3600_000).toISOString();
    if (status === "enviada" || status === "paga" || status === "glosada") cob.enviado_em = new Date(c.at + 2 * 24 * 3600_000).toISOString();
    if (status === "paga") {
      cob.baixa_em = new Date(c.at + 12 * 24 * 3600_000).toISOString();
      cob.valor_recebido = Math.round(total * 0.97 * 100) / 100;
    }
    if (status === "glosada") {
      cob.baixa_em = new Date(c.at + 12 * 24 * 3600_000).toISOString();
      cob.glosa_motivo = GLOSA_MOTIVOS[i % GLOSA_MOTIVOS.length];
    }
    cobrancas[String(c.id)] = cob;
  });

  return { patients, appointments, prontuarios, prontuariosMd, transcricoes, odontogramas, cobrancas, prestador: DEMO_PRESTADOR };
}

// ─────────────────────────────────────────────────────────────────────────────
// Persistência (localStorage)
// ─────────────────────────────────────────────────────────────────────────────

/** Apaga TODOS os dados locais do Jasmin (pacientes, agenda, prontuários, etc.). */
export function clearAllLocalData(): void {
  try {
    for (const key of DEMO_KEYS) window.localStorage.removeItem(key);
  } catch {
    /* ignora */
  }
}

/** Substitui os dados locais pelo conjunto de demonstração. O chamador recarrega a página. */
export function loadDemoData(mode: DemoMode = "completo", refDateKey?: string): void {
  const ref = refDateKey && /^\d{4}-\d{2}-\d{2}$/.test(refDateKey) ? fromKey(refDateKey) : undefined;
  const d = buildDemoData(new Date(), mode, ref);
  clearAllLocalData();
  const set = (k: string, v: unknown) => window.localStorage.setItem(k, JSON.stringify(v));
  set("jasmin_patients", d.patients);
  set("jasmin_appointments", d.appointments);
  set("jasmin_prontuarios", d.prontuarios);
  set("jasmin_prontuarios_md", d.prontuariosMd);
  set("jasmin_transcricoes", d.transcricoes);
  set("jasmin_odontogramas", d.odontogramas);
  set("jasmin_cobrancas", d.cobrancas);
  set("jasmin_prestador", d.prestador);
  window.localStorage.setItem(DEMO_FLAG_KEY, mode);
  window.localStorage.setItem("jasmin_demo_ref", refDateKey ?? isoDate(new Date()));
}

/** Dia de referência da demo carregada ("YYYY-MM-DD"), ou null. */
export function getDemoRef(): string | null {
  try {
    return window.localStorage.getItem("jasmin_demo_ref");
  } catch {
    return null;
  }
}

/** Modo da demo carregada ("1" = valor antigo, equivalente a completo), ou null. */
export function getDemoMode(): DemoMode | null {
  try {
    const v = window.localStorage.getItem(DEMO_FLAG_KEY);
    if (v === "simples") return "simples";
    if (v === "completo" || v === "1") return "completo";
    return null;
  } catch {
    return null;
  }
}

export function isDemoActive(): boolean {
  return getDemoMode() !== null;
}
