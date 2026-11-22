"use client";

import ConsultaEmpty from "@/app/consulta/components/ConsultaEmpty";
import { ConsultaRecording, ConsultaPaste, ConsultaWorking } from "@/app/consulta/components/ConsultaStages";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ProntuarioView from "@/app/components/ProntuarioView";
import FichaClinica from "@/app/consulta/components/FichaClinica";
import Cobrancas from "@/app/consulta/components/Cobrancas";
import Financeiro from "@/app/consulta/components/Financeiro";
import Odontograma from "@/app/consulta/components/Odontograma";
import ConsultasView from "@/app/consulta/components/ConsultasView";
import DocumentosView from "@/app/consulta/components/DocumentosView";
import Agenda, { type AgendaView } from "@/app/consulta/components/Agenda";
import { Tabs, SectionTitle, Button, IconButton, Avatar, PatientHeader, Status, Tag } from "@/app/components/ui";
import PatientOverviewView, { PatientFlags } from "@/app/consulta/components/PatientOverview";
import { buildPatientOverviews, type PatientOverview } from "@/lib/patient-overview";
import { aptColors, CONSULT_TYPES, toDateKey } from "@/lib/agenda-utils";
import type { ProntuarioModel } from "@/lib/types-prontuario";
import { getProntuario, saveProntuario, getHistoricoMd, saveTranscript, getTranscript, hasProntuario, getPatientSummaries, deleteProntuario, deleteOdontograma } from "@/lib/prontuario-storage";
import { deleteCobranca } from "@/lib/cobranca-storage";
import { getPrestador } from "@/lib/prestador-storage";
import type { PatientSummary } from "@/lib/types-prontuario";
import type { PatientData, AgAppointment } from "@/lib/types-jasmin";
import { DEMO_TRANSCRICOES } from "@/lib/demo-transcricoes";
import { loadDemoData, clearAllLocalData, getDemoMode, getDemoRef, DEMO_MODES, type DemoMode } from "@/lib/demo-data";

type PatientView = "todos" | "hoje" | "sem-prontuario" | "a-faturar" | "glosa" | "sem-retorno" | "inativos";
const PATIENT_VIEWS: { key: PatientView; label: string }[] = [
  { key: "todos", label: "Todos" },
  { key: "hoje", label: "Consulta hoje" },
  { key: "sem-prontuario", label: "Sem prontuário" },
  { key: "a-faturar", label: "A faturar" },
  { key: "glosa", label: "Glosas" },
  { key: "sem-retorno", label: "Sem retorno agendado" },
  { key: "inativos", label: "Inativos" },
];
const normText = (t: string) => t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

/** A cada quantos ms o áudio acumulado é enviado ao Whisper (menor = texto mais "ao vivo"). */
const LIVE_CHUNK_MS = 10_000;

type Status = "idle" | "recording" | "transcribing" | "processing" | "done" | "error";

