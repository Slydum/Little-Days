import * as core from "./childhood-v6.js?core=depth-v2";
import { decorateEventWithPsychology, syncPsychologyEventIntegration } from "./psychology-events-v2.js?v=1";
import {
  commitDepthEvent,
  ensureChildhoodDepth,
  interactionEventForState,
  littleMomentEventForState,
} from "./childhood-depth.js?v=1";

export * from "./childhood-v6.js?core=depth-v2";
export * from "./childhood-depth.js?v=1";

export function ensureChildhoodState(state) {
  const next = core.ensureChildhoodState(state);
  ensureChildhoodDepth(next);
  return next;
}

export function advanceChildhoodWorld(state, elapsedMonths = 0, beforeAgeMonths = null) {
  const next = core.advanceChildhoodWorld(state, elapsedMonths, beforeAgeMonths);
  ensureChildhoodDepth(next);
  syncPsychologyEventIntegration(next);
  return next;
}

export function childhoodEventForState(state) {
  ensureChildhoodState(state);
  const interaction = interactionEventForState(state);
  if (interaction) return decorateEventWithPsychology(state, interaction);
  const little = littleMomentEventForState(state);
  if (little) return decorateEventWithPsychology(state, little);
  return core.childhoodEventForState(state);
}

export function commitChildhoodEvent(state, event, choice) {
  if (event?.childhoodDepthKind) return commitDepthEvent(state, event, choice);
  return core.commitChildhoodEvent(state, event, choice);
}
