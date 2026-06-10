"use client";

import { useEffect } from "react";
import { useChat, type JasminChip } from "@/lib/chat-context";
import {
  buildConsultaMd,
  buildPatientMd,
  buildOdontogramaMd,
  buildAgendaDiaMd,
} from "@/lib/chat-context-builders";

/**
 * Modo seletor (drag-in-select): liga a classe `selecting-context` no <body>,
 * intercepta cliques em elementos com [data-jasmin-context] (fase de captura,
 * impedindo a ação original), chama o builder certo e adiciona o chip.
 * Não desliga sozinho — o dentista pode selecionar vários contextos.
 */
export default function ContextSelector() {
  const { isSelectingContext, setIsSelectingContext, addChip, chips } = useChat();

  useEffect(() => {
    if (!isSelectingContext) return;
    document.body.classList.add("selecting-context");

    const onClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      const el = target?.closest<HTMLElement>("[data-jasmin-context]");
      if (!el) return;

      e.preventDefault();
      e.stopPropagation();

      const type = el.getAttribute("data-jasmin-context");
      let chip: JasminChip | null = null;

      if (type === "paciente") {
        const id = el.getAttribute("data-patient-id");
        if (id) chip = buildPatientMd(id);
      } else if (type === "consulta") {
        const id = el.getAttribute("data-appointment-id");
        if (id) chip = buildConsultaMd(id);
      } else if (type === "odontograma") {
        const id = el.getAttribute("data-patient-id");
        if (id) chip = buildOdontogramaMd(id);
      } else if (type === "agenda_dia") {
        chip = buildAgendaDiaMd();
      }

      if (chip) {
        addChip(chip);
        // Flash verde de confirmação.
        el.classList.add("jasmin-context-flash");
        window.setTimeout(() => el.classList.remove("jasmin-context-flash"), 450);
      }
    };

    // Captura para rodar antes dos handlers nativos dos elementos.
    document.addEventListener("click", onClick, true);
    return () => {
      document.removeEventListener("click", onClick, true);
      document.body.classList.remove("selecting-context");
    };
  }, [isSelectingContext, addChip]);

  if (!isSelectingContext) return null;

  return (
    <div className="cm-selector-banner">
      <span className="cm-selector-text">
        Modo de seleção ativo — clique em qualquer elemento para adicionar ao contexto do chat
        {chips.length > 0 ? ` (${chips.length} selecionado${chips.length === 1 ? "" : "s"})` : ""}
      </span>
      <button className="cm-selector-done" onClick={() => setIsSelectingContext(false)}>
        Concluir
      </button>
    </div>
  );
}
