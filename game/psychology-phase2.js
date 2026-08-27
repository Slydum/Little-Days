import {
  ensurePsychologyState,
  syncPsychologicalDevelopment,
} from "./psychology.js";

const STORAGE_KEY = "little-days-save-v2";
const VERSION = 1;
const clamp = (value, min = 0, max = 100) => Math.max(min, Math.min(max, value));

const PATTERN_DEFINITIONS = {
  helpSeeking: { label: "asking for support", adaptive: true, copy: "You are learning that asking for help can be useful instead of dangerous." },
  emotionalExpression: { label: "putting feelings into words", adaptive: true, copy: "You are becoming more able to name what you feel and let trusted people know." },
  selfSoothing: { label: "settling yourself", adaptive: true, copy: "You are building ways to calm down without needing the feeling to disappear instantly." },
  problemSolving: { label: "working through problems", adaptive: true, copy: "When something feels difficult, you increasingly look for a manageable next step." },
  socialApproach: { label: "staying engaged", adaptive: true, copy: "You are learning to stay connected even when a social moment feels uncertain." },

  avoidance: { label: "avoidance", adaptive: false, copy: "Getting away from uncomfortable situations can feel safer than finding out what happens next." },
  suppression: { label: "keeping feelings inside", adaptive: false, copy: "You often keep feelings private until they are easier to ignore or harder to explain." },
  withdrawal: { label: "pulling away", adaptive: false, copy: "When closeness feels uncertain, creating distance can feel easier than risking rejection." },
  reassuranceSeeking: { label: "checking for reassurance", adaptive: false, copy: "Uncertainty can make you look repeatedly for signs that everything is still okay." },
  perfectionism: { label: "perfectionistic control", adaptive: false, copy: "Doing things exactly right can start to feel like protection against criticism or failure." },
  aggression: { label: "pushing back hard", adaptive: false, copy: "When you feel cornered or overwhelmed, anger can arrive faster than words." },
  overResponsibility: { label: "taking too much responsibility", adaptive: false, copy: "You can start treating other people's comfort or problems as something you are responsible for fixing." },
};

const CHOICE_RULES = {
  guardian_busy_stretch: {
    tell_anyway: [
      ["helpSeeking", 2.0],
      ["emotionalExpression", 1.8],
    ],
    help_small: [["problemSolving", 0.8]],
    keep_to_self: [
      ["suppression", 2.0],
      ["withdrawal", 1.2],
    ],
  },
  friend_world_growing: {
    join_sometimes: [["socialApproach", 1.8]],
    ask_friend: [
      ["helpSeeking", 1.4],
      ["emotionalExpression", 1.2],
      ["reassuranceSeeking", 0.5],
    ],
    pull_back: [
      ["withdrawal", 1.8],
      ["avoidance", 1.0],
    ],
  },
  friend_quiet_lately: {
    check_in: [
      ["socialApproach", 1.1],
      ["emotionalExpression", 0.8],
    ],
    stay_near: [["socialApproach", 0.8]],
  },
  presentation_second_chance_fast: {
    try_slower: [
      ["selfSoothing", 1.7],
      ["socialApproach", 0.8],
    ],
    rush_again: [["avoidance", 2.2]],
    ask_teacher: [
      ["helpSeeking", 1.5],
      ["problemSolving", 1.7],
    ],
  },
  presentation_second_chance_steady: {
    trust_yourself: [
      ["selfSoothing", 1.1],
      ["socialApproach", 1.3],
    ],
    same_method: [["problemSolving", 1.3]],
  },
  club_signups: {
    walk_up_alone: [["socialApproach", 1.3]],
    with_friend: [
      ["helpSeeking", 0.6],
      ["socialApproach", 1.0],
    ],
    take_form: [["problemSolving", 0.8]],
  },
  sibling_own_world: {
    listen: [["socialApproach", 0.7]],
    tease: [["aggression", 0.8]],
  },
};

