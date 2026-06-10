# 🌸 Jasmin

**AI-native Platform for Brazilian Dentists.**

![Next.js 15](https://img.shields.io/badge/Next.js-15-black?style=flat-square&logo=next.js&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6?style=flat-square&logo=typescript&logoColor=white)
![Groq](https://img.shields.io/badge/AI-Groq-F55036?style=flat-square&logo=groq&logoColor=white)
![LangGraph](https://img.shields.io/badge/Agents-LangGraph-1C3C3C?style=flat-square)
![Vercel](https://img.shields.io/badge/Deploy-Vercel-000000?style=flat-square&logo=vercel&logoColor=white)

<!-- SCREENSHOT: main /consulta screen — agenda view with the Jasmin Assistant panel open -->

---

## 🦷 The Problem

A dentist sees patient after patient, and after every single one, the same ritual repeats: open the desktop system, click through half a dozen screens, type up the *anamnese* (the clinical interview — complaints, history, allergies), describe the exam, pick a diagnostic code, write the treatment plan, fill the *odontograma* (the tooth-by-tooth chart). Studies on dental practice management put this at **up to 40% of the working day** spent clicking and typing instead of treating patients.

It gets worse at the end of the month. Clinics that work with *convênios* (private health insurance plans) submit *guias* (claim forms) for reimbursement and a meaningful share comes back denied. *Glosas* (claim denials / payment rejections issued by the insurer) are estimated to cost clinics **10–17% of monthly revenue**. The reason is almost always mechanical: the wrong TUSS procedure code, a CID-10 diagnosis that doesn't match the procedure, a missing X-ray, no prior authorization on file. None of this is a knowledge problem. Every dentist knows what an X-ray confirmation is for. It's a documentation problem that compounds, silently, until the bill doesn't get paid.

Existing systems don't close this loop. *Clinicorp*, *Dental Office* and similar platforms digitize the form, they don't remove the burden of filling it in, and they stop well before the billing step where the money is actually won or lost.

> *"The dentist already speaks the findings out loud. The bottleneck is not knowledge — it's the absence of a system that listens, understands clinical Portuguese, and translates speech into compliant records and billing documents."*

That system is Jasmin.

---

## ⚙️ How It Works

1. **Dentist records the consultation** via microphone — or pastes/uploads an existing transcript directly.
2. **Groq Whisper transcribes the audio** in 60-second batches as the consultation happens — the live transcript builds up on screen, chunk by chunk (allowing for longer consultations).
3. **A 5-step sequential agent structures the clinical record** the moment recording stops: *anamnese* → clinical exam & *odontograma* → CID-10 diagnosis → treatment plan → gap review.
4. **The dentist reviews the pre-filled record** — edits any field inline if needed, can check *Linked Evidence* to verify each finding against the original transcript, and approves it with a digital signature.
5. **The record persists** as both JSON (`ProntuarioModel`, for the UI) and Markdown (a deterministic render, consumed by AI agents) — keyed to the specific appointment, entirely in the browser.
6. **Jasmin Assistant answers questions about the patient**, the agenda, or any saved record — using real data and citing its sources.
7. **A billing agent reads the structured record**, takes the billable procedures already consolidated in Step 4 (or maps them via RAG for older records), checks prior-authorization and documentation rules, flags *glosa* risks as actionable alerts, and generates the TISS claim form — ready to submit.

---

## 🏗️ Architecture

Jasmin is organized in five layers, each with a single responsibility and a clean handoff to the next:

1. **Capture** — microphone → chunked audio → live Whisper transcription
2. **Structuring** — the 5-step sequential agent turns raw transcript into a validated `ProntuarioModel`
3. **Review** — Linked Evidence, the Step-5 gap reviewer, and the dentist's approval/signature
4. **Persistence** — `localStorage`, JSON + Markdown, privacy-first (no external database; AI calls are ephemeral)
5. **Interaction & Billing** — the Jasmin Assistant (conversational layer) and the billing agent (4-node TypeScript pipeline + local RAG), both consuming the persisted record

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
_The 4-node TypeScript pipeline (`Parser → TUSS Mapper → Rules Checker → Guia Builder`) that takes the billable procedures from Step 4, falls back to RAG when needed, checks per-insurer rules, and flags glosa risks as alerts before generating a TISS claim._

---

## 🧠 AI Pipeline in Depth

### Transcription

Audio is captured with `MediaRecorder` and flushed in **60-second batches** (`lib/transcribe.ts` + `app/api/transcribe/route.ts`) to **Groq `whisper-large-v3`**, set to Portuguese with a domain-specific prompt ("Transcrição de uma consulta odontológica em português do Brasil"). Each batch is converted to a `Buffer` and re-wrapped with `toFile()` before reaching the SDK — passing the browser `File` straight through in the Node runtime occasionally produced empty uploads that made Whisper hallucinate captions over silence. Each returned chunk is appended to a live transcript shown on screen while the consultation is still running, so the dentist sees the system listening in real time.

### Prontuário Agent (5-step sequential chain)

The heart of Jasmin is `lib/prontuario-agent.ts` — five sequential calls to **Groq `llama-3.3-70b-versatile`** in JSON mode, each with a specialized system prompt, each step's output feeding the next:

- **Step 1 — Anamnese extraction.** Input: raw transcript (+ patient record, if known). Output: `queixa_principal`, `historico_medico`, `medicamentos[]`, `alergias[]`, `habitos`, `comorbidades` — with an explicit instruction to replace any name, CPF, phone or address with `[REMOVIDO]` before it ever reaches the model's output.
- **Step 2 — Clinical exam + odontograma.** Input: transcript + radiology report (if any). Output: extraoral/intraoral/periodontal/occlusal findings plus an `odontograma` array of `{ elemento, status, observacao }` — tooth numbers always in **FDI notation** (e.g. `46`, `11`).
- **Step 3 — CID-10 mapping.** Input: the structured exam + radiology report. The system prompt embeds a **17-code lookup table for the K00–K14 dental range directly in the prompt** — small enough to fit, so no RAG is needed here. The model picks one principal diagnosis; a regex whitelist (`/^K(0\d|1[0-4])\.\d$/`) then strips out anything the model invents outside that range before it ever reaches the record.
- **Step 4 — Treatment plan + billing consolidation.** Input: transcript + structured exam + diagnosis + the diagnosed tooth (FDI). This step does **two jobs in one call**. *Part A — clinical documentation:* it captures everything performed, in clinical register (`procedimentos_realizados[]`, `materiais`, `anestesia`, `pos_operatorio`, `proxima_consulta`), translating colloquial dictation into proper terminology — *"vou remover a cárie e fazer uma obturação"* becomes *"Remoção de tecido cariado e restauração direta"*. *Part B — billing consolidation:* with the **full vigente TUSS table embedded in the prompt** (`lib/tuss-data.ts`), it rolls the raw technical steps up into the actual **billable** procedures (`procedimentos_faturaveis[]`). This is the key insight of the whole flow: a root canal is dictated as five technical steps — *abertura coronária, localização dos canais, preparo químico-mecânico, pasta de hidróxido, fechamento com Coltosol* — but those aren't five line items on a claim; they're **one** endodontic code (e.g. `85200158`, multi-rooted) that *includes* those steps, plus a separately-billable curative and X-ray. The model picks the code by tooth root-count, lists which technical steps each billable item absorbs (`inclui_etapas`), and marks `requer_revisao: true` rather than ever inventing a code it can't find (a defensive guard re-checks every returned code against the real table). The billing agent then consumes `procedimentos_faturaveis` directly — see [Billing Agent](#billing-agent).
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

### Billing Agent

The layer that closes the loop the rest of the market leaves open. From the *Cobranças* tab (`app/consulta/components/Cobrancas.tsx`), the dentist generates a TISS *guia* (SP/SADT claim form) for any consultation that has a saved *prontuário*. The request hits `POST /api/cobranca` with the same privacy-filtered `storageSnapshot` used by the chat — and the route **streams the agent's reasoning back over SSE**, so the dentist watches each lookup happen live before the finished guia appears.

The agent itself (`lib/cobranca-agent.ts`) is **4 sequential nodes in plain TypeScript** — no LangGraph, no framework. Each node is wrapped in its own `try/catch`: a node that fails leaves its field incomplete, adds an alert, and the pipeline **keeps going** — it always returns a `GuiaSPSADT`.

1. **Parser** (Groq Llama, JSON mode) — reads the record and extracts the billing facts: *convênio*, CID, date, clinical indication. Crucially, when the record was produced by the current *prontuário* agent it also carries `procedimentos_faturaveis` — the billable items **already consolidated in Step 4** — and the parser passes them straight through.
2. **TUSS Mapper** — the heart of the "never guess" philosophy, now with two paths:
   - **Consolidated path (`fonte: "prontuario"`):** if Step 4 already mapped a billable item to a confident TUSS code, the mapper uses it **directly** — official description pulled from `TUSS_INDEX`, no RAG call. This is the most trustworthy source, because the consolidation happened with the full TUSS table in the model's context and the dentist reviewed it.
   - **RAG fallback:** items Step 4 flagged as `MANUAL`/needs-review — and *every* procedure from older records that predate consolidation — go through the RAG: `searchTuss` returns the top-3 candidate codes, Groq picks the single best one **from those candidates only** (never invents a code), and anything below a confidence threshold is flagged `manual` for human review.
3. **Rules Checker (RAG)** — for each code, queries the `dental_rules` collection for **prior-authorization** requirements and **mandatory documentation**; flags a missing X-ray, and always raises a reminder that the specific insurer's proprietary rules aren't in the public bases and must be confirmed with the *convênio*.
4. **Guia Builder** — assembles the final `GuiaSPSADT`: provider + beneficiary data, the mapped procedures, diagnosis, the accumulated *glosa* alerts, and the required-documentation checklist.

Each procedure on the guia is tagged with its **source**, shown as a colored badge: `prontuario` (green ✓ — consolidated by the agent), `rag` (purple 🔍 — mapped via retrieval), `lookup` (gray — static table), `manual` (yellow ⚠ — needs review). Because Step 4 now does the heavy lifting, most procedures arrive as `prontuario` and the RAG is reserved for fallback — which is exactly what drives the *glosa* alert count down.

The agent surfaces risk as **informational alerts** (`alertas_glosa` — critical / attention / info, each with a recommended action), never as a single opaque risk number. An earlier version computed a 0–100 *glosa* score; it was removed because a synthetic score hides *why* a claim is risky behind a number the dentist can't act on — the explicit alerts ("missing X-ray", "confirm authorization with the insurer") are what actually prevent a denial.

> **A deliberate omission — CID × TUSS validation.** An earlier design had a node that checked whether the diagnosis "matched" the procedure. We removed it. There is **no authoritative public source** that maps CID-10 to TUSS for dentistry — any such table would be hand- or LLM-authored and therefore *unverified*, and a wrong "incompatible" verdict is worse than silence: it would flag a legitimate claim and scare the dentist off it. Compatibility belongs to a future RAG step backed by a real clinical source, not to invented data.

### How the RAG works

The billing agent's retrieval runs as a **separate local Python service** — no cloud, no API key, fully offline:

- **`scripts/index_knowledge_base.py`** indexes everything in `knowledge_base/` into a local **ChromaDB** (embeddings via `sentence-transformers`). It produces **two collections**: `tuss_procedures` (one chunk per procedure row, with `codigo_tuss` in the metadata so the server can do an *exact* lookup by code — vector search is unreliable on alphanumeric codes) and `dental_rules` (text chunks from the ANS RN-465 / *Rol* and the insurer rule PDFs).
- **`scripts/rag_server.py`** exposes that ChromaDB over HTTP on `localhost:8001` (`/search/tuss`, `/search/rules`, `/health`).
- **`lib/cobranca-knowledge/rag-retriever.ts`** is the TypeScript client the agent calls (`searchTuss`, `searchRules`, `checkAutorizacaoPrevia`, `checkDocumentacaoObrigatoria`). **If the server is unreachable it falls back to a static lookup table** (`lib/cobranca-knowledge/tuss-lookup.ts`) — billing still works, just with less coverage and confidence.

**Two different "TUSS tables", on purpose.** Don't confuse the RAG with the table the *prontuário* agent uses. Step 4 of the *prontuário* consolidates billable items using the **full TUSS table injected directly into the prompt** — a static module (`lib/tuss-data.ts`) generated at build time from the XLSX by `scripts/gen_tuss_context.py` (`npm run gen:tuss`), so it's read once and never hits the disk per request. The **RAG** (ChromaDB) is what the *billing* agent uses for code *search* and *rule* lookup. The first is in-context reasoning over a known table; the second is semantic retrieval over documents.

---

## 🎯 Mapped Challenges and Solutions

**Challenge 1: Clinical Language Is Ambiguous**
*Problem:* "*fiz o canal do 36*" ("I did a root canal on tooth 36") — but which exact TUSS code? Single-rooted, two-rooted, or multi-rooted endodontic treatment? And the dentist dictates the *steps* of the canal, not the billable code.
*Solution:* Two-stage grounding. Step 4 of the *prontuário* agent consolidates the dictated technical steps into billable codes using the full TUSS table in-context, choosing by tooth root-count (a molar like 36 → multi-rooted). The billing agent then trusts that code directly, or — for anything uncertain — falls back to **hybrid TUSS retrieval**: semantic RAG surfaces the top-3 candidates and the model confirms one. The system never guesses; it narrows down and confirms.

**Challenge 2: Every Insurance Plan Has Different Rules**
*Problem:* Unimed requires prior authorization for root canals. Amil rejects claims for wrong codes. Bradesco demands before-and-after X-rays. No dentist memorizes all of this.
*Solution:* The billing agent's Rules Checker queries the indexed ANS/legislation bases (ChromaDB `dental_rules`) for prior-authorization and required-documentation rules per code. Proprietary per-insurer rules aren't in any public dataset, so rather than fake them, the agent **explicitly flags** that the specific *convênio*'s rules must be confirmed — honest about the boundary instead of guessing past it.

**Challenge 3: Clinical Records Stay Local; AI Processing Is Ephemeral**
*Problem:* Clinical records must never be stored in an external database — the dentist owns the data. But audio transcriptions and clinical text are processed by Groq's API (servers located outside Brazil), so there is an important distinction between what is protected *at rest* and what travels for processing.
*Solution:* A `localStorage`-first architecture (`lib/prontuario-storage.ts`) — clinical records stay in the dentist's browser and are never written to an external database. When AI agents need clinic data, they receive a **privacy-filtered snapshot** in the POST body (`lib/chat-snapshot.ts`) — processed ephemerally by the API and never persisted server-side.

**Challenge 4: LLM Hallucination in a Clinical Context**
*Problem:* A hallucinated CID-10 code or TUSS code isn't a cosmetic bug — it's a real *glosa*, a real financial loss.
*Solution:* Every step of the *prontuário* agent runs through typed parsers and normalization helpers (`str`/`arr`/`bool`/`optStr` in `lib/prontuario-agent.ts`) that coerce raw model output into the exact `ProntuarioModel` shape — nothing reaches the UI unshaped. CID-10 codes are checked against a regex whitelist for the K00–K14 range and silently discarded if out of bounds; TUSS codes are validated the same way — Step 4 re-checks every consolidated code against the real vigente table and flags anything it can't confirm for review, and the billing agent only accepts codes from the RAG's actual candidates. Gaps are flagged explicitly by the Step-5 reviewer — never silently wrong.

**Challenge 5: The Dentist Is Not a Typist**
*Problem:* Existing ERPs require manual data entry after every single consultation — exactly when the dentist is most cognitively depleted.
*Solution:* A voice-first interface. The dentist speaks during the consultation; Jasmin listens, transcribes, and structures. The only required interaction afterward is reviewing and approving the pre-filled record.

---

## 👥 User Feedback Incorporated

### Built With Real Users

Jasmin was designed in close collaboration with a practicing dentist from São Paulo state, working in the public health system (SUS). User feedback shaped every major product decision.

| Feedback | What we built |
|---|---|
| *"I never remember which TUSS code to use for each procedure — I just want to describe what I did."* | The dentist describes the steps; Step 4 consolidates them into billable TUSS codes, and the billing agent confirms them (directly or via RAG). The dentist describes, the system codes. |
| *"I get glosas every month for the same reasons — missing X-ray, wrong CID, forgot authorization. It's always the same mistakes."* | The Step-5 gap reviewer (`SYS_ALERTAS` in `lib/prontuario-agent.ts`) explicitly checks for missing fields, clinical risks, and inconsistencies before the record is approved — catching the recurring causes of *glosa* before the claim is even generated. |
| *"I can't use a system that sends my patients' data to some server I don't control."* | A `localStorage`-first architecture. Clinical records never leave the browser at rest — AI processing uses ephemeral, privacy-filtered snapshots that are not persisted server-side. |
| *"Sometimes I need to check what I said about a patient three months ago. I have to dig through paper notes."* | The Jasmin Assistant — ask in natural language, get answers sourced from past records, always with the consultation date cited as the source. |
| *"The record needs to follow CFO rules exactly, or it has no legal value."* | The *prontuário* agent's five steps map onto the mandatory fields of *Resolução CFO 174/92* — *anamnese*, exam, diagnosis, treatment plan, evolution. Missing fields are flagged by the gap reviewer, never silently skipped. |

> User feedback is ongoing. The billing agent roadmap is directly informed by the most common *glosa* causes reported by the clinic.

---

## 🛠️ Tech Stack

| Layer | Technology | Why |
|---|---|---|
| Framework | Next.js 15 (App Router) + TypeScript | File-based routing, SSR-safe hydration, serverless functions for the AI routes |
| Transcription | Groq `whisper-large-v3` | Fast, accurate PT-BR speech-to-text, generous free tier |
| Clinical Agent | Groq `llama-3.3-70b-versatile` (JSON mode) | Quality-to-cost balance for a 5-call sequential chain |
| Chat Agent | LangGraph + Groq `llama-3.3-70b-versatile` | Stateful, tool-calling conversation loop with streaming |
| Persistence | Browser `localStorage` | Records stay in the browser; AI calls are ephemeral and never stored server-side |
| Styling | Global CSS (`app/globals.css`) — no Tailwind | Zero dependency, full control over the design system |
| Deploy | Vercel | Zero-config, serverless functions for the AI routes |
| Billing Agent | TypeScript (4-node pipeline) + Groq Llama | No framework — explicit, debuggable, fails soft node-by-node |
| Billing Knowledge Base | ChromaDB + `sentence-transformers` + public ANS TUSS dataset | ~370 dental procedures, free, runs locally, offline |

---

## 📁 Project Structure

```
jasmin/
├── app/
│   ├── page.tsx                       # Public landing page
│   ├── layout.tsx
│   ├── globals.css                    # All styling — no Tailwind
│   ├── consulta/                      # Main app
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
│       ├── transcribe/route.ts        # POST — audio chunk → text (Whisper)
│       ├── prontuario/route.ts        # POST — transcript → ProntuarioModel (5-step pipeline)
│       ├── cobranca/route.ts          # POST — appointment → TISS guia (billing agent, SSE-streamed)
│       ├── chat/route.ts              # POST — Jasmin Assistant turn (LangGraph, streamed)
│       ├── soap/route.ts              # POST — legacy transcript → SOAP record
│       └── process/route.ts           # POST — legacy audio → transcript + SOAP, one-shot
├── lib/
│   ├── groq.ts                        # Shared Groq client + centralized model IDs
│   ├── transcribe.ts                  # Whisper wrapper — buffer conversion, validation
│   ├── prontuario-agent.ts            # The 5-step sequential agent — the heart of Jasmin
│   ├── prontuario-markdown.ts         # Deterministic ProntuarioModel → Markdown renderer
│   ├── prontuario-storage.ts          # localStorage persistence + per-patient aggregations
│   ├── tuss-data.ts                   # GENERATED — full vigente TUSS table (string + index) for Step 4
│   ├── tuss-context.ts                # Accessors over tuss-data (context string, code lookup)
│   ├── cobranca-agent.ts              # Billing agent — 4-node TISS pipeline (Parser→Mapper→Rules→Builder)
│   ├── cobranca-format.ts             # Pure helpers — guia total, BRL formatting, post-edit alert reconcile
│   ├── cobranca-storage.ts            # localStorage persistence for generated guias
│   ├── prestador-storage.ts           # Clinic/provider data (jasmin_prestador)
│   ├── cobranca-knowledge/
│   │   ├── rag-retriever.ts           # RAG client (searchTuss/searchRules/auth/docs) + static fallback
│   │   └── tuss-lookup.ts             # Static TUSS table — fallback when the RAG server is down
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
│   ├── types-prontuario.ts            # ProntuarioModel and every clinical sub-type
│   └── types-cobranca.ts              # GuiaSPSADT, ProcedimentoGuia, AlertaGlosa, RAG result types
├── knowledge_base/                    # TUSS tables (XLSX) + ANS/insurer rule PDFs — indexed by the RAG
├── samples/                           # Sample transcripts for pipeline testing
└── scripts/
    ├── gen_tuss_context.py            # Builds lib/tuss-data.ts from the TUSS XLSX (npm run gen:tuss)
    ├── index_knowledge_base.py        # Indexes knowledge_base/ into ChromaDB (two collections)
    ├── rag_server.py                  # Local RAG HTTP service (ChromaDB, port 8001)
    ├── test_consolidacao.mjs          # End-to-end test: Step-4 consolidation + billing guia
    └── test-prontuario.mjs            # Smoke test for the 5-step prontuário pipeline
```

---

## 🔒 Privacy & Data

Jasmin takes a thoughtful approach to patient data, with important distinctions between what is protected today and what is required for full compliance in production.

### What the MVP protects

Clinical records (*prontuários*) are stored exclusively in the browser via `localStorage`. No patient data is persisted to any external database or server. The dentist owns the data and it never leaves their device at rest.

### Current limitations

Audio transcriptions and clinical text are processed ephemerally via Groq's API (servers located outside Brazil). Under Brazil's LGPD, health data is classified as sensitive personal data — the highest protection category. Sending this data to external processors without explicit patient consent and a signed Data Processing Agreement (DPA) is not fully compliant with LGPD requirements.

This is an intentional MVP tradeoff, not an oversight. The architecture was designed so that the storage layer is already compliant — only the processing layer needs to be addressed for production.

### Production roadmap for full compliance

- Patient consent flow on first session (explicit opt-in for AI-assisted transcription)
- Data Processing Agreement with the LLM provider (Anthropic and OpenAI both offer DPAs; Groq's DPA coverage for LGPD is less established)
- Pre-send anonymization: replace patient identifiers (name, CPF, date of birth) with tokens before sending to the LLM API — the `alertasAnonimizacao` field in the schema already anticipates this
- Evaluate on-device model inference (Ollama) for highest-sensitivity deployments where no data can leave the machine

### For the current MVP

Jasmin is designed for development and testing with synthetic or consented data. Do not use with real patient data in production without implementing the compliance steps above.

---

## ⚠️ Known Limitations

**LGPD / Data Privacy:** Audio and text are processed via external LLM APIs. Full LGPD compliance for production requires patient consent, a DPA with the AI provider, and pre-send anonymization. See the [Privacy & Data](#-privacy--data) section above.

**LLM Provider:** Currently using Groq (Llama 3.3 70B) on the free tier for development. For production clinical use, Claude Sonnet or GPT-4o are recommended for higher accuracy in clinical reasoning and structured output. Groq Whisper is retained for transcription (best latency available).

**`localStorage` only:** Patient data does not persist across devices or browsers. A production deployment would require a compliant database with encryption at rest.

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
```

### Run

```bash
npm run dev
# → http://localhost:3000
```

> **No database required.** Clinical records are stored locally in the browser via `localStorage`. AI calls (transcription, structuring, and chat) are processed ephemerally by the Groq API and are never persisted server-side.

### Billing RAG (optional — free & local)

The billing agent maps procedures to TUSS codes and checks documentation/authorization rules against the real reference documents in `knowledge_base/` (TUSS tables, ROL correlation, RN 465/2021). It runs as a separate local Python service (ChromaDB + `sentence-transformers`, no API key). **If the RAG server is down, the agent falls back to a static lookup table automatically** — billing still works, just with less coverage. (Step 4's consolidation uses a separate build-time table, `lib/tuss-data.ts` — regenerate it with `npm run gen:tuss` if the source XLSX changes.)

```bash
# 1. install JS deps (if not done yet)
npm install

# 2. index the knowledge base — run ONCE (downloads the embedding model on first run)
python scripts/index_knowledge_base.py

# 3. start the RAG server — keep it running in a separate terminal
bash scripts/start_rag.sh          # macOS/Linux/Git Bash
#  ./scripts/start_rag.ps1         # Windows PowerShell

# 4. run the app
npm run dev
```

The RAG server listens on `http://localhost:8001` (`GET /health` to check). The Next.js side reads `RAG_SERVER_URL` (defaults to that). Re-run step 2 whenever the documents in `knowledge_base/` change.

### Pipeline smoke tests

```bash
npm run test:prontuario   # runs a sample transcript through the 5-step agent
npm run test:consolidacao # end-to-end: Step-4 clinical→billable consolidation + billing guia
npm run test:soap         # runs the legacy SOAP structuring pipeline
```

> `test:consolidacao` needs the dev server running. The RAG server is **optional** — the billing agent degrades gracefully without it.
