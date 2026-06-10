import type { TussEntry } from "@/lib/types-cobranca";

/**
 * FALLBACK ONLY — usado quando o RAG server (scripts/rag_server.py) está
 * indisponível. Em operação normal, searchTuss consulta o ChromaDB (embeddings
 * dos documentos reais da knowledge_base/). Esta tabela é o plano B: match por
 * sinônimos (string includes) sobre os procedimentos mais comuns.
 *
 * Sem regras por convênio (proprietárias, fora das bases públicas): apenas um
 * flag genérico requer_autorizacao. Quando o RAG está no ar, é ele quem decide
 * autorização/documentação a partir das tabelas TUSS indexadas.
 */

export const TUSS_LOOKUP: TussEntry[] = [
  // ── Endodontia ────────────────────────────────────────────────────────────
  {
    codigo_tuss: "81000030",
    descricao_oficial: "Tratamento endodôntico de dente permanente unirradicular",
    sinonimos: [
      "canal",
      "endodontia",
      "tratamento de canal",
      "canal unirradicular",
      "canal dente anterior",
      "canal incisivo",
      "canal canino",
    ],
    categoria: "Endodontia",
    requer_autorizacao: true,
    documentacao_obrigatoria: [
      "raio-x periapical inicial",
      "raio-x periapical final",
      "odontometria",
    ],
  },
  {
    codigo_tuss: "81000049",
    descricao_oficial: "Tratamento endodôntico de dente permanente birradicular",
    sinonimos: [
      "canal birradicular",
      "canal pré-molar",
      "canal pre-molar",
      "canal dente dois raízes",
      "canal dente duas raizes",
    ],
    categoria: "Endodontia",
    requer_autorizacao: true,
    documentacao_obrigatoria: [
      "raio-x periapical inicial",
      "raio-x periapical final",
      "odontometria",
    ],
  },
  {
    codigo_tuss: "81000057",
    descricao_oficial: "Tratamento endodôntico de dente permanente multirradicular",
    sinonimos: [
      "canal multirradicular",
      "canal molar",
      "canal dente três raízes",
      "canal dente tres raizes",
      "canal 36",
      "canal 46",
    ],
    categoria: "Endodontia",
    requer_autorizacao: true,
    documentacao_obrigatoria: [
      "raio-x periapical inicial",
      "raio-x periapical final",
      "odontometria",
    ],
  },

  // ── Dentística / Restaurações ─────────────────────────────────────────────
  {
    codigo_tuss: "82000240",
    descricao_oficial: "Restauração em resina composta — uma face",
    sinonimos: [
      "restauração",
      "restauracao",
      "obturação",
      "obturacao",
      "resina",
      "restauração simples",
      "obturação simples",
      "buracho no dente",
      "buraco no dente",
    ],
    categoria: "Dentística",
    requer_autorizacao: false,
    documentacao_obrigatoria: ["raio-x interproximal ou periapical da região"],
  },
  {
    codigo_tuss: "82000259",
    descricao_oficial: "Restauração em resina composta — duas faces",
    sinonimos: [
      "restauração duas faces",
      "restauracao duas faces",
      "restauração mod",
      "restauração mo",
      "restauração do",
      "obturação duas faces",
    ],
    categoria: "Dentística",
    requer_autorizacao: false,
    documentacao_obrigatoria: ["raio-x interproximal ou periapical da região"],
  },

  // ── Cirurgia / Exodontia ──────────────────────────────────────────────────
  {
    codigo_tuss: "81000120",
    descricao_oficial: "Exodontia simples de dente permanente",
    sinonimos: [
      "extração",
      "extracao",
      "arrancar dente",
      "exodontia",
      "tirar dente",
      "extração simples",
    ],
    categoria: "Cirurgia",
    requer_autorizacao: true,
    documentacao_obrigatoria: ["raio-x periapical pré-operatório"],
  },
  {
    codigo_tuss: "81000138",
    descricao_oficial: "Exodontia de dente incluso / impactado",
    sinonimos: [
      "extração siso",
      "extracao siso",
      "dente do siso",
      "dente incluso",
      "extração cirúrgica",
      "dente impactado",
    ],
    categoria: "Cirurgia",
    requer_autorizacao: true,
    documentacao_obrigatoria: [
      "raio-x panorâmico ou periapical",
      "laudo de impactação",
    ],
  },

  // ── Periodontia ───────────────────────────────────────────────────────────
  {
    codigo_tuss: "83000030",
    descricao_oficial: "Raspagem supra e subgengival por sextante",
    sinonimos: [
      "raspagem",
      "limpeza profunda",
      "raspagem periodontal",
      "destartarização profunda",
      "destartarizacao profunda",
    ],
    categoria: "Periodontia",
    requer_autorizacao: true,
    documentacao_obrigatoria: [
      "periograma / sondagem periodontal",
      "raio-x da região",
    ],
  },
  {
    codigo_tuss: "84000030",
    descricao_oficial: "Profilaxia / polimento coronário",
    sinonimos: [
      "limpeza",
      "profilaxia",
      "limpeza dental",
      "destartarização",
      "destartarizacao",
      "remoção de tártaro",
      "remocao de tartaro",
    ],
    categoria: "Prevenção",
    requer_autorizacao: false,
    documentacao_obrigatoria: [],
  },

  // ── Consulta e diagnóstico ────────────────────────────────────────────────
  {
    codigo_tuss: "81000014",
    descricao_oficial: "Consulta odontológica inicial",
    sinonimos: [
      "consulta",
      "avaliação",
      "avaliacao",
      "primeira consulta",
      "consulta inicial",
      "anamnese",
    ],
    categoria: "Consulta",
    requer_autorizacao: false,
    documentacao_obrigatoria: [],
  },
  {
    codigo_tuss: "81000080",
    descricao_oficial: "Radiografia periapical",
    sinonimos: [
      "raio-x",
      "raio x",
      "radiografia",
      "rx",
      "raio x periapical",
      "radiografia periapical",
    ],
    categoria: "Radiologia",
    requer_autorizacao: false,
    documentacao_obrigatoria: [],
  },
  {
    codigo_tuss: "81000098",
    descricao_oficial: "Radiografia panorâmica",
    sinonimos: [
      "panorâmica",
      "panoramica",
      "raio-x panorâmico",
      "raio x panoramico",
      "ortopantomografia",
    ],
    categoria: "Radiologia",
    requer_autorizacao: false,
    documentacao_obrigatoria: [],
  },

  // ── Procedimentos comuns inferidos (clínica geral) ────────────────────────
  {
    codigo_tuss: "82000267",
    descricao_oficial: "Restauração em resina composta — três ou mais faces",
    sinonimos: [
      "restauração três faces",
      "restauracao tres faces",
      "restauração mod ampla",
      "restauração extensa",
      "obturação grande",
    ],
    categoria: "Dentística",
    requer_autorizacao: false,
    documentacao_obrigatoria: ["raio-x periapical da região"],
  },
  {
    codigo_tuss: "85100072",
    descricao_oficial: "Faceta direta em resina composta",
    sinonimos: [
      "faceta",
      "faceta de resina",
      "faceta direta",
      "lente de resina",
    ],
    categoria: "Dentística",
    requer_autorizacao: true,
    documentacao_obrigatoria: ["foto clínica inicial", "raio-x da região"],
  },
  {
    codigo_tuss: "87000114",
    descricao_oficial: "Núcleo de preenchimento / pino intrarradicular",
    sinonimos: [
      "núcleo",
      "nucleo",
      "pino",
      "pino de fibra",
      "núcleo de preenchimento",
      "retentor intrarradicular",
    ],
    categoria: "Prótese",
    requer_autorizacao: true,
    documentacao_obrigatoria: ["raio-x periapical pós-endodontia"],
  },
  {
    codigo_tuss: "87000300",
    descricao_oficial: "Coroa total / unitária",
    sinonimos: [
      "coroa",
      "coroa total",
      "coroa de porcelana",
      "coroa unitária",
      "capa no dente",
    ],
    categoria: "Prótese",
    requer_autorizacao: true,
    documentacao_obrigatoria: [
      "raio-x periapical do elemento",
      "foto clínica",
    ],
  },
  {
    codigo_tuss: "81000065",
    descricao_oficial: "Pulpotomia / capeamento pulpar",
    sinonimos: [
      "pulpotomia",
      "capeamento pulpar",
      "capeamento",
      "remoção parcial da polpa",
    ],
    categoria: "Endodontia",
    requer_autorizacao: false,
    documentacao_obrigatoria: ["raio-x periapical inicial"],
  },
  {
    codigo_tuss: "84000048",
    descricao_oficial: "Aplicação tópica de flúor / selante de fóssulas e fissuras",
    sinonimos: [
      "flúor",
      "fluor",
      "aplicação de flúor",
      "selante",
      "selante de fóssulas",
      "selante de fissura",
    ],
    categoria: "Prevenção",
    requer_autorizacao: false,
    documentacao_obrigatoria: [],
  },
  {
    codigo_tuss: "85200116",
    descricao_oficial: "Clareamento dental de consultório (por arcada)",
    sinonimos: [
      "clareamento",
      "clareamento dental",
      "clareamento a laser",
      "branqueamento",
    ],
    categoria: "Estética",
    requer_autorizacao: true,
    documentacao_obrigatoria: ["foto clínica inicial"],
  },
  {
    codigo_tuss: "83000111",
    descricao_oficial: "Gengivectomia / gengivoplastia por sextante",
    sinonimos: [
      "gengivectomia",
      "gengivoplastia",
      "remoção de gengiva",
      "cirurgia gengival",
    ],
    categoria: "Periodontia",
    requer_autorizacao: true,
    documentacao_obrigatoria: [
      "periograma",
      "foto clínica inicial",
    ],
  },
  {
    codigo_tuss: "81000260",
    descricao_oficial: "Drenagem de abscesso intra ou extraoral",
    sinonimos: [
      "drenagem",
      "drenagem de abscesso",
      "abscesso",
      "drenar pus",
      "incisão e drenagem",
    ],
    categoria: "Cirurgia",
    requer_autorizacao: false,
    documentacao_obrigatoria: ["raio-x periapical da região"],
  },
  {
    codigo_tuss: "81000287",
    descricao_oficial: "Tratamento de alveolite",
    sinonimos: [
      "alveolite",
      "tratamento de alveolite",
      "alvéolo seco",
      "alveolo seco",
      "curetagem alveolar",
    ],
    categoria: "Cirurgia",
    requer_autorizacao: false,
    documentacao_obrigatoria: [],
  },
  {
    codigo_tuss: "81000110",
    descricao_oficial: "Restauração provisória / curativo de demora",
    sinonimos: [
      "curativo",
      "curativo de demora",
      "restauração provisória",
      "restauracao provisoria",
      "selamento provisório",
    ],
    categoria: "Dentística",
    requer_autorizacao: false,
    documentacao_obrigatoria: [],
  },
];