const DEFENSIVE_OPPOSITES = {
  helpSeeking: ["suppression", "withdrawal"],
  emotionalExpression: ["suppression"],
  selfSoothing: ["aggression", "reassuranceSeeking"],
  problemSolving: ["avoidance", "perfectionism"],
  socialApproach: ["withdrawal", "avoidance"],
};

function makePattern(id, score = 0) {
  return {
    id,
    score: clamp(score),
    episodes: 0,
    firstAgeMonths: null,
    lastAgeMonths: null,
    sources: [],
  };
}

function initialPatternScores(state) {
  const d = state.psychology?.dimensions || {};
  const legacy = state.character?.patterns || {};
  return {
    helpSeeking: clamp(6 + Math.max(0, (d.emotionalOpenness ?? 50) - 50) * 0.22 + (legacy.connecting || 0) * 0.18, 0, 28),
    emotionalExpression: clamp(6 + Math.max(0, (d.emotionalOpenness ?? 50) - 48) * 0.25, 0, 28),
    selfSoothing: clamp(7 + Math.max(0, (d.emotionalRegulation ?? 50) - 48) * 0.22, 0, 28),
    problemSolving: clamp(7 + Math.max(0, (d.resilience ?? 50) - 48) * 0.18 + (legacy.persisting || 0) * 0.15, 0, 28),
    socialApproach: clamp(6 + Math.max(0, (d.socialSafety ?? 50) - 48) * 0.2 + (legacy.connecting || 0) * 0.12, 0, 28),
    avoidance: clamp(5 + Math.max(0, (d.threatSensitivity ?? 50) - 55) * 0.2, 0, 25),
    suppression: clamp(5 + Math.max(0, 48 - (d.emotionalOpenness ?? 50)) * 0.24, 0, 25),
    withdrawal: clamp(4 + Math.max(0, 48 - (d.socialSafety ?? 50)) * 0.22, 0, 25),
    reassuranceSeeking: clamp(4 + Math.max(0, 48 - (d.attachmentSecurity ?? 50)) * 0.18 + Math.max(0, (d.threatSensitivity ?? 50) - 60) * 0.12, 0, 25),
    perfectionism: clamp(4 + Math.max(0, (d.shameSensitivity ?? 50) - 58) * 0.2, 0, 25),
    aggression: clamp(3 + Math.max(0, 45 - (d.emotionalRegulation ?? 50)) * 0.22, 0, 22),
    overResponsibility: 3,
  };
}

export function ensurePsychologyPhase2State(state) {
  ensurePsychologyState(state);
  const scores = initialPatternScores(state);
  state.psychology.coping ||= {
    version: VERSION,
    patterns: Object.fromEntries(Object.keys(PATTERN_DEFINITIONS).map((id) => [id, makePattern(id, scores[id] || 0)])),
    processedHistoryKeys: [],
    activations: [],
    signals: {},
    lastConsequencesAgeMonths: null,
  };
  state.psychology.coping.version = VERSION;
  state.psychology.coping.patterns ||= {};
  for (const id of Object.keys(PATTERN_DEFINITIONS)) {
    state.psychology.coping.patterns[id] ||= makePattern(id, scores[id] || 0);
  }
  state.psychology.coping.processedHistoryKeys ||= [];
  state.psychology.coping.activations ||= [];
  state.psychology.coping.signals ||= {};
  state.psychology.coping.lastConsequencesAgeMonths ??= null;
  return state;
}

