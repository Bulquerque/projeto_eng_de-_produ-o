import { $, escapeHtml, formatBRL, formatNumber, formatPct, metric } from '../../core/common.js';
import {
  renderMonteCarloHistogram,
  renderMonteCarloPercentileCurve,
  renderMonteCarloScatter,
  renderMonteCarloRiskDonut,
  renderMonteCarloTotalCurve,
  renderMonteCarloDriverImportance,
} from '../charts.js';

const MONTE_CARLO_DRIVER_LABELS = {
  freight_multiplier: 'Frete',
  demand_multiplier: 'Demanda',
  inventory_days: 'Dias de estoque',
  wacc: 'WACC',
  tax_multiplier: 'Tributo',
};
const VALID_RISK_BANDS = new Set(['high', 'medium', 'low']);

function monteCarloProfileLabel(profile) {
  return (
    {
      conservative: 'Conservador',
      balanced: 'Equilibrado',
      broad: 'Amplo',
    }[profile] || 'Equilibrado'
  );
}

function monteCarloDriverLabel(driver) {
  return MONTE_CARLO_DRIVER_LABELS[driver] || driver || '—';
}

function monteCarloInterpretation(summary, hasValidSamples) {
  if (!summary) {
    return 'Sem amostras válidas; faixa de risco e leitura probabilística indisponíveis.';
  }
  if (!hasValidSamples) {
    return 'Sem amostras válidas; faixa de risco e leitura probabilística indisponíveis.';
  }
  if (!VALID_RISK_BANDS.has(summary.risk_band)) {
    if (summary.risk_band_unavailable_reason === 'invalid_samples_present') {
      const invalidCount = Number(summary.invalid_sample_count || 0);
      return `Faixa de risco Monte Carlo indisponível: ${invalidCount} ${invalidCount === 1 ? 'iteração inválida' : 'iterações inválidas'}; estatísticas observadas nas iterações válidas.`;
    }
    return 'Sem faixa de risco Monte Carlo válida; leitura executiva indisponível.';
  }
  if (summary.risk_band === 'high') {
    return 'A distribuição indica risco relevante de perda de saving. Vale revisar premissas e drivers mais voláteis.';
  }
  if (summary.risk_band === 'medium') {
    return 'O cenário mantém saving na maior parte das amostras, mas ainda existe dispersão que merece atenção.';
  }
  return 'O cenário mostra estabilidade razoável nas amostras e sustentação probabilística para a decisão.';
}

