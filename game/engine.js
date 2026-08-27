import { eventTemplates, namePools, places } from "./content.js";
import { continuityEvents } from "./callbacks.js";

const allEvents = [...eventTemplates, ...continuityEvents];
const clamp = (value, min = 0, max = 100) => Math.max(min, Math.min(max, value));
const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function seeded(seed) {
  let value = seed >>> 0;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 4294967296;
  };
}

function pick(rng, items) {
  return items[Math.floor(rng() * items.length)];
}

function randomBetween(rng, min, max) {
  return Math.round(min + rng() * (max - min));
}

function nextRandom(state) {
  state.rngState = (state.rngState * 1664525 + 1013904223) >>> 0;
  return state.rngState / 4294967296;
}

function makeNpcState(rng, role) {
  const baseStress = role === "guardian" || role === "secondGuardian" ? randomBetween(rng, 28, 48) : randomBetween(rng, 18, 38);
  return {
    outsideStress: baseStress,
    availability: randomBetween(rng, 58, 82),
    socialWorld: role === "friend" ? randomBetween(rng, 42, 64) : randomBetween(rng, 28, 52),
    currentThread: "",
    lastChangedAtMonths: 0,
  };
}

function makeRelationship(rng, role, name, age, introducedAtMonths = 0) {
  return {
    id: `${role}-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
    role,
    name,
    age,
    introducedAtMonths,
    closeness: randomBetween(rng, 48, 72),
    trust: randomBetween(rng, 48, 72),
    affection: randomBetween(rng, 55, 78),
    conflict: randomBetween(rng, 5, 20),
    familiarity: randomBetween(rng, 50, 72),
    lastInteractionAtMonths: introducedAtMonths,
    history: [],
    npc: makeNpcState(rng, role),
  };
}

function ensureState(state) {
  const p = state.character.personality;
  state.character.development ||= {
    attachment: 58,
    confidence: clamp(Math.round(44 + ((p?.risk ?? 50) - 50) * 0.25 + ((p?.social ?? 50) - 50) * 0.15)),
    emotionalRegulation: clamp(Math.round(56 - ((p?.sensitivity ?? 50) - 50) * 0.2)),
    autonomy: clamp(Math.round(42 + ((p?.independence ?? 50) - 50) * 0.3)),
    socialComfort: clamp(Math.round(46 + ((p?.social ?? 50) - 50) * 0.35)),
    persistence: clamp(Math.round(48 + ((p?.structure ?? 50) - 50) * 0.3)),
  };
  state.character.patterns ||= { connecting: 0, exploring: 0, creating: 0, persisting: 0, selfReliance: 0 };
  state.worldEvents ||= [];
  state.recentEventIds ||= [];
  state.history ||= [];
  state.memories ||= [];
  for (const person of state.people || []) {
    person.history ||= [];
    person.lastInteractionAtMonths ??= person.introducedAtMonths || 0;
    person.npc ||= {
      outsideStress: person.role === "guardian" || person.role === "secondGuardian" ? 38 : 28,
      availability: 70,
      socialWorld: person.role === "friend" ? 52 : 38,
      currentThread: "",
      lastChangedAtMonths: 0,
    };
  }
  return state;
}

function makeDevelopment(rng, personality) {
  return {
    attachment: randomBetween(rng, 52, 68),
    confidence: clamp(Math.round(44 + (personality.risk - 50) * 0.25 + (personality.social - 50) * 0.15 + randomBetween(rng, -5, 5))),
    emotionalRegulation: clamp(Math.round(56 - (personality.sensitivity - 50) * 0.2 + randomBetween(rng, -5, 5))),
    autonomy: clamp(Math.round(42 + (personality.independence - 50) * 0.3 + randomBetween(rng, -4, 4))),
    socialComfort: clamp(Math.round(46 + (personality.social - 50) * 0.35 + randomBetween(rng, -4, 4))),
    persistence: clamp(Math.round(48 + (personality.structure - 50) * 0.3 + randomBetween(rng, -4, 4))),
  };
}

export function createNewLife(seed = Date.now()) {
  const normalizedSeed = Number(seed) >>> 0;
  const rng = seeded(normalizedSeed || 1);
  const firstName = pick(rng, namePools.first);
  const lastName = pick(rng, namePools.last);
  const place = pick(rng, places);
  const guardianName = `${pick(rng, namePools.guardianFirst)} ${lastName}`;
  const secondGuardianName = `${pick(rng, namePools.guardianFirst)} ${lastName}`;
  const friendName = `${pick(rng, namePools.friendFirst)} ${pick(rng, namePools.last)}`;
  const siblingName = `${pick(rng, namePools.siblingFirst)} ${lastName}`;
  const grandmotherName = pick(rng, namePools.grandmotherFirst);
  const hasSibling = rng() > 0.42;
  const hasGrandmother = rng() > 0.2;
  const twoGuardians = rng() > 0.28;
  const birthYear = 2026;
  const birthMonth = randomBetween(rng, 0, 11);
  const financeRoll = rng();
  const financeBand = financeRoll < 0.28 ? "Tight" : financeRoll < 0.76 ? "Getting by" : "Comfortable";
  const personality = {
    social: randomBetween(rng, 38, 62),
    risk: randomBetween(rng, 38, 62),
    structure: randomBetween(rng, 38, 62),
    sensitivity: randomBetween(rng, 38, 62),
    curiosity: randomBetween(rng, 42, 68),
    independence: randomBetween(rng, 35, 58),
  };

  const people = [
    makeRelationship(rng, "guardian", guardianName, randomBetween(rng, 24, 36)),
    makeRelationship(rng, "friend", friendName, 0, 60),
    makeRelationship(rng, "teacher", pick(rng, ["Ms. Santos", "Mr. Lim", "Ms. Rivera", "Mr. Cruz"]), randomBetween(rng, 27, 49), 60),
  ];

  if (twoGuardians) people.push(makeRelationship(rng, "secondGuardian", secondGuardianName, randomBetween(rng, 25, 39)));
  if (hasSibling) people.push(makeRelationship(rng, "sibling", siblingName, randomBetween(rng, 2, 5)));
  if (hasGrandmother) people.push(makeRelationship(rng, "grandmother", grandmotherName, randomBetween(rng, 52, 69)));

  const state = {
    version: 2,
    seed: normalizedSeed || 1,
    rngState: (normalizedSeed || 1) ^ 0x9e3779b9,
    character: {
      firstName,
      lastName,
      sex: rng() > 0.5 ? "Female" : "Male",
      birthplace: `${place.city}, ${place.country}`,
      ageMonths: 0,
      birthYear,
      birthMonth,
      personality,
      development: makeDevelopment(rng, personality),
      patterns: {
        connecting: 0,
        exploring: 0,
        creating: 0,
        persisting: 0,
        selfReliance: 0,
      },
    },
    date: { year: birthYear, month: birthMonth, day: randomBetween(rng, 3, 25) },
    household: {
      name: `The ${lastName} Family Home`,
      housing: place.housing,
      city: place.city,
      country: place.country,
      neighborhood: place.neighborhood,
      financeBand,
      privacy: twoGuardians && hasSibling ? "Limited" : "Moderate",
      comfort: financeBand === "Comfortable" ? "Comfortable" : financeBand === "Tight" ? "Basic" : "Modest",
      savings: financeBand === "Comfortable" ? randomBetween(rng, 30000, 90000) : financeBand === "Tight" ? randomBetween(rng, 0, 5000) : randomBetween(rng, 6000, 25000),
    },
    health: {
      wellbeing: randomBetween(rng, 64, 82),
      energy: randomBetween(rng, 62, 82),
      stress: randomBetween(rng, 12, 28),
    },
    interests: {
      drawing: randomBetween(rng, 15, 30),
      reading: randomBetween(rng, 15, 30),
      gardening: randomBetween(rng, 10, 24),
      cooking: randomBetween(rng, 10, 24),
      gaming: randomBetween(rng, 10, 24),
      music: randomBetween(rng, 10, 24),
      making: randomBetween(rng, 15, 30),
    },
    education: {
      subjects: {
        mathematics: randomBetween(rng, 42, 62),
        language: randomBetween(rng, 42, 62),
        science: randomBetween(rng, 42, 62),
        art: randomBetween(rng, 42, 62),
        physicalEducation: randomBetween(rng, 42, 62),
      },
    },
    money: { savings: 0 },
    people,
    memories: [],
    history: [],
    worldEvents: [],
    recentEventIds: [],
    currentEventId: null,
    resolution: null,
    completed: false,
  };

  state.currentEventId = selectEventId(state);
  return state;
}

export function getAgeYears(state) {
  return Math.floor(state.character.ageMonths / 12);
}

export function getAgeLabel(state) {
  const years = getAgeYears(state);
  if (years === 0) {
    const m = state.character.ageMonths;
    return m === 0 ? "Newborn" : `${m} month${m === 1 ? "" : "s"}`;
  }
  return `Age ${years}`;
}

export function formatGameDate(state) {
  return `${months[state.date.month]} ${state.date.day}, ${state.date.year}`;
}

function getPerson(state, role) {
  return state.people.find((person) => person.role === role) || null;
}

function contextFor(state) {
  const guardian = getPerson(state, "guardian");
  const secondGuardian = getPerson(state, "secondGuardian");
  const friend = getPerson(state, "friend");
  const sibling = getPerson(state, "sibling");
  const grandmother = getPerson(state, "grandmother");
  const teacher = getPerson(state, "teacher");
  const mathBase = state.education.subjects.mathematics;
  const mathScore = clamp(Math.round(52 + mathBase * 0.48 + (state.character.personality.structure - 50) * 0.12), 58, 98);
  return { guardian, secondGuardian, friend, sibling, grandmother, teacher, mathScore, character: state.character };
}

function interpolate(text, state) {
  if (!text) return "";
  const context = contextFor(state);
  return text.replace(/\{([a-zA-Z]+)(?:\.([a-zA-Z]+))?\}/g, (_, root, key) => {
    const value = context[root];
    if (value == null) return "";
    if (key) return value[key] ?? "";
    return String(value);
  });
}

function compareMetric(value, requirement) {
  if (typeof value !== "number") return false;
  if (typeof requirement === "number") return value >= requirement;
  if (!requirement || typeof requirement !== "object") return true;
  if (requirement.min != null && value < requirement.min) return false;
  if (requirement.max != null && value > requirement.max) return false;
  return true;
}

function historyMatches(state, requirement) {
  const matches = state.history.filter((entry) => {
    if (requirement.eventId && entry.eventId !== requirement.eventId) return false;
    if (requirement.choiceId && entry.choiceId !== requirement.choiceId) return false;
    const monthsAgo = state.character.ageMonths - entry.ageMonths;
    if (requirement.minMonthsAgo != null && monthsAgo < requirement.minMonthsAgo) return false;
    if (requirement.maxMonthsAgo != null && monthsAgo > requirement.maxMonthsAgo) return false;
    return true;
  });
  return matches.length > 0;
}

function requirementList(value) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function matchesRequirementsFor(requirements = {}, state) {
  if (requirements.hasSibling && !getPerson(state, "sibling")) return false;
  if (requirements.hasGrandmother && !getPerson(state, "grandmother")) return false;
  if (requirements.hasSecondGuardian && !getPerson(state, "secondGuardian")) return false;

  if (requirements.financeBand) {
    const allowed = Array.isArray(requirements.financeBand) ? requirements.financeBand : [requirements.financeBand];
    if (!allowed.includes(state.household.financeBand)) return false;
  }

  for (const req of requirementList(requirements.history)) {
    if (!historyMatches(state, req)) return false;
  }
  for (const req of requirementList(requirements.notHistory)) {
    if (historyMatches(state, req)) return false;
  }

  if (requirements.personality) {
    const { key, ...range } = requirements.personality;
    if (!compareMetric(state.character.personality[key], range)) return false;
  }
  if (requirements.development) {
    const { key, ...range } = requirements.development;
    if (!compareMetric(state.character.development[key], range)) return false;
  }
  if (requirements.interest) {
    const { key, ...range } = requirements.interest;
    if (!compareMetric(state.interests[key], range)) return false;
  }
  if (requirements.relationship) {
    const { target, key, ...range } = requirements.relationship;
    const person = getPerson(state, target);
    if (!person || !compareMetric(person[key], range)) return false;
  }
  if (requirements.npc) {
    const { target, key, ...range } = requirements.npc;
    const person = getPerson(state, target);
    if (!person?.npc || !compareMetric(person.npc[key], range)) return false;
  }
  if (requirements.pattern) {
    const { key, ...range } = requirements.pattern;
    if (!compareMetric(state.character.patterns[key], range)) return false;
  }
  if (requirements.minMemories != null && state.memories.length < requirements.minMemories) return false;
  return true;
}

function matchesRequirements(template, state) {
  const age = getAgeYears(state);
  if (age < template.age[0] || age > template.age[1]) return false;
  if (template.once && state.history.some((entry) => entry.eventId === template.id)) return false;
  return matchesRequirementsFor(template.requirements || {}, state);
}

function eventWeight(template, state) {
  let weight = Math.max(0.05, template.weight || 1);
  for (const modifier of template.weightModifiers || []) {
    if (matchesRequirementsFor(modifier.when || {}, state)) weight *= modifier.multiplier || 1;
  }
  return weight;
}

function selectEventId(state) {
  const available = allEvents.filter((template) => matchesRequirements(template, state));
  const fresh = available.filter((template) => !state.recentEventIds.includes(template.id));
  const pool = fresh.length ? fresh : available;
  if (!pool.length) return "family_evening";

  const weighted = pool.map((template) => ({ template, weight: eventWeight(template, state) }));
  const total = weighted.reduce((sum, item) => sum + item.weight, 0);
  let roll = nextRandom(state) * total;
  for (const item of weighted) {
    roll -= item.weight;
    if (roll <= 0) return item.template.id;
  }
  return weighted[weighted.length - 1].template.id;
}

export function getCurrentEvent(state) {
  ensureState(state);
  const template = allEvents.find((item) => item.id === state.currentEventId) || allEvents[0];
  const availableChoices = template.choices.filter((choice) => matchesRequirementsFor(choice.requirements || {}, state));
  const choices = availableChoices.length ? availableChoices : template.choices.slice(-1);
  return {
    id: template.id,
    category: template.category,
    title: interpolate(template.title, state),
    body: interpolate(template.body, state),
    prompt: interpolate(template.prompt, state),
    continuity: template.continuity || "",
    choices: choices.map((choice) => ({
      id: choice.id,
      label: interpolate(choice.label, state),
      result: interpolate(choice.result, state),
    })),
  };
}

function adjust(target, key, delta) {
  if (!target || typeof target[key] !== "number") return;
  target[key] = clamp(target[key] + delta);
}

function recordRelationshipHistory(state, person, effect, meta) {
  if (!person || Math.abs(effect.delta || 0) < 2) return;
  person.history ||= [];
  person.history.push({
    ageMonths: state.character.ageMonths,
    date: { ...state.date },
    eventId: meta.eventId,
    choiceId: meta.choiceId,
    key: effect.key,
    delta: effect.delta,
  });
  person.history = person.history.slice(-12);
}

function applyEffect(state, effect, meta) {
  switch (effect.type) {
    case "personality":
      adjust(state.character.personality, effect.key, effect.delta);
      break;
    case "development":
      adjust(state.character.development, effect.key, effect.delta);
      break;
    case "pattern":
      state.character.patterns[effect.key] = Math.max(0, (state.character.patterns[effect.key] || 0) + effect.delta);
      break;
    case "relationship": {
      const person = getPerson(state, effect.target);
      adjust(person, effect.key, effect.delta);
      if (person) {
        person.lastInteractionAtMonths = state.character.ageMonths;
        recordRelationshipHistory(state, person, effect, meta);
      }
      break;
    }
    case "npc": {
      const person = getPerson(state, effect.target);
      adjust(person?.npc, effect.key, effect.delta);
      break;
    }
    case "interest":
      adjust(state.interests, effect.key, effect.delta);
      break;
    case "education":
      adjust(state.education.subjects, effect.key, effect.delta);
      break;
    case "health":
      adjust(state.health, effect.key, effect.delta);
      break;
    case "money":
      state.money[effect.key] = Math.max(0, (state.money[effect.key] || 0) + effect.delta);
      break;
    default:
      break;
  }
}

function shapeDevelopmentFromChoice(state, choice) {
  const effects = choice.effects || [];
  let connection = 0;
  let exploration = 0;
  let creation = 0;
  let persistence = 0;
  let selfReliance = 0;

  for (const effect of effects) {
    const delta = effect.delta || 0;
    if (effect.type === "relationship" && delta > 0) {
      connection += Math.max(1, Math.round(delta / 3));
      if (effect.target === "guardian" || effect.target === "secondGuardian" || effect.target === "grandmother") {
        adjust(state.character.development, "attachment", Math.max(1, Math.round(delta / 4)));
      }
      if (effect.target === "friend" || effect.target === "sibling") {
        adjust(state.character.development, "socialComfort", Math.max(1, Math.round(delta / 4)));
      }
    }
    if (effect.type === "relationship" && effect.key === "conflict" && delta > 0) {
      adjust(state.character.development, "emotionalRegulation", -1);
    }
    if (effect.type === "personality" && effect.key === "social") {
      if (delta > 0) {
        adjust(state.character.development, "confidence", Math.max(1, Math.round(delta / 3)));
        adjust(state.character.development, "socialComfort", Math.max(1, Math.round(delta / 3)));
        connection += 1;
      } else if (delta < -2) {
        adjust(state.character.development, "socialComfort", -1);
      }
    }
    if (effect.type === "personality" && effect.key === "risk" && delta > 0) {
      adjust(state.character.development, "confidence", 1);
      exploration += 1;
    }
    if (effect.type === "personality" && effect.key === "curiosity" && delta > 0) exploration += 1;
    if (effect.type === "personality" && effect.key === "independence" && delta > 0) {
      adjust(state.character.development, "autonomy", Math.max(1, Math.round(delta / 2)));
      selfReliance += 1;
    }
    if (effect.type === "personality" && effect.key === "structure" && delta > 0) {
      adjust(state.character.development, "persistence", Math.max(1, Math.round(delta / 3)));
      persistence += 1;
    }
    if (effect.type === "personality" && effect.key === "sensitivity" && delta < 0) {
      adjust(state.character.development, "emotionalRegulation", 1);
    }
    if (effect.type === "education" && delta > 1) {
      adjust(state.character.development, "confidence", 1);
      persistence += 1;
    }
    if (effect.type === "interest" && delta >= 4) creation += ["drawing", "making", "cooking", "music"].includes(effect.key) ? 1 : 0;
    if (effect.type === "health" && effect.key === "stress" && delta < 0) adjust(state.character.development, "emotionalRegulation", 1);
  }

  state.character.patterns.connecting += connection;
  state.character.patterns.exploring += exploration;
  state.character.patterns.creating += creation;
  state.character.patterns.persisting += persistence;
  state.character.patterns.selfReliance += selfReliance;

  for (const pattern of choice.patterns || []) {
    state.character.patterns[pattern.key] = Math.max(0, (state.character.patterns[pattern.key] || 0) + pattern.delta);
  }
}

export function resolveChoice(state, choiceId) {
  ensureState(state);
  if (state.completed || state.resolution) return state;
  const template = allEvents.find((item) => item.id === state.currentEventId);
  const choice = template?.choices.find((item) => item.id === choiceId);
  if (!template || !choice || !matchesRequirementsFor(choice.requirements || {}, state)) return state;

  const meta = { eventId: template.id, choiceId };
  choice.effects?.forEach((effect) => applyEffect(state, effect, meta));
  shapeDevelopmentFromChoice(state, choice);
  const result = interpolate(choice.result, state);
  const eventTitle = interpolate(template.title, state);
  const choiceLabel = interpolate(choice.label, state);

  state.history.push({
    ageMonths: state.character.ageMonths,
    date: { ...state.date },
    eventId: template.id,
    title: eventTitle,
    choiceId,
    choice: choiceLabel,
    result,
    continuity: template.continuity || "",
  });

  if (choice.memory && choice.memory.importance >= 2) {
    state.memories.push({
      id: `${template.id}-${state.history.length}`,
      age: getAgeYears(state),
      ageMonths: state.character.ageMonths,
      date: formatGameDate(state),
      title: interpolate(choice.memory.title, state),
      copy: interpolate(choice.memory.copy, state),
      importance: choice.memory.importance,
      featured: choice.memory.importance >= 4,
      sourceEventId: template.id,
      sourceChoiceId: choiceId,
    });
  }

  state.resolution = { choiceId, result };
  state.health.stress = clamp(state.health.stress - 1);
  return state;
}

function advanceDate(state, amount) {
  state.character.ageMonths += amount;
  const total = state.date.month + amount;
  state.date.year += Math.floor(total / 12);
  state.date.month = total % 12;
  state.date.day = clamp(state.date.day + Math.round(nextRandom(state) * 8 - 4), 2, 27);
}

function monthsPerTurn(state) {
  const ageMonths = state.character.ageMonths;
  if (ageMonths < 12) return 3;
  if (ageMonths < 6 * 12) return 4;
  return 3;
}

function roleThreads(person, state) {
  const first = person.name.split(" ")[0];
  const byRole = {
    guardian: [
      `${first} has been busier than usual outside the home.`,
      `${first} seems to have a little more time at home lately.`,
      `${first} has been carrying some worry that is not really about you.`,
      `${first}'s routine has been unusually steady lately.`,
    ],
    secondGuardian: [
      `${first} has been busier than usual outside the home.`,
      `${first} has been around the house more often lately.`,
      `${first} seems distracted by adult responsibilities.`,
      `${first}'s days have been fairly uneventful lately.`,
    ],
    friend: [
      `${first} has been spending more time with other classmates too.`,
      `${first} has been excited about something outside your friendship.`,
      `${first} has seemed quieter at school lately.`,
      `${first} has been unusually easy to find after class lately.`,
    ],
    sibling: [
      `${first} has developed a small world of interests that has nothing to do with you.`,
      `${first} has been seeking more attention from the adults lately.`,
      `${first} has been unusually absorbed in their own routines.`,
      `${first} has wanted to tag along with you more often lately.`,
    ],
    grandmother: [
      `${first} has been keeping to familiar routines lately.`,
      `${first} has had more energy for visits lately.`,
      `${first} has seemed a little more tired than usual.`,
      `${first} has been telling more stories about the past lately.`,
    ],
    teacher: [
      `${first} has been especially busy with school this term.`,
      `${first} seems more relaxed in class lately.`,
      `${first} has been paying close attention to the class this month.`,
    ],
  };
  return byRole[person.role] || [`${first}'s life has been moving along outside your attention.`];
}

