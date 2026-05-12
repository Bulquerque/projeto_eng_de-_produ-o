/**
 * validateRelease — release gate para o pacote de entrega final.
 *
 * Escopo intencional:
 *   - Verifica se o finalQA passou (final_qa_status === 'passed').
 *   - Verifica que o pacote de exportação contém pelo menos um arquivo.
 *   - Verifica que um cenário foi selecionado (selected_scenario_id não nulo).
 *
 * O que este módulo NÃO faz por design:
 *   - Auditoria profunda do conteúdo dos arquivos exportados.
 *   - Validação semântica do cenário selecionado contra premissas de negócio.
 *   - Verificação de assinaturas ou integridade de dados.
 * Para auditoria completa, use o audit-trail-engine + export-center.
 */
export function validateRelease({ finalQA, testResults = {}, zipMetadata = {}, exportPackage = null, decisionPackage = null } = {}) {
  const blocking = [...(finalQA?.blocking_issues || [])];

  if (finalQA?.final_qa_status !== 'passed') blocking.push('QA final não passou.');

  // Verificação estrutural mínima do pacote exportado
  if (exportPackage !== null && !(exportPackage?.files?.length > 0)) {
    blocking.push('Pacote de exportação está vazio — nenhum arquivo gerado.');
  }

  // Verificação de que a seleção de cenário foi concluída
  if (decisionPackage !== null && !decisionPackage?.selected_scenario_id) {
    blocking.push('Nenhum cenário foi selecionado no pacote de decisão.');
  }

  const release_status = blocking.length ? 'blocked' : 'ready';
  return {
    release_status,
    release_name: 'visagio_static_simulator_FINAL_v1',
    blocking_issues: blocking,
    warnings: [],
    ready_to_deliver: release_status === 'ready',
    zip_metadata: zipMetadata,
    test_results: testResults
  };
}

