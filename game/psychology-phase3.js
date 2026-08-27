import {
  ensurePsychologyPhase2State,
  syncPsychologyPhase2,
} from "./psychology-phase2.js";

const STORAGE_KEY = "little-days-save-v2";
const VERSION = 1;
const clamp = (value, min = 0, max = 100) => Math.max(min, Math.min(max, value));

const SYMPTOM_DEFINITIONS = {
  persistentWorry: "Worry has been taking up more room than it used to.",
  lowMood: "Low or heavy moods have been lingering instead of passing quickly.",
  lossOfInterest: "Things you normally care about can feel harder to enjoy when you are struggling.",
  socialFear: "Being judged, rejected, or noticed can feel unusually threatening.",
  sleepDisruption: "Sleep has been less restorative when emotional strain is high.",
  physicalTension: "Emotional strain sometimes shows up as tension or discomfort in your body.",
  concentrationDifficulty: "Concentrating can become harder when your mind is carrying too much at once.",
  irritability: "Irritability can surface before you have words for what is wrong.",
};

const CONDITION_DEFINITIONS = {
  generalizedAnxiety: {
    label: "Generalized anxiety disorder",
    minimumAgeMonths: 168,
    minimumMonths: 6,
    minimumImpact: 34,
    primarySymptoms: ["persistentWorry", "sleepDisruption", "physicalTension", "concentrationDifficulty"],
  },
  depressiveEpisode: {
    label: "Depressive disorder",
    minimumAgeMonths: 168,
    minimumMonths: 3,
    minimumImpact: 38,
    primarySymptoms: ["lowMood", "lossOfInterest", "sleepDisruption", "concentrationDifficulty"],
  },
  socialAnxiety: {
    label: "Social anxiety disorder",
    minimumAgeMonths: 168,
    minimumMonths: 6,
    minimumImpact: 34,
    primarySymptoms: ["socialFear", "physicalTension", "concentrationDifficulty"],
  },
  traumaRelated: {
    label: "Trauma- and stressor-related disorder",
    minimumAgeMonths: 168,
    minimumMonths: 3,
    minimumImpact: 38,
    primarySymptoms: ["persistentWorry", "sleepDisruption", "physicalTension", "irritability"],
  },
  adjustmentDifficulties: {
    label: "Adjustment disorder",
    minimumAgeMonths: 156,
    minimumMonths: 3,
    minimumImpact: 32,
    primarySymptoms: ["persistentWorry", "lowMood", "sleepDisruption", "concentrationDifficulty"],
  },
};

const CARE_LABELS = {
  trustedConversation: "talked with someone you trust",
  schoolCounseling: "school counseling",
  therapy: "therapy",
  professionalEvaluation: "professional evaluation",
  medication: "clinician-managed medication",
};

function seededUnit(seed, salt) {
  let value = ((Number(seed) || 1) ^ salt) >>> 0;
  value = (value * 1664525 + 1013904223) >>> 0;
  value = (value * 1664525 + 1013904223) >>> 0;
  return value / 4294967296;
}

function initialVulnerability(state) {
  const seed = Number(state.seed) || 1;
  return {
    anxiety: 0.82 + seededUnit(seed, 0x31a5) * 0.36,
    depression: 0.82 + seededUnit(seed, 0x72c9) * 0.36,
    socialAnxiety: 0.82 + seededUnit(seed, 0x4f17) * 0.36,
    stressResponse: 0.82 + seededUnit(seed, 0x8bd3) * 0.36,
  };
}

function makeSymptom(id) {
  return {
    id,
    intensity: 0,
    monthsElevated: 0,
    episodes: 0,
    firstElevatedAtMonths: null,
    lastElevatedAtMonths: null,
  };
}

function makeCondition(id) {
  return {
    id,
    status: "none",
    likelihood: 0,
    firstEligibleAtMonths: null,
    recognizedAtMonths: null,
    diagnosedAtMonths: null,
    remissionAtMonths: null,
    relapseCount: 0,
    monthsBelowThreshold: 0,
  };
}

