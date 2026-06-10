import { ChatProvider } from "@/lib/chat-context";
import JasminChat from "@/app/components/chat/JasminChat";

/**
 * Escopo do Jasmin Assistant: só a app autenticada (/consulta), não a landing.
 * O ChatProvider fica acima do ConsultaPage para que o botão e o painel
 * apareçam em todas as seções e o histórico persista entre elas.
 */
export default function ConsultaLayout({ children }: { children: React.ReactNode }) {
  return (
    <ChatProvider>
      {children}
      <JasminChat />
    </ChatProvider>
  );
}
