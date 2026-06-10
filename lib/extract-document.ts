"use client";

import type { JasminChip } from "@/lib/chat-context";

/**
 * Extrai o texto de um documento anexado (PDF, txt, md, csv) no cliente e
 * devolve um JasminChip de contexto. PDFs usam pdfjs-dist (import dinâmico,
 * só no browser). O texto é limitado para não estourar o contexto do agente.
 */

const MAX_CHARS = 20000;
const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

export class DocumentError extends Error {}

const isPdf = (f: File) => f.type === "application/pdf" || /\.pdf$/i.test(f.name);
const isText = (f: File) =>
  /^text\//.test(f.type) || /\.(txt|md|markdown|csv|json)$/i.test(f.name);

async function extractPdf(file: File): Promise<string> {
  const pdfjs = await import("pdfjs-dist");
  // Worker servido por CDN, casando a versão instalada.
  pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
  const data = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({ data }).promise;
  const partes: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const txt = content.items
      .map((it) => ("str" in it ? (it as { str: string }).str : ""))
      .join(" ");
    partes.push(txt);
    if (partes.join("\n").length > MAX_CHARS) break;
  }
  return partes.join("\n\n");
}

/** Lê o arquivo e monta um chip de contexto do tipo "documento". */
export async function buildDocumentChip(file: File): Promise<JasminChip> {
  if (file.size > MAX_BYTES) {
    throw new DocumentError("Arquivo muito grande (máx. 10 MB).");
  }

  let texto: string;
  if (isPdf(file)) {
    texto = await extractPdf(file);
  } else if (isText(file)) {
    texto = await file.text();
  } else {
    throw new DocumentError("Formato não suportado. Use PDF, TXT, MD ou CSV.");
  }

  texto = texto.replace(/\n{3,}/g, "\n\n").trim();
  if (!texto) {
    throw new DocumentError("Não foi possível extrair texto deste documento.");
  }
  const truncated = texto.length > MAX_CHARS;
  if (truncated) texto = texto.slice(0, MAX_CHARS);

  const markdownContent = [
    `# Documento — ${file.name}`,
    truncated ? `\n(Conteúdo truncado em ${MAX_CHARS} caracteres.)` : "",
    ``,
    texto,
  ]
    .filter(Boolean)
    .join("\n");

  return {
    id: `documento:${file.name}-${file.size}`,
    type: "documento",
    label: file.name,
    markdownContent,
    metadata: {},
  };
}