export function ensurePsychologyPhase3State(state) {
  ensurePsychologyPhase2State(state);
  state.psychology.mentalHealth ||= {
    version: VERSION,
    vulnerabilities: initialVulnerability(state),
    symptoms: Object.fromEntries(Object.keys(SYMPTOM_DEFINITIONS).map((id) => [id, makeSymptom(id)])),
    conditions: Object.fromEntries(Object.keys(CONDITION_DEFINITIONS).map((id) => [id, makeCondition(id)])),
    functionalImpact: { school: 0, relationships: 0, dailyLife: 0, overall: 0 },
    care: {
      history: [],
      supportStrength: 0,
      therapyUntilMonths: null,
      medicationUntilMonths: null,
      schoolSupportUntilMonths: null,
    },
    lastSampleAgeMonths: null,
    recognized: false,
    recognizedAtMonths: null,
  };
  const mental = state.psychology.mentalHealth;
  mental.version = VERSION;
  mental.vulnerabilities ||= initialVulnerability(state);
  mental.symptoms ||= {};
  mental.conditions ||= {};
  mental.functionalImpact ||= { school: 0, relationships: 0, dailyLife: 0, overall: 0 };
  mental.care ||= { history: [], supportStrength: 0, therapyUntilMonths: null, medicationUntilMonths: null, schoolSupportUntilMonths: null };
  mental.care.history ||= [];
  mental.care.supportStrength ??= 0;
  mental.lastSampleAgeMonths ??= null;
  mental.recognized ??= false;
  mental.recognizedAtMonths ??= null;
  for (const id of Object.keys(SYMPTOM_DEFINITIONS)) mental.symptoms[id] ||= makeSymptom(id);
  for (const id of Object.keys(CONDITION_DEFINITIONS)) mental.conditions[id] ||= makeCondition(id);
  return state;
}

function copingScore(state, id) {
  return state.psychology.coping?.patterns?.[id]?.score || 0;
}

function signalScore(state, id) {
  return state.psychology.coping?.signals?.[id]?.intensity || 0;
}

function adversityScore(state, category) {
  return state.psychology.exposures?.adversity?.[category]?.score || 0;
}

function recentAdversity(state, withinMonths = 12) {
  const age = state.character?.ageMonths || 0;
  return Object.values(state.psychology.exposures?.adversity || {}).some((bucket) => bucket?.lastAgeMonths != null && age - bucket.lastAgeMonths <= withinMonths && (bucket.score || 0) >= 2);
}

function strongAdversityHistory(state) {
  const categories = ["loss", "family_conflict", "instability", "bullying", "caregiver_unavailability", "harsh_control"];
  return categories.reduce((sum, id) => sum + adversityScore(state, id), 0);
}

function activeCareBuffer(state) {
  const age = state.character?.ageMonths || 0;
  const care = state.psychology.mentalHealth.care;
  let buffer = Math.min(12, (care.supportStrength || 0) * 0.22);
  if ((care.therapyUntilMonths || -1) >= age) buffer += 8;
  if ((care.medicationUntilMonths || -1) >= age) buffer += 6;
  if ((care.schoolSupportUntilMonths || -1) >= age) buffer += 4;
  return buffer;
}

