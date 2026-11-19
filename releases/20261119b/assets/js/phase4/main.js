import { loadCatalog } from '../core/data-loader.js';
import { loadTaxReformConfiguration } from '../core/tax-reform-config.js';
import { $ } from '../core/common.js';
import { setupPhase4 } from './phase4-dashboard.js';

async function init() {
  setupPhase4();
  try {
    await loadTaxReformConfiguration().catch(() => {});
    const catalog = await loadCatalog();
    if ($('packageName')) $('packageName').textContent = catalog.package || '—';
    if ($('packageVersion')) $('packageVersion').textContent = catalog.version || '—';
  } catch {
    // Keep the module usable even if catalog metadata is unavailable.
  }
}

if (!window.__VISAGIO_NETWORK_UI__) init();
