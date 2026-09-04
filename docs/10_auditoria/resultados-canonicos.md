# Resultados canônicos

Os valores abaixo devem ser gerados pela execução protegida da prova-bala. Eles não são substituídos para coincidir com o PDF anterior.

## Baselines

| Empresa | Baseline estrutural atual | Baseline comparável: reforma 2033 |
|---|---:|---:|
| Empresa 1 | R$ 118.694.234,30 | R$ 156.868.606,74 |
| Empresa 2 | R$ 49.655.885,59 | R$ 85.105.332,59 |

O baseline estrutural preserva o cenário operacional atual e o regime atual. O baseline comparável mantém o mesmo cenário físico, mas aplica o regime fiscal usado na comparação de reforma. O saving dos candidatos usa exclusivamente o baseline comparável da mesma empresa.

## Recomendações por perfil

| Empresa | Perfil | Cenário | CDs | Custo total | Saving | Robustez |
|---|---|---|---:|---:|---:|---:|
| Empresa 1 | todos os quatro perfis | `empresa1_candidate_015` | 14 | R$ 155.296.806,21 | 1,001985% | 37,85 |
| Empresa 2 | custo mínimo | `empresa2_candidate_005` | 1 | R$ 77.022.539,91 | 9,497399% | 99,10 |
| Empresa 2 | equilibrado, conservador e qualidade/serviço | `empresa2_candidate_010` | 2 | R$ 80.636.126,57 | 5,251382% | 82,80 |

O resultado da Empresa 2 muda com o perfil. O resultado da Empresa 1 permanece no mesmo candidato, mas não deve ser chamado de ótimo global: é o melhor cenário dentro do espaço avaliado.

## Monte Carlo

A execução exploratória usa 300 iterações, seed 42 e perfil `balanced`. Os spreads são premissas manuais e não possuem calibração histórica validada. A prova-bala deve ser consultada para os percentis e a probabilidade da execução mais recente; esses valores não devem ser transcritos manualmente sem regeneração.

## Regras de publicação

- Saving absoluto = baseline comparável − custo do cenário.
- Saving percentual = saving absoluto ÷ baseline comparável.
- Componentes devem somar o total antes do arredondamento.
- Valores observados do workbook não são apresentados como resultado simulado.
- Ausência de benchmark independente é publicada como `benchmark pendente`.
