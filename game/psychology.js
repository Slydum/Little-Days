const STORAGE_KEY = "little-days-save-v2";
const VERSION = 1;
const clamp = (value, min = 0, max = 100) => Math.max(min, Math.min(max, value));

const DIMENSION_LABELS = {
  attachmentSecurity: "attachment security",
  selfWorth: "self-worth",
  emotionalRegulation: "emotional regulation",
  trust: "trust",
  threatSensitivity: "threat sensitivity",
  autonomy: "autonomy",
  socialSafety: "social safety",
  shameSensitivity: "shame sensitivity",
  emotionalOpenness: "emotional openness",
  resilience: "resilience",
};

const EXPERIENCE_EFFECTS = {
  responsive_care: { attachmentSecurity: 1.7, trust: 1.5, emotionalOpenness: 0.8, resilience: 0.5, threatSensitivity: -0.6 },
  stable_caregiver: { attachmentSecurity: 1.1, trust: 1.0, resilience: 0.6, threatSensitivity: -0.7 },
  supportive_adult: { trust: 1.1, selfWorth: 0.8, resilience: 0.9, emotionalOpenness: 0.6 },
  friendship: { socialSafety: 1.2, trust: 0.7, selfWorth: 0.5, resilience: 0.5 },
  mastery: { selfWorth: 1.1, resilience: 0.8, autonomy: 0.5, shameSensitivity: -0.3 },
  emotional_validation: { selfWorth: 0.8, emotionalOpenness: 1.0, emotionalRegulation: 0.6, shameSensitivity: -0.7 },
  repair_after_conflict: { attachmentSecurity: 0.8, trust: 0.9, resilience: 0.8, threatSensitivity: -0.7 },
  predictable_routine: { emotionalRegulation: 0.7, resilience: 0.5, threatSensitivity: -0.8 },

  caregiver_unavailability: { attachmentSecurity: -1.4, trust: -1.0, emotionalOpenness: -0.7, threatSensitivity: 1.0 },
  family_conflict: { emotionalRegulation: -0.8, trust: -0.6, threatSensitivity: 1.4, attachmentSecurity: -0.4 },
  instability: { threatSensitivity: 1.3, emotionalRegulation: -0.6, attachmentSecurity: -0.5, resilience: -0.3 },
  financial_strain: { threatSensitivity: 0.6, emotionalRegulation: -0.2 },
  loss: { emotionalRegulation: -0.7, attachmentSecurity: -0.5, threatSensitivity: 0.8 },
  rejection: { socialSafety: -1.2, selfWorth: -0.8, shameSensitivity: 0.8, threatSensitivity: 0.5 },
  bullying: { socialSafety: -1.5, selfWorth: -1.0, shameSensitivity: 1.0, threatSensitivity: 0.8 },
  humiliation: { shameSensitivity: 1.4, selfWorth: -1.0, socialSafety: -0.7, emotionalOpenness: -0.5 },
  harsh_control: { autonomy: -1.0, selfWorth: -0.5, threatSensitivity: 0.9, emotionalOpenness: -0.5 },
};

const PROTECTIVE_CATEGORIES = new Set([
  "responsive_care",
  "stable_caregiver",
  "supportive_adult",
  "friendship",
  "mastery",
  "emotional_validation",
  "repair_after_conflict",
  "predictable_routine",
]);

