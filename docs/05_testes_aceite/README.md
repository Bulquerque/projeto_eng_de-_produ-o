# Testes e aceite

Use estes documentos para distinguir o inventário do produto, os resultados da suíte local e o estado do Site publicado.

## Registro de QA — 05/10/2026

- [Inventário de features, rotas e ações da interface](30_INVENTARIO_FEATURES_ACOES_UI.md): mapa para planejar testes; não afirma que cada controle foi clicado manualmente.
- [Inventário exaustivo de botões, controles e funcionalidades](32_INVENTARIO_EXAUSTIVO_BOTOES_E_FEATURES.md): catálogo com aviso explícito de que os controles do portal antigo são históricos.
- [Checklist completa de botões e funcionalidades](33_CHECKLIST_COMPLETA_BOTOES_E_FEATURES.md): roteiro marcável para inspeção manual de todas as telas, ações, campos, downloads e estados.
- [Relatório de QA do Site publicado](31_RELATORIO_QA_SITE_PUBLICADO_2026-09-25.md): evidência histórica de 25/09; não representa a versão ou o comportamento do site em 05/10.
- [Evidências visuais históricas](historico/2026-09-13_15_network-intelligence/README.md): capturas de uma rodada local anterior; não usar como prova do Site atual.

## Validação do PR #3

O CI do GitHub Actions executou o commit `ea0abe1161176dc8b051cf466c55bd27f80f1f97`
(`codex/interface-guiada`) na execução [37388863844](https://github.com/Bulquerque/projeto_eng_de-_produ-o/actions/runs/37388863844),
associada ao [PR #3](https://github.com/Bulquerque/projeto_eng_de-_produ-o/pull/3), em
05/10/2026. A execução terminou com sucesso: `Public quality suite` rodou
`npm run quality:public`; `Protected data suite (same-repository PRs only)` passou pela
verificação de credencial e rodou `npm test`. Isso é evidência de CI para aquele SHA. As
edições documentais deste registro são posteriores à execução e não foram incluídas nela.

Uma tentativa local anterior, em 05/10/2026, passou lint, formatação, Ruff e a suíte
pública, mas parou em `test_reference_source_encryption.py` com `InvalidTag` ao autenticar
fontes arquivadas. Esse resultado descreve somente aquele checkout/ambiente; não substitui
nem invalida o CI concluído para o SHA do PR. `InvalidTag` isoladamente não distingue
credencial incompatível de envelope alterado. Não recriptografe arquivos sem verificar a
chave correta. Os testes subsequentes de invariantes e evidência de incerteza passaram
quando executados separadamente.

Para repetir a verificação:

```bash
npm run quality
```

Um resultado local ou do CI não atualiza a publicação nem substitui a verificação
funcional/visual do site publicado. Para o fluxo de integração deste repositório, `main` é
a branch canônica e mudanças de feature são integradas por pull request; o sucesso do CI
acima não significa que o PR tenha sido integrado.
