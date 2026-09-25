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

function monteCarloInterpretation(summary) {
  if (!summary) return 'Rode o cenário para visualizar a leitura probabilística.';
  if (summary.risk_band === 'high') {
    return 'A distribuição indica risco relevante de perda de saving. Vale revisar premissas e drivers mais voláteis.';
  }
  if (summary.risk_band === 'medium') {
    return 'O cenário mantém saving na maior parte das amostras, mas ainda existe dispersão que merece atenção.';
  }
  return 'O cenário mostra estabilidade razoável nas amostras e sustentação probabilística para a decisão.';
}

export function renderScenarioMonteCarlo(state) {
  function renderMonteCarloSummaryCards() {
    const summary = state.monteCarlo?.summary;
    const el = $('monteCarloSummaryCards');
    const tableEl = $('monteCarloSummaryTable');
    if (!summary) {
      if (el) el.innerHTML = '';
      if (tableEl)
        tableEl.innerHTML =
          '<div class="empty-state">Rode o cenário para visualizar a distribuição probabilística.</div>';
      return;
    }

    const driverLabel = monteCarloDriverLabel(summary.most_sensitive_driver);
    const driverCorrelation = Number(summary.most_sensitive_driver_correlation || 0);
    if (el) {
      el.innerHTML = [
        metric(
          'Prob. saving positivo',
          formatPct(summary.probability_saving_positive * 100, 1),
          `risco ${summary.risk_band}`
        ),
        metric(
          'Prob. saving negativo',
          formatPct(summary.probability_saving_loss * 100, 1),
          'cenário abaixo do baseline'
        ),
        metric(
          'Saving mediano',
          formatPct(summary.median_saving_pct, 1),
          `p10 ${formatPct(summary.p10_saving_pct, 1)} · p90 ${formatPct(summary.p90_saving_pct, 1)}`
        ),
        metric(
          'Desvio saving',
          formatPct(summary.stddev_saving_pct, 1),
          'dispersão entre amostras'
        ),
        metric(
          'Custo mediano',
          formatBRL(summary.median_total_with_tax, true),
          `p10 ${formatBRL(summary.p10_total_with_tax, true)} · p90 ${formatBRL(summary.p90_total_with_tax, true)}`
        ),
        metric(
          'Custo esperado',
          formatBRL(summary.mean_total_with_tax, true),
          `desvio ${formatBRL(summary.stddev_total_with_tax, true)}`
        ),
        metric(
          'Driver mais influente',
          driverLabel,
          `${driverCorrelation >= 0 ? '+' : ''}${driverCorrelation.toFixed(2)} de correlação`
        ),
        metric(
          'Percentil do cenário',
          `${Number(summary.deterministic_percentile_saving_pct || 0).toFixed(0)}º`,
          'posição do cenário base na distribuição'
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
          <tr><td>Erro Monte Carlo</td><td>${escapeHtml(summary.monte_carlo_probability_positive_standard_error == null ? '—' : formatPct(summary.monte_carlo_probability_positive_standard_error * 100, 2))} · IC condicional: ${escapeHtml(summary.monte_carlo_probability_positive_lower_95 == null ? '—' : formatPct(summary.monte_carlo_probability_positive_lower_95 * 100, 1))}–${escapeHtml(summary.monte_carlo_probability_positive_upper_95 == null ? '—' : formatPct(summary.monte_carlo_probability_positive_upper_95 * 100, 1))}</td></tr>
          <tr><td>Leitura executiva</td><td>${escapeHtml(monteCarloInterpretation(summary))}</td></tr>
          <tr><td>Prob. saving positivo</td><td>${formatPct(summary.probability_saving_positive * 100, 1)}</td></tr>
          <tr><td>Prob. saving negativo</td><td>${formatPct(summary.probability_saving_loss * 100, 1)}</td></tr>
          <tr><td>Saving p10 / p50 / p90</td><td>${formatPct(summary.p10_saving_pct, 1)} · ${formatPct(summary.median_saving_pct, 1)} · ${formatPct(summary.p90_saving_pct, 1)}</td></tr>
          <tr><td>Total p10 / p50 / p90</td><td>${formatBRL(summary.p10_total_with_tax, true)} · ${formatBRL(summary.median_total_with_tax, true)} · ${formatBRL(summary.p90_total_with_tax, true)}</td></tr>
          <tr><td>Driver mais influente</td><td>${escapeHtml(driverLabel)} (${driverCorrelation >= 0 ? '+' : ''}${driverCorrelation.toFixed(2)})</td></tr>
          <tr><td>Interpretação</td><td>${escapeHtml(summary.probability_interpretation || 'condicional às premissas informadas')}</td></tr>
          <tr><td>Limitação</td><td>Probabilidades e percentis são condicionais ao histórico disponível e ao modelo; não são intervalo de confiança formal.</td></tr>
        </tbody>
      </table>
    `;
    }
  }

  function renderMonteCarlo() {
    renderMonteCarloSummaryCards();
    const summary = state.monteCarlo?.summary;
    renderMonteCarloHistogram(summary?.histogram);
    renderMonteCarloPercentileCurve(summary?.percentile_curve);
    renderMonteCarloTotalCurve(summary?.total_percentile_curve);
    renderMonteCarloRiskDonut(summary);
    renderMonteCarloDriverImportance(
      (summary?.driver_importance || []).map((item) => ({
        ...item,
        label: monteCarloDriverLabel(item.driver),
      }))
    );
    renderMonteCarloScatter(
      state.monteCarlo?.samples || [],
      summary?.scatter_driver || state.monteCarloConfig?.scatter_driver || 'freight_multiplier',
      monteCarloDriverLabel(
        summary?.scatter_driver || state.monteCarloConfig?.scatter_driver || 'freight_multiplier'
      )
    );
  }

  renderMonteCarlo();
}
