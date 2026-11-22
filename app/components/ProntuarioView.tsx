"use client";

import { downloadProntuarioPdf, downloadProntuarioDocx } from "@/lib/prontuario-export";
import { Button, IconButton, TextButton, Tabs, Section, FieldLabel, Status, Menu, Callout, type TabItem } from "@/app/components/ui";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type {
  ProntuarioModel,
  AnamneseModel,
  ExameModel,
  DiagnosticoModel,
  PlanoModel,
  MetadataCobranca,
  DenteModel,
  ProcedimentoFaturavel,
} from "@/lib/types-prontuario";
import { procedimentosRealizados } from "@/lib/types-prontuario";
import { prontuarioToMarkdown } from "@/lib/prontuario-markdown";

/**
 * ProntuarioView — exibição e edição inline do ProntuarioModel completo.
 * Componente controlado: recebe o modelo e devolve cada alteração via onChange.
 * O ConsultaPage cuida de estado/persistência; aqui só renderiza e edita.
 */

interface Props {
  prontuario: ProntuarioModel;
  /** Transcrição da sessão atual (Linked Evidence). Vazio = sem painel de evidências. */
  transcript: string;
  onChange: (next: ProntuarioModel) => void;
  /** Chamado quando o dentista aprova (assina) o prontuário. */
  onAprovar: () => void;
}

// ── Linked Evidence: destaca os fragmentos na transcrição ────────────────────
const stripDiacritics = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "");

/**
 * Normaliza o texto para casamento tolerante (ignora acento, caixa, runs de
 * espaço/quebra de linha) e devolve um mapa norm→original para remapear os
 * índices destacados de volta à posição real no texto.
 */
function buildNorm(text: string): { norm: string; map: number[] } {
  const map: number[] = [];
  let norm = "";
  let prevSpace = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (/\s/.test(ch)) {
      if (!prevSpace && norm.length) {
        norm += " ";
        map.push(i);
      }
      prevSpace = true;
      continue;
    }
    prevSpace = false;
    const low = stripDiacritics(ch).toLowerCase();
    for (const c of low) {
      norm += c;
      map.push(i);
    }
  }
  return { norm, map };
}

/** Mesma normalização do alvo + remoção de pontuação nas bordas. */
function normQuote(q: string): string {
  return stripDiacritics(q)
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^[^\p{L}\p{N}]+/u, "")
    .replace(/[^\p{L}\p{N}]+$/u, "");
}

function HighlightedTranscript({ text, quotes }: { text: string; quotes: string[] }) {
  if (!text) return null;
  if (!quotes.length) return <>{text}</>;

  const { norm, map } = buildNorm(text);
  const ranges: [number, number][] = [];
  for (const q of quotes) {
    const qn = normQuote(q);
    if (qn.length < 3) continue;
    const idx = norm.indexOf(qn);
    if (idx === -1) continue;
    const start = map[idx];
    const end = map[idx + qn.length - 1] + 1;
    ranges.push([start, end]);
  }
  if (!ranges.length) return <>{text}</>;

  ranges.sort((a, b) => a[0] - b[0]);
  const merged: [number, number][] = [];
  for (const r of ranges) {
    const last = merged[merged.length - 1];
    if (last && r[0] <= last[1]) last[1] = Math.max(last[1], r[1]);
    else merged.push([...r] as [number, number]);
  }

  const parts: React.ReactNode[] = [];
  let cursor = 0;
  for (const [start, end] of merged) {
    if (cursor < start) parts.push(text.slice(cursor, start));
    parts.push(<mark key={start} className="c-evidence-mark">{text.slice(start, end)}</mark>);
    cursor = end;
  }
  if (cursor < text.length) parts.push(text.slice(cursor));
  return <>{parts}</>;
}

