"use client";

import { useCallback, useRef, useState } from "react";
import type { ProntuarioSOAP } from "@/lib/types";

type Status = "idle" | "recording" | "processing" | "done" | "error";

type FieldDef = { key: keyof ProntuarioSOAP; label: string; list?: boolean };

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

export default function ConsultaPage() {
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string>("");
  const [consent, setConsent] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  const [values, setValues] = useState<Record<string, string>>({});
  const [alertas, setAlertas] = useState<string[]>([]);
  const [transcript, setTranscript] = useState("");
  const [copiedKey, setCopiedKey] = useState<string>("");

  // Diagnóstico de áudio (pra conferir se o mic capturou de fato)
  const [audioUrl, setAudioUrl] = useState<string>("");
  const [audioKB, setAudioKB] = useState<number>(0);
  const [level, setLevel] = useState(0); // nível do mic ao vivo (0-100)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const rafRef = useRef<number | null>(null);

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

  const process = useCallback(async (file: Blob, filename: string) => {
    setStatus("processing");
    setError("");
    try {
      const form = new FormData();
      form.append("audio", file, filename);
      const res = await fetch("/api/process", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Falha no processamento.");
      setValues(soapToValues(data.soap));
      setAlertas(data.soap.alertasAnonimizacao ?? []);
      setTranscript(data.transcript ?? "");
      setStatus("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro desconhecido.");
      setStatus("error");
    }
  }, []);

  const startRecording = useCallback(async () => {
    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      // Medidor de nível ao vivo (Web Audio) — prova que o mic capta som.
      const Ctx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
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
        const rms = Math.sqrt(sum / buf.length);
        setLevel(Math.min(100, Math.round(rms * 250)));
        rafRef.current = requestAnimationFrame(tick);
      };
      tick();

      // Codec explícito (mais confiável que o default).
      const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : "";
      const mr = mime
        ? new MediaRecorder(stream, { mimeType: mime })
        : new MediaRecorder(stream);

      chunksRef.current = [];
      mr.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      mr.onstop = () => {
        stopMeter();
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, {
          type: mr.mimeType || "audio/webm",
        });
        const ext = (mr.mimeType || "audio/webm").includes("ogg") ? "ogg" : "webm";
        setAudioUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return URL.createObjectURL(blob);
        });
        setAudioKB(Math.round(blob.size / 1024));
        void process(blob, `consulta.${ext}`);
      };
      mediaRecorderRef.current = mr;
      mr.start(1000); // flush a cada 1s
      setStatus("recording");
      setElapsed(0);
      timerRef.current = setInterval(() => setElapsed((s) => s + 1), 1000);
    } catch {
      stopMeter();
      setError("Não foi possível acessar o microfone. Verifique a permissão do navegador.");
      setStatus("error");
    }
  }, [process]);

  const stopRecording = useCallback(() => {
    stopTimer();
    mediaRecorderRef.current?.stop();
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
        void process(file, file.name);
      }
      e.target.value = "";
    },
    [process]
  );

  const copyField = async (key: string) => {
    await navigator.clipboard.writeText(values[key] ?? "");
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(""), 1500);
  };

  const reset = () => {
    setStatus("idle");
    setValues({});
    setAlertas([]);
    setTranscript("");
    setError("");
    setElapsed(0);
    stopMeter();
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl("");
    setAudioKB(0);
  };

  const mmss = `${String(Math.floor(elapsed / 60)).padStart(2, "0")}:${String(
    elapsed % 60
  ).padStart(2, "0")}`;

  const busy = status === "recording" || status === "processing";

  return (
    <div className="c-wrap">
      <header className="c-head">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <a href="/" aria-label="Jasmin"><img src="/logo.png" alt="Jasmin" /></a>
      </header>

      <main className="c-main">
        {/* ---------- Painel de captura ---------- */}
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
                disabled={!consent || status === "processing"}
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
              <input
                type="file"
                accept="audio/*"
                onChange={onUploadFile}
                disabled={busy}
              />
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
            </div>
          )}
          {status === "processing" && (
            <p className="c-status">Transcrevendo e estruturando o prontuário…</p>
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

        {/* ---------- Resultado ---------- */}
        {status === "done" && (
          <section className="c-result">
            <div className="c-result-head">
              <h2>Prontuário gerado</h2>
              <button className="c-btn-ghost" onClick={reset}>Nova consulta</button>
            </div>


            {FIELDS.map((f) => (
              <div className="c-field" key={f.key}>
                <div className="c-field-top">
                  <label>{f.label}</label>
                  <button className="c-copy" onClick={() => copyField(f.key)}>
                    {copiedKey === f.key ? "Copiado!" : "Copiar"}
                  </button>
                </div>
                <textarea
                  value={values[f.key] ?? ""}
                  rows={f.list ? 1 : 3}
                  onChange={(e) =>
                    setValues((v) => ({ ...v, [f.key]: e.target.value }))
                  }
                />
              </div>
            ))}

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
