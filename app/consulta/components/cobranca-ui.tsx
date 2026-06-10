"use client";

import { useState } from "react";
import type {
  CobrancaStatus,
  GuiaSPSADT,
  AlertaGlosa,
  ProcedimentoGuia,
  TraceEvent,
} from "@/lib/types-cobranca";
import { finalizeEditedGuia, guiaTotal, fmtBRL } from "@/lib/cobranca-format";

/**
 * Componentes de UI da cobrança compartilhados entre a aba Cobranças (por
 * paciente) e a página Financeiro (global). Fonte única — os dois lugares
 * renderizam a guia da mesma forma e editam pelo mesmo GuiaEditor.
 */

export const fmtData = (iso: string): string => {
  const [y, m, d] = iso.split("-");
  return d && m && y ? `${d}/${m}/${y}` : iso;
};

export { guiaTotal, fmtBRL };

// ── Status ───────────────────────────────────────────────────────────────────
/** Status efetivo na UI (inclui o estado transitório "gerando"). */
export type UiStatus = CobrancaStatus | "gerando";

export const STATUS_LABEL: Record<UiStatus, string> = {
  nao_gerada: "Não gerada",
  gerando: "Gerando...",
  gerada: "Gerada",
  revisao_pendente: "Revisão pendente",
  aprovada: "Aprovada",
  enviada: "Enviada",
  paga: "Paga",
  glosada: "Glosada",
};

export function StatusBadge({ status }: { status: UiStatus }) {
  return <span className={`cb-status cb-status--${status}`}>{STATUS_LABEL[status]}</span>;
}

// ── Alertas ──────────────────────────────────────────────────────────────────
const ALERTA_ICON: Record<AlertaGlosa["tipo"], string> = {
  critico: "⚠",
  atencao: "⚡",
  info: "ℹ",
};

export function Alertas({ alertas }: { alertas: AlertaGlosa[] }) {
  if (!alertas.length) return <p className="cb-sec-empty">Nenhum alerta de glosa detectado.</p>;
  return (
    <ul className="cb-alertas">
      {alertas.map((a, i) => (
        <li key={i} className={`cb-alerta cb-alerta--${a.tipo}`}>
          <span className="cb-alerta-icon">{ALERTA_ICON[a.tipo]}</span>
          <div className="cb-alerta-body">
            <span className="cb-alerta-msg">{a.mensagem}</span>
            <span className="cb-alerta-acao">{a.acao_recomendada}</span>
          </div>
        </li>
      ))}
    </ul>
  );
}

// Rótulo + ícone por fonte do mapeamento TUSS.
const FONTE_META: Record<string, { label: string; icon: string }> = {
  prontuario: { label: "Consolidado pelo agente", icon: "✓" },
  rag: { label: "Mapeado via RAG", icon: "🔍" },
  lookup: { label: "Mapeado via tabela", icon: "" },
  manual: { label: "Revisão necessária", icon: "⚠" },
};

