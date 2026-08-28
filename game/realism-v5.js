import * as core from "./realism-v4.js?v=1";
import { ensureSchoolLifeV2 } from "./school-life-v2.js?v=1";

export * from "./realism-v4.js?v=1";

export function ensureRealismState(state) {
  const next = core.ensureRealismState(state);
  ensureSchoolLifeV2(next);
  return next;
}

export function advanceRealism(state, elapsedMonths, beforeAgeMonths) {
  const next = core.advanceRealism(state, elapsedMonths, beforeAgeMonths);
  // Income, rent, debt, or employment may have changed during realism.
  // Refresh education affordability without charging tuition twice.
  ensureSchoolLifeV2(next);
  return next;
}
