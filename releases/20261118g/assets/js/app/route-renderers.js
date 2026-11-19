import { renderDevConsolePage } from './dev/dev-console.js';
import {
  renderOverviewCosts,
  renderOverviewNetwork,
  renderOverviewSummary,
  renderOverviewTax,
} from './pages/overview.js';
import {
  renderScenarioBuild,
  renderScenarioCompare,
  renderScenarioResult,
  renderScenarioRisk,
} from './pages/scenarios.js';
import {
  renderOptimizerConfigure,
  renderOptimizerResults,
  renderOptimizerTradeoffs,
} from './pages/optimizer.js';
import {
  renderTrustEvidence,
  renderTrustMethodology,
  renderTrustOverview,
  renderTrustSources,
  renderTrustValidation,
} from './pages/trust.js';

/** Maps canonical application paths to their page renderers. */
export const ROUTE_RENDERERS = {
  '/network/overview/summary': renderOverviewSummary,
  '/network/overview/network': renderOverviewNetwork,
  '/network/overview/costs': renderOverviewCosts,
  '/network/overview/tax': renderOverviewTax,
  '/network/scenarios/build': renderScenarioBuild,
  '/network/scenarios/result': renderScenarioResult,
  '/network/scenarios/compare': renderScenarioCompare,
  '/network/scenarios/risk': (state) => renderScenarioRisk(state, false),
  '/network/scenarios/risk/advanced': (state) => renderScenarioRisk(state, true),
  '/network/optimizer/configure': renderOptimizerConfigure,
  '/network/optimizer/results': renderOptimizerResults,
  '/network/optimizer/tradeoffs': renderOptimizerTradeoffs,
  '/network/trust/overview': renderTrustOverview,
  '/network/trust/evidence': renderTrustEvidence,
  '/network/trust/sources': renderTrustSources,
  '/network/trust/validation': renderTrustValidation,
  '/network/trust/methodology': renderTrustMethodology,
  '/network/dev/console': renderDevConsolePage,
};
