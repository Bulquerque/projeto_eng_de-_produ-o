# Validação e auditoria

Esta pasta preserva relatórios e artefatos de validação de diferentes execuções. Não trate
um arquivo como evidência atual só por estar versionado: use o comando de validação atual
e confira a proveniência registrada no próprio relatório. Os testes E2E escrevem em
`presentation_e2e/` e `regression_evidence/`; os demais arquivos são referências técnicas
preservadas para auditoria.

## Proveniência e integridade

`evidence-manifest.json` lista os arquivos desta pasta com tamanho e SHA-256, associados
ao commit a partir do qual o inventário foi gerado. O script não altera os relatórios nem
infere a data em que foram executados. A associação do inventário ao commit não prova que
um artefato foi produzido naquele commit ou que seu resultado continua válido.

Para atualizar e conferir o inventário depois de alterar evidências:

```bash
python scripts/manage_validation_evidence_manifest.py --write
python scripts/manage_validation_evidence_manifest.py --check
```

Relatórios novos devem incluir, quando aplicável: `generated_at` em ISO 8601 com fuso,
`tested_commit`, comandos executados, versões das ferramentas, escopo, resultado e
limitações. Evidências antigas sem esses campos continuam preservadas, mas devem ser
tratadas como históricas/não verificadas até que a validação seja repetida. Para imagens,
registre o fluxo e viewport no relatório e o SHA-256; uma imagem não comprova console,
rede, origem dos dados ou comportamento além do estado visível.

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
Capturas e relatórios substituídos com valor de comparação/auditoria devem ficar em
`docs/05_testes_aceite/historico/<data>-<tema>/`, acompanhados por README de proveniência;
não devem ser apresentados como estado operacional atual. Evite duplicar capturas: quando
dois fluxos usarem o mesmo estado visual, referencie o mesmo arquivo e registre o SHA-256.
Remova artefatos apenas quando forem redundantes ou sem valor de auditoria e nenhum
relatório depender deles. Nunca preserve credenciais ou conteúdo protegido em evidências.
