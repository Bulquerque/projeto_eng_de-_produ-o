# Caminhos, fontes e regeneração

Este pacote usa caminhos relativos a partir da raiz do site estático. Exemplo:

```text
index.html
assets/app.js
data/catalog.json
data/empresa1/core/demand_records.json
data/empresa2/core/scenario_blocks.json
```

## Prova de caminhos

O arquivo `data/validation/path_resolution_report.json` foi gerado para conferir:

- caminhos declarados em `data/catalog.json`;
- caminhos usados por `index.html`;
- caminhos usados por `assets/app.js`;
- arquivos brutos declarados em `references/source_documents_manifest.csv`;
- hashes SHA256 dos arquivos brutos contra os originais enviados.

Resultado atual: `OK`.

## Regeneração

O script original de geração está preservado fora do pacote em `etl/build_verified_package_source_v2.py`. Para a próxima versão do projeto, recomenda-se mover uma versão limpa dele para `etl/` e fazer dele o ETL oficial. Nesta versão, o pacote já inclui os CSV/JSON formatados e o relatório de auditoria.

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
