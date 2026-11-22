import type { TussEntry } from "@/lib/types-cobranca";

/**
 * FALLBACK ONLY — códigos conferidos contra a tabela oficial (lib/tuss-data.ts) — usado quando o RAG server (scripts/rag_server.py) está
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
    codigo_tuss: "85200166",
    descricao_oficial: "Tratamento endodôntico unirradicular",
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
    codigo_tuss: "85200140",
    descricao_oficial: "Tratamento endodôntico birradicular",
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
    codigo_tuss: "85200158",
    descricao_oficial: "Tratamento endodôntico multirradicular",
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
    codigo_tuss: "85100196",
    descricao_oficial: "Restauração em resina fotopolimerizável 1 face",
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
    codigo_tuss: "85100200",
    descricao_oficial: "Restauração em resina fotopolimerizável 2 faces",
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
    codigo_tuss: "82000875",
    descricao_oficial: "Exodontia simples de permanente",
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
    codigo_tuss: "82001286",
    descricao_oficial: "Remoção de dentes inclusos / impactados",
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
    codigo_tuss: "85300047",
    descricao_oficial: "Raspagem supra-gengival",
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
    codigo_tuss: "84000198",
    descricao_oficial: "Profilaxia: polimento coronário",
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
    codigo_tuss: "81000065",
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
    codigo_tuss: "81000421",
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
    codigo_tuss: "81000405",
    descricao_oficial: "Radiografia panorâmica de mandíbula/maxila (ortopantomografia)",
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
    codigo_tuss: "85100218",
    descricao_oficial: "Restauração em resina fotopolimerizável 3 faces",
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
    codigo_tuss: "85100064",
    descricao_oficial: "Faceta direta em resina fotopolimerizável",
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
    codigo_tuss: "85400211",
    descricao_oficial: "Núcleo de preenchimento",
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
    codigo_tuss: "85400157",
    descricao_oficial: "Coroa total metalo cerâmica",
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
    codigo_tuss: "85200042",
    descricao_oficial: "Pulpotomia",
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
    codigo_tuss: "84000090",
    descricao_oficial: "Aplicação tópica de flúor",
    sinonimos: [
      "flúor",
      "fluor",
      "aplicação de flúor",
    ],
    categoria: "Prevenção",
    requer_autorizacao: false,
    documentacao_obrigatoria: [],
  },
  {
    codigo_tuss: "84000074",
    descricao_oficial: "Aplicação de selante de fóssulas e fissuras",
    sinonimos: ["selante", "selante de fóssulas", "selante de fissura"],
    categoria: "Prevenção",
    requer_autorizacao: false,
    documentacao_obrigatoria: [],
  },
  {
    codigo_tuss: "85100030",
    descricao_oficial: "Clareamento dentário de consultório",
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
    codigo_tuss: "82000921",
    descricao_oficial: "Gengivectomia",
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
    codigo_tuss: "82001030",
    descricao_oficial: "Incisão e Drenagem intra-oral de abscesso, hematoma e/ou flegmão da região buco-maxilo-facial",
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
    codigo_tuss: "82001650",
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
    codigo_tuss: "85100056",
    descricao_oficial: "Curativo de demora em endodontia",
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
