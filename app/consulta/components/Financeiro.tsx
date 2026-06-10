"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { CobrancaModel, CobrancaStatus, GuiaSPSADT } from "@/lib/types-cobranca";
import {
  getAllCobrancas,
  updateCobrancaStatus,
  updateCobrancaGuia,
} from "@/lib/cobranca-storage";
import { getPatients, getAppointments, getAllProntuarios } from "@/lib/prontuario-storage";
import {
  fmtData,
  fmtBRL,
  guiaTotal,
  type UiStatus,
  StatusBadge,
  GuiaView,
  GuiaEditor,
} from "@/app/consulta/components/cobranca-ui";

/**
 * Página Financeiro — visão global de todas as guias geradas (todos os
 * pacientes). Resumo, filtros, edição (mesmo GuiaEditor da aba Cobranças) e
 * controle do ciclo de faturamento (aprovar → enviar → paga/glosada).
 *
 * A GERAÇÃO continua na aba Cobranças (com o trace ao vivo). Aqui, consultas
 * com prontuário mas sem guia aparecem com atalho que leva até lá.
 */

interface Props {
  /** Deep-link: abre a aba Cobranças do paciente para gerar/ver a guia. */
  onOpenPatientCobrancas: (patientId: string) => void;
}

interface Row {
  cob: CobrancaModel;
  nome: string;
  total: number;
  mes: string; // "YYYY-MM"
}

const STATUS_FILTERS: { value: CobrancaStatus | "todos"; label: string }[] = [
  { value: "todos", label: "Todos" },
  { value: "revisao_pendente", label: "Revisão pendente" },
  { value: "aprovada", label: "Aprovada" },
  { value: "enviada", label: "Enviada" },
  { value: "paga", label: "Paga" },
  { value: "glosada", label: "Glosada" },
];

const temGuia = (c: CobrancaModel): c is CobrancaModel & { guia: GuiaSPSADT } =>
  Boolean(c.guia) && c.status !== "nao_gerada";

