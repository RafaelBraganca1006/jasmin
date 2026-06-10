"use client";

import { useCallback, useEffect, useState } from "react";
import type { CobrancaItem } from "@/lib/types-prontuario";
import type {
  CobrancaModel,
  DadosPrestador,
  GuiaSPSADT,
  TraceEvent,
} from "@/lib/types-cobranca";
import { getCobrancas, getPatients } from "@/lib/prontuario-storage";
import {
  getCobrancasByPatient,
  saveCobranca,
  updateCobrancaStatus,
  updateCobrancaGuia,
} from "@/lib/cobranca-storage";
import { getPrestador, savePrestador } from "@/lib/prestador-storage";
import { buildStorageSnapshot } from "@/lib/chat-snapshot";
import {
  fmtData,
  type UiStatus,
  StatusBadge,
  GuiaView,
  GuiaEditor,
  TracePanel,
} from "@/app/consulta/components/cobranca-ui";

/**
 * Aba Cobranças — agente de cobrança TISS (Camada 5).
 * Lista as consultas do paciente com prontuário salvo. Para cada uma, gera a
 * guia SP/SADT via /api/cobranca, mostra alertas de glosa, score de risco e a
 * documentação obrigatória, e permite aprovar ou regerar.
 */

interface Props {
  patientId: string;
}


/** Modal de configuração dos dados da clínica (jasmin_prestador). */
function ConfigModal({
  initial,
  onClose,
  onSave,
}: {
  initial: DadosPrestador;
  onClose: () => void;
  onSave: (d: DadosPrestador) => void;
}) {
  const [form, setForm] = useState<DadosPrestador>(initial);
  const set = (k: keyof DadosPrestador) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <div className="cb-modal-overlay" onClick={onClose}>
      <div className="cb-modal" onClick={(e) => e.stopPropagation()}>
        <div className="cb-modal-head">
          <h3>Configurar dados da clínica</h3>
          <button className="cb-modal-close" onClick={onClose} aria-label="Fechar">×</button>
        </div>
        <div className="cb-modal-body">
          <label className="cb-fld"><span>Nome da clínica</span><input value={form.clinica_nome} onChange={set("clinica_nome")} /></label>
          <label className="cb-fld"><span>CNPJ</span><input value={form.clinica_cnpj} onChange={set("clinica_cnpj")} placeholder="00.000.000/0001-00" /></label>
          <label className="cb-fld"><span>Nome do dentista</span><input value={form.dentista_nome} onChange={set("dentista_nome")} /></label>
          <label className="cb-fld"><span>CRO</span><input value={form.dentista_cro} onChange={set("dentista_cro")} /></label>
          <label className="cb-fld"><span>Código na Unimed</span><input value={form.codigo_operadora_unimed ?? ""} onChange={set("codigo_operadora_unimed")} /></label>
          <label className="cb-fld"><span>Código na Amil</span><input value={form.codigo_operadora_amil ?? ""} onChange={set("codigo_operadora_amil")} /></label>
          <label className="cb-fld"><span>Código no Bradesco</span><input value={form.codigo_operadora_bradesco ?? ""} onChange={set("codigo_operadora_bradesco")} /></label>
        </div>
        <div className="cb-modal-foot">
          <button className="cb-btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="cb-btn-primary" onClick={() => onSave(form)}>Salvar</button>
        </div>
      </div>
    </div>
  );
}

