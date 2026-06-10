import { tool } from "@langchain/core/tools";
import { z } from "zod";
import type { StorageSnapshot, SnapshotAppointment } from "@/lib/chat-snapshot";
import { consultarInteracoes } from "@/lib/drug-interactions";
import { procedimentosRealizados } from "@/lib/types-prontuario";

/**
 * As 5 tools do Jasmin Assistant. Rodam no servidor, mas os dados clínicos
 * vivem no localStorage do cliente — então recebem o snapshot por closure
 * (createTools) e operam só sobre ele. Sem banco, sem acesso direto ao storage.
 */

const pad2 = (n: number) => String(n).padStart(2, "0");
const fmtT = (h: number, m: number) => `${pad2(h)}:${pad2(m)}`;
const fmtDateBR = (iso: string): string => {
  const [y, m, d] = iso.split("-");
  return y && m && d ? `${d}/${m}/${y}` : iso;
};
const todayKey = (): string => {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
};

const byDateAsc = (a: SnapshotAppointment, b: SnapshotAppointment) =>
  a.date.localeCompare(b.date) || a.startH - b.startH || a.startM - b.startM;
const byDateDesc = (a: SnapshotAppointment, b: SnapshotAppointment) =>
  b.date.localeCompare(a.date) || b.startH - a.startH || b.startM - a.startM;

