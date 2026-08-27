import * as core from "./realism-v3.js?v=1";
import { advanceMaterialChildhood, ensureMaterialChildhood } from "./material-childhood.js?v=1";

export * from "./realism-v3.js?v=1";

export function ensureRealismState(state) {
  const next = core.ensureRealismState(state);
  ensureMaterialChildhood(next);
  return next;
}

export function advanceRealism(state, elapsedMonths, beforeAgeMonths) {
  const next = core.advanceRealism(state, elapsedMonths, beforeAgeMonths);
  advanceMaterialChildhood(next, elapsedMonths, beforeAgeMonths);
  return next;
}
