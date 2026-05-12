# Fase 3 implementada — Criador e Comparador de Cenários

A Fase 3 transforma o baseline da Fase 2 em uma arena de cenários. A página principal é `/fase-3-cenarios/`.

## Entregas

- seleção de Empresa 1 e Empresa 2 sem mistura de dados;
- biblioteca de cenários com baseline, exemplos e cenários salvos;
- criador manual de cenário;
- validação estrutural do cenário;
- realocação de fluxos quando CDs são fechados;
- simulação de custo logístico e tributo básico;
- comparação contra baseline;
- saving absoluto e percentual;
- quality score e risco;
- explicação textual das mudanças;
- localStorage por empresa;
- exportação/importação JSON;
- testes automáticos e checklist manual.

## Limites metodológicos

A Fase 3 ainda não é otimizador. A realocação usa heurística auditável (`nearest_available_cd`) e não deve ser vendida como ótimo global. O otimizador entra na Fase 4.
