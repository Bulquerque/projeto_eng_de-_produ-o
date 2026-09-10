/**
 * validateRelease — release gate para o pacote de entrega final.
 *
 * Escopo intencional:
 *   - Verifica se o finalQA passou (final_qa_status === 'passed').
 *   - Verifica que o pacote de exportação contém pelo menos um arquivo.
 *   - Verifica que um cenário foi selecionado (selected_scenario_id não nulo).
 *
 * O gate valida a presença e a consistência mínima do JSON exportado com o
 * pacote de decisão. Ele não substitui uma validação semântica de negócio,
 * assinatura criptográfica ou validação fiscal independente.
 */
export function validateRelease({
  finalQA,
  testResults = {},
  zipMetadata = {},
  exportPackage = null,
  decisionPackage = null,
} = {}) {
  const blocking = [...(finalQA?.blocking_issues || [])];

  const failedTests = Object.entries(testResults || {})
    .filter(([, value]) => value === false || value?.status === 'failed')
    .map(([name]) => `Teste de release falhou: ${name}.`);
  blocking.push(...failedTests);

  if (finalQA?.final_qa_status !== 'passed') blocking.push('QA final não passou.');

  if (exportPackage === null) {
    blocking.push('Pacote de exportação ausente.');
  } else if (!(exportPackage?.files?.length > 0)) {
    blocking.push('Pacote de exportação está vazio — nenhum arquivo gerado.');
  }

  // Verificação de que a seleção de cenário foi concluída
  if (decisionPackage === null) {
    blocking.push('Pacote de decisão ausente.');
  } else if (!decisionPackage?.selected_scenario_id) {
    blocking.push('Nenhum cenário foi selecionado no pacote de decisão.');
  }

  if (exportPackage?.files?.length) {
    const jsonFile = exportPackage.files.find((file) => file.type === 'application/json');
    if (!jsonFile?.content) {
      blocking.push('Exportação JSON ausente ou vazia.');
    } else {
      try {
        const exported = JSON.parse(jsonFile.content);
        if (exported.company_id !== decisionPackage?.company_id) {
          blocking.push('Empresa do JSON exportado diverge do pacote de decisão.');
        }
        if (
          exported.decision_package?.selected_scenario_id !== decisionPackage?.selected_scenario_id
        ) {
          blocking.push('Cenário selecionado diverge entre pacote e JSON exportado.');
        }
        if (finalQA && exported.final_qa?.final_qa_status !== finalQA.final_qa_status) {
          blocking.push('Status do QA final diverge entre runtime e JSON exportado.');
        }
      } catch {
        blocking.push('JSON exportado não é válido.');
      }
    }
  }

  const release_status = blocking.length ? 'blocked' : 'ready';
  return {
    release_status,
    release_name: 'visagio_static_simulator_FINAL_v1',
    blocking_issues: blocking,
    warnings: [],
    ready_to_deliver: release_status === 'ready',
    zip_metadata: zipMetadata,
    test_results: testResults,
  };
}
