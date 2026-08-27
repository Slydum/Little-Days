import * as core from "./childhood-v5.js?core=psychology-events-v2";
import {
  decorateEventWithPsychology,
  psychologyEventSnapshot,
  syncPsychologyEventIntegration,
} from "./psychology-events-v2.js?v=1";

export * from "./childhood-v5.js?core=psychology-events-v2";
export { psychologyEventSnapshot } from "./psychology-events-v2.js?v=1";

export function ensureChildhoodState(state) {
  const next = core.ensureChildhoodState(state);
  syncPsychologyEventIntegration(next);
  return next;
}

export function advanceChildhoodWorld(state, elapsedMonths = 0, beforeAgeMonths = null) {
  const next = core.advanceChildhoodWorld(state, elapsedMonths, beforeAgeMonths);
  syncPsychologyEventIntegration(next);
  return next;
}

export function childhoodEventForState(state) {
  ensureChildhoodState(state);
  const event = core.childhoodEventForState(state);
  if (!event) return null;
  return decorateEventWithPsychology(state, event);
}

export function commitChildhoodEvent(state, event, choice) {
  const next = core.commitChildhoodEvent(state, event, choice);
  syncPsychologyEventIntegration(next);
  return next;
}
