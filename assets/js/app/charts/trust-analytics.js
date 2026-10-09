import { renderBarChart } from '../../core/chart-renderer.js';
import { selectDecision } from '../selectors/business-selectors.js';
import { evidenceClassLabel, userStatusLabel } from '../presentation/status.js';

export function countStatuses(rows = []) {
  const counts = new Map();
  rows.forEach((row) => {
    const status =
      typeof row?.status === 'string' && row.status.trim() ? row.status : 'Não informado';
    counts.set(status, (counts.get(status) || 0) + 1);
  });
  return [...counts].sort((a, b) => b[1] - a[1]);
}

export function countEvidenceClasses(rows = []) {
  return countStatuses(rows.map((row) => ({ status: row?.classification || row?.status })));
}

export {
  evidenceClassLabel,
  robustnessPresentation,
  userStatusLabel,
} from '../presentation/status.js';

export function buildEvidenceCoverage(rows = []) {
  const total = rows.length;
  const coverage = rows
    .map((row, index) => {
      const value = row?.coverage == null || row.coverage === '' ? null : Number(row.coverage);
      if (value == null || !Number.isFinite(value) || value < 0 || value > 1) return null;
      return {
        label: row?.label || row?.name || row?.id || `Componente ${index + 1}`,
        value: value * 100,
      };
    })
    .filter(Boolean);
  return { rows: coverage, total, available: coverage.length };
}

function renderStatuses(canvasId, rows, title, evidence = false) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const counts = evidence ? countEvidenceClasses(rows) : countStatuses(rows);
  canvas.hidden = !counts.length;
  if (!counts.length) return;
  renderBarChart(canvasId, {
    title: counts.length ? title : 'Nenhuma verificação disponível',
    labels: counts.map(([status]) =>
      userStatusLabel(evidence ? evidenceClassLabel(status) : status)
    ),
    datasets: [
      { label: 'Quantidade', data: counts.map(([, count]) => count), backgroundColor: '#0c7878' },
    ],
    indexAxis: 'y',
    xFormat: 'number',
  });
}

export function renderTrustAnalytics(state) {
  const decision = selectDecision(state);
  const evidenceRows = decision.result?.evidence?.components || [];
  renderStatuses('niEvidenceStatusChart', evidenceRows, 'Classes de evidência', true);
  const coverageCanvas = document.getElementById('niEvidenceCoverageChart');
  if (coverageCanvas) {
    const coverage = buildEvidenceCoverage(evidenceRows);
    coverageCanvas.hidden = !coverage.available;
    const summary = coverageCanvas.parentElement?.querySelector(
      '[data-chart-summary="niEvidenceCoverageChart"]'
    );
    const caption = coverageCanvas.parentElement?.querySelector(
      '[data-chart-caption="niEvidenceCoverageChart"]'
    );
    if (summary)
      summary.textContent = coverage.available
        ? `${coverage.available}/${coverage.total} componentes com cobertura`
        : 'Cobertura não informada';
    if (caption)
      caption.textContent = coverage.available
        ? `${coverage.available}/${coverage.total} componentes têm cobertura publicada. Ela se refere aos registros pertinentes, não à confiança ou precisão estatística.`
        : 'Sem coberturas numéricas válidas (0 a 100%) publicadas por componente; valores ausentes não são tratados como zero.';
    if (coverage.available) {
      renderBarChart('niEvidenceCoverageChart', {
        title: 'Cobertura publicada por componente',
        labels: coverage.rows.map((row) => row.label),
        datasets: [
          {
            label: 'Registros pertinentes (%)',
            data: coverage.rows.map((row) => row.value),
            backgroundColor: '#0c7878',
          },
        ],
        indexAxis: 'y',
        xFormat: 'percent',
      });
    }
  }
  renderStatuses('niQaStatusChart', decision.final_qa?.checks || [], 'Verificações por status');
}
