import assert from 'node:assert/strict';
import { buildRecommendation } from '../../assets/js/phase5/recommendation-engine.js';
import { calculateRobustness } from '../../assets/js/phase5/robustness-scorer.js';

for (const quality of [{}, { quality_score: null, risk_level: null }, { quality_score: 80 }]) {
  const robustness = calculateRobustness({
    companyId: 'empresa1',
    scenarioId: 'unknown-quality',
    stressResults: [
      { status: 'success', saving_pct: 5, scenario_still_better_than_baseline: true },
    ],
    quality,
    monteCarlo: { summary: { probability_saving_positive: 0.95, p10_saving_pct: 2 } },
  });
  assert.equal(robustness.robustness_score, null);
  assert.equal(robustness.robustness_status, 'unknown');
  assert.equal(robustness.robustness_interpretation, 'operational_quality_unavailable');
  assert.ok(robustness.alerts.some((alert) => /qualidade operacional indisponível/i.test(alert)));
}

const fiscalLimitedRobustness = calculateRobustness({
  companyId: 'empresa2',
  scenarioId: 'fiscal-limited',
  stressResults: [
    {
      status: 'success',
      saving_pct: 5,
      scenario_still_better_than_baseline: true,
      data_quality_status: 'limited_fiscal_coverage',
    },
  ],
  quality: { quality_score: 90, risk_level: 'low' },
});
assert.ok(Number.isFinite(fiscalLimitedRobustness.robustness_score));
assert.equal(
  fiscalLimitedRobustness.robustness_interpretation,
  'robustez_condicional_exploratoria'
);
assert.equal(fiscalLimitedRobustness.certified_robustness_score, null);
assert.equal(fiscalLimitedRobustness.cases_limited, 1);

const unknownQualityRecommendation = buildRecommendation({
  companyId: 'empresa1',
  selectedScenario: {
    scenario_id: 'unknown-quality',
    quality: { quality_score: null, risk_level: null },
    result: { evidence: { evidence_score: 95, blockers: [] } },
  },
  comparison: { saving_pct: 8 },
  quality: { quality_score: null, risk_level: null },
  robustness: { robustness_score: 99, alerts: [] },
});
assert.equal(unknownQualityRecommendation.recommendation_status, 'not_recommended');
assert.ok(
  unknownQualityRecommendation.main_risks.some((risk) =>
    /qualidade e risco operacional indisponíveis/i.test(risk)
  )
);

const qualityFallbackRecommendation = buildRecommendation({
  companyId: 'empresa1',
  selectedScenario: {
    scenario_id: 'known-quality',
    quality: { quality_score: 90, risk_level: 'low' },
  },
  comparison: { saving_pct: 8 },
  quality: {},
  robustness: { robustness_score: 85 },
});
assert.doesNotMatch(
  qualityFallbackRecommendation.main_risks.join(' '),
  /qualidade e risco operacional indisponíveis/i
);

console.log('OPERATIONAL_QUALITY_UNAVAILABLE_OK');
