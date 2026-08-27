import * as core from "./childhood-v3.js?core=relationship-v2";
import {
  commitRelationshipContinuityEvent,
  ensureRelationshipContinuity,
  relationshipEventForState,
  syncRelationshipContinuity,
} from "./relationship-continuity.js?v=1";

export * from "./childhood-v3.js?core=relationship-v2";
export { relationshipContinuitySnapshot } from "./relationship-continuity.js?v=1";

export function ensureChildhoodState(state) {
  const next = core.ensureChildhoodState(state);
  ensureRelationshipContinuity(next);
  return next;
}

export function advanceChildhoodWorld(state, elapsedMonths = 0, beforeAgeMonths = null) {
  const next = core.advanceChildhoodWorld(state, elapsedMonths, beforeAgeMonths);
  ensureRelationshipContinuity(next);
  syncRelationshipContinuity(next);
  return next;
}

export function childhoodEventForState(state) {
  ensureChildhoodState(state);
  syncRelationshipContinuity(state);
  const coreEvent = core.childhoodEventForState(state);
  const relationshipEvent = relationshipEventForState(state);
  if (!relationshipEvent) return coreEvent;
  if (!coreEvent) return { ...relationshipEvent, contextKind: "relationship-continuity-v2" };

  const corePriority = state.childhood?.eventQueue?.[0]?.priority ?? 40;
  const relationshipPriority = state.relationshipContinuity?.queue?.[0]?.priority ?? 44;
  const currentAge = state.character?.ageMonths || 0;
  const monthsSinceRelationshipBeat = currentAge - (state.relationshipContinuity?.lastGlobalBeatAtMonths ?? -120);

  // Urgent school events stay ahead. A relationship beat can surface when it is
  // genuinely more important or has been waiting long enough to remain coherent.
  if (relationshipPriority >= corePriority + 5 || monthsSinceRelationshipBeat >= 18) {
    return { ...relationshipEvent, contextKind: "relationship-continuity-v2" };
  }
  return coreEvent;
}

export function commitChildhoodEvent(state, event, choice) {
  if (event?.relationshipContinuityKey) return commitRelationshipContinuityEvent(state, event, choice);
  return core.commitChildhoodEvent(state, event, choice);
}