export function createTools(snap: StorageSnapshot) {
  const { patients, appointments, prontuarios } = snap;
  const today = todayKey();

  const nameOf = (patientId: string, fallback = ""): string => {
    const p = patients.find((x) => x.id === patientId);
    return p ? `${p.nome} ${p.sobrenome}`.trim() : fallback;
  };

  const proxConsulta = (patientId: string): SnapshotAppointment | null =>
    appointments
      .filter((a) => a.patientId === patientId && a.date >= today)
      .sort(byDateAsc)[0] ?? null;

  const ultimoProcedimento = (patientId: string): string => {
    const comPront = appointments
      .filter((a) => a.patientId === patientId && prontuarios[String(a.id)])
      .sort(byDateDesc);
    for (const a of comPront) {
      const procs = procedimentosRealizados(prontuarios[String(a.id)].plano);
      if (procs.length) return procs[0];
    }
    return "";
  };

  // ── Tool 1: search_patients ────────────────────────────────────────────────
  const searchPatients = tool(
    async ({ query }: { query: string }) => {
      const q = (query ?? "").trim().toLowerCase();
      const all = patients.filter((p) => `${p.nome} ${p.sobrenome}`.toLowerCase().includes(q));
      const total = all.length;
      const matches = all.slice(0, 5);

      if (total === 0) {
        return q
          ? `Nenhum paciente encontrado para "${query}".`
          : "Não há pacientes cadastrados.";
      }
      const linhas = matches.map((p) => {
        const nome = `${p.nome} ${p.sobrenome}`.trim();
        const prox = proxConsulta(p.id);
        const proxTxt = prox
          ? `${fmtDateBR(prox.date)} às ${fmtT(prox.startH, prox.startM)}`
          : "nenhuma agendada";
        const proc = ultimoProcedimento(p.id) || "—";
        return `- **${nome}** (id: ${p.id}) · próxima consulta: ${proxTxt} · último procedimento: ${proc}`;
      });
      // Total real (não limitado a 5) para responder "quantos pacientes" corretamente.
      const header = q
        ? `${total} paciente(s) correspondem a "${query}"${total > matches.length ? ` (mostrando ${matches.length})` : ""}:`
        : `Você tem ${total} paciente(s) no total${total > matches.length ? ` (mostrando ${matches.length})` : ""}:`;
      return `${header}\n${linhas.join("\n")}`;
    },
    {
      name: "search_patients",
      description:
        "Busca pacientes por nome (parcial, ignora maiúsculas) e informa o total. Use quando o dentista mencionar um paciente sem contexto selecionado, ou para contar/listar pacientes (chame com query vazia para o total geral). Mostra até 5, mas o cabeçalho traz o número TOTAL.",
      schema: z.object({
        query: z.string().describe("Nome ou parte do nome do paciente. Use \"\" (vazio) para listar/contar todos."),
      }),
    }
  );

  // ── Tool 2: get_consultas_hoje ───────────────────────────────────────────────
  const getConsultasHoje = tool(
    async () => {
      const doDia = appointments.filter((a) => a.date === today).sort(byDateAsc);
      if (doDia.length === 0) {
        return `Nenhuma consulta agendada para hoje (${fmtDateBR(today)}).`;
      }
      const linhas = doDia.map((a) => {
        const nome = nameOf(a.patientId, a.patient);
        const temPront = !!prontuarios[String(a.id)];
        return `- ${fmtT(a.startH, a.startM)} — **${nome}** — ${a.type || "Consulta"} · prontuário: ${temPront ? "salvo" : "não gerado"}`;
      });
      return `Consultas de hoje (${fmtDateBR(today)}), total ${doDia.length}:\n${linhas.join("\n")}`;
    },
    {
      name: "get_consultas_hoje",
      description:
        "Retorna todas as consultas agendadas para hoje, com nome do paciente, tipo e se há prontuário salvo.",
      schema: z.object({}),
    }
  );

  // ── Tool 3: get_historico_paciente ───────────────────────────────────────────
  const getHistoricoPaciente = tool(
    async ({ patientId }: { patientId: string }) => {
      const nome = nameOf(patientId);
      if (!nome) return `Paciente com id "${patientId}" não encontrado.`;
      const comPront = appointments
        .filter((a) => a.patientId === patientId && prontuarios[String(a.id)])
        .sort(byDateDesc)
        .slice(0, 10);
      if (comPront.length === 0) {
        return `Paciente ${nome} não tem prontuários salvos.`;
      }
      const blocos = comPront.map((a) => {
        const m = prontuarios[String(a.id)];
        const proc = procedimentosRealizados(m.plano).join(", ") || "—";
        const cid = m.diagnostico.cid_codigo
          ? `${m.diagnostico.cid_codigo} — ${m.diagnostico.cid_descricao}`
          : "—";
        const queixa = m.anamnese.queixa_principal || "—";
        return `### ${fmtDateBR(a.date)}\n- Queixa: ${queixa}\n- Diagnóstico (CID): ${cid}\n- Procedimentos: ${proc}`;
      });
      return `Histórico de ${nome} (${comPront.length} consulta(s), mais recente primeiro):\n\n${blocos.join("\n\n")}`;
    },
    {
      name: "get_historico_paciente",
      description:
        "Retorna o histórico cronológico (mais recente primeiro, até 10) de consultas com prontuário de um paciente. Use para perguntas sobre evolução de tratamento. Requer o patientId (use search_patients antes se necessário).",
      schema: z.object({
        patientId: z.string().describe("ID do paciente"),
      }),
    }
  );

  // ── Tool 4: get_proxima_consulta ─────────────────────────────────────────────
  const getProximaConsulta = tool(
    async ({ patientId }: { patientId?: string }) => {
      let candidatas = appointments.filter((a) => a.date >= today);
      if (patientId) candidatas = candidatas.filter((a) => a.patientId === patientId);
      const prox = candidatas.sort(byDateAsc)[0];
      if (!prox) {
        return patientId
          ? `Nenhuma consulta futura agendada para esse paciente.`
          : `Nenhuma consulta futura agendada.`;
      }
      const nome = nameOf(prox.patientId, prox.patient);
      return `Próxima consulta: ${fmtDateBR(prox.date)} às ${fmtT(prox.startH, prox.startM)} — ${nome} — ${prox.type || "Consulta"}.`;
    },
    {
      name: "get_proxima_consulta",
      description:
        "Retorna a próxima consulta agendada. Se patientId for fornecido, filtra por paciente; senão, retorna a próxima de qualquer paciente.",
      schema: z.object({
        patientId: z.string().optional().describe("ID do paciente (opcional)"),
      }),
    }
  );

  // ── Tool 5: consultar_interacoes_medicamentosas ──────────────────────────────
  const consultarInteracoesMed = tool(
    async ({ medicamento }: { medicamento: string }) => consultarInteracoes(medicamento),
    {
      name: "consultar_interacoes_medicamentosas",
      description:
        "Consulta interações medicamentosas relevantes para odontologia. Use quando o dentista perguntar sobre a segurança de um medicamento para um procedimento. Sempre oriente confirmar com o médico responsável.",
      schema: z.object({
        medicamento: z.string().describe("Nome do medicamento ou princípio ativo"),
      }),
    }
  );

  return [
    searchPatients,
    getConsultasHoje,
    getHistoricoPaciente,
    getProximaConsulta,
    consultarInteracoesMed,
  ];
}
