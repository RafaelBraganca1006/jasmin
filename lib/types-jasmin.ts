/**
 * Tipos vivos da app /consulta (paciente e agendamento).
 *
 * Estavam inline em app/consulta/page.tsx; foram extraídos para cá porque o
 * chat (builders de contexto, snapshot e tools) também precisa deles.
 * São o formato exato persistido no localStorage (jasmin_patients /
 * jasmin_appointments) — não alterar sem migrar os dados gravados.
 */

export type PatientData = {
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
  // Plano de saúde (opcionais — pacientes antigos no localStorage não os têm)
  convenio?: string;
  carteirinha?: string;
  plano?: string;
};

export type AgAppointment = {
  id: number;
  patient: string;
  patientId: string;
  date: string; // "YYYY-MM-DD"
  startH: number;
  startM: number;
  endH: number;
  endM: number;
  type: string;
  bg: string;
  border: string;
  color: string;
};
