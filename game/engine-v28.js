import * as v27 from "./engine-v27.js?core=28";

export * from "./engine-v27.js?core=28";

const clamp = (value, min = 0, max = 100) => Math.max(min, Math.min(max, value));

const LATE_TODDLER_EVENTS = [
  {
    id: "toddler_toilet_curiosity",
    category: "Self",
    min: 28,
    max: 35,
    title: "A new bathroom routine",
    body: "The adults have started suggesting that the little toilet might be useful to you. You understand the idea. Whether you approve of this new administrative process is another matter.",
    prompt: "How do you approach it?",
    choices: [
      {
        id: "try",
        label: "Give it a try",
        result: "It does not work perfectly every time, but the routine starts becoming less strange. Bodies, annoyingly, require practice too.",
        effects: [
          { type: "development", key: "autonomy", delta: 2 },
          { type: "development", key: "persistence", delta: 1 },
        ],
      },
      {
        id: "routine",
        label: "Only try when reminded",
        result: "You cooperate when the routine appears, then return immediately to matters you consider more important.",
        effects: [
          { type: "personality", key: "structure", delta: 1 },
          { type: "development", key: "emotionalRegulation", delta: 1 },
        ],
      },
      {
        id: "no",
        label: "Strongly object for now",
        result: "You reject the proposal with impressive conviction. Independence occasionally expresses itself by refusing the very skill adults want you to learn independently.",
        effects: [
          { type: "personality", key: "independence", delta: 2 },
          { type: "personality", key: "sensitivity", delta: 1 },
        ],
      },
    ],
  },
  {
    id: "toddler_bedtime_bargain",
    category: "Home",
    min: 28,
    max: 35,
    title: "Not bedtime yet",
    body: "Bedtime arrives while you are still very busy doing something that, from your perspective, is clearly more important than sleep.",
    prompt: "What do you do?",
    choices: [
      {
        id: "one_more",
        label: "Ask for one more minute",
        result: "One more minute becomes several, then the routine resumes. You are beginning to discover that requests sometimes work better than declarations of war.",
        effects: [
          { type: "development", key: "confidence", delta: 1 },
          { type: "development", key: "emotionalRegulation", delta: 1 },
        ],
      },
      {
        id: "protest",
        label: "Refuse to stop playing",
        result: "The transition becomes loud and exhausting. Eventually tiredness wins, as it usually does while pretending not to participate.",
        effects: [
          { type: "personality", key: "sensitivity", delta: 1 },
          { type: "development", key: "emotionalRegulation", delta: -1 },
        ],
      },
      {
        id: "routine",
        label: "Follow the bedtime routine",
        result: "The familiar sequence makes stopping easier: put things away, settle down, hear the same sounds, then sleep.",
        effects: [
          { type: "personality", key: "structure", delta: 2 },
          { type: "health", key: "stress", delta: -1 },
          { type: "relationship", target: "guardian", key: "trust", delta: 1 },
        ],
      },
    ],
  },
  {
    id: "toddler_little_helper",
    category: "Home",
    min: 28,
    max: 35,
    title: "You want to help",
    body: "An adult is doing a simple household task. You decide, without being recruited, that the operation would benefit from your involvement.",
    prompt: "How do you join in?",
    choices: [
      {
        id: "copy",
        label: "Copy exactly what they do",
        result: "Your version is slower and less efficient, but unmistakably aimed at the same goal. Being included feels important.",
        effects: [
          { type: "development", key: "autonomy", delta: 2 },
          { type: "development", key: "persistence", delta: 1 },
          { type: "relationship", target: "guardian", key: "closeness", delta: 1 },
        ],
      },
      {
        id: "invent",
        label: "Invent your own method",
        result: "Your method bears only a philosophical resemblance to the task, but it is performed with confidence.",
        effects: [
          { type: "personality", key: "curiosity", delta: 2 },
          { type: "personality", key: "independence", delta: 1 },
        ],
      },
      {
        id: "ask_job",
        label: "Ask for a job you can do",
        result: "You are given one small piece of the work. Finishing something real feels different from merely being entertained.",
        effects: [
          { type: "development", key: "confidence", delta: 2 },
          { type: "development", key: "autonomy", delta: 1 },
        ],
      },
    ],
  },
  {
    id: "toddler_pretend_call",
    category: "Interests",
    min: 28,
    max: 35,
    title: "An extremely important phone call",
    body: "A harmless household object has become a phone. Whoever is supposedly on the other end apparently requires a very serious conversation.",
    prompt: "What is the call about?",
    choices: [
      {
        id: "family",
        label: "Talk like the adults at home",
        result: "You reproduce fragments of phrases, pauses, and tones with unnerving accuracy. Toddlers are tiny archivists with poor confidentiality policies.",
        effects: [
          { type: "education", key: "language", delta: 2 },
          { type: "personality", key: "curiosity", delta: 1 },
        ],
      },
      {
        id: "story",
        label: "Make up a whole story",
        result: "The person on the other end apparently has a complicated life involving animals, food, and several impossible journeys.",
        effects: [
          { type: "education", key: "language", delta: 2 },
          { type: "interest", key: "making", delta: 2 },
        ],
      },
      {
        id: "short",
        label: "Say hello, then hang up",
        result: "The call is concise, mysterious, and perhaps the most efficient meeting anyone in the household has had all week.",
        effects: [
          { type: "personality", key: "independence", delta: 1 },
          { type: "education", key: "language", delta: 1 },
        ],
      },
    ],
  },
];

