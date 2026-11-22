import type { ProntuarioModel } from "@/lib/types-prontuario";
import { procedimentosRealizados } from "@/lib/types-prontuario";

/**
 * Exporta o prontuário como PDF ou Word (.docx), 100% no navegador — nada é
 * enviado a servidor (decisão LGPD do projeto). As bibliotecas são carregadas
 * sob demanda (import dinâmico) para não pesar o carregamento inicial.
 */

type Item = { label: string; value?: string; list?: string[] };
interface Section { title: string; items: Item[] }
interface DocModel {
  title: string;
  subtitle: string;
  sections: Section[];
  assinatura: string;
  signer: string;
  filename: string;
}

const dash = "—";
const val = (v?: string) => (v && v.trim() ? v.trim() : dash);
const joinList = (l?: string[]) => (l && l.filter(Boolean).length ? l.filter(Boolean).join(", ") : dash);
const fmtData = (iso: string) => (/^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso.split("-").reverse().join("/") : iso || dash);
const slug = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "paciente";

function buildModel(p: ProntuarioModel): DocModel {
  const id = p.identificacao;
  const a = p.anamnese;
  const e = p.exame;
  const d = p.diagnostico;
  const pl = p.plano;

  const sections: Section[] = [
    {
      title: "Identificação",
      items: [
        { label: "Paciente", value: val(id.nome_paciente) },
        { label: "Convênio", value: val(id.convenio) },
        { label: "Carteirinha", value: val(id.carteirinha) },
        { label: "Dentista", value: val(id.dentista) },
        { label: "CRO", value: val(id.cro) },
        { label: "Data da consulta", value: fmtData(id.data) },
      ],
    },
    {
      title: "Anamnese",
      items: [
        { label: "Queixa principal", value: val(a.queixa_principal) },
        { label: "Medicamentos em uso", value: joinList(a.medicamentos) },
        { label: "Alergias", value: joinList(a.alergias) },
        { label: "Histórico médico", value: val(a.historico_medico) },
        { label: "Hábitos", value: val(a.habitos) },
        { label: "Comorbidades", value: val(a.comorbidades) },
      ],
    },
    {
      title: "Exame clínico",
      items: [
        { label: "Extraoral", value: val(e.extraoral) },
        { label: "Intraoral", value: val(e.intraoral) },
        { label: "Periodonto", value: val(e.periodonto) },
        { label: "Oclusão", value: val(e.oclusao) },
        {
          label: "Odontograma",
          list: e.odontograma.map((t) => `Dente ${t.elemento}: ${t.status}${t.observacao ? ` (${t.observacao})` : ""}`),
        },
        { label: "Laudo radiológico", value: val(e.laudo_radiologico) },
      ],
    },
    {
      title: "Diagnóstico",
      items: [
        { label: "CID-10", value: d.cid_codigo ? `${d.cid_codigo}${d.cid_descricao ? ` - ${d.cid_descricao}` : ""}` : dash },
        { label: "Elemento dental", value: val(d.elemento_dental) },
        { label: "Confirmado por raio-x", value: d.confirmado_por_raio_x ? "Sim" : "Não" },
      ],
    },
    {
      title: "Plano de tratamento",
      items: [
        { label: "Procedimentos realizados", list: procedimentosRealizados(pl) },
        { label: "Materiais", value: val(pl.materiais) },
        { label: "Anestesia", value: val(pl.anestesia) },
        { label: "Pós-operatório", value: val(pl.pos_operatorio) },
        { label: "Próxima consulta", value: val(pl.proxima_consulta) },
      ],
    },
  ];

  const fat = (pl.procedimentos_faturaveis ?? []).map((f) => {
    const cod = f.codigo_tuss && f.codigo_tuss !== "MANUAL" ? f.codigo_tuss : "a definir";
    return `${cod} - ${f.descricao}${f.elemento_dental ? ` (dente ${f.elemento_dental})` : ""}${f.quantidade > 1 ? ` x${f.quantidade}` : ""}`;
  });
  if (fat.length) sections.push({ title: "Procedimentos para cobrança", items: [{ label: "TUSS", list: fat }] });

  const al = p.alertas;
  const alertas = [
    ...al.alertas_clinicos,
    ...al.inconsistencias.map((x) => `Inconsistência: ${x}`),
    ...al.gaps.map((x) => `Pendência: ${x}`),
  ];
  if (alertas.length) sections.push({ title: "Alertas", items: [{ label: "Registrados", list: alertas }] });

  return {
    title: "Prontuário Odontológico",
    subtitle: `${val(id.nome_paciente)}  |  ${fmtData(id.data)}`,
    sections,
    assinatura: p.assinatura_pendente ? "Assinatura pendente - documento ainda não aprovado pelo(a) dentista." : "Aprovado digitalmente pelo(a) dentista responsável.",
    signer: [id.dentista, id.cro].filter(Boolean).join(" - ") || "Dentista responsável",
    filename: `Prontuario_${slug(id.nome_paciente)}_${id.data || "sem-data"}`,
  };
}

