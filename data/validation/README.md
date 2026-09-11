# Validação e auditoria

Esta pasta contém evidências reproduzíveis ou relatórios de referência do pacote. Os testes E2E escrevem em `presentation_e2e/` e `regression_evidence/`; os demais arquivos são entradas técnicas preservadas para auditoria.

Relatórios principais:

```text
path_resolution_report.json
full_workbook_path_audit.json
audit-summary.json
release-report.json
protected-data-integrity.json
workbook_sheet_inventory.csv
phase1_implementation_report.json
phase2_test_results.json ... phase5_test_results.json
```

Os diretórios de evidência têm política simples de retenção: uma execução atual por fluxo.
Uma mesma captura não deve ser copiada com nomes de casos diferentes; quando dois fluxos
usarem o mesmo estado visual, o relatório deve referenciar o mesmo arquivo e registrar o
SHA-256. Capturas exploratórias e pacotes antigos não fazem parte do estado operacional.
