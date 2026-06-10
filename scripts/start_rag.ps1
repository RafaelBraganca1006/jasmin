# Sobe o servidor RAG do agente de cobrança (porta 8001) no Windows.
# Instala as dependências e roda o FastAPI. Mantenha rodando em um terminal
# separado, em paralelo ao `npm run dev`.
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot
python -m pip install -r requirements_rag.txt -q
python rag_server.py
