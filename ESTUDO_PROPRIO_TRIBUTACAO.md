# Estudo técnico próprio de tributação — Visagio Static Simulator

Status: complementar ao modelo, versionado no código e reproduzível no runtime.
Registro runtime: `registered_validation_pending` enquanto a revisão tributária/legal
independente permanecer pendente.

Identificador operacional: `estudo_proprio_tributacao_visagio_v1`.

## Objetivo e limite

Este estudo técnico próprio complementa os dados das duas empresas com uma
leitura paramétrica e reconciliada da carga tributária. Ele foi criado para que
o simulador entregue uma estimativa numérica quando os dados existentes
permitem cálculo, sem converter campos ausentes em fatos fiscais.

O estudo não é parecer tributário, escrituração, validação fiscal oficial ou
substituto da revisão por contador/tributarista. A entrega com limitações é
intencional: ausência de origem, receita, NCM, CFOP ou CST reduz o suporte da
evidência e altera o uso permitido para `exploratory_only`, mas não apaga os
valores que podem ser calculados com os registros disponíveis.

## Fontes e versão

- `assets/js/core/tax/fiscal-flow-builder.js`: seleção do universo fiscal,
  receita explícita e normalização de categoria;
- `assets/js/core/tax/current-tax-engine.js`: associação de taxas observadas,
  proxies por destino e taxa de referência reconciliada;
- `assets/js/core/tax/reform-tax-engine.js` e
  `assets/js/core/tax/transition-tax-engine.js`: regimes parametrizados;
- `assets/js/core/tax/tax-reform-parameters.js` e
  `assets/js/core/tax-reform-config.js`: parâmetros versionados e regras por
  categoria;
- tabelas protegidas carregadas pelo bundle de cada empresa e referências
  oficiais/cronogramas mantidos em `data/tax/`;
- `assets/js/core/tax/tax-quality-gate.js`: cobertura, classificação,
  limitações e rastreabilidade.

A versão de parâmetros atualmente registrada pelo motor é `2026-05`. Cada
resultado carrega a versão, o regime, o período selecionado, a cobertura e a
proveniência no bloco `tax_study`, `audit_trace` e `metadata`.

## Método aplicado

1. Usar somente fluxos com UF destino válida e receita explícita para o cálculo
   bottom-up. Volume, peso ou quantidade não são promovidos a faturamento.
2. Manter UF origem ausente como ausência de dado. Quando possível, a taxa é
   associada por destino ou por referência reconciliada; essa associação é
   marcada como proxy.
3. Aplicar NCM, CFOP e CST quando presentes. Categoria sem a classificação
   completa é proxy e aparece na cobertura fiscal.
4. Calcular o regime atual ou a transição escolhida com os parâmetros
   versionados, mantendo separados tributo atual, CBS, IBS, seletivo e
   créditos.
5. Comparar o resultado com o baseline da mesma empresa, preservando a
   divergência bruta do workbook e qualquer ponte ajustada em campos distintos.
6. Entregar custos, saving, stress, sensibilidade e Monte Carlo quando o
   resultado determinístico for numericamente utilizável. Cobertura limitada
   gera aviso e uso exploratório; erro técnico continua sendo erro.

## Registro mínimo por empresa

### Empresa 1

A referência tributária compartilhada e a classificação fiscal proxy são
mantidas visíveis. O resultado pode ser usado para comparação exploratória de
cenários, mas não deve ser apresentado como medição tributária própria da
Empresa 1.

### Empresa 2

Os fluxos disponíveis são calculados com as receitas e associações fiscais que
existem no pacote. Fluxos sem receita explícita permanecem fora do cálculo
bottom-up; fluxos sem UF origem ou classificação completa continuam no pacote
como limitação mensurada. O total entregue é, portanto, uma estimativa
parcialmente observada e não uma cobertura fiscal integral.

## Saída e governança

O runtime publica, de forma consistente na tela, no relatório HTML, no JSON,
nos CSVs e na trilha de auditoria:

- `tax_coverage` e `coverage_status`;
- fluxos de entrada, elegíveis, receita explícita, UF destino, UF origem e sem
  cobertura;
- cobertura completa de NCM/CFOP/CST;
- fonte e confiança de cada associação tributária;
- `tax_study.study_id`, versão de parâmetros e validação oficial (`false`);
- `decision_use`, que é `exploratory_only` quando a cobertura é limitada;
- advertência de que os campos ausentes não foram inventados.

Os percentuais têm denominadores separados: cobertura de entrada mede quantos
fluxos chegaram ao motor; cobertura de destino/origem mede o preenchimento dos
fluxos elegíveis; cobertura fiscal completa exige simultaneamente origem,
destino, receita, NCM, CFOP e CST. Essa separação evita que um número de
cobertura seja interpretado como outro.

Assim, o pacote deixa de bloquear a apresentação dos resultados disponíveis,
mas também não transforma a estimativa em uma recomendação fiscal limpa.

## Complementação necessária antes de uso executivo

Para elevar o resultado de exploratório a decisão tributária específica da
empresa, o estudo deve ser complementado com documentação própria por fluxo:

- origem e destino fiscais;
- receita/base de cálculo e período de competência;
- NCM, CFOP, CST e regime aplicável;
- tratamento de créditos, benefícios, regimes especiais e devoluções;
- reconciliação com documentos fiscais e escrituração;
- revisão independente e registro da data de validade dos parâmetros.

Esses itens são próximos passos de validação, não valores que o simulador deve
inventar para preencher a lacuna atual.
