import type { ProntuarioModel } from "@/lib/types-prontuario";
import { procedimentosRealizados } from "@/lib/types-prontuario";

/**
 * Gera o prontuário em Markdown a partir do ProntuarioModel — DETERMINÍSTICO,
 * sem chamar LLM. A estrutura é fixa e estável porque será consumida pelo
 * futuro agente de cobrança.
 */

const DASH = "—";
const val = (v?: string): string => {
  const s = (v ?? "").trim();
  return s ? s : DASH;
};
const list = (v?: string[]): string => {
  const arr = (v ?? []).map((x) => x.trim()).filter(Boolean);
  return arr.length ? arr.join(", ") : DASH;
};
const simNao = (b: boolean): string => (b ? "Sim" : "Não");

export function prontuarioToMarkdown(p: ProntuarioModel): string {
  const id = p.identificacao;
  const a = p.anamnese;
  const e = p.exame;
  const d = p.diagnostico;
  const pl = p.plano;
  const mc = p.metadata_cobranca;
  const al = p.alertas;

  const cid = d.cid_codigo
    ? `${d.cid_codigo}${d.cid_descricao ? ` — ${d.cid_descricao}` : ""}`
    : DASH;

  const odonto =
    e.odontograma.length > 0
      ? e.odontograma
          .map((t) => `- Elemento ${t.elemento}: ${t.status}${t.observacao ? ` (${t.observacao})` : ""}`)
          .join("\n")
      : DASH;

  const alertasItens = [
    ...al.alertas_clinicos.map((x) => `⚠️ ${x}`),
    ...al.inconsistencias.map((x) => `⚠️ Inconsistência: ${x}`),
    ...al.gaps.map((x) => `⚠️ Gap: ${x}`),
  ];
  const alertasBlock = alertasItens.length ? alertasItens.join("\n") : "Nenhum alerta.";

  const realizados = procedimentosRealizados(pl);

  // Seção de procedimentos faturáveis (consolidados pelo Passo 4), legível para
  // a guia. Consumida pelo agente de cobrança a partir do JSON, não daqui — esta
  // seção é só para leitura humana.
  const faturaveis = pl.procedimentos_faturaveis ?? [];
  const faturaveisBlock = faturaveis.length
    ? faturaveis
        .map((f) => {
          const cod = f.codigo_tuss && f.codigo_tuss !== "MANUAL" ? f.codigo_tuss : "(a definir)";
          const dente = f.elemento_dental ? ` (dente ${f.elemento_dental})` : "";
          const revisar = f.requer_revisao ? " ⚠️ Revisar" : "";
          const inclui = f.inclui_etapas.length ? `\n  Inclui: ${f.inclui_etapas.join(", ")}` : "";
          return `- ${cod} — ${f.descricao}${dente}${revisar}${inclui}`;
        })
        .join("\n")
    : DASH;

  const lines = [
    `# Prontuário — ${val(id.nome_paciente)} — ${val(id.data)}`,
    ``,
    `## Identificação`,
    `Paciente: ${val(id.nome_paciente)} | Convênio: ${val(id.convenio)} | Carteirinha: ${val(id.carteirinha)} | Dentista: ${val(id.dentista)} | CRO: ${val(id.cro)}`,
    ``,
    `## Anamnese`,
    `**Queixa principal:** ${val(a.queixa_principal)}`,
    `**Medicamentos em uso:** ${list(a.medicamentos)}`,
    `**Alergias:** ⚠️ ${list(a.alergias)}`,
    `**Histórico médico:** ${val(a.historico_medico)}`,
    `**Hábitos:** ${val(a.habitos)}`,
    `**Comorbidades:** ${val(a.comorbidades)}`,
    ``,
    `## Diagnóstico`,
    `**CID:** ${cid}`,
    `**Elemento dental:** ${val(d.elemento_dental)}`,
    `**Confirmado por raio-x:** ${simNao(d.confirmado_por_raio_x)}`,
    ``,
    `## Exame clínico`,
    `**Extraoral:** ${val(e.extraoral)}`,
    `**Intraoral:** ${val(e.intraoral)}`,
    `**Periodonto:** ${val(e.periodonto)}`,
    `**Oclusão:** ${val(e.oclusao)}`,
    `**Odontograma:**`,
    odonto,
    `**Laudo radiológico:** ${val(e.laudo_radiologico)}`,
    ``,
    `## Plano de tratamento`,
    `**Procedimentos realizados:** ${list(realizados)}`,
    `**Materiais:** ${val(pl.materiais)}`,
    `**Anestesia:** ${val(pl.anestesia)}`,
    `**Pós-operatório:** ${val(pl.pos_operatorio)}`,
    `**Próxima consulta:** ${val(pl.proxima_consulta)}`,
    ``,
    `## Procedimentos faturáveis`,
    faturaveisBlock,
    ``,
    `## Metadata de cobrança`,
    `**Convênio:** ${val(mc.convenio_nome)} | **Carteirinha:** ${val(mc.carteirinha)}`,
    `**Raio-x realizado:** ${simNao(mc.raio_x_realizado)} | **Sessões:** ${mc.sessoes_realizadas}`,
    `**Requer autorização prévia:** ${simNao(mc.requer_autorizacao_previa)}`,
    ``,
    `## Alertas`,
    alertasBlock,
    ``,
  ];

  return lines.join("\n");
}
