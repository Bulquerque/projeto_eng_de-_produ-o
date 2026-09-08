import { DEFAULT_OBJECTIVE_PROFILES } from './objective-profile-library.js';
import { normalizeMetrics } from './metric-normalizer.js';
import { scoreScenarios } from './scenario-scoring.js';

const STABILITY_THRESHOLDS = Object.freeze({
  stable: 0.67,
  sensitive: 0.5,
});

/**
 * Mede se o ranking permanece estável quando a decisão é vista por perfis
 * de pesos diferentes. Isto é uma auditoria do ranking, não um segundo
 * otimizador e não altera o cenário oficial escolhido.
 */
export function assessObjectiveSensitivity({
  companyId,
  scenarioMetrics = [],
  referenceMetrics = [],
  profiles = DEFAULT_OBJECTIVE_PROFILES,
} = {}) {
  const normalized = normalizeMetrics({
    companyId,
    scenarioMetrics,
    referenceMetrics,
  });
  const profileResults = profiles.map((profile) => {
    const scoring = scoreScenarios({
      companyId,
      objective: { weights: profile.weights },
      normalizedMetrics: normalized.normalized_metrics,
    });
    const ranking = scoring.scored_scenarios.map((row) => ({
      scenario_id: row.scenario_id,
      rank: row.rank,
      final_score: row.final_score,
    }));
    return {
      profile_id: profile.profile_id,
      profile_name: profile.profile_name,
      weights: { ...profile.weights },
      winner_scenario_id: ranking[0]?.scenario_id || null,
      ranking,
    };
  });

  const winnerCounts = {};
  profileResults.forEach((result) => {
    if (result.winner_scenario_id)
      winnerCounts[result.winner_scenario_id] = (winnerCounts[result.winner_scenario_id] || 0) + 1;
  });
  const winnerFrequency = Object.entries(winnerCounts)
    .map(([scenario_id, count]) => ({
      scenario_id,
      profile_count: count,
      profile_share: profileResults.length ? count / profileResults.length : 0,
    }))
    .sort((left, right) => right.profile_count - left.profile_count);
  const top = winnerFrequency[0] || null;
  const stability = top ? top.profile_share : 0;
  const warnings = [...(normalized.warnings || [])];
  if (stability < 0.5)
    warnings.push(
      'O vencedor do ranking muda entre perfis; a recomendação depende dos pesos escolhidos.'
    );
  return {
    company_id: companyId,
    profiles_evaluated: profileResults.length,
    profile_results: profileResults,
    winner_frequency: winnerFrequency,
    most_stable_scenario_id: top?.scenario_id || null,
    stability_ratio: stability,
    stability_status:
      stability >= STABILITY_THRESHOLDS.stable
        ? 'stable'
        : stability >= STABILITY_THRESHOLDS.sensitive
          ? 'sensitive'
          : 'unstable',
    warnings,
    errors: normalized.errors || [],
  };
}