// ── Textarea que cresce com o conteúdo (campos vazios ocupam 1 linha) ─────────
function AutoTextarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const fit = () => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight + (el.offsetHeight - el.clientHeight)}px`;
  };
  useLayoutEffect(fit, [props.value]);
  useEffect(() => {
    window.addEventListener("resize", fit);
    document.fonts?.ready.then(fit);
    return () => window.removeEventListener("resize", fit);
  }, []);
  return <textarea rows={1} {...props} ref={ref} />;
}

// ── Campo de lista (medicamentos, alergias, procedimentos) ────────────────────
// Texto local, commit por vírgula no blur — não atrapalha a digitação.
function ListField({
  value, onCommit, placeholder,
}: { value: string[]; onCommit: (v: string[]) => void; placeholder?: string }) {
  const [text, setText] = useState(() => value.join(", "));
  const focused = useRef(false);
  useEffect(() => {
    if (!focused.current) setText(value.join(", "));
  }, [value]);
  return (
    <AutoTextarea
      className="ui-input"
      value={text}
      placeholder={placeholder ?? "—"}
      onFocus={() => { focused.current = true; }}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => {
        focused.current = false;
        onCommit(text.split(",").map((s) => s.trim()).filter(Boolean));
      }}
    />
  );
}

// ── Procedimentos para cobrança (faturáveis consolidados pelo Passo 4) ────────
function FaturaveisSection({ faturaveis }: { faturaveis: ProcedimentoFaturavel[] }) {
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  if (!faturaveis.length) return null;

  const toggle = (i: number) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });

  return (
    <div className="ui-field">
      <span className="pv-label">Procedimentos para cobrança</span>
      <p className="ui-field-hint">Consolidado pelo agente para a guia do convênio.</p>
      <div className="pv-fat-list">
        {faturaveis.map((f, i) => {
          const isOpen = expanded.has(i);
          const temEtapas = f.inclui_etapas.length > 0;
          const codigo = f.codigo_tuss && f.codigo_tuss !== "MANUAL" ? f.codigo_tuss : null;
          return (
            <div className="pv-fat-card" key={i}>
              <div className="pv-fat-head">
                {codigo ? (
                  <span className="pv-fat-code">{codigo}</span>
                ) : (
                  <span className="pv-fat-code pv-fat-code-manual">a definir</span>
                )}
                <span className="pv-fat-desc">{f.descricao || "—"}</span>
                {f.elemento_dental && <span className="pv-fat-dente">dente {f.elemento_dental}</span>}
                {f.requer_revisao && <span className="pv-fat-revisar">Revisar</span>}
              </div>
              {temEtapas && (
                <button type="button" className="pv-fat-inclui-btn" onClick={() => toggle(i)}>
                  Inclui {f.inclui_etapas.length} etapa{f.inclui_etapas.length > 1 ? "s" : ""}
                  <span className="pv-fat-chevron">{isOpen ? "▾" : "▸"}</span>
                </button>
              )}
              {isOpen && temEtapas && (
                <ul className="pv-fat-etapas">
                  {f.inclui_etapas.map((e, j) => (
                    <li key={j}>{e}</li>
                  ))}
                </ul>
              )}
              {f.justificativa && <p className="pv-fat-just">{f.justificativa}</p>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

const SECOES = [
  { id: "anamnese", label: "Anamnese" },
  { id: "exame", label: "Exame" },
  { id: "diagnostico", label: "Diagnóstico" },
  { id: "plano", label: "Plano" },
  { id: "cobranca", label: "Cobrança" },
] as const;

export default function ProntuarioView({ prontuario, transcript, onChange, onAprovar }: Props) {
  const [activeField, setActiveField] = useState<string | null>(null);
  const [confirmados, setConfirmados] = useState<Set<string>>(new Set());
  const [copied, setCopied] = useState(false);
  const [exporting, setExporting] = useState<null | "pdf" | "docx">(null);
  const evidenceRef = useRef<HTMLDivElement>(null);
  const alertasRef = useRef<HTMLDivElement>(null);
  const [secaoAtiva, setSecaoAtiva] = useState<string>("anamnese");
  const travaNav = useRef(0); // após clicar numa aba, o observador não sobrescreve a seleção por um instante

  const { anamnese, exame, diagnostico, plano, alertas, metadata_cobranca, evidencias } = prontuario;

  // ── setters ────────────────────────────────────────────────────────────────
  const update = (patch: Partial<ProntuarioModel>) => onChange({ ...prontuario, ...patch });
  const setAnamnese = (patch: Partial<AnamneseModel>) => update({ anamnese: { ...anamnese, ...patch } });
  const setExame = (patch: Partial<ExameModel>) => update({ exame: { ...exame, ...patch } });
  const setDiag = (patch: Partial<DiagnosticoModel>) => update({ diagnostico: { ...diagnostico, ...patch } });
  const setPlano = (patch: Partial<PlanoModel>) => update({ plano: { ...plano, ...patch } });
  const setMeta = (patch: Partial<MetadataCobranca>) => update({ metadata_cobranca: { ...metadata_cobranca, ...patch } });

  const setDente = (i: number, patch: Partial<DenteModel>) =>
    setExame({ odontograma: exame.odontograma.map((d, idx) => (idx === i ? { ...d, ...patch } : d)) });
  const addDente = () => setExame({ odontograma: [...exame.odontograma, { elemento: "", status: "" }] });
  const removeDente = (i: number) => setExame({ odontograma: exame.odontograma.filter((_, idx) => idx !== i) });

  // ── itens de confirmação (gaps + alertas + inconsistências) ──────────────────
  const itens = useMemo(() => {
    const out: { key: string; tipo: "alerta" | "inconsistencia" | "gap"; texto: string }[] = [];
    alertas.alertas_clinicos.forEach((t, i) => out.push({ key: `a${i}`, tipo: "alerta", texto: t }));
    alertas.inconsistencias.forEach((t, i) => out.push({ key: `i${i}`, tipo: "inconsistencia", texto: t }));
    alertas.gaps.forEach((t, i) => out.push({ key: `g${i}`, tipo: "gap", texto: t }));
    return out;
  }, [alertas]);

  const toggleConfirm = (key: string) =>
    setConfirmados((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const todosConfirmados = itens.every((it) => confirmados.has(it.key));
  const podeAprovar = !alertas.requer_confirmacao || todosConfirmados;
  const aprovado = !prontuario.assinatura_pendente;

  // ── scroll até a 1ª evidência ao trocar de campo ─────────────────────────────
  // Dois scrolls independentes: (1) dentro da caixa da transcrição, centraliza o
  // trecho destacado; (2) na página, centraliza o painel inteiro na tela.
  // (Antes: scrollIntoView({ block: "nearest" }) fazia a página rolar só o mínimo,
  // deixando o trecho colado na borda inferior da tela.)
  useEffect(() => {
    const box = evidenceRef.current;
    if (!activeField || !box) return;
    const mark = box.querySelector("mark.c-evidence-mark");
    if (!mark) return;
    const boxRect = box.getBoundingClientRect();
    const markRect = mark.getBoundingClientRect();
    const top = box.scrollTop + (markRect.top - boxRect.top) - box.clientHeight / 2 + markRect.height / 2;
    box.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
    (box.closest(".ui-section") ?? box).scrollIntoView({ behavior: "smooth", block: "center" });
  }, [activeField]);

  // Destaca no menu a seção que está na tela.
  useEffect(() => {
    const ids = [...SECOES.map((x) => x.id as string), "transcricao"].map((id) => `pv-sec-${id}`);
    const els = ids.map((id) => document.getElementById(id)).filter(Boolean) as HTMLElement[];
    if (!els.length) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (Date.now() < travaNav.current) return;
        const vis = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (vis) setSecaoAtiva(vis.target.id.replace("pv-sec-", ""));
      },
      { rootMargin: "-90px 0px -60% 0px", threshold: 0 }
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  const irPara = (id: string) => {
    travaNav.current = Date.now() + 1200;
    setSecaoAtiva(id);
    document.getElementById(`pv-sec-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const exportAs = async (kind: "pdf" | "docx") => {
    setExporting(kind);
    try {
      if (kind === "pdf") await downloadProntuarioPdf(prontuario);
      else await downloadProntuarioDocx(prontuario);
    } catch (err) {
      console.error("[export]", err);
      window.alert("Não foi possível gerar o arquivo. Tente novamente.");
    } finally {
      setExporting(null);
    }
  };

  const copyMd = async () => {
    try {
      await navigator.clipboard.writeText(prontuarioToMarkdown(prontuario));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* clipboard indisponível */ }
  };

  // Rótulo de campo com link de evidência ("N fontes").
  const Label = ({ children, evKey }: { children: React.ReactNode; evKey?: string }) => {
    const frags = evKey ? evidencias[evKey] ?? [] : [];
    const showEv = Boolean(transcript) && frags.length > 0;
    const isActive = activeField === evKey;
    return (
      <FieldLabel
        aside={
          showEv && (
            <TextButton
              tone="accent"
              className={isActive ? "ui-on" : undefined}
              onClick={() => setActiveField(isActive ? null : evKey!)}
              title="Ver evidência na transcrição"
            >
              {frags.length} fonte{frags.length > 1 ? "s" : ""}
            </TextButton>
          )
        }
      >
        {children}
      </FieldLabel>
    );
  };

  const temAlertas = itens.length > 0;

  const tabs: TabItem[] = [
    ...SECOES.map((x) => ({ id: x.id as string, label: x.label })),
    ...(transcript
      ? [{
          id: "transcricao",
          label: "Transcrição",
        }]
      : []),
  ];

  return (
    <div className="pv">
      {/* Barra fixa: estado, navegação entre seções e ações */}
      <div className="pv-bar">
        <div className="pv-bar-status">
          <Status tone={aprovado ? "green" : "amber"}>{aprovado ? "Aprovado" : "Aguardando aprovação"}</Status>
          <span className="pv-autosave">Salvo automaticamente</span>
        </div>
        <Tabs className="pv-bar-tabs" items={tabs} value={secaoAtiva} onChange={irPara} aria-label="Seções do prontuário" />
        <div className="pv-bar-actions">
          <IconButton label={copied ? "Copiado!" : "Copiar prontuário (Markdown)"} onClick={copyMd}>
            {copied ? (
              <svg viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="12" height="12" rx="2" /><path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1" /></svg>
            )}
          </IconButton>
          <Menu
            trigger={(open, toggle) => (
              <IconButton label="Baixar prontuário" active={open} disabled={exporting !== null} onClick={toggle} aria-haspopup="menu" aria-expanded={open}>
                {exporting ? (
                  <span className="ui-spinner" />
                ) : (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
                )}
              </IconButton>
            )}
            items={[
              { id: "pdf", badge: "PDF", label: "Baixar como PDF", onSelect: () => exportAs("pdf") },
              { id: "docx", badge: "DOC", label: "Baixar como Word (.docx)", onSelect: () => exportAs("docx") },
            ]}
          />
          {!aprovado && (
            <Button
              variant="primary"
              size="sm"
              disabled={!podeAprovar}
              onClick={onAprovar}
              title={podeAprovar ? "Aprovar e assinar o prontuário" : "Confirme os itens de revisão para aprovar"}
            >
              Aprovar
            </Button>
          )}
        </div>
      </div>
      {!aprovado && !podeAprovar && (
        <button type="button" className="pv-revisar" onClick={() => alertasRef.current?.scrollIntoView({ behavior: "smooth", block: "center" })}>
          {itens.filter((it) => !confirmados.has(it.key)).length} item(ns) para revisar antes de aprovar
        </button>
      )}

      <div className="pv-main">

      {/* Alertas / gaps */}
      {temAlertas && (
        <div ref={alertasRef}>
          <Callout tone="amber" title="Revisão necessária">
            <ul className="pv-alertas-list">
              {itens.map((it) => (
                <li key={it.key} className="pv-alerta">
                  {alertas.requer_confirmacao && (
                    <label className="pv-confirm">
                      <input type="checkbox" checked={confirmados.has(it.key)} onChange={() => toggleConfirm(it.key)} />
                      <span>Confirmar</span>
                    </label>
                  )}
                  <span className="pv-alerta-text">
                    <strong>
                      {it.tipo === "alerta" ? "Alerta clínico" : it.tipo === "inconsistencia" ? "Inconsistência" : "Informação incompleta"}:
                    </strong>{" "}
                    {it.texto}
                  </span>
                </li>
              ))}
            </ul>
          </Callout>
        </div>
      )}

      {/* Anamnese */}
      <Section id="pv-sec-anamnese" title="Anamnese">
        <div className="ui-field">
          <Label evKey="queixa_principal">Queixa principal</Label>
          <AutoTextarea className="ui-input" value={anamnese.queixa_principal}
            placeholder="—" onChange={(e) => setAnamnese({ queixa_principal: e.target.value })} />
        </div>
        <div className="ui-grid ui-grid-2">
          <div className="ui-field">
            <Label evKey="medicamentos">Medicamentos em uso</Label>
            <ListField value={anamnese.medicamentos ?? []} onCommit={(v) => setAnamnese({ medicamentos: v })} placeholder="Separe por vírgula" />
          </div>
          <div className="ui-field">
            <Label evKey="alergias">Alergias</Label>
            <ListField value={anamnese.alergias} onCommit={(v) => setAnamnese({ alergias: v })} placeholder="Separe por vírgula" />
          </div>
        </div>
        <div className="ui-field">
          <Label evKey="historico_medico">Histórico médico</Label>
          <AutoTextarea className="ui-input" value={anamnese.historico_medico ?? ""}
            placeholder="—" onChange={(e) => setAnamnese({ historico_medico: e.target.value })} />
        </div>
        <div className="ui-grid ui-grid-2">
          <div className="ui-field">
            <Label evKey="habitos">Hábitos</Label>
            <AutoTextarea className="ui-input" value={anamnese.habitos ?? ""}
              placeholder="—" onChange={(e) => setAnamnese({ habitos: e.target.value })} />
          </div>
          <div className="ui-field">
            <Label evKey="comorbidades">Comorbidades</Label>
            <AutoTextarea className="ui-input" value={anamnese.comorbidades ?? ""}
              placeholder="—" onChange={(e) => setAnamnese({ comorbidades: e.target.value })} />
          </div>
        </div>
      </Section>

      {/* Exame clínico */}
      <Section id="pv-sec-exame" title="Exame clínico">
        <div className="ui-grid ui-grid-2">
          <div className="ui-field">
            <Label evKey="extraoral">Extraoral</Label>
            <AutoTextarea className="ui-input" value={exame.extraoral ?? ""}
              placeholder="—" onChange={(e) => setExame({ extraoral: e.target.value })} />
          </div>
          <div className="ui-field">
            <Label evKey="intraoral">Intraoral</Label>
            <AutoTextarea className="ui-input" value={exame.intraoral ?? ""}
              placeholder="—" onChange={(e) => setExame({ intraoral: e.target.value })} />
          </div>
          <div className="ui-field">
            <Label evKey="periodonto">Periodonto</Label>
            <AutoTextarea className="ui-input" value={exame.periodonto ?? ""}
              placeholder="—" onChange={(e) => setExame({ periodonto: e.target.value })} />
          </div>
          <div className="ui-field">
            <Label evKey="oclusao">Oclusão</Label>
            <AutoTextarea className="ui-input" value={exame.oclusao ?? ""}
              placeholder="—" onChange={(e) => setExame({ oclusao: e.target.value })} />
          </div>
        </div>

        <div className="ui-field">
          <Label evKey="odontograma">Odontograma</Label>
          {exame.odontograma.length === 0 && <p className="pv-empty-note">Nenhum elemento identificado.</p>}
          <div className="pv-odonto">
            {exame.odontograma.map((d, i) => (
              <div className="pv-odonto-row" key={i}>
                <input className="ui-input pv-odonto-el" value={d.elemento} placeholder="FDI"
                  onChange={(e) => setDente(i, { elemento: e.target.value })} />
                <input className="ui-input pv-odonto-st" value={d.status} placeholder="Status"
                  onChange={(e) => setDente(i, { status: e.target.value })} />
                <input className="ui-input pv-odonto-obs" value={d.observacao ?? ""} placeholder="Observação"
                  onChange={(e) => setDente(i, { observacao: e.target.value })} />
                <button type="button" className="pv-odonto-del" onClick={() => removeDente(i)} aria-label="Remover elemento">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="14" height="14">
                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              </div>
            ))}
          </div>
          <button type="button" className="pv-add-btn" onClick={addDente}>+ Adicionar elemento</button>
        </div>

        <div className="ui-field">
          <Label evKey="laudo_radiologico">Laudo radiológico</Label>
          <AutoTextarea className="ui-input" value={exame.laudo_radiologico ?? ""}
            placeholder="—" onChange={(e) => setExame({ laudo_radiologico: e.target.value })} />
        </div>
      </Section>

      {/* Diagnóstico */}
      <Section id="pv-sec-diagnostico" title="Diagnóstico">
        <div className="pv-cid-row">
          {diagnostico.cid_codigo ? (
            <span className="pv-cid-badge">
              {diagnostico.cid_codigo}{diagnostico.cid_descricao ? ` — ${diagnostico.cid_descricao}` : ""}
            </span>
          ) : (
            <span className="pv-cid-badge pv-cid-badge-empty">CID não definido</span>
          )}
        </div>
        <div className="ui-grid ui-grid-3">
          <div className="ui-field">
            <Label>Código CID-10</Label>
            <input className="ui-input" value={diagnostico.cid_codigo}
              placeholder="K04.1" onChange={(e) => setDiag({ cid_codigo: e.target.value.toUpperCase() })} />
          </div>
          <div className="ui-field">
            <Label>Descrição</Label>
            <input className="ui-input" value={diagnostico.cid_descricao}
              placeholder="—" onChange={(e) => setDiag({ cid_descricao: e.target.value })} />
          </div>
          <div className="ui-field">
            <Label>Elemento dental</Label>
            <input className="ui-input" value={diagnostico.elemento_dental}
              placeholder="FDI" onChange={(e) => setDiag({ elemento_dental: e.target.value })} />
          </div>
        </div>
        <label className="pv-check-inline">
          <input type="checkbox" checked={diagnostico.confirmado_por_raio_x}
            onChange={(e) => setDiag({ confirmado_por_raio_x: e.target.checked })} />
          <span>Confirmado por raio-x</span>
        </label>
      </Section>

      {/* Plano de tratamento */}
      <Section id="pv-sec-plano" title="Plano de tratamento">
        <div className="ui-field">
          <Label evKey="procedimentos_realizados">Procedimentos realizados</Label>
          <p className="ui-field-hint">Documentação clínica — o que foi feito tecnicamente.</p>
          <ListField
            value={procedimentosRealizados(plano)}
            onCommit={(v) => setPlano({ procedimentos_realizados: v })}
            placeholder="Separe por vírgula"
          />
        </div>

        {/* Procedimentos para cobrança (consolidados pelo Passo 4) */}
        <FaturaveisSection faturaveis={plano.procedimentos_faturaveis ?? []} />

        <div className="ui-grid ui-grid-2">
          <div className="ui-field">
            <Label evKey="materiais">Materiais</Label>
            <AutoTextarea className="ui-input" value={plano.materiais ?? ""}
              placeholder="—" onChange={(e) => setPlano({ materiais: e.target.value })} />
          </div>
          <div className="ui-field">
            <Label evKey="anestesia">Anestesia</Label>
            <AutoTextarea className="ui-input" value={plano.anestesia ?? ""}
              placeholder="—" onChange={(e) => setPlano({ anestesia: e.target.value })} />
          </div>
          <div className="ui-field">
            <Label evKey="pos_operatorio">Pós-operatório</Label>
            <AutoTextarea className="ui-input" value={plano.pos_operatorio ?? ""}
              placeholder="—" onChange={(e) => setPlano({ pos_operatorio: e.target.value })} />
          </div>
          <div className="ui-field">
            <Label evKey="proxima_consulta">Próxima consulta</Label>
            <AutoTextarea className="ui-input" value={plano.proxima_consulta ?? ""}
              placeholder="—" onChange={(e) => setPlano({ proxima_consulta: e.target.value })} />
          </div>
        </div>
      </Section>

      {/* Cobrança */}
      <Section id="pv-sec-cobranca" title="Cobrança">
        <div className="ui-grid ui-grid-2">
          <div className="ui-field">
            <Label>Convênio</Label>
            <input className="ui-input" value={metadata_cobranca.convenio_nome ?? ""}
              placeholder="—" onChange={(e) => setMeta({ convenio_nome: e.target.value })} />
          </div>
          <div className="ui-field">
            <Label>Carteirinha</Label>
            <input className="ui-input" value={metadata_cobranca.carteirinha ?? ""}
              placeholder="—" onChange={(e) => setMeta({ carteirinha: e.target.value })} />
          </div>
        </div>
        <div className="pv-meta-toggles">
          <label className="pv-check-inline">
            <input type="checkbox" checked={metadata_cobranca.raio_x_realizado}
              onChange={(e) => setMeta({ raio_x_realizado: e.target.checked })} />
            <span>Raio-x realizado</span>
          </label>
          <label className="pv-check-inline">
            <input type="checkbox" checked={metadata_cobranca.requer_autorizacao_previa}
              onChange={(e) => setMeta({ requer_autorizacao_previa: e.target.checked })} />
            <span>Requer autorização prévia</span>
          </label>
          <div className="pv-sessoes">
            <span>Sessões</span>
            <input type="number" min={1} className="ui-input pv-input-num"
              value={metadata_cobranca.sessoes_realizadas}
              onChange={(e) => setMeta({ sessoes_realizadas: Math.max(1, parseInt(e.target.value, 10) || 1) })} />
          </div>
        </div>
      </Section>

      {/* Aprovação */}
      <div className="pv-aprovar-row">
        {aprovado ? (
          <span className="pv-aprovado-badge">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
            Prontuário aprovado
          </span>
        ) : podeAprovar ? (
          <button type="button" className="pv-aprovar-btn" onClick={onAprovar}>Aprovar prontuário</button>
        ) : (
          <span className="pv-aprovar-hint">Confirme os itens destacados para liberar a aprovação.</span>
        )}
      </div>


        {/* Transcrição no fim da página; a aba "Transcrição" e os links "N fontes" levam até aqui */}
        {transcript && (
          <Section id="pv-sec-transcricao" title="Transcrição da consulta">
            <p className="ui-field-hint">
              {activeField ? "Trechos que embasam o campo selecionado estão destacados." : "Clique em “fontes” ao lado de um campo para ver de onde veio a informação."}
            </p>
            <div className="pv-transcript" ref={evidenceRef}>
              <HighlightedTranscript text={transcript} quotes={activeField ? evidencias[activeField] ?? [] : []} />
            </div>
          </Section>
        )}
      </div>{/* /pv-main */}
      {/* Folga sob a transcrição enquanto há evidência ativa: sem ela a página já está no fim
          do scroll e não consegue centralizar o painel na tela. */}
      {transcript && activeField && <div aria-hidden style={{ height: "40vh" }} />}
    </div>
  );
}
