"use client";

import { Avatar, Button } from "@/app/components/ui";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { AgAppointment, PatientData } from "@/lib/types-jasmin";
import { getAllProntuarios } from "@/lib/prontuario-storage";
import {
  CONSULT_TYPES,
  aptColors,
  addDays,
  cap,
  fromDateKey,
  getWeekDays,
  getWeekStart,
  minToHM,
  pad2,
  toDateKey,
} from "@/lib/agenda-utils";

/**
 * Agenda no estilo Google Calendar / Teams:
 *  - visões Dia / Semana / Mês, mini-calendário lateral e filtro por tipo;
 *  - linha vermelha do horário atual e rolagem automática até ele;
 *  - consultas sobrepostas lado a lado;
 *  - clicar/arrastar em um horário vazio abre a criação rápida;
 *  - arrastar uma consulta para mover (inclusive entre dias) e puxar a borda
 *    inferior para mudar a duração (passo de 15 min);
 *  - clicar numa consulta abre um card com detalhes e ações.
 * Os dados continuam sendo os mesmos AgAppointment do localStorage (página pai).
 */

export type AgendaView = "dia" | "semana" | "mes";

interface Props {
  appointments: AgAppointment[];
  patients: PatientData[];
  date: Date;
  view: AgendaView;
  onDateChange: (d: Date) => void;
  onViewChange: (v: AgendaView) => void;
  onChangeAppointments: (fn: (prev: AgAppointment[]) => AgAppointment[]) => void;
  onOpenConsulta: (apt: AgAppointment) => void;
  onOpenPatient: (patientId: string) => void;
  onDeleteConsulta: (apt: AgAppointment) => void;
  /** Abre o modal completo "Nova consulta", já preenchido. */
  onMoreOptions: (p: { dateKey: string; startMin: number; endMin: number; patient: PatientData | null; type: string }) => void;
}

const HOUR_H = 64;
const PX = HOUR_H / 60;
const SNAP = 15;
const DAY_NAMES = ["seg", "ter", "qua", "qui", "sex", "sáb", "dom"];

const startMinOf = (a: AgAppointment) => a.startH * 60 + a.startM;
const endMinOf = (a: AgAppointment) => a.endH * 60 + a.endM;
const snap = (m: number) => Math.round(m / SNAP) * SNAP;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

