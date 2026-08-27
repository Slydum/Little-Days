import * as core from "./childhood-v9.js?v=1";
import { commitMaterialEvent, ensureMaterialChildhood, materialEventForState } from "./material-childhood.js?v=1";

export * from "./childhood-v9.js?v=1";

export function ensureChildhoodState(state) {
  const next = core.ensureChildhoodState(state);
  ensureMaterialChildhood(next);
  return next;
}

export function advanceChildhoodWorld(state, elapsedMonths = 0, beforeAgeMonths = null) {
  const next = core.advanceChildhoodWorld(state, elapsedMonths, beforeAgeMonths);
  ensureMaterialChildhood(next);
  return next;
}

export function childhoodEventForState(state) {
  ensureChildhoodState(state);
  const ordinary = core.childhoodEventForState(state);
  if (ordinary?.childhoodDepthKind === "interaction" || ordinary?.childhoodDepthKind === "little-moment") return ordinary;
  const material = materialEventForState(state);
  return material || ordinary;
}

export function commitChildhoodEvent(state, event, choice) {
  if (event?.materialEventKey) {
    commitMaterialEvent(state, event, choice);
    return state;
  }
  const next = core.commitChildhoodEvent(state, event, choice);
  ensureMaterialChildhood(next);
  return next;
}

export function socialSnapshot(state) {
  ensureChildhoodState(state);
  return core.socialSnapshot(state);
}

export function schoolWorldSnapshot(state) {
  ensureChildhoodState(state);
  return core.schoolWorldSnapshot(state);
}