function pushWorldEvent(state, person, note) {
  state.worldEvents ||= [];
  state.worldEvents.push({
    ageMonths: state.character.ageMonths,
    date: { ...state.date },
    personId: person.id,
    personName: person.name,
    note,
  });
  state.worldEvents = state.worldEvents.slice(-24);
}

function simulateBackgroundLife(state, elapsedMonths) {
  const ageMonths = state.character.ageMonths;
  for (const person of state.people) {
    if (person.introducedAtMonths > ageMonths) continue;
    person.npc ||= { outsideStress: 30, availability: 70, socialWorld: 40, currentThread: "", lastChangedAtMonths: 0 };
    person.history ||= [];

    const financePressure = (person.role === "guardian" || person.role === "secondGuardian") && state.household.financeBand === "Tight" ? 3 : 0;
    const stressDrift = Math.round((nextRandom(state) - 0.46) * 10) + financePressure;
    const socialDrift = Math.round((nextRandom(state) - 0.42) * (person.role === "friend" ? 10 : 6));
    adjust(person.npc, "outsideStress", stressDrift);
    adjust(person.npc, "socialWorld", socialDrift);
    const availabilityTarget = clamp(82 - person.npc.outsideStress * 0.48 - person.npc.socialWorld * 0.08, 25, 88);
    person.npc.availability = clamp(Math.round(person.npc.availability * 0.65 + availabilityTarget * 0.35));

    const changeChance = person.role === "friend" ? 0.24 : 0.17;
    if (nextRandom(state) < changeChance && ageMonths - (person.npc.lastChangedAtMonths || 0) >= Math.max(3, elapsedMonths)) {
      const threads = roleThreads(person, state);
      const note = threads[Math.floor(nextRandom(state) * threads.length)];
      person.npc.currentThread = note;
      person.npc.lastChangedAtMonths = ageMonths;
      pushWorldEvent(state, person, note);
    }

    const monthsSinceInteraction = ageMonths - (person.lastInteractionAtMonths ?? person.introducedAtMonths);
    if (person.role === "friend" && ageMonths >= 72 && monthsSinceInteraction >= 12 && person.npc.socialWorld > 65) {
      adjust(person, "closeness", -1);
      adjust(person, "familiarity", 1);
    }
    if ((person.role === "guardian" || person.role === "secondGuardian") && person.npc.outsideStress > 72) {
      state.health.stress = clamp(state.health.stress + 1);
    }
  }

  const guardian = getPerson(state, "guardian");
  if (guardian) {
    const trustPull = (guardian.trust - 50) * 0.015;
    state.character.development.attachment = clamp(state.character.development.attachment + trustPull);
  }
}

