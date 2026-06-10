"use client";

import { useState, useMemo } from "react";
import type { AgAppointment, PatientData } from "@/lib/types-jasmin";
import { hasProntuario } from "@/lib/prontuario-storage";

const toDateKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const fmtT = (h: number, m: number) =>
  `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;

const avatarColor = (name: string): { bg: string; fg: string } => {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 360;
  return { bg: `hsl(${h} 60% 92%)`, fg: `hsl(${h} 45% 38%)` };
};

const initialsOf = (nome: string, sobrenome: string) =>
  `${(nome[0] ?? "").toUpperCase()}${(sobrenome[0] ?? "").toUpperCase()}` || "?";

type FilterKey = "hoje" | "semana" | "proximas" | "passadas" | "todas";

interface Props {
  appointments: AgAppointment[];
  patients: PatientData[];
  onOpenConsulta: (apt: AgAppointment) => void;
  onNovaConsulta: () => void;
}

export default function ConsultasView({ appointments, patients, onOpenConsulta, onNovaConsulta }: Props) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterKey>("proximas");

  const patientMap = useMemo(
    () => Object.fromEntries(patients.map((p) => [p.id, p])),
    [patients]
  );

  const now = new Date(); now.setHours(0, 0, 0, 0);
  const today = toDateKey(now);
  const tomorrow = toDateKey(new Date(now.getTime() + 86400000));
  const weekEnd = toDateKey(new Date(now.getTime() + 7 * 86400000));

  const filtered = useMemo(() => {
    let result = [...appointments];

    switch (filter) {
      case "hoje":
        result = result.filter((a) => a.date === today);
        break;
      case "semana":
        result = result.filter((a) => a.date >= today && a.date <= weekEnd);
        break;
      case "proximas":
        result = result.filter((a) => a.date >= today);
        break;
      case "passadas":
        result = result.filter((a) => a.date < today);
        break;
    }

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter((a) => {
        const p = patientMap[a.patientId];
        return (
          (p ? `${p.nome} ${p.sobrenome}`.toLowerCase().includes(q) : false) ||
          (a.type || "").toLowerCase().includes(q)
        );
      });
    }

    const dir = filter === "passadas" ? -1 : 1;
    result.sort((a, b) => {
      const d = a.date.localeCompare(b.date) * dir;
      if (d !== 0) return d;
      return (a.startH - b.startH || a.startM - b.startM) * dir;
    });

    return result;
  }, [appointments, filter, search, today, weekEnd, patientMap]);

  const dateLabel = (date: string) => {
    if (date === today) return "Hoje";
    if (date === tomorrow) return "Amanhã";
    const [y, m, d] = date.split("-");
    return `${d}/${m}/${y}`;
  };

  return (
    <div className="p-wrap">
      <div className="p-toolbar">
        <div className="p-search">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            placeholder="Buscar por paciente ou procedimento..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="p-toolbar-right">
          <button className="btn btn-solid btn-sm" onClick={onNovaConsulta}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Nova consulta
          </button>
        </div>
      </div>

      <div className="p-filters">
        {([
          { key: "hoje", label: "Hoje" },
          { key: "semana", label: "Esta semana" },
          { key: "proximas", label: "Próximas" },
          { key: "passadas", label: "Passadas" },
          { key: "todas", label: "Todas" },
        ] as const).map((f) => (
          <button
            key={f.key}
            className={`p-filter-pill${filter === f.key ? " p-filter-pill-active" : ""}`}
            onClick={() => setFilter(f.key)}
          >
            {f.label}
          </button>
        ))}
      </div>

      <p className="p-result-count">
        {filtered.length} consulta{filtered.length === 1 ? "" : "s"}
      </p>

      {filtered.length === 0 ? (
        <div className="p-filter-empty">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" width="32" height="32">
            <rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
          </svg>
          <p>
            {filter === "hoje"
              ? "Nenhuma consulta agendada para hoje."
              : filter === "semana"
              ? "Nenhuma consulta esta semana."
              : filter === "proximas"
              ? "Nenhuma consulta agendada."
              : filter === "passadas"
              ? "Nenhuma consulta passada."
              : search.trim()
              ? `Nenhuma consulta encontrada para "${search.trim()}".`
              : "Nenhuma consulta cadastrada."}
          </p>
        </div>
      ) : (
        <div className="cv-list">
          <div className="cv-lhead">
            <span className="cv-col-avatar" />
            <span className="cv-col-patient">PACIENTE</span>
            <span className="cv-col-date">DATA</span>
            <span className="cv-col-time">HORA</span>
            <span className="cv-col-dur">DURAÇÃO</span>
            <span className="cv-col-type">TIPO</span>
            <span className="cv-col-status">PRONTUÁRIO</span>
          </div>
          {filtered.map((apt) => {
            const p = patientMap[apt.patientId];
            const col = p ? avatarColor(`${p.nome}${p.sobrenome}`) : { bg: "#eee", fg: "#999" };
            const initials = p ? initialsOf(p.nome, p.sobrenome) : "?";
            const name = p ? `${p.nome} ${p.sobrenome}` : "Paciente desconhecido";
            const hasPron = hasProntuario(apt.id);
            const dl = dateLabel(apt.date);
            const isToday = apt.date === today;
            const totalMin = (apt.endH - apt.startH) * 60 + (apt.endM - apt.startM);
            const durLabel = totalMin >= 60
              ? `${Math.floor(totalMin / 60)}h${totalMin % 60 ? ` ${totalMin % 60}min` : ""}`
              : `${totalMin}min`;

            return (
              <button
                key={apt.id}
                className={`cv-row${isToday ? " cv-row-today" : ""}`}
                onClick={() => onOpenConsulta(apt)}
              >
                <span className="cv-col-avatar">
                  <span className="p-row-avatar" style={{ background: col.bg, color: col.fg }}>
                    {initials}
                  </span>
                </span>
                <span className="cv-col-patient">
                  <span className="p-row-name">{name}</span>
                  {p?.convenio && <span className="p-row-sub">{p.convenio}</span>}
                </span>
                <span className={`cv-col-date${isToday ? " cv-date-today" : ""}`}>{dl}</span>
                <span className="cv-col-time p-row-sub">{fmtT(apt.startH, apt.startM)}</span>
                <span className="cv-col-dur p-row-sub">{durLabel}</span>
                <span className="cv-col-type">
                  {apt.type
                    ? <span className="p-conv-pill">{apt.type}</span>
                    : <span className="p-row-sub">—</span>}
                </span>
                <span className="cv-col-status">
                  {hasPron
                    ? <span className="p-badge p-badge-ativo">Feito</span>
                    : <span className="p-badge p-badge-pendente">Pendente</span>}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
