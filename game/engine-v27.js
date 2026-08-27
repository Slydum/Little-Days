import * as v26 from "./engine-v26.js?core=27";

export * from "./engine-v26.js?core=27";

const clamp = (value, min = 0, max = 100) => Math.max(min, Math.min(max, value));

const EXTRA_NEWBORN_EVENTS = [
  {
    id: "newborn_skin_to_skin",
    category: "Family",
    title: "Warmth and a heartbeat",
    body: "You are held against a caregiver's chest, wrapped close enough to hear a heartbeat and feel warmth through the blanket.",
    prompt: "How do you respond?",
    choices: [
      { id: "settle", label: "Settle against the warmth", result: "Your body grows quieter. Long before you understand people, familiar warmth is already becoming information.", effects: [{ type: "development", key: "attachment", delta: 2 }, { type: "health", key: "stress", delta: -2 }] },
      { id: "listen", label: "Stay awake and listen", result: "The steady rhythm holds your attention for a while before sleep wins the argument.", effects: [{ type: "personality", key: "curiosity", delta: 2 }, { type: "relationship", target: "guardian", key: "familiarity", delta: 2 }] },
      { id: "squirm", label: "Squirm until you are repositioned", result: "The arrangement is revised several times according to your extremely limited but forceful feedback system.", effects: [{ type: "personality", key: "sensitivity", delta: 1 }] },
    ],
  },
  {
    id: "newborn_morning_light",
    category: "Self",
    title: "Morning light",
    body: "Soft daylight reaches the room. Brightness, shadow, and movement are still more understandable than almost anything else.",
    prompt: "What catches you?",
    choices: [
      { id: "window", label: "Look toward the window", result: "You stare toward the changing light for longer than anyone expects. The world has begun offering patterns.", effects: [{ type: "personality", key: "curiosity", delta: 3 }] },
      { id: "face", label: "Turn back toward a familiar face", result: "The light loses to a face you have already seen many times. Familiarity is becoming its own kind of landmark.", effects: [{ type: "relationship", target: "guardian", key: "familiarity", delta: 3 }, { type: "development", key: "attachment", delta: 1 }] },
      { id: "sleep", label: "Close your eyes again", result: "Morning can continue without your supervision. You return to the newborn's primary occupation.", effects: [{ type: "health", key: "energy", delta: 2 }] },
    ],
  },
  {
    id: "newborn_household_voices",
    category: "Home",
    title: "Voices around you",
    body: "People talk somewhere nearby. You cannot understand a word, but some voices are already more familiar than others.",
    prompt: "How do you react to the sound?",
    choices: [
      { id: "turn", label: "Turn toward the familiar voice", result: "Your head shifts toward the sound. Recognition begins before language has anything useful to contribute.", effects: [{ type: "relationship", target: "guardian", key: "familiarity", delta: 3 }, { type: "development", key: "attachment", delta: 1 }] },
      { id: "listen", label: "Stay still and listen", result: "You remain quiet while voices rise and fall around you, absorbing rhythm without meaning.", effects: [{ type: "personality", key: "curiosity", delta: 2 }, { type: "personality", key: "sensitivity", delta: 1 }] },
      { id: "startle", label: "Startle at a sudden louder sound", result: "Your whole body reacts before the room settles again. New nervous systems are not famous for subtlety.", effects: [{ type: "personality", key: "sensitivity", delta: 2 }] },
    ],
  },
];

function openingIndex(seed) {
  let value = ((Number(seed) || 1) ^ 0xa91e52d7) >>> 0;
  value = Math.imul(value ^ (value >>> 16), 0x7feb352d) >>> 0;
  value = Math.imul(value ^ (value >>> 15), 0x846ca68b) >>> 0;
  value = (value ^ (value >>> 16)) >>> 0;
  return value % (EXTRA_NEWBORN_EVENTS.length + 2);
}

function ensureOpeningState(state) {
  state.newbornOpening ||= { selected: false, eventId: null };
  if ((state.character?.ageMonths || 0) !== 0 || (state.history || []).length > 0) return state.newbornOpening;
  if (!state.newbornOpening.selected) {
    const index = openingIndex(state.seed);
    state.newbornOpening.selected = true;
    state.newbornOpening.eventId = index < EXTRA_NEWBORN_EVENTS.length ? EXTRA_NEWBORN_EVENTS[index].id : null;
  }
  return state.newbornOpening;
}

function extraEvent(state) {
  const opening = ensureOpeningState(state);
  if ((state.character?.ageMonths || 0) !== 0) return null;
  return EXTRA_NEWBORN_EVENTS.find((event) => event.id === opening.eventId) || null;
}

function targetPerson(state, role) {
  return (state.people || []).find((person) => person.role === role && !person.deceased) || null;
}

function adjust(object, key, delta) {
  if (!object || typeof object[key] !== "number") return;
  object[key] = clamp(object[key] + delta);
}

function applyEffect(state, effect) {
  if (effect.type === "personality") adjust(state.character?.personality, effect.key, effect.delta);
  else if (effect.type === "development") adjust(state.character?.development, effect.key, effect.delta);
  else if (effect.type === "health") adjust(state.health, effect.key, effect.delta);
  else if (effect.type === "relationship") {
    const person = targetPerson(state, effect.target);
    adjust(person, effect.key, effect.delta);
    if (person) person.lastInteractionAtMonths = state.character?.ageMonths || 0;
  }
}

export function createNewLife(seed = Date.now()) {
  const state = v26.createNewLife(seed);
  ensureOpeningState(state);
  return state;
}

export function getCurrentEvent(state) {
  const event = extraEvent(state);
  if (!event) return v26.getCurrentEvent(state);
  return {
    id: event.id,
    category: event.category,
    title: event.title,
    body: event.body,
    prompt: event.prompt,
    continuity: "Early experiences quietly shape later patterns.",
    choices: event.choices.map(({ id, label, result }) => ({ id, label, result })),
  };
}

export function resolveChoice(state, choiceId) {
  if (!state?.resolution) {
    const event = extraEvent(state);
    const choice = event?.choices.find((item) => item.id === choiceId);
    if (event && choice) {
      for (const effect of choice.effects || []) applyEffect(state, effect);
      state.history ||= [];
      state.history.push({
        ageMonths: state.character?.ageMonths || 0,
        date: { ...(state.date || {}) },
        eventId: event.id,
        title: event.title,
        choiceId: choice.id,
        choice: choice.label,
        result: choice.result,
        continuity: "Early experiences quietly shape later patterns.",
      });
      state.resolution = { choiceId: choice.id, result: choice.result, newbornExtraEventId: event.id };
      if (state.health && typeof state.health.stress === "number") state.health.stress = clamp(state.health.stress - 1);
      return state;
    }
  }
  return v26.resolveChoice(state, choiceId);
}

export function continueLife(state) {
  if (state.resolution?.newbornExtraEventId) {
    state.earlyChildhoodVariety ||= { activeEventId: null, seen: [], recent: [] };
    state.earlyChildhoodVariety.activeEventId = null;
    state.newbornOpening ||= {};
    state.newbornOpening.completedEventId = state.resolution.newbornExtraEventId;
  }
  return v26.continueLife(state);
}

export const EARLY_EVENTS = [...v26.EARLY_EVENTS, ...EXTRA_NEWBORN_EVENTS.map((event) => ({ ...event, min: 0, max: 0, once: true }))];
