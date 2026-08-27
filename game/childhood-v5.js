import * as core from "./childhood-v4.js?core=school-coherence-v1";
import {
  commitSchoolCoherenceEvent,
  ensureSchoolCoherence,
  schoolCoherenceEventForState,
  schoolCoherenceSnapshot,
  syncSchoolCoherence,
} from "./school-coherence.js?v=1";

export * from "./childhood-v4.js?core=school-coherence-v1";
export { schoolCoherenceSnapshot } from "./school-coherence.js?v=1";

export function ensureChildhoodState(state) {
  const next = core.ensureChildhoodState(state);
  ensureSchoolCoherence(next);
  return next;
}

export function advanceChildhoodWorld(state, elapsedMonths = 0, beforeAgeMonths = null) {
  const next = core.advanceChildhoodWorld(state, elapsedMonths, beforeAgeMonths);
  ensureSchoolCoherence(next);
  syncSchoolCoherence(next);
  return next;
}

export function schoolWorldSnapshot(state) {
  const base = core.schoolWorldSnapshot(state);
  if (!base) return null;
  ensureSchoolCoherence(state);
  return { ...base, coherence: schoolCoherenceSnapshot(state) };
}

export function childhoodEventForState(state) {
  ensureChildhoodState(state);
  syncSchoolCoherence(state);
  const coreEvent = core.childhoodEventForState(state);
  const schoolEvent = schoolCoherenceEventForState(state);
  if (!schoolEvent) return coreEvent;
  if (!coreEvent) return { ...schoolEvent, contextKind: "school-coherence-v1" };

  const schoolPriority = state.schoolCoherence?.queue?.[0]?.priority ?? 42;
  const corePriority = coreEvent.relationshipContinuityKey
    ? (state.relationshipContinuity?.queue?.[0]?.priority ?? 44)
    : (state.childhood?.eventQueue?.[0]?.priority ?? 40);
  const monthsSinceSchoolBeat = (state.character?.ageMonths || 0) - (state.schoolCoherence?.lastGlobalBeatAtMonths ?? -120);

  // Existing urgent school/social and relationship events keep their place.
  // Longitudinal school beats surface when the pattern is stronger or has waited long enough.
  if (schoolPriority >= corePriority + 4 || monthsSinceSchoolBeat >= 15) {
    return { ...schoolEvent, contextKind: "school-coherence-v1" };
  }
  return coreEvent;
}

export function commitChildhoodEvent(state, event, choice) {
  if (event?.schoolCoherenceKey) return commitSchoolCoherenceEvent(state, event, choice);
  return core.commitChildhoodEvent(state, event, choice);
}