export function continueLife(state) {
  ensureState(state);
  if (state.completed || !state.resolution) return state;
  const previous = state.currentEventId;
  state.recentEventIds = [previous, ...state.recentEventIds.filter((id) => id !== previous)].slice(0, 5);
  const elapsedMonths = monthsPerTurn(state);
  advanceDate(state, elapsedMonths);
  simulateBackgroundLife(state, elapsedMonths);
  state.resolution = null;

  if (state.character.ageMonths >= 13 * 12) {
    state.completed = true;
    state.currentEventId = null;
    return state;
  }

  state.currentEventId = selectEventId(state);
  return state;
}

export function getVisiblePeople(state) {
  ensureState(state);
  return state.people.filter((person) => person.introducedAtMonths <= state.character.ageMonths && person.role !== "teacher");
}

export function relationshipLabel(person) {
  const score = person.closeness + person.trust - person.conflict * 0.7;
  if (score >= 130) return "Very close";
  if (score >= 105) return "Strong";
  if (score >= 82) return "Warm";
  if (score >= 62) return "Familiar";
  return "Distant";
}

export function relationshipCopy(person) {
  let base;
  if (person.conflict > 45) base = "There has been tension between you lately.";
  else if (person.trust > 72 && person.closeness > 70) base = "You trust them and usually feel understood around them.";
  else if (person.closeness > 67) base = "You naturally spend a lot of time together.";
  else if (person.trust > 65) base = "You feel fairly safe being yourself around them.";
  else if (person.closeness < 42) base = "You know each other, but there is still some distance.";
  else base = "The relationship is still taking shape.";

  if (person.npc?.currentThread && person.role !== "guardian") return `${base} ${person.npc.currentThread}`;
  return base;
}

