"""
Configuração compartilhada do RAG (indexador + servidor).

Tudo local e gratuito: embeddings via sentence-transformers, vector store via
ChromaDB persistente em disco. Sem API key.
"""
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
KB_DIR = os.path.join(ROOT, "knowledge_base")
CHROMA_DIR = os.path.join(ROOT, ".chromadb")

# Modelo multilíngue com bom suporte a PT-BR. Trocável por env (ex.: para um
# modelo mais leve se o torch não instalar no Python 3.13).
EMBED_MODEL = os.environ.get("RAG_EMBED_MODEL", "paraphrase-multilingual-mpnet-base-v2")

COLLECTION_TUSS = "tuss_procedures"   # linhas de tabelas TUSS (xlsx + pdf-tabela)
COLLECTION_RULES = "dental_rules"     # texto de regras/legislação (pdf)

# Distância cosseno → similaridade = 1 - distância (ver rag_server).
CHROMA_SPACE = "cosine"


def get_client():
    import chromadb
    os.makedirs(CHROMA_DIR, exist_ok=True)
    return chromadb.PersistentClient(path=CHROMA_DIR)


def get_embedding_function():
    """Embedding function do ChromaDB usando sentence-transformers."""
    from chromadb.utils import embedding_functions
    return embedding_functions.SentenceTransformerEmbeddingFunction(model_name=EMBED_MODEL)
