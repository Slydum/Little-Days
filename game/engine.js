import { eventTemplates, namePools, places } from "./content.js";

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
      personality: {
        social: randomBetween(rng, 38, 62),
        risk: randomBetween(rng, 38, 62),
        structure: randomBetween(rng, 38, 62),
        sensitivity: randomBetween(rng, 38, 62),
        curiosity: randomBetween(rng, 42, 68),
        independence: randomBetween(rng, 35, 58),
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
  const friend = getPerson(state, "friend");
  const sibling = getPerson(state, "sibling");
  const grandmother = getPerson(state, "grandmother");
  const teacher = getPerson(state, "teacher");
  const mathBase = state.education.subjects.mathematics;
  const mathScore = clamp(Math.round(52 + mathBase * 0.48 + (state.character.personality.structure - 50) * 0.12), 58, 98);
  return { guardian, friend, sibling, grandmother, teacher, mathScore };
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

function matchesRequirements(template, state) {
  const age = getAgeYears(state);
  if (age < template.age[0] || age > template.age[1]) return false;
  const requirements = template.requirements || {};
  if (requirements.hasSibling && !getPerson(state, "sibling")) return false;
  if (requirements.hasGrandmother && !getPerson(state, "grandmother")) return false;
  return true;
}

function selectEventId(state) {
  const available = eventTemplates.filter((template) => matchesRequirements(template, state));
  const fresh = available.filter((template) => !state.recentEventIds.includes(template.id));
  const pool = fresh.length ? fresh : available;
  if (!pool.length) return "family_evening";
  return pool[Math.floor(nextRandom(state) * pool.length)].id;
}

export function getCurrentEvent(state) {
  const template = eventTemplates.find((item) => item.id === state.currentEventId) || eventTemplates[0];
  return {
    id: template.id,
    category: template.category,
    title: interpolate(template.title, state),
    body: interpolate(template.body, state),
    prompt: interpolate(template.prompt, state),
    choices: template.choices.map((choice) => ({
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

function applyEffect(state, effect) {
  switch (effect.type) {
    case "personality":
      adjust(state.character.personality, effect.key, effect.delta);
      break;
    case "relationship": {
      const person = getPerson(state, effect.target);
      adjust(person, effect.key, effect.delta);
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

export function resolveChoice(state, choiceId) {
  if (state.completed || state.resolution) return state;
  const template = eventTemplates.find((item) => item.id === state.currentEventId);
  const choice = template?.choices.find((item) => item.id === choiceId);
  if (!template || !choice) return state;

  choice.effects?.forEach((effect) => applyEffect(state, effect));
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
  });

  if (choice.memory && choice.memory.importance >= 2) {
    state.memories.push({
      id: `${template.id}-${state.history.length}`,
      age: getAgeYears(state),
      date: formatGameDate(state),
      title: interpolate(choice.memory.title, state),
      copy: interpolate(choice.memory.copy, state),
      importance: choice.memory.importance,
      featured: choice.memory.importance >= 4,
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
  const age = getAgeYears(state);
  if (age < 2) return 6;
  if (age < 6) return 4;
  return 3;
}

export function continueLife(state) {
  if (state.completed || !state.resolution) return state;
  const previous = state.currentEventId;
  state.recentEventIds = [previous, ...state.recentEventIds.filter((id) => id !== previous)].slice(0, 4);
  advanceDate(state, monthsPerTurn(state));
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
  if (person.conflict > 45) return "There has been tension between you lately.";
  if (person.trust > 72 && person.closeness > 70) return "You trust them and usually feel understood around them.";
  if (person.closeness > 67) return "You naturally spend a lot of time together.";
  if (person.trust > 65) return "You feel fairly safe being yourself around them.";
  if (person.closeness < 42) return "You know each other, but there is still some distance.";
  return "The relationship is still taking shape.";
}

export function discoveredTraits(state) {
  const p = state.character.personality;
  const interests = state.interests;
  const traits = [];
  if (p.curiosity >= 62) traits.push(["Curious", "You often investigate things without being asked."]);
  if (Math.max(interests.drawing, interests.making, interests.cooking) >= 55) traits.push(["Maker", "You seem happiest when creating something with your hands or ideas."]);
  if (p.social <= 38) traits.push(["Quiet Observer", "You often understand a room before deciding how much of yourself to put into it."]);
  if (p.social >= 68) traits.push(["Social", "Being around other people often gives you energy."]);
  if (p.structure >= 69) traits.push(["Planner", "You feel better when you know what is supposed to happen next."]);
  if (p.independence >= 69) traits.push(["Independent", "You increasingly prefer solving small problems on your own."]);
  if (p.risk >= 70) traits.push(["Adventurous", "New experiences tend to pull you forward more than they scare you away."]);
  return traits.slice(0, 4);
}

export function personalityRows(state) {
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
  const p = state.character.personality;
  const friend = getPerson(state, "friend");
  const words = [];
  if (state.health.stress > 55) words.push("overwhelmed");
  else if (state.health.wellbeing > 72) words.push("safe");
  else words.push("steady");
  if (p.curiosity > 62) words.push("curious");
  else if (p.structure > 66) words.push("settled");
  else words.push("watchful");
  if (state.character.ageMonths >= 60 && friend && friend.closeness < 48) words.push("a little lonely");
  else if (state.character.ageMonths >= 60 && friend && friend.closeness > 72) words.push("connected");
  else if (state.health.energy < 42) words.push("tired");
  else words.push("quiet");
  return `${words[0][0].toUpperCase()}${words[0].slice(1)}, ${words[1]}, and ${words[2]}.`;
}

export function lifeOverview(state) {
  const guardian = getPerson(state, "guardian");
  const friend = getPerson(state, "friend");
  const school = schoolSnapshot(state);
  const family = guardian && guardian.closeness > 68 ? `You feel especially close to ${guardian.name.split(" ")[0]}.` : "Family life feels familiar, with good days and difficult ones.";
  const friends = state.character.ageMonths < 60 ? "Friendships are still mostly part of the world ahead of you." : friend.closeness > 70 ? `You and ${friend.name.split(" ")[0]} have become very close.` : "You know people at school, but closeness is still developing.";
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
  const wellbeing = state.health.wellbeing >= 70 ? "Good" : state.health.wellbeing >= 52 ? "Okay" : "Low";
  const energy = state.health.energy >= 70 ? "Bright" : state.health.energy >= 48 ? "Steady" : "Tired";
  const stress = state.health.stress <= 30 ? "Calm" : state.health.stress <= 55 ? "Present" : "High";
  return { wellbeing, energy, stress };
}

export function finalChildhoodSummary(state) {
  const traits = discoveredTraits(state).map(([name]) => name);
  const people = [...getVisiblePeople(state)].sort((a, b) => b.closeness - a.closeness);
  const closest = people[0];
  const topInterest = Object.entries(state.interests).sort((a, b) => b[1] - a[1])[0][0];
  return {
    title: `${state.character.firstName}'s childhood`,
    copy: `By thirteen, ${state.character.firstName} had become ${traits.length ? traits.join(", ").toLowerCase() : "a person still taking shape"}. ${closest ? `${closest.name} was one of the closest people in their life.` : ""} Their strongest interest was ${topInterest}. ${state.memories.length} moments became lasting memories.`,
  };
}