export function discoveredTraits(state) {
  ensureState(state);
  const p = state.character.personality;
  const interests = state.interests;
  const d = state.character.development;
  const patterns = state.character.patterns;
  const traits = [];
  if (p.curiosity >= 62 || patterns.exploring >= 8) traits.push(["Curious", "You often investigate things without being asked."]);
  if (Math.max(interests.drawing, interests.making, interests.cooking) >= 55 || patterns.creating >= 7) traits.push(["Maker", "You seem happiest when creating something with your hands or ideas."]);
  if (p.social <= 38 && d.socialComfort <= 48) traits.push(["Quiet Observer", "You often understand a room before deciding how much of yourself to put into it."]);
  if (p.social >= 68 || patterns.connecting >= 10) traits.push(["Social", "Being around other people has become an important part of how you move through life."]);
  if (p.structure >= 69 || patterns.persisting >= 10) traits.push(["Planner", "You feel better when you know what is supposed to happen next."]);
  if (p.independence >= 69 || d.autonomy >= 70 || patterns.selfReliance >= 9) traits.push(["Independent", "You increasingly prefer solving small problems on your own."]);
  if (p.risk >= 70 && d.confidence >= 58) traits.push(["Adventurous", "New experiences tend to pull you forward more than they scare you away."]);
  if (d.emotionalRegulation >= 72 && patterns.persisting >= 6) traits.push(["Steady", "Strong feelings still arrive, but they do not always decide what you do next."]);
  return traits.slice(0, 4);
}

