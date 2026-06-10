"""
Servidor RAG do agente de cobrança — FastAPI na porta 8001.

Roda localmente em paralelo ao Next.js (3000). O Next.js NÃO importa Python:
fala com este servidor por HTTP (ver lib/cobranca-knowledge/rag-retriever.ts).

    python scripts/rag_server.py
    # ou: bash scripts/start_rag.sh / pwsh scripts/start_rag.ps1

Pré-requisito: rodar antes `python scripts/index_knowledge_base.py`.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import rag_common as cfg  # noqa: E402

from fastapi import FastAPI  # noqa: E402
from fastapi.middleware.cors import CORSMiddleware  # noqa: E402
from pydantic import BaseModel  # noqa: E402

app = FastAPI(title="Jasmin RAG — Cobrança", version="1.0")

# CORS para o Next.js em dev. (Em prod o Next chama server-side, mas mantemos
# liberado para chamadas diretas do browser durante testes.)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Estado carregado uma vez no startup.
_client = None
_ef = None
_cols = {}


def _get_collection(name):
    global _client, _ef
    if name not in _cols:
        if _client is None:
            _client = cfg.get_client()
            _ef = cfg.get_embedding_function()
        _cols[name] = _client.get_collection(name=name, embedding_function=_ef)
    return _cols[name]


class SearchBody(BaseModel):
    query: str
    top_k: int = 3
    # Filtro EXATO opcional por código TUSS (lookup preciso, sem depender do
    # vetor — embeddings densos erram em código alfanumérico).
    codigo_tuss: str | None = None


def _format(res, with_collection=None):
    out = []
    docs = (res.get("documents") or [[]])[0]
    metas = (res.get("metadatas") or [[]])[0]
    dists = (res.get("distances") or [[]])[0]
    for content, meta, dist in zip(docs, metas, dists):
        item = {
            "content": content,
            # distância cosseno → similaridade (0-1, maior = mais similar)
            "score": round(max(0.0, 1.0 - float(dist)), 4),
            "source": (meta or {}).get("source", ""),
            "metadata": meta or {},
        }
        if with_collection:
            item["collection"] = with_collection
        out.append(item)
    return out


def _search(collection_name, body: SearchBody):
    col = _get_collection(collection_name)
    # Caminho de lookup EXATO por código: filtro de metadata, não vetor.
    if body.codigo_tuss:
        res = col.get(
            where={"codigo_tuss": body.codigo_tuss.strip()},
            limit=max(1, body.top_k),
        )
        # `get` não traz distância; tratamos como match perfeito (score 1.0).
        out = []
        for content, meta in zip(res.get("documents") or [], res.get("metadatas") or []):
            out.append({
                "content": content,
                "score": 1.0,
                "source": (meta or {}).get("source", ""),
                "metadata": meta or {},
            })
        if out:
            return out
        # Sem match exato → cai para busca semântica abaixo.
    res = col.query(query_texts=[body.query], n_results=max(1, body.top_k))
    return _format(res)


@app.post("/search/tuss")
def search_tuss(body: SearchBody):
    return _search(cfg.COLLECTION_TUSS, body)


@app.post("/search/rules")
def search_rules(body: SearchBody):
    return _search(cfg.COLLECTION_RULES, body)


@app.post("/search/all")
def search_all(body: SearchBody):
    out = []
    for name in (cfg.COLLECTION_TUSS, cfg.COLLECTION_RULES):
        col = _get_collection(name)
        res = col.query(query_texts=[body.query], n_results=max(1, body.top_k))
        out.extend(_format(res, with_collection=name))
    out.sort(key=lambda x: x["score"], reverse=True)
    return out[: body.top_k]


@app.get("/health")
def health():
    try:
        counts = {
            cfg.COLLECTION_TUSS: _get_collection(cfg.COLLECTION_TUSS).count(),
            cfg.COLLECTION_RULES: _get_collection(cfg.COLLECTION_RULES).count(),
        }
        return {"status": "ok", "model": cfg.EMBED_MODEL, "collections": counts}
    except Exception as e:
        return {"status": "error", "detail": str(e),
                "hint": "Rode primeiro: python scripts/index_knowledge_base.py"}


@app.get("/collections/info")
def collections_info():
    info = []
    for name in (cfg.COLLECTION_TUSS, cfg.COLLECTION_RULES):
        try:
            col = _get_collection(name)
            sample = col.get(limit=500)
            sources = sorted({(m or {}).get("source", "") for m in (sample.get("metadatas") or [])} - {""})
            info.append({"name": name, "count": col.count(), "sources": sources})
        except Exception as e:
            info.append({"name": name, "error": str(e)})
    return info


if __name__ == "__main__":
    import uvicorn
    print(f"RAG server :8001 | modelo={cfg.EMBED_MODEL} | chroma={cfg.CHROMA_DIR}")
    uvicorn.run(app, host="127.0.0.1", port=8001, log_level="info")
