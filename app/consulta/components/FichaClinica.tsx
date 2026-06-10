"use client";

import { useEffect, useState } from "react";
import type { FichaClinicaModel } from "@/lib/types-prontuario";
import { getFichaClinica } from "@/lib/prontuario-storage";

/**
 * Aba Ficha Clínica — visão consolidada do paciente.
 * Identificação e Plano de saúde vêm do cadastro (PatientData, editável inline);
 * Histórico médico / alertas / anamnese consolidada vêm do merge dos prontuários.
 */

type EditableField =
  | "nome" | "sobrenome" | "cpf" | "dataNascimento" | "genero"
  | "telefone" | "email" | "convenio" | "carteirinha" | "plano";

interface Patient {
  id: string;
  nome: string; sobrenome: string; cpf: string;
  dataNascimento: string; genero: string; telefone: string; email: string;
  convenio?: string; carteirinha?: string; plano?: string;
}

interface Props {
  patient: Patient;
  onUpdatePatient: (field: EditableField, value: string) => void;
}

const fmtData = (iso: string): string => {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  if (d && m && y && d !== "00" && m !== "00" && y !== "0000") return `${d}/${m}/${y}`;
  return [d, m, y].filter((p) => p && p !== "00" && p !== "0000").join("/");
};

/** Campo texto com edição inline: clique para editar, Enter/blur salva, Esc cancela. */
function InlineText({ value, placeholder, onCommit }: { value: string; placeholder?: string; onCommit: (v: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  useEffect(() => { if (!editing) setDraft(value); }, [value, editing]);

  if (!editing) {
    return (
      <button type="button" className="fc-value" onClick={() => { setDraft(value); setEditing(true); }}>
        {value.trim() ? value : <span className="fc-dash">—</span>}
      </button>
    );
  }
  return (
    <input
      className="fc-edit"
      autoFocus
      value={draft}
      placeholder={placeholder}
      onChange={(e) => setDraft(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") { onCommit(draft.trim()); setEditing(false); }
        else if (e.key === "Escape") setEditing(false);
      }}
      onBlur={() => { onCommit(draft.trim()); setEditing(false); }}
    />
  );
}

function ReadField({ label, value }: { label: string; value: string }) {
  const filled = value.trim().length > 0;
  return (
    <div className="fc-field">
      <span className="fc-label">{label}</span>
      <span className={`fc-readvalue${filled ? "" : " fc-dash"}`}>{filled ? value : "—"}</span>
      <span className="fc-source">{filled ? "Extraído automaticamente da última consulta" : "Não informado"}</span>
    </div>
  );
}

export default function FichaClinica({ patient, onUpdatePatient }: Props) {
  const [ficha, setFicha] = useState<FichaClinicaModel | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setFicha(getFichaClinica(patient.id));
    setHydrated(true);
  }, [patient.id]);

  const alertas = ficha ? [...ficha.alergias.map((a) => `Alergia: ${a}`), ...ficha.alertas_clinicos] : [];

  return (
    <div className="fc">
      {/* Seção 1 — Alertas clínicos */}
      {hydrated && alertas.length > 0 && (
        <div className="fc-alertas">
          <div className="fc-alertas-head">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
              <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
              <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
            <span>Alertas clínicos</span>
          </div>
          <ul className="fc-alertas-list">
            {alertas.map((a, i) => <li key={i}>{a}</li>)}
          </ul>
        </div>
      )}

      {/* Seção 2 — Identificação */}
      <section className="fc-section">
        <h3 className="fc-section-title">Identificação</h3>
        <div className="fc-grid">
          <div className="fc-field"><span className="fc-label">Nome</span><InlineText value={patient.nome ?? ""} onCommit={(v) => onUpdatePatient("nome", v)} /></div>
          <div className="fc-field"><span className="fc-label">Sobrenome</span><InlineText value={patient.sobrenome ?? ""} onCommit={(v) => onUpdatePatient("sobrenome", v)} /></div>
          <div className="fc-field"><span className="fc-label">CPF</span><InlineText value={patient.cpf ?? ""} placeholder="000.000.000-00" onCommit={(v) => onUpdatePatient("cpf", v)} /></div>
          <div className="fc-field">
            <span className="fc-label">Data de nascimento</span>
            <input
              type="date"
              className="fc-edit"
              value={/^\d{4}-\d{2}-\d{2}$/.test(patient.dataNascimento) ? patient.dataNascimento : ""}
              onChange={(e) => onUpdatePatient("dataNascimento", e.target.value)}
            />
            {patient.dataNascimento && !/^\d{4}-\d{2}-\d{2}$/.test(patient.dataNascimento) && (
              <span className="fc-source">{fmtData(patient.dataNascimento)}</span>
            )}
          </div>
          <div className="fc-field">
            <span className="fc-label">Sexo</span>
            <select className="fc-edit" value={patient.genero ?? ""} onChange={(e) => onUpdatePatient("genero", e.target.value)}>
              <option value="">—</option>
              <option value="Feminino">Feminino</option>
              <option value="Masculino">Masculino</option>
              <option value="Outro">Outro</option>
              <option value="Prefiro não informar">Prefiro não informar</option>
            </select>
          </div>
          <div className="fc-field"><span className="fc-label">Telefone</span><InlineText value={patient.telefone ?? ""} placeholder="(11) 99999-9999" onCommit={(v) => onUpdatePatient("telefone", v)} /></div>
          <div className="fc-field"><span className="fc-label">Email</span><InlineText value={patient.email ?? ""} placeholder="email@exemplo.com" onCommit={(v) => onUpdatePatient("email", v)} /></div>
        </div>
      </section>

      {/* Seção 3 — Plano de saúde */}
      <section className="fc-section">
        <h3 className="fc-section-title">Plano de saúde</h3>
        <div className="fc-grid">
          <div className="fc-field"><span className="fc-label">Convênio</span><InlineText value={patient.convenio ?? ""} onCommit={(v) => onUpdatePatient("convenio", v)} /></div>
          <div className="fc-field"><span className="fc-label">Número da carteirinha</span><InlineText value={patient.carteirinha ?? ""} onCommit={(v) => onUpdatePatient("carteirinha", v)} /></div>
          <div className="fc-field"><span className="fc-label">Plano</span><InlineText value={patient.plano ?? ""} onCommit={(v) => onUpdatePatient("plano", v)} /></div>
        </div>
      </section>

      {/* Seção 4 — Histórico médico (read-only, do prontuário) */}
      <section className="fc-section">
        <h3 className="fc-section-title">Histórico médico</h3>
        <div className="fc-grid">
          <ReadField label="Comorbidades" value={ficha?.comorbidades ?? ""} />
          <ReadField label="Medicamentos em uso" value={(ficha?.medicamentos ?? []).join(", ")} />
          <ReadField label="Histórico cirúrgico" value="" />
          <ReadField label="Hábitos (fumo, álcool, bruxismo)" value={ficha?.habitos ?? ""} />
          <ReadField label="Histórico médico" value={ficha?.historico_medico ?? ""} />
        </div>
      </section>

      {/* Seção 5 — Anamnese consolidada */}
      <section className="fc-section">
        <h3 className="fc-section-title">Anamnese consolidada</h3>
        {ficha?.queixa_principal ? (
          <div className="fc-field">
            <span className="fc-label">Queixa principal</span>
            <span className="fc-readvalue">{ficha.queixa_principal}</span>
            <span className="fc-source">Da consulta de {fmtData(ficha.ultima_consulta_data)}</span>
          </div>
        ) : (
          <p className="fc-empty-note">Nenhuma consulta registrada para este paciente ainda.</p>
        )}
      </section>
    </div>
  );
}
