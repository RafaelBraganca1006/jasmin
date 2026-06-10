import { Annotation, StateGraph, START, END } from "@langchain/langgraph";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { ChatGroq } from "@langchain/groq";
import { SystemMessage, type BaseMessage, type AIMessage } from "@langchain/core/messages";
import { createTools } from "@/lib/chat-tools";
import type { StorageSnapshot } from "@/lib/chat-snapshot";
import { MODELS } from "@/lib/groq";

/**
 * Grafo conversacional do Jasmin Assistant (LangGraph).
 *
 * Estado: histórico de mensagens + contexto ativo (markdown dos chips) +
 * identidade do dentista e data de hoje. Nó `agent` (ChatGroq com as 5 tools)
 * ↔ nó `tools` (ToolNode) num laço até o modelo parar de chamar ferramentas.
 */

export const JasminState = Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    reducer: (x, y) => x.concat(y),
    default: () => [],
  }),
  contextoAtivo: Annotation<string>({
    reducer: (_x, y) => y,
    default: () => "",
  }),
  dentistaNome: Annotation<string>({
    reducer: (_x, y) => y,
    default: () => "Dr(a).",
  }),
  dataHoje: Annotation<string>({
    reducer: (_x, y) => y,
    default: () => "",
  }),
});

type JasminStateType = typeof JasminState.State;

export function buildSystemPrompt(opts: { contextoAtivo: string; dataHoje: string }): string {
  const contexto = opts.contextoAtivo?.trim()
    ? `\n\nContexto selecionado pelo dentista (use como fonte primária):\n---\n${opts.contextoAtivo}\n---`
    : "\n\n(Nenhum contexto selecionado pelo dentista no momento.)";

  return `Você é o Jasmin Assistant, agente clínico integrado ao sistema de gestão odontológica Jasmin.

Você tem acesso ao histórico de consultas, prontuários, agenda e dados de pacientes da clínica, sempre por meio das ferramentas.

Data de hoje: ${opts.dataHoje}

⛔ REGRA ABSOLUTA — NÃO INVENTAR DADOS DA CLÍNICA:
- Nomes de pacientes, diagnósticos, doenças, dentes, procedimentos, convênios, consultas e datas devem vir EXCLUSIVAMENTE do resultado de uma ferramenta ou do contexto selecionado pelo dentista. NUNCA crie, complete ou "deduza" esses dados.
- Se uma ferramenta retornou 1 paciente, existe 1 paciente — não acrescente outros. Nunca gere nomes plausíveis (ex.: "João Silva", "Maria") que não vieram de uma fonte.
- Se você não tem o dado por ferramenta/contexto, diga claramente que não encontrou e pare — não preencha com suposições.
- Você PODE responder conhecimento geral de odontologia/medicina (ex.: explicar o que é uma cárie), mas NUNCA atribuir informações específicas a pacientes da clínica sem fonte real.

Se houver contexto selecionado pelo dentista, ele aparece abaixo separado por ---. Use esse contexto como fonte primária antes de chamar qualquer tool.${contexto}

USO DE FERRAMENTAS:
- Você tem ferramentas internas para: contar/listar pacientes, ver a agenda de hoje, descobrir a próxima consulta, consultar o histórico/prontuários de um paciente e checar interações medicamentosas. Use-as automaticamente quando precisar do dado.
- NUNCA revele ao usuário os nomes das ferramentas/funções internas, e NUNCA peça que o dentista "use uma ferramenta" — se você precisa de um dado, busque-o você mesmo, em silêncio.
- Ao usar uma ferramenta, chame-a DIRETAMENTE, sem escrever nenhum texto antes. Escreva a resposta somente DEPOIS de receber o resultado.
- Se a informação já está no histórico desta conversa ou no contexto selecionado, responda direto, SEM ferramenta. Não repita a mesma busca para o mesmo dado.
- Se uma pergunta for conversacional ou de esclarecimento (ex.: "que isso?", "explique"), responda em texto, sem ferramentas.
- Se um dado NÃO estiver disponível pelas suas ferramentas (por exemplo, o odontograma de um paciente), diga isso em linguagem simples e sugira que o dentista selecione o contexto correto na tela (ex.: abrir a aba Odontograma do paciente e adicioná-la ao chat) — sem mencionar funções internas.

FORMATAÇÃO (markdown, use com moderação):
- Respostas simples = 1 ou 2 frases em texto corrido, SEM títulos nem listas.
- Use **negrito** para dados-chave (datas, CID, número do dente, nomes, valores).
- Use listas com "-" apenas quando houver vários itens (procedimentos, consultas, medicamentos).
- Use títulos (##) só em respostas longas com várias seções. Não use tabelas.

REGRAS DE COMPORTAMENTO:
- Sempre cite a fonte das informações clínicas com a data, por exemplo: "conforme prontuário de 06/06/2026".
- Nunca invente dados — se não encontrar, diga explicitamente e sugira selecionar o contexto correto.
- Para perguntas sobre interações medicamentosas, forneça a informação mas sempre oriente confirmar com o médico responsável do paciente.
- Seja conciso e direto — o dentista está em ambiente clínico.
- Responda sempre em português brasileiro.`;
}

export interface CreateGraphInput {
  snapshot: StorageSnapshot;
}

export function createJasminGraph({ snapshot }: CreateGraphInput) {
  const tools = createTools(snapshot);

  const model = new ChatGroq({
    model: MODELS.structuring, // llama-3.3-70b-versatile
    temperature: 0.3,
    apiKey: process.env.GROQ_API_KEY,
  });
  const boundModel = model.bindTools(tools);
  const toolNode = new ToolNode(tools);

  const callModel = async (state: JasminStateType) => {
    const system = new SystemMessage(
      buildSystemPrompt({ contextoAtivo: state.contextoAtivo, dataHoje: state.dataHoje })
    );
    const response = await boundModel.invoke([system, ...state.messages]);
    return { messages: [response] };
  };

  const routeMessage = (state: JasminStateType) => {
    const last = state.messages[state.messages.length - 1] as AIMessage | undefined;
    if (!last?.tool_calls?.length) return END;
    return "tools";
  };

  const workflow = new StateGraph(JasminState)
    .addNode("agent", callModel)
    .addNode("tools", toolNode)
    .addEdge(START, "agent")
    .addConditionalEdges("agent", routeMessage, { tools: "tools", [END]: END })
    .addEdge("tools", "agent");

  return workflow.compile();
}
