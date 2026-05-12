# Plano em 5 fases

## Fase 1 — Fundação e dados
Entrega: página `/fase-1-validacao` com seleção de empresa, catálogo de dados e qualidade dos dados.

## Fase 2 — Cenário base e paridade
Entrega: página `/fase-2-baseline` com baseline, custos calculados e Base Fit Score.

## Fase 3 — Cenários e comparação
Entrega: página `/fase-3-cenarios` com criador de cenários, comparação contra baseline e quality score.

## Fase 4 — Score customizado e otimização exata discreta
Entrega: página `/fase-4-score-otimizador` com Objective Builder, ranking e busca exata sobre o espaço discreto modelado.

## Fase 5 — Stress test, relatório e auditoria
Entrega: página `/fase-5-entrega-final` com stress test, explicabilidade, relatório executivo e audit trail.


## Documentação técnica obrigatória por módulo

Todo módulo planejado ou implementado precisa ter:

- fase de pertencimento;
- descrição objetiva do que faz;
- input em formato JSON;
- output em formato JSON;
- funções internas definidas pelo próprio módulo;
- chamadas para outros módulos;
- testes unitários, integração, manuais e aceite;
- critérios para não misturar Empresa 1 e Empresa 2.

A especificação completa está em `docs/23_MODULOS_TODAS_FASES_CONTRATOS.md` e em `data/contracts/module_contracts_all_phases.json`.
