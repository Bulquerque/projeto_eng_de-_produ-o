# phase-02-baseline-parity

Organização por feature da Fase 2.

- [`BaseFitScore`](modules/BaseFitScore/README.md) — Valida se o score de paridade do baseline está coerente com a referência.
- [`BaselineBuilder`](modules/BaselineBuilder/README.md) — Constrói o objeto de cenário base a partir do input normalizado.
- [`BaselineDashboard`](modules/BaselineDashboard/README.md) — Renderiza resumo, custos, fluxos, tributo, evidências e warnings do baseline.
- [`BaselineDataAdapter`](modules/BaselineDataAdapter/README.md) — Normaliza o bundle da Fase 2 para um contrato comum entre Empresa 1 e Empresa 2.
- [`CalibrationPanel`](modules/CalibrationPanel/README.md) — Renderiza Base Fit Score, tabela de erro e warnings de calibração.
- [`CostEngine`](modules/CostEngine/README.md) — Valida o fechamento dos custos logísticos e total com tributo.
- [`DistanceResolver`](modules/DistanceResolver/README.md) — Resolve e valida distâncias entre origem e destino quando necessário.
- [`FlowBuilder`](modules/FlowBuilder/README.md) — Resume e valida os fluxos físicos do baseline.
- [`Phase2TestPanel`](modules/Phase2TestPanel/README.md) — Executa e renderiza testes automáticos da Fase 2 no navegador.
- [`ReferenceResultExtractor`](modules/ReferenceResultExtractor/README.md) — Extrai a referência de baseline usada para Base Fit Score.
- [`TaxEngineBasic`](modules/TaxEngineBasic/README.md) — Resume e valida a camada tributária básica da Fase 2.
