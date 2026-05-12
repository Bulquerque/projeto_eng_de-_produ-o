# Release Final Polido v2 — Simulador Estático Visagio

## Status

Pacote pronto para uso como versão polida: Fases 1 a 5 preservadas, Fase 2 modularizada, Debug Center adicionado e documentação reorganizada por fase/módulo.

## Principais mudanças

- Visual mais clean e moderno em `assets/styles.css`, mantendo a paleta institucional usada no pacote.
- Fase 2 separada em módulos JS próprios: `BaselineBuilder`, `BaselineDataAdapter`, `FlowBuilder`, `DistanceResolver`, `TaxEngineBasic`, `ReferenceResultExtractor`, `CalibrationPanel` e outros.
- Nova pasta `debug/` com uma página de diagnóstico para localizar problemas de paths, módulos, dados e testes.
- Nova pasta `phases/`, organizada por fase e módulo, com `README.md`, `contract.json`, `functions.md` e `tests.md` por módulo.
- Testes novos em `tests/09_polish_debug_restructure/`.
- Relatório de preservação em `data/validation/file_preservation_report.json`.

## Como validar

```bash
python tests/00_basicos/check_package.py
python tests/09_polish_debug_restructure/test_polish_file_preservation.py
python tests/09_polish_debug_restructure/test_phase2_refactor_modules.py
python tests/09_polish_debug_restructure/test_debug_system.py
python tests/09_polish_debug_restructure/test_phase_folders_and_module_docs.py
```

Para rodar todas as fases, use os testes por grupo caso o ambiente tenha timeout.

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
