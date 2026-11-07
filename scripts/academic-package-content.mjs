export function normalizePackageNumber(value) {
  if (
    value == null ||
    typeof value === 'boolean' ||
    (typeof value === 'string' && value.trim() === '')
  )
    return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export function formatPackageBrl(value) {
  const number = normalizePackageNumber(value);
  return number == null
    ? 'n.a.'
    : `R$ ${number.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function safeScenarioTotal(result) {
  return isCleanSuccess(result) ? normalizePackageNumber(result.total_with_tax) : null;
}

export function safeScenarioCost(result, field) {
  return isCleanSuccess(result) ? normalizePackageNumber(result.costs?.[field]) : null;
}

function isCleanSuccess(result) {
  return result?.simulation_status === 'success' && !(result.errors?.length > 0);
}

export function buildMonteCarloRow(companyLabel, monteCarlo = {}) {
  const summary = monteCarlo.summary || {};
  const configurationUsable =
    monteCarlo.monte_carlo_status === 'success' && !(monteCarlo.errors?.length > 0);
  const statisticsUsable =
    configurationUsable && normalizePackageNumber(summary.invalid_sample_count) === 0;
  return [
    companyLabel,
    configurationUsable ? normalizePackageNumber(monteCarlo.iterations) : null,
    configurationUsable ? normalizePackageNumber(monteCarlo.seed) : null,
    configurationUsable ? (monteCarlo.profile ?? null) : null,
    configurationUsable ? (monteCarlo.scatter_driver ?? null) : null,
    statisticsUsable ? normalizePackageNumber(summary.mean_saving_pct) : null,
    statisticsUsable ? normalizePackageNumber(summary.p10_saving_pct) : null,
    statisticsUsable ? normalizePackageNumber(summary.median_saving_pct) : null,
    statisticsUsable ? normalizePackageNumber(summary.p90_saving_pct) : null,
  ];
}

export function buildHistoricalSnapshotNotice(
  content,
  { sourcePath, packagedAt, fileModifiedAt } = {}
) {
  const packaged = packagedAt || 'não informado';
  const modified = fileModifiedAt || 'não informado';
  const notice = `> Aviso: snapshot de referência de \`${sourcePath || 'origem não informada'}\`, empacotado em ${packaged}. O arquivo foi copiado sem edição e não foi revisado ou atualizado pelo gerador. A data de modificação (${modified}) é metadado do sistema de arquivos, não prova da data ou validade do conteúdo. Este snapshot não certifica o estado atual do projeto.`;
  return `${notice}\n\n${String(content ?? '')}`;
}

export function buildOptimizationRow(companyLabel, profileId, optimization = {}) {
  const best = optimization.best?.[0] || {};
  const selectedResultIsUsable =
    ['success', 'success_with_limited_space'].includes(optimization.optimizer_status) &&
    !(optimization.errors?.length > 0) &&
    isCleanSuccess(best);
  return [
    companyLabel,
    profileId,
    optimization.optimizer_status ?? null,
    optimization.result_scope ?? null,
    selectedResultIsUsable ? (best.scenario_id ?? null) : null,
    selectedResultIsUsable ? normalizePackageNumber(best.final_score ?? best.score) : null,
    selectedResultIsUsable ? normalizePackageNumber(best.total_with_tax) : null,
    selectedResultIsUsable ? normalizePackageNumber(best.saving_pct) : null,
    selectedResultIsUsable ? (best.risk_level ?? null) : null,
  ];
}

function companyEntries(evidence = {}) {
  return Object.entries(evidence.companies || {});
}

function evidenceCoverage(evidence = {}) {
  return companyEntries(evidence).length > 0;
}

function profilesNarrative(companies) {
  const descriptions = [];
  for (const [companyId, company] of companies) {
    const profiles = Object.entries(company.optimization || {});
    if (profiles.length === 0) {
      descriptions.push(`${companyId}: avaliações por perfil não disponíveis nesta evidência.`);
      continue;
    }
    const selections = profiles.map(([profileId, result]) => {
      const best = result?.best?.[0];
      const status = result?.optimizer_status || 'sem status registrado';
      const selected =
        ['success', 'success_with_limited_space'].includes(result?.optimizer_status) &&
        !(result?.errors?.length > 0) &&
        isCleanSuccess(best)
          ? `melhor cenário registrado ${best.scenario_id || 'sem identificador'}`
          : 'seleção indisponível';
      return `${profileId} (${status}): ${selected}`;
    });
    descriptions.push(`${companyId}: ${selections.join('; ')}.`);
  }
  return descriptions.join('\n');
}

function reconciliationNarrative(companies) {
  return companies
    .map(([companyId, company]) => {
      const operational = company.reconciliation?.operational;
      const rows = operational?.rows || [];
      const status = operational?.status || 'status não registrado';
      const tax = company.reconciliation?.tax?.summary;
      const rawDiff = normalizePackageNumber(tax?.raw_difference_pct);
      const taxText =
        rawDiff == null
          ? 'reconciliação tributária: evidência numérica indisponível'
          : `diferença tributária bruta registrada: ${rawDiff.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%`;
      return `${companyId}: ${rows.length} indicadores operacionais registrados (${status}); ${taxText}.`;
    })
    .join('\n');
}

function inventoryNarrative(companies) {
  return companies
    .map(([companyId, company]) => {
      const test = company.inventory_independence_test || {};
      if (
        test.comparison_status !== 'compared' ||
        typeof test.equal_inventory_cost !== 'boolean' ||
        safeScenarioCost(test.one_cd, 'inventory_cost') == null ||
        safeScenarioCost(test.all_cds, 'inventory_cost') == null
      ) {
        return `${companyId}: comparação do custo de estoque pendente; resultados de simulação válidos para os dois casos não foram confirmados nesta evidência.`;
      }
      return `${companyId}: comparação registrada como ${test.equal_inventory_cost ? 'custos iguais' : 'custos diferentes'} nos casos presentes no artefato. Isso descreve somente esses casos e não demonstra efeito causal geral.`;
    })
    .join('\n');
}

function buildTaxAudit(companies, generatedAt) {
  const companyStatus = companies.length
    ? companies
        .map(([companyId, company]) => {
          const baselineStatus = company.baseline?.simulation_status || 'status não registrado';
          const taxCoverage =
            company.baseline?.quality?.data_quality?.coverage ||
            company.baseline?.data_quality?.coverage ||
            null;
          const coverageText = taxCoverage
            ? ` cobertura informada: ${JSON.stringify(taxCoverage)}.`
            : ' métricas de cobertura fiscal não foram anexadas nesta evidência.';
          return `- ${companyId}: baseline ${baselineStatus};${coverageText}`;
        })
        .join('\n')
    : '- Evidência por empresa indisponível.';
  return `# Auditoria tributária: escopo e evidência

Timestamp do artefato: ${generatedAt}.

Este documento não certifica apuração fiscal nem validação legal. Ele resume apenas campos de evidência anexados a esta execução.

## Dados disponíveis

${companyStatus}

## Pendências

Campos ausentes, status de execução diferente de success ou cobertura não documentada permanecem pendentes. Não inferir alíquota, crédito, cobertura completa ou valor zero a partir de campo ausente.

Este gerador não consulta fontes normativas e não confirma legislação vigente. Revisão fiscal e jurídica requer fonte oficial atual e validação por responsável qualificado.
`;
}

export function buildAcademicPackageNarratives(evidence = {}) {
  const companies = companyEntries(evidence);
  const generatedAt = evidence.generated_at || 'não informado no artefato de evidência';
  const coverage = evidenceCoverage(evidence);
  const companySummary = coverage
    ? companies
        .map(([companyId, company]) => {
          const baselineStatus = company.baseline?.simulation_status || 'status não registrado';
          const baselineTotal = safeScenarioTotal(company.baseline);
          return `- ${companyId}: execução do baseline ${baselineStatus}; total com tributo ${formatPackageBrl(baselineTotal)}`;
        })
        .join('\n')
    : '- Evidência por empresa não disponível nesta geração.';
  const missingEvidence =
    'Pendente: evidência correspondente não foi fornecida ou não permite confirmar a afirmação nesta geração.';
  const report = `# Pacote de evidências para revisão do relatório Visagio

Data registrada no artefato: ${generatedAt}. O conteúdo abaixo deriva de evidence.json; este pacote não executa simulações ou testes.

## Execuções de baseline

${companySummary}

## Reconciliação

${coverage ? reconciliationNarrative(companies) : missingEvidence}

Os valores só devem ser interpretados dentro do escopo e status registrado no artefato de evidência. Ausência de número não é zero.

## Teste de sensibilidade ao número de CDs

${coverage ? inventoryNarrative(companies) : missingEvidence}

## Sensibilidade da otimização aos perfis

${coverage ? profilesNarrative(companies) : missingEvidence}

Os perfis e seleções acima são enumerados a partir do que está efetivamente registrado. O resultado não comprova ranking atual fora do timestamp indicado.

## Monte Carlo

As iterações, seed, perfil, driver e estatísticas devem ser lidas da planilha gerada a partir dos campos emitidos pelo artefato. Se o status da execução não for 'success', esses valores ficam indisponíveis.

## Limites

O gerador não certifica a situação atual do código, não atesta revisão acadêmica e não converte snapshots históricos em evidência atual. Itens sem evidência permanecem pendentes. Fontes originais privadas não são copiadas, mas evidence.json e outros resultados derivados podem conter dados empresariais sensíveis; mantenha o pacote em ambiente autorizado e revise seu conteúdo antes de compartilhá-lo.
`;
  const validation = `# Estado de validação

O gerador deste pacote não executou a suíte de testes. Portanto, não afirma que testes, lint ou fluxos E2E passaram nesta execução.

Os relatórios de validação anexados, quando presentes, são snapshots preservados como arquivos de referência. A data e o escopo de cada relatório devem ser verificados no próprio artefato; não são prova de estado atual do checkout.

## Dados desta evidência

Timestamp informado por evidence.json: ${generatedAt}.

${coverage ? companySummary : '- Evidência por empresa indisponível.'}

## Pendências

- Revisão humana/acadêmica final: pendente, salvo evidência explícita fora deste gerador.
- Afirmações sem suporte nos campos fornecidos: pendentes.
- Simulações com status diferente de success: valores numéricos não apresentados.
`;
  const statusRows = [
    [
      '1',
      'Reconciliação e savings',
      missingEvidence,
      'Alta',
      'Anexar cálculos atuais e rastreáveis.',
    ],
    [
      '2',
      'Papel do Monte Carlo',
      missingEvidence,
      'Alta',
      'Documentar status, iterações, seed e escopo emitidos.',
    ],
    [
      '3',
      'Custo de estoque e CDs',
      missingEvidence,
      'Alta',
      'Usar somente comparação de resultados válidos.',
    ],
    [
      '4',
      'Calibração de transferência',
      missingEvidence,
      'Alta',
      'Anexar origem e método de calibração.',
    ],
    [
      '5',
      'Desvio de baseline',
      missingEvidence,
      'Alta',
      'Anexar referências comparáveis e status.',
    ],
    [
      '6',
      'Perfis e ranking',
      missingEvidence,
      'Média',
      'Enumerar perfis efetivamente presentes na evidência.',
    ],
    ['7', 'Fallbacks', missingEvidence, 'Média', 'Anexar diagnóstico atual dos fallbacks.'],
    [
      '8',
      'Fixo/variável de armazenagem',
      missingEvidence,
      'Média',
      'Anexar decomposição observada ou manter como limitação.',
    ],
    [
      '9',
      'Duplicidade core/tax',
      missingEvidence,
      'Média',
      'Revisar no código atual antes de concluir.',
    ],
    [
      '10',
      'Justificativa de busca',
      missingEvidence,
      'Baixa',
      'Anexar espaço e escopo de busca efetivamente avaliados.',
    ],
    [
      '11',
      'Proxy tributário',
      missingEvidence,
      'Baixa',
      'Identificar fonte, status e cobertura na evidência.',
    ],
    [
      '12',
      'Revisão final do relatório',
      'Pendente: o gerador não registra aprovação acadêmica.',
      'Alta',
      'Revisar texto, tabelas, figuras, equações e sumário com evidência atual.',
    ],
  ];
  return { report, validation, taxAudit: buildTaxAudit(companies, generatedAt), statusRows };
}