function reinforcePattern(state, id, amount, source = id) {
  const pattern = state.psychology.coping.patterns[id];
  if (!pattern || !Number.isFinite(amount) || amount <= 0) return;
  const ageMonths = state.character?.ageMonths || 0;
  const sensitivity = state.character?.personality?.sensitivity ?? 50;
  const strengthMultiplier = clamp(0.9 + sensitivity / 650, 0.9, 1.08);
  pattern.score = clamp(pattern.score + amount * strengthMultiplier, 0, 100);
  pattern.episodes += 1;
  pattern.firstAgeMonths ??= ageMonths;
  pattern.lastAgeMonths = ageMonths;
  if (!pattern.sources.includes(source)) pattern.sources = [...pattern.sources, source].slice(-10);

  if (PATTERN_DEFINITIONS[id]?.adaptive) {
    for (const oppositeId of DEFENSIVE_OPPOSITES[id] || []) {
      const opposite = state.psychology.coping.patterns[oppositeId];
      if (opposite) opposite.score = clamp(opposite.score - amount * 0.32, 0, 100);
    }
  }
}

function historyKey(entry, index) {
  return `${entry.eventId || "event"}:${entry.choiceId || "choice"}:${entry.ageMonths ?? "?"}:${index}`;
}

function rulePatternsFor(entry) {
  const eventRules = CHOICE_RULES[entry.eventId];
  const direct = eventRules?.[entry.choiceId];
  if (direct) return direct;

  const text = `${entry.choice || ""} ${entry.result || ""}`.toLowerCase();
  const matches = [];
  if (/ask (for help|them|someone)|tell (them|someone)|talk to/.test(text)) matches.push(["helpSeeking", 0.7]);
  if (/keep (it|this|your feelings) to yourself|pretend (it|you) (isn't|aren't)|say nothing/.test(text)) matches.push(["suppression", 0.8]);
  if (/get it over with|leave before|avoid|stay away/.test(text)) matches.push(["avoidance", 0.9]);
  if (/slow down|breathe|take a moment/.test(text)) matches.push(["selfSoothing", 0.8]);
  return matches;
}

function processChoiceCoping(state) {
  const processed = new Set(state.psychology.coping.processedHistoryKeys);
  for (const [index, entry] of (state.history || []).entries()) {
    const key = historyKey(entry, index);
    if (processed.has(key)) continue;
    for (const [patternId, amount] of rulePatternsFor(entry)) {
      reinforcePattern(state, patternId, amount, `choice:${entry.eventId || "event"}:${entry.choiceId || "choice"}`);
    }

    if (entry.eventId === "guardian_busy_stretch" && entry.choiceId === "help_small") {
      const imprint = state.psychology.imprints?.find((item) => item.id === "needs_may_wait" && item.strength >= 24);
      if (imprint) reinforcePattern(state, "overResponsibility", 0.9, "helping while caregiver feels unavailable");
    }

    processed.add(key);
  }
  state.psychology.coping.processedHistoryKeys = [...processed].slice(-300);
}

function recentAdversity(state, category, withinMonths = 12) {
  const bucket = state.psychology.exposures?.adversity?.[category];
  if (!bucket || bucket.lastAgeMonths == null) return false;
  return (state.character?.ageMonths || 0) - bucket.lastAgeMonths <= withinMonths;
}

function imprintStrength(state, id) {
  return state.psychology.imprints?.find((item) => item.id === id)?.strength || 0;
}

function pushActivation(state, id, copy, patternId, amount = 0.7) {
  const ageMonths = state.character?.ageMonths || 0;
  const existing = state.psychology.coping.activations.find((item) => item.id === id && item.ageMonths === ageMonths);
  if (existing) return false;
  state.psychology.coping.activations.unshift({ id, copy, patternId, ageMonths });
  state.psychology.coping.activations = state.psychology.coping.activations.slice(0, 16);
  if (patternId) reinforcePattern(state, patternId, amount, `activation:${id}`);
  return true;
}

function defensiveLoad(state) {
  return ["avoidance", "suppression", "withdrawal", "reassuranceSeeking", "perfectionism", "aggression", "overResponsibility"]
    .reduce((sum, id) => sum + (state.psychology.coping.patterns[id]?.score || 0), 0) / 7;
}

function adaptiveLoad(state) {
  return ["helpSeeking", "emotionalExpression", "selfSoothing", "problemSolving", "socialApproach"]
    .reduce((sum, id) => sum + (state.psychology.coping.patterns[id]?.score || 0), 0) / 5;
}

