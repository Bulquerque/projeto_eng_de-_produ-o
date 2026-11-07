import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {
  buildAcademicPackageNarratives,
  buildMonteCarloRow,
  buildOptimizationRow,
  formatPackageBrl,
  buildHistoricalSnapshotNotice,
  normalizePackageNumber,
  safeScenarioCost,
  safeScenarioTotal,
} from '../../scripts/academic-package-content.mjs';

assert.equal(normalizePackageNumber(null), null);
assert.equal(normalizePackageNumber(undefined), null);
assert.equal(normalizePackageNumber(''), null);
assert.equal(normalizePackageNumber('n/a'), null);
assert.equal(normalizePackageNumber(true), null);
assert.equal(normalizePackageNumber(0), 0);
assert.equal(formatPackageBrl(null), 'n.a.');
assert.equal(safeScenarioTotal({ simulation_status: 'error', total_with_tax: 900 }), null);
assert.equal(
  safeScenarioCost({ simulation_status: 'invalid', costs: { tax_impact: 10 } }, 'tax_impact'),
  null
);
assert.equal(
  safeScenarioTotal({
    simulation_status: 'success',
    errors: ['partial failure'],
    total_with_tax: 900,
  }),
  null
);
assert.equal(safeScenarioTotal({ simulation_status: 'success', total_with_tax: 0 }), 0);

const mcRow = buildMonteCarloRow('Empresa sintética', {
  monte_carlo_status: 'success',
  iterations: 12,
  seed: 7,
  profile: 'balanced',
  scatter_driver: 'freight_multiplier',
  summary: {
    invalid_sample_count: 0,
    mean_saving_pct: 2,
    p10_saving_pct: -1,
    median_saving_pct: 2,
    p90_saving_pct: 5,
  },
});
assert.deepEqual(mcRow, [
  'Empresa sintética',
  12,
  7,
  'balanced',
  'freight_multiplier',
  2,
  -1,
  2,
  5,
]);
assert.deepEqual(
  buildMonteCarloRow('Empresa sintética', {
    monte_carlo_status: 'success',
    iterations: 12,
    seed: 7,
    profile: 'balanced',
    scatter_driver: 'freight_multiplier',
    summary: {
      invalid_sample_count: 0,
      mean_saving_pct: 2,
      p10_saving_pct: -1,
      median_saving_pct: 2,
      p90_saving_pct: 5,
    },
  }),
  ['Empresa sintética', 12, 7, 'balanced', 'freight_multiplier', 2, -1, 2, 5]
);
for (const invalidCount of [undefined, 2]) {
  const row = buildMonteCarloRow('Empresa sintética', {
    monte_carlo_status: 'success',
    iterations: 12,
    seed: 7,
    profile: 'balanced',
    scatter_driver: 'freight_multiplier',
    summary: {
      invalid_sample_count: invalidCount,
      mean_saving_pct: 2,
      p10_saving_pct: -1,
      median_saving_pct: 2,
      p90_saving_pct: 5,
    },
  });
  assert.deepEqual(row.slice(1, 5), [12, 7, 'balanced', 'freight_multiplier']);
  assert.deepEqual(row.slice(5), [null, null, null, null]);
}
assert.deepEqual(
  buildMonteCarloRow('Empresa sintética', {
    monte_carlo_status: 'error',
    iterations: 12,
    seed: 7,
    summary: { mean_saving_pct: 100 },
  }),
  ['Empresa sintética', null, null, null, null, null, null, null, null]
);
assert.deepEqual(
  buildMonteCarloRow('Empresa sintética', {
    monte_carlo_status: 'success',
    errors: ['failed samples'],
    iterations: 12,
    summary: { mean_saving_pct: 100 },
  }),
  ['Empresa sintética', null, null, null, null, null, null, null, null]
);
assert.deepEqual(
  buildOptimizationRow('Empresa sintética', 'profile-a', {
    optimizer_status: 'success',
    best: [{ scenario_id: 'candidate-synthetic', total_with_tax: 88, score: 4, saving_pct: 12 }],
  }),
  ['Empresa sintética', 'profile-a', 'success', null, null, null, null, null, null]
);
assert.deepEqual(
  buildOptimizationRow('Empresa sintética', 'profile-a', {
    optimizer_status: 'success',
    best: [
      {
        simulation_status: 'success',
        scenario_id: 'candidate-valid',
        total_with_tax: 88,
        score: 4,
        saving_pct: 12,
        risk_level: 'low',
      },
    ],
  }),
  ['Empresa sintética', 'profile-a', 'success', null, 'candidate-valid', 4, 88, 12, 'low']
);

