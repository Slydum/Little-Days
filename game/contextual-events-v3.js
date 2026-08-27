import * as core from "./contextual-events-v2.js?core=progression-diversity-v3";

export * from "./contextual-events-v2.js?core=progression-diversity-v3";

function isRoutineDevelopment(event, state) {
  return event?.contextKind === "development" && (state.character?.ageMonths || 0) < 24;
}

export function contextualEventForState(state) {
  const event = core.contextualEventForState(state);
  if (!event) return null;

  // Older builds forced every healthy child through the same developmental
  // card at each infant age band. The richer early-childhood engine now owns
  // ordinary development, so routine milestones should not override its
  // varied, temperament- and circumstance-sensitive event pool.
  //
  // Preserve an already-resolved legacy card until Continue is pressed so an
  // existing save never shows a result for a different event after updating.
  if (isRoutineDevelopment(event, state) && !state.resolution?.contextualEvent) return null;
  return event;
}

export function resolveContextualChoice(state, choiceId) {
  const visible = contextualEventForState(state);
  if (!visible || state.resolution) return state;
  return core.resolveContextualChoice(state, choiceId);
}