const SIGNAL_DEFINITIONS = {
  sleepRestlessness: "Sleep can get restless when life feels tense.",
  irritability: "You can become irritable before you fully understand what is bothering you.",
  physicalStress: "Stress sometimes shows up in your body before you have words for it.",
  concentrationStrain: "When pressure piles up, keeping your attention on one thing can become harder.",
  socialAvoidance: "After difficult social moments, being alone can feel easier than risking another uncomfortable interaction.",
};

function updateSignal(state, id, target) {
  const signals = state.psychology.coping.signals;
  signals[id] ||= { intensity: 0, episodes: 0, lastAgeMonths: null };
  const signal = signals[id];
  const before = signal.intensity;
  signal.intensity = clamp(before * 0.68 + clamp(target) * 0.32);
  if (signal.intensity >= 34 && before < 34) signal.episodes += 1;
  if (signal.intensity >= 20) signal.lastAgeMonths = state.character?.ageMonths || 0;
}

function updateStressSignals(state) {
  const d = state.psychology.dimensions;
  const stress = state.health?.stress ?? 20;
  const sensitivity = state.character?.personality?.sensitivity ?? 50;
  const patterns = state.psychology.coping.patterns;
  const adaptiveBuffer = adaptiveLoad(state) * 0.16;
  const perfectionism = patterns.perfectionism.score || 0;
  const withdrawal = patterns.withdrawal.score || 0;
  const avoidance = patterns.avoidance.score || 0;

  updateSignal(state, "sleepRestlessness", stress * 0.75 + (d.threatSensitivity || 50) * 0.5 - 30 - adaptiveBuffer);
  updateSignal(state, "irritability", stress * 0.7 + Math.max(0, 55 - (d.emotionalRegulation || 50)) * 0.9 - 12 - adaptiveBuffer);
  updateSignal(state, "physicalStress", stress * 0.72 + sensitivity * 0.35 + (d.threatSensitivity || 50) * 0.18 - 25 - adaptiveBuffer);
  updateSignal(state, "concentrationStrain", stress * 0.72 + perfectionism * 0.38 + (d.threatSensitivity || 50) * 0.16 - 22 - adaptiveBuffer);
  updateSignal(state, "socialAvoidance", withdrawal * 0.7 + avoidance * 0.45 + Math.max(0, 55 - (d.socialSafety || 50)) * 0.75 - adaptiveBuffer);
}