export function personalityRows(state) {
  ensureState(state);
  const p = state.character.personality;
  return [
    ["Reserved", "Outgoing", p.social],
    ["Cautious", "Adventurous", p.risk],
    ["Sensitive", "Resilient", 100 - p.sensitivity],
    ["Impulsive", "Structured", p.structure],
    ["Practical", "Curious", p.curiosity],
    ["Dependent", "Self-directed", p.independence],
  ];
}

function statusWord(value) {
  if (value >= 78) return "Excellent";
  if (value >= 66) return "Doing well";
  if (value >= 54) return "Steady";
  if (value >= 42) return "Mixed";
  return "Struggling";
}

export function schoolSnapshot(state) {
  ensureState(state);
  const age = getAgeYears(state);
  if (age < 5) return null;
  const grade = age === 5 ? "Kindergarten" : `Grade ${Math.min(age - 5, 7)}`;
  const subjects = state.education.subjects;
  const teacher = getPerson(state, "teacher");
  const friend = getPerson(state, "friend");
  const term = state.date.month <= 3 ? "Term 3 · January–April" : state.date.month <= 7 ? "Term 1 · June–August" : "Term 2 · September–December";
  return {
    grade,
    teacher: teacher?.name || "Your teacher",
    friend: friend?.name || "",
    term,
    subjects: [
      ["Mathematics", statusWord(subjects.mathematics)],
      ["Language", statusWord(subjects.language)],
      ["Science", statusWord(subjects.science)],
      ["Art", statusWord(Math.round((subjects.art + state.interests.drawing) / 2))],
      ["Physical Education", statusWord(subjects.physicalEducation)],
    ],
  };
}

