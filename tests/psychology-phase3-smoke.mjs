import assert from "node:assert/strict";
import {
  ensurePsychologyPhase3State,
  psychologyPhase3Snapshot,
  recordMentalHealthCare,
  syncPsychologyPhase3,
} from "../game/psychology-phase3.js";

function makeState(ageMonths = 144) {
  return {
    version: 2,
    seed: 424242,
    character: {
      ageMonths,
      personality: { social: 48, risk: 50, structure: 52, sensitivity: 62, curiosity: 50, independence: 48 },
      development: { attachment: 52, confidence: 46, emotionalRegulation: 44, autonomy: 50, socialComfort: 44, persistence: 50 },
      patterns: { connecting: 3, exploring: 2, creating: 1, persisting: 2, selfReliance: 2 },
    },
    household: { financeBand: "Getting by", savings: 12000 },
    health: { stress: 72, wellbeing: 55, energy: 54 },
    family: { originStory: "You were born to two parents who are raising you together." },
    people: [{ id: "guardian", role: "guardian", trust: 64, affection: 68, introducedAtMonths: 0, family: { caregiver: true }, npc: { availability: 62 } }],
    realism: { family: { atmosphere: 58 } },
    history: [],
    worldEvents: [],
  };
}

function makeAnxiousState(ageMonths = 168) {
  const state = makeState(ageMonths);
  ensurePsychologyPhase3State(state);
  Object.assign(state.psychology.dimensions, {
    threatSensitivity: 84,
    emotionalRegulation: 38,
    resilience: 35,
    socialSafety: 42,
    selfWorth: 44,
    shameSensitivity: 66,
    emotionalOpenness: 43,
  });
  state.psychology.coping.patterns.reassuranceSeeking.score = 54;
  state.psychology.coping.patterns.perfectionism.score = 48;
  state.psychology.coping.patterns.suppression.score = 40;
  state.psychology.coping.patterns.helpSeeking.score = 8;
  state.psychology.coping.patterns.selfSoothing.score = 7;
  state.psychology.coping.signals.sleepRestlessness = { intensity: 74, episodes: 3, lastAgeMonths: ageMonths };
  state.psychology.coping.signals.physicalStress = { intensity: 72, episodes: 3, lastAgeMonths: ageMonths };
  state.psychology.coping.signals.concentrationStrain = { intensity: 70, episodes: 3, lastAgeMonths: ageMonths };
  state.psychology.coping.signals.irritability = { intensity: 56, episodes: 2, lastAgeMonths: ageMonths };
  state.psychology.mentalHealth.lastSampleAgeMonths = ageMonths - 3;
  return state;
}

const child = makeAnxiousState(156);
for (let age = 156; age <= 165; age += 3) {
  child.character.ageMonths = age;
  child.psychology.mentalHealth.lastSampleAgeMonths = age - 3;
  syncPsychologyPhase3(child);
}
assert.ok(!Object.values(child.psychology.mentalHealth.conditions).some((item) => ["diagnosed", "active"].includes(item.status)), "childhood must not create a formal diagnosis before the age gate");
assert.ok(psychologyPhase3Snapshot(child).diagnosed.length === 0, "pre-gate snapshots must not expose a diagnosis");

const anxious = makeAnxiousState(168);
for (let age = 168; age <= 180; age += 3) {
  anxious.character.ageMonths = age;
  anxious.health.stress = 78;
  anxious.psychology.coping.signals.sleepRestlessness.intensity = 78;
  anxious.psychology.coping.signals.physicalStress.intensity = 76;
  anxious.psychology.coping.signals.concentrationStrain.intensity = 74;
  anxious.psychology.mentalHealth.lastSampleAgeMonths = age - 3;
  syncPsychologyPhase3(anxious);
}
assert.equal(anxious.psychology.mentalHealth.conditions.generalizedAnxiety.status, "emerging", "persistent anxiety symptoms should become clinically eligible without self-diagnosing");
assert.equal(psychologyPhase3Snapshot(anxious).diagnosed.length, 0, "eligibility alone must not expose a diagnosis");
recordMentalHealthCare(anxious, { type: "professionalEvaluation", source: "test evaluation" });
assert.ok(["diagnosed", "active"].includes(anxious.psychology.mentalHealth.conditions.generalizedAnxiety.status), "professional evaluation should be able to diagnose an eligible condition");

const noSymptoms = makeState(180);
ensurePsychologyPhase3State(noSymptoms);
noSymptoms.psychology.exposures.adversity.family_conflict = { score: 28, episodes: 8, firstAgeMonths: 60, lastAgeMonths: 174, sources: ["test"] };
noSymptoms.health.stress = 18;
Object.assign(noSymptoms.psychology.dimensions, { threatSensitivity: 42, resilience: 72, emotionalRegulation: 70, socialSafety: 70, selfWorth: 68 });
noSymptoms.psychology.mentalHealth.lastSampleAgeMonths = 177;
syncPsychologyPhase3(noSymptoms);
recordMentalHealthCare(noSymptoms, { type: "professionalEvaluation", source: "test evaluation" });
assert.equal(noSymptoms.psychology.mentalHealth.conditions.traumaRelated.status, "none", "adversity history without persistent symptoms must not produce a trauma-related diagnosis");

const treatment = anxious;
const worryBefore = treatment.psychology.mentalHealth.symptoms.persistentWorry.intensity;
recordMentalHealthCare(treatment, { type: "therapy", source: "ongoing therapy" });
recordMentalHealthCare(treatment, { type: "medication", source: "clinician plan" });
for (let age = 183; age <= 201; age += 3) {
  treatment.character.ageMonths = age;
  treatment.health.stress = 28;
  Object.assign(treatment.psychology.dimensions, { threatSensitivity: 48, resilience: 66, emotionalRegulation: 62 });
  treatment.psychology.coping.signals.sleepRestlessness.intensity = 28;
  treatment.psychology.coping.signals.physicalStress.intensity = 26;
  treatment.psychology.coping.signals.concentrationStrain.intensity = 30;
  treatment.psychology.mentalHealth.lastSampleAgeMonths = age - 3;
  syncPsychologyPhase3(treatment);
}
assert.ok(treatment.psychology.mentalHealth.symptoms.persistentWorry.intensity < worryBefore, "support and improved circumstances should allow symptoms to improve");
assert.ok(["active", "remission"].includes(treatment.psychology.mentalHealth.conditions.generalizedAnxiety.status), "diagnosed conditions should persist as active or move into remission rather than disappear");

assert.equal(treatment.psychology.mentalHealth.conditions.generalizedAnxiety.diagnosedAtMonths != null, true);
assert.ok(psychologyPhase3Snapshot(treatment).note.includes("not on childhood history alone"), "player-facing explanation should reject trauma determinism");
assert.ok(!("trauma" in treatment.psychology), "the psychology system must still avoid a public trauma meter");

console.log("Psychological development phase 3 smoke test passed");