function symptomTargets(state) {
  const d = state.psychology.dimensions || {};
  const health = state.health || {};
  const stress = health.stress ?? 20;
  const wellbeing = health.wellbeing ?? 70;
  const energy = health.energy ?? 70;
  const vulnerability = state.psychology.mentalHealth.vulnerabilities;
  const careBuffer = activeCareBuffer(state);
  const adaptive = ["helpSeeking", "emotionalExpression", "selfSoothing", "problemSolving", "socialApproach"]
    .reduce((sum, id) => sum + copingScore(state, id), 0) / 5;
  const withdrawal = copingScore(state, "withdrawal");
  const avoidance = copingScore(state, "avoidance");
  const reassurance = copingScore(state, "reassuranceSeeking");
  const perfectionism = copingScore(state, "perfectionism");
  const suppression = copingScore(state, "suppression");
  const resilience = d.resilience ?? 50;
  const generalBuffer = adaptive * 0.1 + resilience * 0.08 + careBuffer;

  const worry = clamp((stress * 0.5 + (d.threatSensitivity ?? 50) * 0.46 + reassurance * 0.22 + perfectionism * 0.15 - 28 - generalBuffer) * vulnerability.anxiety);
  const lowMood = clamp((stress * 0.38 + Math.max(0, 58 - (d.selfWorth ?? 50)) * 0.7 + withdrawal * 0.22 + suppression * 0.12 + Math.max(0, 66 - wellbeing) * 0.5 - 15 - generalBuffer * 0.78) * vulnerability.depression);
  const lossOfInterest = clamp((lowMood * 0.64 + withdrawal * 0.28 + Math.max(0, 62 - energy) * 0.4 - 10 - adaptive * 0.07) * vulnerability.depression);
  const socialFear = clamp((Math.max(0, 62 - (d.socialSafety ?? 50)) * 0.78 + (d.shameSensitivity ?? 50) * 0.3 + avoidance * 0.3 + withdrawal * 0.32 + stress * 0.22 - 22 - generalBuffer * 0.72) * vulnerability.socialAnxiety);

  return {
    persistentWorry: worry,
    lowMood,
    lossOfInterest,
    socialFear,
    sleepDisruption: clamp(signalScore(state, "sleepRestlessness") * 0.82 + worry * 0.2 - careBuffer * 0.45),
    physicalTension: clamp(signalScore(state, "physicalStress") * 0.82 + worry * 0.18 - careBuffer * 0.4),
    concentrationDifficulty: clamp(signalScore(state, "concentrationStrain") * 0.78 + worry * 0.12 + lowMood * 0.12 - careBuffer * 0.35),
    irritability: clamp(signalScore(state, "irritability") * 0.82 + stress * 0.12 - careBuffer * 0.35),
  };
}

function updateSymptoms(state, elapsedMonths) {
  const mental = state.psychology.mentalHealth;
  const targets = symptomTargets(state);
  const age = state.character?.ageMonths || 0;
  for (const [id, target] of Object.entries(targets)) {
    const symptom = mental.symptoms[id];
    const before = symptom.intensity;
    symptom.intensity = clamp(before * 0.58 + target * 0.42);
    if (symptom.intensity >= 48) {
      symptom.monthsElevated += elapsedMonths;
      symptom.firstElevatedAtMonths ??= age;
      symptom.lastElevatedAtMonths = age;
      if (before < 48) symptom.episodes += 1;
    } else if (symptom.intensity < 34) {
      symptom.monthsElevated = Math.max(0, symptom.monthsElevated - elapsedMonths * 0.75);
    }
  }
}

function updateFunctionalImpact(state) {
  const s = state.psychology.mentalHealth.symptoms;
  const school = clamp((s.concentrationDifficulty.intensity * 0.46 + s.sleepDisruption.intensity * 0.24 + s.persistentWorry.intensity * 0.18 + s.lowMood.intensity * 0.12) - 16);
  const relationships = clamp((s.socialFear.intensity * 0.48 + s.irritability.intensity * 0.2 + s.lowMood.intensity * 0.18 + s.persistentWorry.intensity * 0.14) - 15);
  const dailyLife = clamp((s.lowMood.intensity * 0.28 + s.lossOfInterest.intensity * 0.26 + s.sleepDisruption.intensity * 0.2 + s.physicalTension.intensity * 0.14 + s.persistentWorry.intensity * 0.12) - 14);
  state.psychology.mentalHealth.functionalImpact = {
    school,
    relationships,
    dailyLife,
    overall: clamp((school + relationships + dailyLife) / 3),
  };
}