const fmtLong = (d: Date) => cap(d.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" }));

interface Anchor { left: number; right: number; top: number; bottom: number }

interface Ghost {
  kind: "create" | "move" | "resize";
  day: number;
  start: number;
  end: number;
  aptId?: number;
}

type Popover =
  | { kind: "event"; apt: AgAppointment; anchor: Anchor }
  | { kind: "create"; dateKey: string; start: number; end: number; anchor: Anchor }
  | null;

/** Distribui consultas sobrepostas em colunas lado a lado. */
function layoutDay(apts: AgAppointment[]): Map<number, { col: number; cols: number }> {
  const out = new Map<number, { col: number; cols: number }>();
  const sorted = [...apts].sort((a, b) => startMinOf(a) - startMinOf(b) || endMinOf(b) - endMinOf(a));
  let cluster: { apt: AgAppointment; col: number }[] = [];
  let colEnds: number[] = [];
  let clusterEnd = -1;
  const flush = () => {
    for (const c of cluster) out.set(c.apt.id, { col: c.col, cols: colEnds.length });
    cluster = [];
    colEnds = [];
    clusterEnd = -1;
  };
  for (const apt of sorted) {
    if (cluster.length && startMinOf(apt) >= clusterEnd) flush();
    let col = colEnds.findIndex((e) => e <= startMinOf(apt));
    if (col === -1) {
      col = colEnds.length;
      colEnds.push(endMinOf(apt));
    } else colEnds[col] = endMinOf(apt);
    cluster.push({ apt, col });
    clusterEnd = Math.max(clusterEnd, endMinOf(apt));
  }
  flush();
  return out;
}

export default function Agenda({
  appointments,
  patients,
  date,
  view,
  onDateChange,
  onViewChange,
  onChangeAppointments,
  onOpenConsulta,
  onOpenPatient,
  onDeleteConsulta,
  onMoreOptions,
}: Props) {
  // `now` começa numa data fixa: o servidor e o 1º render do navegador precisam gerar o
  // mesmo HTML (senão o React acusa erro de hidratação). O horário real entra após montar.
  const [now, setNow] = useState(() => new Date(2000, 0, 1, 12, 0));
  const [mounted, setMounted] = useState(false);
  const [panelOpen, setPanelOpen] = useState(true);
  const [hiddenTypes, setHiddenTypes] = useState<Set<string>>(new Set());
  const [miniMonth, setMiniMonth] = useState(() => new Date(date.getFullYear(), date.getMonth(), 1));
  const [ghost, setGhost] = useState<Ghost | null>(null);
  const [popover, setPopover] = useState<Popover>(null);
  const [doneIds, setDoneIds] = useState<Set<string>>(new Set());

  const scrollRef = useRef<HTMLDivElement>(null);
  const colsRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ moved: boolean } | null>(null);

  // Relógio (linha do "agora" + resumo do dia)
  useEffect(() => {
    setNow(new Date());
    setMounted(true);
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);

  // Quais consultas já têm prontuário salvo (selo de "realizada").
  useEffect(() => {
    setDoneIds(new Set(Object.keys(getAllProntuarios())));
  }, [appointments]);

  // Mini-calendário acompanha a data principal.
  useEffect(() => {
    setMiniMonth(new Date(date.getFullYear(), date.getMonth(), 1));
  }, [date]);

  // ── janela de horas: 07–20, ampliada se houver consultas fora dela ─────────
  // A janela também cobre a hora atual, para a linha do "agora" nunca ficar de fora.
  const nowHour = now.getHours();
  const { startH, endH } = useMemo(() => {
    let s = Math.min(7, nowHour);
    let e = Math.max(20, nowHour + 1);
    for (const a of appointments) {
      s = Math.min(s, a.startH);
      e = Math.max(e, a.endM > 0 ? a.endH + 1 : a.endH);
    }
    return { startH: Math.max(0, s), endH: Math.min(24, e) };
  }, [appointments, nowHour]);
  const hours = useMemo(() => Array.from({ length: endH - startH }, (_, i) => startH + i), [startH, endH]);
  const gridH = (endH - startH) * HOUR_H;
  const minToY = useCallback((m: number) => (m - startH * 60) * PX, [startH]);

  // ── dias exibidos ────────────────────────────────────────────────────────────
  const days = useMemo(() => (view === "dia" ? [date] : getWeekDays(date)), [view, date]);
  const todayKey = toDateKey(now);
  const weekHasToday = days.some((d) => toDateKey(d) === todayKey);

  const visibleApts = useMemo(
    () => appointments.filter((a) => !hiddenTypes.has(a.type || "Consulta")),
    [appointments, hiddenTypes]
  );
  const byDay = useMemo(() => {
    const m = new Map<string, AgAppointment[]>();
    for (const a of visibleApts) {
      const list = m.get(a.date);
      if (list) list.push(a);
      else m.set(a.date, [a]);
    }
    return m;
  }, [visibleApts]);

  // ── rolagem automática até "agora" (ou 8h) ao trocar de visão/semana ─────────
  const rangeKey = view === "mes" ? "mes" : days.map(toDateKey).join(",");
  const scrolledFor = useRef("");
  useEffect(() => {
    const el = scrollRef.current;
    if (!mounted || !el || view === "mes" || scrolledFor.current === rangeKey) return;
    const id = requestAnimationFrame(() => {
      const nowMin = now.getHours() * 60 + now.getMinutes();
      const showsToday = days.some((d) => toDateKey(d) === todayKey);
      // hoje: centraliza o "agora"; outros dias: começa perto das 8h
      el.scrollTop = Math.max(0, showsToday ? minToY(nowMin) - el.clientHeight / 2 : minToY(8 * 60 - 30));
      scrolledFor.current = rangeKey;
    });
    return () => cancelAnimationFrame(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rangeKey, view, gridH, mounted]);

  // ── navegação ────────────────────────────────────────────────────────────────
  const step = useCallback(
    (dir: -1 | 1) => {
      if (view === "mes") onDateChange(new Date(date.getFullYear(), date.getMonth() + dir, 1));
      else onDateChange(addDays(date, dir * (view === "semana" ? 7 : 1)));
    },
    [view, date, onDateChange]
  );

  // Atalhos: T = hoje, ←/→ = período, D/S/M = visão, Esc = fecha card.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "Escape") setPopover(null);
      else if (e.key === "ArrowLeft") step(-1);
      else if (e.key === "ArrowRight") step(1);
      else if (e.key === "t" || e.key === "T") onDateChange(new Date());
      else if (e.key === "d" || e.key === "D") onViewChange("dia");
      else if (e.key === "s" || e.key === "S") onViewChange("semana");
      else if (e.key === "m" || e.key === "M") onViewChange("mes");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [step, onDateChange, onViewChange]);

  const title = useMemo(() => {
    if (view === "mes") return cap(date.toLocaleDateString("pt-BR", { month: "long", year: "numeric" }));
    if (view === "dia") return cap(date.toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric" }));
    const w = getWeekDays(date);
    const a = w[0];
    const b = w[6];
    if (a.getMonth() === b.getMonth())
      return `${a.getDate()}–${b.getDate()} de ${a.toLocaleDateString("pt-BR", { month: "long" })} de ${b.getFullYear()}`;
    const mo = (d: Date) => d.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "");
    return `${a.getDate()} de ${mo(a)} – ${b.getDate()} de ${mo(b)} de ${b.getFullYear()}`;
  }, [view, date]);

  // ── pointer: criar / mover / redimensionar ───────────────────────────────────
  const pointToCell = (clientX: number, clientY: number) => {
    const rect = colsRef.current!.getBoundingClientRect();
    const dayIdx = clamp(Math.floor(((clientX - rect.left) / rect.width) * days.length), 0, days.length - 1);
    const minutes = startH * 60 + (clientY - rect.top) / PX;
    return { dayIdx, minutes, rect };
  };

  const anchorFor = (dayIdx: number, start: number, end: number): Anchor => {
    const rect = colsRef.current!.getBoundingClientRect();
    const w = rect.width / days.length;
    return {
      left: rect.left + dayIdx * w,
      right: rect.left + (dayIdx + 1) * w,
      top: rect.top + minToY(start),
      bottom: rect.top + minToY(end),
    };
  };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 || !colsRef.current) return;
    const target = e.target as HTMLElement;
    const evtEl = target.closest<HTMLElement>("[data-apt]");
    const aptId = evtEl ? Number(evtEl.dataset.apt) : null;
    const apt = aptId != null ? appointments.find((a) => a.id === aptId) ?? null : null;
    const isResize = Boolean(target.closest("[data-resize]"));
    const x0 = e.clientX;
    const y0 = e.clientY;
    const dayAtDown = pointToCell(x0, y0).dayIdx;
    const minAtDown = pointToCell(x0, y0).minutes;
    const lo = startH * 60;
    const hi = endH * 60;
    dragRef.current = { moved: false };
    setPopover(null);

    let latest: Ghost | null = null;

    const onMove = (ev: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      if (!drag.moved && Math.hypot(ev.clientX - x0, ev.clientY - y0) < 4) return;
      drag.moved = true;
      const { dayIdx, minutes } = pointToCell(ev.clientX, ev.clientY);
      if (apt && isResize) {
        const end = clamp(snap(minutes), startMinOf(apt) + SNAP, hi);
        latest = { kind: "resize", day: days.findIndex((d) => toDateKey(d) === apt.date), start: startMinOf(apt), end, aptId: apt.id };
      } else if (apt) {
        const dur = endMinOf(apt) - startMinOf(apt);
        const grab = minAtDown - startMinOf(apt);
        const start = clamp(snap(minutes - grab), lo, hi - dur);
        latest = { kind: "move", day: dayIdx, start, end: start + dur, aptId: apt.id };
      } else {
        const a = snap(Math.floor(minAtDown / SNAP) * SNAP);
        const b = snap(minutes);
        const start = clamp(Math.min(a, b), lo, hi - SNAP);
        const end = clamp(Math.max(a, b + (b >= a ? SNAP : 0)), start + SNAP, hi);
        latest = { kind: "create", day: dayAtDown, start, end };
      }
      setGhost(latest);
    };

    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      const moved = dragRef.current?.moved ?? false;
      dragRef.current = null;
      setGhost(null);

      if (apt && !moved) {
        // clique simples → card de detalhes
        const r = (evtEl as HTMLElement).getBoundingClientRect();
        setPopover({ kind: "event", apt, anchor: { left: r.left, right: r.right, top: r.top, bottom: r.bottom } });
        return;
      }
      if (apt && moved && latest) {
        const g = latest;
        const newDate = g.kind === "move" ? toDateKey(days[g.day]) : apt.date;
        if (g.start !== startMinOf(apt) || g.end !== endMinOf(apt) || newDate !== apt.date) {
          onChangeAppointments((prev) =>
            prev.map((a) =>
              a.id === apt.id
                ? { ...a, date: newDate, startH: Math.floor(g.start / 60), startM: g.start % 60, endH: Math.floor(g.end / 60), endM: g.end % 60 }
                : a
            )
          );
        }
        return;
      }
      if (!apt) {
        // criar: arrastou (latest) ou clicou (padrão 1h)
        let start: number;
        let end: number;
        if (moved && latest) {
          start = latest.start;
          end = latest.end;
        } else {
          start = clamp(Math.floor(minAtDown / SNAP) * SNAP, lo, hi - 60);
          end = Math.min(start + 60, hi);
        }
        setGhost({ kind: "create", day: dayAtDown, start, end });
        setPopover({ kind: "create", dateKey: toDateKey(days[dayAtDown]), start, end, anchor: anchorFor(dayAtDown, start, end) });
      }
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp, { once: true });
  };

  const closePopover = () => {
    setPopover(null);
    setGhost(null);
  };

  const onDoubleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = (e.target as HTMLElement).closest<HTMLElement>("[data-apt]");
    if (!el) return;
    const apt = appointments.find((a) => a.id === Number(el.dataset.apt));
    if (apt) {
      closePopover();
      onOpenConsulta(apt);
    }
  };

  // ── resumo do dia (painel lateral) ───────────────────────────────────────────
  const today = useMemo(() => {
    const list = (byDay.get(todayKey) ?? []).slice().sort((a, b) => startMinOf(a) - startMinOf(b));
    const nowMin = now.getHours() * 60 + now.getMinutes();
    const done = list.filter((a) => doneIds.has(String(a.id))).length;
    const next = list.find((a) => startMinOf(a) >= nowMin) ?? null;
    return { total: list.length, done, next, nowMin };
  }, [byDay, todayKey, now, doneIds]);

  // ── render helpers ───────────────────────────────────────────────────────────
  const renderEvent = (a: AgAppointment, pos: { col: number; cols: number }) => {
    const c = aptColors(a.type || "Consulta");
    const top = minToY(startMinOf(a));
    const height = Math.max(20, (endMinOf(a) - startMinOf(a)) * PX - 2);
    const done = doneIds.has(String(a.id));
    const past = a.date < todayKey || (a.date === todayKey && endMinOf(a) <= today.nowMin);
    const dragging = ghost?.aptId === a.id;
    const w = 100 / pos.cols;
    const compact = height < 44;
    return (
      <div
        key={a.id}
        data-apt={a.id}
        className={`ag2-evt${past ? " ag2-evt-past" : ""}${dragging ? " ag2-evt-dragging" : ""}${popover?.kind === "event" && popover.apt.id === a.id ? " ag2-evt-active" : ""}`}
        style={{
          top,
          height,
          left: `calc(${pos.col * w}% + 2px)`,
          width: `calc(${w}% - 5px)`,
          background: c.bg,
          color: c.color,
          ["--accent" as string]: c.accent,
        }}
        title={`${a.patient} · ${a.type} · ${minToHM(startMinOf(a))}–${minToHM(endMinOf(a))}`}
      >
        <div className={`ag2-evt-main${compact ? " ag2-evt-compact" : ""}`}>
          <span className="ag2-evt-name">{a.patient}</span>
          {compact ? (
            <span className="ag2-evt-sub">{minToHM(startMinOf(a))}</span>
          ) : (
            <span className="ag2-evt-sub">
              {a.type} · {minToHM(startMinOf(a))}–{minToHM(endMinOf(a))}
            </span>
          )}
        </div>
        {done && (
          <span className="ag2-evt-done" title="Prontuário salvo">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
          </span>
        )}
        <div className="ag2-evt-resize" data-resize />
      </div>
    );
  };

  const headerCell = (d: Date, i: number) => {
    const key = toDateKey(d);
    const isToday = key === todayKey;
    const count = (byDay.get(key) ?? []).length;
    return (
      <button
        key={i}
        type="button"
        className={`ag2-dayhead${isToday ? " ag2-dayhead-today" : ""}${d.getDay() === 0 || d.getDay() === 6 ? " ag2-dayhead-weekend" : ""}`}
        onClick={() => { onDateChange(d); if (view !== "dia") onViewChange("dia"); }}
        title="Ver este dia"
      >
        <span className="ag2-dayhead-name">{DAY_NAMES[(d.getDay() + 6) % 7]}</span>
        <span className="ag2-dayhead-num">{d.getDate()}</span>
        {count > 0 && view !== "dia" && <span className="ag2-dayhead-count">{count}</span>}
      </button>
    );
  };

  // ── visão de mês ─────────────────────────────────────────────────────────────
  const monthCells = useMemo(() => {
    const first = new Date(date.getFullYear(), date.getMonth(), 1);
    const start = getWeekStart(first);
    return Array.from({ length: 42 }, (_, i) => addDays(start, i));
  }, [date]);

  const miniCells = useMemo(() => {
    const first = new Date(miniMonth.getFullYear(), miniMonth.getMonth(), 1);
    const start = getWeekStart(first);
    return Array.from({ length: 42 }, (_, i) => addDays(start, i));
  }, [miniMonth]);

  const weekKeys = useMemo(() => new Set(getWeekDays(date).map(toDateKey)), [date]);

  const typeCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const a of appointments) m.set(a.type || "Consulta", (m.get(a.type || "Consulta") ?? 0) + 1);
    return m;
  }, [appointments]);

  const newDefault = () => {
    const h = clamp(now.getMinutes() > 0 ? now.getHours() + 1 : now.getHours(), startH, endH - 1);
    onMoreOptions({ dateKey: toDateKey(date), startMin: h * 60, endMin: h * 60 + 60, patient: null, type: "Consulta" });
  };

  return (
    <div className="ag2">
      {/* ── Toolbar ─────────────────────────────────────────────── */}
      <div className="ag2-toolbar">
        <button type="button" className="ag2-icon-btn ag2-panel-toggle" onClick={() => setPanelOpen((v) => !v)} title="Mostrar/ocultar painel lateral" aria-label="Painel lateral">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" /></svg>
        </button>
        <button type="button" className="ag2-today-btn" onClick={() => onDateChange(new Date())} title="Ir para hoje (T)">Hoje</button>
        <div className="ag2-nav">
          <button type="button" className="ag2-icon-btn" onClick={() => step(-1)} title="Anterior (←)" aria-label="Anterior">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
          </button>
          <button type="button" className="ag2-icon-btn" onClick={() => step(1)} title="Próximo (→)" aria-label="Próximo">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
          </button>
        </div>
        <h2 className="ag2-title">{title}</h2>
        <div className="ag2-spacer" />
        <div className="ag2-seg" role="tablist" aria-label="Visão">
          {(["dia", "semana", "mes"] as AgendaView[]).map((v) => (
            <button
              key={v}
              type="button"
              role="tab"
              aria-selected={view === v}
              className={`ag2-seg-btn${view === v ? " ag2-seg-active" : ""}`}
              onClick={() => onViewChange(v)}
              title={`${v === "dia" ? "Dia" : v === "semana" ? "Semana" : "Mês"} (${v === "mes" ? "M" : v[0].toUpperCase()})`}
            >
              {v === "dia" ? "Dia" : v === "semana" ? "Semana" : "Mês"}
            </button>
          ))}
        </div>
        <Button type="button" className="ag2-new" variant="primary" size="sm" onClick={newDefault}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" width="14" height="14"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
          Nova consulta
        </Button>
      </div>

      <div className="ag2-body">
        {/* ── Painel lateral ──────────────────────────────────────── */}
        {panelOpen && (
          <aside className="ag2-side">
            <div className="ag2-mini">
              <div className="ag2-mini-head">
                <span>{cap(miniMonth.toLocaleDateString("pt-BR", { month: "long", year: "numeric" }))}</span>
                <span className="ag2-mini-nav">
                  <button type="button" className="ag2-icon-btn ag2-icon-sm" aria-label="Mês anterior" onClick={() => setMiniMonth(new Date(miniMonth.getFullYear(), miniMonth.getMonth() - 1, 1))}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
                  </button>
                  <button type="button" className="ag2-icon-btn ag2-icon-sm" aria-label="Próximo mês" onClick={() => setMiniMonth(new Date(miniMonth.getFullYear(), miniMonth.getMonth() + 1, 1))}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
                  </button>
                </span>
              </div>
              <div className="ag2-mini-grid">
                {["S", "T", "Q", "Q", "S", "S", "D"].map((l, i) => (
                  <span key={i} className="ag2-mini-dow">{l}</span>
                ))}
                {miniCells.map((d) => {
                  const key = toDateKey(d);
                  const inMonth = d.getMonth() === miniMonth.getMonth();
                  const has = (byDay.get(key) ?? []).length > 0;
                  const inWeek = view !== "mes" && weekKeys.has(key) && view === "semana";
                  return (
                    <button
                      key={key}
                      type="button"
                      className={`ag2-mini-day${inMonth ? "" : " ag2-mini-out"}${key === todayKey ? " ag2-mini-today" : ""}${key === toDateKey(date) ? " ag2-mini-sel" : ""}${inWeek ? " ag2-mini-week" : ""}`}
                      onClick={() => onDateChange(d)}
                    >
                      {d.getDate()}
                      {has && <i className="ag2-mini-dot" />}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="ag2-card">
              <div className="ag2-card-title">Hoje</div>
              <div className="ag2-today-stats">
                <div><strong>{today.total}</strong><span>consultas</span></div>
                <div><strong>{today.done}</strong><span>realizadas</span></div>
                <div><strong>{Math.max(0, today.total - today.done)}</strong><span>restantes</span></div>
              </div>
              {today.next ? (
                <button type="button" className="ag2-next" onClick={() => { onDateChange(new Date()); if (view === "mes") onViewChange("dia"); }}>
                  <span className="ag2-next-label">Próxima</span>
                  <span className="ag2-next-name">{today.next.patient}</span>
                  <span className="ag2-next-time">
                    {minToHM(startMinOf(today.next))} · {(() => {
                      const diff = startMinOf(today.next) - today.nowMin;
                      return diff <= 0 ? "agora" : diff < 60 ? `em ${diff} min` : `em ${Math.floor(diff / 60)}h${diff % 60 ? pad2(diff % 60) : ""}`;
                    })()}
                  </span>
                </button>
              ) : (
                <p className="ag2-muted">{today.total ? "Sem mais consultas hoje." : "Nenhuma consulta hoje."}</p>
              )}
            </div>

            <div className="ag2-card">
              <div className="ag2-card-title">Tipos de consulta</div>
              <ul className="ag2-types">
                {CONSULT_TYPES.map((t) => {
                  const c = aptColors(t);
                  const on = !hiddenTypes.has(t);
                  return (
                    <li key={t}>
                      <label className="ag2-type">
                        <input
                          type="checkbox"
                          checked={on}
                          onChange={() =>
                            setHiddenTypes((prev) => {
                              const n = new Set(prev);
                              if (n.has(t)) n.delete(t);
                              else n.add(t);
                              return n;
                            })
                          }
                        />
                        <span className="ag2-type-box" style={{ ["--accent" as string]: c.accent }} data-on={on} />
                        <span className="ag2-type-name">{t}</span>
                        <span className="ag2-type-count">{typeCounts.get(t) ?? 0}</span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            </div>

            <p className="ag2-hint">
              Dica: arraste em um horário vazio para agendar, arraste uma consulta para movê-la e puxe a borda inferior para mudar a duração.
            </p>
          </aside>
        )}

        {/* ── Grade ────────────────────────────────────────────────── */}
        <div className="ag2-main">
          {view === "mes" ? (
            <div className="ag2-month">
              <div className="ag2-month-dow">
                {DAY_NAMES.map((n) => <span key={n}>{n}</span>)}
              </div>
              <div className="ag2-month-grid">
                {monthCells.map((d) => {
                  const key = toDateKey(d);
                  const list = (byDay.get(key) ?? []).slice().sort((a, b) => startMinOf(a) - startMinOf(b));
                  const out = d.getMonth() !== date.getMonth();
                  return (
                    <div
                      key={key}
                      className={`ag2-mcell${out ? " ag2-mcell-out" : ""}${key === todayKey ? " ag2-mcell-today" : ""}`}
                      onClick={() => { onDateChange(d); onViewChange("dia"); }}
                    >
                      <span className="ag2-mcell-num">{d.getDate() === 1 ? `${d.getDate()} ${d.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "")}` : d.getDate()}</span>
                      {list.slice(0, 3).map((a) => {
                        const c = aptColors(a.type || "Consulta");
                        return (
                          <button
                            key={a.id}
                            type="button"
                            className="ag2-chip"
                            style={{ background: c.bg, color: c.color, ["--accent" as string]: c.accent }}
                            onClick={(e) => {
                              e.stopPropagation();
                              const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
                              setPopover({ kind: "event", apt: a, anchor: { left: r.left, right: r.right, top: r.top, bottom: r.bottom } });
                            }}
                          >
                            <b>{minToHM(startMinOf(a))}</b> {a.patient}
                          </button>
                        );
                      })}
                      {list.length > 3 && <span className="ag2-more">+{list.length - 3} mais</span>}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="ag2-gridwrap" data-jasmin-context={view === "dia" ? "agenda_dia" : undefined}>
              <div className="ag2-scroll" ref={scrollRef} onScroll={() => popover && closePopover()}>
                <div className="ag2-headrow">
                  <div className="ag2-gutter" />
                  <div className="ag2-heads" style={{ gridTemplateColumns: `repeat(${days.length}, 1fr)` }}>
                    {days.map(headerCell)}
                  </div>
                </div>
                <div className="ag2-grid" style={{ height: gridH }}>
                  <div className="ag2-hours">
                    {hours.map((h, i) => {
                      const nm = now.getHours() * 60 + now.getMinutes();
                      // some o rótulo da hora cheia quando o do "agora" ficaria por cima
                      const hidden = weekHasToday && Math.abs(nm - h * 60) < 14;
                      return (
                        <div key={h} className="ag2-hour" style={{ top: i * HOUR_H }}>
                          {i > 0 && !hidden && <span>{pad2(h)}:00</span>}
                        </div>
                      );
                    })}
                    {weekHasToday && (
                      <div className="ag2-hour" style={{ top: minToY(now.getHours() * 60 + now.getMinutes()) }}>
                        <span className="ag2-now-label">{minToHM(now.getHours() * 60 + now.getMinutes())}</span>
                      </div>
                    )}
                  </div>
                  <div
                    className="ag2-cols"
                    ref={colsRef}
                    style={{ gridTemplateColumns: `repeat(${days.length}, 1fr)` }}
                    onPointerDown={onPointerDown}
                    onDoubleClick={onDoubleClick}
                  >
                    {days.map((d, di) => {
                      const key = toDateKey(d);
                      const list = byDay.get(key) ?? [];
                      const lay = layoutDay(list);
                      const isToday = key === todayKey;
                      const nowMin = now.getHours() * 60 + now.getMinutes();
                      return (
                        <div key={key} className={`ag2-col${isToday ? " ag2-col-today" : ""}${d.getDay() === 0 || d.getDay() === 6 ? " ag2-col-weekend" : ""}`}>
                          {hours.map((h, i) => (
                            <div key={h} className="ag2-line" style={{ top: i * HOUR_H }}>
                              <i className="ag2-half" style={{ top: HOUR_H / 2 }} />
                            </div>
                          ))}
                          {list.map((a) => renderEvent(a, lay.get(a.id) ?? { col: 0, cols: 1 }))}
                          {ghost && ghost.day === di && (
                            <div
                              className={`ag2-ghost ag2-ghost-${ghost.kind}`}
                              style={{ top: minToY(ghost.start), height: (ghost.end - ghost.start) * PX - 2 }}
                            >
                              <span>{minToHM(ghost.start)} – {minToHM(ghost.end)}</span>
                              {ghost.kind === "create" && <b>Nova consulta</b>}
                              {ghost.kind === "move" && <b>{appointments.find((x) => x.id === ghost.aptId)?.patient}</b>}
                            </div>
                          )}
                          {nowMin >= startH * 60 && nowMin <= endH * 60 && (isToday || weekHasToday) && (
                            <div className={`ag2-now${isToday ? "" : " ag2-now-faint"}`} style={{ top: minToY(nowMin) }}>
                              {isToday && <i />}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Popovers ───────────────────────────────────────────────── */}
      {popover && (
        <>
          <div className="ag2-backdrop" onMouseDown={closePopover} />
          {popover.kind === "event" ? (
            <EventCard
              apt={popover.apt}
              anchor={popover.anchor}
              patient={patients.find((p) => p.id === popover.apt.patientId) ?? null}
              done={doneIds.has(String(popover.apt.id))}
              onClose={closePopover}
              onOpen={() => { const a = popover.apt; closePopover(); onOpenConsulta(a); }}
              onPatient={() => { const a = popover.apt; closePopover(); onOpenPatient(a.patientId); }}
              onDelete={() => { const a = popover.apt; closePopover(); onDeleteConsulta(a); }}
            />
          ) : (
            <CreateCard
              key={`${popover.dateKey}-${popover.start}`}
              dateKey={popover.dateKey}
              start={popover.start}
              end={popover.end}
              anchor={popover.anchor}
              patients={patients}
              dayApts={byDay.get(popover.dateKey) ?? []}
              minH={startH}
              maxH={endH}
              onClose={closePopover}
              onMore={(p) => { closePopover(); onMoreOptions(p); }}
              onSave={(patient, type, s, e) => {
                const c = aptColors(type);
                const apt: AgAppointment = {
                  id: Date.now(),
                  patient: `${patient.nome} ${patient.sobrenome}`,
                  patientId: patient.id,
                  date: popover.dateKey,
                  startH: Math.floor(s / 60),
                  startM: s % 60,
                  endH: Math.floor(e / 60),
                  endM: e % 60,
                  type,
                  bg: c.bg,
                  border: c.border,
                  color: c.color,
                };
                onChangeAppointments((prev) => [...prev, apt]);
                closePopover();
              }}
            />
          )}
        </>
      )}
    </div>
  );
}

/* ───────────────────────── Cards flutuantes ───────────────────────── */

const CARD_W = 340;

/** Posiciona o card ao lado da âncora, sem sair da tela (mede a altura real). */
function useCardPosition(anchor: Anchor) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number }>({ left: -9999, top: 0 });
  useLayoutEffect(() => {
    const h = ref.current?.offsetHeight ?? 400;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let left = anchor.right + 10;
    if (left + CARD_W > vw - 12) left = anchor.left - CARD_W - 10;
    if (left < 12) left = clamp(anchor.left + 12, 12, vw - CARD_W - 12);
    const top = clamp(anchor.top - 6, 12, Math.max(12, vh - h - 12));
    setPos({ left, top });
  }, [anchor]);
  return { ref, ...pos };
}

function EventCard({
  apt, anchor, patient, done, onClose, onOpen, onPatient, onDelete,
}: {
  apt: AgAppointment; anchor: Anchor; patient: PatientData | null; done: boolean;
  onClose: () => void; onOpen: () => void; onPatient: () => void; onDelete: () => void;
}) {
  const pos = useCardPosition(anchor);
  const c = aptColors(apt.type || "Consulta");
  const d = fromDateKey(apt.date);
  return (
    <div ref={pos.ref} className="ag2-card-pop" style={{ left: pos.left, top: pos.top, width: CARD_W }} role="dialog" aria-label="Detalhes da consulta">
      <div className="ag2-pop-actions">
        <button type="button" className="ag2-icon-btn ag2-icon-sm" title="Excluir consulta" aria-label="Excluir consulta" onClick={onDelete}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6M14 11v6" /><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" /></svg>
        </button>
        <button type="button" className="ag2-icon-btn ag2-icon-sm" title="Fechar (Esc)" aria-label="Fechar" onClick={onClose}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
        </button>
      </div>
      <div className="ag2-pop-head">
        <span className="ag2-pop-dot" style={{ background: c.accent }} />
        <div>
          <div className="ag2-pop-title">{apt.patient}</div>
          <div className="ag2-pop-sub">
            {fmtLong(d)} · {minToHM(startMinOf(apt))} – {minToHM(endMinOf(apt))}
          </div>
        </div>
      </div>
      <div className="ag2-pop-rows">
        <div className="ag2-pop-row"><span className="ag2-pill" style={{ background: c.bg, color: c.color }}>{apt.type || "Consulta"}</span>
          {patient?.convenio ? <span className="ag2-pill ag2-pill-gray">{patient.convenio}</span> : <span className="ag2-pill ag2-pill-gray">Particular</span>}
        </div>
        <div className="ag2-pop-row ag2-pop-status">
          {done ? (
            <><svg viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" width="15" height="15"><polyline points="20 6 9 17 4 12" /></svg> Prontuário salvo</>
          ) : (
            <><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" width="15" height="15"><circle cx="12" cy="12" r="9" /><polyline points="12 7 12 12 15 14" /></svg> Sem prontuário ainda</>
          )}
        </div>
        {patient?.telefone && (
          <div className="ag2-pop-row ag2-pop-status">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="15" height="15"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z" /></svg>
            {patient.telefone}
          </div>
        )}
      </div>
      <div className="ag2-pop-foot">
        <Button type="button" variant="secondary" size="sm" onClick={onPatient}>Ver paciente</Button>
        <Button type="button" variant="primary" size="sm" onClick={onOpen}>{done ? "Abrir prontuário" : "Iniciar consulta"}</Button>
      </div>
    </div>
  );
}

function CreateCard({
  dateKey, start, end, anchor, patients, dayApts, minH, maxH, onClose, onMore, onSave,
}: {
  dateKey: string; start: number; end: number; anchor: Anchor; patients: PatientData[]; dayApts: AgAppointment[];
  minH: number; maxH: number; onClose: () => void;
  onMore: (p: { dateKey: string; startMin: number; endMin: number; patient: PatientData | null; type: string }) => void;
  onSave: (patient: PatientData, type: string, start: number, end: number) => void;
}) {
  const pos = useCardPosition(anchor);
  const [query, setQuery] = useState("");
  const [patient, setPatient] = useState<PatientData | null>(null);
  const [type, setType] = useState<string>("Consulta");
  const [s, setS] = useState(start);
  const [e, setE] = useState(end);
  const [hi, setHi] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { inputRef.current?.focus(); }, []);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = patients.filter((p) => p.status !== "inativo");
    if (!q) return list.slice(0, 6);
    return list.filter((p) => `${p.nome} ${p.sobrenome}`.toLowerCase().includes(q)).slice(0, 6);
  }, [patients, query]);

  const options = useMemo(() => {
    const out: number[] = [];
    for (let m = minH * 60; m <= maxH * 60; m += SNAP) out.push(m);
    return out;
  }, [minH, maxH]);

  const conflict = dayApts.find((a) => startMinOf(a) < e && endMinOf(a) > s);
  const d = fromDateKey(dateKey);

  const pick = (p: PatientData) => { setPatient(p); setQuery(`${p.nome} ${p.sobrenome}`); };

  return (
    <div ref={pos.ref} className="ag2-card-pop ag2-create" style={{ left: pos.left, top: pos.top, width: CARD_W }} role="dialog" aria-label="Nova consulta">
      <button type="button" className="ag2-icon-btn ag2-icon-sm ag2-pop-x" title="Fechar (Esc)" aria-label="Fechar" onClick={onClose}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
      </button>

      <div className="ag2-search">
        <input
          ref={inputRef}
          className="ag2-title-input"
          placeholder="Buscar paciente…"
          value={query}
          onChange={(ev) => { setQuery(ev.target.value); setPatient(null); setHi(0); }}
          onKeyDown={(ev) => {
            if (ev.key === "Escape") { ev.preventDefault(); onClose(); }
            else if (ev.key === "ArrowDown") { ev.preventDefault(); setHi((h) => Math.min(h + 1, results.length - 1)); }
            else if (ev.key === "ArrowUp") { ev.preventDefault(); setHi((h) => Math.max(h - 1, 0)); }
            else if (ev.key === "Enter") {
              ev.preventDefault();
              if (!patient && results[hi]) pick(results[hi]);
              else if (patient) onSave(patient, type, s, e);
            }
          }}
        />
        {!patient && (
          <ul className="ag2-results">
            {results.length === 0 && <li className="ag2-results-empty">Nenhum paciente encontrado</li>}
            {results.map((p, i) => (
              <li key={p.id}>
                <button type="button" className={`ag2-result${i === hi ? " ag2-result-hi" : ""}`} onMouseEnter={() => setHi(i)} onClick={() => pick(p)}>
                  <Avatar name={`${p.nome} ${p.sobrenome}`} size="sm" />
                  <span>
                    <span className="ag2-result-name">{p.nome} {p.sobrenome}</span>
                    <span className="ag2-result-sub">{p.convenio || "Particular"}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="ag2-types-row">
        {CONSULT_TYPES.map((t) => {
          const c = aptColors(t);
          return (
            <button
              key={t}
              type="button"
              className={`ag2-type-chip${type === t ? " ag2-type-chip-on" : ""}`}
              style={type === t ? { background: c.bg, color: c.color, borderColor: c.border } : undefined}
              onClick={() => setType(t)}
            >
              {t}
            </button>
          );
        })}
      </div>

      <div className="ag2-when">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" width="16" height="16"><circle cx="12" cy="12" r="9" /><polyline points="12 7 12 12 15 14" /></svg>
        <div>
          <div className="ag2-when-date">{fmtLong(d)}</div>
          <div className="ag2-when-times">
            <select value={s} onChange={(ev) => { const v = Number(ev.target.value); setS(v); if (e <= v) setE(Math.min(v + 60, maxH * 60)); }} aria-label="Início">
              {options.slice(0, -1).map((m) => <option key={m} value={m}>{minToHM(m)}</option>)}
            </select>
            <span>–</span>
            <select value={e} onChange={(ev) => setE(Number(ev.target.value))} aria-label="Fim">
              {options.filter((m) => m > s).map((m) => <option key={m} value={m}>{minToHM(m)} ({m - s} min)</option>)}
            </select>
          </div>
        </div>
      </div>

      {conflict && (
        <div className="ag2-conflict">
          Já existe uma consulta nesse horário ({conflict.patient}, {minToHM(startMinOf(conflict))}).
        </div>
      )}

      <div className="ag2-pop-foot">
        <Button type="button" variant="secondary" size="sm" onClick={() => onMore({ dateKey, startMin: s, endMin: e, patient, type })}>Mais opções</Button>
        <Button type="button" variant="primary" size="sm" disabled={!patient} onClick={() => patient && onSave(patient, type, s, e)}>Salvar</Button>
      </div>
    </div>
  );
}
