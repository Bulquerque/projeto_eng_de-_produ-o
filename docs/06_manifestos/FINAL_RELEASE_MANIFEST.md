# Manifesto de Release Final

Release: `visagio_static_simulator_1.0`

Status: pronto para entrega dentro do escopo do simulador estático, com limitações
metodológicas documentadas.

Fonte canônica: [`data/release-manifest.json`](../../data/release-manifest.json).
O manifesto de documentação completo está em
[`22_DOCUMENTATION_MANIFEST.json`](22_DOCUMENTATION_MANIFEST.json).

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
`ALL_PHASE5_PACKAGE_TESTS_OK`.
