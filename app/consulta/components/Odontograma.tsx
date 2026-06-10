"use client";

import { useEffect, useState } from "react";
import type {
  OdontogramaModel,
  DenteOdontogramaModel,
  CondicaoSuperficie,
  SuperficieKey,
  ToothLabel,
  DenteModel,
} from "@/lib/types-prontuario";
import { getOdontograma, saveOdontograma, getProntuarioOdontograma } from "@/lib/prontuario-storage";

/**
 * Aba Odontograma — 32 dentes (FDI) com 5 superfícies clicáveis por dente,
 * labels (canal/coroa/implante/prótese/ausente), observação e merge opcional
 * com o odontograma extraído pelo agente de prontuário. Estado por paciente.
 *
 * Lógica de superfícies inspirada no projeto Aural (Abel1011/aural),
 * reimplementada em SVG + CSS global com a identidade do Jasmin.
 */

interface Props {
  patientId: string;
}

// Arcos FDI: direita→esquerda no 1º quadrante, esquerda→direita no 2º.
const ARCADA_SUPERIOR = [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28];
const ARCADA_INFERIOR = [48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38];

const SURFACE_COLORS: Record<CondicaoSuperficie, string> = {
  carie: "#E05C3A",
  restauracao_resina: "#5A96C8",
  restauracao_amalgama: "#9E9E9E",
  selante: "#81C784",
};

const CONDICOES: { key: CondicaoSuperficie | "saudavel"; label: string; cor: string }[] = [
  { key: "saudavel", label: "Saudável", cor: "#fff" },
  { key: "carie", label: "Cárie", cor: SURFACE_COLORS.carie },
  { key: "restauracao_resina", label: "Restauração resina", cor: SURFACE_COLORS.restauracao_resina },
  { key: "restauracao_amalgama", label: "Restauração amálgama", cor: SURFACE_COLORS.restauracao_amalgama },
  { key: "selante", label: "Selante", cor: SURFACE_COLORS.selante },
];

const LABELS: { key: ToothLabel; label: string }[] = [
  { key: "canal", label: "Canal" },
  { key: "coroa", label: "Coroa" },
  { key: "implante", label: "Implante" },
  { key: "protese", label: "Prótese" },
];

const HEALTHY: DenteOdontogramaModel = { superficies: {}, labels: [], ausente: false };

// Geometria das 5 superfícies num viewBox 0..100.
const SURFACE_POINTS: Record<SuperficieKey, string> = {
  V: "3,3 97,3 65,35 35,35",   // topo (vestibular)
  D: "97,3 97,97 65,65 65,35", // direita (distal)
  L: "97,97 3,97 35,65 65,65", // base (lingual)
  M: "3,97 3,3 35,35 35,65",   // esquerda (mesial)
  O: "35,35 65,35 65,65 35,65",// centro (oclusal)
};
const SURFACE_ORDER: SuperficieKey[] = ["V", "D", "L", "M", "O"];

function isHealthy(t: DenteOdontogramaModel): boolean {
  return !t.ausente && t.labels.length === 0 && Object.keys(t.superficies).length === 0 && !t.observacao?.trim();
}

/** Heurística de merge: traduz o status textual do agente em superfícies/labels. */
function mergeStatus(base: DenteOdontogramaModel, status: string): DenteOdontogramaModel {
  const s = status.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const next: DenteOdontogramaModel = {
    superficies: { ...base.superficies },
    labels: [...base.labels],
    ausente: base.ausente,
    observacao: base.observacao,
  };

  if (/(ausente|extra[ií]|perd)/.test(s)) next.ausente = true;
  const addLabel = (l: ToothLabel) => { if (!next.labels.includes(l)) next.labels.push(l); };
  if (/(canal|endodon)/.test(s)) addLabel("canal");
  if (/coroa/.test(s)) addLabel("coroa");
  if (/implante/.test(s)) addLabel("implante");
  if (/protese/.test(s)) addLabel("protese");

  let cond: CondicaoSuperficie | null = null;
  if (/selante/.test(s)) cond = "selante";
  else if (/amalgama/.test(s)) cond = "restauracao_amalgama";
  else if (/(resina|restaur|obtur)/.test(s)) cond = "restauracao_resina";
  else if (/(carie|cariad)/.test(s)) cond = "carie";

  if (cond && !next.ausente) {
    let surf: SuperficieKey = "O";
    if (/vestibular/.test(s)) surf = "V";
    else if (/(lingual|palatin)/.test(s)) surf = "L";
    else if (/mesial/.test(s)) surf = "M";
    else if (/distal/.test(s)) surf = "D";
    next.superficies[surf] = cond;
  }
  return next;
}

