const clamp = (value, min = 0, max = 100) => Math.max(min, Math.min(max, value));

function caregiver(state) {
  return (state.people || []).find((person) => ["guardian", "secondGuardian"].includes(person.role) && !person.deceased) || null;
}

function recentIllnessUpdate(state) {
  return (state.realism?.latest || []).some((item) => {
    if (item.category !== "Health") return false;
    const text = String(item.text || "").toLowerCase();
    return text.includes("get sick enough")
      || text.includes("become seriously ill")
      || text.includes("illness gets worse")
      || text.includes("condition becomes serious");
  });
}

function hasIllnessContext(state) {
  return Boolean(state.realism?.active?.length || recentIllnessUpdate(state));
}

function illnessLabel(state) {
  return state.realism?.active?.[0]?.label || "illness";
}

function infantIllnessEvent(state) {
  const person = caregiver(state);
  const caregiverName = person?.name || "the person caring for you";
  return {
    id: "context_infant_illness",
    category: "Health",
    title: "You don't feel well",
    body: `Your body feels wrong in a way you cannot understand yet. You are tired, uncomfortable, and harder to settle than usual while ${caregiverName} keeps checking on you.`,
    prompt: "How do you respond?",
    choices: [
      {
        id: "cling",
        label: "Curl into your caregiver",
        result: "You stay pressed against someone familiar. You are still sick, but being held makes the strange feeling a little easier to bear.",
        effects: [
          { type: "relationship", target: "guardian", key: "trust", delta: 3 },
          { type: "health", key: "stress", delta: -2 },
        ],
      },
      {
        id: "sleep",
        label: "Sleep when you can",
        result: "You drift in and out of sleep for much of the day. Your body takes what rest it can get.",
        effects: [
          { type: "health", key: "energy", delta: 4 },
          { type: "health", key: "stress", delta: -1 },
        ],
      },
      {
        id: "fuss",
        label: "Keep fussing",
        result: "Nothing feels quite right, so you cry and resist being settled. The adults around you keep trying different ways to comfort you.",
        effects: [
          { type: "personality", key: "sensitivity", delta: 1 },
          { type: "relationship", target: "guardian", key: "familiarity", delta: 2 },
        ],
      },
    ],
  };
}

function childIllnessEvent(state) {
  const label = illnessLabel(state);
  return {
    id: "context_child_illness",
    category: "Health",
    title: "A sick day",
    body: `You are dealing with a ${label}. The plans you would normally have are pushed aside while your body tries to recover.`,
    prompt: "What do you do while you're sick?",
    choices: [
      {
        id: "rest",
        label: "Actually rest",
        result: "You let the day become quiet and uneventful. Rest is not exciting, but your body has more use for it than for excitement right now.",
        effects: [
          { type: "health", key: "energy", delta: 5 },
          { type: "health", key: "stress", delta: -2 },
        ],
      },
      {
        id: "quiet",
        label: "Find something quiet to do",
        result: "You keep yourself occupied without asking much from your body. The hours pass between small distractions and rest.",
        effects: [
          { type: "health", key: "energy", delta: 2 },
          { type: "interest", key: "reading", delta: 1 },
          { type: "interest", key: "drawing", delta: 1 },
        ],
      },
      {
        id: "push",
        label: "Keep trying to get up",
        result: "You keep insisting you are less tired than you are. Your body disagrees and eventually wins the argument.",
        effects: [
          { type: "health", key: "energy", delta: -3 },
          { type: "personality", key: "risk", delta: 1 },
        ],
      },
    ],
  };
}

function infantEveningEvent(state) {
  const person = caregiver(state);
  const caregiverName = person?.name || "someone familiar";
  return {
    id: "context_infant_evening",
    category: "Home",
    title: "A quiet evening at home",
    body: `The house settles into its evening routine. You move between feeding, being held, watching familiar faces, and getting sleepy while ${caregiverName} stays close.`,
    prompt: "What holds your attention?",
    choices: [
      {
        id: "arms",
        label: "Stay in someone's arms",
        result: "You remain close to the warmth and sound of another person until your body relaxes.",
        effects: [
          { type: "relationship", target: "guardian", key: "closeness", delta: 2 },
          { type: "health", key: "stress", delta: -1 },
        ],
      },
      {
        id: "watch",
        label: "Watch the room",
        result: "You stare at faces, lights, movement, and shadows. The ordinary room is still full of things you have not learned yet.",
        effects: [
          { type: "personality", key: "curiosity", delta: 2 },
          { type: "relationship", target: "guardian", key: "familiarity", delta: 1 },
        ],
      },
      {
        id: "sleep",
        label: "Drift to sleep",
        result: "The sounds of the house blur together until you fall asleep in the middle of them.",
        effects: [
          { type: "health", key: "energy", delta: 2 },
          { type: "health", key: "stress", delta: -1 },
        ],
      },
    ],
  };
}

