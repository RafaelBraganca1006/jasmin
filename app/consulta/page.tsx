"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ProntuarioSOAP, SOAPFieldKey } from "@/lib/types";

type Status = "idle" | "recording" | "transcribing" | "processing" | "done" | "error";

type FieldDef = { key: SOAPFieldKey; label: string; list?: boolean };

const FIELDS: FieldDef[] = [
  { key: "queixaPrincipal", label: "Queixa principal" },
  { key: "subjetivo", label: "Subjetivo (S)" },
  { key: "objetivo", label: "Objetivo (O)" },
  { key: "avaliacao", label: "Avaliação (A)" },
  { key: "plano", label: "Plano (P)" },
  { key: "dentesEnvolvidos", label: "Dentes envolvidos", list: true },
  { key: "procedimentos", label: "Procedimentos", list: true },
  { key: "orientacoes", label: "Orientações ao paciente" },
];

function soapToValues(soap: ProntuarioSOAP): Record<string, string> {
  const out: Record<string, string> = {};
  for (const f of FIELDS) {
    const v = soap[f.key];
    out[f.key] = Array.isArray(v) ? v.join(", ") : String(v ?? "");
  }
  return out;
}

/** Renderiza o transcript com os fragmentos de evidência destacados. */
function HighlightedTranscript({ text, quotes }: { text: string; quotes: string[] }) {
  if (!text) return null;
  if (!quotes.length) return <>{text}</>;

  const ranges: [number, number][] = [];
  for (const q of quotes) {
    if (!q || q.length < 3) continue;
    const idx = text.toLowerCase().indexOf(q.toLowerCase());
    if (idx !== -1) ranges.push([idx, idx + q.length]);
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
    parts.push(
      <mark key={start} className="c-evidence-mark">
        {text.slice(start, end)}
      </mark>
    );
    cursor = end;
  }
  if (cursor < text.length) parts.push(text.slice(cursor));

  return <>{parts}</>;
}

