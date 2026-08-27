import assert from "node:assert/strict";
import {
  ensurePsychologyState,
  recordPsychologicalExperience,
} from "../game/psychology.js";
import {
  ensurePsychologyPhase2State,
  psychologyPhase2Snapshot,
  syncPsychologyPhase2,
} from "../game/psychology-phase2.js";

function makeState() {
  return {
    version: 2,
    character: {
      ageMonths: 108,
      personality: { social: 48, risk: 46, structure: 54, sensitivity: 60, curiosity: 52, independence: 50 },
      development: { attachment: 54, confidence: 48, emotionalRegulation: 49, autonomy: 50, socialComfort: 47, persistence: 53 },
      patterns: { connecting: 2, exploring: 1, creating: 0, persisting: 2, selfReliance: 1 },
    },
    household: { financeBand: "Getting by", savings: 10000 },
    health: { stress: 34, energy: 70, wellbeing: 74 },
    family: { originStory: "You were born to two parents who are raising you together." },
    people: [
      {
        id: "guardian-test",
        role: "guardian",
        trust: 58,
        affection: 62,
        introducedAtMonths: 0,
        npc: { availability: 60 },
        family: { caregiver: true },
      },
      {
        id: "friend-test",
        role: "friend",
        trust: 62,
        closeness: 64,
        affection: 60,
        introducedAtMonths: 60,
        npc: { availability: 70 },
        family: { caregiver: false },
      },
    ],
    realism: { family: { atmosphere: 58 } },
    history: [],
    worldEvents: [],
  };
}

const coping = makeState();
ensurePsychologyState(coping);
for (let i = 0; i < 5; i += 1) {
  recordPsychologicalExperience(coping, { kind: "adversity", category: "caregiver_unavailability", intensity: 2.5, source: `absence-${i}` });
}
assert.ok(coping.psychology.imprints.some((item) => item.id === "needs_may_wait"), "Phase 1 imprint should exist before coping consequences form");

ensurePsychologyPhase2State(coping);
const initialSuppression = coping.psychology.coping.patterns.suppression.score;
coping.history.push({
  ageMonths: 108,
  eventId: "guardian_busy_stretch",
  choiceId: "keep_to_self",
  choice: "Keep to yourself tonight",
  result: "You decide they already have enough to deal with.",
});
syncPsychologyPhase2(coping);
assert.ok(coping.psychology.coping.patterns.suppression.score > initialSuppression, "keeping needs private should reinforce suppression gradually");
assert.ok(coping.psychology.coping.patterns.withdrawal.score > 0, "the same choice can also reinforce withdrawal without becoming a diagnosis");

const afterFirstSync = coping.psychology.coping.patterns.suppression.score;
syncPsychologyPhase2(coping);
assert.equal(coping.psychology.coping.patterns.suppression.score, afterFirstSync, "syncing the same choice twice must not double-count coping habits");

coping.character.ageMonths = 111;
const helpBefore = coping.psychology.coping.patterns.helpSeeking.score;
const suppressionBeforeRepair = coping.psychology.coping.patterns.suppression.score;
coping.history.push({
  ageMonths: 111,
  eventId: "guardian_busy_stretch",
  choiceId: "tell_anyway",
  choice: "Tell them about your day anyway",
  result: "This time they put down what they were doing and listen properly.",
});
syncPsychologyPhase2(coping);
assert.ok(coping.psychology.coping.patterns.helpSeeking.score > helpBefore, "asking for connection should build help-seeking");
assert.ok(coping.psychology.coping.patterns.suppression.score < suppressionBeforeRepair, "adaptive coping should be able to soften a competing defensive habit");

const quiet = makeState();
ensurePsychologyPhase2State(quiet);
const quietWithdrawal = quiet.psychology.coping.patterns.withdrawal.score;
quiet.history.push({
  ageMonths: 108,
  eventId: "lunch_friend",
  choiceId: "alone",
  choice: "Eat somewhere quieter",
  result: "Lunch is peaceful and you enjoy the quiet.",
});
syncPsychologyPhase2(quiet);
assert.equal(quiet.psychology.coping.patterns.withdrawal.score, quietWithdrawal, "ordinary solitude must not automatically be treated as pathological withdrawal");

const stressed = makeState();
ensurePsychologyState(stressed);
stressed.psychology.dimensions.threatSensitivity = 72;
stressed.psychology.dimensions.emotionalOpenness = 40;
stressed.psychology.dimensions.socialSafety = 41;
stressed.psychology.dimensions.selfWorth = 43;
stressed.psychology.dimensions.shameSensitivity = 67;
stressed.psychology.dimensions.emotionalRegulation = 40;
stressed.health.stress = 66;
stressed.character.ageMonths = 120;
recordPsychologicalExperience(stressed, { kind: "adversity", category: "family_conflict", intensity: 3.2, source: "recent family conflict" });
ensurePsychologyPhase2State(stressed);
syncPsychologyPhase2(stressed);
assert.ok(stressed.psychology.coping.activations.length > 0, "strong current stress plus vulnerability should be able to create a temporary coping reaction");
assert.ok(Object.values(stressed.psychology.coping.signals).some((signal) => signal.intensity > 0), "stress should be able to show up as non-diagnostic emotional or behavioral signals");
for (const pattern of Object.values(stressed.psychology.coping.patterns)) {
  assert.ok(pattern.score >= 0 && pattern.score <= 100, "coping habit strength must stay bounded");
}
assert.equal(stressed.psychology.conditions, undefined, "Phase 2 still must not assign diagnoses");
assert.equal(stressed.psychology.diagnoses, undefined, "Phase 2 still must not assign diagnoses");

const snapshot = psychologyPhase2Snapshot(stressed);
assert.ok(snapshot.recent.every((item) => typeof item === "string"), "recent reactions should be qualitative text");
assert.ok(snapshot.signals.every((item) => typeof item === "string"), "stress signals should be qualitative text");
assert.ok(snapshot.adaptive.every((item) => typeof item.label === "string" && typeof item.copy === "string"), "coping snapshot must not expose raw scores");

console.log("Psychological development phase 2 smoke test passed");
