import type { ProntuarioModel } from "@/lib/types-prontuario";
import {
  getPatients,
  getAppointments,
  getAllProntuarios,
  getAllProntuariosMd,
} from "@/lib/prontuario-storage";

/**
 * Snapshot do localStorage enviado ao /api/chat a cada mensagem.
 *
 * Decisão LGPD: a app mantém dado clínico no browser (sem banco). Para as tools
 * rodarem no servidor precisamos de um recorte, mas enviamos apenas o necessário:
 *  - de cada paciente: id, nome, convênio e status — NUNCA CPF, telefone, e-mail
 *    ou endereço. O contexto rico (com identificação) só vai pelos chips, quando
 *    o dentista escolhe explicitamente.
 *  - prontuários (já sem PII — o agente de prontuário remove dados pessoais).
 */

export interface SnapshotPatient {
  id: string;
  nome: string;
  sobrenome: string;
  convenio?: string;
  status: "ativo" | "inativo";
}

export interface SnapshotAppointment {
  id: number;
  patientId: string;
  patient: string;
  date: string; // "YYYY-MM-DD"
  startH: number;
  startM: number;
  endH: number;
  endM: number;
  type: string;
}

export interface StorageSnapshot {
  patients: SnapshotPatient[];
  appointments: SnapshotAppointment[];
  /** appointmentId → prontuário estruturado */
  prontuarios: Record<string, ProntuarioModel>;
  /** appointmentId → markdown do prontuário */
  prontuariosMd: Record<string, string>;
}

/** Monta o snapshot (client-side) lendo cada store uma única vez. */
export function buildStorageSnapshot(): StorageSnapshot {
  const patients: SnapshotPatient[] = getPatients().map((p) => ({
    id: p.id,
    nome: p.nome,
    sobrenome: p.sobrenome,
    convenio: p.convenio,
    status: p.status,
  }));

  const appointments: SnapshotAppointment[] = getAppointments().map((a) => ({
    id: a.id,
    patientId: a.patientId,
    patient: a.patient,
    date: a.date,
    startH: a.startH,
    startM: a.startM,
    endH: a.endH,
    endM: a.endM,
    type: a.type,
  }));

  return {
    patients,
    appointments,
    prontuarios: getAllProntuarios(),
    prontuariosMd: getAllProntuariosMd(),
  };
}
