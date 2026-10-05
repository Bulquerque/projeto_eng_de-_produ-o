# Manifesto de Release Final

Release: `visagio_static_simulator_1.0`

Status: código do PR #3 validado pelo CI no commit `ea0abe1161176dc8b051cf466c55bd27f80f1f97`
(branch `codex/interface-guiada`). A execução `37388863844` concluiu com sucesso em
05/10/2026: `Public quality suite` e `Protected data suite (same-repository PRs only)`.
O fluxo protegido passou pela verificação de credencial e executou `npm test`. Isso valida
o commit indicado no CI; não afirma que a cópia local atual tenha repetido o gate. O registro
de uma tentativa local anterior com `InvalidTag` permanece documentado como diagnóstico
daquele checkout/ambiente, não como estado da validação do PR. Consulte
[`docs/05_testes_aceite/README.md`](../05_testes_aceite/README.md) para os detalhes.

O registro-fonte da release 1.0 está em
[`data/release-manifest.json`](../../data/release-manifest.json). Ele foi gerado em
12/09/2026 para o commit `f939684a77cd4f58374bd164f7e72ca6544c73c4`; seus estados
aprovados descrevem aquele registro histórico, não o checkout atual.
O inventário atual de documentação e testes está em
[`22_DOCUMENTATION_MANIFEST.json`](22_DOCUMENTATION_MANIFEST.json). Ele é gerado e
verificado por `scripts/manage_documentation_inventory.py`; regenere-o depois de alterar
esses arquivos. O manifesto de evidências de validação, seus hashes e a política de
proveniência estão descritos em [`data/validation/README.md`](../../data/validation/README.md)
e registrados em `data/validation/evidence-manifest.json`.

Páginas implementadas:

- `/`
- `/fase-1-validacao/`
- `/fase-2-baseline/`
- `/fase-3-cenarios/`
- `/fase-4-score-otimizador/`
- `/fase-5-entrega-final/`

A Fase 5 conclui o simulador com stress test, sensibilidade, robustez, recomendação,
relatório executivo, audit trail, export center e QA final. A validação automatizada
canônica é `npm run quality`; seu marcador final é
`ALL_PHASE5_PACKAGE_TESTS_OK`. No CI do commit acima, a suíte pública foi executada por
`npm run quality:public` e a suíte protegida por `npm test`.