export default function Cobrancas({ patientId }: Props) {
  const [itens, setItens] = useState<CobrancaItem[]>([]);
  const [cobrancas, setCobrancas] = useState<Record<string, CobrancaModel>>({});
  const [prestador, setPrestador] = useState<DadosPrestador | null>(null);
  const [convenioPaciente, setConvenioPaciente] = useState<string>("");
  const [hydrated, setHydrated] = useState(false);

  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [erro, setErro] = useState<string>("");
  const [modalOpen, setModalOpen] = useState(false);
  const [checkedDocs, setCheckedDocs] = useState<Record<string, Set<number>>>({});
  // Trace ao vivo durante a geração (por agendamento).
  const [liveTrace, setLiveTrace] = useState<Record<string, TraceEvent[]>>({});
  // Quais cards têm o trace expandido (após a geração).
  const [traceOpen, setTraceOpen] = useState<Record<string, boolean>>({});
  // Agendamento com a guia em modo de edição.
  const [editingId, setEditingId] = useState<string | null>(null);

  const reloadCobrancas = useCallback(() => {
    const map: Record<string, CobrancaModel> = {};
    for (const c of getCobrancasByPatient(patientId)) {
      map[String(c.appointmentId)] = c;
    }
    setCobrancas(map);
  }, [patientId]);

  useEffect(() => {
    setItens(getCobrancas(patientId));
    reloadCobrancas();
    setPrestador(getPrestador());
    const p = getPatients().find((x) => x.id === patientId);
    setConvenioPaciente(p?.convenio ?? "");
    setHydrated(true);
  }, [patientId, reloadCobrancas]);

  const gerarGuia = useCallback(
    async (appointmentId: string) => {
      setErro("");
      setGeneratingId(appointmentId);
      setExpandedId(appointmentId);
      setTraceOpen((p) => ({ ...p, [appointmentId]: true }));
      setLiveTrace((p) => ({ ...p, [appointmentId]: [] }));

      const trace: TraceEvent[] = [];
      const pushTrace = (ev: TraceEvent) => {
        trace.push(ev);
        setLiveTrace((p) => ({ ...p, [appointmentId]: [...trace] }));
      };

      try {
        const res = await fetch("/api/cobranca", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            appointmentId: Number(appointmentId),
            dadosPrestador: prestador ?? getPrestador(),
            storageSnapshot: buildStorageSnapshot(),
          }),
        });
        if (!res.body) throw new Error("Sem stream de resposta do servidor.");

        // Lê o SSE: eventos separados por "\n\n", cada um prefixado por "data: ".
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buf = "";
        let guia: GuiaSPSADT | undefined;
        let returnedPatientId = patientId;
        let erroMsg = "";

        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          const parts = buf.split("\n\n");
          buf = parts.pop() ?? "";
          for (const part of parts) {
            const line = part.split("\n").find((l) => l.startsWith("data:"));
            if (!line) continue;
            let ev: Record<string, unknown>;
            try {
              ev = JSON.parse(line.slice(5).trim());
            } catch {
              continue;
            }
            if (ev.tipo === "complete") {
              guia = ev.guia as GuiaSPSADT;
              returnedPatientId = (ev.patientId as string) || patientId;
            } else if (ev.tipo === "error") {
              erroMsg = (ev.mensagem as string) || "Erro ao gerar a guia.";
            } else {
              pushTrace(ev as unknown as TraceEvent);
            }
          }
        }

        if (erroMsg) throw new Error(erroMsg);
        if (!guia) throw new Error("A geração terminou sem produzir a guia.");

        saveCobranca(appointmentId, guia, returnedPatientId, trace);
        reloadCobrancas();
        // Colapsa o trace e mostra a guia.
        setTraceOpen((p) => ({ ...p, [appointmentId]: false }));
      } catch (e) {
        setErro(e instanceof Error ? e.message : "Erro desconhecido ao gerar a guia.");
      } finally {
        setGeneratingId(null);
      }
    },
    [prestador, patientId, reloadCobrancas]
  );

  const aprovar = useCallback(
    (appointmentId: string) => {
      updateCobrancaStatus(appointmentId, "aprovada");
      reloadCobrancas();
    },
    [reloadCobrancas]
  );

  const salvarEdicao = useCallback(
    (appointmentId: string, guia: GuiaSPSADT) => {
      updateCobrancaGuia(appointmentId, guia);
      setEditingId(null);
      reloadCobrancas();
    },
    [reloadCobrancas]
  );

  const toggleDoc = useCallback((appointmentId: string, i: number) => {
    setCheckedDocs((prev) => {
      const set = new Set(prev[appointmentId] ?? []);
      if (set.has(i)) set.delete(i);
      else set.add(i);
      return { ...prev, [appointmentId]: set };
    });
  }, []);

  const handleSavePrestador = useCallback((d: DadosPrestador) => {
    savePrestador(d);
    setPrestador(d);
    setModalOpen(false);
  }, []);

  const statusOf = (id: string): UiStatus => {
    if (generatingId === id) return "gerando";
    return cobrancas[id]?.status ?? "nao_gerada";
  };

  return (
    <div className="cb">
      <div className="cb-header">
        <div className="cb-title-row">
          <h3 className="cb-title">Cobranças</h3>
          <button className="cb-gear" onClick={() => setModalOpen(true)} title="Configurar dados da clínica" aria-label="Configurar dados da clínica">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </button>
        </div>
        <p className="cb-subtitle">
          {convenioPaciente ? `Convênio: ${convenioPaciente}` : "Geração automática de guias SP/SADT por consulta."}
        </p>
      </div>

      {erro && <div className="cb-erro">{erro}</div>}

      {!hydrated ? null : itens.length === 0 ? (
        <div className="cb-empty">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" width="34" height="34">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
          </svg>
          <p>Nenhum prontuário salvo ainda. Grave uma consulta para gerar o prontuário automaticamente.</p>
        </div>
      ) : (
        <div className="cb-list">
          {itens.map((it) => {
            const status = statusOf(it.appointmentId);
            const cob = cobrancas[it.appointmentId];
            const guia = cob?.guia;
            const expanded = expandedId === it.appointmentId;
            const podeExpandir = status === "revisao_pendente" || status === "aprovada";
            const isGenerating = generatingId === it.appointmentId;
            const trace = liveTrace[it.appointmentId] ?? cob?.trace ?? [];
            const showTrace = isGenerating || (traceOpen[it.appointmentId] && trace.length > 0);

            return (
              <div className="cb-card" key={it.appointmentId}>
                <div className="cb-card-head">
                  <div className="cb-card-when">
                    <span className="cb-card-date">{fmtData(it.data)}</span>
                    <span className="cb-card-time">{it.horario}</span>
                  </div>
                  <StatusBadge status={status} />
                </div>

                <div className="cb-card-body">
                  <div className="cb-row">
                    <span className="cb-row-label">CID</span>
                    <span className="cb-row-value">
                      {it.cid_codigo ? (
                        <span className="cb-cid-badge">{it.cid_codigo}{it.cid_descricao ? ` — ${it.cid_descricao}` : ""}</span>
                      ) : "—"}
                    </span>
                  </div>
                  <div className="cb-row">
                    <span className="cb-row-label">Procedimentos</span>
                    <span className="cb-row-value">{it.procedimentos.length ? it.procedimentos.join(", ") : "—"}</span>
                  </div>
                </div>

                {/* Trace do agente (ao vivo durante a geração; colapsável depois) */}
                {showTrace && <TracePanel trace={trace} streaming={isGenerating} />}

                {/* Detalhe expandido da guia (leitura ou edição) */}
                {podeExpandir && guia && expanded && (
                  editingId === it.appointmentId ? (
                    <GuiaEditor
                      guia={guia}
                      onSave={(g) => salvarEdicao(it.appointmentId, g)}
                      onCancel={() => setEditingId(null)}
                    />
                  ) : (
                    <GuiaView
                      guia={guia}
                      checked={checkedDocs[it.appointmentId] ?? new Set<number>()}
                      onToggleDoc={(i) => toggleDoc(it.appointmentId, i)}
                      onEdit={() => setEditingId(it.appointmentId)}
                    />
                  )
                )}

                <div className="cb-card-foot">
                  {status === "nao_gerada" && (
                    <button className="cb-btn-primary" onClick={() => gerarGuia(it.appointmentId)}>
                      Gerar guia
                    </button>
                  )}
                  {status === "gerando" && (
                    <button className="cb-btn-primary" disabled>Gerando...</button>
                  )}
                  {podeExpandir && (
                    <>
                      <button className="cb-btn-ghost" onClick={() => setExpandedId(expanded ? null : it.appointmentId)}>
                        {expanded ? "Recolher" : "Ver guia"}
                      </button>
                      {trace.length > 0 && (
                        <button
                          className="cb-btn-ghost"
                          onClick={() => setTraceOpen((p) => ({ ...p, [it.appointmentId]: !p[it.appointmentId] }))}
                        >
                          {traceOpen[it.appointmentId] ? "Ocultar consultas" : "Ver consultas realizadas"}
                        </button>
                      )}
                      {status === "revisao_pendente" && (
                        <button className="cb-btn-approve" onClick={() => aprovar(it.appointmentId)}>
                          Aprovar guia
                        </button>
                      )}
                      <button className="cb-btn-ghost" onClick={() => gerarGuia(it.appointmentId)} disabled={generatingId === it.appointmentId}>
                        Regerar
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {modalOpen && prestador && (
        <ConfigModal initial={prestador} onClose={() => setModalOpen(false)} onSave={handleSavePrestador} />
      )}
    </div>
  );
}