export default function Financeiro({ onOpenPatientCobrancas }: Props) {
  const [rows, setRows] = useState<Row[]>([]);
  const [pendentes, setPendentes] = useState<{ patientId: string; nome: string; data: string; appointmentId: string }[]>([]);
  const [hydrated, setHydrated] = useState(false);

  const [fStatus, setFStatus] = useState<CobrancaStatus | "todos">("todos");
  const [fConvenio, setFConvenio] = useState("todos");
  const [fMes, setFMes] = useState("todos");
  const [busca, setBusca] = useState("");

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [checkedDocs, setCheckedDocs] = useState<Record<string, Set<number>>>({});

  const reload = useCallback(() => {
    const patients = getPatients();
    const nomeDe = (patientId: string, fallback: string) => {
      const p = patients.find((x) => x.id === patientId);
      return p ? `${p.nome} ${p.sobrenome}`.trim() : fallback || "Paciente";
    };

    const cobrancas = getAllCobrancas().filter(temGuia);
    const next: Row[] = cobrancas.map((cob) => {
      const guia = cob.guia!;
      return {
        cob,
        nome: nomeDe(cob.patientId, guia.paciente_nome),
        total: guiaTotal(guia),
        mes: (guia.data_realizacao || "").slice(0, 7),
      };
    });
    next.sort((a, b) => (b.cob.guia!.data_realizacao || "").localeCompare(a.cob.guia!.data_realizacao || ""));
    setRows(next);

    // Pendentes de geração: consultas com prontuário mas sem guia.
    const prontuarios = getAllProntuarios();
    const appts = getAppointments();
    const comGuia = new Set(cobrancas.map((c) => String(c.appointmentId)));
    const pend = appts
      .filter((a) => prontuarios[String(a.id)] && !comGuia.has(String(a.id)))
      .map((a) => ({
        patientId: a.patientId,
        nome: nomeDe(a.patientId, a.patient),
        data: a.date,
        appointmentId: String(a.id),
      }))
      .sort((x, y) => y.data.localeCompare(x.data));
    setPendentes(pend);
  }, []);

  useEffect(() => {
    reload();
    setHydrated(true);
  }, [reload]);

  // ── Opções de filtro derivadas ──────────────────────────────────────────
  const convenios = useMemo(
    () => [...new Set(rows.map((r) => r.cob.guia!.convenio).filter(Boolean))].sort(),
    [rows]
  );
  const meses = useMemo(
    () => [...new Set(rows.map((r) => r.mes).filter(Boolean))].sort().reverse(),
    [rows]
  );

  const filtered = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return rows.filter((r) => {
      if (fStatus !== "todos" && r.cob.status !== fStatus) return false;
      if (fConvenio !== "todos" && r.cob.guia!.convenio !== fConvenio) return false;
      if (fMes !== "todos" && r.mes !== fMes) return false;
      if (q && !r.nome.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [rows, fStatus, fConvenio, fMes, busca]);

  // ── Resumo financeiro (sobre o conjunto filtrado) ────────────────────────
  const resumo = useMemo(() => {
    const faturado = filtered
      .filter((r) => r.cob.status !== "glosada")
      .reduce((s, r) => s + r.total, 0);
    const recebido = filtered
      .filter((r) => r.cob.status === "paga")
      .reduce((s, r) => s + (r.cob.valor_recebido ?? r.total), 0);
    const glosado = filtered
      .filter((r) => r.cob.status === "glosada")
      .reduce((s, r) => s + r.total, 0);
    const aprovarPend = filtered.filter((r) => r.cob.status === "revisao_pendente").length;
    return { faturado, recebido, glosado, aprovarPend, count: filtered.length };
  }, [filtered]);

  // ── Ações de ciclo ────────────────────────────────────────────────────────
  const setStatus = useCallback(
    (id: string, status: CobrancaStatus, extras?: { valor_recebido?: number; glosa_motivo?: string }) => {
      updateCobrancaStatus(id, status, extras);
      reload();
    },
    [reload]
  );

  const marcarPaga = useCallback(
    (id: string, totalSugerido: number) => {
      const raw = window.prompt("Valor recebido (R$):", String(totalSugerido || ""));
      if (raw === null) return;
      const valor = parseFloat(raw.replace(/[^\d.,]/g, "").replace(",", "."));
      setStatus(id, "paga", { valor_recebido: Number.isFinite(valor) ? valor : undefined });
    },
    [setStatus]
  );

  const marcarGlosada = useCallback(
    (id: string) => {
      const motivo = window.prompt("Motivo da glosa:", "");
      if (motivo === null) return;
      setStatus(id, "glosada", { glosa_motivo: motivo.trim() || undefined });
    },
    [setStatus]
  );

  const salvarEdicao = useCallback(
    (id: string, guia: GuiaSPSADT) => {
      updateCobrancaGuia(id, guia);
      setEditingId(null);
      reload();
    },
    [reload]
  );

  const toggleDoc = useCallback((id: string, i: number) => {
    setCheckedDocs((prev) => {
      const set = new Set(prev[id] ?? []);
      if (set.has(i)) set.delete(i);
      else set.add(i);
      return { ...prev, [id]: set };
    });
  }, []);

  if (!hydrated) return <div className="fin"><h1 className="c-page-title">Financeiro</h1></div>;

  return (
    <div className="fin">
      <div className="fin-head">
        <h1 className="c-page-title">Financeiro</h1>
        <p className="c-sub">Todas as guias de cobrança, prontas para revisar, editar e acompanhar.</p>
      </div>

      {/* Resumo */}
      <div className="fin-cards">
        <div className="fin-card"><span className="fin-card-label">Guias</span><span className="fin-card-value">{resumo.count}</span></div>
        <div className="fin-card"><span className="fin-card-label">Faturado</span><span className="fin-card-value">{fmtBRL(resumo.faturado)}</span></div>
        <div className="fin-card fin-card--ok"><span className="fin-card-label">Recebido</span><span className="fin-card-value">{fmtBRL(resumo.recebido)}</span></div>
        <div className="fin-card fin-card--bad"><span className="fin-card-label">Glosado</span><span className="fin-card-value">{fmtBRL(resumo.glosado)}</span></div>
        <div className="fin-card"><span className="fin-card-label">A aprovar</span><span className="fin-card-value">{resumo.aprovarPend}</span></div>
      </div>

      {/* Filtros */}
      <div className="fin-filters">
        <select value={fStatus} onChange={(e) => setFStatus(e.target.value as CobrancaStatus | "todos")}>
          {STATUS_FILTERS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        <select value={fConvenio} onChange={(e) => setFConvenio(e.target.value)}>
          <option value="todos">Todos os convênios</option>
          {convenios.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={fMes} onChange={(e) => setFMes(e.target.value)}>
          <option value="todos">Todos os meses</option>
          {meses.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
        <input className="fin-search" placeholder="Buscar paciente..." value={busca} onChange={(e) => setBusca(e.target.value)} />
      </div>

      {/* Lista de guias */}
      {filtered.length === 0 ? (
        <div className="fin-empty">Nenhuma guia para os filtros selecionados.</div>
      ) : (
        <div className="fin-list">
          {filtered.map((r) => {
            const id = String(r.cob.appointmentId);
            const guia = r.cob.guia!;
            const expanded = expandedId === id;
            const status = r.cob.status as UiStatus;
            return (
              <div className="fin-item" key={id}>
                <button className="fin-row" onClick={() => setExpandedId(expanded ? null : id)}>
                  <span className="fin-row-name">{r.nome}</span>
                  <span className="fin-row-meta">{fmtData(guia.data_realizacao)}</span>
                  <span className="fin-row-meta">{guia.convenio || "—"}</span>
                  <span className="fin-row-meta">{guia.procedimentos.length} proc.</span>
                  <span className="fin-row-total">{r.total > 0 ? fmtBRL(r.total) : "—"}</span>
                  <StatusBadge status={status} />
                  <svg className={`fin-chevron${expanded ? " fin-chevron--open" : ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
                </button>

                {r.cob.status === "glosada" && r.cob.glosa_motivo && (
                  <div className="fin-glosa-motivo">Glosa: {r.cob.glosa_motivo}</div>
                )}

                {expanded && (
                  <div className="fin-detail">
                    {editingId === id ? (
                      <GuiaEditor guia={guia} onSave={(g) => salvarEdicao(id, g)} onCancel={() => setEditingId(null)} />
                    ) : (
                      <GuiaView
                        guia={guia}
                        checked={checkedDocs[id] ?? new Set<number>()}
                        onToggleDoc={(i) => toggleDoc(id, i)}
                        onEdit={() => setEditingId(id)}
                      />
                    )}

                    {editingId !== id && (
                      <div className="fin-actions">
                        {r.cob.status === "revisao_pendente" && (
                          <button className="cb-btn-approve" onClick={() => setStatus(id, "aprovada")}>Aprovar</button>
                        )}
                        {r.cob.status === "aprovada" && (
                          <button className="cb-btn-primary" onClick={() => setStatus(id, "enviada")}>Marcar enviada</button>
                        )}
                        {r.cob.status === "enviada" && (
                          <>
                            <button className="cb-btn-approve" onClick={() => marcarPaga(id, r.total)}>Marcar paga</button>
                            <button className="cb-btn-danger" onClick={() => marcarGlosada(id)}>Marcar glosada</button>
                          </>
                        )}
                        {r.cob.status === "paga" && r.cob.valor_recebido != null && (
                          <span className="fin-paid">Recebido: {fmtBRL(r.cob.valor_recebido)}</span>
                        )}
                        {r.cob.status === "glosada" && (
                          <button className="cb-btn-ghost" onClick={() => setStatus(id, "revisao_pendente")}>Contestar (reabrir)</button>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Pendentes de geração */}
      {pendentes.length > 0 && (
        <div className="fin-pend">
          <h2 className="fin-pend-title">Pendentes de geração ({pendentes.length})</h2>
          <p className="fin-pend-sub">Consultas com prontuário salvo, mas sem guia. Gere na aba Cobranças do paciente.</p>
          <div className="fin-pend-list">
            {pendentes.map((p) => (
              <div className="fin-pend-row" key={p.appointmentId}>
                <span>{p.nome}</span>
                <span className="fin-row-meta">{fmtData(p.data)}</span>
                <button className="cb-btn-ghost cb-btn-sm" onClick={() => onOpenPatientCobrancas(p.patientId)}>Gerar na Cobranças →</button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
