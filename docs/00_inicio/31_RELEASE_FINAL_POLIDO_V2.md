# Release final — Simulador Estático Visagio

## Status

Pacote tecnicamente entregável dentro do escopo do simulador estático: Fases 1 a 5
preservadas, Fase 2 modularizada, Debug Center adicionado e documentação organizada
por fase/módulo. Recomendações continuam condicionadas à qualidade dos dados e aos
gates metodológicos registrados.

## Principais mudanças

- Visual mais clean e moderno em `assets/styles.css`, mantendo a paleta institucional usada no pacote.
- Fase 2 separada em módulos JS próprios: `BaselineBuilder`, `BaselineDataAdapter`, `FlowBuilder`, `TaxEngineBasic`, `ReferenceResultExtractor`, `CalibrationPanel` e outros.
- Nova pasta `debug/` com uma página de diagnóstico para localizar problemas de paths, módulos, dados e testes.
- Nova pasta `phases/`, organizada por fase e módulo, com `README.md`, `contract.json`, `functions.md` e `tests.md` por módulo.
- Testes novos em `tests/09_quality_checks/`.
- Relatório de preservação em `data/validation/protected-data-integrity.json`.

## Como validar

```bash
python tests/00_basicos/check_package.py
python tests/09_quality_checks/test_protected_data_integrity.py
python tests/09_quality_checks/test_phase2_refactor_modules.py
python tests/09_quality_checks/test_debug_system.py
python tests/09_quality_checks/test_phase_folders_and_module_docs.py
```

Para validar a release, use `npm run quality`. O comando encerra com
`ALL_PHASE5_PACKAGE_TESTS_OK` e inclui os E2E de apresentação e regressão. O teste
Playwright legado da Fase 1 permanece opcional.

## Páginas principais

- `/` — início
- `/fase-1-validacao/` — dados e auditoria
- `/fase-2-baseline/` — baseline e paridade
- `/fase-3-cenarios/` — criação/comparação de cenários
- `/fase-4-score-otimizador/` — scoring e otimização exata discreta
- `/fase-5-entrega-final/` — stress, relatório, auditoria e export
- `/debug/` — Debug Center

## Observação

A pasta `phases/` organiza a documentação e os contratos por feature/módulo. Os caminhos runtime originais foram mantidos para não quebrar o site estático.
