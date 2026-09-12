# Auditoria final v6 — caminhos, abas e dados do pacote

## Resultado

Status: **OK**.

Esta versão confere, de cabo a rabo, os caminhos de execução do site e o mapeamento das abas das planilhas enviadas.

## O que foi verificado

- Todos os arquivos declarados em `data/catalog.json` existem.
- `index.html`, `assets/styles.css` e `assets/js/phase1/main.js` existem e usam caminhos relativos.
- As duas empresas continuam separadas.
- Os 5 workbooks XLSX enviados são rastreados por hashes e envelopes criptografados em `references/raw_sources/`; os arquivos plaintext ficam fora do repositório público.
- As 53 abas encontradas nesses workbooks têm export próprio em `data/<empresa>/source_exports/<source_id>/`.
- As tabelas tratadas de simulação estão em `data/empresa1/core/` e `data/empresa2/core/`.
- A aba `Cenários` da Empresa 2 tem tratamento especial por blocos em `scenario_blocks.json` e `scenario_totals.json`.

## Números auditados

- Workbooks verificados: 5
- Abas verificadas: 53
- Abas exportadas: 53
- Caminhos faltantes: 0
- Arquivos core faltantes: 0
- Fórmulas externas: 0
- Relações externas de workbook: 0

## Arquivos para conferência manual

- `data/validation/workbook_sheet_inventory.csv`: uma linha por aba, com workbook, source_id, nome da aba, dimensão e caminho do CSV exportado.
- `data/validation/full_workbook_path_audit.json`: relatório completo em JSON.
- `data/validation/audit-summary.json`: resumo final, mais fácil de ler.

## Como testar

```bash
python tests/00_basicos/check_package.py
python tests/01_paths_auditoria/test_full_workbook_paths.py
python tests/01_paths_auditoria/test_paths_and_regeneration.py
python tests/01_paths_auditoria/test_final_deep_audit.py
```

Resultado esperado:

```text
PACKAGE_CHECK_OK
FULL_WORKBOOK_PATH_AUDIT_OK
REGENERATION_AND_PATH_CHECK_OK
FINAL_DEEP_AUDIT_OK
```
