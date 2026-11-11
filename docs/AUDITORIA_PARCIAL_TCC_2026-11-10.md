# Auditoria parcial do TCC — 10/11/2026

Este registro não é validação científica nem substitui a execução canônica prevista no plano mestre. Resultados anteriores à última alteração não são números finais para o TCC.

## WACC da Empresa 1

A premissa WACC está presente no bundle protegido `costs.assumptions_used.wacc`. O runtime passa a usá-la quando válida; ausência ou referência inválida usa fallback identificado. A fonte examinada não informa periodicidade. A interpretação econômica e a comparabilidade entre períodos continuam pendentes; a correção de propagação não resolve essas questões.

## Espaço do otimizador

Para 15 CDs o espaço de subconjuntos não vazios contém 32.767 redes. Em reprodução sintética, 15 refinamentos novos para o catálogo inicial, mas pertencentes ao espaço declarado, produziam soma indevida de 32.767 + 15. O código separa agora refinamentos internos dos externos ao domínio. Isso reproduz o mecanismo da diferença histórica, mas os IDs dos refinamentos daquela execução não foram preservados e não estão comprovados. Na reexecução local após as alterações, o perfil balanceado E1 registrou espaço de 32.767, 51 candidatos simulados e busca não exata; isso é diagnóstico do software, não execução final auditada nem prova de ótimo global.

## Empresa 2: reconciliação fiscal

O ETL filtra o cenário de baseline e soma efeitos de débito menos crédito; não identifica uma chave comum de documento ou operação para conciliar o agregado com a referência canônica. A inspeção em memória identificou seis linhas da exportação que não aparecem no core: quatro vazias e duas não vazias fora do filtro do cenário de baseline. Sob esse filtro e a regra de parsing examinados, sua contribuição à soma de baseline é zero. Sua ausência não explica o residual fiscal; a causa da omissão de uma linha preenchida e a ponte de linhagem seguem pendentes. A proximidade de um ajuste agregado não demonstra causalidade.

## Empresa 2: um CD no ES

A referência do workbook e os cálculos físicos não demonstram equivalência de grão e componentes. Os blocos de cenário são agregados e não fornecem alocação completa de fluxos a CDs; o motor trata fluxos fábrica→CD como evidência operacional, requer peso identificável e aplica a regra de transferência conforme a classificação de realocação. Sem reconstrução comparável, os totais devem permanecer separados e a causa quantitativa da diferença é não demonstrada.

## Monte Carlo e transferência

A comparação pareada usa referência e alternativa submetidas aos mesmos choques, mantendo os níveis próprios de cada cenário; o teste de identidade é sintético. As taxas históricas de transferência da Empresa 1 têm uma divergência documentada entre a unidade da proveniência e a unidade aplicada no motor, e a distância CD–destino não demonstra o trecho físico fornecedor–CD. Permanecem um proxy exploratório sem calibração validada.

## Entrega e pendências

O gerador de handoff produz apenas estrutura de diagnóstico, com resultados e documentos indisponíveis bloqueados. Ainda são necessários execução consolidada após as últimas mudanças, reconciliações dos componentes físicos e fiscais, cenários e perfis exigidos, robustez e guias editoriais com proveniência. Não usar o pacote de diagnóstico como base numérica final do TCC.