export function renderScenarioMonteCarlo(state) {
  const summary = state.monteCarlo?.summary;
  const validIterations = Number(
    summary?.iterations_valid ?? summary?.iterations ?? state.monteCarlo?.samples?.length ?? 0
  );
  const hasValidSamples = Number.isFinite(validIterations) && validIterations > 0;
  const unavailable = 'sem amostras válidas';

  function renderMonteCarloSummaryCards() {
    const el = $('monteCarloSummaryCards');
    const tableEl = $('monteCarloSummaryTable');
    if (!summary) {
      if (el) el.innerHTML = '';
      if (tableEl)
        tableEl.innerHTML = `<div class="empty-state">${escapeHtml(
          state.monteCarlo?.risk_band_unavailable_reason === 'no_valid_samples'
            ? 'Sem amostras válidas; indicadores probabilísticos indisponíveis.'
            : 'Rode o cenário para visualizar a distribuição probabilística.'
        )}</div>`;
      return;
    }

    const driverLabel = monteCarloDriverLabel(summary.most_sensitive_driver);
    const driverCorrelation = Number(summary.most_sensitive_driver_correlation || 0);
    if (el) {
      el.innerHTML = [
        metric(
          'Prob. saving positivo',
          hasValidSamples ? formatPct(summary.probability_saving_positive * 100, 1) : '—',
          !hasValidSamples
            ? unavailable
            : VALID_RISK_BANDS.has(summary.risk_band)
              ? `risco Monte Carlo ${summary.risk_band}`
              : 'faixa Monte Carlo indisponível'
        ),
        metric(
          'Prob. saving negativo',
          hasValidSamples ? formatPct(summary.probability_saving_loss * 100, 1) : '—',
          hasValidSamples ? 'cenário abaixo do baseline' : 'sem amostras válidas'
        ),
        metric(
          'Saving mediano',
          hasValidSamples ? formatPct(summary.median_saving_pct, 1) : '—',
          hasValidSamples
            ? `p10 ${formatPct(summary.p10_saving_pct, 1)} · p90 ${formatPct(summary.p90_saving_pct, 1)}`
            : unavailable
        ),
        metric(
          'Desvio saving',
          hasValidSamples ? formatPct(summary.stddev_saving_pct, 1) : '—',
          hasValidSamples ? 'dispersão entre amostras' : unavailable
        ),
        metric(
          'Custo mediano',
          hasValidSamples ? formatBRL(summary.median_total_with_tax, true) : '—',
          hasValidSamples
            ? `p10 ${formatBRL(summary.p10_total_with_tax, true)} · p90 ${formatBRL(summary.p90_total_with_tax, true)}`
            : unavailable
        ),
        metric(
          'Custo esperado',
          hasValidSamples ? formatBRL(summary.mean_total_with_tax, true) : '—',
          hasValidSamples ? `desvio ${formatBRL(summary.stddev_total_with_tax, true)}` : unavailable
        ),
        metric(
          'Driver mais influente',
          hasValidSamples ? driverLabel : '—',
          hasValidSamples
            ? `${driverCorrelation >= 0 ? '+' : ''}${driverCorrelation.toFixed(2)} de correlação`
            : unavailable
        ),
        metric(
          'Percentil do cenário',
          hasValidSamples
            ? `${Number(summary.deterministic_percentile_saving_pct || 0).toFixed(0)}º`
            : '—',
          hasValidSamples ? 'posição do cenário base na distribuição' : unavailable
        ),
        metric(
          'Iterações',
          formatNumber(summary.iterations_valid ?? summary.iterations, 0),
          `${formatNumber(summary.iterations_requested ?? summary.iterations, 0)} solicitadas · seed ${summary.seed_effective ?? summary.seed}`
        ),
      ].join('');
    }

    if (tableEl) {
      tableEl.innerHTML = `
      <table class="executive-table-premium">
        <thead><tr><th>Indicador</th><th>Valor</th></tr></thead>
        <tbody>
          <tr><td>Perfil</td><td>${escapeHtml(monteCarloProfileLabel(summary.profile))}</td></tr>
          <tr><td>Seed / RNG</td><td>${escapeHtml(String(summary.seed_effective ?? summary.seed ?? '—'))} · ${escapeHtml(summary.rng_algorithm || '—')}</td></tr>
          <tr><td>Modelo</td><td>${escapeHtml(summary.analysis_type || 'exploratory_uncertainty_analysis')} · fonte: ${escapeHtml(summary.uncertainty_source || 'parametric_assumptions')} · histórico: ${summary.historical_distribution ? 'sim' : 'não'}</td></tr>
          <tr><td>Observações históricas</td><td>${escapeHtml(JSON.stringify(summary.historical_observation_counts || {}))}${summary.historical_sample_warning ? ` · ${escapeHtml(summary.historical_sample_warning)}` : ''}</td></tr>
          <tr><td>Suporte conjunto</td><td>${escapeHtml(`${summary.historical_unique_joint_support ?? 0} combinações únicas · ${summary.historical_complete_joint_observations ?? 0} casos completos`)}</td></tr>
          <tr><td>Erro Monte Carlo</td><td>${hasValidSamples ? `${escapeHtml(summary.monte_carlo_probability_positive_standard_error == null ? '—' : formatPct(summary.monte_carlo_probability_positive_standard_error * 100, 2))} · IC condicional: ${escapeHtml(summary.monte_carlo_probability_positive_lower_95 == null ? '—' : formatPct(summary.monte_carlo_probability_positive_lower_95 * 100, 1))}–${escapeHtml(summary.monte_carlo_probability_positive_upper_95 == null ? '—' : formatPct(summary.monte_carlo_probability_positive_upper_95 * 100, 1))}` : '— · IC condicional: —–—'}</td></tr>
          <tr><td>Leitura executiva</td><td>${escapeHtml(monteCarloInterpretation(summary, hasValidSamples))}</td></tr>
          <tr><td>Prob. saving positivo</td><td>${hasValidSamples ? formatPct(summary.probability_saving_positive * 100, 1) : '—'}</td></tr>
          <tr><td>Prob. saving negativo</td><td>${hasValidSamples ? formatPct(summary.probability_saving_loss * 100, 1) : '—'}</td></tr>
          <tr><td>Saving p10 / p50 / p90</td><td>${hasValidSamples ? `${formatPct(summary.p10_saving_pct, 1)} · ${formatPct(summary.median_saving_pct, 1)} · ${formatPct(summary.p90_saving_pct, 1)}` : '— · — · —'}</td></tr>
          <tr><td>Total p10 / p50 / p90</td><td>${hasValidSamples ? `${formatBRL(summary.p10_total_with_tax, true)} · ${formatBRL(summary.median_total_with_tax, true)} · ${formatBRL(summary.p90_total_with_tax, true)}` : '— · — · —'}</td></tr>
          <tr><td>Driver mais influente</td><td>${hasValidSamples ? `${escapeHtml(driverLabel)} (${driverCorrelation >= 0 ? '+' : ''}${driverCorrelation.toFixed(2)})` : '—'}</td></tr>
          <tr><td>Interpretação</td><td>${escapeHtml(summary.probability_interpretation || 'condicional às premissas informadas')}</td></tr>
          <tr><td>Limitação</td><td>Probabilidades e percentis são condicionais ao histórico disponível e ao modelo; não são intervalo de confiança formal.</td></tr>
        </tbody>
      </table>
    `;
    }
  }

  function renderMonteCarlo() {
    renderMonteCarloSummaryCards();
    renderMonteCarloHistogram(hasValidSamples ? summary?.histogram : null);
    renderMonteCarloPercentileCurve(hasValidSamples ? summary?.percentile_curve : null);
    renderMonteCarloTotalCurve(hasValidSamples ? summary?.total_percentile_curve : null);
    renderMonteCarloRiskDonut(hasValidSamples ? summary : null);
    renderMonteCarloDriverImportance(
      (hasValidSamples ? summary?.driver_importance || [] : []).map((item) => ({
        ...item,
        label: monteCarloDriverLabel(item.driver),
      }))
    );
    renderMonteCarloScatter(
      hasValidSamples ? state.monteCarlo?.samples || [] : [],
      summary?.scatter_driver || state.monteCarloConfig?.scatter_driver || 'freight_multiplier',
      monteCarloDriverLabel(
        summary?.scatter_driver || state.monteCarloConfig?.scatter_driver || 'freight_multiplier'
      )
    );
  }

  renderMonteCarlo();
}
