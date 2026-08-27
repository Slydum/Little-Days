import * as core from "./realism-v2.js?v=1";
import { advanceHouseholdEconomy, ensureHouseholdEconomy } from "./household-economy-v2.js?v=1";

export * from "./realism-v2.js?v=1";

export function ensureRealismState(state) {
  const next = core.ensureRealismState(state);
  ensureHouseholdEconomy(next);
  return next;
}

export function advanceRealism(state, elapsedMonths, beforeAgeMonths) {
  const next = core.advanceRealism(state, elapsedMonths, beforeAgeMonths);
  advanceHouseholdEconomy(next, elapsedMonths, beforeAgeMonths);
  return next;
}
