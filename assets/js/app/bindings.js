import { navigate } from './router.js';
import { setSelectedScenario } from './state.js';
import { showLoading, showToast } from './shell.js';

function formValues(form) {
  const data = new FormData(form);
  return {
    scenario_name: data.get('scenario_name') || 'Cenário manual',
    active_cds: data.getAll('active_cds'),
    freight_multiplier: Number(data.get('freight_multiplier') || 1),
    demand_multiplier: Number(data.get('demand_multiplier') || 1),
    inventory_days: Number(data.get('inventory_days') || 45),
    wacc: Number(data.get('wacc') || 0.15),
    tax_mode: data.get('tax_mode') || 'current',
  };
}

export function installBindings({ root, store, controller }) {
  const onClick = (event) => {
    const routeLink = event.target.closest('[data-route]');
    if (routeLink) {
      event.preventDefault();
      navigate(routeLink.getAttribute('data-route'));
      return;
    }
    const action = event.target.closest('[data-action]')?.getAttribute('data-action');
    if (action === 'open-dev') {
      navigate('#/network/dev/console');
    } else if (action === 'open-export') {
      controller.exportPackage();
    } else if (action === 'close-drawer') {
      controller.closeDrawer();
    } else if (action === 'lock-crypto') {
      controller.lock();
    } else if (action === 'run-decision') {
      void controller.runDecision();
    } else if (action === 'download-export') {
      const index = Number(event.target.closest('[data-export-index]')?.dataset.exportIndex);
      controller.exportPackage(index);
    } else if (action === 'load-scenario') {
      controller.loadScenarioDraft(event.target.closest('[data-scenario-id]')?.dataset.scenarioId);
    } else if (action === 'save-current-scenario') {
      controller.saveCurrentScenario();
    } else if (action === 'export-current-scenario') {
      controller.exportCurrentScenario();
    } else if (action === 'delete-saved-scenario') {
      controller.deleteSavedScenario(
        event.target.closest('[data-scenario-id]')?.dataset.scenarioId
      );
    } else if (action === 'clear-saved-scenarios') {
      controller.clearSavedScenarios();
    }
  };

  root.addEventListener('click', onClick);
  root.querySelector('#niCompanySelect')?.addEventListener('change', (event) => {
    void controller.switchCompany(event.target.value);
  });
  root.querySelector('#niScenarioSelect')?.addEventListener('change', (event) => {
    if (store.getState().ui.loading) return;
    const scenarioId = event.target.value || null;
    store.update((state) => setSelectedScenario(state, scenarioId));
    navigate('#/network/scenarios/result');
    void controller.runScenario({ scenarioId });
  });
  root.addEventListener('submit', (event) => {
    if (event.target.id === 'niScenarioForm') {
      event.preventDefault();
      void controller.runScenario({ formValues: formValues(event.target) });
    }
    if (event.target.id === 'niOptimizerForm') {
      event.preventDefault();
      const data = new FormData(event.target);
      void controller.runDecision({
        profileId: data.get('profile_id') || 'balanced',
        optimizerConfig: {
          max_candidates: Number(data.get('max_candidates') || 2000),
          seed: Number(data.get('seed') || 42),
        },
      });
    }
  });
  root.addEventListener('change', (event) => {
    if (!event.target.matches('[data-testid="scenario-import"]')) return;
    const file = event.target.files?.[0];
    if (file) void controller.importScenario(file);
    event.target.value = '';
  });
  root.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') controller.closeDrawer();
  });
  return () => root.removeEventListener('click', onClick);
}

export function showControllerError(root, error) {
  showLoading(root, false);
  showToast(root, error?.message || String(error), 'error');
}
