# Simulador de Malha Logística — Visagio

Aplicação web estática para comparar cenários de malha logística de duas empresas, considerando custos físicos, impacto tributário parametrizado, estoque, qualidade de serviço, risco operacional e robustez. A solução mantém os dados e cálculos da Empresa 1 separados dos da Empresa 2 e expõe as aproximações empregadas quando a base observada não é suficiente.

> **Situação da validação:** a suíte pública é reproduzível sem credencial. A suíte completa, os resultados canônicos e as duas auditorias finais exigem o secret `VISAGIO_DATA_PASSWORD`. Na ausência dele, o projeto interrompe a execução e não declara os testes protegidos como aprovados.

## Problema e solução

O projeto apoia a avaliação de alternativas de centros de distribuição em cinco fases. O núcleo calcula cada cenário de forma determinística. Uma camada Monte Carlo opcional amostra drivers parametrizados para análise exploratória de incerteza; seus spreads são premissas manuais e não constituem previsão estatística calibrada.

A aplicação roda inteiramente no navegador e não envia a senha nem os dados descriptografados a um servidor. As fontes protegidas permanecem criptografadas no repositório.

## Arquitetura

| Fase | Rota | Responsabilidade |
|---|---|---|
| 1 | `/fase-1-validacao/` | validação e qualidade das fontes |
| 2 | `/fase-2-baseline/` | reconstrução do baseline e reconciliação |
| 3 | `/fase-3-cenarios/` | simulação determinística e Monte Carlo exploratório |
| 4 | `/fase-4-score-otimizador/` | ranking multicritério no espaço de cenários avaliado |
| 5 | `/fase-5-entrega-final/` | robustez, recomendação, trilha de auditoria e exportação |

Os módulos compartilhados ficam em `assets/js/shared/`. A implementação tributária canônica está em `assets/js/shared/tax/`; `assets/js/core/tax/` contém apenas aliases de compatibilidade.

## Requisitos

- Node.js 20 ou superior;
- npm 10 ou superior;
- Python 3.10 ou superior;
- Chromium instalado pelo Playwright para os testes E2E;
- `VISAGIO_DATA_PASSWORD` legítima para abrir os dados protegidos.

As versões mínimas são declaradas em `package.json`, `pyproject.toml` e `requirements-dev.txt`.

## Instalação limpa

```bash
git clone https://github.com/Bulquerque/projeto_eng_de-_produ-o.git
cd projeto_eng_de-_produ-o
npm ci
python -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements-dev.txt
python -m playwright install chromium
```

No Windows, ative o ambiente com `.venv\\Scripts\\activate`.

## Configuração da senha

Copie `.env.example` para `.env.local` e preencha a variável apenas no ambiente local:

```dotenv
VISAGIO_DATA_PASSWORD=
```

Também é possível exportar a variável no processo. Nunca registre a senha em commits, logs, capturas de tela ou arquivos de evidência. No GitHub Actions, cadastre-a em **Settings → Secrets and variables → Actions**, com o nome exato `VISAGIO_DATA_PASSWORD`.

## Execução

```bash
npm run serve
```

Abra `http://localhost:8000`. Não use `file://`, porque os módulos ES e o carregamento dos dados dependem de HTTP.

## Verificações

```bash
npm run lint
npm run format:check
npm run test:public
npm test
```

- `npm run test:public` executa validações de estrutura, paths, contratos, sintaxe, HTTP e lógica que não acessam os dados protegidos.
- `npm test` exige a senha e executa também contratos de dados, baseline, cenários, tributação, score, recomendações, exportação e E2E.
- o workflow `.github/workflows/quality.yml` executa a suíte pública e, quando o secret existe, duas auditorias completas consecutivas em runners independentes. Sem o secret, a auditoria protegida falha explicitamente.

Consulte `tests/README.md` e `docs/07_auditoria/` para o inventário, a matriz de rastreabilidade e os registros de auditoria.

## Premissas e limitações

- A transferência da Empresa 1 utiliza, por falta de tarifa própria na base disponível, um **proxy entre empresas** derivado da Empresa 2. O uso, a cobertura e a sensibilidade são expostos no resultado.
- O estoque opera em modo `days_wacc_only`: depende de demanda, dias de estoque e WACC, sem efeito explícito de pooling por quantidade ou localização de CDs.
- A armazenagem pode usar a aproximação proporcional `0,65 + 0,35 × CDs ativos / CDs do baseline` quando a tabela observada não cobre o cenário.
- O impacto tributário é parametrizado. Para a Empresa 1, não equivale a validação fiscal; para a Empresa 2, o sistema distingue valores do workbook, reconstruções, parâmetros e proxies.
- Risco e robustez são índices multicritério, não probabilidades empíricas.
- O ranking é relativo ao conjunto de candidatos porque usa normalização min–max. O vencedor é o melhor cenário dentro do espaço avaliado, não um ótimo global.
- Sem benchmark independente, a interface apresenta `benchmark pendente`; não cria score de paridade fictício.

O catálogo completo de parâmetros, proxies e fallbacks está em `assets/js/shared/model-assumptions.js` e documentado em `docs/07_auditoria/02_PREMISSAS_E_FALLBACKS.md`.

## Demonstração e telas

Demonstração publicada: [bulquerque.github.io/projeto_eng_de-_produ-o](https://bulquerque.github.io/projeto_eng_de-_produ-o/)

| Início | Baseline | Cenários |
|---|---|---|
| ![Tela inicial](data/validation/apresentacao_pack/01_home_desktop.png) | ![Fase 2](data/validation/apresentacao_pack/02_phase2_baseline_desktop.png) | ![Fase 3](data/validation/apresentacao_pack/03_phase3_scenarios_desktop.png) |

| Ranking | Entrega final |
|---|---|
| ![Fase 4](data/validation/apresentacao_pack/04_phase4_optimizer_desktop.png) | ![Fase 5](data/validation/apresentacao_pack/05_phase5_final_desktop.png) |

## Reprodutibilidade e proveniência

Os valores finais devem ser regenerados pela suíte protegida e registrados em `data/validation/prova_bala_evidence/`. Números provenientes diretamente do workbook são identificados como tal; aproximações recebem a classificação `parameter`, `proxy` ou `fallback` e geram cobertura e warnings auditáveis.

Este repositório não declara licença. A escolha depende de decisão jurídica dos responsáveis pelo projeto.
