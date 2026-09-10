# Relatório técnico final — Visagio Static Simulator

Data da auditoria: 2026-09-09
Escopo: código, dados protegidos, cálculos, arquitetura, otimização, Monte
Carlo, tributação, interface, documentação, testes e pacote de entrega.

## Parecer executivo

O repositório está apto para entrega como pacote acadêmico estático, com
limitações explicitamente preservadas no runtime, na interface, nos exports e
na documentação. O sistema não transforma proxy em fato, não promove uma busca
parcial a ótimo global e não converte uma reconciliação ajustada em alinhamento
bruto.

O resultado final é uma release tecnicamente entregável, mas não uma declaração
de validade fiscal ou previsão operacional. Para a Empresa 1, o baseline de
decisão é derivado por proxy e permanece exploratório. Para a Empresa 2, a
divergência tributária bruta permanece visível; fluxos sem receita explícita não
são tratados como faturamento por inferência física. Quando a cobertura fiscal
é insuficiente, otimização/Monte Carlo/stress são bloqueados ou marcados como
exploratórios conforme o módulo.

## Críticas do plano de trabalho incorporadas

| Tema | Tratamento na release |
|---|---|
| Monte Carlo contraditório ou apresentado como previsão | RNG `mulberry32-v1`, seed registrada, distribuições e origem da incerteza explícitas; resultado separado do ranking e marcado como exploratório quando há cobertura fiscal incompleta. |
| Transferência da Empresa 1 sem base própria | Proxy quilométrico identificado na proveniência, fonte de calibração declarada e baseline bruto preservado em `phase2_raw`; comparabilidade marcada como limitada. |
| CDs ativos, fechados e realocação | Identidade canônica reconhece rótulos `Red-XX` e variantes como `Red-ES/Regional`; baseline com todos os CDs ativos não produz realocação artificial. |
| Estoque dependente da quantidade de CDs | Mantida a escolha metodológica B: estoque é independente do número de CDs ativos e isso aparece no relatório. |
| Fallbacks e números mágicos | Fallbacks têm diagnóstico, contagem, taxa, hipótese e alerta; parâmetros canônicos ficam centralizados na configuração do modelo. |
| Tributação e proxies | NCM/CFOP/CST, cobertura, períodos, origem/destino, categorias proxy e limitações são transportados no resultado, relatório e export. |
| Reconciliação tributária ajustada | Diferença bruta define o status; ponte ajustada fica em campos separados e é descrita como sensibilidade. |
| Otimização parcial/MILP | Método, seed, espaço declarado, cobertura e `exact_search_space` são exportados; o projeto não declara MILP nem ótimo global sem enumeração completa. |
| Seleção final enviesada pelo top-10 | Seleção automática usa `scored_scenarios` completo quando disponível; `best_scenarios` é apenas resumo. |
| Configuração divergente entre Fase 4 e Fase 5 | Objetivo, restrições, método, seed e limite são herdados via store de sessão e exibidos na Fase 5. |
| Código morto, warnings e segurança | Imports/formatação/lint revisados, vulnerabilidades de dependências corrigidas, senha restrita à `sessionStorage`, dados continuam criptografados e o segredo não entra no Git. |
| Interface e acessibilidade | Gráficos receberam rótulos, seleção de empresa usa `aria-pressed`, tabelas têm rolagem horizontal controlada em mobile e mensagens de bloqueio distinguem sucesso de falha. |
| Entradas diretas e resultados ausentes | Fases 3/4/5 inicializam a empresa ao entrar pela rota; estados sem cenário não exibem saving, custo ou robustez fictícios. |

## Evidências executadas

As validações abaixo foram executadas após as correções e a regeneração dos
artefatos protegidos:

- `npm run lint` — aprovado sem warnings.
- `npm run format:check` — aprovado.
- `ruff check .` — aprovado.
- `ruff format --check .` — aprovado.
- `git diff --check` — aprovado.
- `npm audit --audit-level=moderate` e `npm audit --omit=dev` — zero vulnerabilidades.
- `python scripts/verify_encrypted_build.py` — `ENCRYPTED_BUILD_OK files=144`.
- `python tests/run_all_tests.py` — suíte completa aprovada.
- `python tests/08_fase5_entrega_final/test_phase5_final_qa.py` — `PHASE5_NODE_FINAL_QA_OK` e `PHASE5_FINAL_QA_OK`.
- `python tests/10_presentation_e2e/test_presentation_flow_playwright.py` — `PRESENTATION_E2E_OK`.
- `python tests/11_regression_e2e/test_regression_e2e.py` — `REGRESSION_E2E_OK`.
- Inspeção de runtime com ambos os bundles: baseline completo sem realocações artificiais; cobertura e bloqueios fiscais coerentes com os dados.
- Fluxo da Fase 5 no navegador embutido: seleção, ranking, Monte Carlo, stress, sensibilidade, recomendação, auditoria e exports renderizados; mensagens sem `[object Object]`.

## Checklist de entrega

O inventário completo de botões, funcionalidades, fases, empresas e evidências
está em [`CHECKLIST_ENTREGA_EMPRESAS.md`](CHECKLIST_ENTREGA_EMPRESAS.md). Ele
separa aprovação automatizada, evidência de navegador e ressalvas que não devem
ser marcadas como aprovadas por inferência.

O pacote foi verificado em desktop e mobile pelo Playwright e no navegador
embutido disponível no ambiente. O conector `@Chrome` solicitado não estava
exposto nesta execução; portanto, não é correto atribuir a ele uma evidência
que não foi produzida. Isso não invalida os testes locais, mas é uma limitação
de evidência de navegador registrada no `release-report.json`.

## Limitações que acompanham a defesa

1. Monte Carlo é análise complementar condicional às premissas e às
   observações; não é forecast nem intervalo de confiança formal.
2. A Empresa 1 usa proxy de transferência e referência tributária compartilhada
   quando a fonte própria não existe.
3. A Empresa 2 possui fluxos com cobertura fiscal incompleta; a ausência de
   receita explícita não é preenchida a partir de volume físico.
4. A reconciliação do workbook registra uma ponte de sensibilidade, não uma
   validação independente.
5. A busca discreta só sustenta ótimo global quando o espaço declarado é
   realmente coberto; caso contrário, o resultado é o melhor entre candidatos
   avaliados.
6. Robustez na grade avaliada não prova capacidade, SLA, throughput ou
   viabilidade operacional sem dados adicionais.

Essas limitações não são falhas ocultas: são parte do contrato de interpretação
da release e acompanham a interface, os relatórios, os exports e os testes.