function averageSymptom(state, ids) {
  return ids.reduce((sum, id) => sum + (state.psychology.mentalHealth.symptoms[id]?.intensity || 0), 0) / ids.length;
}

function minimumDuration(state, ids) {
  return Math.min(...ids.map((id) => state.psychology.mentalHealth.symptoms[id]?.monthsElevated || 0));
}

function conditionLikelihood(state, id) {
  const def = CONDITION_DEFINITIONS[id];
  const mental = state.psychology.mentalHealth;
  const symptoms = mental.symptoms;
  const base = averageSymptom(state, def.primarySymptoms);
  const impact = mental.functionalImpact.overall;
  if (id === "generalizedAnxiety") return clamp(base * 0.82 + symptoms.persistentWorry.intensity * 0.18 + impact * 0.2 - 10);
  if (id === "depressiveEpisode") return clamp(base * 0.76 + symptoms.lowMood.intensity * 0.18 + symptoms.lossOfInterest.intensity * 0.18 + impact * 0.18 - 12);
  if (id === "socialAnxiety") return clamp(base * 0.72 + symptoms.socialFear.intensity * 0.32 + impact * 0.2 - 10);
  if (id === "traumaRelated") {
    const adversity = Math.min(30, strongAdversityHistory(state) * 0.45);
    return clamp(base * 0.7 + impact * 0.22 + adversity - 12);
  }
  if (id === "adjustmentDifficulties") {
    if (!recentAdversity(state, 9)) return clamp(base * 0.45 + impact * 0.15 - 18);
    return clamp(base * 0.72 + impact * 0.28 + 8);
  }
  return 0;
}

function conditionEligible(state, id) {
  const def = CONDITION_DEFINITIONS[id];
  const age = state.character?.ageMonths || 0;
  if (age < def.minimumAgeMonths) return false;
  const mental = state.psychology.mentalHealth;
  if (mental.functionalImpact.overall < def.minimumImpact) return false;
  if (minimumDuration(state, def.primarySymptoms) < def.minimumMonths) return false;
  if (id === "traumaRelated" && strongAdversityHistory(state) < 12) return false;
  if (id === "adjustmentDifficulties" && !recentAdversity(state, 9)) return false;
  return conditionLikelihood(state, id) >= 48;
}

function updateConditions(state, elapsedMonths) {
  const mental = state.psychology.mentalHealth;
  const age = state.character?.ageMonths || 0;
  for (const id of Object.keys(CONDITION_DEFINITIONS)) {
    const condition = mental.conditions[id];
    condition.likelihood = conditionLikelihood(state, id);
    const eligible = conditionEligible(state, id);

    if (["diagnosed", "active"].includes(condition.status)) {
      if (condition.likelihood < 34 && mental.functionalImpact.overall < 28) {
        condition.monthsBelowThreshold += elapsedMonths;
        if (condition.monthsBelowThreshold >= 6) {
          condition.status = "remission";
          condition.remissionAtMonths = age;
        }
      } else {
        condition.monthsBelowThreshold = 0;
        condition.status = "active";
      }
      continue;
    }

    if (condition.status === "remission") {
      if (eligible && condition.likelihood >= 54) {
        condition.status = "active";
        condition.relapseCount += 1;
        condition.monthsBelowThreshold = 0;
      }
      continue;
    }

    if (eligible) {
      condition.firstEligibleAtMonths ??= age;
      if (condition.status === "none") condition.status = "emerging";
    } else if (condition.status === "emerging" && condition.likelihood < 38) {
      condition.status = "none";
    }
  }
}

