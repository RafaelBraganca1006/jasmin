"use client";

import { Button, TextButton } from "@/app/components/ui";

/** Estado vazio da consulta (ainda sem prontuário): mensagem curta + ações principais. */
interface Props {
  disabled?: boolean;
  /** Mensagem de erro da última tentativa (microfone, transcrição…). */
  error?: string;
  onRecord: () => void;
  onUploadAudio: () => void;
  onPasteText: () => void;
}

export default function ConsultaEmpty({ disabled, error, onRecord, onUploadAudio, onPasteText }: Props) {
  return (
    <div className="ce">
      <h2 className="ce-title">Nenhum prontuário ainda</h2>
      <p className="ce-text">Grave a consulta ou envie o áudio. O prontuário é preenchido automaticamente.</p>
      {error && <p className="ce-error">{error}</p>}
      <div className="ce-actions">
        <Button variant="primary" disabled={disabled} onClick={onRecord}>Gravar consulta</Button>
        <Button variant="secondary" disabled={disabled} onClick={onUploadAudio}>Enviar áudio</Button>
      </div>
      <TextButton tone="link" disabled={disabled} onClick={onPasteText}>ou cole o texto da consulta</TextButton>
    </div>
  );
}
