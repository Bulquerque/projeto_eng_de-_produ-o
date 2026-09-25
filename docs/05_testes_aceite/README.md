# Testes e aceite

Use estes documentos para distinguir o inventário do produto, os resultados da suíte local e o estado do Site publicado.

## Estado atual — 25/09/2026

- [Inventário de features, rotas e ações da interface](30_INVENTARIO_FEATURES_ACOES_UI.md): mapa para planejar testes; não afirma que cada controle foi clicado manualmente.
- [Relatório de QA do Site publicado](31_RELATORIO_QA_SITE_PUBLICADO_2026-09-25.md): a versão pública observada está atrás do checkout e o problema de destaque do menu continua visível nela. O relatório registra o que falta conferir no ambiente publicado.
- [Evidências visuais históricas](historico/2026-09-13_15_network-intelligence/README.md): capturas de uma rodada local anterior; não usar como prova do Site atual.

## Gate local

No checkout em 25/09/2026, `npm run quality` passou após as refatorações incrementais e executou formatação/lint, contratos, validações por fase e fluxos E2E de apresentação, regressão e Network Intelligence. Para repetir a verificação no estado atual do código, execute:

```bash
npm run quality
```

Um resultado local verde não atualiza a publicação nem substitui a verificação de todos os controles, do console e da rede no navegador ao vivo.