const IMPRINT_RULES = [
  {
    id: "people_can_come",
    category: "responsive_care",
    threshold: 9,
    valence: "protective",
    belief: "Someone may come when I need help.",
  },
  {
    id: "safe_people_exist",
    category: "stable_caregiver",
    threshold: 11,
    valence: "protective",
    belief: "Some people can be steady and safe.",
  },
  {
    id: "closeness_can_be_safe",
    category: "friendship",
    threshold: 10,
    valence: "protective",
    belief: "Closeness can feel safe instead of risky.",
  },
  {
    id: "i_can_handle_hard_things",
    category: "mastery",
    threshold: 10,
    valence: "protective",
    belief: "I can get through difficult things.",
  },
  {
    id: "needs_may_wait",
    category: "caregiver_unavailability",
    threshold: 10,
    valence: "adversity",
    belief: "People may not be available when I need them.",
    buffers: ["responsive_care", "stable_caregiver", "supportive_adult"],
  },
  {
    id: "home_can_turn_unsteady",
    category: "family_conflict",
    threshold: 11,
    valence: "adversity",
    belief: "Home can become tense without much warning.",
    buffers: ["repair_after_conflict", "stable_caregiver", "predictable_routine"],
  },
  {
    id: "stability_can_disappear",
    category: "instability",
    threshold: 10,
    valence: "adversity",
    belief: "Things that feel settled can change suddenly.",
    buffers: ["stable_caregiver", "predictable_routine", "supportive_adult"],
  },
  {
    id: "belonging_is_uncertain",
    category: "rejection",
    threshold: 9,
    valence: "adversity",
    belief: "Belonging can be taken away.",
    buffers: ["friendship", "supportive_adult", "emotional_validation"],
  },
  {
    id: "people_can_hurt_me_socially",
    category: "bullying",
    threshold: 9,
    valence: "adversity",
    belief: "Other people can make being seen feel dangerous.",
    buffers: ["friendship", "supportive_adult", "emotional_validation"],
  },
  {
    id: "mistakes_feel_exposing",
    category: "humiliation",
    threshold: 9,
    valence: "adversity",
    belief: "Being wrong or noticed can feel unsafe.",
    buffers: ["emotional_validation", "supportive_adult", "mastery"],
  },
  {
    id: "security_is_fragile",
    category: "financial_strain",
    threshold: 14,
    valence: "adversity",
    belief: "Security can feel fragile when resources run short.",
    buffers: ["predictable_routine", "stable_caregiver"],
  },
  {
    id: "people_can_be_lost",
    category: "loss",
    threshold: 9,
    valence: "adversity",
    belief: "People I care about can disappear from my life.",
    buffers: ["supportive_adult", "stable_caregiver", "friendship"],
  },
];

const HISTORY_RULES = {
  held_after_crying: (entry) => [
    { kind: "protective", category: "responsive_care", intensity: entry.choiceId === "settle" ? 2.6 : 2.0 },
  ],
  first_school_day: (entry) => entry.choiceId === "friendly"
    ? [{ kind: "protective", category: "friendship", intensity: 2.0 }]
    : entry.choiceId === "front"
      ? [{ kind: "protective", category: "mastery", intensity: 1.0 }]
      : [],
  math_test: (entry) => entry.choiceId === "tell_guardian"
    ? [
        { kind: "protective", category: "supportive_adult", intensity: 1.2 },
        { kind: "protective", category: "mastery", intensity: 0.8 },
      ]
    : [],
  guardian_busy_stretch: (entry) => entry.choiceId === "tell_anyway"
    ? [{ kind: "protective", category: "repair_after_conflict", intensity: 1.8 }]
    : entry.choiceId === "keep_to_self"
      ? [{ kind: "adversity", category: "caregiver_unavailability", intensity: 1.0 }]
      : [],
  friend_quiet_lately: (entry) => ["check_in", "stay_near"].includes(entry.choiceId)
    ? [{ kind: "protective", category: "friendship", intensity: 1.0 }]
    : [],
  presentation_second_chance_steady: (entry) => entry.choiceId === "trust_yourself"
    ? [{ kind: "protective", category: "mastery", intensity: 1.8 }]
    : [],
  presentation_second_chance_fast: (entry) => ["try_slower", "ask_teacher"].includes(entry.choiceId)
    ? [{ kind: "protective", category: "mastery", intensity: 1.5 }]
    : [],
};

