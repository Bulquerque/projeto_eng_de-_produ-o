import { renderBarChart } from '../../core/chart-renderer.js';
import { selectDecision } from '../selectors/business-selectors.js';

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

const STATUS_LABELS = Object.freeze({
  pass: 'Aprovado',
  passed: 'Aprovado',
  success: 'Aprovado',
  ok: 'Aprovado',
  fail: 'Reprovado',
  failed: 'Reprovado',
  error: 'Erro',
  warning: 'Com ressalvas',
  warn: 'Com ressalvas',
  blocked: 'Bloqueado',
  pending: 'Pendente',
  not_run: 'Não executado',
  skipped: 'Ignorado',
  ready: 'Pronto',
  not_ready: 'Não pronto',
  draft: 'Em elaboração',
  released: 'Liberado',
  observed: 'Observado',
  partially_observed: 'Parcialmente observado',
  proxy: 'Proxy',
  fallback: 'Alternativo',
  parameter: 'Parâmetro',
  projection: 'Projeção',
  reconciled: 'Reconciliado',
  unknown: 'Não classificado',
  synthetic: 'Sintético',
  synthetic_fixture: 'Demonstrativo sintético',
  recommended: 'Recomendado',
  recommended_with_warnings: 'Recomendado com ressalvas',
  not_recommended: 'Não recomendado',
  baseline_ready: 'Baseline carregado',
  demo_only: 'Apenas demonstração',
  exploratory_only: 'Apenas exploratório',
  decision_support: 'Apoio à decisão',
  mock_policy: 'Isolamento da demonstração',
  low: 'Baixo',
  medium: 'Médio',
  high: 'Alto',
  critical: 'Crítico',
  conditional: 'Condicional',
  certified: 'Certificado',
  not_applicable: 'Não se aplica',
  unavailable: 'Indisponível',
  partial: 'Parcial',
  complete: 'Completo',
  source_missing: 'Fonte ausente',
  scenario_ready: 'Cenário calculado',
});

export function userStatusLabel(value, fallback = 'Não informado') {
  if (value == null || value === '') return fallback;
  const key = String(value).trim().toLowerCase();
  if (STATUS_LABELS[key]) return STATUS_LABELS[key];
  return key.replace(/[_-]+/g, ' ').replace(/^./, (letter) => letter.toLocaleUpperCase('pt-BR'));
}

export function robustnessPresentation(robustness) {
  const score = (value) =>
    value == null ||
    value === '' ||
    !Number.isFinite(Number(value)) ||
    Number(value) < 0 ||
    Number(value) > 100
      ? null
      : Number(value);
  const certified = score(robustness?.certified_robustness_score);
  if (certified != null) {
    return {
      label: 'Robustez certificada',
      value: certified,
      note: 'Escopo certificado na origem',
    };
  }
  const conditional = score(robustness?.conditional_robustness_score);
  if (conditional != null) {
    return {
      label: 'Robustez condicional',
      value: conditional,
      note: 'Válida sob as premissas e cenários avaliados; não certificada',
    };
  }
  const reported = score(robustness?.robustness_score);
  if (reported != null) {
    const interpretation = robustness?.robustness_interpretation;
    return {
      label: 'Robustez informada',
      value: reported,
      note: interpretation ? userStatusLabel(interpretation) : 'Escopo conforme registro de origem',
    };
  }
  return { label: 'Robustez', value: null, note: 'Não calculada' };
}

export function evidenceClassLabel(value) {
  return (
    {
      observed: 'Observado',
      partially_observed: 'Parcialmente observado',
      proxy: 'Proxy',
      fallback: 'Fallback',
      parameter: 'Parâmetro',
      projection: 'Projeção',
      reconciled: 'Reconciliado',
      unknown: 'Não classificado',
      synthetic: 'Sintético',
    }[value] ||
    value ||
    'Não informado'
  );
}

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
