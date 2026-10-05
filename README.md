# Visagio Static Simulator

Simulador estático de malha logística com validação de dados, baseline, cenários, análise tributária parametrizada, busca discreta e classificação de alternativas para apoiar decisões executivas. O runtime roda no navegador com JavaScript modular e carrega os dados protegidos somente após desbloqueio local.

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
- `/fase-1-validacao/` → `#/network/overview/summary` — diagnóstico inicial;
- `/fase-2-baseline/` → `#/network/trust/overview` — visão geral da baseline e de sua evidência;
- `/fase-3-cenarios/` → `#/network/scenarios/build` — criação de cenários;
- `/fase-4-score-otimizador/` → `#/network/optimizer/configure` — configuração da avaliação de alternativas;
- `/fase-5-entrega-final/` → `#/network/trust/validation` — validação da entrega;
- `/debug/` — diagnóstico de paths, módulos e carregamento.

Na interface e na documentação metodológica, a antiga área de busca é chamada
**Avaliação de alternativas**: ela classifica os cenários gerados segundo os
critérios e limites configurados. Esse nome evita sugerir que o sistema prova
uma solução ótima para o problema logístico completo. O endereço antigo da Fase
4 permanece como alias para não quebrar links existentes.

O `index.html` carrega `assets/js/app/main.js`, que inicia a shell Network Intelligence. Os módulos `assets/js/phase1/` a `assets/js/phase5/` permanecem no projeto para fluxos e engines das fases. As páginas `/fase-1-validacao/` a `/fase-5-entrega-final/` são fachadas que levam às subrotas indicadas acima. O roteador canônico também converte os hashes históricos `#/diagnostico-baseline`, `#/simulacao-otimizacao` e `#/homologacao-relatorio`, além dos aliases de fase, para rotas válidas, preservando os parâmetros da query.

Para abrir a interface Network Intelligence com a fixture sintética pública:

```text
/?ui=network-intelligence&company=empresa_mock#/network/overview/summary
```

Ela começa na Empresa Falsa. Empresa 1 e Empresa 2 continuam protegidas e só podem ser
carregadas após o desbloqueio local com a credencial configurada.

## Qualidade e testes

Prepare as dependências do gate uma vez:

```bash
npm ci
python -m pip install -r requirements-quality.txt
python -m playwright install chromium
```

O `npm run quality` executa ESLint, Prettier, Ruff, a suíte pública e a suíte completa
com E2E. A suíte completa também valida dados protegidos: defina
`VISAGIO_DATA_PASSWORD` no ambiente local antes de executá-la. Nunca grave essa senha
no repositório ou no histórico do shell.

Para validar somente o que também pode ser executado com segurança em PRs públicos,
use:

```bash
npm run quality:public
```

Esse comando inclui lint, formatação, Ruff e testes públicos sem solicitar credenciais.
O GitHub Actions roda `quality:public` para todos os PRs. A suíte protegida roda em
pushes/workflow_dispatch e em PRs do mesmo repositório, onde os secrets estão
disponíveis; PRs de forks recebem explicitamente a cobertura pública, sem execução
de código não confiável com credenciais.

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

- [`METODOLOGIA_MODELO.md`](METODOLOGIA_MODELO.md) — limites metodológicos, custos, cenários e busca de alternativas;
- [`RELATORIO_FINAL_ACADEMICO.md`](RELATORIO_FINAL_ACADEMICO.md) — parecer técnico e evidências para a defesa;
- [`ESTUDO_PROPRIO_TRIBUTACAO.md`](ESTUDO_PROPRIO_TRIBUTACAO.md) — parâmetros, cobertura e fontes da camada tributária;
- [`CHECKLIST_ENTREGA_EMPRESAS.md`](CHECKLIST_ENTREGA_EMPRESAS.md) — roteiro de homologação por empresa;
- [`docs/README.md`](docs/README.md) — índice da documentação detalhada;
- [`tests/README.md`](tests/README.md) — organização dos testes.

## Escopo dos resultados

O simulador é uma ferramenta de análise exploratória de cenários. Monte Carlo não é previsão histórica; a avaliação classifica apenas as alternativas encontradas dentro do catálogo e dos limites informados, e só representa todo o espaço declarado quando a cobertura for completa; proxies e fallbacks precisam permanecer identificados; e a camada tributária parametrizada não substitui apuração fiscal oficial.
