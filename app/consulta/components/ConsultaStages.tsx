"use client";

import { useEffect, useRef, useState } from "react";
import { Button, SectionTitle } from "@/app/components/ui";

/**
 * Telas da consulta enquanto o prontuário ainda não existe:
 * gravando (com transcrição ao vivo), colando texto e processando.
 * Mesma largura e mesmo padrão visual (títulos de seção do kit) das demais telas.
 */

/** Gravando: tempo, nível do microfone, texto que vai surgindo e o botão de finalizar. */
export function ConsultaRecording({
  time, level, text, onStop, onCancel,
}: { time: string; level: number; text: string; onStop: () => void; onCancel: () => void }) {
  const boxRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    boxRef.current?.scrollTo({ top: boxRef.current.scrollHeight, behavior: "smooth" });
  }, [text]);

  return (
    <div className="cs">
      <div className="cs-bar">
        <span className="cs-live-dot" aria-hidden />
        <span className="cs-bar-label">Gravando</span>
        <span className="cs-timer">{time}</span>
        <div className="cs-meter" aria-hidden><i style={{ width: `${Math.max(4, level)}%` }} /></div>
        <Button variant="secondary" onClick={onCancel}>Cancelar</Button>
        <Button variant="danger" onClick={onStop}>Finalizar consulta</Button>
      </div>

      <SectionTitle>Transcrição ao vivo</SectionTitle>
      <div className="cs-live" ref={boxRef}>
        {text ? text : <span className="cs-placeholder">O texto aparece aqui enquanto você atende, a cada poucos segundos.</span>}
      </div>
      <p className="cs-hint">Ao finalizar, o prontuário é gerado automaticamente a partir da transcrição. Cancelar descarta a gravação.</p>
    </div>
  );
}

/** Colar ou digitar a transcrição. */
export function ConsultaPaste({
  value, onChange, onCancel, onSubmit, disabled,
}: { value: string; onChange: (v: string) => void; onCancel: () => void; onSubmit: () => void; disabled?: boolean }) {
  return (
    <div className="cs">
      <SectionTitle>Colar transcrição</SectionTitle>
      <textarea
        className="cs-textarea"
        placeholder="Cole ou digite aqui a transcrição da consulta…"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        autoFocus
      />
      <div className="cs-actions">
        <Button variant="ghost" onClick={onCancel} disabled={disabled}>Cancelar</Button>
        <Button variant="primary" onClick={onSubmit} disabled={disabled || !value.trim()}>Gerar prontuário</Button>
      </div>
    </div>
  );
}

/** As 5 etapas do agente de prontuário (rodam em sequência no servidor). */
const PRONTUARIO_STEPS = [
  { title: "Anamnese", sub: "queixa, histórico, medicamentos e alergias" },
  { title: "Exame clínico e odontograma", sub: "achados por dente, em notação FDI" },
  { title: "Diagnóstico CID-10", sub: "validado contra a faixa K00–K14" },
  { title: "Plano de tratamento", sub: "procedimentos, anestesia e pós-operatório" },
  { title: "Revisão de lacunas e alertas", sub: "cruza com o histórico do paciente" },
];
/** Tempo médio de cada etapa; a última fica ativa até a resposta chegar. */
const STEP_MS = 2200;

/** Processando (finalizando a transcrição ou estruturando o prontuário). */
export function ConsultaWorking({ label, steps }: { label: string; steps?: boolean }) {
  const [active, setActive] = useState(0);
  useEffect(() => {
    if (!steps) return;
    setActive(0);
    const t = setInterval(() => setActive((i) => Math.min(i + 1, PRONTUARIO_STEPS.length - 1)), STEP_MS);
    return () => clearInterval(t);
  }, [steps]);

  if (steps) {
    return (
      <div className="cs cs-center">
        <h2 className="cs-working-title">{label}</h2>
        <p className="cs-hint">O agente percorre 5 etapas em sequência — cada uma usa o resultado da anterior.</p>
        <ol className="cs-steps">
          {PRONTUARIO_STEPS.map((st, i) => {
            const state = i < active ? "done" : i === active ? "active" : "todo";
            return (
              <li key={st.title} className="cs-step" data-state={state}>
                <span className="cs-step-mark" aria-hidden>
                  {state === "done" ? "✓" : state === "active" ? <span className="ui-spinner cs-step-spin" /> : i + 1}
                </span>
                <span className="cs-step-body">
                  <span className="cs-step-title">{st.title}</span>
                  <span className="cs-step-sub">{st.sub}</span>
                </span>
              </li>
            );
          })}
        </ol>
      </div>
    );
  }

  return (
    <div className="cs cs-center">
      <span className="ui-spinner cs-spinner" aria-hidden />
      <h2 className="cs-working-title">{label}</h2>
      <p className="cs-hint">Isso leva alguns segundos.</p>
    </div>
  );
}
