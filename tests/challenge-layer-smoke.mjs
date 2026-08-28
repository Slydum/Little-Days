import assert from "node:assert/strict";
import {
  advanceChallengeWorld,
  challengeEventForState,
  challengeSnapshot,
  ensureChallengeState,
  resolveChallengeChoice,
} from "../game/challenge-layer.js";

const state = {
  version: 2,
  seed: 424242,
  rngState: 1,
  character: {
    ageMonths: 72,
    personality: { social: 52, risk: 48, structure: 58, sensitivity: 50, curiosity: 56, independence: 49 },
    development: { attachment: 60, confidence: 54, emotionalRegulation: 55, autonomy: 52, socialComfort: 54, persistence: 58 },
    patterns: {},
  },
  date: { year: 2032, month: 5, day: 12 },
  household: { financeBand: "Tight", savings: 5200 },
  health: { wellbeing: 70, energy: 68, stress: 31 },
  education: { subjects: { mathematics: 62, language: 64, science: 60, art: 58, physicalEducation: 61 } },
  childhood: {
    socialConfidence: 55,
    school: { overallPerformance: 62, teacherSupport: 58, effort: 58, attendance: 95 },
  },
  people: [
    {
      id: "friend-mika",
      role: "friend",
      name: "Mika Santos",
      introducedAtMonths: 60,
      closeness: 62,
      trust: 60,
      deceased: false,
      school: { friendshipStatus: "friend" },
    },
    {
      id: "guardian-ana",
      role: "guardian",
      name: "Ana Reyes",
      introducedAtMonths: 0,
      closeness: 65,
      trust: 66,
      deceased: false,
      family: { caregiver: true },
    },
  ],
  history: [],
  worldEvents: [],
  resolution: null,
};

ensureChallengeState(state);
const snapshot = challengeSnapshot(state);
assert.equal(snapshot.goals.length >= 2, true, "school-age life should have active goals");
assert.equal(snapshot.capacity, 6, "capacity should initialize at six");

const event = challengeEventForState(state);
assert.ok(event, "a due school-age challenge should be queued");
assert.equal(event.choices.length >= 2, true, "challenge should force a real choice");
const enabled = event.choices.find((choice) => !choice.disabled);
assert.ok(enabled, "every challenge needs at least one playable choice");

resolveChallengeChoice(state, enabled.id);
assert.ok(state.resolution?.challengeEventId, "challenge choice should create a challenge resolution");
assert.equal(state.history.at(-1)?.continuity, "challenge-layer");
assert.equal(state.challenge.capacity <= 6, true, "choices can spend capacity");

state.resolution = null;
state.character.ageMonths += 6;
advanceChallengeWorld(state, 6);
assert.equal(state.challenge.capacity <= state.challenge.maxCapacity, true, "capacity recovery must stay capped");
assert.equal(Array.isArray(state.challenge.arcs), true, "persistent arcs should remain serializable");

console.log("challenge-layer smoke: ok");