function initialDimensions(state) {
  const p = state.character?.personality || {};
  const d = state.character?.development || {};
  const caregivers = livingCaregivers(state);
  const averageTrust = average(caregivers.map((person) => person.trust ?? 55), 55);
  return {
    attachmentSecurity: clamp(d.attachment ?? 56),
    selfWorth: clamp(d.confidence ?? Math.round(48 + ((p.social ?? 50) - 50) * 0.12)),
    emotionalRegulation: clamp(d.emotionalRegulation ?? Math.round(55 - ((p.sensitivity ?? 50) - 50) * 0.18)),
    trust: clamp(Math.round((averageTrust + (d.attachment ?? 56)) / 2)),
    threatSensitivity: clamp(Math.round(48 + ((p.sensitivity ?? 50) - 50) * 0.45 + ((state.health?.stress ?? 20) - 20) * 0.2)),
    autonomy: clamp(d.autonomy ?? Math.round(45 + ((p.independence ?? 50) - 50) * 0.25)),
    socialSafety: clamp(d.socialComfort ?? Math.round(48 + ((p.social ?? 50) - 50) * 0.3)),
    shameSensitivity: clamp(Math.round(48 + ((p.sensitivity ?? 50) - 50) * 0.25 - ((d.confidence ?? 50) - 50) * 0.18)),
    emotionalOpenness: clamp(Math.round(50 + ((p.social ?? 50) - 50) * 0.18 + ((d.attachment ?? 56) - 50) * 0.18)),
    resilience: clamp(Math.round(((d.emotionalRegulation ?? 55) + (d.persistence ?? 50)) / 2)),
  };
}

