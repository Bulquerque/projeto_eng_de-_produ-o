import { setupPhase3 } from './scenario-arena-dashboard.js';
import { loadCatalog, loadPhase3Report } from '../shared/data-loader.js';
import { loadTaxReformConfiguration } from '../shared/tax-reform-config.js';
import { $ } from '../shared/common.js';

async function init() {
  setupPhase3();

  // Dados estáticos — independentes do crypto. Falha aqui não impede a tela.
  try {
    await loadTaxReformConfiguration().catch(() => {});
    const [catalog, report] = await Promise.all([loadCatalog(), loadPhase3Report()]);
    if ($('packageName')) $('packageName').textContent = catalog.package || '—';
    if ($('packageVersion')) $('packageVersion').textContent = catalog.version || '—';
    if ($('phase3Status'))
      $('phase3Status').textContent =
        report.result === 'OK' ? 'Cenários prontos' : 'Cenários em validação';
    if ($('phase3ProofCards'))
      $('phase3ProofCards').innerHTML =
        `<article class="metric-card"><span class="metric-label">Módulos</span><strong class="metric-value">${report.modules.length}</strong><p class="metric-note">implementados como arquivos JS</p></article><article class="metric-card"><span class="metric-label">Empresa 1</span><strong class="metric-value">${report.companies.empresa1.sample_count}</strong><p class="metric-note">cenários exemplo</p></article><article class="metric-card"><span class="metric-label">Empresa 2</span><strong class="metric-value">${report.companies.empresa2.sample_count}</strong><p class="metric-note">cenários exemplo</p></article><article class="metric-card"><span class="metric-label">Execução</span><strong class="metric-value">estática</strong><p class="metric-note">JSON + localStorage</p></article>`;
  } catch (e) {
    const loading = $('phase3Loading');
    if (loading) loading.textContent = `Metadados dos cenários indisponíveis: ${e.message}`;
  }

  // Carregamento de empresa — pode falhar por crypto (cancelamento pelo usuário).
  // loadCompany já escreve o erro no #phase3Loading e controla o botão de simular.
}

init();
