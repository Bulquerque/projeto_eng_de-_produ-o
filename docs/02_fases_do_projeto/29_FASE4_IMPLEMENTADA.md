# Fase 4 Implementada — Score, Ranking e Otimizador Leve

## Objetivo

A Fase 4 transforma o simulador de cenários da Fase 3 em um motor de decisão. O usuário escolhe uma função objetivo, define restrições, gera um espaço discreto de cenários e roda uma otimização exata no navegador.

## Página entregue

```text
/fase-4-score-otimizador/
```

## Escopo implementado

- Objective Builder com pesos customizados.
- Perfis prontos: Balanceado, CFO, Supply, Fiscal, Conservador e Crescimento.
- Validação de pesos e métricas.
- Extração de métricas dos cenários simulados.
- Normalização 0-100.
- Score ponderado.
- Ranking de cenários.
- Restrições operacionais.
- Gerador de candidatos.
- Otimização exata no navegador sobre o espaço discreto modelado.
- Search log.
- Explicação do ranking.
- Fronteira simples custo vs qualidade.
- Testes automáticos na página.
- Checklist manual.

## Observação metodológica

O otimizador da Fase 4 é exato dentro do espaço discreto modelado pela página. Ele não promete ótimo global fora desse espaço, mas prova o melhor cenário viável entre os candidatos enumerados com desempate determinístico.
