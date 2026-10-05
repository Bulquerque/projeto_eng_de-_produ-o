# Fase 4 Implementada — Critérios, classificação e comparação de alternativas

## Objetivo

A Fase 4 transforma o simulador de cenários da Fase 3 em uma ferramenta de apoio à decisão. O usuário escolhe critérios e pesos, define restrições, gera candidatos e compara sua classificação no navegador.

## Página entregue

```text
/fase-4-score-otimizador/
```

## Escopo implementado

- Critérios de avaliação com pesos customizados.
- Perfis prontos: Balanceado, CFO, Supply, Fiscal, Conservador e Crescimento.
- Validação de pesos e métricas.
- Extração de métricas dos cenários simulados.
- Normalização 0-100.
- Score ponderado.
- Ranking de cenários.
- Restrições operacionais.
- Gerador de candidatos.
- Avaliação dos candidatos gerados dentro do espaço discreto modelado.
- Search log.
- Explicação do ranking.
- Fronteira simples custo vs qualidade.
- Testes automáticos na página.
- Checklist manual.

## Observação metodológica

O mecanismo classifica somente os candidatos que efetivamente gerou e avaliou, usando os critérios e limites selecionados. Uma cobertura completa indica que todo o espaço discreto declarado foi percorrido; isso não demonstra um ótimo matemático para o problema real nem para variáveis ausentes do modelo.