function updateRecognition(state) {
  const mental = state.psychology.mentalHealth;
  const age = state.character?.ageMonths || 0;
  if (age < 132 || mental.recognized) return;
  const highSymptoms = Object.values(mental.symptoms).filter((item) => item.intensity >= 56 && item.monthsElevated >= 3).length;
  const helpSeeking = copingScore(state, "helpSeeking");
  const supportiveCare = mental.care.supportStrength || 0;
  if (mental.functionalImpact.overall >= 42 && highSymptoms >= 2 && (helpSeeking >= 12 || supportiveCare >= 5 || age >= 156)) {
    mental.recognized = true;
    mental.recognizedAtMonths = age;
  }
}

function processCareFromHistory(state) {
  const mental = state.psychology.mentalHealth;
  mental.processedCareHistoryKeys ||= [];
  const processed = new Set(mental.processedCareHistoryKeys);
  for (const [index, entry] of (state.history || []).entries()) {
    const text = `${entry.eventId || ""} ${entry.choiceId || ""} ${entry.choice || ""} ${entry.result || ""}`.toLowerCase();
    const key = `${entry.ageMonths ?? "?"}:${entry.eventId || "event"}:${entry.choiceId || "choice"}:${index}`;
    if (processed.has(key)) continue;
    if (/therapist|therapy|counselor|counselling|counseling/.test(text)) {
      recordMentalHealthCare(state, { type: /school/.test(text) ? "schoolCounseling" : "therapy", source: `history:${entry.eventId || "event"}` });
    } else if (/doctor|psychologist|psychiatrist|professional evaluation|mental health evaluation/.test(text)) {
      recordMentalHealthCare(state, { type: "professionalEvaluation", source: `history:${entry.eventId || "event"}` });
    }
    processed.add(key);
  }
  mental.processedCareHistoryKeys = [...processed].slice(-180);
}

export function recordMentalHealthCare(state, action) {
  ensurePsychologyPhase3State(state);
  const mental = state.psychology.mentalHealth;
  const type = action?.type;
  if (!CARE_LABELS[type]) return state;
  const age = state.character?.ageMonths || 0;
  if (type === "medication" && !Object.values(mental.conditions).some((item) => ["diagnosed", "active"].includes(item.status))) return state;

  const entry = { type, ageMonths: age, source: action?.source || type, label: CARE_LABELS[type] };
  const duplicate = mental.care.history.some((item) => item.type === type && item.ageMonths === age && item.source === entry.source);
  if (!duplicate) mental.care.history.push(entry);
  mental.care.history = mental.care.history.slice(-40);

  if (type === "trustedConversation") {
    mental.care.supportStrength = clamp(mental.care.supportStrength + 3, 0, 100);
    if (state.psychology.dimensions) state.psychology.dimensions.emotionalOpenness = clamp((state.psychology.dimensions.emotionalOpenness || 50) + 0.8);
  }
  if (type === "schoolCounseling") {
    mental.care.supportStrength = clamp(mental.care.supportStrength + 6, 0, 100);
    mental.care.schoolSupportUntilMonths = Math.max(mental.care.schoolSupportUntilMonths || 0, age + 9);
  }
  if (type === "therapy") {
    mental.care.supportStrength = clamp(mental.care.supportStrength + 8, 0, 100);
    mental.care.therapyUntilMonths = Math.max(mental.care.therapyUntilMonths || 0, age + 12);
    if (state.psychology.dimensions) state.psychology.dimensions.resilience = clamp((state.psychology.dimensions.resilience || 50) + 1);
  }
  if (type === "professionalEvaluation") {
    mental.care.supportStrength = clamp(mental.care.supportStrength + 4, 0, 100);
    const eligible = Object.keys(CONDITION_DEFINITIONS)
      .filter((id) => conditionEligible(state, id))
      .sort((a, b) => conditionLikelihood(state, b) - conditionLikelihood(state, a));
    if (eligible[0] && age >= CONDITION_DEFINITIONS[eligible[0]].minimumAgeMonths) {
      const condition = mental.conditions[eligible[0]];
      condition.status = "diagnosed";
      condition.diagnosedAtMonths ??= age;
      condition.recognizedAtMonths ??= age;
      mental.recognized = true;
      mental.recognizedAtMonths ??= age;
    }
  }
  if (type === "medication") {
    mental.care.supportStrength = clamp(mental.care.supportStrength + 5, 0, 100);
    mental.care.medicationUntilMonths = Math.max(mental.care.medicationUntilMonths || 0, age + 6);
  }
  return state;
}

