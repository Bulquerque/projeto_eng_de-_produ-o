# Visagio Static Simulator

Simulador estático de malha logística com validação de dados, baseline, cenários, análise tributária parametrizada, otimização e entrega executiva. O runtime roda no navegador com JavaScript modular e carrega os dados protegidos somente após desbloqueio local.

## Comece aqui

1. Instale as dependências JavaScript com `npm ci`.
2. Configure `VISAGIO_DATA_PASSWORD` somente no ambiente local ou em `.env.local`.
3. Suba o site:

```bash
python -m http.server 8000
```

4. Abra [http://localhost:8000](http://localhost:8000).

Rotas principais:

- `/` — visão geral e validação inicial;
- `/fase-1-validacao/` — dados, caminhos e qualidade;
- `/fase-2-baseline/` — baseline, custos, tributo e paridade;
- `/fase-3-cenarios/` — criação, simulação e comparação;
- `/fase-4-score-otimizador/` — função objetivo e busca discreta;
- `/fase-5-entrega-final/` — stress test, robustez, recomendação e exportação;
- `/debug/` — diagnóstico de paths, módulos e carregamento.

## Qualidade e testes

O comando recomendado para validar a árvore inteira é:

```bash
npm run quality
```

Ele executa ESLint, Prettier e a suíte Python completa. Os comandos individuais são:

```bash
npm run lint
npm run format:check
ruff check .
ruff format --check .
npm test
```

O resultado esperado da suíte é `ALL_PHASE5_PACKAGE_TESTS_OK`. O gate inclui os E2E de
apresentação e regressão; o teste Playwright legado da Fase 1 é opcional e deve ser
executado separadamente quando essa cobertura visual específica for necessária.

## Estrutura do repositório

| Diretório | Papel |
|---|---|
| `assets/js/core/` | Camada compartilhada: contratos, configuração, dados, evidências e tributos. |
| `assets/js/phase1/` a `assets/js/phase5/` | Módulos e entry points de domínio por fase. |
| `data/` | Dados derivados, catálogos, contratos, validações e envelopes criptografados. |
| `phases/` | Documentação de módulos: README, contrato, funções e testes. |
| `tests/` | Testes por fase, qualidade, regressão e E2E. |
| `etl/` | Preparação e regeneração dos dados. |
| `scripts/` | Evidência acadêmica e pacote de entrega. |
| `docs/` | Documentação técnica organizada por assunto. |
| `references/` | Workbooks, PDF, apresentações e fontes originais. |

O mapa detalhado está em [`PROJECT_STRUCTURE.md`](PROJECT_STRUCTURE.md). O processo de contribuição e manutenção está em [`CONTRIBUTING.md`](CONTRIBUTING.md).

## Dados protegidos e artefatos acadêmicos

Os dados operacionais derivados permanecem criptografados no repositório. As fontes originais em `references/raw_sources/` são arquivos não criptografados e só podem permanecer em um repositório público com autorização documental dos titulares; caso contrário, devem ficar fora do histórico público. `.env.local` é local e ignorado; a senha nunca deve entrar no Git, em relatórios ou em artefatos de entrega. No navegador, senha e chaves ficam somente em memória durante a aba atual.

Para gerar novamente os números, a evidência e a planilha do relatório:

```bash
node scripts/generate_academic_evidence.mjs
node scripts/build_academic_package.mjs
```

`generate_academic_evidence.mjs` usa apenas as dependências do projeto. A geração da
planilha requer `@oai/artifact-tool` instalado localmente ou o caminho local informado
por `VISAGIO_ARTIFACT_TOOL_PATH`; o script não depende de caminhos absolutos de uma
máquina específica e falha com uma mensagem explícita quando essa dependência não está
disponível.

Os arquivos derivados ficam em `entregaveis/`, também ignorado pelo Git. O pacote contém agregados, metodologia, reconciliação, auditoria tributária e fontes, mas não exporta os dados-fonte protegidos.

## Documentação para o relatório

- [`METODOLOGIA_MODELO.md`](METODOLOGIA_MODELO.md) — limites metodológicos, custos, cenários e otimização;
- [`RELATORIO_FINAL_ACADEMICO.md`](RELATORIO_FINAL_ACADEMICO.md) — parecer técnico e evidências para a defesa;
- [`ESTUDO_PROPRIO_TRIBUTACAO.md`](ESTUDO_PROPRIO_TRIBUTACAO.md) — parâmetros, cobertura e fontes da camada tributária;
- [`CHECKLIST_ENTREGA_EMPRESAS.md`](CHECKLIST_ENTREGA_EMPRESAS.md) — roteiro de homologação por empresa;
- [`docs/README.md`](docs/README.md) — índice da documentação detalhada;
- [`tests/README.md`](tests/README.md) — organização dos testes.

## Escopo dos resultados

O simulador é uma ferramenta de análise exploratória de cenários. Monte Carlo não é previsão histórica; o otimizador só pode ser chamado de ótimo global quando o espaço modelado for exato; proxies e fallbacks precisam permanecer identificados; e a camada tributária parametrizada não substitui apuração fiscal oficial.
