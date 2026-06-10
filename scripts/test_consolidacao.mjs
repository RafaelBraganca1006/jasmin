// Testa a consolidação clínica → faturável do Passo 4 e a geração da guia.
//
// Fluxo:
//   1. POST /api/prontuario com a transcrição de um canal no dente 36.
//   2. Valida plano.procedimentos_faturaveis (canal multirradicular + raio-x;
//      curativo de demora quando sessão não concluída; sem etapas técnicas
//      vazando como itens faturáveis separados).
//   3. Monta um storageSnapshot mínimo e POST /api/cobranca (SSE) e verifica que
//      os faturáveis viram itens da guia sem alertas críticos.
//
// Uso: npm run test:consolidacao   (com o dev server rodando)
// RAG é OPCIONAL — o agente de cobrança degrada graciosamente sem o rag_server.

const PORT = process.env.PORT ?? "3001";
const BASE = `http://localhost:${PORT}`;

const TRANSCRIPT = `Dentista: Bom dia! Hoje vamos continuar o tratamento de canal, certo? Abre a boca pra mim.
Paciente: Bom dia, doutora. Pode ser.
Dentista: Estou olhando o primeiro molar inferior direito, o dente 36. Já tínhamos visto que ele precisava de tratamento endodôntico. Vou começar fazendo a abertura coronária pra acessar a câmara pulpar.
Paciente: Tá.
Dentista: Pronto, localizei os canais. Como é molar, são três raízes. Agora vou fazer o preparo químico-mecânico, instrumentando e irrigando cada canal.
Paciente: Certo, doutora.
Dentista: Antes de começar apliquei anestesia local, lidocaína a 2%, pra você não sentir nada.
Paciente: Não senti mesmo.
Dentista: Tirei um raio-x periapical inicial pra medir o comprimento dos canais, e vou tirar outro periapical no final pra conferir. Hoje não vou terminar a obturação; vou colocar uma pasta de hidróxido de cálcio como curativo dentro dos canais e fechar provisoriamente com Coltosol. A gente conclui o canal na próxima sessão.
Paciente: Entendi. Então fica esse curativo por enquanto?
Dentista: Isso. Curativo de demora. Na próxima sessão eu removo e faço a obturação definitiva. Qualquer dor, toma um analgésico comum.
Paciente: Combinado, obrigada!`;

const headers = { "Content-Type": "application/json" };

const norm = (s) =>
  (s ?? "")
    .toString()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

const fails = [];
const warns = [];
const ok = (msg) => console.log(`  ✓ ${msg}`);
const fail = (msg) => {
  fails.push(msg);
  console.log(`  ✗ ${msg}`);
};
const warn = (msg) => {
  warns.push(msg);
  console.log(`  ! ${msg}`);
};

// ── 1. Gera o prontuário ──────────────────────────────────────────────────────
console.log(`→ POST ${BASE}/api/prontuario\n`);
const pres = await fetch(`${BASE}/api/prontuario`, {
  method: "POST",
  headers,
  body: JSON.stringify({
    transcript: TRANSCRIPT,
    paciente: { nome_paciente: "Paciente Teste", convenio: "SUS", dentista: "Dra. Teste", cro: "SP-00000" },
  }),
});
const pdata = await pres.json();
if (!pres.ok) {
  console.error("Erro ao gerar prontuário:", pdata.error ?? pdata);
  process.exit(1);
}

const prontuario = pdata.prontuario;
const fat = prontuario?.plano?.procedimentos_faturaveis ?? [];
const realizados = prontuario?.plano?.procedimentos_realizados ?? [];

console.log("=== Procedimentos realizados (documentação clínica) ===");
console.log(realizados.length ? realizados : "(vazio)");
console.log("\n=== Procedimentos faturáveis (consolidados) ===");
console.log(JSON.stringify(fat, null, 2));
console.log("\n=== Validações ===");

// Canal multirradicular faturável.
const canal = fat.find(
  (f) => norm(f.descricao).includes("endodontic") || norm(f.descricao).includes("endodontico") || norm(f.descricao).includes("canal")
);
if (canal) {
  ok(`Canal faturável presente: ${canal.codigo_tuss} — ${canal.descricao}`);
  if (norm(canal.descricao).includes("multirradicular") || canal.codigo_tuss === "85200158")
    ok("Canal classificado como multirradicular (dente 36 é molar)");
  else warn(`Canal não veio como multirradicular (veio: ${canal.descricao})`);
  if (norm(canal.elemento_dental).includes("36")) ok("Dente do canal = 36");
  else warn(`Dente do canal inesperado: "${canal.elemento_dental}"`);
  if (canal.inclui_etapas.length >= 2) ok(`Canal consolida ${canal.inclui_etapas.length} etapas técnicas`);
  else warn("Canal não listou as etapas técnicas consolidadas (inclui_etapas)");
} else {
  fail("Nenhum procedimento de canal/endodontia faturável foi identificado");
}

