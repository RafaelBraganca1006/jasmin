"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ProntuarioSOAP, SOAPFieldKey } from "@/lib/types";

type Status = "idle" | "recording" | "transcribing" | "processing" | "done" | "error";

type PatientData = {
  id: string;
  nome: string;
  sobrenome: string;
  nomePreferido: string;
  dataNascimento: string;
  genero: string;
  pronomes: string;
  cpf: string;
  status: "ativo" | "inativo";
  telefone: string;
  telefoneFixo: string;
  email: string;
  contatoPreferido: string;
  contatoEmergencia: string;
  telefoneEmergencia: string;
  endereco: string;
  cidade: string;
  cep: string;
};

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

// ---- Agenda ----
const AG_START_H = 8;
const AG_HOUR_H = 80;
const AG_HOURS = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18];

type AgAppointment = {
  id: number; patient: string; patientId: string;
  date: string; // "YYYY-MM-DD"
  startH: number; startM: number; endH: number; endM: number;
  type: string; bg: string; border: string; color: string;
};

const APT_STYLE = { bg: "rgba(27,23,20,0.05)", border: "#3b82f6", color: "#1e40af" };

const getWeekStart = (date: Date) => {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day));
  d.setHours(0, 0, 0, 0);
  return d;
};

const getWeekDays = (date: Date) =>
  Array.from({ length: 7 }, (_, i) => {
    const d = new Date(getWeekStart(date));
    d.setDate(d.getDate() + i);
    return d;
  });

const toDateKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const fmtWeekRange = (date: Date) => {
  const days = getWeekDays(date);
  const start = days[0];
  const end = days[6];
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
  const sm = cap(start.toLocaleDateString("pt-BR", { month: "long" }));
  const em = cap(end.toLocaleDateString("pt-BR", { month: "long" }));
  const yr = end.getFullYear();
  if (start.getMonth() === end.getMonth())
    return `${start.getDate()}–${end.getDate()} de ${sm}, ${yr}`;
  return `${start.getDate()} de ${sm} – ${end.getDate()} de ${em}, ${yr}`;
};

const fmtWeekDay = (d: Date) => {
  const wd = d.toLocaleDateString("pt-BR", { weekday: "short" });
  return `${wd.charAt(0).toUpperCase() + wd.slice(1).replace(".", "")} ${d.getDate()}`;
};