function eventSeen(state, id) {
  return (state.history || []).some((entry) => entry.eventId === id);
}

function mix(seed, age) {
  let value = (((Number(seed) || 1) ^ 0x3c6ef372) + Math.imul(age + 1, 0x9e3779b1)) >>> 0;
  value = Math.imul(value ^ (value >>> 16), 0x7feb352d) >>> 0;
  value = Math.imul(value ^ (value >>> 15), 0x846ca68b) >>> 0;
  return (value ^ (value >>> 16)) >>> 0;
}

function ensureLateToddlerState(state) {
  state.lateToddlerVariety ||= { activeEventId: null, recent: [] };
  state.lateToddlerVariety.recent ||= [];
  return state.lateToddlerVariety;
}

function chooseLateToddlerEvent(state) {
  const age = state.character?.ageMonths || 0;
  if (age < 28 || age > 35) return null;
  const tracker = ensureLateToddlerState(state);
  const eligible = LATE_TODDLER_EVENTS.filter((event) => age >= event.min && age <= event.max && !eventSeen(state, event.id));
  if (!eligible.length) return null;
  const fresh = eligible.filter((event) => !tracker.recent.includes(event.id));
  const pool = fresh.length ? fresh : eligible;
  return pool[mix(state.seed, age) % pool.length];
}

function activeLateToddlerEvent(state) {
  const age = state.character?.ageMonths || 0;
  if (age < 28 || age > 35) return null;
  const tracker = ensureLateToddlerState(state);
  let event = LATE_TODDLER_EVENTS.find((item) => item.id === tracker.activeEventId && !eventSeen(state, item.id) && age >= item.min && age <= item.max);
  if (!event) {
    event = chooseLateToddlerEvent(state);
    tracker.activeEventId = event?.id || null;
  }
  return event || null;
}

function targetPerson(state, role) {
  return (state.people || []).find((person) => person.role === role && !person.deceased) || null;
}

function adjust(object, key, delta) {
  if (!object || typeof object[key] !== "number") return;
  object[key] = clamp(object[key] + delta);
}

function applyEffect(state, effect) {
  if (!effect) return;
  if (effect.type === "personality") adjust(state.character?.personality, effect.key, effect.delta);
  else if (effect.type === "development") adjust(state.character?.development, effect.key, effect.delta);
  else if (effect.type === "health") adjust(state.health, effect.key, effect.delta);
  else if (effect.type === "interest") adjust(state.interests, effect.key, effect.delta);
  else if (effect.type === "education") adjust(state.education?.subjects, effect.key, effect.delta);
  else if (effect.type === "relationship") {
    const person = targetPerson(state, effect.target);
    adjust(person, effect.key, effect.delta);
    if (person) person.lastInteractionAtMonths = state.character?.ageMonths || 0;
  }
}

function resolveLateToddlerChoice(state, event, choice) {
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
    continuity: "Small routines and conflicts are shaping how you approach independence.",
  });
  state.history = state.history.slice(-320);
  state.resolution = { choiceId: choice.id, result: choice.result, lateToddlerEventId: event.id };
  if (state.health && typeof state.health.stress === "number") state.health.stress = clamp(state.health.stress - 1);
  return state;
}

export function getCurrentEvent(state) {
  const event = activeLateToddlerEvent(state);
  if (event) return {
    id: event.id,
    category: event.category,
    title: event.title,
    body: event.body,
    prompt: event.prompt,
    continuity: "Small routines and conflicts are shaping how you approach independence.",
    choices: event.choices.map(({ id, label, result }) => ({ id, label, result })),
  };
  return v27.getCurrentEvent(state);
}

export function resolveChoice(state, choiceId) {
  if (!state?.resolution) {
    const event = activeLateToddlerEvent(state);
    const choice = event?.choices.find((item) => item.id === choiceId);
    if (event && choice) return resolveLateToddlerChoice(state, event, choice);
  }
  return v27.resolveChoice(state, choiceId);
}

export function continueLife(state) {
  if (state.resolution?.lateToddlerEventId) {
    const tracker = ensureLateToddlerState(state);
    const id = state.resolution.lateToddlerEventId;
    tracker.recent = [id, ...tracker.recent.filter((item) => item !== id)].slice(0, 4);
    tracker.activeEventId = null;
    // Do not let an event selected underneath this wrapper linger into the next age.
    if (state.earlyChildhoodVariety) state.earlyChildhoodVariety.activeEventId = null;
  }
  return v27.continueLife(state);
}

export const EARLY_EVENTS = [...v27.EARLY_EVENTS, ...LATE_TODDLER_EVENTS];
