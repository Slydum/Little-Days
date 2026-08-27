import { applyChildhoodEffect, childhoodEventForState, commitChildhoodEvent, ensureChildhoodState } from "./childhood-v2.js";

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
          eventId: "childhood-v2",
          key: effect.key,
          delta: effect.delta || 0,
          note: effect.note || null,
        });
        person.history = person.history.slice(-18);
      }
    }
  }
}

export function resolveChildhoodChoice(state, choiceId) {
  ensureChildhoodState(state);
  const event = childhoodEventForState(state);
  if (!event || state.resolution) return state;
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
    continuity: "childhood-v2",
  });

  commitChildhoodEvent(state, event, choice);
  state.resolution = {
    choiceId: choice.id,
    result: choice.result,
    childhoodEventId: event.id,
    childhoodEvent: event,
  };
  return state;
}
