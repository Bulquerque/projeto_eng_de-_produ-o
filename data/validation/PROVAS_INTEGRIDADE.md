# Provas de integridade — versão v6

Esta versão é a base limpa e auditada para reconstrução do simulador estático.

## Resultado principal

- Pacote: `visagio_static_simulator_base_VALIDADO_v6.zip`
- Workbooks XLSX verificados: 5
- Abas de workbook verificadas: 53
- Abas com export específico por fonte: 53
- Caminhos declarados faltantes: 0
- Arquivos core obrigatórios faltantes: 0
- Fórmulas externas detectadas: 0
- Relações externas detectadas: 0

## Arquivos de prova

- `data/validation/full_workbook_path_audit.json`
- `data/validation/workbook_sheet_inventory.csv`
- `data/validation/final_v6_audit_summary.json`
- `data/validation/path_resolution_report.json`
- `data/validation/regeneration_compare_report.json`

## Regra de uso

O site estático deve consumir os dados tratados de `data/empresa1/core/` e `data/empresa2/core/`.
Os exports em `data/<empresa>/source_exports/<source_id>/` são a prova por aba e por workbook de origem.