export default function ConsultaPage() {
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string>("");
  const [consent, setConsent] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [values, setValues] = useState<Record<string, string>>({});
  const [evidencias, setEvidencias] = useState<ProntuarioSOAP["evidencias"]>({});
  const [activeField, setActiveField] = useState<SOAPFieldKey | null>(null);
  const [transcript, setTranscript] = useState("");
  const [liveTranscript, setLiveTranscript] = useState("");
  const [copiedKey, setCopiedKey] = useState<string>("");
  const [audioUrl, setAudioUrl] = useState<string>("");
  const [audioKB, setAudioKB] = useState<number>(0);
  const [level, setLevel] = useState(0);
  const [chunksDone, setChunksDone] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const allChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const rafRef = useRef<number | null>(null);
  const evidencePanelRef = useRef<HTMLDivElement>(null);

  // Chunking
  const transcriptPartsRef = useRef<(string | null)[]>([]);
  const chunkIndexRef = useRef<number>(0);
  const pendingRef = useRef<Promise<void>[]>([]);
  // header do WebM (primeiro blob — contém EBML + Tracks); necessário para chunks subsequentes serem parseáveis
  const headerChunkRef = useRef<Blob | null>(null);
  const pendingChunksRef = useRef<Blob[]>([]);
  const chunkFlushTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Scroll para a primeira evidência destacada quando o campo muda
  useEffect(() => {
    if (!activeField || !evidencePanelRef.current) return;
    const mark = evidencePanelRef.current.querySelector("mark.c-evidence-mark");
    if (mark) mark.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [activeField]);

  const stopMeter = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    audioCtxRef.current?.close().catch(() => {});
    audioCtxRef.current = null;
    setLevel(0);
  };

  const stopTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
  };

  const sendChunk = useCallback(async (data: Blob, index: number): Promise<void> => {
    if (data.size < 2048) {
      transcriptPartsRef.current[index] = "";
      return;
    }
    const ext = data.type.includes("ogg") ? "ogg" : "webm";
    try {
      const form = new FormData();
      form.append("audio", new File([data], `chunk-${index}.${ext}`, { type: data.type }));
      const res = await fetch("/api/transcribe", { method: "POST", body: form });
      const json = (await res.json()) as { transcript?: string; error?: string };
      transcriptPartsRef.current[index] = json.transcript?.trim() ?? "";
    } catch {
      transcriptPartsRef.current[index] = "";
    }
    const joined = transcriptPartsRef.current
      .filter((s): s is string => s !== null)
      .join(" ")
      .trim();
    setLiveTranscript(joined);
    setChunksDone((n) => n + 1);
  }, []);

  const finalizeTranscript = useCallback(async () => {
    setStatus("transcribing");
    await Promise.all(pendingRef.current);

    const fullTranscript = transcriptPartsRef.current
      .filter((s): s is string => s !== null)
      .join(" ")
      .trim();

    if (!fullTranscript) {
      setError("Nenhum áudio capturado ou transcrição vazia. Verifique o microfone.");
      setStatus("error");
      return;
    }

    setStatus("processing");
    try {
      const res = await fetch("/api/soap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript: fullTranscript }),
      });
      const data = (await res.json()) as { soap?: ProntuarioSOAP; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Falha na estruturação.");
      setValues(soapToValues(data.soap!));
      setEvidencias(data.soap!.evidencias ?? {});
      setTranscript(fullTranscript);
      setStatus("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro desconhecido.");
      setStatus("error");
    }
  }, []);

  const startRecording = useCallback(async () => {
    setError("");
    setLiveTranscript("");
    setChunksDone(0);
    transcriptPartsRef.current = [];
    chunkIndexRef.current = 0;
    pendingRef.current = [];
    allChunksRef.current = [];
    headerChunkRef.current = null;
    pendingChunksRef.current = [];
    if (chunkFlushTimerRef.current) clearInterval(chunkFlushTimerRef.current);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });

      const Ctx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new Ctx();
      audioCtxRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      source.connect(analyser);
      const buf = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        analyser.getByteTimeDomainData(buf);
        let sum = 0;
        for (let i = 0; i < buf.length; i++) {
          const v = (buf[i] - 128) / 128;
          sum += v * v;
        }
        setLevel(Math.min(100, Math.round(Math.sqrt(sum / buf.length) * 250)));
        rafRef.current = requestAnimationFrame(tick);
      };
      tick();

      const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : "";
      const mr = mime
        ? new MediaRecorder(stream, { mimeType: mime })
        : new MediaRecorder(stream);

      const mimeType = mr.mimeType || "audio/webm";

      // Envia um batch de chunks acumulados como um arquivo WebM completo
      const flushPendingChunks = () => {
        const batch = pendingChunksRef.current.splice(0);
        if (!batch.length) return;
        // Prepend o header WebM se o batch não começa pelo primeiro chunk
        const isFirstBatch = batch.includes(headerChunkRef.current!);
        const apiBlob = (!isFirstBatch && headerChunkRef.current)
          ? new Blob([headerChunkRef.current, ...batch], { type: mimeType })
          : new Blob(batch, { type: mimeType });
        if (apiBlob.size < 2048) return;
        const idx = chunkIndexRef.current++;
        transcriptPartsRef.current[idx] = null;
        pendingRef.current.push(sendChunk(apiBlob, idx));
      };

      mr.ondataavailable = (e) => {
        if (e.data.size > 0) {
          allChunksRef.current.push(e.data);
          if (!headerChunkRef.current) headerChunkRef.current = e.data;
          pendingChunksRef.current.push(e.data);
        }
      };

      mr.onstop = () => {
        if (chunkFlushTimerRef.current) clearInterval(chunkFlushTimerRef.current);
        flushPendingChunks(); // flush dos últimos segundos
        stopMeter();
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(allChunksRef.current, { type: mimeType });
        setAudioUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return URL.createObjectURL(blob);
        });
        setAudioKB(Math.round(blob.size / 1024));
        void finalizeTranscript();
      };

      mediaRecorderRef.current = mr;
      mr.start(1000); // chunks frequentes para o level meter e para batching confiável
      chunkFlushTimerRef.current = setInterval(flushPendingChunks, 60_000);
      setStatus("recording");
      setElapsed(0);
      timerRef.current = setInterval(() => setElapsed((s) => s + 1), 1000);
    } catch {
      stopMeter();
      setError("Não foi possível acessar o microfone. Verifique a permissão do navegador.");
      setStatus("error");
    }
  }, [sendChunk, finalizeTranscript]);

  const stopRecording = useCallback(() => {
    stopTimer();
    mediaRecorderRef.current?.stop();
  }, []);

  const processFile = useCallback(async (file: Blob, filename: string) => {
    setStatus("processing");
    setError("");
    setLiveTranscript("");
    try {
      const form = new FormData();
      form.append("audio", file, filename);
      const res = await fetch("/api/process", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Falha no processamento.");
      setValues(soapToValues(data.soap));
      setEvidencias(data.soap.evidencias ?? {});
      setTranscript(data.transcript ?? "");
      setStatus("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro desconhecido.");
      setStatus("error");
    }
  }, []);

  const onUploadFile = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        setAudioUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return URL.createObjectURL(file);
        });
        setAudioKB(Math.round(file.size / 1024));
        void processFile(file, file.name);
      }
      e.target.value = "";
    },
    [processFile]
  );

  const copyField = async (key: string) => {
    await navigator.clipboard.writeText(values[key] ?? "");
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(""), 1500);
  };

  const reset = () => {
    setStatus("idle");
    setValues({});
    setEvidencias({});
    setActiveField(null);
    setTranscript("");
    setLiveTranscript("");
    setError("");
    setElapsed(0);
    setChunksDone(0);
    stopMeter();
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl("");
    setAudioKB(0);
    transcriptPartsRef.current = [];
    chunkIndexRef.current = 0;
    pendingRef.current = [];
    allChunksRef.current = [];
    headerChunkRef.current = null;
    pendingChunksRef.current = [];
    if (chunkFlushTimerRef.current) clearInterval(chunkFlushTimerRef.current);
  };

  const mmss = `${String(Math.floor(elapsed / 60)).padStart(2, "0")}:${String(
    elapsed % 60
  ).padStart(2, "0")}`;

  const busy = status === "recording" || status === "transcribing" || status === "processing";

  return (
    <div className="c-wrap">
      <header className="c-head">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <a href="/" aria-label="Jasmin"><img src="/logo.png" alt="Jasmin" /></a>
      </header>

      <main className="c-main">
        <section className="c-panel">
          <h1 className="c-title">Gravar consulta</h1>
          <p className="c-sub">
            A Jasmin escuta, transcreve e organiza o prontuário no padrão SOAP.
            Nenhum áudio é armazenado — o processamento é em tempo real.
          </p>

          <label className="c-consent">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
            />
            <span>Confirmo que o paciente foi informado e consentiu com a gravação.</span>
          </label>

          <div className="c-controls">
            {status !== "recording" ? (
              <button
                className="c-btn c-btn-rec"
                disabled={!consent || busy}
                onClick={startRecording}
              >
                Iniciar gravação →
              </button>
            ) : (
              <button className="c-btn c-btn-stop" onClick={stopRecording}>
                Parar gravação ({mmss})
              </button>
            )}

            <label className={`c-upload ${busy ? "c-disabled" : ""}`}>
              ou enviar arquivo de áudio
              <input type="file" accept="audio/*" onChange={onUploadFile} disabled={busy} />
            </label>
          </div>

          {status === "recording" && (
            <div className="c-status">
              <p className="c-live">● Gravando… fale normalmente com o paciente.</p>
              <div className="c-meter" title="Nível do microfone">
                <div className="c-meter-bar" style={{ width: `${level}%` }} />
              </div>
              <p className="c-meter-hint">
                A barra deve <strong>mexer quando você fala</strong>. Se ficar parada, o
                microfone não está captando.
              </p>
              {liveTranscript && (
                <div className="c-live-transcript">
                  <p className="c-live-label">
                    Transcrição parcial
                    {chunksDone > 0 && ` · ${chunksDone} bloco${chunksDone > 1 ? "s" : ""}`}
                  </p>
                  <p className="c-live-text">{liveTranscript}</p>
                </div>
              )}
            </div>
          )}
          {status === "transcribing" && (
            <div className="c-status">
              <p>Finalizando transcrição…</p>
              {liveTranscript && (
                <div className="c-live-transcript">
                  <p className="c-live-label">Transcrição capturada</p>
                  <p className="c-live-text">{liveTranscript}</p>
                </div>
              )}
            </div>
          )}
          {status === "processing" && (
            <p className="c-status">Estruturando prontuário clínico e mapeando evidências…</p>
          )}
          {status === "error" && <p className="c-status c-err">{error}</p>}

          {audioUrl && (
            <div className="c-audio">
              <p className="c-audio-info">
                Áudio capturado: <strong>{audioKB} KB</strong>
                {audioKB < 15 && (
                  <span className="c-err"> — muito pequeno, o microfone pode não ter gravado.</span>
                )}
              </p>
              <p className="c-audio-hint">Ouça abaixo pra confirmar que sua voz foi gravada:</p>
              <audio controls src={audioUrl} />
            </div>
          )}
        </section>

        {status === "done" && (
          <section className="c-result">
            <div className="c-result-head">
              <h2>Prontuário gerado</h2>
              <button className="c-btn-ghost" onClick={reset}>Nova consulta</button>
            </div>

            {FIELDS.map((f) => {
              const fieldEv = evidencias[f.key] ?? [];
              const isActive = activeField === f.key;
              return (
                <div className={`c-field ${isActive ? "c-field-active" : ""}`} key={f.key}>
                  <div className="c-field-top">
                    <div className="c-field-top-left">
                      <label htmlFor={f.key}>{f.label}</label>
                      {fieldEv.length > 0 && (
                        <button
                          className={`c-evidence-btn ${isActive ? "active" : ""}`}
                          onClick={() => setActiveField(isActive ? null : f.key)}
                          title="Ver evidência na transcrição"
                        >
                          {fieldEv.length} fonte{fieldEv.length > 1 ? "s" : ""}
                        </button>
                      )}
                    </div>
                    <button className="c-copy" onClick={() => copyField(f.key)}>
                      {copiedKey === f.key ? "Copiado!" : "Copiar"}
                    </button>
                  </div>
                  <textarea
                    id={f.key}
                    value={values[f.key] ?? ""}
                    rows={f.list ? 1 : 3}
                    onChange={(e) =>
                      setValues((v) => ({ ...v, [f.key]: e.target.value }))
                    }
                  />
                </div>
              );
            })}

            {/* Painel de evidência — transcript com highlight */}
            {transcript && (
              <div className="c-evidence-panel">
                <div className="c-evidence-panel-head">
                  <span className="c-evidence-panel-title">Transcrição da consulta</span>
                  {activeField ? (
                    <span className="c-evidence-panel-active">
                      evidências: {FIELDS.find((f) => f.key === activeField)?.label}
                    </span>
                  ) : (
                    <span className="c-evidence-panel-hint">
                      clique em "fontes" para destacar evidências
                    </span>
                  )}
                </div>
                <div className="c-evidence-text" ref={evidencePanelRef}>
                  <HighlightedTranscript
                    text={transcript}
                    quotes={activeField ? (evidencias[activeField] ?? []) : []}
                  />
                </div>
              </div>
            )}

            {transcript && (
              <details className="c-transcript">
                <summary>Ver transcrição bruta</summary>
                <p>{transcript}</p>
              </details>
            )}
          </section>
        )}
      </main>
    </div>
  );
}