function save(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/** A fonte padrão do PDF (Helvetica) cobre Latin-1: remove só o que ela não desenha. */
const pdfSafe = (s: string) => s.replace(/[^ -ÿ–—‘’“”•…]/g, "");

export async function downloadProntuarioPdf(p: ProntuarioModel): Promise<void> {
  const m = buildModel(p);
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const ML = 20;
  const MR = 20;
  const MB = 18;
  const CW = W - ML - MR;
  let y = 22;

  const ensure = (h: number) => {
    if (y + h > H - MB) {
      doc.addPage();
      y = 20;
    }
  };
  const lines = (text: string, width: number) => doc.splitTextToSize(pdfSafe(text), width) as string[];

  // título
  doc.setFont("helvetica", "bold").setFontSize(18).setTextColor(27, 23, 20);
  doc.text(pdfSafe(m.title), ML, y);
  y += 7;
  doc.setFont("helvetica", "normal").setFontSize(10.5).setTextColor(92, 84, 76);
  doc.text(pdfSafe(m.subtitle), ML, y);
  y += 4;
  doc.setDrawColor(252, 94, 14).setLineWidth(0.6).line(ML, y, ML + 28, y);
  y += 9;

  for (const s of m.sections) {
    ensure(34); // título + pelo menos o primeiro item na mesma página
    doc.setFont("helvetica", "bold").setFontSize(11.5).setTextColor(27, 23, 20);
    doc.text(pdfSafe(s.title), ML, y);
    y += 2.2;
    doc.setDrawColor(215, 212, 208).setLineWidth(0.25).line(ML, y, W - MR, y);
    y += 6;

    for (const it of s.items) {
      const LABEL_W = 46;
      const hasList = Array.isArray(it.list);
      const body = hasList ? (it.list!.length ? it.list! : [dash]) : [it.value ?? dash];
      const wrapped = body.map((t) => lines(hasList && t !== dash ? `- ${t}` : t, CW - LABEL_W));
      const total = wrapped.reduce((n, w) => n + w.length, 0);
      ensure(Math.min(total, 3) * 4.6 + 1);

      doc.setFont("helvetica", "bold").setFontSize(8.5).setTextColor(120, 112, 104);
      doc.text(pdfSafe(it.label.toUpperCase()), ML, y);
      doc.setFont("helvetica", "normal").setFontSize(10).setTextColor(27, 23, 20);
      for (const w of wrapped) {
        for (const ln of w) {
          ensure(5);
          doc.text(ln, ML + LABEL_W, y);
          y += 4.7;
        }
      }
      y += 2.2;
    }
    y += 4;
  }

  // assinatura
  ensure(34);
  y += 6;
  doc.setDrawColor(27, 23, 20).setLineWidth(0.3).line(ML, y + 12, ML + 80, y + 12);
  doc.setFont("helvetica", "normal").setFontSize(10).setTextColor(27, 23, 20);
  doc.text(pdfSafe(m.signer), ML, y + 17);
  doc.setFontSize(8.5).setTextColor(120, 112, 104);
  doc.text(pdfSafe(m.assinatura), ML, y + 22);

  // rodapé com paginação
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal").setFontSize(8).setTextColor(150, 144, 138);
    doc.text(`Jasmin - Prontuário | Página ${i} de ${pages}`, W / 2, H - 9, { align: "center" });
  }

  save(doc.output("blob"), `${m.filename}.pdf`);
}

export async function downloadProntuarioDocx(p: ProntuarioModel): Promise<void> {
  const m = buildModel(p);
  const { Document, Packer, Paragraph, TextRun, HeadingLevel, BorderStyle, AlignmentType } = await import("docx");

  const children: InstanceType<typeof Paragraph>[] = [];
  children.push(
    new Paragraph({ heading: HeadingLevel.TITLE, children: [new TextRun({ text: m.title, bold: true, size: 36 })] }),
    new Paragraph({ spacing: { after: 240 }, children: [new TextRun({ text: m.subtitle, color: "5C544C", size: 21 })] })
  );

  for (const s of m.sections) {
    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 280, after: 120 },
        border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: "D7D4D0", space: 2 } },
        children: [new TextRun({ text: s.title, bold: true, size: 24 })],
      })
    );
    for (const it of s.items) {
      if (Array.isArray(it.list)) {
        children.push(new Paragraph({ spacing: { before: 80 }, children: [new TextRun({ text: it.label, bold: true, size: 20 })] }));
        if (it.list.length === 0) children.push(new Paragraph({ children: [new TextRun({ text: dash, size: 21 })] }));
        for (const t of it.list) {
          children.push(new Paragraph({ bullet: { level: 0 }, children: [new TextRun({ text: t, size: 21 })] }));
        }
      } else {
        children.push(
          new Paragraph({
            spacing: { before: 60, after: 20 },
            children: [new TextRun({ text: `${it.label}: `, bold: true, size: 21 }), new TextRun({ text: it.value ?? dash, size: 21 })],
          })
        );
      }
    }
  }

  children.push(
    new Paragraph({ spacing: { before: 720 }, border: { top: { style: BorderStyle.SINGLE, size: 6, color: "1B1714", space: 4 } }, children: [new TextRun({ text: m.signer, size: 21 })] }),
    new Paragraph({ children: [new TextRun({ text: m.assinatura, color: "78706A", size: 18 })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 360 }, children: [new TextRun({ text: "Gerado pelo Jasmin", color: "96908A", size: 16 })] })
  );

  const doc = new Document({
    creator: "Jasmin",
    title: m.title,
    styles: { default: { document: { run: { font: "Calibri", size: 21 } } } },
    sections: [{ properties: { page: { margin: { top: 1134, bottom: 1134, left: 1134, right: 1134 } } }, children }],
  });
  save(await Packer.toBlob(doc), `${m.filename}.docx`);
}
