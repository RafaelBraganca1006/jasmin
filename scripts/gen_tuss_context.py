"""
Gera lib/tuss-data.ts a partir da tabela TUSS odontológica vigente.

Lê knowledge_base/TUSS_Odontologica_Jasmin.xlsx UMA vez (build-time) e emite um
módulo TypeScript estático com:

  TUSS_CONTEXT_STRING  — bloco formatado (~370 linhas) injetado no system prompt
                          do Passo 4 do agente de prontuário.
  TUSS_INDEX           — Record<codigo, { descricao, categoria }> para o agente de
                          cobrança validar/buscar a descrição oficial sem RAG.

Rode quando a tabela mudar:

    python scripts/gen_tuss_context.py      (ou: npm run gen:tuss)

Usa openpyxl (mesma dep do indexador RAG). NÃO é executado em runtime: o produto
é o lib/tuss-data.ts versionado.
"""
import json
import os
import sys

import openpyxl

try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
XLSX = os.path.join(ROOT, "knowledge_base", "TUSS_Odontologica_Jasmin.xlsx")
OUT = os.path.join(ROOT, "lib", "tuss-data.ts")
SHEET = "Todos os Procedimentos"

# Nota fixa anexada ao final do contexto (regras de faturamento que não saem da
# tabela linha a linha).
NOTA = (
    "NOTA: Curativo de demora (85100056) é faturável SEPARADO do canal quando a "
    "obturação não foi concluída na mesma sessão. Anestesia NÃO é faturável "
    "separadamente. Raio-x periapical (81000421) É faturável separadamente quando "
    "realizado."
)


def norm(v):
    return ("" if v is None else str(v)).strip()


def build_inclui(categoria, descricao):
    """Gera o campo 'inclui' de forma determinística por categoria + descrição.

    Só preenche onde há regra conhecida; caso contrário devolve "" (não inventa).
    """
    cat = categoria.lower()
    desc = descricao.lower()

    if "endodontia" in cat and ("tratamento endod" in desc or "retratamento endod" in desc):
        return (
            "abertura coronária, preparo químico-mecânico, "
            "obturação ou curativo de demora quando sessão única"
        )
    if "dentística" in cat and "restauração" in desc:
        return "remoção de cárie, proteção pulpar, restauração"
    if "cirurgia" in cat and ("exodontia" in desc or "extração" in desc):
        return "sindesmotomia, luxação, avulsão, sutura simples"
    if "periodontia" in cat and "raspagem" in desc:
        return "raspagem supra e subgengival, polimento"
    if "prevenção" in cat and "profilaxia" in desc:
        return "remoção de placa, polimento coronário, orientação"
    return ""


def main():
    if not os.path.isfile(XLSX):
        print(f"ERRO: {XLSX} não existe.")
        sys.exit(1)

    wb = openpyxl.load_workbook(XLSX, read_only=True, data_only=True)
    ws = wb[SHEET]
    rows = list(ws.iter_rows(min_row=2, values_only=True))
    wb.close()

    lines = []        # linhas do contexto: "codigo | descricao | inclui: ..."
    index = {}        # codigo -> { descricao, categoria }
    descartadas = 0

    for r in rows:
        codigo = norm(r[0])
        categoria = norm(r[1])
        descricao = norm(r[2])
        # Só odontologia própria (códigos 8xxxxxxx). Descarta as linhas de
        # "cirurgia compartilhada" (30x/40x), de vigência expirada.
        if not codigo.startswith("8") or not descricao:
            descartadas += 1
            continue

        inclui = build_inclui(categoria, descricao)
        suffix = f" | inclui: {inclui}" if inclui else " | inclui:"
        lines.append(f"{codigo} | {descricao}{suffix}")
        index[codigo] = {"descricao": descricao, "categoria": categoria}

    context = "\n".join(lines) + "\n\n" + NOTA

    # Emite o módulo TS. A string vai como JSON (escapa aspas/quebras com
    # segurança); o TS aceita string literal com \n.
    ts = (
        "// GERADO por scripts/gen_tuss_context.py — NÃO editar à mão.\n"
        "// Fonte: knowledge_base/TUSS_Odontologica_Jasmin.xlsx "
        f"({len(lines)} procedimentos odontológicos vigentes).\n"
        "// Regere com: npm run gen:tuss\n\n"
        "/** Uma entrada oficial da tabela TUSS odontológica. */\n"
        "export interface TussDataEntry {\n"
        "  descricao: string;\n"
        "  categoria: string;\n"
        "}\n\n"
        "/** Bloco formatado para o system prompt do Passo 4 (uma linha por procedimento). */\n"
        f"export const TUSS_CONTEXT_STRING: string = {json.dumps(context, ensure_ascii=False)};\n\n"
        "/** codigo_tuss -> descrição oficial + categoria. Lookup exato, sem RAG. */\n"
        f"export const TUSS_INDEX: Record<string, TussDataEntry> = {json.dumps(index, ensure_ascii=False, indent=2)};\n"
    )

    with open(OUT, "w", encoding="utf-8", newline="\n") as f:
        f.write(ts)

    com_inclui = sum(1 for ln in lines if not ln.rstrip().endswith("| inclui:"))
    print(f"OK: {len(lines)} procedimentos → {os.path.relpath(OUT, ROOT)}")
    print(f"  com 'inclui' preenchido: {com_inclui}")
    print(f"  linhas descartadas (não-8xxx/sem descrição): {descartadas}")


if __name__ == "__main__":
    main()
