# Testes e critérios de aprovação

As suítes são separadas conforme a necessidade de acesso aos dados criptografados. A separação evita que um teste dependente de dados seja apresentado como aprovado quando a credencial não está disponível.

## Suíte pública

```bash
npm run test:public
```

Executa os 27 arquivos declarados em `tests/suite_manifest.py`, incluindo:

- integridade dos arquivos criptografados;
- estrutura, paths e contratos;
- sintaxe e servidores HTTP das cinco fases;
- aliases tributários e regimes sem dados protegidos;
- regressões de Monte Carlo, estoque, fallbacks, reconciliação e score com fixtures sintéticas.

O marcador de conclusão é `PUBLIC_TEST_SUITE_OK`. A mensagem `PROTECTED_TESTS_NOT_RUN` registra explicitamente o escopo não executado.

## Suíte completa

Configure `VISAGIO_DATA_PASSWORD` em `.env.local` ou no ambiente e rode:

```bash
npm test
```

A suíte acrescenta os 12 arquivos protegidos declarados no manifesto, cobrindo:

- contratos e reconciliação dos dados reais;
- baseline e cenários de ambas as empresas;
- regimes e transição tributária;
- score, stress, robustez e recomendação;
- importação, exportação, sessão e tratamento de falhas;
- E2E desktop e mobile;
- auditoria adversarial quantitativa e geração de evidências.

O marcador final é `FULL_TEST_SUITE_OK`. Sem a credencial, o runner para com `FULL_SUITE_BLOCKED` e nenhum teste protegido é considerado aprovado.

## Qualidade de código

```bash
npm run lint
npm run format:check
```

Os comandos executam ESLint e Ruff, além da verificação de formatação por Prettier e Ruff.

## CI e duas auditorias

O workflow `Quality` executa:

1. suíte pública;
2. Rodada 1 protegida em runner limpo;
3. Rodada 2 protegida em outro runner limpo, somente após aprovação da Rodada 1.

Cada rodada publica log e evidências próprios. A ausência do secret `VISAGIO_DATA_PASSWORD` reprova a etapa protegida; não existe `skip` silencioso.

## Princípio dos testes

Os testes quantitativos devem conferir fórmulas, valores, limites, componentes e invariantes. Verificações que apenas procuram texto ou a existência de um arquivo são usadas somente para contratos estruturais, nunca como prova de correção numérica.