const fmtT = (h: number, m: number) =>
  `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;

const fmtDate = (date: Date) => {
  const s = date.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });
  return s.charAt(0).toUpperCase() + s.slice(1);
};

const MONTHS_PT = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];

const parseBirthDate = (v: string) => {
  if (!v) return { d: "", m: "", y: "" };
  const p = v.split("-");
  if (p.length !== 3) return { d: "", m: "", y: "" };
  return {
    y: p[0] === "0000" ? "" : p[0],
    m: p[1] === "00"   ? "" : p[1],
    d: p[2] === "00"   ? "" : p[2],
  };
};

const joinBirthDate = (d: string, m: string, y: string) => {
  if (!d && !m && !y) return "";
  return `${y || "0000"}-${m || "00"}-${d || "00"}`;
};

const getDaysInMonth = (m: string, y: string) => {
  if (!m) return 31;
  return new Date(parseInt(y, 10) || 2000, parseInt(m, 10), 0).getDate();
};

const fmtBirthDate = (v: string) => {
  const { d, m, y } = parseBirthDate(v);
  if (!d && !m && !y) return "—";
  if (d && m && y) return `${d}/${m}/${y}`;
  return [d, m, y].filter(Boolean).join("/");
};

const HOURS_24 = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
const MINUTES_15 = ["00", "15", "30", "45"];
const DURATION_ITEMS = ["15m","30m","45m","1h","1h15","1h30","1h45","2h","2h15","2h30","2h45","3h"];
const DURATION_MINS: Record<string, number> = {
  "15m":15,"30m":30,"45m":45,"1h":60,"1h15":75,"1h30":90,"1h45":105,"2h":120,"2h15":135,"2h30":150,"2h45":165,"3h":180,
};
const DRUM_H = 36;

function DrumPicker({ items, value, onChange, wide }: { items: string[]; value: string; onChange: (v: string) => void; wide?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const idx = items.indexOf(value);
    if (ref.current && idx >= 0) ref.current.scrollTop = idx * DRUM_H;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const onScroll = () => {
    if (!ref.current) return;
    const idx = Math.round(ref.current.scrollTop / DRUM_H);
    const v = items[Math.max(0, Math.min(idx, items.length - 1))];
    if (v !== value) onChange(v);
  };

  return (
    <div className={`drum-wrap${wide ? " drum-wrap-wide" : ""}`}>
      <div className="drum-strip" />
      <div ref={ref} className="drum-scroll" onScroll={onScroll}>
        <div className="drum-pad" />
        {items.map((it, i) => (
          <div key={i} className="drum-item">{it}</div>
        ))}
        <div className="drum-pad" />
      </div>
    </div>
  );
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
  const [section, setSection] = useState<"consulta" | "agenda" | "pacientes" | "financeiro">("agenda");
  const [subTab, setSubTab] = useState<"prontuario" | "odontograma">("prontuario");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [patients, setPatients] = useState<PatientData[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<PatientData | null>(null);
  const [patientTab, setPatientTab] = useState<"visao-geral" | "ficha-clinica" | "odontograma" | "imagens" | "consultas" | "cobrancas">("visao-geral");
  const [newPatientOpen, setNewPatientOpen] = useState(false);
  const [newPatientForm, setNewPatientForm] = useState({ nome: "", sobrenome: "", dataNascimento: "", genero: "", telefone: "", email: "" });
  const [avatarDropdownOpen, setAvatarDropdownOpen] = useState(false);
  const [agendaDate, setAgendaDate] = useState(new Date());
  const [agendaViewTab, setAgendaViewTab] = useState<"dia" | "semana">("dia");
  const [agendaAppointments, setAgendaAppointments] = useState<AgAppointment[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<AgAppointment | null>(null);
  const [consultaOrigin, setConsultaOrigin] = useState<"agenda" | "paciente">("agenda");
  const [ncOpen, setNcOpen] = useState(false);
  const [ncSearch, setNcSearch] = useState("");
  const [ncPatient, setNcPatient] = useState<PatientData | null>(null);
  const [ncSearchOpen, setNcSearchOpen] = useState(false);
  const [ncDate, setNcDate] = useState("");
  const [ncStartH, setNcStartH] = useState("09");
  const [ncStartM, setNcStartM] = useState("00");
  const [ncDuration, setNcDuration] = useState("1h");
  const [ncTipo, setNcTipo] = useState("");

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const allChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const rafRef = useRef<number | null>(null);
  const evidencePanelRef = useRef<HTMLDivElement>(null);
  const avatarDropdownRef = useRef<HTMLDivElement>(null);

  // Chunking
  const transcriptPartsRef = useRef<(string | null)[]>([]);
  const chunkIndexRef = useRef<number>(0);
  const pendingRef = useRef<Promise<void>[]>([]);
  const headerChunkRef = useRef<Blob | null>(null);
  const pendingChunksRef = useRef<Blob[]>([]);
  const chunkFlushTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Fecha dropdown ao clicar fora
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (avatarDropdownRef.current && !avatarDropdownRef.current.contains(e.target as Node)) {
        setAvatarDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    try { const p = localStorage.getItem("jasmin_patients"); if (p) setPatients(JSON.parse(p)); } catch {}
    try { const a = localStorage.getItem("jasmin_appointments"); if (a) setAgendaAppointments(JSON.parse(a)); } catch {}
    setHydrated(true);
  }, []);
  useEffect(() => { if (hydrated) localStorage.setItem("jasmin_patients", JSON.stringify(patients)); }, [patients, hydrated]);
  useEffect(() => { if (hydrated) localStorage.setItem("jasmin_appointments", JSON.stringify(agendaAppointments)); }, [agendaAppointments, hydrated]);

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

  const handleNewPatient = (e: React.FormEvent) => {
    e.preventDefault();
    const patient: PatientData = {
      id: Date.now().toString(),
      ...newPatientForm,
      nomePreferido: "", pronomes: "", cpf: "",
      telefoneFixo: "", contatoPreferido: "",
      contatoEmergencia: "", telefoneEmergencia: "",
      endereco: "", cidade: "", cep: "",
      status: "ativo",
    };
    setPatients((prev) => [...prev, patient]);
    setNewPatientForm({ nome: "", sobrenome: "", dataNascimento: "", genero: "", telefone: "", email: "" });
    setNewPatientOpen(false);
    setSelectedPatient(patient);
    setPatientTab("visao-geral");
  };

  const updatePatient = (field: keyof PatientData, value: string) => {
    if (!selectedPatient) return;
    const updated = { ...selectedPatient, [field]: value };
    setSelectedPatient(updated);
    setPatients((prev) => prev.map((p) => (p.id === selectedPatient.id ? updated : p)));
  };

  const handleNovaConsulta = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ncPatient || !ncDate) return;
    const startTotalMin = parseInt(ncStartH, 10) * 60 + parseInt(ncStartM, 10);
    const endTotalMin = startTotalMin + (DURATION_MINS[ncDuration] ?? 60);
    const apt: AgAppointment = {
      id: Date.now(),
      patient: `${ncPatient.nome} ${ncPatient.sobrenome}`,
      patientId: ncPatient.id,
      date: ncDate,
      startH: parseInt(ncStartH, 10),
      startM: parseInt(ncStartM, 10),
      endH: Math.floor(endTotalMin / 60) % 24,
      endM: endTotalMin % 60,
      type: ncTipo || "Consulta",
      ...APT_STYLE,
    };
    setAgendaAppointments(prev => [...prev, apt]);
    setNcOpen(false);
    setNcSearch("");
    setNcPatient(null);
    setNcTipo("");
    setNcDuration("1h");
    setAgendaDate(new Date(ncDate + "T12:00:00"));
  };

  const mmss = `${String(Math.floor(elapsed / 60)).padStart(2, "0")}:${String(
    elapsed % 60
  ).padStart(2, "0")}`;

  const busy = status === "recording" || status === "transcribing" || status === "processing";

  return (
    <div className="c-app">
      <aside className={`c-sidebar${sidebarOpen ? "" : " c-sidebar-collapsed"}`}>
        <div className="c-sidebar-logo">
          {sidebarOpen ? (
            <>
              <div className="c-logo-wrap">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/logo.png" alt="Jasmin" className="c-logo-btn-img" />
              </div>
              <button className="c-sidebar-toggle" onClick={() => setSidebarOpen(false)} aria-label="Fechar sidebar">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="15 18 9 12 15 6"/>
                </svg>
              </button>
            </>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <button className="c-sidebar-favicon-btn" onClick={() => setSidebarOpen(true)} aria-label="Abrir barra lateral" title="Abrir barra lateral">
              <img src="/favicon.png" alt="Jasmin" />
            </button>
          )}
        </div>

        <nav className="c-sidebar-nav">
          <button
            className={`c-sidebar-tab${section === "agenda" ? " c-sidebar-tab-active" : ""}`}
            onClick={() => setSection("agenda")}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2"/>
              <line x1="16" y1="2" x2="16" y2="6"/>
              <line x1="8" y1="2" x2="8" y2="6"/>
              <line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
            <span>Agenda</span>
          </button>
          <button
            className={`c-sidebar-tab${section === "pacientes" ? " c-sidebar-tab-active" : ""}`}
            onClick={() => setSection("pacientes")}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
            <span>Pacientes</span>
          </button>
          <button
            className={`c-sidebar-tab${section === "financeiro" ? " c-sidebar-tab-active" : ""}`}
            onClick={() => setSection("financeiro")}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect x="1" y="4" width="22" height="16" rx="2"/>
              <line x1="1" y1="10" x2="23" y2="10"/>
            </svg>
            <span>Financeiro</span>
          </button>
        </nav>

        <div className="c-sidebar-bottom">
          <div className="c-sidebar-avatar-wrap" ref={avatarDropdownRef}>
            <button className="c-sidebar-avatar" onClick={() => setAvatarDropdownOpen((v) => !v)} aria-label="Menu do usuário">
              <div className="c-avatar">DR</div>
              {sidebarOpen && <span className="c-avatar-name">Dr. Usuário</span>}
            </button>
            {avatarDropdownOpen && (
              <div className="c-avatar-dropdown">
                <button className="c-dropdown-item">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                    <circle cx="12" cy="7" r="4"/>
                  </svg>
                  Editar perfil
                </button>
                <div className="c-dropdown-divider" />
                <button className="c-dropdown-item">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                    <circle cx="9" cy="7" r="4"/>
                    <line x1="19" y1="8" x2="19" y2="14"/>
                    <line x1="22" y1="11" x2="16" y2="11"/>
                  </svg>
                  Funcionários
                </button>
                <button className="c-dropdown-item">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"/>
                    <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
                    <circle cx="12" cy="17" r=".5" fill="currentColor"/>
                  </svg>
                  Ajuda
                </button>
                <button className="c-dropdown-item">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="3"/>
                    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
                  </svg>
                  Configurações
                </button>
                <div className="c-dropdown-divider" />
                <button className="c-dropdown-item c-dropdown-danger">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                    <polyline points="16 17 21 12 16 7"/>
                    <line x1="21" y1="12" x2="9" y2="12"/>
                  </svg>
                  Sair
                </button>
              </div>
            )}
          </div>
        </div>
      </aside>

      <div className="c-content">

        <main className="c-main">
          {section === "consulta" && (
            <>
              <div className="c-page-header">
                <div className="c-consult-back-row">
                  <button className="c-consult-back" onClick={() => {
                    reset();
                    setSelectedAppointment(null);
                    if (consultaOrigin === "paciente") {
                      setPatientTab("consultas");
                      setSection("pacientes");
                    } else {
                      setSection("agenda");
                    }
                  }}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="15 18 9 12 15 6"/>
                    </svg>
                    {consultaOrigin === "paciente" ? "Paciente" : "Agenda"}
                  </button>
                </div>
                {selectedAppointment && (() => {
                  const pt = patients.find(p => p.id === selectedAppointment.patientId);
                  const [y, mo, d] = selectedAppointment.date.split("-");
                  return (
                    <div className="c-consult-context">
                      <div className="c-consult-avatar">
                        {pt ? `${pt.nome[0]}${pt.sobrenome[0]}` : selectedAppointment.patient.split(" ").map(w => w[0]).slice(0,2).join("")}
                      </div>
                      <div className="c-consult-info">
                        <span className="c-consult-name">{selectedAppointment.patient}</span>
                        <span className="c-consult-meta">
                          {d}/{mo}/{y} · {fmtT(selectedAppointment.startH, selectedAppointment.startM)}–{fmtT(selectedAppointment.endH, selectedAppointment.endM)} · {selectedAppointment.type}
                        </span>
                      </div>
                    </div>
                  );
                })()}
                <div className="c-rec-btn-area">
                  {status === "recording" ? (
                    <button className="c-rec-btn c-rec-btn-active" onClick={stopRecording}>
                      <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14">
                        <rect x="4" y="4" width="16" height="16" rx="2"/>
                      </svg>
                      {mmss}
                    </button>
                  ) : (
                    <button className="c-rec-btn" disabled={busy} onClick={startRecording}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="14" height="14">
                        <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/>
                        <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                        <line x1="12" y1="19" x2="12" y2="22"/>
                      </svg>
                      {busy ? "Processando…" : "Gravar"}
                    </button>
                  )}
                  <label className={`c-rec-upload${busy ? " c-disabled" : ""}`} title="Enviar arquivo de áudio">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="15" height="15">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                      <polyline points="17 8 12 3 7 8"/>
                      <line x1="12" y1="3" x2="12" y2="15"/>
                    </svg>
                    <input type="file" accept="audio/*" onChange={onUploadFile} disabled={busy} />
                  </label>
                </div>
              </div>

              {status === "recording" && (
                <div className="c-rec-live">
                  <div className="c-meter"><div className="c-meter-bar" style={{ width: `${level}%` }} /></div>
                  {liveTranscript && <p className="c-live-text">{liveTranscript}</p>}
                </div>
              )}
              {(status === "transcribing" || status === "processing") && (
                <p className="c-rec-processing">
                  {status === "transcribing" ? "Finalizando transcrição…" : "Estruturando prontuário…"}
                </p>
              )}
              {status === "error" && <p className="c-status c-err">{error}</p>}

              <section className="c-result">
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
                        placeholder="—"
                        onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                      />
                    </div>
                  );
                })}

                {transcript && (
                  <div className="c-evidence-panel">
                    <div className="c-evidence-panel-head">
                      <span className="c-evidence-panel-title">Transcrição da consulta</span>
                      {activeField ? (
                        <span className="c-evidence-panel-active">
                          evidências: {FIELDS.find((f) => f.key === activeField)?.label}
                        </span>
                      ) : (
                        <span className="c-evidence-panel-hint">clique em "fontes" para destacar evidências</span>
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
            </>
          )}

          {section === "agenda" && (
            <div className="c-agenda-wrap">
              {ncOpen && (
                <div className="nc-overlay" onClick={() => setNcOpen(false)}>
                  <form className="nc-modal" onClick={(e) => e.stopPropagation()} onSubmit={handleNovaConsulta}>
                    <div className="nc-header">
                      <span className="nc-title">Nova consulta</span>
                      <button type="button" className="nc-close" onClick={() => setNcOpen(false)}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                        </svg>
                      </button>
                    </div>
                    <div className="nc-body">
                      <div>
                        <label className="nc-label">Paciente *</label>
                        <div className="nc-patient-wrap">
                          <input
                            className="nc-input"
                            placeholder="Buscar paciente..."
                            value={ncSearch}
                            onChange={(e) => { setNcSearch(e.target.value); setNcPatient(null); setNcSearchOpen(true); }}
                            onFocus={() => setNcSearchOpen(true)}
                            onBlur={() => setTimeout(() => setNcSearchOpen(false), 150)}
                            autoComplete="off"
                          />
                          {ncSearchOpen && (
                            <div className="nc-patient-list">
                              {patients.filter(p =>
                                `${p.nome} ${p.sobrenome}`.toLowerCase().includes(ncSearch.toLowerCase())
                              ).map(p => (
                                <button key={p.id} type="button" className="nc-patient-opt"
                                  onMouseDown={() => { setNcPatient(p); setNcSearch(`${p.nome} ${p.sobrenome}`); setNcSearchOpen(false); }}
                                >
                                  <div className="p-avatar-sm">{p.nome[0]}{p.sobrenome[0]}</div>
                                  <div>
                                    <div className="nc-opt-name">{p.nome} {p.sobrenome}</div>
                                    {p.dataNascimento && <div className="nc-opt-meta">{fmtBirthDate(p.dataNascimento)}</div>}
                                  </div>
                                </button>
                              ))}
                              {patients.filter(p =>
                                `${p.nome} ${p.sobrenome}`.toLowerCase().includes(ncSearch.toLowerCase())
                              ).length === 0 && (
                                <div className="nc-empty">Nenhum paciente encontrado</div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                      <div>
                        <label className="nc-label">Data *</label>
                        <input type="date" className="nc-input" value={ncDate} onChange={(e) => setNcDate(e.target.value)} required />
                      </div>
                      <div className="nc-row">
                        <div>
                          <label className="nc-label">Início</label>
                          <div className="nc-drum-picker">
                            <DrumPicker items={HOURS_24} value={ncStartH} onChange={setNcStartH} />
                            <span className="nc-drum-sep">:</span>
                            <DrumPicker items={MINUTES_15} value={ncStartM} onChange={setNcStartM} />
                          </div>
                        </div>
                        <div>
                          <label className="nc-label">Duração</label>
                          <div className="nc-drum-picker">
                            <DrumPicker items={DURATION_ITEMS} value={ncDuration} onChange={setNcDuration} wide />
                          </div>
                        </div>
                      </div>
                      <div>
                        <label className="nc-label">Procedimento</label>
                        <input className="nc-input" placeholder="Ex: Consulta de rotina, Extração..." value={ncTipo} onChange={(e) => setNcTipo(e.target.value)} />
                      </div>
                    </div>
                    <div className="nc-footer">
                      <button type="button" className="btn btn-outline btn-sm" onClick={() => setNcOpen(false)}>Cancelar</button>
                      <button type="submit" className="btn btn-solid btn-sm" disabled={!ncPatient || !ncDate}>Agendar</button>
                    </div>
                  </form>
                </div>
              )}
              <div className="ag-toolbar">
                <div className="ag-tabs">
                  <button
                    className={`ag-tab${agendaViewTab === "dia" ? " ag-tab-active" : ""}`}
                    onClick={() => setAgendaViewTab("dia")}
                  >Dia</button>
                  <button
                    className={`ag-tab${agendaViewTab === "semana" ? " ag-tab-active" : ""}`}
                    onClick={() => setAgendaViewTab("semana")}
                  >Semana</button>
                </div>
                <div className="ag-date-nav">
                  <button className="ag-nav-btn" onClick={() => {
                    const d = new Date(agendaDate);
                    d.setDate(d.getDate() - (agendaViewTab === "semana" ? 7 : 1));
                    setAgendaDate(d);
                  }}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
                  </button>
                  <div className="ag-date-label">
                    <span>{agendaViewTab === "semana" ? fmtWeekRange(agendaDate) : fmtDate(agendaDate)}</span>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="4" width="18" height="18" rx="2"/>
                      <line x1="16" y1="2" x2="16" y2="6"/>
                      <line x1="8" y1="2" x2="8" y2="6"/>
                      <line x1="3" y1="10" x2="21" y2="10"/>
                    </svg>
                  </div>
                  <button className="ag-nav-btn" onClick={() => {
                    const d = new Date(agendaDate);
                    d.setDate(d.getDate() + (agendaViewTab === "semana" ? 7 : 1));
                    setAgendaDate(d);
                  }}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                  </button>
                </div>
                <div className="ag-toolbar-right">
                  <button className="btn btn-solid btn-sm" onClick={() => { setNcDate(toDateKey(agendaDate)); setNcOpen(true); }}>
                    Nova consulta
                  </button>
                </div>
              </div>

              {agendaViewTab === "dia" && (
                <div className="ag-grid-wrap">
                  <div className="ag-header-row">
                    <div className="ag-time-gutter" />
                    <div className="ag-col-header">{fmtDate(agendaDate)}</div>
                  </div>
                  <div className="ag-body">
                    <div className="ag-time-col">
                      {AG_HOURS.map(h => (
                        <div key={h} className="ag-time-cell">
                          {String(h).padStart(2, "0")}:00
                        </div>
                      ))}
                    </div>
                    <div className="ag-cols">
                      <div className="ag-col" style={{ height: AG_HOURS.length * AG_HOUR_H }}>
                        {AG_HOURS.map((_, i) => (
                          <div key={i} className="ag-hour-line" style={{ top: i * AG_HOUR_H }} />
                        ))}
                        {agendaAppointments.filter(a => a.date === toDateKey(agendaDate)).map(apt => {
                          const top = (apt.startH - AG_START_H) * AG_HOUR_H + apt.startM * (AG_HOUR_H / 60);
                          const height = ((apt.endH - apt.startH) * 60 + (apt.endM - apt.startM)) * (AG_HOUR_H / 60);
                          return (
                            <div key={apt.id} className="ag-appointment" style={{ top, height }}
                              onClick={() => { reset(); setSelectedAppointment(apt); setConsultaOrigin("agenda"); setSection("consulta"); }}>
                              <div className="ag-apt-name">{apt.patient}</div>
                              <div className="ag-apt-info">{apt.type}</div>
                              <div className="ag-apt-time">{fmtT(apt.startH, apt.startM)} – {fmtT(apt.endH, apt.endM)}</div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {agendaViewTab === "semana" && (() => {
                const weekDays = getWeekDays(agendaDate);
                const todayKey = toDateKey(new Date());
                const selectedKey = toDateKey(agendaDate);
                return (
                  <div className="ag-grid-wrap">
                    <div className="ag-header-row">
                      <div className="ag-time-gutter" />
                      {weekDays.map((day, i) => {
                        const key = toDateKey(day);
                        return (
                          <div
                            key={i}
                            className={`ag-col-header ag-col-header-week${key === todayKey ? " ag-col-header-today" : ""}${key === selectedKey ? " ag-col-header-selected" : ""}`}
                            onClick={() => { setAgendaDate(new Date(day)); setAgendaViewTab("dia"); }}
                          >
                            {fmtWeekDay(day)}
                          </div>
                        );
                      })}
                    </div>
                    <div className="ag-body">
                      <div className="ag-time-col">
                        {AG_HOURS.map(h => (
                          <div key={h} className="ag-time-cell">
                            {String(h).padStart(2, "0")}:00
                          </div>
                        ))}
                      </div>
                      <div className="ag-cols">
                        {weekDays.map((day, dayIdx) => {
                          const key = toDateKey(day);
                          return (
                            <div key={dayIdx} className="ag-col" style={{ height: AG_HOURS.length * AG_HOUR_H }}>
                              {AG_HOURS.map((_, i) => (
                                <div key={i} className="ag-hour-line" style={{ top: i * AG_HOUR_H }} />
                              ))}
                              {agendaAppointments.filter(a => a.date === key).map(apt => {
                                const top = (apt.startH - AG_START_H) * AG_HOUR_H + apt.startM * (AG_HOUR_H / 60);
                                const height = ((apt.endH - apt.startH) * 60 + (apt.endM - apt.startM)) * (AG_HOUR_H / 60);
                                return (
                                  <div key={apt.id} className="ag-appointment" style={{ top, height }}
                                    onClick={() => { reset(); setSelectedAppointment(apt); setConsultaOrigin("agenda"); setSection("consulta"); }}>
                                    <div className="ag-apt-name">{apt.patient}</div>
                                    <div className="ag-apt-info">{apt.type}</div>
                                    <div className="ag-apt-time">{fmtT(apt.startH, apt.startM)} – {fmtT(apt.endH, apt.endM)}</div>
                                  </div>
                                );
                              })}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {section === "pacientes" && (
            <div className="p-wrap">
              {newPatientOpen && (
                <div className="p-modal-overlay" onClick={() => setNewPatientOpen(false)}>
                  <div className="p-modal" onClick={(e) => e.stopPropagation()}>
                    <div className="p-modal-header">
                      <h2 className="p-modal-title">Novo paciente</h2>
                      <button className="p-modal-close" onClick={() => setNewPatientOpen(false)} aria-label="Fechar">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                        </svg>
                      </button>
                    </div>
                    <form className="p-modal-form" onSubmit={handleNewPatient}>
                      <div className="p-form-row">
                        <div className="p-form-field">
                          <label>Nome *</label>
                          <input required value={newPatientForm.nome} onChange={(e) => setNewPatientForm((v) => ({ ...v, nome: e.target.value }))} placeholder="Ex: Maria" />
                        </div>
                        <div className="p-form-field">
                          <label>Sobrenome *</label>
                          <input required value={newPatientForm.sobrenome} onChange={(e) => setNewPatientForm((v) => ({ ...v, sobrenome: e.target.value }))} placeholder="Ex: Silva" />
                        </div>
                      </div>
                      <div className="p-form-row">
                        <div className="p-form-field">
                          <label>Data de Nascimento</label>
                          {(() => {
                            const { d, m, y } = parseBirthDate(newPatientForm.dataNascimento);
                            const maxDays = getDaysInMonth(m, y);
                            const setNpDate = (nd: string, nm: string, ny: string) =>
                              setNewPatientForm((v) => ({ ...v, dataNascimento: joinBirthDate(nd, nm, ny) }));
                            return (
                              <div className="p-date-row">
                                <select className="p-field-select" value={d} onChange={e => setNpDate(e.target.value, m, y)}>
                                  <option value="">Dia</option>
                                  {Array.from({ length: maxDays }, (_, i) => String(i + 1).padStart(2, "0")).map(v => (
                                    <option key={v} value={v}>{Number(v)}</option>
                                  ))}
                                </select>
                                <select className="p-field-select" value={m} onChange={e => {
                                  const nm = e.target.value;
                                  const safeDay = parseInt(d, 10) > getDaysInMonth(nm, y) ? "" : d;
                                  setNpDate(safeDay, nm, y);
                                }}>
                                  <option value="">Mês</option>
                                  {MONTHS_PT.map((mes, i) => (
                                    <option key={i} value={String(i + 1).padStart(2, "0")}>{mes}</option>
                                  ))}
                                </select>
                                <select className="p-field-select" value={y} onChange={e => {
                                  const ny = e.target.value;
                                  const safeDay = parseInt(d, 10) > getDaysInMonth(m, ny) ? "" : d;
                                  setNpDate(safeDay, m, ny);
                                }}>
                                  <option value="">Ano</option>
                                  {Array.from({ length: 120 }, (_, i) => new Date().getFullYear() - i).map(yr => (
                                    <option key={yr} value={String(yr)}>{yr}</option>
                                  ))}
                                </select>
                              </div>
                            );
                          })()}
                        </div>
                        <div className="p-form-field">
                          <label>Gênero</label>
                          <select value={newPatientForm.genero} onChange={(e) => setNewPatientForm((v) => ({ ...v, genero: e.target.value }))}>
                            <option value="">Selecionar</option>
                            <option value="Feminino">Feminino</option>
                            <option value="Masculino">Masculino</option>
                            <option value="Outro">Outro</option>
                            <option value="Prefiro não informar">Prefiro não informar</option>
                          </select>
                        </div>
                      </div>
                      <div className="p-form-row">
                        <div className="p-form-field">
                          <label>Celular</label>
                          <input type="tel" value={newPatientForm.telefone} onChange={(e) => setNewPatientForm((v) => ({ ...v, telefone: e.target.value }))} placeholder="(11) 99999-9999" />
                        </div>
                        <div className="p-form-field">
                          <label>Email</label>
                          <input type="email" value={newPatientForm.email} onChange={(e) => setNewPatientForm((v) => ({ ...v, email: e.target.value }))} placeholder="email@exemplo.com" />
                        </div>
                      </div>
                      <div className="p-modal-footer">
                        <button type="button" className="btn btn-outline btn-sm" onClick={() => setNewPatientOpen(false)}>Cancelar</button>
                        <button type="submit" className="btn btn-solid btn-sm">Salvar paciente</button>
                      </div>
                    </form>
                  </div>
                </div>
              )}

              {!selectedPatient ? (
                <>
                  <div className="p-list-header">
                    <div className="p-search">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                      </svg>
                      <input type="text" placeholder="Buscar paciente..." />
                    </div>
                    <button className="btn btn-solid btn-sm" onClick={() => setNewPatientOpen(true)}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                      </svg>
                      Novo paciente
                    </button>
                  </div>

                  {patients.length > 0 ? (
                    <div className="p-grid">
                      {patients.map((p) => (
                        <button key={p.id} className="p-patient-card" onClick={() => { setSelectedPatient(p); setPatientTab("visao-geral"); }}>
                          <div className="p-avatar-sm">{p.nome[0]}{p.sobrenome[0]}</div>
                          <span className="p-card-name">{p.nome} {p.sobrenome}</span>
                          <span className="p-card-meta">{fmtBirthDate(p.dataNascimento)}</span>
                          <span className={`p-badge p-badge-${p.status}`}>
                            {p.status === "ativo" ? "Ativo" : "Inativo"}
                          </span>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="p-empty">
                      <h3 className="p-empty-title">Nenhum paciente cadastrado</h3>
                      <p className="p-empty-desc">Adicione o primeiro paciente para começar a gerenciar consultas e prontuários.</p>
                      <button className="btn btn-solid btn-sm" onClick={() => setNewPatientOpen(true)}>Adicionar paciente</button>
                    </div>
                  )}
                </>
              ) : (
                <div className="p-detail">
                  {/* Sidebar do paciente */}
                  <aside className="p-patient-sidebar">
                    <button className="p-back-btn" onClick={() => setSelectedPatient(null)}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="15 18 9 12 15 6"/>
                      </svg>
                      Voltar
                    </button>

                    <div className="p-patient-identity">
                      <div className="p-avatar-lg">
                        {selectedPatient.nome[0]}{selectedPatient.sobrenome[0]}
                      </div>
                      <h2 className="p-patient-name">{selectedPatient.nome} {selectedPatient.sobrenome}</h2>
                      <p className="p-patient-meta">
                        {fmtBirthDate(selectedPatient.dataNascimento)}{selectedPatient.genero ? ` · ${selectedPatient.genero}` : ""}
                      </p>
                      {selectedPatient.telefone && (
                        <p className="p-patient-meta">{selectedPatient.telefone}</p>
                      )}
                      <span className={`p-badge p-badge-${selectedPatient.status}`}>
                        {selectedPatient.status === "ativo" ? "Ativo" : "Inativo"}
                      </span>
                    </div>

                    {(() => {
                      const todayKey = toDateKey(new Date());
                      const nextApt = agendaAppointments
                        .filter(a => a.patientId === selectedPatient.id && a.date >= todayKey)
                        .sort((a, b) => a.date.localeCompare(b.date) || a.startH - b.startH || a.startM - b.startM)[0] ?? null;
                      const [ny, nmo, nd] = nextApt ? nextApt.date.split("-") : [];
                      return (
                        <div className="p-info-block">
                          <p className="p-info-block-title">Próxima Consulta</p>
                          {nextApt ? (
                            <button className="p-next-consult-btn"
                              onClick={() => { reset(); setSelectedAppointment(nextApt); setConsultaOrigin("paciente"); setSection("consulta"); }}>
                              <span className="p-next-consult-date">{nd}/{nmo}/{ny}</span>
                              <span className="p-next-consult-time">{fmtT(nextApt.startH, nextApt.startM)} · {nextApt.type}</span>
                            </button>
                          ) : (
                            <p className="p-info-value">—</p>
                          )}
                        </div>
                      );
                    })()}

                    <div className="p-info-block">
                      <p className="p-info-block-title">Alertas</p>
                      <p className="p-info-value">—</p>
                    </div>

                    <div className="p-info-block">
                      <p className="p-info-block-title">Financeiro</p>
                      <p className="p-info-value">—</p>
                    </div>

                    <div className="p-info-block">
                      <p className="p-info-block-title">Plano de Saúde</p>
                      <p className="p-info-value">—</p>
                    </div>
                  </aside>

                  {/* Conteúdo principal com abas */}
                  <div className="p-content">
                    <nav className="p-tab-nav">
                      {(["visao-geral", "ficha-clinica", "odontograma", "imagens", "consultas", "cobrancas"] as const).map((t) => {
                        const labels: Record<string, string> = {
                          "visao-geral": "Visão Geral",
                          "ficha-clinica": "Ficha clínica",
                          "odontograma": "Odontograma",
                          "imagens": "Imagens",
                          "consultas": "Consultas",
                          "cobrancas": "Cobranças",
                        };
                        return (
                          <button key={t} className={`p-tab${patientTab === t ? " p-tab-active" : ""}`} onClick={() => setPatientTab(t)}>
                            {labels[t]}
                          </button>
                        );
                      })}
                    </nav>

                    <div className="p-tab-content">
                      {patientTab === "visao-geral" && (
                        <>
                          <div className="p-fields-section">
                            <h3 className="p-fields-section-title">Dados Pessoais</h3>
                            <div className="p-fields-grid">
                              <div className="p-field">
                                <span className="p-field-label">Nome</span>
                                <input className="p-field-input" value={selectedPatient.nome ?? ""} placeholder="—" onChange={(e) => updatePatient("nome", e.target.value)} />
                              </div>
                              <div className="p-field">
                                <span className="p-field-label">Nome Preferido</span>
                                <input className="p-field-input" value={selectedPatient.nomePreferido ?? ""} placeholder="—" onChange={(e) => updatePatient("nomePreferido", e.target.value)} />
                              </div>
                              <div className="p-field">
                                <span className="p-field-label">Sobrenome</span>
                                <input className="p-field-input" value={selectedPatient.sobrenome ?? ""} placeholder="—" onChange={(e) => updatePatient("sobrenome", e.target.value)} />
                              </div>
                              <div className="p-field">
                                <span className="p-field-label">Data de Nascimento</span>
                                <div className="p-date-row">
                                  {(() => {
                                    const { d, m, y } = parseBirthDate(selectedPatient.dataNascimento);
                                    const maxDays = getDaysInMonth(m, y);
                                    return (
                                      <>
                                        <select
                                          className="p-field-select"
                                          value={d}
                                          onChange={(e) => updatePatient("dataNascimento", joinBirthDate(e.target.value, m, y))}
                                        >
                                          <option value="">Dia</option>
                                          {Array.from({ length: maxDays }, (_, i) => String(i + 1).padStart(2, "0")).map(v => (
                                            <option key={v} value={v}>{Number(v)}</option>
                                          ))}
                                        </select>
                                        <select
                                          className="p-field-select"
                                          value={m}
                                          onChange={(e) => {
                                            const newMax = getDaysInMonth(e.target.value, y);
                                            const safeDay = parseInt(d, 10) > newMax ? "" : d;
                                            updatePatient("dataNascimento", joinBirthDate(safeDay, e.target.value, y));
                                          }}
                                        >
                                          <option value="">Mês</option>
                                          {MONTHS_PT.map((mes, i) => (
                                            <option key={i} value={String(i + 1).padStart(2, "0")}>{mes}</option>
                                          ))}
                                        </select>
                                        <select
                                          className="p-field-select"
                                          value={y}
                                          onChange={(e) => {
                                            const newMax = getDaysInMonth(m, e.target.value);
                                            const safeDay = parseInt(d, 10) > newMax ? "" : d;
                                            updatePatient("dataNascimento", joinBirthDate(safeDay, m, e.target.value));
                                          }}
                                        >
                                          <option value="">Ano</option>
                                          {Array.from({ length: 120 }, (_, i) => new Date().getFullYear() - i).map(yr => (
                                            <option key={yr} value={String(yr)}>{yr}</option>
                                          ))}
                                        </select>
                                      </>
                                    );
                                  })()}
                                </div>
                              </div>
                              <div className="p-field">
                                <span className="p-field-label">Gênero</span>
                                <select className="p-field-select" value={selectedPatient.genero ?? ""} onChange={(e) => updatePatient("genero", e.target.value)}>
                                  <option value="">—</option>
                                  <option value="Feminino">Feminino</option>
                                  <option value="Masculino">Masculino</option>
                                  <option value="Não-binário">Não-binário</option>
                                  <option value="Outro">Outro</option>
                                  <option value="Prefiro não informar">Prefiro não informar</option>
                                </select>
                              </div>
                              <div className="p-field">
                                <span className="p-field-label">Pronomes</span>
                                <select className="p-field-select" value={selectedPatient.pronomes ?? ""} onChange={(e) => updatePatient("pronomes", e.target.value)}>
                                  <option value="">—</option>
                                  <option value="ela/dela">ela/dela</option>
                                  <option value="ele/dele">ele/dele</option>
                                  <option value="elu/delu">elu/delu</option>
                                  <option value="Prefiro não informar">Prefiro não informar</option>
                                </select>
                              </div>
                              <div className="p-field">
                                <span className="p-field-label">CPF</span>
                                <input className="p-field-input" value={selectedPatient.cpf ?? ""} placeholder="—" onChange={(e) => updatePatient("cpf", e.target.value)} />
                              </div>
                            </div>
                          </div>

                          <div className="p-fields-section">
                            <h3 className="p-fields-section-title">Informações de Contato</h3>
                            <div className="p-fields-grid">
                              <div className="p-field">
                                <span className="p-field-label">Celular</span>
                                <input className="p-field-input" value={selectedPatient.telefone ?? ""} placeholder="—" onChange={(e) => updatePatient("telefone", e.target.value)} />
                              </div>
                              <div className="p-field">
                                <span className="p-field-label">Telefone Fixo</span>
                                <input className="p-field-input" value={selectedPatient.telefoneFixo ?? ""} placeholder="—" onChange={(e) => updatePatient("telefoneFixo", e.target.value)} />
                              </div>
                              <div className="p-field">
                                <span className="p-field-label">Email</span>
                                <input className="p-field-input" value={selectedPatient.email ?? ""} placeholder="—" onChange={(e) => updatePatient("email", e.target.value)} />
                              </div>
                              <div className="p-field">
                                <span className="p-field-label">Método de Contato Preferido</span>
                                <select className="p-field-select" value={selectedPatient.contatoPreferido ?? ""} onChange={(e) => updatePatient("contatoPreferido", e.target.value)}>
                                  <option value="">—</option>
                                  <option value="WhatsApp">WhatsApp</option>
                                  <option value="Ligação">Ligação</option>
                                  <option value="Email">Email</option>
                                  <option value="SMS">SMS</option>
                                </select>
                              </div>
                              <div className="p-field">
                                <span className="p-field-label">Contato de Emergência</span>
                                <input className="p-field-input" value={selectedPatient.contatoEmergencia ?? ""} placeholder="—" onChange={(e) => updatePatient("contatoEmergencia", e.target.value)} />
                              </div>
                              <div className="p-field">
                                <span className="p-field-label">Telefone de Emergência</span>
                                <input className="p-field-input" value={selectedPatient.telefoneEmergencia ?? ""} placeholder="—" onChange={(e) => updatePatient("telefoneEmergencia", e.target.value)} />
                              </div>
                              <div className="p-field">
                                <span className="p-field-label">Endereço</span>
                                <input className="p-field-input" value={selectedPatient.endereco ?? ""} placeholder="—" onChange={(e) => updatePatient("endereco", e.target.value)} />
                              </div>
                              <div className="p-field">
                                <span className="p-field-label">Cidade</span>
                                <input className="p-field-input" value={selectedPatient.cidade ?? ""} placeholder="—" onChange={(e) => updatePatient("cidade", e.target.value)} />
                              </div>
                              <div className="p-field">
                                <span className="p-field-label">CEP</span>
                                <input className="p-field-input" value={selectedPatient.cep ?? ""} placeholder="—" onChange={(e) => updatePatient("cep", e.target.value)} />
                              </div>
                            </div>
                          </div>
                        </>
                      )}

                      {patientTab === "consultas" && (() => {
                        const apts = agendaAppointments
                          .filter(a => a.patientId === selectedPatient.id)
                          .sort((a, b) => b.date.localeCompare(a.date) || b.startH - a.startH || b.startM - a.startM);
                        return apts.length === 0 ? (
                          <div className="p-tab-placeholder">
                            <p>Nenhuma consulta agendada.</p>
                          </div>
                        ) : (
                          <div className="p-consult-list">
                            {apts.map(apt => {
                              const [y, mo, d] = apt.date.split("-");
                              return (
                                <button key={apt.id} className="p-consult-item p-consult-item-btn"
                                  onClick={() => { reset(); setSelectedAppointment(apt); setConsultaOrigin("paciente"); setSection("consulta"); }}>
                                  <div className="p-consult-date">{d}/{mo}/{y}</div>
                                  <div className="p-consult-time">{fmtT(apt.startH, apt.startM)} – {fmtT(apt.endH, apt.endM)}</div>
                                  <div className="p-consult-type">{apt.type}</div>
                                  <svg className="p-consult-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <polyline points="9 18 15 12 9 6"/>
                                  </svg>
                                </button>
                              );
                            })}
                          </div>
                        );
                      })()}

                      {patientTab !== "visao-geral" && patientTab !== "consultas" && (
                        <div className="p-tab-placeholder">
                          <p>Em breve.</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {section === "financeiro" && (
            <div className="c-placeholder">
              <h1 className="c-page-title">Financeiro</h1>
              <p className="c-sub">Em breve.</p>
            </div>
          )}

        </main>
      </div>
    </div>
  );

}
