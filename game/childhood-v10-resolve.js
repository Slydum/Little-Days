import { applyChildhoodEffect, childhoodEventForState, commitChildhoodEvent, ensureChildhoodState } from "./childhood-v12.js?v=1";
import { applyAdolescenceEffect } from "./adolescence.js?v=1";
import { syncPsychologyEventIntegration } from "./psychology-events-v2.js?v=1";

const clamp = (value, min = 0, max = 100) => Math.max(min, Math.min(max, value));

function adjust(target, key, delta) {
  if (!target || typeof target[key] !== "number") return;
  target[key] = clamp(target[key] + (delta || 0));
}

function applyEffect(state, effect) {
  if (!effect) return;
  if (effect.type === "health") adjust(state.health, effect.key, effect.delta);
  if (effect.type === "personality") adjust(state.character?.personality, effect.key, effect.delta);
  if (effect.type === "development") adjust(state.character?.development, effect.key, effect.delta);
  if (effect.type === "interest") adjust(state.interests, effect.key, effect.delta);
  if (effect.type === "education") adjust(state.education?.subjects, effect.key, effect.delta);
  if (effect.type === "pattern") {
    state.character.patterns ||= {};
    state.character.patterns[effect.key] = Math.max(0, (state.character.patterns[effect.key] || 0) + (effect.delta || 0));
  }
  if (effect.type === "childhood") applyChildhoodEffect(state, effect);
  if (effect.type === "adolescence") applyAdolescenceEffect(state, effect);
  if (effect.type === "relationship") {
    const person = effect.targetId
      ? (state.people || []).find((item) => item.id === effect.targetId)
      : (state.people || []).find((item) => item.role === effect.target && !item.deceased);
    adjust(person, effect.key, effect.delta);
    if (person) {
      person.lastInteractionAtMonths = state.character.ageMonths;
      person.history ||= [];
      if (Math.abs(effect.delta || 0) >= 2 || effect.note) {
        person.history.push({
          ageMonths: state.character.ageMonths,
          date: { ...state.date },
          eventId: "life-stage-v1",
          key: effect.key,
          delta: effect.delta || 0,
          note: effect.note || null,
        });
        person.history = person.history.slice(-80);
      }
    }
  }
}

function continuityKind(event) {
  if (event?.adolescenceKey) return "adolescence-v1";
  if (event?.childhoodDepthKind === "little-moment") return "little-moment";
  if (event?.childhoodDepthKind === "interaction") return "player-initiated-relationship";
  if (event?.schoolV2Key) return "school-life-v2";
  if (event?.schoolCoherenceKey) return "school-coherence-v1";
  if (event?.relationshipContinuityKey) return "relationship-continuity-v2";
  if (event?.schoolTrendId) return "school-trend-v1";
  if (event?.materialEventKey) return "material-childhood-v1";
  return "childhood-v10";
}

function validDisplayedEvent(state, choiceId, eventOverride) {
  if (!eventOverride || !Array.isArray(eventOverride.choices)) return null;
  if (!eventOverride.choices.some((item) => item.id === choiceId)) return null;

  // Queue-backed events are only safe to resolve while the same queue item still exists.
  // Higher-priority systems can change which event is "current" between render and tap,
  // but they should not invalidate the event the player is already looking at.
  if (eventOverride.childhoodQueueKey) {
    const stillQueued = (state.childhood?.eventQueue || []).some((item) => item.key === eventOverride.childhoodQueueKey);
    if (!stillQueued) return null;
  }

  return eventOverride;
}

export function resolveChildhoodChoice(state, choiceId, eventOverride = null) {
  ensureChildhoodState(state);
  if (state.resolution) return state;

  const event = validDisplayedEvent(state, choiceId, eventOverride) || childhoodEventForState(state);
  if (!event) return state;
  const choice = event.choices.find((item) => item.id === choiceId);
  if (!choice) return state;

  (choice.effects || []).forEach((effect) => applyEffect(state, effect));
  state.history ||= [];
  state.history.push({
    ageMonths: state.character.ageMonths,
    date: { ...state.date },
    eventId: event.id,
    title: event.title,
    choiceId: choice.id,
    choice: choice.label,
    result: choice.result,
    continuity: continuityKind(event),
    personId: event.adolescencePersonId || event.relationshipPersonId || event.childhoodPersonId || event.schoolTrendParentId || null,
    schoolYearIndex: event.schoolCoherenceYearIndex ?? state.childhood?.school?.yearIndex ?? null,
    psychologyContext: event.psychologyContext || null,
    psychologyLens: event.psychologyLens || null,
    psychologyRecovery: event.psychologyRecovery || null,
    ordinary: event.childhoodDepthKind === "little-moment" || String(event.adolescenceType || "").startsWith("ordinary_"),
    playerInitiated: event.childhoodDepthKind === "interaction",
    materialEventKey: event.materialEventKey || null,
    schoolV2Key: event.schoolV2Key || null,
    schoolV2Type: event.schoolV2Type || null,
    adolescenceKey: event.adolescenceKey || null,
    adolescenceType: event.adolescenceType || null,
    educationMode: state.adolescence?.education?.mode || state.childhood?.schoolV2?.mode || null,
  });
  state.history = state.history.slice(-900);

  commitChildhoodEvent(state, event, choice);
  syncPsychologyEventIntegration(state);
  state.resolution = {
    choiceId: choice.id,
    result: choice.result,
    childhoodEventId: event.id,
    childhoodEvent: event,
    depthKind: event.childhoodDepthKind || null,
    depthPersonId: event.childhoodPersonId || null,
    adolescenceType: event.adolescenceType || null,
  };
  return state;
}
