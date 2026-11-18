# Testes e aceite

Use estes documentos para distinguir o inventário do produto, os resultados da suíte local e o estado do Site publicado.

## Registro de QA — 05/10/2026

- [Inventário de features, rotas e ações da interface](30_INVENTARIO_FEATURES_ACOES_UI.md): mapa para planejar testes; não afirma que cada controle foi clicado manualmente.
- [Inventário exaustivo de botões, controles e funcionalidades](32_INVENTARIO_EXAUSTIVO_BOTOES_E_FEATURES.md): catálogo com aviso explícito de que os controles do portal antigo são históricos.
- [Checklist completa de botões e funcionalidades](33_CHECKLIST_COMPLETA_BOTOES_E_FEATURES.md): roteiro marcável para inspeção manual de todas as telas, ações, campos, downloads e estados.
- [Relatório de QA do Site publicado](31_RELATORIO_QA_SITE_PUBLICADO_2026-09-25.md): evidência histórica de 25/09; não representa a versão ou o comportamento do site em 05/10.
- [Evidências visuais históricas](historico/2026-09-13_15_network-intelligence/README.md): capturas de uma rodada local anterior; não usar como prova do Site atual.

## Gate local

Em 05/10/2026, lint, formatação, Ruff e a suíte pública passaram. `npm run quality` alcançou a suíte protegida e parou em `test_reference_source_encryption.py`: a autenticação AES-GCM das fontes arquivadas retornou `InvalidTag`. Esse erro não distingue credencial incompatível de envelope alterado; não recriptografe os arquivos sem verificar a chave correta. Os testes subsequentes de invariantes e evidência de incerteza passaram quando executados separadamente. Portanto, o gate completo permanece **não aprovado** nesta revisão.

Para repetir a verificação:

```bash
npm run quality
```

Um resultado local verde não atualiza a publicação nem substitui a verificação funcional/visual do site publicado.
