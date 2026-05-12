# Testes por módulo — todas as fases

Este documento organiza os testes por fase, módulo e tipo. A matriz estruturada está em `data/contracts/module_tests_matrix.csv` e `data/contracts/module_tests_matrix.json`.


# Fase 1


## AppBootstrap

| Tipo de teste | Critério |
|---|---|
| unit | initApp cria estado inicial com empresa1 |
| unit | showFatalError não deixa a página em branco |
| integration | site abre via http.server |
| integration | todos os artefatos da Fase 1 são carregados |
| manual | abrir / e confirmar que os painéis aparecem |
| manual | abrir /fase-1-validacao/ e confirmar que redireciona/mostra o mesmo app |
| acceptance | não usa path absoluto |
| acceptance | não quebra se um painel tiver warning |

## DataLoader

| Tipo de teste | Critério |
|---|---|
| unit | fetchJson rejeita JSON inválido com mensagem clara |
| unit | parseCsv preserva cabeçalhos |
| integration | catalog.json carrega |
| integration | workbook_sheet_inventory.csv carrega |
| manual | abrir DevTools e confirmar ausência de 404 nos arquivos principais |
| acceptance | falha de um arquivo aparece na tela e não some silenciosamente |

## CompanySelector

| Tipo de teste | Critério |
|---|---|
| unit | empresa1 é padrão |
| unit | selectCompany troca para empresa2 |
| integration | trocar empresa muda cards de datasets |
| integration | trocar empresa não mistura paths |
| manual | clicar Empresa 1 e depois Empresa 2 |
| manual | confirmar que os títulos/datasets mudam |
| acceptance | nenhum dataset da Empresa 2 aparece quando Empresa 1 está selecionada |

## DatasetPanel

| Tipo de teste | Critério |
|---|---|
| unit | getCompanyDatasets filtra corretamente |
| unit | path absoluto é sinalizado |
| integration | Empresa 1 mostra demanda/distância/premissas |
| integration | Empresa 2 mostra tabelas core e scenario_blocks |
| manual | copiar um caminho exibido e conferir que existe na pasta |
| acceptance | todo dataset obrigatório tem path visível |

## DataQualityPanel

| Tipo de teste | Critério |
|---|---|
| unit | erro gera status error |
| unit | score baixo gera warning |
| integration | painel muda ao trocar empresa |
| manual | verificar se warnings aparecem em amarelo e erros em vermelho |
| acceptance | não esconder problemas de dados |

## PathAuditPanel

| Tipo de teste | Critério |
|---|---|
| unit | missing_paths vazio gera OK |
| unit | missing_paths > 0 gera error |
| integration | path report é exibido na página |
| manual | confirmar visualmente missing_paths = 0 |
| acceptance | nenhum caminho crítico pode ficar invisível |

## WorkbookInventoryPanel

| Tipo de teste | Critério |
|---|---|
| unit | Cenários é detectada como special sheet |
| unit | filtro por empresa não mistura workbooks |
| integration | inventário mostra 53 abas auditadas |
| integration | Empresa 2 mostra 25 abas por workbook |
| manual | verificar se Cenários mostra scenario_blocks/scenario_totals |
| acceptance | toda aba auditada precisa ter export ou justificativa |

## ManualChecklist

| Tipo de teste | Critério |
|---|---|
| unit | toggleCheck alterna boolean |
| unit | reset limpa todos |
| integration | estado persiste após reload |
| manual | marcar checklist, recarregar página, conferir permanência |
| acceptance | usuário consegue auditar manualmente a Fase 1 sem abrir código |

## Phase1TestPanel

| Tipo de teste | Critério |
|---|---|
| unit | assertCondition false gera fail |
| unit | summary conta resultados |
| integration | painel aparece depois do carregamento |
| manual | confirmar que todos os testes do navegador passam |
| acceptance | falha precisa aparecer visualmente |

# Fase 2


## BaselineBuilder

| Tipo de teste | Critério |
|---|---|
| unit | baseline tem company |
| unit | baseline tem scenarioId |
| unit | demanda total preservada |
| integration | Empresa 1 gera baseline |
| integration | Empresa 2 gera baseline |
| manual | verificar CDs ativos e UFs atendidas |
| acceptance | não existe UF com demanda sem atendimento |

## FlowBuilder

| Tipo de teste | Critério |
|---|---|
| unit | distância faltante vira warning |
| unit | volume total dos flows = demanda total |
| integration | flows alimentam CostEngine |
| manual | checar top rotas em tabela |
| acceptance | nenhum fluxo crítico sem origem, CD, destino ou volume |

## CostEngine

| Tipo de teste | Critério |
|---|---|
| unit | total = soma das parcelas |
| unit | custo nunca negativo |
| unit | frete maior aumenta transporte |
| integration | baseline alimenta BaseFitScore |
| integration | cenário alimenta Comparator |
| manual | alterar frete +10% e verificar transporte maior |
| acceptance | cada custo tem premissa rastreável |

## TaxEngine

| Tipo de teste | Critério |
|---|---|
| unit | no_tax retorna zero |
| unit | alíquota faltante gera warning |
| unit | DIFAL não pode ser negativo sem regra explícita |
| integration | resultado tributário entra no comparator |
| manual | ligar/desligar efeito tributário e ver diferença |
| acceptance | benefício fiscal precisa ficar explícito como premissa, nunca escondido |

## BaseFitScore

| Tipo de teste | Critério |
|---|---|
| unit | simulado igual real => 100 |
| unit | erro alto reduz score |
| unit | divisão por zero tratada |
| integration | Fase 2 mostra score por empresa |
| manual | comparar tabela real vs simulado |
| acceptance | erro alto não pode ser vendido como OK |