// ── Tabela de procedimentos (leitura) ─────────────────────────────────────────
export function ProcTable({ procedimentos }: { procedimentos: ProcedimentoGuia[] }) {
  if (!procedimentos.length) return <p className="cb-sec-empty">Nenhum procedimento mapeado.</p>;
  return (
    <table className="cb-proc-table">
      <thead>
        <tr>
          <th>Código TUSS</th>
          <th>Descrição</th>
          <th>Dente</th>
          <th>Qtd</th>
          <th>Valor</th>
          <th>Fonte</th>
        </tr>
      </thead>
      <tbody>
        {procedimentos.map((p, i) => (
          <tr key={i}>
            <td className="cb-proc-code">{p.codigo_tuss || "—"}</td>
            <td>{p.descricao}</td>
            <td>{p.elemento_dental || "—"}</td>
            <td>{p.quantidade}</td>
            <td>{p.valor_unitario != null ? fmtBRL(p.valor_unitario * p.quantidade) : "—"}</td>
            <td>
              <span className={`cb-fonte cb-fonte--${p.fonte}`}>
                {FONTE_META[p.fonte]?.icon ? `${FONTE_META[p.fonte].icon} ` : ""}
                {FONTE_META[p.fonte]?.label ?? p.fonte}
              </span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ── Guia (leitura) ─────────────────────────────────────────────────────────
export function GuiaView({
  guia,
  checked,
  onToggleDoc,
  onEdit,
}: {
  guia: GuiaSPSADT;
  checked: Set<number>;
  onToggleDoc: (i: number) => void;
  onEdit?: () => void;
}) {
  const total = guiaTotal(guia);
  return (
    <div className="cb-guia">
      <section className="cb-sec">
        <div className="cb-sec-head">
          <h4 className="cb-sec-title">Dados do atendimento</h4>
          {onEdit && (
            <button className="cb-btn-ghost cb-btn-sm" onClick={onEdit}>Editar</button>
          )}
        </div>
        <div className="cb-kv-grid">
          <div className="cb-kv"><span>Data</span><b>{fmtData(guia.data_realizacao)}</b></div>
          <div className="cb-kv"><span>Convênio</span><b>{guia.convenio || "—"}</b></div>
          <div className="cb-kv"><span>Carteirinha</span><b>{guia.carteirinha || "—"}</b></div>
          <div className="cb-kv"><span>Autorização</span><b>{guia.numero_autorizacao || "—"}</b></div>
          <div className="cb-kv"><span>CID</span><b>{guia.cid_codigo ? `${guia.cid_codigo}${guia.cid_descricao ? ` — ${guia.cid_descricao}` : ""}` : "—"}</b></div>
        </div>
        {guia.requer_autorizacao && (
          <div className="cb-req-auth">
            <span className="cb-req-auth-badge">Requer autorização</span>
            {guia.requer_autorizacao_motivo && <span>{guia.requer_autorizacao_motivo}</span>}
          </div>
        )}
      </section>

      <section className="cb-sec">
        <h4 className="cb-sec-title">Procedimentos</h4>
        <ProcTable procedimentos={guia.procedimentos} />
        {total > 0 && (
          <div className="cb-total">Total da guia: <b>{fmtBRL(total)}</b></div>
        )}
      </section>

      <section className="cb-sec">
        <h4 className="cb-sec-title">Alertas de glosa</h4>
        <Alertas alertas={guia.alertas_glosa} />
      </section>

      <section className="cb-sec">
        <h4 className="cb-sec-title">Documentação obrigatória</h4>
        {guia.documentacao_obrigatoria.length ? (
          <ul className="cb-checklist">
            {guia.documentacao_obrigatoria.map((doc, i) => (
              <li key={i}>
                <label className="cb-check">
                  <input type="checkbox" checked={checked.has(i)} onChange={() => onToggleDoc(i)} />
                  <span className={checked.has(i) ? "cb-check-done" : ""}>{doc}</span>
                </label>
              </li>
            ))}
          </ul>
        ) : (
          <p className="cb-sec-empty">Nenhum documento adicional exigido.</p>
        )}
      </section>

      {guia.convenio_regras_aplicadas.length > 0 && (
        <section className="cb-sec">
          <h4 className="cb-sec-title">Regras consultadas</h4>
          <ul className="cb-regras">
            {guia.convenio_regras_aplicadas.map((r, i) => <li key={i}>{r}</li>)}
          </ul>
        </section>
      )}
    </div>
  );
}

// ── Guia (edição) ──────────────────────────────────────────────────────────
function cloneGuia(g: GuiaSPSADT): GuiaSPSADT {
  return { ...g, procedimentos: g.procedimentos.map((p) => ({ ...p })) };
}

const novoProc = (): ProcedimentoGuia => ({
  codigo_tuss: "",
  descricao: "",
  quantidade: 1,
  elemento_dental: "",
  valor_unitario: undefined,
  fonte: "manual",
});

export function GuiaEditor({
  guia,
  onSave,
  onCancel,
}: {
  guia: GuiaSPSADT;
  onSave: (g: GuiaSPSADT) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<GuiaSPSADT>(() => cloneGuia(guia));

  const setField =
    (k: keyof GuiaSPSADT) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((f) => ({ ...f, [k]: e.target.value }));

  const updateProc = (i: number, patch: Partial<ProcedimentoGuia>) =>
    setForm((f) => ({
      ...f,
      procedimentos: f.procedimentos.map((p, j) => (j === i ? { ...p, ...patch } : p)),
    }));
  const addProc = () => setForm((f) => ({ ...f, procedimentos: [...f.procedimentos, novoProc()] }));
  const removeProc = (i: number) =>
    setForm((f) => ({ ...f, procedimentos: f.procedimentos.filter((_, j) => j !== i) }));

  const total = guiaTotal(form);

  const numField = (v: number | undefined): string => (v == null ? "" : String(v));
  const parseNum = (s: string): number | undefined => {
    const n = parseFloat(s.replace(",", "."));
    return Number.isFinite(n) ? n : undefined;
  };

  return (
    <div className="cb-guia cb-editor">
      <section className="cb-sec">
        <h4 className="cb-sec-title">Editar dados do atendimento</h4>
        <div className="cb-edit-grid">
          <label className="cb-fld"><span>Convênio</span><input value={form.convenio} onChange={setField("convenio")} /></label>
          <label className="cb-fld"><span>Carteirinha</span><input value={form.carteirinha} onChange={setField("carteirinha")} /></label>
          <label className="cb-fld">
            <span>Data</span>
            <input type="date" value={/^\d{4}-\d{2}-\d{2}$/.test(form.data_realizacao) ? form.data_realizacao : ""} onChange={setField("data_realizacao")} />
          </label>
          <label className="cb-fld"><span>Nº de autorização</span><input value={form.numero_autorizacao ?? ""} onChange={setField("numero_autorizacao")} placeholder="preencher reduz o risco" /></label>
          <label className="cb-fld"><span>CID código</span><input value={form.cid_codigo} onChange={setField("cid_codigo")} /></label>
          <label className="cb-fld"><span>CID descrição</span><input value={form.cid_descricao} onChange={setField("cid_descricao")} /></label>
        </div>
      </section>

      <section className="cb-sec">
        <div className="cb-sec-head">
          <h4 className="cb-sec-title">Procedimentos</h4>
          <button className="cb-btn-ghost cb-btn-sm" onClick={addProc}>+ Adicionar</button>
        </div>
        <table className="cb-proc-table cb-proc-edit">
          <thead>
            <tr><th>Código TUSS</th><th>Descrição</th><th>Dente</th><th>Qtd</th><th>Valor unit.</th><th></th></tr>
          </thead>
          <tbody>
            {form.procedimentos.map((p, i) => (
              <tr key={i}>
                <td><input className="cb-cell" value={p.codigo_tuss} onChange={(e) => updateProc(i, { codigo_tuss: e.target.value })} /></td>
                <td><input className="cb-cell" value={p.descricao} onChange={(e) => updateProc(i, { descricao: e.target.value })} /></td>
                <td><input className="cb-cell cb-cell-xs" value={p.elemento_dental} onChange={(e) => updateProc(i, { elemento_dental: e.target.value })} /></td>
                <td><input className="cb-cell cb-cell-xs" type="number" min={1} value={p.quantidade} onChange={(e) => updateProc(i, { quantidade: Math.max(1, parseInt(e.target.value || "1", 10)) })} /></td>
                <td><input className="cb-cell cb-cell-sm" type="number" min={0} step="0.01" value={numField(p.valor_unitario)} onChange={(e) => updateProc(i, { valor_unitario: parseNum(e.target.value) })} /></td>
                <td><button className="cb-row-del" onClick={() => removeProc(i)} aria-label="Remover">×</button></td>
              </tr>
            ))}
          </tbody>
        </table>
        {total > 0 && <div className="cb-total">Total da guia: <b>{fmtBRL(total)}</b></div>}
      </section>

      <div className="cb-editor-foot">
        <button className="cb-btn-ghost" onClick={onCancel}>Cancelar</button>
        <button className="cb-btn-primary" onClick={() => onSave(finalizeEditedGuia(form))}>Salvar alterações</button>
      </div>
    </div>
  );
}

// ── Trace ────────────────────────────────────────────────────────────────────
const TRACE_ICON: Record<TraceEvent["tipo"], string> = {
  search: "🔍",
  result: "✓",
  decision: "→",
  warning: "⚠",
};

function fonteBadge(detalhes?: Record<string, unknown>): string | null {
  if (!detalhes) return null;
  const src = (detalhes.source ?? detalhes.fonte) as string | undefined;
  if (!src) return null;
  const page = detalhes.page ?? detalhes.pagina;
  return page ? `${src} p.${page}` : src;
}

export function TracePanel({ trace, streaming }: { trace: TraceEvent[]; streaming: boolean }) {
  if (!trace.length && !streaming) return null;
  return (
    <div className="cb-trace">
      <div className="cb-trace-list">
        {trace.map((ev, i) => {
          const badge = ev.tipo === "result" ? fonteBadge(ev.detalhes) : null;
          return (
            <div key={i} className={`cb-trace-line cb-trace-line--${ev.tipo}`} style={{ animationDelay: `${Math.min(i, 12) * 30}ms` }}>
              <span className="cb-trace-icon">{TRACE_ICON[ev.tipo]}</span>
              <span className="cb-trace-msg">{ev.mensagem}</span>
              {badge && <span className="cb-trace-source">{badge}</span>}
            </div>
          );
        })}
        {streaming && (
          <div className="cb-trace-line cb-trace-line--pending">
            <span className="cb-trace-spinner" />
            <span className="cb-trace-msg">Consultando bases...</span>
          </div>
        )}
      </div>
    </div>
  );
}
