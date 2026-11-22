"use client";

import { SectionTitle } from "@/app/components/ui";
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

  useEffect(() => {
    setFicha(getFichaClinica(patient.id));
  }, [patient.id]);

  return (
    <div className="fc">
      {/* Seção 3 — Plano de saúde */}
      <section className="fc-section">
        <SectionTitle>Plano de saúde</SectionTitle>
        <div className="fc-grid">
          <div className="fc-field"><span className="fc-label">Convênio</span><InlineText value={patient.convenio ?? ""} onCommit={(v) => onUpdatePatient("convenio", v)} /></div>
          <div className="fc-field"><span className="fc-label">Número da carteirinha</span><InlineText value={patient.carteirinha ?? ""} onCommit={(v) => onUpdatePatient("carteirinha", v)} /></div>
          <div className="fc-field"><span className="fc-label">Plano</span><InlineText value={patient.plano ?? ""} onCommit={(v) => onUpdatePatient("plano", v)} /></div>
        </div>
      </section>

      {/* Seção 4 — Histórico médico (read-only, do prontuário) */}
      <section className="fc-section">
        <SectionTitle>Histórico médico</SectionTitle>
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
        <SectionTitle>Anamnese consolidada</SectionTitle>
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