function applyAgeConsequences(state) {
  const ageMonths = state.character?.ageMonths || 0;
  if (ageMonths < 72 || state.psychology.coping.lastConsequencesAgeMonths === ageMonths) return;
  state.psychology.coping.lastConsequencesAgeMonths = ageMonths;

  const d = state.psychology.dimensions;
  const stress = state.health?.stress ?? 20;
  let activated = false;

  if ((recentAdversity(state, "family_conflict", 9) || recentAdversity(state, "instability", 9)) && d.threatSensitivity >= 60) {
    activated = pushActivation(
      state,
      "watching-home",
      "When home feels tense or uncertain, you catch yourself watching everyone's mood closely.",
      "suppression",
      0.6,
    ) || activated;
    d.threatSensitivity = clamp(d.threatSensitivity + 0.25);
  }

  if ((recentAdversity(state, "rejection", 12) || recentAdversity(state, "bullying", 12)) && d.socialSafety <= 48) {
    activated = pushActivation(
      state,
      "pulling-back-socially",
      "After difficult social moments, pulling back can feel safer than finding out whether people still want you around.",
      "withdrawal",
      0.8,
    ) || activated;
  }

  if (imprintStrength(state, "needs_may_wait") >= 24 && d.emotionalOpenness <= 48) {
    activated = pushActivation(
      state,
      "needs-stay-private",
      "You sometimes decide not to ask for things because needing less feels simpler.",
      "suppression",
      0.7,
    ) || activated;
  }

  if (stress >= 55 && d.shameSensitivity >= 60 && d.selfWorth <= 48) {
    activated = pushActivation(
      state,
      "getting-it-right",
      "When pressure builds, getting everything exactly right can start to feel unusually important.",
      "perfectionism",
      0.8,
    ) || activated;
  }

  if (stress >= 60 && d.emotionalRegulation <= 43) {
    activated = pushActivation(
      state,
      "anger-arrives-fast",
      "When you are overwhelmed, irritation can arrive before you have figured out what you are actually feeling.",
      "aggression",
      0.6,
    ) || activated;
  }

  const adaptive = adaptiveLoad(state);
  const defensive = defensiveLoad(state);
  if (adaptive >= defensive + 8) {
    if (state.health && typeof state.health.stress === "number") state.health.stress = clamp(state.health.stress - 1);
    d.resilience = clamp(d.resilience + 0.35);
  } else if (defensive >= adaptive + 14 && activated) {
    if (state.health && typeof state.health.stress === "number") state.health.stress = clamp(state.health.stress + 1);
    d.emotionalRegulation = clamp(d.emotionalRegulation - 0.25);
  }

  updateStressSignals(state);

  const sleepSignal = state.psychology.coping.signals.sleepRestlessness?.intensity || 0;
  const bodySignal = state.psychology.coping.signals.physicalStress?.intensity || 0;
  if (sleepSignal >= 52 && state.health && typeof state.health.energy === "number") state.health.energy = clamp(state.health.energy - 1);
  if (bodySignal >= 58 && state.health && typeof state.health.wellbeing === "number") state.health.wellbeing = clamp(state.health.wellbeing - 1);

  const suppression = state.psychology.coping.patterns.suppression.score;
  const helpSeeking = state.psychology.coping.patterns.helpSeeking.score;
  if (suppression >= 34 && suppression >= helpSeeking + 12) d.emotionalOpenness = clamp(d.emotionalOpenness - 0.25);

  const socialApproach = state.psychology.coping.patterns.socialApproach.score;
  const withdrawal = state.psychology.coping.patterns.withdrawal.score;
  if (socialApproach >= withdrawal + 10) d.socialSafety = clamp(d.socialSafety + 0.2);
}

export function syncPsychologyPhase2(state) {
  syncPsychologicalDevelopment(state);
  ensurePsychologyPhase2State(state);
  processChoiceCoping(state);
  applyAgeConsequences(state);
  return state;
}

function patternRows(state, adaptive) {
  return Object.entries(state.psychology.coping.patterns)
    .filter(([id]) => PATTERN_DEFINITIONS[id].adaptive === adaptive)
    .map(([id, pattern]) => ({ id, ...pattern, ...PATTERN_DEFINITIONS[id] }))
    .filter((item) => item.score >= (adaptive ? 12 : 16))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
}