export function interestSummary(state) {
  ensureState(state);
  const labels = {
    drawing: "drawing",
    reading: "reading",
    gardening: "gardening",
    cooking: "cooking",
    gaming: "games",
    music: "music",
    making: "making things",
  };
  const sorted = Object.entries(state.interests).sort((a, b) => b[1] - a[1]);
  const [key, value] = sorted[0];
  if (value < 35) return "You are still discovering what holds your attention.";
  if (value < 55) return `You have been showing some interest in ${labels[key]}.`;
  return `You have become genuinely fascinated with ${labels[key]}.`;
}

export function lifeFeeling(state) {
  ensureState(state);
  const p = state.character.personality;
  const d = state.character.development;
  const friend = getPerson(state, "friend");
  const words = [];
  if (state.health.stress > 55) words.push("overwhelmed");
  else if (d.attachment > 68 && state.health.wellbeing > 68) words.push("secure");
  else if (state.health.wellbeing > 72) words.push("safe");
  else words.push("steady");
  if (p.curiosity > 62) words.push("curious");
  else if (d.confidence > 66) words.push("more certain of yourself");
  else if (p.structure > 66) words.push("settled");
  else words.push("watchful");
  if (state.character.ageMonths >= 60 && friend && friend.closeness < 48) words.push("a little lonely");
  else if (state.character.ageMonths >= 60 && friend && friend.closeness > 72) words.push("connected");
  else if (state.health.energy < 42) words.push("tired");
  else words.push("quiet");
  return `${words[0][0].toUpperCase()}${words[0].slice(1)}, ${words[1]}, and ${words[2]}.`;
}

