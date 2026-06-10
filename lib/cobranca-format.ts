import type { GuiaSPSADT } from "@/lib/types-cobranca";

/**
 * Helpers puros de formatação/edição da guia de cobrança.
 *
 * (Antes viviam em cobranca-score.ts, junto do score de risco — que foi
 * removido. O total e a formatação de moeda não têm relação com risco, então
 * ficam aqui.)
 */

/** Total monetário da guia = Σ(quantidade × valor_unitario). */
export function guiaTotal(guia: Pick<GuiaSPSADT, "procedimentos">): number {
  return guia.procedimentos.reduce(
    (sum, p) => sum + (p.valor_unitario ?? 0) * (p.quantidade || 0),
    0
  );
}

/** Formata um número como moeda BRL. */
export function fmtBRL(v: number): string {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/**
 * Após uma edição manual da guia, reconcilia os alertas derivados:
 *  - se o número de autorização foi preenchido, o alerta crítico por falta de
 *    autorização deixa de fazer sentido → é removido.
 * Puro: devolve uma nova guia, não muta a original.
 */
export function finalizeEditedGuia(guia: GuiaSPSADT): GuiaSPSADT {
  const temNumero = Boolean(String(guia.numero_autorizacao ?? "").trim());
  const alertas_glosa = temNumero
    ? guia.alertas_glosa.filter((a) => !(a.campo === "autorizacao" && a.tipo === "critico"))
    : guia.alertas_glosa;
  return { ...guia, alertas_glosa };
}