function applyCareEffects(state) {
  const mental = state.psychology.mentalHealth;
  const age = state.character?.ageMonths || 0;
  const therapy = (mental.care.therapyUntilMonths || -1) >= age;
  const medication = (mental.care.medicationUntilMonths || -1) >= age;
  const school = (mental.care.schoolSupportUntilMonths || -1) >= age;
  if (!therapy && !medication && !school) return;

  const reduction = (therapy ? 2.2 : 0) + (medication ? 1.6 : 0) + (school ? 0.8 : 0);
  for (const symptom of Object.values(mental.symptoms)) symptom.intensity = clamp(symptom.intensity - reduction);
  if (state.health && typeof state.health.stress === "number") state.health.stress = clamp(state.health.stress - (therapy ? 1 : 0) - (school ? 0.5 : 0));
}

export function syncPsychologyPhase3(state) {
  syncPsychologyPhase2(state);
  ensurePsychologyPhase3State(state);
  const mental = state.psychology.mentalHealth;
  const age = state.character?.ageMonths || 0;
  const previousAge = mental.lastSampleAgeMonths;
  const elapsedMonths = previousAge == null ? 0 : Math.max(0, age - previousAge);

  processCareFromHistory(state);
  if (previousAge !== age) {
    updateSymptoms(state, Math.max(1, elapsedMonths));
    updateFunctionalImpact(state);
    updateConditions(state, Math.max(1, elapsedMonths));
    updateRecognition(state);
    applyCareEffects(state);
    mental.lastSampleAgeMonths = age;
  } else {
    updateFunctionalImpact(state);
    updateRecognition(state);
  }
  return state;
}

function symptomRows(state) {
  return Object.entries(state.psychology.mentalHealth.symptoms)
    .filter(([, item]) => item.intensity >= 42 && item.monthsElevated >= 3)
    .sort((a, b) => b[1].intensity - a[1].intensity)
    .slice(0, 4)
    .map(([id]) => SYMPTOM_DEFINITIONS[id]);
}

function diagnosedRows(state) {
  return Object.entries(state.psychology.mentalHealth.conditions)
    .filter(([, item]) => ["diagnosed", "active", "remission"].includes(item.status))
    .map(([id, item]) => ({
      label: CONDITION_DEFINITIONS[id].label,
      status: item.status === "remission" ? "in remission" : "active",
    }));
}

