import { runTaxCalculation } from './tax/tax-orchestrator.js';

export function calculateReformTax(arg1, arg2, arg3) {
  return runTaxCalculation(arg1, arg2, arg3);
}

export { runTaxCalculation };