export function lifeOverview(state) {
  ensureState(state);
  const guardian = getPerson(state, "guardian");
  const friend = getPerson(state, "friend");
  const school = schoolSnapshot(state);
  const family = guardian && guardian.closeness > 68 ? `You feel especially close to ${guardian.name.split(" ")[0]}.` : "Family life feels familiar, with good days and difficult ones.";
  const friends = state.character.ageMonths < 60 ? "Friendships are still mostly part of the world ahead of you." : friend.closeness > 70 ? `You and ${friend.name.split(" ")[0]} have become very close.` : friend.npc?.socialWorld > 70 ? `${friend.name.split(" ")[0]} has a growing world of their own, and your friendship is finding its place inside it.` : "You know people at school, but closeness is still developing.";
  const health = state.health.energy < 45 ? "You have been getting tired easily lately." : state.health.stress > 48 ? "You have been carrying more stress than usual." : "Your health has been fairly steady lately.";
  return {
    feeling: lifeFeeling(state),
    rows: {
      family,
      school: school ? `School feels ${school.subjects.some(([, value]) => value === "Struggling") ? "uneven" : "manageable"} right now.` : "School has not begun yet.",
      friends,
      health,
      interests: interestSummary(state),
      home: `Home is ${state.household.comfort.toLowerCase()}, with ${state.household.privacy.toLowerCase()} privacy in a ${state.household.neighborhood.toLowerCase()} neighborhood.`,
    },
  };
}

