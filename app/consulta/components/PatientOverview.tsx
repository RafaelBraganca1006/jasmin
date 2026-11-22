"use client";

import type { AgAppointment, PatientData } from "@/lib/types-jasmin";
import type { PatientOverview as Overview, Tone, TimelineItem } from "@/lib/patient-overview";
import { toDateKey } from "@/lib/agenda-utils";
import { Button, SectionTitle, Tag, TextButton } from "@/app/components/ui";

/**
 * Visão Geral do paciente — pensada para ler em 5 segundos:
 *   1. uma linha de números (consultas · última · próxima · financeiro) + ação principal;
 *   2. histórico enxuto (só destaca o que exige atenção).
 * Alertas clínicos ficam na barra lateral (visíveis em todas as abas), sem repetir aqui.
 */

interface Props {
  patient?: PatientData;
  data: Overview;
  onOpenConsulta: (apt: AgAppointment) => void;
  onNewAppointment: () => void;
  onGoTab: (tab: "odontograma" | "consultas" | "cobrancas" | "ficha-clinica") => void;
}

const fmtDate = (key: string) => key.split("-").reverse().join("/");
const hm = (a: AgAppointment) => `${String(a.startH).padStart(2, "0")}:${String(a.startM).padStart(2, "0")}`;

function Chip({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  const map = { red: "red", amber: "amber", blue: "blue", green: "green", gray: "neutral" } as const;
  return <Tag tone={map[tone]}>{children}</Tag>;
}

export default function PatientOverview({ data, onOpenConsulta, onNewAppointment, onGoTab }: Props) {
  const todayKey = toDateKey(new Date());
  const proxToday = data.proxima && data.proxima.date === todayKey ? data.proxima : null;

  // Linha do tempo: 1 próxima + até 4 do histórico.
  const items: TimelineItem[] = [...data.upcoming.slice(0, 1), ...data.history.slice(0, 4)];
  const restantes = data.upcoming.length + data.history.length - items.length;

  return (
    <div className="po">
      {/* Atendimentos — mesmo padrão de seção/campos de "Dados Pessoais" */}
      <section className="p-fields-section">
        <SectionTitle
          action={
            proxToday ? (
              <Button variant="primary" size="sm" onClick={() => onOpenConsulta(proxToday)}>Iniciar consulta de hoje</Button>
            ) : (
              <Button variant="primary" size="sm" onClick={onNewAppointment}>Agendar consulta</Button>
            )
          }
        >
          Atendimentos
        </SectionTitle>
        <div className="p-fields-grid">
          <div className="p-field">
            <span className="p-field-label">Consultas realizadas</span>
            <span className="p-field-value">{data.realizadas}</span>
          </div>
          <div className="p-field">
            <span className="p-field-label">Última consulta</span>
            <span className="p-field-value">{data.ultimaData ? fmtDate(data.ultimaData) : "—"}</span>
          </div>
          <div className="p-field">
            <span className="p-field-label">Próxima consulta</span>
            {data.proxima ? (
              <button type="button" className="po-link" onClick={() => onOpenConsulta(data.proxima!)}>
                {fmtDate(data.proxima.date)} · {hm(data.proxima)}
              </button>
            ) : (
              <span className="p-field-value po-amber">{data.realizadas ? "Nenhuma agendada" : "—"}</span>
            )}
          </div>
        </div>
      </section>

      {/* Histórico */}
      <section className="p-fields-section">
        <SectionTitle>Histórico</SectionTitle>
        {items.length === 0 ? (
          <p className="po-muted">Nenhuma consulta ou guia registrada.</p>
        ) : (
          <ol className="po-timeline">
            {items.map((it) => {
              const aviso = it.chips.filter((c) => (it.kind === "guia" ? true : c.tone === "amber" || c.tone === "red"));
              const go = () => (it.kind === "guia" ? onGoTab("cobrancas") : it.appointment && onOpenConsulta(it.appointment));
              return (
                <li key={it.key} className={`po-tl po-tl-${it.kind}`}>
                  <span className="po-tl-dot" />
                  <button type="button" className="po-tl-body" onClick={go}>
                    <span className="po-tl-top">
                      <span className="po-tl-title">{it.title}</span>
                      <span className="po-tl-date">{fmtDate(it.date)}</span>
                    </span>
                    {it.subtitle && <span className="po-tl-sub">{it.subtitle}</span>}
                    {aviso.length > 0 && (
                      <span className="po-tl-foot">
                        {aviso.map((c) => <Chip key={c.label} tone={c.tone}>{c.label}</Chip>)}
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ol>
        )}
        {restantes > 0 && (
          <TextButton tone="link" className="po-more" onClick={() => onGoTab("consultas")}>
            Ver todas as consultas ({restantes} mais) →
          </TextButton>
        )}
      </section>
    </div>
  );
}

/** Sinalizadores compactos para a lista de pacientes (alergia, glosa, a faturar). */
export function PatientFlags({ ov, convenio }: { ov?: Overview; convenio?: string }) {
  if (!ov) return null;
  const faturar = convenio ? ov.financeiro.nRevisar + ov.financeiro.nSemGuia : 0;
  if (!ov.alergias.length && !ov.financeiro.nGlosadas && !faturar) return null;
  return (
    <span className="p-flags">
      {ov.alergias.length > 0 && <i className="p-flag p-flag-red" title={`Alergia: ${ov.alergias.join(", ")}`}>Alergia</i>}
      {ov.financeiro.nGlosadas > 0 && <i className="p-flag p-flag-red" title="Há guia glosada para contestar">Glosa</i>}
      {faturar > 0 && <i className="p-flag p-flag-amber" title="Guia a gerar ou revisar">A faturar</i>}
    </span>
  );
}