export function psychologyPhase3Snapshot(state) {
  syncPsychologyPhase3(state);
  const mental = state.psychology.mentalHealth;
  const age = state.character?.ageMonths || 0;
  const symptoms = symptomRows(state);
  const diagnosed = diagnosedRows(state);
  const care = [...mental.care.history].slice(-3).reverse().map((item) => item.label);
  let recognition = "";
  if (age >= 132 && mental.recognized && !diagnosed.length) recognition = "These difficulties have been sticking around enough that getting support would make sense.";
  else if (age >= 132 && symptoms.length) recognition = "Some emotional difficulties have been recurring, but they are not a diagnosis by themselves.";
  return {
    symptoms,
    diagnosed,
    care,
    recognition,
    impact: mental.functionalImpact.overall,
    note: "Mental-health conditions depend on persistent symptoms and day-to-day impact, not on childhood history alone. Diagnosis requires a professional-evaluation event in the simulation.",
  };
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

function renderPhase3Panel() {
  if (typeof document === "undefined" || location.hash.replace("#", "") !== "self") return;
  const screen = document.querySelector(".screen");
  if (!screen || screen.querySelector(".psychology-phase3-panel")) return;
  const state = readPersistedState();
  if (!state || (state.character?.ageMonths || 0) < 132) return;
  syncPsychologyPhase3(state);
  const snapshot = psychologyPhase3Snapshot(state);
  if (!snapshot.symptoms.length && !snapshot.diagnosed.length && !snapshot.care.length && !snapshot.recognition) return;

  const diagnosed = snapshot.diagnosed.length
    ? `<h3>Known conditions</h3>${snapshot.diagnosed.map((item) => `<div class="mental-row"><strong>${item.label}</strong><p>${item.status}</p></div>`).join("")}`
    : "";
  const symptoms = snapshot.symptoms.length
    ? `<h3>What has been lingering</h3>${snapshot.symptoms.map((copy) => `<p class="mental-observation">${copy}</p>`).join("")}`
    : "";
  const care = snapshot.care.length
    ? `<h3>Support</h3><p class="mental-observation">${snapshot.care.join(" · ")}</p>`
    : "";

  screen.insertAdjacentHTML("beforeend", `
    <style>
      .psychology-phase3-panel{margin-top:22px;padding-top:18px;border-top:1px solid var(--line)}
      .psychology-phase3-panel h2{margin:0 0 6px;font-family:var(--serif);font-size:18px;font-weight:500}
      .psychology-phase3-panel h3{margin:17px 0 6px;font-family:var(--serif);font-size:14px;font-weight:500}
      .mental-row{padding:8px 0;border-top:1px solid var(--line)}.mental-row strong{display:block;font-size:11px}.mental-row p,.mental-observation,.mental-note,.mental-recognition{margin:3px 0 0;font-size:11px;line-height:1.5;color:var(--muted)}
      .mental-observation{padding:7px 0;border-top:1px solid var(--line);color:var(--ink)}.mental-recognition{margin:8px 0 0;color:var(--ink);font-family:var(--serif);font-style:italic}.mental-note{margin-top:14px;font-size:9px}
    </style>
    <section class="psychology-phase3-panel">
      <h2>Mental wellbeing</h2>
      ${snapshot.recognition ? `<p class="mental-recognition">${snapshot.recognition}</p>` : ""}
      ${diagnosed}${symptoms}${care}
      <p class="mental-note">${snapshot.note}</p>
    </section>
  `);
}

let bridgeInstalled = false;
let syncTimer = null;

function syncPersistedState() {
  if (typeof localStorage === "undefined") return;
  const state = readPersistedState();
  if (!state) return;
  const before = JSON.stringify(state.psychology?.mentalHealth || null);
  syncPsychologyPhase3(state);
  const after = JSON.stringify(state.psychology?.mentalHealth || null);
  if (before !== after) writePersistedState(state);
}

function scheduleBridgeSync(delay = 0) {
  if (syncTimer) clearTimeout(syncTimer);
  syncTimer = setTimeout(() => {
    syncTimer = null;
    syncPersistedState();
    renderPhase3Panel();
  }, delay);
}

export function installPsychologyPhase3Bridge() {
  if (bridgeInstalled || typeof document === "undefined") return;
  bridgeInstalled = true;
  syncPersistedState();
  renderPhase3Panel();
  document.addEventListener("click", (event) => {
    const target = event.target.closest?.("[data-choice],[data-childhood-choice],[data-context-choice],#continue-life");
    if (!target) return;
    scheduleBridgeSync(55);
  });
  window.addEventListener("hashchange", () => scheduleBridgeSync(0));
  const app = document.querySelector("#app");
  if (app) new MutationObserver(() => renderPhase3Panel()).observe(app, { childList: true, subtree: true });
}

export { CONDITION_DEFINITIONS, SYMPTOM_DEFINITIONS };
