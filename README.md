# Visagio Static Simulator

Simulador estático de malha logística com validação de dados, baseline, cenários, análise tributária parametrizada, otimização e entrega executiva. O runtime roda no navegador com JavaScript modular e carrega os dados protegidos somente após desbloqueio local.

## Comece aqui

1. Instale as dependências JavaScript com `npm ci`.
2. Para executar fluxos de empresas protegidas, configure `VISAGIO_DATA_PASSWORD` somente no ambiente local ou em `.env.local`. A interface de demonstração com `empresa_mock` não requer essa credencial.
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

O portal e a Network Intelligence coexistem. O `index.html` sempre carrega o bootstrap `assets/js/app/main.js`; a shell Network só inicializa com o parâmetro `ui=network-intelligence` ou uma rota `#/network/...`. Fora desse modo, o carregador inline de `index.html` importa os entry points das cinco fases e o roteador legado. As páginas `/fase-1-validacao/` a `/fase-5-entrega-final/` continuam disponíveis; portanto, o projeto não é um runtime único.

Para abrir a interface Network Intelligence com a fixture sintética pública:

```text
/?ui=network-intelligence&company=empresa_mock#/network/overview/summary
```

Ela começa na Empresa Falsa. Empresa 1 e Empresa 2 continuam protegidas e só podem ser
carregadas após o desbloqueio local com a credencial configurada.

## Qualidade e testes

O comando recomendado para validar a árvore inteira é:

```bash
npm run quality
```

Ele executa a suíte canônica, que inclui ESLint, Prettier, Ruff, contratos, engines e E2E.
Os comandos individuais são:

```bash
npm run lint
npm run format:check
ruff check .
ruff format --check .
npm test
npm run test:network
```

O resultado esperado da suíte é `ALL_PHASE5_PACKAGE_TESTS_OK`. O gate inclui os E2E de
apresentação e regressão; o teste Playwright legado da Fase 1 é opcional e deve ser
executado separadamente quando essa cobertura visual específica for necessária.
`test:network` executa somente os contratos e o E2E da Network Intelligence; o fluxo
protegido é executado quando `VISAGIO_DATA_PASSWORD` estiver disponível.

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

O mapa detalhado está em [`PROJECT_STRUCTURE.md`](PROJECT_STRUCTURE.md). O processo de contribuição e manutenção está em [`CONTRIBUTING.md`](CONTRIBUTING.md). Para encontrar guias e documentos acadêmicos, comece por [`docs/README.md`](docs/README.md) e [`docs/00_inicio/00_README_DO_PACOTE.md`](docs/00_inicio/00_README_DO_PACOTE.md).

## Dados protegidos e artefatos acadêmicos

`data-demo/empresa_mock/` contém fixtures sintéticas para demonstração. Em `data/` convivem contratos, catálogos/derivados e dados sujeitos a proteção; arquivos criptografados não devem ser confundidos com arquivos públicos nem descriptografados para publicação. Consulte `.gitignore`, os manifestos e a proveniência antes de compartilhar ou gerar pacotes. `.env.local` é local e ignorado; a senha nunca deve entrar no Git, em relatórios ou em artefatos de entrega. No navegador, senha e chaves ficam somente em memória durante a aba atual. A criptografia no repositório, por si só, não comprova que todo arquivo local ou pacote derivado está livre de dados protegidos.

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

Os arquivos derivados ficam em `entregaveis/`, ignorado pelo Git. Antes de entregar ou publicar, confira o manifesto gerado e os arquivos incluídos; não presuma que uma saída local é segura para distribuição apenas por estar fora do Git.

## Documentação para o relatório

- [`METODOLOGIA_MODELO.md`](METODOLOGIA_MODELO.md) — limites metodológicos, custos, cenários e otimização;
- [`RELATORIO_FINAL_ACADEMICO.md`](RELATORIO_FINAL_ACADEMICO.md) — parecer técnico e evidências para a defesa;
- [`ESTUDO_PROPRIO_TRIBUTACAO.md`](ESTUDO_PROPRIO_TRIBUTACAO.md) — parâmetros, cobertura e fontes da camada tributária;
- [`CHECKLIST_ENTREGA_EMPRESAS.md`](CHECKLIST_ENTREGA_EMPRESAS.md) — roteiro de homologação por empresa;
- [`docs/README.md`](docs/README.md) — índice da documentação detalhada;
- [`tests/README.md`](tests/README.md) — organização dos testes.

## Escopo dos resultados

O simulador é uma ferramenta de análise exploratória de cenários. Monte Carlo não é previsão histórica; o otimizador só pode ser chamado de ótimo global quando o espaço modelado for exato; proxies e fallbacks precisam permanecer identificados; e a camada tributária parametrizada não substitui apuração fiscal oficial.
