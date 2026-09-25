# Estrutura do projeto

Este mapa descreve a estrutura presente no checkout. O projeto mantém duas superfícies de execução: a interface Network Intelligence e o portal/fluxos das fases. Ambas compartilham engines e utilitários; ainda não houve migração que torne uma delas substituta integral da outra.

## Entry points e navegação

- [`index.html`](index.html) é a entrada do site estático. Sempre carrega `assets/js/app/main.js`; esse módulo só inicializa a shell Network quando a query `ui=network-intelligence` ou a rota `#/network/...` a ativa.
- No modo de fases, um carregador inline em `index.html` importa os entry points `assets/js/phase1/main.js` a `phase5/main.js` e `assets/js/core/router.js`.
- [`fase-1-validacao/`](fase-1-validacao/), [`fase-2-baseline/`](fase-2-baseline/), [`fase-3-cenarios/`](fase-3-cenarios/), [`fase-4-score-otimizador/`](fase-4-score-otimizador/) e [`fase-5-entrega-final/`](fase-5-entrega-final/) são páginas de entrada para os fluxos correspondentes; verifique cada `index.html` antes de alterar sua navegação.
- [`debug/`](debug/) contém a entrada do Debug Center.

## Mapa de diretórios

| Caminho | Responsabilidade observada |
|---|---|
| `assets/js/app/` | Shell, estado, roteamento, bindings, páginas, providers e visualizações da Network UI. |
| `assets/js/core/` | Utilitários e serviços compartilhados, incluindo dados e roteamento legado. |
| `assets/js/phase1/` … `phase5/` | Entry points e módulos das superfícies por fase; alguns engines também são consumidos pela Network UI. |
| `assets/styles.css` e folhas específicas | Estilos globais e de cada interface. |
| `data-demo/empresa_mock/` | Fixture sintética para a demonstração pública da Network UI. |
| `data/` | Catálogos, contratos e derivados; pode haver arquivos protegidos, criptografados ou locais ignorados pelo Git. |
| `references/` | Fontes, documentos e materiais de referência do projeto. |
| `phases/` | Documentação de módulos, contratos, funções e testes por feature. |
| `docs/` | Documentação de arquitetura, método, dados, fases, aceite e releases. |
| `tests/` | Verificações automatizadas, testes por fase e fluxos E2E. |
| `etl/` e `scripts/` | Preparação/regeneração de dados e geração de evidências/pacotes. |
| `dist/` e `entregaveis/` | Saídas regeneráveis e locais; consulte os scripts e `.gitignore` antes de usá-las ou compartilhá-las. |

## Network Intelligence

```text
assets/js/app/main.js                bootstrap e coordenação da interface
assets/js/app/route-renderers.js      associação das rotas aos renderers
assets/js/app/router.js              rotas, aliases e mudança de página
assets/js/app/bindings.js             ações delegadas da shell
assets/js/app/form-values.js          parsing e validação puros dos formulários
assets/js/app/shell.js                estrutura global e seção ativa da navegação
assets/js/app/pages/                  renderers organizados por área
assets/js/app/providers/              provider sintético e provider protegido
assets/js/app/services/               serviços de decisão e risco
assets/js/phase1/csv-parser.js         parser CSV puro usado pela Fase 1
assets/js/phase1/table-view.js         builder de tabelas com escaping e formatação
assets/js/phase2/manual-checklist.js  checklist reutilizado pelo portal
assets/js/phase3/scenario-arena/      views de Monte Carlo/comparação e builder de linhas
assets/js/phase3/                    engines e coordenação do fluxo de cenários
assets/js/phase4/                    objetivos, busca e otimização
assets/js/phase5/                    decisão, controles, views e exportação de entrega
data-demo/empresa_mock/              dados sintéticos de demonstração
tests/12_network_intelligence/       contratos e E2E dessa interface
```

Os dashboards das fases coordenam estado, eventos e engines. As views extraídas recebem dados prontos e devolvem apresentação; elas não substituem nem duplicam cálculos de domínio. Consulte [`docs/05_testes_aceite/30_INVENTARIO_FEATURES_ACOES_UI.md`](docs/05_testes_aceite/30_INVENTARIO_FEATURES_ACOES_UI.md) para relacionar rotas, controles e cobertura de testes.

O provider sintético serve para exploração e demonstração. Os providers de empresa real seguem o fluxo local de desbloqueio descrito no [`README.md`](README.md); a disponibilidade do código não autoriza publicar fontes ou credenciais.

## Comandos principais

```bash
npm ci
python -m http.server 8000
```

Abra `http://localhost:8000/`. Para rodar o gate de testes, execute `npm test` (equivalente a `python tests/run_all_tests.py`). Para lint e formatação: `npm run lint` e `npm run format:check`. Para a Network UI: `npm run test:network`; para o escopo público: `npm run test:public`. Os detalhes e limites estão em [`tests/README.md`](tests/README.md).

## Navegação documental

- [`README.md`](README.md) — instalação, execução, dados e limites do modelo.
- [`docs/README.md`](docs/README.md) — índice da documentação.
- [`phases/README.md`](phases/README.md) — documentação por feature/módulo.
- [`CONTRIBUTING.md`](CONTRIBUTING.md) — processo local de contribuição.
