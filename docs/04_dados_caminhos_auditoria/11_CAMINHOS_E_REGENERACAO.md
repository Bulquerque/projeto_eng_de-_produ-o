# Caminhos, fontes e regeneração

Este pacote usa caminhos relativos a partir da raiz do site estático. Exemplo:

```text
index.html
assets/js/phase1/main.js
data/catalog.json
data/empresa1/core/demand_records.json
data/empresa2/core/scenario_blocks.json
```

## Prova de caminhos

O arquivo `data/validation/path_resolution_report.json` foi gerado para conferir:

- caminhos declarados em `data/catalog.json`;
- caminhos usados por `index.html`;
- caminhos usados por `assets/js/phase1/main.js`;
- envelopes criptografados declarados em `references/source_documents_manifest.csv`;
- hashes SHA256 dos arquivos brutos contra os originais enviados.

Resultado atual: `OK`.

## Regeneração

O repositório contém [`etl/build_phase2_baseline.py`](../../etl/build_phase2_baseline.py), um gerador versionado específico dos artefatos da Fase 2. Ele consome JSON já normalizado em `data/**/core/`, atualiza `data/catalog.json` e grava JSON derivados em `data/**/phase2/` e `data/validation/`. Não é o extrator das planilhas XLSX nem um pipeline para reconstruir todas as fontes do pacote. Consulte [`etl/README_ETL.md`](../../etl/README_ETL.md) antes de executá-lo: a execução grava saídas em texto simples e pode sobrescrever arquivos de dados existentes.

A regeneração dos artefatos não faz parte da suíte comum de validação. Para verificar o pacote existente sem invocar o gerador, execute os testes da Fase 2 listados em `etl/README_ETL.md`.

## Observação importante sobre Empresa 2

A aba `Cenários` da Empresa 2 não é uma tabela única. Ela tem blocos internos:

- Cenário 1 / 4 CDs;
- Cenário 2 / 1 CD ES;
- Cenário N.

Por isso, além do export bruto `data/empresa2/core/cenarios.csv`, foram criados:

- `data/empresa2/core/scenario_blocks.json`;
- `data/empresa2/core/scenario_totals.json`;
- `data/empresa2/core/scenario_totals.csv`.

Esses são os arquivos certos para usar no simulador quando o assunto for comparar cenários prontos da planilha.
