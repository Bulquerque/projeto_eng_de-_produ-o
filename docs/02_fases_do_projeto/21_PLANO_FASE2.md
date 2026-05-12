# Plano da Fase 2 — Cenário base e paridade com a realidade

Este documento define o próximo passo depois da Fase 1.

## Objetivo da Fase 2

Construir a primeira camada de simulação real: o cenário base de cada empresa.

A pergunta da Fase 2 é:

> o simulador consegue reconstruir o cenário atual de cada empresa com erro visível e controlado?

## Entregas principais

1. `BaselineBuilder`
2. `CostEngine` inicial
3. `BaseFitScore`
4. Página de cenário base por empresa
5. Tabela real vs simulado
6. Erros por componente
7. Alertas de calibração

## Módulo `BaselineBuilder`

### Input esperado

```json
{
  "company": "empresa1",
  "catalog": {},
  "baseline": {},
  "coreData": {}
}
```

### Output esperado

```json
{
  "scenario_id": "baseline_empresa1",
  "company": "empresa1",
  "active_cds": [],
  "flows": [],
  "baseline_ready": true,
  "warnings": []
}
```

## Módulo `CostEngine`

Deve calcular no mínimo:

```text
custo de transferência
custo de distribuição
custo de armazenagem
custo de estoque
custo total logístico
```

## Módulo `BaseFitScore`

Deve comparar:

```text
valor real/base
valor simulado
erro absoluto
erro percentual
status
```

## Página nova sugerida

```text
/fase-2-baseline/
```

Ela deve mostrar:

```text
Empresa selecionada
Cenário base reconstruído
Custos simulados
Valores reais/base quando existirem
Erro por componente
Base Fit Score
Alertas de calibração
```

## Critério de aceite da Fase 2

A Fase 2 estará pronta quando:

1. Empresa 1 tiver baseline reconstruído com os dados disponíveis.
2. Empresa 2 tiver baseline reconstruído a partir do workbook.
3. O site mostrar real vs simulado quando houver base real.
4. O erro não for escondido.
5. O sistema deixar claro quando uma métrica ainda não pode ser calibrada.

## Atenção importante

Para a Empresa 1, pode faltar custo histórico real para calibrar algumas métricas. Nesse caso, a interface deve dizer explicitamente:

```text
baseline calculável, mas sem benchmark histórico completo para Base Fit Score final
```

Não inventar dado histórico.