export function lifeIndicators(state) {
  ensureState(state);
  const wellbeing = state.health.wellbeing >= 70 ? "Good" : state.health.wellbeing >= 52 ? "Okay" : "Low";
  const energy = state.health.energy >= 70 ? "Bright" : state.health.energy >= 48 ? "Steady" : "Tired";
  const stress = state.health.stress <= 30 ? "Calm" : state.health.stress <= 55 ? "Present" : "High";
  return { wellbeing, energy, stress };
}

export function developmentSummary(state) {
  ensureState(state);
  const d = state.character.development;
  const rows = [];
  if (d.attachment >= 68) rows.push("You generally expect close people to be there when you need them.");
  else if (d.attachment <= 42) rows.push("You have learned to be careful about depending on people.");
  if (d.confidence >= 68) rows.push("You are becoming more willing to act before you know how things will go.");
  else if (d.confidence <= 40) rows.push("You often need time, reassurance, or a familiar person before stepping forward.");
  if (d.autonomy >= 68) rows.push("Doing things for yourself has become important to you.");
  if (d.socialComfort >= 68) rows.push("New social situations have started to feel less foreign.");
  else if (d.socialComfort <= 40) rows.push("You still prefer to understand people from a safer distance first.");
  if (d.persistence >= 70) rows.push("When something matters to you, you tend to stay with it.");
  return rows.slice(0, 3);
}

export function finalChildhoodSummary(state) {
  ensureState(state);
  const traits = discoveredTraits(state).map(([name]) => name);
  const people = [...getVisiblePeople(state)].sort((a, b) => b.closeness - a.closeness);
  const closest = people[0];
  const topInterest = Object.entries(state.interests).sort((a, b) => b[1] - a[1])[0][0];
  const callbacks = state.history.filter((entry) => entry.continuity).length;
  return {
    title: `${state.character.firstName}'s childhood`,
    copy: `By thirteen, ${state.character.firstName} had become ${traits.length ? traits.join(", ").toLowerCase() : "a person still taking shape"}. ${closest ? `${closest.name} was one of the closest people in their life.` : ""} Their strongest interest was ${topInterest}. ${state.memories.length} moments became lasting memories${callbacks ? `, and ${callbacks} later moments directly echoed something that happened before` : ""}.`,
  };
}