## CalibrationPanel

| Tipo de teste | Critério |
|---|---|
| unit | linhas mostram real/simulado/erro |
| unit | warning aparece quando erro > tolerância |
| integration | troca de empresa troca calibração |
| manual | conferir se o erro total está visível |
| acceptance | não esconder erro de calibração |

# Fase 3


## ScenarioBuilder

| Tipo de teste | Critério |
|---|---|
| unit | cenário mantém company |
| unit | changesApplied registra mudanças |
| integration | cenário criado aparece no comparador |
| manual | fechar um CD e conferir mudança visual |
| acceptance | cenário inválido gera erro claro |

## ScenarioValidator

| Tipo de teste | Critério |
|---|---|
| unit | sem CD ativo é inválido |
| unit | empresa misturada é inválida |
| integration | ScenarioBuilder chama validator antes de salvar |
| manual | tentar cenário absurdo e ver bloqueio |
| acceptance | nenhum cenário inválido entra no ranking |

## ScenarioComparator

| Tipo de teste | Critério |
|---|---|
| unit | baseline saving = 0 |
| unit | cross-company bloqueado |
| integration | cenários criados aparecem na tabela |
| manual | comparar Base, 3 CDs e ES |
| acceptance | saving sempre usa baseline da mesma empresa |

## ScenarioQualityCheck

| Tipo de teste | Critério |
|---|---|
| unit | 100% volume em um CD gera alerta |
| unit | capacidade acima do limite gera severidade alta |
| integration | Comparator mostra qualityScore |
| manual | centralizar tudo e conferir alerta |
| acceptance | custo baixo não apaga risco alto |

## ScenarioPersistence

| Tipo de teste | Critério |
|---|---|
| unit | salva e carrega por empresa |
| unit | delete remove só o cenário escolhido |
| integration | cenário salvo aparece após reload |
| manual | salvar cenário, recarregar, conferir |
| acceptance | cenários da Empresa 1 não aparecem na Empresa 2 |

# Fase 4


## ObjectiveBuilder

| Tipo de teste | Critério |
|---|---|
| unit | pesos somam 1 |
| unit | peso negativo bloqueado |
| integration | mudar pesos muda ranking |
| manual | criar Perfil CFO e Perfil Supply |
| acceptance | objetivo inválido não roda score |

## ScenarioScoring

| Tipo de teste | Critério |
|---|---|
| unit | menor custo recebe score maior |
| unit | maior risco recebe score menor |
| unit | score entre 0 e 100 |
| integration | ranking muda com pesos |
| manual | aumentar peso de custo e observar ranking |
| acceptance | score sempre mostra decomposição |

## ConstraintEngine

| Tipo de teste | Critério |
|---|---|
| unit | minCds > maxCds é inválido |
| unit | maxConcentration fora de 0-1 é inválido |
| integration | otimizador rejeita candidato inválido |
| manual | limitar max CDs e conferir busca |
| acceptance | cenário que viola hard constraint não entra no top |

## ScenarioOptimizer

| Tipo de teste | Critério |
|---|---|
| unit | mesma seed reproduz resultado |
| unit | não gera cenário sem CD |
| integration | top 5 aparecem na tela |
| manual | rodar busca e conferir log |
| acceptance | otimizador sempre informa quantos cenários testou |

## SearchLogPanel

| Tipo de teste | Critério |
|---|---|
| unit | valid+invalid = tested |
| unit | rejection summary agrupa corretamente |
| integration | log aparece após otimização |
| manual | verificar método e seed usados |
| acceptance | busca sem log não é aceita |

# Fase 5


## StressTestEngine

| Tipo de teste | Critério |
|---|---|
| unit | frete +20% aumenta transporte |
| unit | demanda +15% aumenta volume/custo variável |
| integration | stress roda nos top cenários |
| manual | rodar stress no cenário vencedor |
| acceptance | saving negativo em stress gera alerta |

## ExplainabilityEngine

| Tipo de teste | Critério |
|---|---|
| unit | se armazenagem cai, texto menciona queda |
| unit | se risco alto, texto menciona risco |
| integration | relatório inclui explicação |
| manual | ler explicação e conferir com gráficos |
| acceptance | não dizer que é melhor se score/robustez não sustentam |

## AuditTrail

| Tipo de teste | Critério |
|---|---|
| unit | audit tem empresa, cenário, versão e premissas |
| unit | hash muda quando input muda |
| integration | relatório exporta audit trail |
| manual | abrir JSON de auditoria e conferir fontes |
| acceptance | nenhuma simulação final sem audit trail |

## ExecutiveReport

| Tipo de teste | Critério |
|---|---|
| unit | relatório tem empresa e cenário |
| unit | relatório inclui saving e premissas |
| integration | relatório gera após stress |
| manual | ler relatório e ver se conta a história |
| acceptance | relatório não pode faltar audit trail |

## ExportEngine

| Tipo de teste | Critério |
|---|---|
| unit | JSON exportado é parseável |
| unit | CSV contém cabeçalho |
| integration | botão exportar gera arquivo |
| manual | baixar arquivo e abrir |
| acceptance | export não pode sair vazio |

## RecommendationPanel

| Tipo de teste | Critério |
|---|---|
| unit | cenário com score alto e stress ruim recebe ressalva |
| unit | sem evidência suficiente => confiança baixa |
| integration | recomendação aparece no relatório |
| manual | conferir se recomendação não ignora riscos |
| acceptance | recomendação precisa citar caveats quando existirem |