// Raio-x periapical faturável.
const raiox = fat.find((f) => norm(f.descricao).includes("periapical") || f.codigo_tuss === "81000421");
if (raiox) ok(`Radiografia periapical faturável: ${raiox.codigo_tuss} — ${raiox.descricao}`);
else warn("Radiografia periapical não foi separada como item faturável");

// Curativo de demora (sessão não concluída → faturável separado).
const curativo = fat.find((f) => norm(f.descricao).includes("curativo") || f.codigo_tuss === "85100056");
if (curativo) ok(`Curativo de demora faturável: ${curativo.codigo_tuss} — ${curativo.descricao}`);
else warn("Curativo de demora não foi cobrado separadamente (sessão não concluída deveria gerar)");

// Etapas técnicas NÃO podem virar itens faturáveis separados.
const TECNICAS = ["abertura coronaria", "preparo quimico", "localizacao", "instrumenta", "coltosol", "hidroxido"];
const vazadas = fat.filter((f) => TECNICAS.some((t) => norm(f.descricao).includes(t)));
if (!vazadas.length) ok("Nenhuma etapa técnica vazou como item faturável separado");
else fail(`Etapas técnicas viraram itens faturáveis: ${vazadas.map((v) => v.descricao).join("; ")}`);

// Anestesia não é faturável.
if (!fat.some((f) => norm(f.descricao).includes("anestesi")))
  ok("Anestesia não foi cobrada separadamente");
else fail("Anestesia apareceu como item faturável (não deveria)");

// ── 2. Gera a guia de cobrança e checa o score ──────────────────────────────
console.log(`\n→ POST ${BASE}/api/cobranca\n`);
const appointmentId = 999001;
const snapshot = {
  patients: [{ id: "p-teste", nome: "Paciente", sobrenome: "Teste", convenio: "SUS", status: "ativo" }],
  appointments: [
    { id: appointmentId, patientId: "p-teste", patient: "Paciente Teste", date: "2026-06-09", startH: 9, startM: 0, endH: 10, endM: 0, type: "Endodontia" },
  ],
  prontuarios: { [appointmentId]: prontuario },
  prontuariosMd: { [appointmentId]: "" },
};

let guia;
let cobErro = "";
try {
  const cres = await fetch(`${BASE}/api/cobranca`, {
    method: "POST",
    headers,
    body: JSON.stringify({ appointmentId, dadosPrestador: {}, storageSnapshot: snapshot }),
  });
  const reader = cres.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const parts = buf.split("\n\n");
    buf = parts.pop() ?? "";
    for (const part of parts) {
      const line = part.split("\n").find((l) => l.startsWith("data:"));
      if (!line) continue;
      let ev;
      try {
        ev = JSON.parse(line.slice(5).trim());
      } catch {
        continue;
      }
      if (ev.tipo === "complete") guia = ev.guia;
      else if (ev.tipo === "error") cobErro = ev.mensagem;
    }
  }
} catch (e) {
  cobErro = e?.message ?? String(e);
}

if (cobErro || !guia) {
  fail(`Falha ao gerar a guia de cobrança: ${cobErro || "sem guia"}`);
} else {
  console.log("=== Guia: procedimentos ===");
  for (const p of guia.procedimentos) console.log(`  ${p.codigo_tuss || "—"} — ${p.descricao} [fonte: ${p.fonte}]`);
  console.log("=== Guia: alertas de glosa ===");
  for (const a of guia.alertas_glosa) console.log(`  [${a.tipo}] (${a.campo}) ${a.mensagem}`);

  const consolidados = guia.procedimentos.filter((p) => p.fonte === "prontuario").length;
  if (consolidados > 0) ok(`${consolidados} procedimento(s) com fonte "prontuario" (sem RAG)`);
  else warn('Nenhum procedimento veio com fonte "prontuario"');

  // Sem score: a saúde da consolidação se mede pela ausência de alertas críticos.
  const criticos = guia.alertas_glosa.filter((a) => a.tipo === "critico");
  if (!criticos.length) ok("Nenhum alerta crítico de glosa");
  else fail(`${criticos.length} alerta(s) crítico(s): ${criticos.map((a) => a.mensagem).join(" | ")}`);
}

// ── Resultado ────────────────────────────────────────────────────────────────
console.log("\n──────────────────────────────────────────");
if (fails.length) {
  console.log(`RESULTADO: FALHOU (${fails.length} erro(s), ${warns.length} aviso(s))`);
  process.exit(1);
}
console.log(`RESULTADO: PASSOU${warns.length ? ` (com ${warns.length} aviso(s))` : ""}`);