function toddlerEveningEvent(state) {
  return {
    id: "context_toddler_evening",
    category: "Home",
    title: "An ordinary evening",
    body: "Dinner is over and the house has settled into familiar routines. You are still small enough that most of the evening happens around the adults caring for you.",
    prompt: "What do you do?",
    choices: [
      {
        id: "near",
        label: "Stay close to everyone",
        result: "You move from person to person, content to remain near the activity without needing much else.",
        effects: [
          { type: "relationship", target: "guardian", key: "closeness", delta: 2 },
          { type: "health", key: "stress", delta: -1 },
        ],
      },
      {
        id: "play",
        label: "Play nearby",
        result: "You become absorbed in a small game of your own while the adults continue their evening around you.",
        effects: [
          { type: "personality", key: "independence", delta: 1 },
          { type: "personality", key: "curiosity", delta: 1 },
        ],
      },
      {
        id: "follow",
        label: "Follow your caregiver around",
        result: "You trail after a familiar adult from room to room, turning ordinary chores into something worth watching.",
        effects: [
          { type: "relationship", target: "guardian", key: "familiarity", delta: 2 },
          { type: "personality", key: "curiosity", delta: 1 },
        ],
      },
    ],
  };
}

function healthyReplacementEvent(state) {
  const ageMonths = state.character?.ageMonths || 0;
  if (ageMonths < 18) return infantEveningEvent(state);
  if (ageMonths < 36) return toddlerEveningEvent(state);
  return {
    id: "context_healthy_day",
    category: "Home",
    title: "A quiet day",
    body: "Nothing unusual is wrong with your health today. The hours pass through ordinary routines instead of a sick day that never actually happened.",
    prompt: "Where does your attention go?",
    choices: [
      { id: "family", label: "Spend time near family", result: "You stay close to familiar people for a while.", effects: [{ type: "relationship", target: "guardian", key: "closeness", delta: 1 }] },
      { id: "own", label: "Do something on your own", result: "You settle into something small that holds your attention.", effects: [{ type: "personality", key: "independence", delta: 1 }] },
      { id: "rest", label: "Take it easy", result: "The day remains quiet, and that is enough.", effects: [{ type: "health", key: "stress", delta: -1 }] },
    ],
  };
}

function eventById(state, id) {
  if (id === "context_infant_illness") return infantIllnessEvent(state);
  if (id === "context_child_illness") return childIllnessEvent(state);
  if (id === "context_infant_evening") return infantEveningEvent(state);
  if (id === "context_toddler_evening") return toddlerEveningEvent(state);
  if (id === "context_healthy_day") return healthyReplacementEvent(state);
  return null;
}

export function contextualEventForState(state) {
  if (!state?.character || state.death || state.completed) return null;
  const remembered = state.resolution?.contextualEventId;
  if (remembered) return eventById(state, remembered);

  const ageMonths = state.character.ageMonths || 0;
  if (hasIllnessContext(state)) return ageMonths < 24 ? infantIllnessEvent(state) : childIllnessEvent(state);

  // The base content still contains a generic sick-day event. Do not let it invent
  // an illness when the health simulation says the character is healthy.
  if (state.currentEventId === "sick_day") return healthyReplacementEvent(state);

  // The generic family-evening copy assumes speech and independent play. Replace
  // it for babies and young toddlers with something they can actually do.
  if (state.currentEventId === "family_evening" && ageMonths < 36) {
    return ageMonths < 18 ? infantEveningEvent(state) : toddlerEveningEvent(state);
  }

  return null;
}

function adjust(target, key, delta) {
  if (!target || typeof target[key] !== "number") return;
  target[key] = clamp(target[key] + delta);
}

function applyEffect(state, effect) {
  if (effect.type === "health") adjust(state.health, effect.key, effect.delta);
  if (effect.type === "personality") adjust(state.character?.personality, effect.key, effect.delta);
  if (effect.type === "interest") adjust(state.interests, effect.key, effect.delta);
  if (effect.type === "relationship") {
    const person = (state.people || []).find((item) => item.role === effect.target && !item.deceased);
    adjust(person, effect.key, effect.delta);
    if (person) person.lastInteractionAtMonths = state.character.ageMonths;
  }
}

export function resolveContextualChoice(state, choiceId) {
  const event = contextualEventForState(state);
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
    continuity: "contextual",
  });
  state.currentEventId = event.id;
  state.resolution = {
    choiceId: choice.id,
    result: choice.result,
    contextualEventId: event.id,
  };
  return state;
}