export function psychologyPhase2Snapshot(state) {
  syncPsychologyPhase2(state);
  const ageMonths = state.character?.ageMonths || 0;
  if (ageMonths < 72) return { adaptive: [], defensive: [], recent: [], signals: [], note: "Coping patterns are still too early to describe clearly." };
  const adaptive = patternRows(state, true).map(({ label, copy }) => ({ label, copy }));
  const defensive = patternRows(state, false).map(({ label, copy }) => ({ label, copy }));
  const recent = state.psychology.coping.activations
    .filter((item) => ageMonths - item.ageMonths <= 18)
    .slice(0, 3)
    .map((item) => item.copy);
  const signals = Object.entries(state.psychology.coping.signals || {})
    .filter(([, value]) => value.intensity >= 34)
    .sort((a, b) => b[1].intensity - a[1].intensity)
    .slice(0, 3)
    .map(([id]) => SIGNAL_DEFINITIONS[id]);
  return {
    adaptive,
    defensive,
    recent,
    signals,
    note: "These are learned coping tendencies, not diagnoses. They can strengthen, soften, or be replaced by later experiences.",
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

function renderPhase2Panel() {
  if (typeof document === "undefined" || location.hash.replace("#", "") !== "self") return;
  const screen = document.querySelector(".screen");
  if (!screen || screen.querySelector(".psychology-phase2-panel")) return;
  const state = readPersistedState();
  if (!state) return;
  syncPsychologyPhase2(state);
  const snapshot = psychologyPhase2Snapshot(state);
  if ((state.character?.ageMonths || 0) < 72) return;

  const adaptive = snapshot.adaptive.length
    ? `<h3>Ways you are learning to cope</h3>${snapshot.adaptive.map((item) => `<div class="coping-row"><strong>${item.label}</strong><p>${item.copy}</p></div>`).join("")}`
    : "";
  const defensive = snapshot.defensive.length
    ? `<h3>Protective habits</h3>${snapshot.defensive.map((item) => `<div class="coping-row"><strong>${item.label}</strong><p>${item.copy}</p></div>`).join("")}`
    : "";
  const recent = snapshot.recent.length
    ? `<h3>Recent reactions</h3>${snapshot.recent.map((copy) => `<p class="coping-reaction">${copy}</p>`).join("")}`
    : "";
  const signals = snapshot.signals.length
    ? `<h3>When stress shows up</h3>${snapshot.signals.map((copy) => `<p class="coping-reaction">${copy}</p>`).join("")}`
    : "";

  screen.insertAdjacentHTML("beforeend", `
    <style>
      .psychology-phase2-panel{margin-top:22px;padding-top:18px;border-top:1px solid var(--line)}
      .psychology-phase2-panel h2{margin:0 0 6px;font-family:var(--serif);font-size:18px;font-weight:500}
      .psychology-phase2-panel h3{margin:17px 0 6px;font-family:var(--serif);font-size:14px;font-weight:500}
      .coping-row{padding:8px 0;border-top:1px solid var(--line)}.coping-row strong{display:block;font-size:10px;text-transform:capitalize}.coping-row p,.coping-reaction,.coping-note{margin:3px 0 0;font-size:11px;line-height:1.5;color:var(--muted)}
      .coping-reaction{padding:7px 0;border-top:1px solid var(--line);color:var(--ink)}.coping-note{margin-top:14px;font-size:9px}
    </style>
    <section class="psychology-phase2-panel">
      <h2>How you cope</h2>
      ${adaptive || defensive || recent || signals ? `${adaptive}${defensive}${recent}${signals}` : `<p class="coping-reaction">Your coping style is still taking shape.</p>`}
      <p class="coping-note">${snapshot.note}</p>
    </section>
  `);
}

let bridgeInstalled = false;
let syncTimer = null;

function syncPersistedState() {
  if (typeof localStorage === "undefined") return;
  const state = readPersistedState();
  if (!state) return;
  const before = JSON.stringify(state.psychology?.coping || null);
  syncPsychologyPhase2(state);
  const after = JSON.stringify(state.psychology?.coping || null);
  if (before !== after) writePersistedState(state);
}

function scheduleBridgeSync(delay = 0) {
  if (syncTimer) clearTimeout(syncTimer);
  syncTimer = setTimeout(() => {
    syncTimer = null;
    syncPersistedState();
    renderPhase2Panel();
  }, delay);
}

export function installPsychologyPhase2Bridge() {
  if (bridgeInstalled || typeof document === "undefined") return;
  bridgeInstalled = true;
  syncPersistedState();
  renderPhase2Panel();
  document.addEventListener("click", (event) => {
    const target = event.target.closest?.("[data-choice],[data-childhood-choice],[data-context-choice],#continue-life");
    if (!target) return;
    scheduleBridgeSync(45);
  });
  window.addEventListener("hashchange", () => scheduleBridgeSync(0));
  const app = document.querySelector("#app");
  if (app) new MutationObserver(() => renderPhase2Panel()).observe(app, { childList: true, subtree: true });
}

export { PATTERN_DEFINITIONS };