function average(values, fallback = 0) {
  if (!values.length) return fallback;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function livingCaregivers(state) {
  const age = state.character?.ageMonths ?? 0;
  return (state.people || []).filter((person) => {
    if (person.deceased || (person.introducedAtMonths || 0) > age) return false;
    return person.family?.caregiver === true || ["guardian", "secondGuardian"].includes(person.role);
  });
}

function exposureBucket(state, kind, category) {
  const collection = kind === "protective" ? state.psychology.exposures.protective : state.psychology.exposures.adversity;
  collection[category] ||= { score: 0, episodes: 0, firstAgeMonths: null, lastAgeMonths: null, sources: [] };
  return collection[category];
}

function exposureScore(state, category) {
  const collection = PROTECTIVE_CATEGORIES.has(category) ? state.psychology.exposures.protective : state.psychology.exposures.adversity;
  return collection[category]?.score || 0;
}

function effectiveImprintScore(state, rule) {
  const raw = exposureScore(state, rule.category);
  if (rule.valence !== "adversity" || !rule.buffers?.length) return raw;
  const buffer = rule.buffers.reduce((sum, category) => sum + exposureScore(state, category), 0);
  return Math.max(0, raw - buffer * 0.42);
}

function updateImprints(state, changedCategory, source) {
  for (const rule of IMPRINT_RULES) {
    const existing = state.psychology.imprints.find((item) => item.id === rule.id);
    const effective = effectiveImprintScore(state, rule);
    if (!existing && effective < rule.threshold) continue;

    if (!existing) {
      state.psychology.imprints.push({
        id: rule.id,
        belief: rule.belief,
        valence: rule.valence,
        strength: clamp(18 + (effective - rule.threshold) * 2.4),
        firstAgeMonths: state.character?.ageMonths || 0,
        lastAgeMonths: state.character?.ageMonths || 0,
        reinforcements: changedCategory === rule.category ? 1 : 0,
        buffers: 0,
        sources: source ? [source] : [],
      });
      continue;
    }

    const targetStrength = clamp(18 + Math.max(0, effective - rule.threshold) * 2.4);
    if (rule.valence === "adversity" && rule.buffers?.includes(changedCategory)) {
      existing.buffers = (existing.buffers || 0) + 1;
      existing.strength = clamp(Math.min(existing.strength, targetStrength) - 1.2, 6, 100);
    } else if (changedCategory === rule.category) {
      existing.reinforcements = (existing.reinforcements || 0) + 1;
      existing.strength = clamp(Math.max(existing.strength, targetStrength) + 0.4, 0, 100);
    } else {
      existing.strength = clamp(existing.strength * 0.86 + targetStrength * 0.14, 0, 100);
    }
    existing.lastAgeMonths = state.character?.ageMonths || 0;
    if (source && !existing.sources.includes(source)) existing.sources = [...existing.sources, source].slice(-8);
  }

  state.psychology.imprints.sort((a, b) => b.strength - a.strength);
}

function applyDimensionEffects(state, kind, category, intensity) {
  const effects = EXPERIENCE_EFFECTS[category];
  if (!effects) return;
  const sensitivity = state.character?.personality?.sensitivity ?? 50;
  const resilience = state.psychology.dimensions.resilience ?? 50;
  const adversityMultiplier = clamp(0.86 + sensitivity / 500 - resilience / 900, 0.72, 1.18);
  const protectiveMultiplier = clamp(0.92 + resilience / 800, 0.9, 1.08);
  const multiplier = kind === "adversity" ? adversityMultiplier : protectiveMultiplier;

  for (const [key, vector] of Object.entries(effects)) {
    if (typeof state.psychology.dimensions[key] !== "number") continue;
    const delta = vector * intensity * 0.5 * multiplier;
    state.psychology.dimensions[key] = clamp(state.psychology.dimensions[key] + delta);
  }
}

export function ensurePsychologyState(state) {
  if (!state?.character) return state;
  state.psychology ||= {
    version: VERSION,
    dimensions: initialDimensions(state),
    exposures: { adversity: {}, protective: {} },
    imprints: [],
    processedHistoryKeys: [],
    processedWorldEventKeys: [],
    originProcessed: false,
    lastAmbientAgeMonths: null,
  };
  state.psychology.version = VERSION;
  state.psychology.dimensions ||= initialDimensions(state);
  state.psychology.exposures ||= { adversity: {}, protective: {} };
  state.psychology.exposures.adversity ||= {};
  state.psychology.exposures.protective ||= {};
  state.psychology.imprints ||= [];
  state.psychology.processedHistoryKeys ||= [];
  state.psychology.processedWorldEventKeys ||= [];
  state.psychology.originProcessed ??= false;
  state.psychology.lastAmbientAgeMonths ??= null;
  return state;
}

export function recordPsychologicalExperience(state, experience) {
  ensurePsychologyState(state);
  if (!experience?.category || !EXPERIENCE_EFFECTS[experience.category]) return state;
  const kind = experience.kind || (PROTECTIVE_CATEGORIES.has(experience.category) ? "protective" : "adversity");
  const intensity = clamp(Number(experience.intensity) || 1, 0.25, 5);
  const bucket = exposureBucket(state, kind, experience.category);
  const ageMonths = state.character?.ageMonths || 0;
  const source = String(experience.source || experience.sourceId || experience.category);

  bucket.score = clamp(bucket.score + intensity, 0, 100);
  bucket.episodes += 1;
  bucket.firstAgeMonths ??= ageMonths;
  bucket.lastAgeMonths = ageMonths;
  if (!bucket.sources.includes(source)) bucket.sources = [...bucket.sources, source].slice(-10);

  applyDimensionEffects(state, kind, experience.category, intensity);
  updateImprints(state, experience.category, source);
  return state;
}

function processOrigin(state) {
  if (state.psychology.originProcessed) return;
  const origin = String(state.family?.originStory || "").toLowerCase();
  if (origin.includes("abandoned shortly after birth") || origin.includes("found abandoned")) {
    recordPsychologicalExperience(state, { kind: "adversity", category: "caregiver_unavailability", intensity: 4, source: "early abandonment" });
    recordPsychologicalExperience(state, { kind: "adversity", category: "instability", intensity: 2.5, source: "early placement change" });
  } else if (origin.includes("entered foster care") || origin.includes("placed with foster")) {
    recordPsychologicalExperience(state, { kind: "adversity", category: "instability", intensity: 1.8, source: "early foster placement" });
  }
  // Adoption, single-parent homes, parental separation before birth, and bereavement before birth
  // are not treated as trauma by default. The lived caregiving environment determines later effects.
  state.psychology.originProcessed = true;
}

function explicitHistoryExperiences(entry) {
  const rule = HISTORY_RULES[entry.eventId];
  return rule ? rule(entry) : [];
}

function classifyNarrative(text) {
  const value = String(text || "").toLowerCase();
  const experiences = [];
  const add = (kind, category, intensity) => experiences.push({ kind, category, intensity });

  if (/\baffair\b|hurt and angry|less steady/.test(value)) add("adversity", "family_conflict", 2.8);
  if (/decide to separate|relationship ended|where people live now|move out|moved out/.test(value)) add("adversity", "instability", 2.8);
  if (/cannot take care|can't take care|unable to care|caregiving change|care has to be worked out|new caregiver/.test(value)) add("adversity", "caregiver_unavailability", 2.4);
  if (/\bdied\b|passed away|death of/.test(value) && !/before you were born/.test(value)) add("adversity", "loss", 2.8);
  if (/evicted|lost the home|cannot afford rent|can't afford rent/.test(value)) {
    add("adversity", "financial_strain", 2.8);
    add("adversity", "instability", 1.8);
  } else if (/lost (his|her|their|a) job|money is tight|bills are piling/.test(value)) {
    add("adversity", "financial_strain", 1.8);
  }
  if (/bullied|picked on|keeps mocking|made fun of you/.test(value)) add("adversity", "bullying", 2.6);
  if (/excluded you|left you out|doesn't want you there|didn't invite you/.test(value)) add("adversity", "rejection", 1.8);
  if (/laughed at you|humiliated|embarrassed you in front/.test(value)) add("adversity", "humiliation", 2.2);

  return experiences;
}

function historyKey(entry, index) {
  return `${entry.eventId || "event"}:${entry.choiceId || "choice"}:${entry.ageMonths ?? "?"}:${index}`;
}

function worldEventKey(entry, index) {
  const text = String(entry.text || entry.note || "").slice(0, 120);
  return `${entry.ageMonths ?? "?"}:${entry.category || "World"}:${text}:${index}`;
}

function processHistory(state) {
  const processed = new Set(state.psychology.processedHistoryKeys);
  for (const [index, entry] of (state.history || []).entries()) {
    const key = historyKey(entry, index);
    if (processed.has(key)) continue;
    const explicit = explicitHistoryExperiences(entry);
    const experiences = explicit.length ? explicit : classifyNarrative(`${entry.title || ""} ${entry.result || ""}`);
    for (const experience of experiences) {
      recordPsychologicalExperience(state, { ...experience, source: `choice:${entry.eventId || "event"}:${entry.choiceId || "choice"}` });
    }
    processed.add(key);
  }
  state.psychology.processedHistoryKeys = [...processed].slice(-240);
}

function processWorldEvents(state) {
  const processed = new Set(state.psychology.processedWorldEventKeys);
  for (const [index, entry] of (state.worldEvents || []).entries()) {
    const key = worldEventKey(entry, index);
    if (processed.has(key)) continue;
    const experiences = classifyNarrative(`${entry.text || ""} ${entry.note || ""}`);
    for (const experience of experiences) {
      recordPsychologicalExperience(state, { ...experience, source: `world:${entry.category || "event"}` });
    }
    processed.add(key);
  }
  state.psychology.processedWorldEventKeys = [...processed].slice(-260);
}

function processAmbientEnvironment(state) {
  const ageMonths = state.character?.ageMonths || 0;
  if (state.psychology.lastAmbientAgeMonths === ageMonths) return;
  state.psychology.lastAmbientAgeMonths = ageMonths;

  const caregivers = livingCaregivers(state);
  if (caregivers.length) {
    const trust = average(caregivers.map((person) => person.trust ?? 55), 55);
    const affection = average(caregivers.map((person) => person.affection ?? 60), 60);
    const availability = average(caregivers.map((person) => person.npc?.availability ?? 65), 65);
    if (trust >= 58 && affection >= 60 && availability >= 58) {
      recordPsychologicalExperience(state, { kind: "protective", category: "stable_caregiver", intensity: 0.8, source: "ongoing caregiving" });
    }
    if (availability < 42 || trust < 38 || affection < 40) {
      recordPsychologicalExperience(state, { kind: "adversity", category: "caregiver_unavailability", intensity: 0.8, source: "ongoing caregiver strain" });
    }
  }

  const atmosphere = state.realism?.family?.atmosphere;
  if (typeof atmosphere === "number") {
    if (atmosphere < 38) recordPsychologicalExperience(state, { kind: "adversity", category: "family_conflict", intensity: 0.8, source: "ongoing home tension" });
    if (atmosphere > 68) recordPsychologicalExperience(state, { kind: "protective", category: "predictable_routine", intensity: 0.7, source: "steady home atmosphere" });
  }

  if (state.household?.financeBand === "Tight" && (state.household?.savings ?? 0) < 3000) {
    // Poverty itself is not treated as trauma. This only represents recurring insecurity when resources are extremely thin.
    recordPsychologicalExperience(state, { kind: "adversity", category: "financial_strain", intensity: 0.45, source: "recurring resource insecurity" });
  }

  if (ageMonths >= 60) {
    const closeFriend = (state.people || []).find((person) => person.role === "friend" && !person.deceased && (person.closeness ?? 0) >= 68 && (person.trust ?? 0) >= 64);
    if (closeFriend) recordPsychologicalExperience(state, { kind: "protective", category: "friendship", intensity: 0.7, source: `steady friendship:${closeFriend.id}` });
  }

  const supportiveRelative = (state.people || []).find((person) => ["grandmother", "grandfather", "aunt", "uncle"].includes(person.role) && !person.deceased && (person.trust ?? 0) >= 65 && (person.affection ?? 0) >= 65);
  if (supportiveRelative) recordPsychologicalExperience(state, { kind: "protective", category: "supportive_adult", intensity: 0.6, source: `supportive relative:${supportiveRelative.id}` });
}

function mirrorLegacyDevelopment(state) {
  const d = state.character?.development;
  if (!d) return;
  d.attachment = clamp(d.attachment * 0.82 + state.psychology.dimensions.attachmentSecurity * 0.18);
  d.confidence = clamp(d.confidence * 0.86 + state.psychology.dimensions.selfWorth * 0.14);
  d.emotionalRegulation = clamp(d.emotionalRegulation * 0.84 + state.psychology.dimensions.emotionalRegulation * 0.16);
  d.autonomy = clamp(d.autonomy * 0.88 + state.psychology.dimensions.autonomy * 0.12);
  d.socialComfort = clamp(d.socialComfort * 0.86 + state.psychology.dimensions.socialSafety * 0.14);
}

export function syncPsychologicalDevelopment(state) {
  ensurePsychologyState(state);
  processOrigin(state);
  processHistory(state);
  processWorldEvents(state);
  processAmbientEnvironment(state);
  mirrorLegacyDevelopment(state);
  return state;
}

function dominantObservation(dimensions) {
  const observations = [];
  if (dimensions.attachmentSecurity >= 64) observations.push("You generally expect familiar people to be there when you need them.");
  else if (dimensions.attachmentSecurity <= 42) observations.push("You are becoming careful about depending too heavily on other people.");

  if (dimensions.threatSensitivity >= 64) observations.push("You notice changes in mood, tension, and uncertainty quickly.");
  else if (dimensions.threatSensitivity <= 38) observations.push("Familiar situations usually feel predictable enough to relax into.");

  if (dimensions.socialSafety >= 64) observations.push("Being around people you know is starting to feel naturally safe.");
  else if (dimensions.socialSafety <= 42) observations.push("You often watch a social situation carefully before deciding whether you feel safe in it.");

  if (dimensions.emotionalOpenness >= 64) observations.push("It is becoming easier to let trusted people know what you need or feel.");
  else if (dimensions.emotionalOpenness <= 42) observations.push("Keeping feelings private often seems easier than explaining them.");

  if (dimensions.resilience >= 66) observations.push("Difficult moments tend to shake you without defining the whole day.");
  else if (dimensions.emotionalRegulation <= 42) observations.push("Big feelings can take a while to settle once they arrive.");

  return observations.slice(0, 4);
}

const EXPERIENCE_LABELS = {
  responsive_care: "responsive care",
  stable_caregiver: "steady caregiving",
  supportive_adult: "supportive adults",
  friendship: "safe friendships",
  mastery: "successful challenges",
  emotional_validation: "being listened to",
  repair_after_conflict: "repair after difficult moments",
  predictable_routine: "predictable routines",
  caregiver_unavailability: "caregiver unavailability",
  family_conflict: "family tension",
  instability: "changes in stability",
  financial_strain: "resource insecurity",
  loss: "loss",
  rejection: "social rejection",
  bullying: "bullying",
  humiliation: "humiliation",
  harsh_control: "harsh control",
};

export function psychologySnapshot(state) {
  ensurePsychologyState(state);
  const observations = dominantObservation(state.psychology.dimensions);
  const formative = state.psychology.imprints
    .filter((item) => item.strength >= 22)
    .slice(0, 4)
    .map((item) => ({ belief: item.belief, valence: item.valence, strength: item.strength }));
  const protective = Object.entries(state.psychology.exposures.protective)
    .sort((a, b) => b[1].score - a[1].score)
    .filter(([, value]) => value.score >= 3)
    .slice(0, 3)
    .map(([category]) => EXPERIENCE_LABELS[category] || category);
  return { observations, formative, protective };
}

function readPersistedState() {
  try {
    const state = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return state?.version === 2 ? state : null;
  } catch {
    return null;
  }
}

function writePersistedState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function renderSelfPanel() {
  if (typeof document === "undefined" || location.hash.replace("#", "") !== "self") return;
  const screen = document.querySelector(".screen");
  if (!screen || screen.querySelector(".psychology-phase1-panel")) return;
  const state = readPersistedState();
  if (!state) return;
  syncPsychologicalDevelopment(state);
  const snapshot = psychologySnapshot(state);
  const observations = snapshot.observations.length
    ? snapshot.observations.map((copy) => `<div class="psychology-observation"><p>${copy}</p></div>`).join("")
    : `<p class="psychology-muted">Your inner patterns are still too early to describe clearly.</p>`;
  const formative = snapshot.formative.length
    ? `<h3>Patterns taking shape</h3>${snapshot.formative.map((item) => `<p class="psychology-imprint">${item.belief}</p>`).join("")}`
    : "";
  const protective = snapshot.protective.length
    ? `<p class="psychology-anchors"><strong>Steadying influences</strong><br>${snapshot.protective.join(" · ")}</p>`
    : "";

  screen.insertAdjacentHTML("beforeend", `
    <style>
      .psychology-phase1-panel{margin-top:22px;padding-top:18px;border-top:1px solid var(--line)}
      .psychology-phase1-panel h2{margin:0 0 10px;font-family:var(--serif);font-size:18px;font-weight:500}
      .psychology-phase1-panel h3{margin:18px 0 7px;font-family:var(--serif);font-size:14px;font-weight:500}
      .psychology-observation{padding:8px 0;border-top:1px solid var(--line)}
      .psychology-observation p,.psychology-imprint,.psychology-muted,.psychology-anchors{margin:0;font-size:11px;line-height:1.5}
      .psychology-imprint{padding:7px 0;color:var(--muted);font-family:var(--serif);font-style:italic}
      .psychology-anchors{margin-top:15px;color:var(--muted)}
      .psychology-note{margin:14px 0 0;color:var(--muted);font-size:9px;line-height:1.45}
    </style>
    <section class="psychology-phase1-panel">
      <h2>Inner development</h2>
      ${observations}
      ${formative}
      ${protective}
      <p class="psychology-note">These are developing tendencies, not diagnoses. Difficult experiences can be buffered, repaired, or changed by what happens later.</p>
    </section>
  `);
}

let bridgeInstalled = false;
let syncTimer = null;

function syncPersistedState() {
  if (typeof localStorage === "undefined") return;
  const state = readPersistedState();
  if (!state) return;
  const before = JSON.stringify(state.psychology || null);
  syncPsychologicalDevelopment(state);
  const after = JSON.stringify(state.psychology || null);
  if (before !== after) writePersistedState(state);
}

function scheduleBridgeSync(delay = 0) {
  if (syncTimer) clearTimeout(syncTimer);
  syncTimer = setTimeout(() => {
    syncTimer = null;
    syncPersistedState();
    renderSelfPanel();
  }, delay);
}

export function installPsychologyBridge() {
  if (bridgeInstalled || typeof document === "undefined") return;
  bridgeInstalled = true;
  syncPersistedState();
  renderSelfPanel();

  document.addEventListener("click", (event) => {
    const target = event.target.closest?.("[data-choice],[data-childhood-choice],[data-context-choice],#continue-life");
    if (!target) return;
    scheduleBridgeSync(35);
  });
  window.addEventListener("hashchange", () => scheduleBridgeSync(0));
  const app = document.querySelector("#app");
  if (app) new MutationObserver(() => renderSelfPanel()).observe(app, { childList: true, subtree: true });
}

export { DIMENSION_LABELS, EXPERIENCE_EFFECTS };