const fmtT = (h: number, m: number) =>
  `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;

/** Idade em anos a partir de "YYYY-MM-DD"; null se a data for incompleta/inválida. */
const calcAge = (iso: string): number | null => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return null;
  const today = new Date();
  let age = today.getFullYear() - y;
  if (today.getMonth() + 1 < m || (today.getMonth() + 1 === m && today.getDate() < d)) age--;
  return age >= 0 && age < 150 ? age : null;
};

/** Tom de cor da próxima consulta conforme proximidade da data. */
type ProxTone = "today" | "tomorrow" | "week" | "future" | "none";
const proximaTone = (iso: string | null): ProxTone => {
  if (!iso) return "none";
  const [y, m, d] = iso.split("-").map(Number);
  const target = new Date(y, m - 1, d);
  const now = new Date(); now.setHours(0, 0, 0, 0);
  const diff = Math.round((target.getTime() - now.getTime()) / 86400000);
  if (diff <= 0) return "today";
  if (diff === 1) return "tomorrow";
  if (diff <= 7) return "week";
  return "future";
};

/** Classe de cor do badge de tipo de consulta (mesma lógica p/ tipos futuros). */
const consultTypeClass = (type: string): string => {
  const t = type.trim().toLowerCase();
  if (!t || t === "consulta") return "p-ct-consulta";
  if (t.includes("retorno")) return "p-ct-retorno";
  if (t.includes("urg")) return "p-ct-urgencia";
  return "p-ct-default";
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
  // Nome do dentista (dados do prestador, ex.: "Dra. Helena Duarte" na demo). Lido após montar (localStorage).
  const [dentistaNome, setDentistaNome] = useState("Dr. Usuário");
  useEffect(() => { setDentistaNome(getPrestador().dentista_nome || "Dr. Usuário"); }, []);
  const dentistaIniciais = dentistaNome.replace(/^(Dra?\.?\s+)/i, "").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "DR";
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string>("");
  const [consent, setConsent] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [prontuario, setProntuario] = useState<ProntuarioModel | null>(null);
  const [transcript, setTranscript] = useState("");
  const [liveTranscript, setLiveTranscript] = useState("");
  const [textOpen, setTextOpen] = useState(false);
  const [manualText, setManualText] = useState("");
  const [audioUrl, setAudioUrl] = useState<string>("");
  const [audioKB, setAudioKB] = useState<number>(0);
  const [level, setLevel] = useState(0);
  const [chunksDone, setChunksDone] = useState(0);
  const [section, setSection] = useState<"consulta" | "agenda" | "pacientes" | "financeiro" | "consultas" | "documentos" | "estoque">("agenda");
  const [subTab, setSubTab] = useState<"prontuario" | "odontograma">("prontuario");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [patients, setPatients] = useState<PatientData[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<PatientData | null>(null);
  const [patientTab, setPatientTab] = useState<"visao-geral" | "ficha-clinica" | "odontograma" | "imagens" | "consultas" | "cobrancas">("visao-geral");
  const [newPatientOpen, setNewPatientOpen] = useState(false);
  // Confirmação de exclusão (paciente ou consulta) — modal único reaproveitado.
  const [confirmDelete, setConfirmDelete] = useState<
    | { kind: "patient"; patient: PatientData }
    | { kind: "consulta"; apt: AgAppointment }
    | null
  >(null);
  const [newPatientForm, setNewPatientForm] = useState({ nome: "", sobrenome: "", dataNascimento: "", genero: "", telefone: "", email: "" });
  const [avatarDropdownOpen, setAvatarDropdownOpen] = useState(false);
  const [demoOpen, setDemoOpen] = useState(false);
  const [demoActive, setDemoActive] = useState(false);
  const [demoCopied, setDemoCopied] = useState<number | null>(null);
  const [demoMode, setDemoMode] = useState<DemoMode>("simples");
  const [demoRef, setDemoRef] = useState(() => {
    // padrão: a próxima segunda-feira (hoje, se já for segunda) — dia típico de apresentação
    const d = new Date();
    d.setDate(d.getDate() + ((8 - d.getDay()) % 7));
    return toDateKey(d);
  });
  const [agendaDate, setAgendaDate] = useState(new Date());
  const [agendaViewTab, setAgendaViewTab] = useState<AgendaView>("semana");
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
  const [ncTipo, setNcTipo] = useState("Consulta");

  // Lista de pacientes — busca, modo de visualização, filtro rápido e ordenação
  const [patientSearch, setPatientSearch] = useState("");
  const [patientViewMode, setPatientViewMode] = useState<"lista" | "grid">("lista");
  const [patientFilter, setPatientFilter] = useState<PatientView>("todos");
  const [patientConvenio, setPatientConvenio] = useState("todos");
  const [patientSort, setPatientSort] = useState<{
    col: "default" | "nome" | "proxima" | "procedimento" | "convenio" | "status";
    dir: "asc" | "desc";
  }>({ col: "default", dir: "asc" });

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const allChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const rafRef = useRef<number | null>(null);
  const avatarDropdownRef = useRef<HTMLDivElement>(null);
  const audioFileRef = useRef<HTMLInputElement>(null);

  // Refs com contexto fresco para a geração do prontuário (evita closures stale)
  const selectedAppointmentRef = useRef<AgAppointment | null>(null);
  const selectedPatientRef = useRef<PatientData | null>(null);
  const patientsRef = useRef<PatientData[]>([]);
  const appointmentsRef = useRef<AgAppointment[]>([]);

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
    try { const v = localStorage.getItem("jasmin_patient_view_mode"); if (v === "lista" || v === "grid") setPatientViewMode(v); } catch {}
    const dm = getDemoMode();
    setDemoActive(dm !== null);
    if (dm) setDemoMode(dm);
    // A demo carregada para um dia futuro abre a agenda direto naquela semana.
    const ref = getDemoRef();
    if (dm && ref && ref >= toDateKey(new Date())) {
      setAgendaDate(new Date(`${ref}T12:00:00`));
      setDemoRef(ref);
    }
    setHydrated(true);
  }, []);
  useEffect(() => { if (hydrated) localStorage.setItem("jasmin_patient_view_mode", patientViewMode); }, [patientViewMode, hydrated]);
  useEffect(() => { if (hydrated) localStorage.setItem("jasmin_patients", JSON.stringify(patients)); }, [patients, hydrated]);
  useEffect(() => { if (hydrated) localStorage.setItem("jasmin_appointments", JSON.stringify(agendaAppointments)); }, [agendaAppointments, hydrated]);

  // Mantém os refs em dia para a geração do prontuário
  useEffect(() => { selectedAppointmentRef.current = selectedAppointment; }, [selectedAppointment]);
  useEffect(() => { selectedPatientRef.current = selectedPatient; }, [selectedPatient]);
  useEffect(() => { patientsRef.current = patients; }, [patients]);
  useEffect(() => { appointmentsRef.current = agendaAppointments; }, [agendaAppointments]);

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

  // Roda o pipeline de 5 passos e persiste o prontuário no agendamento atual.
  const runProntuario = useCallback(async (fullTranscript: string) => {
    const apt = selectedAppointmentRef.current;
    const pt =
      selectedPatientRef.current ??
      (apt ? patientsRef.current.find((p) => p.id === apt.patientId) ?? null : null);

    const prestador = getPrestador();
    const paciente = {
      nome_paciente: pt ? `${pt.nome} ${pt.sobrenome}`.trim() : apt?.patient ?? "",
      convenio: pt?.convenio ?? "",
      carteirinha: pt?.carteirinha ?? "",
      dentista: prestador.dentista_nome || "Dr. Usuário",
      cro: prestador.dentista_cro ?? "",
      data: apt?.date ?? new Date().toISOString().slice(0, 10),
    };

    const historicoMd = apt
      ? getHistoricoMd(
          appointmentsRef.current
            .filter((a) => a.patientId === apt.patientId && a.id !== apt.id)
            .map((a) => a.id)
        )
      : "";

    setStatus("processing");
    try {
      const res = await fetch("/api/prontuario", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript: fullTranscript, paciente, historicoMd }),
      });
      const data = (await res.json()) as { prontuario?: ProntuarioModel; error?: string };
      if (!res.ok || !data.prontuario) throw new Error(data.error ?? "Falha ao gerar o prontuário.");
      setProntuario(data.prontuario);
      setTranscript(fullTranscript);
      if (apt) {
        saveProntuario(apt.id, data.prontuario);
        saveTranscript(apt.id, fullTranscript);
      }
      setStatus("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro desconhecido.");
      setStatus("error");
    }
  }, []);

  // Gera o prontuário a partir de uma transcrição colada/digitada manualmente.
  const handleManualSubmit = useCallback(async () => {
    const t = manualText.trim();
    if (!t) return;
    setError("");
    setTextOpen(false);
    await runProntuario(t);
  }, [manualText, runProntuario]);

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

    await runProntuario(fullTranscript);
  }, [runProntuario]);

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
      chunkFlushTimerRef.current = setInterval(flushPendingChunks, LIVE_CHUNK_MS);
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
    setStatus("transcribing");
    setError("");
    setLiveTranscript("");
    try {
      const form = new FormData();
      form.append("audio", file, filename);
      const res = await fetch("/api/transcribe", { method: "POST", body: form });
      const data = (await res.json()) as { transcript?: string; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Falha na transcrição.");
      const fullTranscript = (data.transcript ?? "").trim();
      if (!fullTranscript) throw new Error("Transcrição vazia — verifique o arquivo de áudio.");
      await runProntuario(fullTranscript);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro desconhecido.");
      setStatus("error");
    }
  }, [runProntuario]);

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

  const reset = () => {
    setStatus("idle");
    setProntuario(null);
    setTextOpen(false);
    setManualText("");
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

  // Abre a página de consulta carregando o prontuário salvo, se houver.
  const openConsulta = (apt: AgAppointment, origin: "agenda" | "paciente") => {
    reset();
    setSelectedAppointment(apt);
    setConsultaOrigin(origin);
    setSection("consulta");
    const saved = getProntuario(apt.id);
    if (saved) {
      setProntuario(saved);
      setTranscript(getTranscript(apt.id));
      setStatus("done");
    }
  };

  const handleProntuarioChange = (next: ProntuarioModel) => {
    setProntuario(next);
    if (selectedAppointment) saveProntuario(selectedAppointment.id, next);
  };

  const handleAprovarProntuario = () => {
    if (!prontuario) return;
    const next: ProntuarioModel = { ...prontuario, assinatura_pendente: false };
    setProntuario(next);
    if (selectedAppointment) saveProntuario(selectedAppointment.id, next);
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

  // Apaga uma consulta: remove o agendamento e todo o dado clínico vinculado
  // (prontuário, .md, transcrição e cobrança). Se a consulta estiver aberta, volta.
  const deleteConsulta = (apt: AgAppointment) => {
    deleteProntuario(apt.id);
    deleteCobranca(apt.id);
    setAgendaAppointments((prev) => prev.filter((a) => a.id !== apt.id));
    if (selectedAppointment?.id === apt.id) {
      reset();
      setSelectedAppointment(null);
    }
  };

  // Apaga um paciente e tudo que pende dele: agendamentos, prontuários/cobranças
  // de cada consulta e o odontograma. Volta para a lista de pacientes.
  const deletePatient = (patient: PatientData) => {
    const apts = agendaAppointments.filter((a) => a.patientId === patient.id);
    for (const a of apts) {
      deleteProntuario(a.id);
      deleteCobranca(a.id);
    }
    deleteOdontograma(patient.id);
    setAgendaAppointments((prev) => prev.filter((a) => a.patientId !== patient.id));
    setPatients((prev) => prev.filter((p) => p.id !== patient.id));
    if (selectedPatient?.id === patient.id) setSelectedPatient(null);
  };

  const handleConfirmDelete = () => {
    if (!confirmDelete) return;
    if (confirmDelete.kind === "patient") deletePatient(confirmDelete.patient);
    else deleteConsulta(confirmDelete.apt);
    setConfirmDelete(null);
  };

  // Abre o modal completo "Nova consulta" já preenchido (vem da criação rápida da agenda).
  const openNewConsulta = (p: { dateKey: string; startMin: number; endMin: number; patient: PatientData | null; type: string }) => {
    const dur = p.endMin - p.startMin;
    const label = DURATION_ITEMS.reduce((best, k) =>
      Math.abs(DURATION_MINS[k] - dur) < Math.abs(DURATION_MINS[best] - dur) ? k : best, DURATION_ITEMS[3]);
    setNcDate(p.dateKey);
    setNcStartH(String(Math.floor(p.startMin / 60)).padStart(2, "0"));
    setNcStartM(String(p.startMin % 60).padStart(2, "0"));
    setNcDuration(label);
    setNcPatient(p.patient);
    setNcSearch(p.patient ? `${p.patient.nome} ${p.patient.sobrenome}` : "");
    setNcTipo(p.type);
    setNcOpen(true);
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
      type: ncTipo,
      ...aptColors(ncTipo),
    };
    setAgendaAppointments(prev => [...prev, apt]);
    setNcOpen(false);
    setNcSearch("");
    setNcPatient(null);
    setNcTipo("Consulta");
    setNcDuration("1h");
    setAgendaDate(new Date(ncDate + "T12:00:00"));
  };

  const mmss = `${String(Math.floor(elapsed / 60)).padStart(2, "0")}:${String(
    elapsed % 60
  ).padStart(2, "0")}`;

  const busy = status === "recording" || status === "transcribing" || status === "processing";

  // ── Lista de pacientes: resumos agregados + filtro + ordenação (memoizados) ──
  const EMPTY_SUMMARY: PatientSummary = {
    patientId: "", proximaConsulta: null, ultimaConsulta: null, ultimoProcedimento: "", temProntuario: false,
  };
  const patientSummaries = useMemo(
    () => getPatientSummaries(agendaAppointments),
    // `section` força recomputar (ex.: último procedimento) ao voltar para Pacientes
    [agendaAppointments, hydrated, section]
  );
  const summaryOf = useCallback(
    (id: string) => patientSummaries[id] ?? EMPTY_SUMMARY,
    [patientSummaries] // eslint-disable-line react-hooks/exhaustive-deps
  );

  const proxKey = (s: PatientSummary) =>
    s.proximaConsulta ? `${s.proximaConsulta.date} ${fmtT(s.proximaConsulta.startH, s.proximaConsulta.startM)}` : "";

  // Visão 360° de cada paciente (alertas, financeiro, linha do tempo) — lê o storage uma vez.
  const patientOverviews = useMemo<Record<string, PatientOverview>>(
    () => (hydrated ? buildPatientOverviews(patients, agendaAppointments) : {}),
    // `section`/`patientTab` recomputam ao voltar de Cobranças/Consulta com dados novos
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [patients, agendaAppointments, hydrated, section, patientTab, selectedPatient]
  );

  const matchesView = useCallback(
    (view: PatientView, p: PatientData, todayKey: string) => {
      const s = summaryOf(p.id);
      const ov = patientOverviews[p.id];
      switch (view) {
        case "hoje": return !!s.proximaConsulta && s.proximaConsulta.date === todayKey;
        case "sem-prontuario": return !!s.ultimaConsulta && !s.temProntuario;
        case "a-faturar": return !!p.convenio && !!ov && ov.financeiro.nRevisar + ov.financeiro.nSemGuia > 0;
        case "glosa": return !!ov && ov.financeiro.nGlosadas > 0;
        case "sem-retorno": return p.status === "ativo" && !!s.ultimaConsulta && !s.proximaConsulta;
        case "inativos": return p.status === "inativo";
        default: return true;
      }
    },
    [summaryOf, patientOverviews]
  );

  const viewCounts = useMemo(() => {
    const todayKey = toDateKey(new Date());
    const out = {} as Record<PatientView, number>;
    for (const v of PATIENT_VIEWS) out[v.key] = patients.filter((p) => matchesView(v.key, p, todayKey)).length;
    return out;
  }, [patients, matchesView]);

  const convenioOptions = useMemo(
    () => Array.from(new Set(patients.map((p) => p.convenio || "Particular"))).sort((a, b) => a.localeCompare(b)),
    [patients]
  );

  const visiblePatients = useMemo(() => {
    const todayKey = toDateKey(new Date());
    const q = normText(patientSearch.trim());
    const qDigits = patientSearch.replace(/\D/g, "");

    const list = patients.filter((p) => {
      if (q) {
        const hay = normText(`${p.nome} ${p.sobrenome} ${p.nomePreferido ?? ""} ${p.carteirinha ?? ""} ${p.email ?? ""}`);
        const digits = `${p.cpf ?? ""}${p.telefone ?? ""}${p.carteirinha ?? ""}`.replace(/\D/g, "");
        if (!hay.includes(q) && !(qDigits.length >= 3 && digits.includes(qDigits))) return false;
      }
      if (patientConvenio !== "todos" && (p.convenio || "Particular") !== patientConvenio) return false;
      return matchesView(patientFilter, p, todayKey);
    });

    const dir = patientSort.dir === "asc" ? 1 : -1;
    list.sort((a, b) => {
      const sa = summaryOf(a.id), sb = summaryOf(b.id);
      const na = `${a.nome} ${a.sobrenome}`.trim().toLowerCase();
      const nb = `${b.nome} ${b.sobrenome}`.trim().toLowerCase();
      switch (patientSort.col) {
        case "nome": return dir * na.localeCompare(nb);
        case "procedimento": return dir * (sa.ultimoProcedimento || "").localeCompare(sb.ultimoProcedimento || "");
        case "convenio": return dir * (a.convenio || "Particular").localeCompare(b.convenio || "Particular");
        case "status": return dir * a.status.localeCompare(b.status);
        case "proxima": {
          const ka = proxKey(sa), kb = proxKey(sb);
          if (!ka && !kb) return na.localeCompare(nb);
          if (!ka) return 1;
          if (!kb) return -1;
          return dir * ka.localeCompare(kb);
        }
        default: {
          // próxima consulta asc; sem futura vão ao fim, alfabético por nome
          const ka = proxKey(sa), kb = proxKey(sb);
          if (!ka && !kb) return na.localeCompare(nb);
          if (!ka) return 1;
          if (!kb) return -1;
          return ka.localeCompare(kb);
        }
      }
    });
    return list;
  }, [patients, patientSearch, patientFilter, patientConvenio, patientSort, summaryOf, matchesView]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleSort = (col: typeof patientSort.col) =>
    setPatientSort((s) => (s.col === col ? { col, dir: s.dir === "asc" ? "desc" : "asc" } : { col, dir: "asc" }));

  const sortArrow = (col: typeof patientSort.col) =>
    patientSort.col === col ? (patientSort.dir === "asc" ? " ↑" : " ↓") : "";

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
            className={`c-sidebar-tab${section === "consultas" ? " c-sidebar-tab-active" : ""}`}
            onClick={() => setSection("consultas")}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2"/>
              <line x1="16" y1="2" x2="16" y2="6"/>
              <line x1="8" y1="2" x2="8" y2="6"/>
              <line x1="3" y1="10" x2="21" y2="10"/>
              <line x1="8" y1="14" x2="16" y2="14"/>
              <line x1="8" y1="18" x2="13" y2="18"/>
            </svg>
            <span>Consultas</span>
          </button>
          <button
            className={`c-sidebar-tab${section === "documentos" ? " c-sidebar-tab-active" : ""}`}
            onClick={() => setSection("documentos")}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
              <line x1="8" y1="13" x2="16" y2="13"/>
              <line x1="8" y1="17" x2="16" y2="17"/>
            </svg>
            <span>Documentos</span>
          </button>
          <button
            className={`c-sidebar-tab${section === "estoque" ? " c-sidebar-tab-active" : ""}`}
            onClick={() => setSection("estoque")}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <line x1="8" y1="6" x2="21" y2="6"/>
              <line x1="8" y1="12" x2="21" y2="12"/>
              <line x1="8" y1="18" x2="21" y2="18"/>
              <line x1="3" y1="6" x2="3.01" y2="6"/>
              <line x1="3" y1="12" x2="3.01" y2="12"/>
              <line x1="3" y1="18" x2="3.01" y2="18"/>
            </svg>
            <span>Estoque</span>
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
              <div className="c-avatar">{dentistaIniciais}</div>
              {sidebarOpen && <span className="c-avatar-name">{dentistaNome}</span>}
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
                <button className="c-dropdown-item" onClick={() => { setAvatarDropdownOpen(false); setDemoOpen(true); }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3z"/>
                    <path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15z"/>
                  </svg>
                  Modo Demo{demoActive ? " (ativo)" : ""}
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
                  const [y, mo, d] = selectedAppointment.date.split("-");
                  return (
                    <div className="c-consult-context">
                      <h1 className="c-consult-title">Prontuário da consulta</h1>
                      <div className="c-consult-sub">
                        <PatientHeader
                          layout="compact"
                          title="Abrir ficha do paciente"
                          onClick={() => {
                            const pt = patients.find((x) => x.id === selectedAppointment.patientId);
                            if (!pt) return;
                            reset();
                            setSelectedAppointment(null);
                            setSelectedPatient(pt);
                            setPatientTab("visao-geral");
                            setSection("pacientes");
                          }}
                          name={selectedAppointment.patient}
                        />
                        <span className="c-consult-dot">·</span>
                        <span>{d}/{mo}/{y}</span>
                        <span className="c-consult-dot">·</span>
                        <span>{fmtT(selectedAppointment.startH, selectedAppointment.startM)}–{fmtT(selectedAppointment.endH, selectedAppointment.endM)}</span>
                        <Tag tone="accent">{selectedAppointment.type || "Consulta"}</Tag>
                      </div>
                    </div>
                  );
                })()}
                {!busy && <div className="c-rec-btn-area">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={startRecording}
                    icon={
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="14" height="14">
                        <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" /><path d="M19 10v2a7 7 0 0 1-14 0v-2" /><line x1="12" y1="19" x2="12" y2="22" />
                      </svg>
                    }
                  >
                    Gravar
                  </Button>
                  <input ref={audioFileRef} type="file" accept="audio/*" hidden onChange={onUploadFile} disabled={busy} />
                  <IconButton outline label="Enviar arquivo de áudio" disabled={busy} onClick={() => audioFileRef.current?.click()}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
                    </svg>
                  </IconButton>
                  <IconButton outline label="Colar texto da transcrição" active={textOpen} disabled={busy} onClick={() => setTextOpen((v) => !v)}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="8" y1="13" x2="16" y2="13" /><line x1="8" y1="17" x2="16" y2="17" />
                    </svg>
                  </IconButton>
                </div>}
              </div>

              {status === "error" && prontuario && <p className="c-status c-err">{error}</p>}

              <section className="c-result">
                {status === "recording" ? (
                  <ConsultaRecording time={mmss} level={level} text={liveTranscript} onStop={stopRecording} />
                ) : status === "transcribing" || status === "processing" ? (
                  <ConsultaWorking label={status === "transcribing" ? "Finalizando a transcrição…" : "Estruturando o prontuário…"} steps={status === "processing"} />
                ) : prontuario ? (
                  <ProntuarioView
                    prontuario={prontuario}
                    transcript={transcript}
                    onChange={handleProntuarioChange}
                    onAprovar={handleAprovarProntuario}
                  />
                ) : textOpen ? (
                  <ConsultaPaste
                    value={manualText}
                    onChange={setManualText}
                    onCancel={() => { setTextOpen(false); setManualText(""); }}
                    onSubmit={handleManualSubmit}
                  />
                ) : (
                  <ConsultaEmpty
                    error={status === "error" ? error : ""}
                    onRecord={startRecording}
                    onUploadAudio={() => audioFileRef.current?.click()}
                    onPasteText={() => setTextOpen(true)}
                  />
                )}
              </section>
            </>
          )}

          {section === "agenda" && (
            <Agenda
              appointments={agendaAppointments}
              patients={patients}
              date={agendaDate}
              view={agendaViewTab}
              onDateChange={setAgendaDate}
              onViewChange={setAgendaViewTab}
              onChangeAppointments={setAgendaAppointments}
              onOpenConsulta={(apt) => openConsulta(apt, "agenda")}
              onOpenPatient={(id) => {
                const pt = patients.find((x) => x.id === id);
                if (pt) { setSelectedPatient(pt); setPatientTab("visao-geral"); setSection("pacientes"); }
              }}
              onDeleteConsulta={(apt) => setConfirmDelete({ kind: "consulta", apt })}
              onMoreOptions={openNewConsulta}
            />
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
                        <Button type="button" variant="secondary" size="sm" onClick={() => setNewPatientOpen(false)}>Cancelar</Button>
                        <Button type="submit" variant="primary" size="sm">Salvar paciente</Button>
                      </div>
                    </form>
                  </div>
                </div>
              )}

              {!selectedPatient ? (
                patients.length === 0 ? (
                  <div className="p-empty">
                    <h3 className="p-empty-title">Nenhum paciente cadastrado</h3>
                    <p className="p-empty-desc">Adicione o primeiro paciente para começar a gerenciar consultas e prontuários.</p>
                    <Button variant="primary" size="sm" onClick={() => setNewPatientOpen(true)}>Adicionar paciente</Button>
                  </div>
                ) : (
                  <>
                    <div className="p-toolbar">
                      <div className="p-search">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                        </svg>
                        <input type="text" placeholder="Buscar por nome, CPF, telefone ou carteirinha…" value={patientSearch} onChange={(e) => setPatientSearch(e.target.value)} />
                      </div>
                      <div className="p-toolbar-right">
                        <div className="p-view-toggle">
                          <button
                            className={`p-view-btn${patientViewMode === "lista" ? " p-view-btn-active" : ""}`}
                            onClick={() => setPatientViewMode("lista")}
                            aria-label="Modo lista" title="Lista"
                          >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/>
                              <line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>
                            </svg>
                          </button>
                          <button
                            className={`p-view-btn${patientViewMode === "grid" ? " p-view-btn-active" : ""}`}
                            onClick={() => setPatientViewMode("grid")}
                            aria-label="Modo grid" title="Grid"
                          >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
                              <rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
                            </svg>
                          </button>
                        </div>
                        <Button variant="primary" size="sm" onClick={() => setNewPatientOpen(true)}>
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                          </svg>
                          Novo paciente
                        </Button>
                      </div>
                    </div>

                    <div className="p-filters">
                      {PATIENT_VIEWS.map((f) => (
                        <button
                          key={f.key}
                          className={`p-filter-pill${patientFilter === f.key ? " p-filter-pill-active" : ""}${viewCounts[f.key] === 0 && patientFilter !== f.key ? " p-filter-pill-zero" : ""}`}
                          onClick={() => setPatientFilter(f.key)}
                        >
                          {f.label}
                          <span className="p-filter-count">{viewCounts[f.key]}</span>
                        </button>
                      ))}
                      <select
                        className={`p-conv-select${patientConvenio !== "todos" ? " p-conv-select-on" : ""}`}
                        value={patientConvenio}
                        onChange={(e) => setPatientConvenio(e.target.value)}
                        aria-label="Filtrar por convênio"
                      >
                        <option value="todos">Todos os convênios</option>
                        {convenioOptions.map((c) => <option key={c} value={c}>{c}</option>)}
                      </select>
                      {(patientConvenio !== "todos" || patientFilter !== "todos" || patientSearch.trim()) && (
                        <button
                          type="button"
                          className="p-filter-clear"
                          onClick={() => { setPatientFilter("todos"); setPatientConvenio("todos"); setPatientSearch(""); }}
                        >
                          Limpar filtros
                        </button>
                      )}
                    </div>

                    <p className="p-result-count">
                      Mostrando {visiblePatients.length} paciente{visiblePatients.length === 1 ? "" : "s"}
                    </p>

                    {visiblePatients.length === 0 ? (
                      <div className="p-filter-empty">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" width="32" height="32">
                          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/>
                        </svg>
                        <p>
                          {patientFilter === "hoje"
                            ? "Nenhuma consulta agendada para hoje."
                            : patientFilter === "sem-prontuario"
                            ? "Todos os pacientes com consultas têm prontuário salvo. ✓"
                            : patientFilter === "inativos"
                            ? "Nenhum paciente inativo."
                            : patientFilter === "a-faturar"
                            ? "Nenhuma guia pendente de geração ou revisão. ✓"
                            : patientFilter === "glosa"
                            ? "Nenhuma guia glosada no momento. ✓"
                            : patientFilter === "sem-retorno"
                            ? "Todos os pacientes ativos têm retorno agendado. ✓"
                            : patientSearch.trim()
                            ? `Nenhum paciente encontrado para “${patientSearch.trim()}”.`
                            : patientConvenio !== "todos"
                            ? `Nenhum paciente do convênio ${patientConvenio}.`
                            : "Nenhum paciente encontrado."}
                        </p>
                      </div>
                    ) : patientViewMode === "lista" ? (
                      <div className="p-list">
                        <div className="p-lhead">
                          <span className="p-col-avatar" />
                          <button className="p-lhead-btn p-col-nome" onClick={() => toggleSort("nome")}>NOME{sortArrow("nome")}</button>
                          <button className="p-lhead-btn p-col-prox" onClick={() => toggleSort("proxima")}>PRÓXIMA CONSULTA{sortArrow("proxima")}</button>
                          <button className="p-lhead-btn p-col-proc" onClick={() => toggleSort("procedimento")}>ÚLTIMO PROCEDIMENTO{sortArrow("procedimento")}</button>
                          <button className="p-lhead-btn p-col-conv" onClick={() => toggleSort("convenio")}>CONVÊNIO{sortArrow("convenio")}</button>
                          <button className="p-lhead-btn p-col-status" onClick={() => toggleSort("status")}>STATUS{sortArrow("status")}</button>
                        </div>
                        {visiblePatients.map((p) => {
                          const s = summaryOf(p.id);
                          const age = calcAge(p.dataNascimento);
                          const tone = proximaTone(s.proximaConsulta?.date ?? null);
                          const sub = [age != null ? `${age} anos` : null, p.genero || null].filter(Boolean).join(" · ") || "—";
                          const proxLabel = tone === "today" ? "Hoje" : tone === "tomorrow" ? "Amanhã"
                            : s.proximaConsulta ? s.proximaConsulta.date.split("-").reverse().join("/") : "—";
                          return (
                            <button key={p.id} className="p-row" data-jasmin-context="paciente" data-patient-id={p.id} onClick={() => { setSelectedPatient(p); setPatientTab("visao-geral"); }}>
                              <span className="p-col-avatar">
                                <Avatar name={`${p.nome} ${p.sobrenome}`} />
                              </span>
                              <span className="p-col-nome">
                                <span className="p-row-name">{p.nome} {p.sobrenome}<PatientFlags ov={patientOverviews[p.id]} convenio={p.convenio} /></span>
                                <span className="p-row-sub">{sub}</span>
                              </span>
                              <span className="p-col-prox">
                                <span className={`p-next p-next-${tone}`}>{proxLabel}</span>
                                {s.proximaConsulta && <span className="p-row-sub">{fmtT(s.proximaConsulta.startH, s.proximaConsulta.startM)}</span>}
                              </span>
                              <span className="p-col-proc p-row-sub p-trunc">{s.ultimoProcedimento || "—"}</span>
                              <span className="p-col-conv"><span className="p-conv-pill">{p.convenio || "Particular"}</span></span>
                              <span className="p-col-status"><span className={`p-badge p-badge-${p.status}`}>{p.status === "ativo" ? "Ativo" : "Inativo"}</span></span>
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="p-grid">
                        {visiblePatients.map((p) => {
                          const s = summaryOf(p.id);
                          const age = calcAge(p.dataNascimento);
                          const tone = proximaTone(s.proximaConsulta?.date ?? null);
                          const sub = [age != null ? `${age} anos` : null, p.genero || null].filter(Boolean).join(" · ") || "—";
                          const proxLabel = tone === "today" ? "Hoje" : tone === "tomorrow" ? "Amanhã"
                            : s.proximaConsulta ? s.proximaConsulta.date.split("-").reverse().join("/") : "—";
                          const proxFull = s.proximaConsulta ? `${proxLabel} · ${fmtT(s.proximaConsulta.startH, s.proximaConsulta.startM)}` : "—";
                          return (
                            <button key={p.id} className="p-pcard" data-jasmin-context="paciente" data-patient-id={p.id} onClick={() => { setSelectedPatient(p); setPatientTab("visao-geral"); }}>
                              <div className="p-pcard-l1">
                                <Avatar name={`${p.nome} ${p.sobrenome}`} />
                                <span className="p-pcard-name">{p.nome} {p.sobrenome}</span>
                                <span className={`p-badge p-badge-${p.status}`}>{p.status === "ativo" ? "Ativo" : "Inativo"}</span>
                              </div>
                              <div className="p-pcard-sub">{sub}<PatientFlags ov={patientOverviews[p.id]} convenio={p.convenio} /></div>
                              <div className="p-pcard-divider" />
                              <div className={`p-pcard-block${tone === "today" ? " p-pcard-block-today" : ""}`}>
                                <span className="p-pcard-flabel">Próxima consulta</span>
                                <div className="p-pcard-next">
                                  {tone === "today" && (
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="13" height="13">
                                      <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                                    </svg>
                                  )}
                                  <span className={`p-next p-next-${tone}`}>{proxFull}</span>
                                </div>
                              </div>
                              <div className="p-pcard-block">
                                <span className="p-pcard-flabel">Último procedimento</span>
                                <span className="p-pcard-proc p-trunc">{s.ultimoProcedimento || "—"}</span>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </>
                )
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
                      <PatientHeader
                        layout="stack"
                        name={`${selectedPatient.nome} ${selectedPatient.sobrenome}`}
                        lines={[
                          `${fmtBirthDate(selectedPatient.dataNascimento)}${selectedPatient.genero ? ` · ${selectedPatient.genero}` : ""}`,
                          selectedPatient.telefone,
                        ]}
                        badge={<Status tone={selectedPatient.status === "ativo" ? "green" : "neutral"}>{selectedPatient.status === "ativo" ? "Ativo" : "Inativo"}</Status>}
                      />
                    </div>

                    {(() => {
                      const ov = patientOverviews[selectedPatient.id];
                      const temAlerta = !!ov && (ov.alergias.length > 0 || !!ov.comorbidades.trim() || ov.medicamentos.length > 0 || ov.alertasClinicos.length > 0);
                      return (
                        <>
                          {temAlerta && ov && (
                            <div className="p-alertbox">
                              <p className="p-alertbox-title">Alertas clínicos</p>
                              <div className="p-side-chips">
                                {ov.alergias.map((a) => <span key={a} className="p-side-chip p-side-chip-red">Alergia: {a}</span>)}
                                {ov.comorbidades.trim() && <span className="p-side-chip p-side-chip-amber">{ov.comorbidades}</span>}
                                {ov.medicamentos.map((m) => <span key={m} className="p-side-chip p-side-chip-blue">Em uso: {m}</span>)}
                                {ov.alertasClinicos.map((t) => <span key={t} className="p-side-chip p-side-chip-amber">{t}</span>)}
                              </div>
                            </div>
                          )}

                          {selectedPatient.convenio && (
                            <div className="p-info-block">
                              <p className="p-info-block-title">Plano de Saúde</p>
                              <div className="p-side-lines">
                                <span className="p-side-line"><b>{selectedPatient.convenio}</b>{selectedPatient.plano ? ` · ${selectedPatient.plano}` : ""}</span>
                                {selectedPatient.carteirinha && <span className="p-side-line p-side-mono">{selectedPatient.carteirinha}</span>}
                              </div>
                            </div>
                          )}
                        </>
                      );
                    })()}

                    <button className="p-delete-patient-btn"
                      onClick={() => setConfirmDelete({ kind: "patient", patient: selectedPatient })}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6"/>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                        <line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/>
                      </svg>
                      Excluir paciente
                    </button>
                  </aside>

                  {/* Conteúdo principal com abas */}
                  <div className="p-content">
                    <div className="p-tabs-wrap">
                      <Tabs
                        aria-label="Seções do paciente"
                        items={[
                          { id: "visao-geral", label: "Visão Geral" },
                          { id: "ficha-clinica", label: "Ficha clínica" },
                          { id: "odontograma", label: "Odontograma" },
                          { id: "consultas", label: "Consultas" },
                          { id: "cobrancas", label: "Cobranças" },
                        ]}
                        value={patientTab}
                        onChange={(id) => setPatientTab(id as typeof patientTab)}
                      />
                    </div>

                    <div className="p-tab-content">
                      {patientTab === "visao-geral" && (
                        <>
                          {patientOverviews[selectedPatient.id] && (
                            <PatientOverviewView
                              patient={selectedPatient}
                              data={patientOverviews[selectedPatient.id]}
                              onOpenConsulta={(apt) => openConsulta(apt, "paciente")}
                              onNewAppointment={() => {
                                const d = new Date();
                                d.setDate(d.getDate() + 1);
                                if (d.getDay() === 0) d.setDate(d.getDate() + 1);
                                openNewConsulta({ dateKey: toDateKey(d), startMin: 9 * 60, endMin: 10 * 60, patient: selectedPatient, type: "Retorno" });
                              }}
                              onGoTab={setPatientTab}
                            />
                          )}
                          <div className="p-fields-section">
                            <SectionTitle>Dados Pessoais</SectionTitle>
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
                            <SectionTitle>Informações de Contato</SectionTitle>
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
                        const todayKey = toDateKey(new Date());
                        const apts = agendaAppointments
                          .filter(a => a.patientId === selectedPatient.id)
                          .sort((a, b) => b.date.localeCompare(a.date) || b.startH - a.startH || b.startM - a.startM);
                        return apts.length === 0 ? (
                          <div className="p-tab-placeholder">
                            <p>Nenhuma consulta agendada.</p>
                          </div>
                        ) : (
                          <section className="p-fields-section">
                          <SectionTitle>Consultas</SectionTitle>
                          <div className="p-consult-list">
                            {apts.map(apt => {
                              const [y, mo, d] = apt.date.split("-");
                              const isFuture = apt.date > todayKey;
                              const temProntuario = hasProntuario(apt.id);
                              return (
                                <div key={apt.id} className="p-consult-row">
                                  <button className={`p-consult-item p-consult-item-btn${isFuture ? " p-consult-item-future" : ""}`}
                                    data-jasmin-context="consulta" data-appointment-id={apt.id}
                                    onClick={() => openConsulta(apt, "paciente")}>
                                    <div className="p-consult-main">
                                      <span className="p-consult-date">{d}/{mo}/{y}</span>
                                      <span className="p-consult-time">{fmtT(apt.startH, apt.startM)} – {fmtT(apt.endH, apt.endM)}</span>
                                    </div>
                                    <div className="p-consult-badges">
                                      <span className={`p-consult-type-badge ${consultTypeClass(apt.type)}`}>{apt.type || "Consulta"}</span>
                                      <span className={`p-consult-status-badge ${temProntuario ? "p-consult-status-saved" : "p-consult-status-none"}`}>
                                        {temProntuario ? "Prontuário salvo" : isFuture ? "Agendada" : "Sem prontuário"}
                                      </span>
                                    </div>
                                    <svg className="p-consult-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                      <polyline points="9 18 15 12 9 6"/>
                                    </svg>
                                  </button>
                                  <button className="p-consult-del" title="Excluir consulta" aria-label="Excluir consulta"
                                    onClick={() => setConfirmDelete({ kind: "consulta", apt })}>
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                      <polyline points="3 6 5 6 21 6"/>
                                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                                      <line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/>
                                    </svg>
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                          </section>
                        );
                      })()}

                      {patientTab === "ficha-clinica" && (
                        <FichaClinica patient={selectedPatient} onUpdatePatient={updatePatient} />
                      )}

                      {patientTab === "odontograma" && (
                        <section className="p-fields-section" data-jasmin-context="odontograma" data-patient-id={selectedPatient.id}>
                          <SectionTitle>Odontograma</SectionTitle>
                          <Odontograma patientId={selectedPatient.id} />
                        </section>
                      )}

                      {patientTab === "cobrancas" && (
                        <Cobrancas patientId={selectedPatient.id} />
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {section === "financeiro" && (
            <Financeiro
              onOpenPatientCobrancas={(patientId) => {
                const p = patients.find((x) => x.id === patientId);
                if (p) {
                  setSelectedPatient(p);
                  setPatientTab("cobrancas");
                  setSection("pacientes");
                }
              }}
            />
          )}

          {section === "consultas" && (
            <ConsultasView
              appointments={agendaAppointments}
              patients={patients}
              onOpenConsulta={(apt) => openConsulta(apt, "agenda")}
              onNovaConsulta={() => { setNcDate(toDateKey(new Date())); setNcOpen(true); }}
            />
          )}

          {section === "documentos" && (
            <DocumentosView />
          )}

          {section === "estoque" && (
            <div className="p-wrap">
              <div className="p-empty">
                <h3 className="p-empty-title">Estoque em breve</h3>
                <p className="p-empty-desc">O controle de estoque de materiais e insumos estará disponível em breve.</p>
              </div>
            </div>
          )}

        </main>
      </div>

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
                          <Avatar name={`${p.nome} ${p.sobrenome}`} size="sm" />
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
                <label className="nc-label">Tipo de consulta</label>
                <div className="nc-type-pills">
                  {CONSULT_TYPES.map((t) => {
                    const clrs = aptColors(t);
                    const active = ncTipo === t;
                    return (
                      <button
                        key={t}
                        type="button"
                        className={`nc-type-pill${active ? " nc-type-pill-active" : ""}`}
                        style={active ? { background: clrs.bg, borderColor: clrs.border, color: clrs.color } : undefined}
                        onClick={() => setNcTipo(t)}
                      >
                        {t}
                      </button>
                    );
                  })}
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
            </div>
            <div className="nc-footer">
              <Button type="button" variant="secondary" size="sm" onClick={() => setNcOpen(false)}>Cancelar</Button>
              <Button type="submit" variant="primary" size="sm" disabled={!ncPatient || !ncDate}>Agendar</Button>
            </div>
          </form>
        </div>
      )}

      {confirmDelete && (() => {
        const cd = confirmDelete;
        const nConsultas = cd.kind === "patient"
          ? agendaAppointments.filter((a) => a.patientId === cd.patient.id).length
          : 0;
        return (
          <div className="p-modal-overlay" onClick={() => setConfirmDelete(null)}>
            <div className="p-confirm-modal" onClick={(e) => e.stopPropagation()}>
              <div className="p-confirm-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                  <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
              </div>
              <h2 className="p-confirm-title">
                {cd.kind === "patient" ? "Excluir paciente?" : "Excluir consulta?"}
              </h2>
              <p className="p-confirm-text">
                {cd.kind === "patient" ? (
                  <>
                    Tudo de <strong>{cd.patient.nome} {cd.patient.sobrenome}</strong> será apagado:
                    {nConsultas > 0 ? ` ${nConsultas} consulta${nConsultas === 1 ? "" : "s"}, ` : " "}
                    prontuários, odontograma e cobranças. Esta ação não pode ser desfeita.
                  </>
                ) : (
                  <>
                    A consulta de <strong>{cd.apt.date.split("-").reverse().join("/")}</strong> ({cd.apt.type || "Consulta"}) e o prontuário,
                    transcrição e cobrança vinculados serão apagados. Esta ação não pode ser desfeita.
                  </>
                )}
              </p>
              <div className="p-confirm-actions">
                <Button variant="secondary" size="sm" onClick={() => setConfirmDelete(null)}>Cancelar</Button>
                <Button variant="danger" size="sm" onClick={handleConfirmDelete}>Excluir</Button>
              </div>
            </div>
          </div>
        );
      })()}

      {demoOpen && (
        <div className="p-modal-overlay" onClick={() => setDemoOpen(false)}>
          <div className="p-confirm-modal dm-modal" onClick={(e) => e.stopPropagation()}>
            <div className="p-confirm-icon" style={{ background: "rgba(252,94,14,0.1)", color: "#fc5e0e" }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3z"/>
              </svg>
            </div>
            <h2 className="p-confirm-title">Modo Demo</h2>
            <div className="dm-opts" role="radiogroup" aria-label="Tipo de demonstração">
              {(Object.keys(DEMO_MODES) as DemoMode[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  role="radio"
                  aria-checked={demoMode === m}
                  className={`dm-opt${demoMode === m ? " dm-opt-on" : ""}`}
                  onClick={() => setDemoMode(m)}
                >
                  <span className="dm-opt-radio" />
                  <span className="dm-opt-body">
                    <span className="dm-opt-title">{DEMO_MODES[m].label}</span>
                    <span className="dm-opt-sub">{DEMO_MODES[m].resumo}</span>
                  </span>
                </button>
              ))}
            </div>
            <label className="dm-date">
              <span>
                <b>Dia da apresentação</b>
                <small>vira o &ldquo;hoje&rdquo; da demo: as consultas desse dia ficam por fazer, prontas para gravar ao vivo</small>
              </span>
              <input type="date" value={demoRef} min={toDateKey(new Date())} onChange={(e) => e.target.value && setDemoRef(e.target.value)} />
            </label>
            <div className="dm-tx">
              <div className="dm-tx-head">
                <b>Transcrições para colar</b>
                <small>Pacientes do dia na Demo simples. Copie e cole em &ldquo;Colar texto da transcrição&rdquo; na consulta. Espere ~1 min entre uma geração e outra.</small>
              </div>
              <ul className="dm-tx-list">
                {DEMO_TRANSCRICOES.map((t, i) => (
                  <li key={t.paciente} className="dm-tx-row">
                    <span className="dm-tx-hora">{t.hora}</span>
                    <span className="dm-tx-body">
                      <span className="dm-tx-nome">{t.paciente}</span>
                      <span className="dm-tx-sub">{t.mostra}</span>
                    </span>
                    <button
                      type="button"
                      className={`dm-tx-copy${demoCopied === i ? " dm-tx-copy-on" : ""}`}
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(t.texto);
                        } catch {
                          // Fallback quando a API de clipboard é negada (ex.: navegador sem permissão).
                          const ta = document.createElement("textarea");
                          ta.value = t.texto;
                          ta.style.position = "fixed";
                          ta.style.opacity = "0";
                          document.body.appendChild(ta);
                          ta.select();
                          const ok = document.execCommand("copy");
                          ta.remove();
                          if (!ok) return;
                        }
                        setDemoCopied(i);
                        setTimeout(() => setDemoCopied((c) => (c === i ? null : c)), 1800);
                      }}
                    >
                      {demoCopied === i ? "Copiado ✓" : "Copiar"}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
            <p className="p-confirm-text" style={{ marginTop: 16 }}>
              <strong>Atenção:</strong> isso substitui todos os dados locais atuais deste navegador.
            </p>
            <div className="p-confirm-actions" style={{ flexWrap: "wrap" }}>
              <Button variant="secondary" size="sm" onClick={() => setDemoOpen(false)}>Cancelar</Button>
              {demoActive && (
                <Button
                  variant="secondary" size="sm"
                  onClick={() => { clearAllLocalData(); window.location.reload(); }}
                >
                  Limpar tudo
                </Button>
              )}
              <Button
                variant="primary" size="sm"
                onClick={() => { loadDemoData(demoMode, demoRef); window.location.reload(); }}
              >
                {demoActive ? "Recarregar dados demo" : "Carregar dados demo"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

}