const content = buildAcademicPackageNarratives({
  generated_at: '2026-11-03T12:00:00.000Z',
  companies: {
    empresa1: {
      baseline: { simulation_status: 'error', total_with_tax: 123456 },
      reconciliation: { operational: { status: 'partial', rows: [{}, {}] }, tax: { summary: {} } },
      inventory_independence_test: {
        comparison_status: 'not_comparable',
        equal_inventory_cost: null,
      },
      optimization: {
        alpha: {
          optimizer_status: 'success',
          best: [{ simulation_status: 'success', scenario_id: 'synthetic-A' }],
        },
        beta: { optimizer_status: 'blocked', best: [] },
      },
    },
    empresa2: {
      baseline: { simulation_status: 'success', total_with_tax: 0 },
      reconciliation: {
        operational: { status: 'aligned', rows: [{}] },
        tax: { summary: { raw_difference_pct: 2.5 } },
      },
      inventory_independence_test: {
        comparison_status: 'compared',
        equal_inventory_cost: true,
        one_cd: { simulation_status: 'success', costs: { inventory_cost: 25 } },
        all_cds: { simulation_status: 'success', costs: { inventory_cost: 25 } },
      },
      optimization: {
        single: { optimizer_status: 'success', best: [{ scenario_id: 'synthetic-B' }] },
      },
    },
  },
});
assert.match(content.report, /2026-11-03T12:00:00.000Z/);
assert.match(content.report, /baseline error; total com tributo n\.a\./);
assert.doesNotMatch(content.report, /123\.456/);
assert.match(content.report, /2 indicadores operacionais registrados/);
assert.match(content.report, /2,5%/);
assert.match(content.report, /alpha \(success\).*synthetic-A/);
assert.match(content.report, /beta \(blocked\): seleção indisponível/);
assert.match(content.report, /Custos iguais/iu);
assert.doesNotMatch(
  content.report,
  /quatro perfis|candidate_002|R\$ 513\.907,63|erro zero nos oito/i
);
assert.match(content.validation, /não executou a suíte de testes/);
assert.match(content.validation, /snapshots preservados/);
assert.match(content.validation, /Revisão humana\/acadêmica final: pendente/);
assert.match(content.taxAudit, /não consulta fontes normativas/);
assert.match(content.taxAudit, /baseline error/);
assert.equal(content.statusRows.length, 12);
assert.match(content.statusRows[0][2], /Pendente/);

const builder = await fs.readFile(
  new URL('../../scripts/build_academic_package.mjs', import.meta.url),
  'utf8'
);
for (const outputName of [
  'LEIA_ME_PRIMEIRO.md',
  'AUDITORIA_TRIBUTARIA_PROFISSIONAL.md',
  'VALIDACAO_FINAL.md',
  'pacote_dados_corrigidos.xlsx',
  'matriz_plano_trabalho.csv',
])
  assert.ok(builder.includes(outputName), `interface de saída removida: ${outputName}`);
for (const sheetName of [
  'Resumo',
  'Baseline',
  'Reconciliação',
  'Estoque teste',
  'Monte Carlo',
  'Mecanismo de avaliação',
  'Plano',
  'Fontes',
])
  assert.ok(builder.includes(`'${sheetName}'`), `planilha removida: ${sheetName}`);
assert.match(builder, /buildMonteCarloRow\(cid, c\.monte_carlo\)/);
assert.match(builder, /validation_snapshots/);
assert.match(builder, /available_not_copied/);
assert.match(builder, /buildHistoricalSnapshotNotice/);
assert.match(builder, /historical_document_snapshots/);
assert.doesNotMatch(builder, /Todos os testes automatizados disponíveis no checkout passaram/);
assert.doesNotMatch(builder, /erro zero nos oito indicadores/);
const snapshot = buildHistoricalSnapshotNotice('# Documento original\n\nConteúdo não alterado.', {
  sourcePath: 'RELATORIO_FINAL_ACADEMICO.md',
  packagedAt: '2026-11-03T14:00:00.000Z',
  fileModifiedAt: '2026-10-30T12:00:00.000Z',
});
assert.match(snapshot, /^> Aviso:.*snapshot/);
assert.match(snapshot, /RELATORIO_FINAL_ACADEMICO\.md/);
assert.match(snapshot, /2026-11-03T14:00:00\.000Z/);
assert.match(snapshot, /2026-10-30T12:00:00\.000Z/);
assert.ok(snapshot.endsWith('# Documento original\n\nConteúdo não alterado.'));
console.log('ACADEMIC_PACKAGE_CONTENT_OK');
