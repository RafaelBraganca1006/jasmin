# 🌸 Jasmin

**The first dental ERP where the dentist never types.**
**Voice in. Clean records out. Insurance claim ready.**

![Next.js 15](https://img.shields.io/badge/Next.js-15-black?style=flat-square&logo=next.js&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6?style=flat-square&logo=typescript&logoColor=white)
![Groq](https://img.shields.io/badge/AI-Groq-F55036?style=flat-square&logo=groq&logoColor=white)
![LangGraph](https://img.shields.io/badge/Agents-LangGraph-1C3C3C?style=flat-square)
![Vercel](https://img.shields.io/badge/Deploy-Vercel-000000?style=flat-square&logo=vercel&logoColor=white)
![LGPD](https://img.shields.io/badge/LGPD-Compliant-2E7D32?style=flat-square)

<!-- SCREENSHOT: main /consulta screen — agenda view with the Jasmin Assistant panel open -->

---

## 🦷 The Problem

A dentist sees patient after patient, and after every single one, the same ritual repeats: open the desktop system, click through half a dozen screens, type up the *anamnese* (the clinical interview — complaints, history, allergies), describe the exam, pick a diagnostic code, write the treatment plan, fill the *odontograma* (the tooth-by-tooth chart). Studies on dental practice management put this at **up to 40% of the working day** spent clicking and typing instead of treating patients.

It gets worse at the end of the month. Clinics that work with *convênios* (private health insurance plans) submit *guias* (claim forms) for reimbursement — and a meaningful share comes back denied. *Glosas* (claim denials / payment rejections issued by the insurer) are estimated to cost clinics **10–17% of monthly revenue**. The reason is almost always mechanical: the wrong TUSS procedure code, a CID-10 diagnosis that doesn't match the procedure, a missing X-ray, no prior authorization on file. None of this is a knowledge problem — every dentist knows what an X-ray confirmation is for. It's a documentation problem that compounds, silently, until the bill doesn't get paid.

Existing systems don't close this loop. *Clinicorp*, *Dental Office* and similar platforms digitize the form — they don't remove the burden of filling it in, and they stop well before the billing step where the money is actually won or lost.

> *"The dentist already speaks the findings out loud. The bottleneck is not knowledge — it's the absence of a system that listens, understands clinical Portuguese, and translates speech into compliant records and billing documents."*

That system is Jasmin.

---

## ⚙️ How It Works

1. **Dentist records the consultation** via microphone — or pastes/uploads an existing transcript directly.
2. **Groq Whisper transcribes the audio** in 60-second batches as the consultation happens — the live transcript builds up on screen, chunk by chunk.
3. **A 5-step sequential agent structures the clinical record** the moment recording stops: *anamnese* → clinical exam & *odontograma* → CID-10 diagnosis → treatment plan → gap review.
4. **The dentist reviews the pre-filled record** — edits any field inline, checks *Linked Evidence* to verify each finding against the original transcript, and approves it with a digital signature.
5. **The record persists** as both JSON (`ProntuarioModel`, consumed by AI agents and the UI) and Markdown (a deterministic render, ready for the billing agent) — keyed to the specific appointment, entirely in the browser.
6. **Jasmin Assistant answers questions about the patient**, the agenda, or any saved record — using real data and citing its sources.
7. **[Coming next] A billing agent reads the `.md` record**, maps the procedures to TUSS codes, checks the patient's insurance rules, and generates the TISS claim form — ready to submit.

---

## 🏗️ Architecture

Jasmin is organized in five layers, each with a single responsibility and a clean handoff to the next:

1. **Capture** — microphone → chunked audio → live Whisper transcription
2. **Structuring** — the 5-step sequential agent turns raw transcript into a validated `ProntuarioModel`
3. **Review** — Linked Evidence, the Step-5 gap reviewer, and the dentist's approval/signature
4. **Persistence** — `localStorage`, JSON + Markdown, LGPD-first (no database, ever)
5. **Interaction & Billing** — the Jasmin Assistant (conversational layer) and the upcoming billing agent, both consuming the persisted record

### Platform Overview
<!-- DIAGRAM: jasmin_overview.png -->
_Full platform architecture — from audio capture in the browser to the insurance claim leaving the clinic._

### Prontuário Agent — Internal Flow
<!-- DIAGRAM: prontuario_agent_flow.png -->
_The 5-step sequential chain inside `lib/prontuario-agent.ts`, with normalization and validation gates between every step._

### Component Architecture
<!-- DIAGRAM: component_architecture.png -->
_Every module in `app/` and `lib/` and how they depend on each other — from the recording UI down to the storage layer._

### Data Schema
<!-- DIAGRAM: data_schema.png -->
_`ProntuarioModel` and its sub-types (`AnamneseModel`, `ExameModel`, `DiagnosticoModel`, `PlanoModel`, `AlertasModel`) and how each agent step populates them._

### Billing Agent — Decision Flow
<!-- DIAGRAM: billing_decision_flow.png -->
_The planned RAG-powered pipeline that maps procedures to TUSS codes and checks per-insurer rules before generating a TISS claim._

---

## 🧠 AI Pipeline in Depth

### Transcription

Audio is captured with `MediaRecorder` and flushed in **60-second batches** (`lib/transcribe.ts` + `app/api/transcribe/route.ts`) to **Groq `whisper-large-v3`**, set to Portuguese with a domain-specific prompt ("Transcrição de uma consulta odontológica em português do Brasil"). Each batch is converted to a `Buffer` and re-wrapped with `toFile()` before reaching the SDK — passing the browser `File` straight through in the Node runtime occasionally produced empty uploads that made Whisper hallucinate captions over silence. Each returned chunk is appended to a live transcript shown on screen while the consultation is still running, so the dentist sees the system listening in real time.

### Prontuário Agent (5-step sequential chain)

The heart of Jasmin is `lib/prontuario-agent.ts` — five sequential calls to **Groq `llama-3.3-70b-versatile`** in JSON mode, each with a specialized system prompt, each step's output feeding the next:

- **Step 1 — Anamnese extraction.** Input: raw transcript (+ patient record, if known). Output: `queixa_principal`, `historico_medico`, `medicamentos[]`, `alergias[]`, `habitos`, `comorbidades` — with an explicit LGPD instruction to replace any name, CPF, phone or address with `[REMOVIDO]` before it ever reaches the model's output.
- **Step 2 — Clinical exam + odontograma.** Input: transcript + radiology report (if any). Output: extraoral/intraoral/periodontal/occlusal findings plus an `odontograma` array of `{ elemento, status, observacao }` — tooth numbers always in **FDI notation** (e.g. `46`, `11`).
- **Step 3 — CID-10 mapping.** Input: the structured exam + radiology report. The system prompt embeds a **17-code lookup table for the K00–K14 dental range directly in the prompt** — small enough to fit, so no RAG is needed here. The model picks one principal diagnosis; a regex whitelist (`/^K(0\d|1[0-4])\.\d$/`) then strips out anything the model invents outside that range before it ever reaches the record.
- **Step 4 — Treatment plan + evolution.** Input: transcript + structured exam + diagnosis. Output: `procedimentos[]`, `materiais`, `anestesia`, `pos_operatorio`, `proxima_consulta`. The prompt explicitly instructs the model to **translate colloquial dictation into clinical register** — *"vou remover a cárie e fazer uma obturação"* becomes *"Remoção de tecido cariado e restauração direta"* — with concrete before/after examples baked into the system prompt.
- **Step 5 — Gap reviewer.** Input: the full structured record + the patient's concatenated previous records (`historicoMd`). Output: `gaps[]`, `alertas_clinicos[]`, `inconsistencias[]`, `requer_confirmacao`. The prompt is deliberately strict — *"NÃO invente alertas para parecer útil"* (do not invent alerts to look useful) — it must report only concrete, verifiable problems, never generic boilerplate warnings.

**Validation, not vibes:** every step runs through `runStep()`, which calls Groq in JSON mode, parses the raw response with a step-specific typed parser (`parseAnamnese`, `parseExame`, `parseDiagnostico`, `parsePlano`, `parseAlertas`), and coerces every field through `str`/`arr`/`bool`/`optStr` normalization helpers — nothing reaches the UI unshaped. If a step throws or returns malformed JSON, `runStep` returns `{ ok: false, data: <empty default>, erro }`; the orchestrator (`gerarProntuario`) logs the failure to a `falhasParciais[]` array and **keeps going** with the next step. The pipeline never stops on a partial failure — it always returns a complete `ProntuarioModel`, with `assinatura_pendente: true` and `alertas.requer_confirmacao` forced to `true` whenever anything went wrong, guaranteeing a human reviews the gaps before the record is approved.

### Linked Evidence System

Every clinical field comes back from the agent with `evidencias` — up to three fragments (4–12 words) **copied verbatim** from the transcript that justify that specific finding. `ProntuarioView.tsx` renders a "*N fontes*" ("N sources") button next to each field; clicking it opens an evidence panel and highlights the exact quoted spans inside the transcript via a custom `HighlightedTranscript` component. To make the matching robust against accents, casing, and line-wrapping differences between the quote and the source text, `buildNorm`/`normQuote` normalize both sides (stripping diacritics, collapsing whitespace), locate the match in the normalized string, and remap the indices back to the original character offsets before rendering the `<mark>`. The result: **like Git blame, but for clinical findings** — click a field, see exactly which words the dentist said that produced it.

### Jasmin Assistant (LangGraph)

A stateful conversational agent built with **LangGraph** (`lib/jasmin-graph.ts`): a `StateGraph` with two nodes — `agent` (a `ChatGroq` model bound to five tools) and `tools` (a `ToolNode`) — looping `agent → tools → agent` until the model stops calling functions. Its state tracks the message history, the active context markdown, the dentist's name, and today's date.

- **Context chips.** The dentist toggles "selection mode" (`ContextSelector.tsx`), which intercepts clicks on any element tagged `data-jasmin-context` — a patient row, a consultation card, an odontogram, the day's agenda — and turns it into a markdown chip (`chat-context-builders.ts`) injected straight into the system prompt. The selected context is always treated as the primary source of truth, ahead of any tool call.
- **Five tools** (`lib/chat-tools.ts`): `search_patients`, `get_consultas_hoje`, `get_historico_paciente`, `get_proxima_consulta`, and `consultar_interacoes_medicamentosas` — each closing over a `StorageSnapshot` rebuilt on every request from the POST body.
- **Storage snapshot, not a database.** `lib/chat-snapshot.ts` builds a privacy-filtered slice of `localStorage` server-side: patients are reduced to `{ id, nome, sobrenome, convenio, status }` — never CPF, phone, e-mail, or address — and clinical records pass through already anonymized by the *prontuário* agent. The system prompt enforces a hard rule: every name, diagnosis, tooth, procedure, or appointment must come from a real tool result or a selected chip — **never a "plausible-sounding" guess**.
- **Streaming with a tool trace.** `/api/chat` streams raw text interleaved with inline markers (`[[TOOL_START:name]]`, `[[TOOL_RESULT:name|summary]]`, `[[RESET]]`) that `useChatStream.ts` parses into a live trace of what the assistant is doing. If the model fails to call a function or returns an empty final turn, the route silently falls back to a tool-less completion that **reuses the tool outputs already fetched** — the dentist always gets an answer, never a blank screen.

### Billing Agent (Coming Next)

The next layer closes the loop the rest of the market leaves open. The plan: **RAG over ~393 dental TUSS procedures**, filtered from the public ANS dataset (March 2024 release), indexed in a local **ChromaDB**. Retrieval is hybrid — semantic search surfaces the top-3 candidate codes, and a deterministic lookup table validates the exact match (the same "never guess" philosophy as the CID-10 step). On top of that, a **6-node LangGraph**: `Parser → TUSS Mapper → CID Validator → Rules Checker → Guia Builder → Output`. The *Cobranças* tab (`app/consulta/components/Cobrancas.tsx`) already lists every consultation that has a saved *prontuário* and is waiting on a claim — it's the placeholder this pipeline will plug straight into.

---

## 🎯 Mapped Challenges and Solutions

**Challenge 1: Clinical Language Is Ambiguous**
*Problem:* "*fiz o canal do 36*" ("I did a root canal on tooth 36") — but which exact TUSS code? Single-rooted, two-rooted, or multi-rooted endodontic treatment?
*Solution:* Hybrid TUSS retrieval (planned) — semantic RAG surfaces the top-3 candidates, a deterministic lookup table validates the exact code. The system never guesses; it narrows down and confirms.

**Challenge 2: Every Insurance Plan Has Different Rules**
*Problem:* Unimed requires prior authorization for root canals. Amil rejects claims for wrong codes. Bradesco demands before-and-after X-rays. No dentist memorizes all of this.
*Solution:* A per-*convênio* knowledge base in ChromaDB (planned) — the billing agent fetches the specific insurer's rules and applies them before the claim is generated, instead of relying on the dentist's memory.

**Challenge 3: Patient Data Cannot Leave the Browser**
*Problem:* LGPD compliance for clinical records is non-negotiable — no database, no cloud storage of patient data, full stop.
*Solution:* A `localStorage`-first architecture (`lib/prontuario-storage.ts`). When AI agents need clinic data, they receive a **privacy-filtered snapshot** in the POST body (`lib/chat-snapshot.ts`) — processed ephemerally on the server and never persisted there.

**Challenge 4: LLM Hallucination in a Clinical Context**
*Problem:* A hallucinated CID-10 code or TUSS code isn't a cosmetic bug — it's a real *glosa*, a real financial loss.
*Solution:* Every step of the *prontuário* agent runs through typed parsers and normalization helpers (`str`/`arr`/`bool`/`optStr` in `lib/prontuario-agent.ts`) that coerce raw model output into the exact `ProntuarioModel` shape — nothing reaches the UI unshaped. CID-10 codes are checked against a regex whitelist for the K00–K14 range and silently discarded if out of bounds; the planned billing agent will validate TUSS codes the same way, against the official ANS table. Gaps are flagged explicitly by the Step-5 reviewer — never silently wrong.

**Challenge 5: The Dentist Is Not a Typist**
*Problem:* Existing ERPs require manual data entry after every single consultation — exactly when the dentist is most cognitively depleted.
*Solution:* A voice-first interface. The dentist speaks during the consultation; Jasmin listens, transcribes, and structures. The only required interaction afterward is reviewing and approving the pre-filled record.

---

## 👥 User Feedback Incorporated

### Built With Real Users

Jasmin was designed in close collaboration with a practicing dentist from São Paulo state, working in the public health system (SUS). User feedback shaped every major product decision.

| Feedback | What we built |
|---|---|
| *"I never remember which TUSS code to use for each procedure — I just want to describe what I did."* | Natural language → TUSS mapping via RAG (planned for the billing agent). The dentist describes, the system codes. |
| *"I get glosas every month for the same reasons — missing X-ray, wrong CID, forgot authorization. It's always the same mistakes."* | The Step-5 gap reviewer (`SYS_ALERTAS` in `lib/prontuario-agent.ts`) explicitly checks for missing fields, clinical risks, and inconsistencies before the record is approved — catching the recurring causes of *glosa* before the claim is even generated. |
| *"I can't use a system that sends my patients' data to some server I don't control."* | A `localStorage`-first architecture. Clinical data never leaves the browser as a record — only ephemeral, privacy-filtered snapshots reach the AI for processing. LGPD by design, not by policy. |
| *"Sometimes I need to check what I said about a patient three months ago. I have to dig through paper notes."* | The Jasmin Assistant — ask in natural language, get answers sourced from past records, always with the consultation date cited as the source. |
| *"The record needs to follow CFO rules exactly, or it has no legal value."* | The *prontuário* agent's five steps map onto the mandatory fields of *Resolução CFO 174/92* — *anamnese*, exam, diagnosis, treatment plan, evolution. Missing fields are flagged by the gap reviewer, never silently skipped. |

> User feedback is ongoing. The billing agent roadmap is directly informed by the most common *glosa* causes reported by the clinic.

---

## 🛠️ Tech Stack

| Layer | Technology | Why |
|---|---|---|
| Framework | Next.js 15 (App Router) + TypeScript | File-based routing, SSR-safe hydration, edge middleware for the auth gate |
| Transcription | Groq `whisper-large-v3` | Fast, accurate PT-BR speech-to-text, generous free tier |
| Clinical Agent | Groq `llama-3.3-70b-versatile` (JSON mode) | Quality-to-cost balance for a 5-call sequential chain |
| Chat Agent | LangGraph + Groq `llama-3.3-70b-versatile` | Stateful, tool-calling conversation loop with streaming |
| Persistence | Browser `localStorage` | LGPD by design — no clinical database, ever |
| Styling | Global CSS (`app/globals.css`) — no Tailwind | Zero dependency, full control over the design system |
| Auth | Single-password gate, SHA-256 session cookie | Simple enough for a single-clinic deployment, enforced at the edge |
| Deploy | Vercel | Zero-config, serverless functions for the AI routes |
| Billing Knowledge Base *(planned)* | ChromaDB + public ANS TUSS dataset | ~393 dental procedures, free, runs locally |

---

## 📁 Project Structure

```
jasmin/
├── app/
│   ├── page.tsx                       # Public landing page
│   ├── layout.tsx
│   ├── globals.css                    # All styling — no Tailwind
│   ├── login/
│   │   └── page.tsx                   # Password-gate login screen
│   ├── consulta/                      # Main app — everything behind auth
│   │   ├── layout.tsx                 # Wraps the app in <ChatProvider> + <JasminChat>
│   │   ├── page.tsx                   # ConsultaPage — agenda, patients & consultation UI (~1.7k lines)
│   │   └── components/
│   │       ├── FichaClinica.tsx       # Patient clinical-chart tab (editable identity + merged history)
│   │       ├── Odontograma.tsx        # 32-tooth SVG odontogram, 5 clickable surfaces per tooth
│   │       └── Cobrancas.tsx          # Billing tab — lists consultations awaiting TISS claims
│   ├── components/
│   │   ├── ProntuarioView.tsx         # Structured record viewer/editor + Linked Evidence highlighter
│   │   ├── ComoFunciona.tsx           # Landing page — "How it works" section
│   │   ├── Contato.tsx                # Landing page — contact section
│   │   ├── Footer.tsx
│   │   └── chat/                      # Jasmin Assistant UI
│   │       ├── JasminChat.tsx         # Entry point — floating button + panel + context selector
│   │       ├── ChatPanel.tsx          # Slide-in panel shell (open/maximize/drag)
│   │       ├── ChatMessages.tsx       # Message list — markdown rendering + tool traces
│   │       ├── ChatInput.tsx          # Composer, attachments, context-selector toggle
│   │       ├── ChatHistory.tsx        # Multi-conversation sidebar
│   │       ├── ChatChips.tsx          # Selected-context chip pills
│   │       ├── ContextSelector.tsx    # "Click anything to add to context" capture mode
│   │       ├── useChatStream.ts       # Streaming hook — parses [[TOOL_*]] / [[RESET]] markers
│   │       └── markdown.ts            # Minimal markdown → HTML renderer for chat bubbles
│   └── api/
│       ├── login/route.ts             # POST — verifies password, sets the session cookie
│       ├── transcribe/route.ts        # POST — audio chunk → text (Whisper)
│       ├── prontuario/route.ts        # POST — transcript → ProntuarioModel (5-step pipeline)
│       ├── chat/route.ts              # POST — Jasmin Assistant turn (LangGraph, streamed)
│       ├── soap/route.ts              # POST — legacy transcript → SOAP record
│       └── process/route.ts           # POST — legacy audio → transcript + SOAP, one-shot
├── lib/
│   ├── groq.ts                        # Shared Groq client + centralized model IDs
│   ├── transcribe.ts                  # Whisper wrapper — buffer conversion, validation
│   ├── prontuario-agent.ts            # The 5-step sequential agent — the heart of Jasmin
│   ├── prontuario-markdown.ts         # Deterministic ProntuarioModel → Markdown renderer
│   ├── prontuario-storage.ts          # localStorage persistence + per-patient aggregations
│   ├── jasmin-graph.ts                # LangGraph state graph for the Jasmin Assistant
│   ├── chat-tools.ts                  # The assistant's 5 tools
│   ├── chat-context.tsx               # React context — conversations, chips, panel state
│   ├── chat-context-builders.ts       # Builds chip markdown from patient/consultation/odontogram data
│   ├── chat-snapshot.ts               # Builds the privacy-filtered snapshot sent to /api/chat
│   ├── drug-interactions.ts           # Static lookup table — dental-relevant drug interactions
│   ├── extract-document.ts            # Client-side PDF/text extraction for chat attachments
│   ├── auth.ts                        # SHA-256 session-token generation
│   ├── structure.ts                   # Legacy single-shot SOAP structuring (superseded by prontuario-agent)
│   ├── types.ts                       # Legacy ProntuarioSOAP types
│   ├── types-jasmin.ts                # PatientData / AgAppointment — exact localStorage shape
│   └── types-prontuario.ts            # ProntuarioModel and every clinical sub-type
├── middleware.ts                      # Edge middleware — password gate for /consulta and AI routes
├── samples/                           # Sample transcripts for pipeline testing
└── scripts/                           # npm run test:prontuario / test:soap — pipeline smoke tests
```

---

## 🚀 Getting Started

### Prerequisites
- Node.js 20+
- A free [Groq API key](https://console.groq.com/keys)

### Installation

```bash
git clone <repo-url>
cd jasmin
npm install
```

### Environment variables

Copy `.env.example` to `.env.local` and fill in:

```bash
GROQ_API_KEY=your_groq_key        # required — powers transcription, structuring and chat
APP_PASSWORD=your_access_password # optional in dev — without it, the app stays open
```

### Run

```bash
npm run dev
# → http://localhost:3000
```

> **No database required.** All patient and clinical data is stored locally in the browser via `localStorage` — by design, for LGPD compliance. AI calls are the only data that briefly leaves the device, and they are never persisted server-side.

### Pipeline smoke tests

```bash
npm run test:prontuario   # runs a sample transcript through the 5-step agent
npm run test:soap         # runs the legacy SOAP structuring pipeline
```

---

## 🗺️ Roadmap

| Priority | Feature | Status |
|---|---|---|
| P0 | Voice → structured *prontuário* (5-step agent pipeline, persisted per appointment) | ✅ Done |
| P0 | Deploy to Vercel + real-world test with a practicing dentist | ✅ Done |
| P0 | *Ficha Clínica*, *Odontograma* (32-tooth SVG) and *Cobranças* tabs | ✅ Done |
| P0 | Jasmin Assistant — conversational agent with context chips (LangGraph) | ✅ Done |
| P1 | Editable dentist identity (currently hardcoded as "Dr. Usuário") | 🔄 In progress |
| P1 | Edit / delete appointments and patients | 🔄 In progress |
| P2 | Billing agent — TUSS RAG + TISS claim generation | 📋 Planned |
| P2 | *Financeiro* (financial dashboard) | 📋 Planned |
| P3 | Chrome extension — direct injection into SissOnline (Phase 2) | 📋 Planned |
| P3 | WhatsApp integration for schedule queries | 📋 Planned |
