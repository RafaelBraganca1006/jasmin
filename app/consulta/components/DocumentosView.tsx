"use client";

import { useState, useRef, useCallback, useEffect } from "react";

interface DocumentItem {
  id: string;
  name: string;
  type: string;
  size: number;
  data: string;
  createdAt: string;
}

const LS_KEY = "jasmin_documentos";
const MAX_FILE_SIZE = 5 * 1024 * 1024;

const ACCEPTED = ".pdf,.png,.jpg,.jpeg,.gif,.webp,.doc,.docx,.xls,.xlsx,.txt,.csv";

function loadDocs(): DocumentItem[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(LS_KEY) || "[]"); } catch { return []; }
}

function saveDocs(docs: DocumentItem[]) {
  localStorage.setItem(LS_KEY, JSON.stringify(docs));
}

function fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function iconKind(type: string): "pdf" | "image" | "sheet" | "doc" | "file" {
  if (type === "application/pdf") return "pdf";
  if (type.startsWith("image/")) return "image";
  if (type.includes("spreadsheet") || type.includes("excel") || type.includes("csv")) return "sheet";
  if (type.includes("word") || type.includes("document") || type === "text/plain") return "doc";
  return "file";
}

function DocIcon({ kind }: { kind: ReturnType<typeof iconKind> }) {
  if (kind === "pdf") {
    return (
      <div className="doc-icon doc-icon-pdf">
        <span>PDF</span>
      </div>
    );
  }
  if (kind === "image") {
    return (
      <div className="doc-icon doc-icon-image">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" />
          <polyline points="21 15 16 10 5 21" />
        </svg>
      </div>
    );
  }
  if (kind === "sheet") {
    return (
      <div className="doc-icon doc-icon-sheet">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="8" y1="13" x2="16" y2="13" /><line x1="8" y1="17" x2="16" y2="17" />
        </svg>
      </div>
    );
  }
  return (
    <div className="doc-icon doc-icon-file">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
      </svg>
    </div>
  );
}

export default function DocumentosView() {
  const [docs, setDocs] = useState<DocumentItem[]>([]);
  const [search, setSearch] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setDocs(loadDocs()); }, []);

  const processFile = useCallback((file: File) => {
    setError(null);
    if (file.size > MAX_FILE_SIZE) {
      setError(`Arquivo muito grande (${fmtSize(file.size)}). Limite: 5 MB.`);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const newDoc: DocumentItem = {
        id: crypto.randomUUID(),
        name: file.name,
        type: file.type || "application/octet-stream",
        size: file.size,
        data: reader.result as string,
        createdAt: new Date().toISOString(),
      };
      setDocs((prev) => {
        const next = [newDoc, ...prev];
        saveDocs(next);
        return next;
      });
    };
    reader.readAsDataURL(file);
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    Array.from(files).forEach(processFile);
    e.target.value = "";
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    Array.from(e.dataTransfer.files).forEach(processFile);
  };

  const handleDownload = (doc: DocumentItem) => {
    const a = document.createElement("a");
    a.href = doc.data;
    a.download = doc.name;
    a.click();
  };

  const handleDeleteConfirm = () => {
    if (!deleteId) return;
    setDocs((prev) => {
      const next = prev.filter((d) => d.id !== deleteId);
      saveDocs(next);
      return next;
    });
    setDeleteId(null);
  };

  const visible = search.trim()
    ? docs.filter((d) => d.name.toLowerCase().includes(search.trim().toLowerCase()))
    : docs;

  return (
    <div className="p-wrap">
      <div className="p-toolbar">
        <div className="p-search">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            placeholder="Buscar documento..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="p-toolbar-right">
          <button className="btn btn-solid btn-sm" onClick={() => fileInputRef.current?.click()}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Adicionar documento
          </button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept={ACCEPTED}
            style={{ display: "none" }}
            onChange={handleInputChange}
          />
        </div>
      </div>

      <div
        className={`doc-dropzone${dragOver ? " doc-dropzone-active" : ""}`}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === "Enter" && fileInputRef.current?.click()}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" width="36" height="36">
          <polyline points="16 16 12 12 8 16" /><line x1="12" y1="12" x2="12" y2="21" />
          <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3" />
        </svg>
        <p className="doc-dropzone-label">
          {dragOver ? "Solte os arquivos aqui" : "Arraste arquivos ou clique para selecionar"}
        </p>
        <p className="doc-dropzone-hint">PDF, imagens, Word, Excel, texto · máx. 5 MB por arquivo</p>
      </div>

      {error && (
        <div className="doc-error">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
            <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          {error}
          <button onClick={() => setError(null)} className="doc-error-close">×</button>
        </div>
      )}

      {docs.length > 0 && (
        <p className="p-result-count">
          {visible.length} documento{visible.length === 1 ? "" : "s"}
        </p>
      )}

      {visible.length === 0 && docs.length > 0 && search.trim() ? (
        <div className="p-filter-empty">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" width="32" height="32">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
          </svg>
          <p>Nenhum documento encontrado para &ldquo;{search.trim()}&rdquo;.</p>
        </div>
      ) : visible.length === 0 ? (
        <div className="p-filter-empty">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" width="32" height="32">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
          </svg>
          <p>Nenhum documento adicionado ainda.</p>
        </div>
      ) : (
        <div className="doc-list">
          {visible.map((doc) => {
            const kind = iconKind(doc.type);
            const dt = new Date(doc.createdAt);
            const dateStr = dt.toLocaleDateString("pt-BR");
            return (
              <div key={doc.id} className="doc-row">
                <DocIcon kind={kind} />
                <div className="doc-info">
                  <span className="doc-name">{doc.name}</span>
                  <span className="doc-meta">{fmtSize(doc.size)} · {dateStr}</span>
                </div>
                <div className="doc-actions">
                  <button
                    className="doc-action-btn"
                    title="Baixar"
                    onClick={() => handleDownload(doc)}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
                    </svg>
                  </button>
                  <button
                    className="doc-action-btn doc-action-delete"
                    title="Excluir"
                    onClick={() => setDeleteId(doc.id)}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    </svg>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {deleteId && (
        <div className="p-modal-overlay" onClick={() => setDeleteId(null)}>
          <div className="p-confirm-modal" onClick={(e) => e.stopPropagation()}>
            <div className="p-confirm-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            </div>
            <h2 className="p-confirm-title">Excluir documento?</h2>
            <p className="p-confirm-text">
              O arquivo <strong>{docs.find((d) => d.id === deleteId)?.name}</strong> será removido permanentemente.
            </p>
            <div className="p-confirm-actions">
              <button className="btn btn-outline btn-sm" onClick={() => setDeleteId(null)}>Cancelar</button>
              <button className="btn btn-danger btn-sm" onClick={handleDeleteConfirm}>Excluir</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
