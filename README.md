# Jasmin — ERP AI-Native para Dentistas

> O primeiro ERP odontológico onde o dentista não precisa digitar. O sistema escuta a consulta ou o resumo em voz do profissional e alimenta instantaneamente a agenda, o prontuário estruturado e as guias operacionais em uma única interface fluida.

---

## O problema

Sistemas de gestão atuais para dentistas são passivos e baseados em digitação manual massiva. O profissional gasta até 40% da jornada clicando em telas e preenchendo fichas clínicas, relatórios e odontogramas após cada atendimento.

Isso gera cansaço físico, atrasa a agenda de pacientes e abre margem para erros humanos de preenchimento — que resultam em glosas e prejuízos financeiros nos repasses de convênios.

A Jasmin resolve isso pulando a era da digitação: infraestrutura operacional alimentada por voz, onde a IA documenta o atendimento em tempo real, eliminando o trabalho burocrático pós-consulta.

---

## Stack

| Camada | Tecnologia |
|---|---|
| Framework | Next.js 15 (App Router) + TypeScript |
| Estilo | CSS global (`globals.css`) — sem Tailwind |
| Transcrição | Groq `whisper-large-v3` |
| Estruturação clínica | Groq `llama-3.3-70b-versatile` |
| Persistência | `localStorage` (sem banco — LGPD) |
| Auth | Senha única com SHA-256, cookie de sessão |
| Deploy | Vercel |

---

## Estrutura do projeto

```
app/
  page.tsx                  # Landing page pública
  login/page.tsx            # Login por senha
  consulta/page.tsx         # App principal (toda a UI)
  globals.css               # Todos os estilos

  api/
    login/route.ts          # POST /api/login — autentica e seta cookie
    process/route.ts        # POST /api/process — áudio → transcrição + SOAP
    transcribe/route.ts     # POST /api/transcribe — chunk de áudio → texto
    soap/route.ts           # POST /api/soap — transcript → SOAP estruturado

lib/
  groq.ts                   # Cliente Groq + modelo IDs centralizados
  transcribe.ts             # Whisper via Groq
  structure.ts              # LLM → ProntuarioSOAP (prompt clínico SOAP)
  types.ts                  # ProntuarioSOAP, SOAPFieldKey, ProcessResult
  auth.ts                   # authToken (SHA-256)

middleware.ts               # Protege /consulta e /api contra acesso sem login
```

---

## App principal (`/consulta`)

Todo o app roda em um único componente `ConsultaPage` com quatro seções controladas por estado:

### Agenda
- Views **Dia** e **Semana** sincronizadas via `agendaDate`
- Criar consultas: busca de paciente, data, horário (drum picker), duração (15 min–3 h)
- Clicar num card da agenda abre a página de Consulta para aquele agendamento
- Navegação por semana/dia com prev/next

### Pacientes
- Lista com busca, cadastro via modal
- Detalhe do paciente: dados pessoais, contato
- Aba **Consultas**: histórico de agendamentos, clicável para abrir o prontuário
- **Próxima Consulta** na sidebar: calculada em tempo real, clicável

### Consulta (página)
- Acessível **apenas** clicando num card da agenda ou num item de consulta do paciente (não há aba direta no sidebar)
- Header com contexto do paciente + horário + tipo
- Botão **Gravar** compacto: inicia gravação com chunking a cada 60 s para transcrição paralela
- Botão **Voltar inteligente**: retorna à agenda ou à aba Consultas do paciente dependendo da origem
- Campos SOAP sempre visíveis (preenchidos após gravação): Queixa Principal, S, O, A, P, Dentes Envolvidos, Procedimentos, Orientações
- **Linked Evidence**: cada campo mostra quantas "fontes" tem; clicar destaca os trechos exatos na transcrição

### Financeiro
- Placeholder (P2)

---

## Pipeline de IA

```
Microfone / Arquivo de áudio
        │
        ▼
POST /api/transcribe (chunks) ──► Groq Whisper → texto parcial (live)
        │
        ▼ (ao parar)
POST /api/soap
        │
        ▼
Groq llama-3.3-70b-versatile
        │  system prompt clínico SOAP + LGPD
        ▼
ProntuarioSOAP {
  subjetivo, objetivo, avaliacao, plano,
  queixaPrincipal, dentesEnvolvidos,
  procedimentos, orientacoes,
  alertasAnonimizacao,   ← dados pessoais removidos (LGPD)
  evidencias             ← fragmentos literais da transcrição por campo
}
```

---

## Persistência

Nenhum dado clínico sai do browser além das chamadas de IA (processamento efêmero, sem banco). Dois registros no `localStorage`:

| Chave | Conteúdo |
|---|---|
| `jasmin_patients` | `PatientData[]` — cadastro de pacientes |
| `jasmin_appointments` | `AgAppointment[]` — agendamentos |

A hidratação é SSR-safe: estado inicializa vazio no servidor, `useEffect` de mount carrega do `localStorage` no cliente, e os effects de persistência só gravam após `hydrated = true`.

> **Próximo passo P0:** salvar o SOAP gerado vinculado ao `appointment.id` — hoje o prontuário é perdido ao fechar a página.

---

## Auth

Senha única configurada via `APP_PASSWORD` (variável de ambiente). O middleware Next.js protege todas as rotas `/consulta/*` e `/api/*` (exceto `/api/login`). Sem senha configurada, o app fica aberto — útil em desenvolvimento local.

---

## Rodar localmente

```bash
npm install

# Crie .env.local com:
# GROQ_API_KEY=sua_chave_groq
# APP_PASSWORD=senha_de_acesso   (opcional em dev)

npm run dev
# → http://localhost:3000
```

---

## Próximas etapas (roadmap)

| Prioridade | Feature |
|---|---|
| **P0** | Salvar SOAP por consulta no localStorage |
| **P0** | Botão "Copiar pro SissOnline" com formato compatível |
| **P0** | Deploy Vercel + teste real com a dentista |
| P1 | Editar/deletar consultas e pacientes |
| P1 | Nome do dentista editável (hoje hardcoded "Dr. Usuário") |
| P1 | Badge de prontuário salvo no card da agenda |
| P2 | Odontograma interativo |
| P2 | Ficha clínica completa (anamnese, alergias, medicamentos) |
| P2 | Financeiro |
| P2 | Extensão Chrome para injeção no SissOnline (Fase 2) |