export default function Odontograma({ patientId }: Props) {
  const [od, setOd] = useState<OdontogramaModel>({ dentes: {}, ultima_atualizacao: "" });
  const [hydrated, setHydrated] = useState(false);
  const [mergeData, setMergeData] = useState<DenteModel[]>([]);
  const [popover, setPopover] = useState<{ fdi: number; surface: SuperficieKey; x: number; y: number } | null>(null);
  const [selected, setSelected] = useState<number | null>(null);

  useEffect(() => {
    setOd(getOdontograma(patientId));
    setMergeData(getProntuarioOdontograma(patientId));
    setSelected(null);
    setPopover(null);
    setHydrated(true);
  }, [patientId]);

  const toothOf = (fdi: number): DenteOdontogramaModel => od.dentes[fdi] ?? HEALTHY;

  const persist = (dentes: Record<number, DenteOdontogramaModel>) => {
    const model: OdontogramaModel = { dentes, ultima_atualizacao: new Date().toISOString() };
    setOd(model);
    saveOdontograma(patientId, model);
  };

  const updateTooth = (fdi: number, next: DenteOdontogramaModel) => {
    const dentes = { ...od.dentes };
    if (isHealthy(next)) delete dentes[fdi];
    else dentes[fdi] = next;
    persist(dentes);
  };

  const applyCondition = (fdi: number, surface: SuperficieKey, cond: CondicaoSuperficie | null) => {
    const t = toothOf(fdi);
    const superficies = { ...t.superficies };
    if (cond) superficies[surface] = cond;
    else delete superficies[surface];
    updateTooth(fdi, { ...t, superficies });
    setPopover(null);
  };

  const toggleLabel = (fdi: number, label: ToothLabel) => {
    const t = toothOf(fdi);
    const labels = t.labels.includes(label) ? t.labels.filter((l) => l !== label) : [...t.labels, label];
    updateTooth(fdi, { ...t, labels });
  };

  const toggleAusente = (fdi: number) => {
    const t = toothOf(fdi);
    updateTooth(fdi, { ...t, ausente: !t.ausente });
  };

  const setObservacao = (fdi: number, observacao: string) => {
    const t = toothOf(fdi);
    updateTooth(fdi, { ...t, observacao });
  };

  const onSurfaceClick = (fdi: number, surface: SuperficieKey, e: React.MouseEvent) => {
    // Coordenadas de viewport: o popover é position:fixed (não sofre clip do board).
    setPopover({ fdi, surface, x: e.clientX, y: e.clientY });
  };

  const doMerge = () => {
    const dentes = { ...od.dentes };
    for (const d of mergeData) {
      const fdi = parseInt(d.elemento, 10);
      if (!fdi || fdi < 11 || fdi > 48) continue;
      const base = dentes[fdi] ?? HEALTHY;
      const next = mergeStatus(base, d.status || "");
      next.observacao = d.observacao || d.status || base.observacao;
      dentes[fdi] = next;
    }
    persist(dentes);
  };

  const renderArcada = (fdis: number[]) => (
    <div className="od-arcada">
      {fdis.map((fdi) => (
        <Tooth
          key={fdi}
          fdi={fdi}
          model={toothOf(fdi)}
          selected={selected === fdi}
          onSurface={onSurfaceClick}
          onSelectNumber={(f) => setSelected((cur) => (cur === f ? null : f))}
        />
      ))}
    </div>
  );

  const selTooth = selected != null ? toothOf(selected) : null;

  return (
    <div className="od">
      {/* defs do padrão de hachura (prótese) — referenciado por url(#od-hatch) */}
      <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden>
        <defs>
          <pattern id="od-hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="6" stroke="#B58A4C" strokeWidth="2" />
          </pattern>
        </defs>
      </svg>

      <div className="od-toolbar">
        <div className="od-legend">
          {CONDICOES.filter((c) => c.key !== "saudavel").map((c) => (
            <span key={c.key} className="od-legend-item">
              <span className="od-legend-swatch" style={{ background: c.cor }} />
              {c.label}
            </span>
          ))}
        </div>
        {hydrated && mergeData.length > 0 && (
          <button className="od-merge-btn" onClick={doMerge}>
            Atualizar odontograma com dados da consulta
          </button>
        )}
      </div>

      <div className="od-board">
        {renderArcada(ARCADA_SUPERIOR)}
        <div className="od-midline" />
        {renderArcada(ARCADA_INFERIOR)}

        {popover && (
          <>
            <div className="od-popover-backdrop" onClick={() => setPopover(null)} />
            <div className="od-popover" style={{ left: popover.x, top: popover.y }}>
              <div className="od-popover-title">Dente {popover.fdi} · face {popover.surface}</div>
              {CONDICOES.map((c) => (
                <button
                  key={c.key}
                  className="od-popover-opt"
                  onClick={() => applyCondition(popover.fdi, popover.surface, c.key === "saudavel" ? null : (c.key as CondicaoSuperficie))}
                >
                  <span className="od-popover-swatch" style={{ background: c.cor, borderColor: c.key === "saudavel" ? "#E0E0E0" : c.cor }} />
                  {c.label}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Painel lateral do dente selecionado */}
      {selected != null && selTooth && (
        <div className="od-panel">
          <div className="od-panel-head">
            <span className="od-panel-title">Dente {selected}</span>
            <button className="od-panel-close" onClick={() => setSelected(null)} aria-label="Fechar">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>

          <div className="od-panel-section">
            <span className="od-panel-label">Condições do dente</span>
            <div className="od-chips">
              {LABELS.map((l) => (
                <button
                  key={l.key}
                  className={`od-chip${selTooth.labels.includes(l.key) ? " od-chip-active" : ""}`}
                  onClick={() => toggleLabel(selected, l.key)}
                >
                  {l.label}
                </button>
              ))}
              <button
                className={`od-chip${selTooth.ausente ? " od-chip-active od-chip-danger" : ""}`}
                onClick={() => toggleAusente(selected)}
              >
                Ausente
              </button>
            </div>
          </div>

          <div className="od-panel-section">
            <span className="od-panel-label">Observação</span>
            <textarea
              className="od-panel-obs"
              rows={3}
              placeholder="Anotação sobre o dente…"
              value={selTooth.observacao ?? ""}
              onChange={(e) => setObservacao(selected, e.target.value)}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ── Dente ────────────────────────────────────────────────────────────────────
function Tooth({
  fdi, model, selected, onSurface, onSelectNumber,
}: {
  fdi: number;
  model: DenteOdontogramaModel;
  selected: boolean;
  onSurface: (fdi: number, surface: SuperficieKey, e: React.MouseEvent) => void;
  onSelectNumber: (fdi: number) => void;
}) {
  const fill = (k: SuperficieKey) => {
    const cond = model.superficies[k];
    return cond ? SURFACE_COLORS[cond] : "#fff";
  };

  return (
    <div className="od-tooth">
      <div className="od-tooth-flags">
        {model.labels.includes("canal") && <span className="od-flag od-flag-canal" title="Canal">✚</span>}
      </div>

      <svg className="od-tooth-svg" viewBox="0 0 100 100" role="img" aria-label={`Dente ${fdi}`}>
        {model.ausente ? (
          <>
            <rect x="3" y="3" width="94" height="94" rx="8" fill="#ECEAE7" stroke="#D8D3CC" />
            <line x1="22" y1="22" x2="78" y2="78" stroke="#B9B2A8" strokeWidth="6" strokeLinecap="round" />
            <line x1="78" y1="22" x2="22" y2="78" stroke="#B9B2A8" strokeWidth="6" strokeLinecap="round" />
          </>
        ) : model.labels.includes("implante") ? (
          <>
            <rect x="3" y="3" width="94" height="94" rx="8" fill="#2A3F66" stroke="#1f2f4d" />
            <rect x="44" y="22" width="12" height="46" rx="3" fill="#cdd7e8" />
            <rect x="38" y="20" width="24" height="8" rx="2" fill="#cdd7e8" />
          </>
        ) : (
          <>
            {SURFACE_ORDER.map((k) => (
              <polygon
                key={k}
                className="od-surface"
                points={SURFACE_POINTS[k]}
                fill={fill(k)}
                stroke="#E0E0E0"
                strokeWidth="1.5"
                onClick={(e) => onSurface(fdi, k, e)}
              />
            ))}
            {model.labels.includes("protese") && (
              <rect x="3" y="3" width="94" height="94" rx="8" fill="url(#od-hatch)" opacity="0.5" pointerEvents="none" />
            )}
          </>
        )}
        {model.labels.includes("coroa") && (
          <rect x="4" y="4" width="92" height="92" rx="10" fill="none" stroke="#D9A441" strokeWidth="5" pointerEvents="none" />
        )}
      </svg>

      <button
        className={`od-tooth-num${selected ? " od-tooth-num-active" : ""}${model.observacao?.trim() ? " od-tooth-num-note" : ""}`}
        onClick={() => onSelectNumber(fdi)}
        title="Editar dente"
      >
        {fdi}
      </button>
    </div>
  );
}
