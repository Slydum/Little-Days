import assert from "node:assert/strict";
import {
  ensurePsychologyState,
  psychologySnapshot,
  recordPsychologicalExperience,
  syncPsychologicalDevelopment,
} from "../game/psychology.js";

function makeState() {
  return {
    version: 2,
    character: {
      ageMonths: 0,
      personality: { social: 50, risk: 50, structure: 50, sensitivity: 55, curiosity: 50, independence: 48 },
      development: { attachment: 56, confidence: 50, emotionalRegulation: 52, autonomy: 48, socialComfort: 49, persistence: 51 },
    },
    household: { financeBand: "Getting by", savings: 10000 },
    health: { stress: 20 },
    family: { originStory: "You were born to two parents who are raising you together." },
    people: [
      {
        id: "guardian-test",
        role: "guardian",
        trust: 68,
        affection: 72,
        introducedAtMonths: 0,
        npc: { availability: 74 },
        family: { caregiver: true },
      },
    ],
    realism: { family: { atmosphere: 72 } },
    history: [],
    worldEvents: [],
  };
}

const stable = makeState();
ensurePsychologyState(stable);
assert.ok(!("trauma" in stable.psychology), "Phase 1 must not expose a trauma meter");
for (const value of Object.values(stable.psychology.dimensions)) {
  assert.ok(value >= 0 && value <= 100, "developmental dimensions must stay bounded");
}
for (let i = 0; i < 5; i += 1) {
  recordPsychologicalExperience(stable, { kind: "protective", category: "responsive_care", intensity: 2.2, source: `care-${i}` });
}
assert.ok(stable.psychology.exposures.protective.responsive_care.score >= 10, "responsive care should accumulate");
assert.ok(stable.psychology.imprints.some((item) => item.id === "people_can_come"), "repeated responsive care should form a protective imprint");

const strained = makeState();
ensurePsychologyState(strained);
for (let i = 0; i < 5; i += 1) {
  recordPsychologicalExperience(strained, { kind: "adversity", category: "caregiver_unavailability", intensity: 2.5, source: `absence-${i}` });
}
const adverseImprint = strained.psychology.imprints.find((item) => item.id === "needs_may_wait");
assert.ok(adverseImprint, "chronic caregiver unavailability should be able to form an imprint");
const unbufferedStrength = adverseImprint.strength;
for (let i = 0; i < 6; i += 1) {
  recordPsychologicalExperience(strained, { kind: "protective", category: "stable_caregiver", intensity: 2, source: `stable-${i}` });
}
assert.ok(
  strained.psychology.imprints.find((item) => item.id === "needs_may_wait").strength < unbufferedStrength,
  "later stable care should buffer an adversity imprint",
);
assert.equal(strained.psychology.conditions, undefined, "Phase 1 must not create mental-health diagnoses");

const world = makeState();
world.character.ageMonths = 96;
world.worldEvents.push({
  ageMonths: 96,
  category: "Family",
  text: "The adults are hurt and angry after an affair, and home suddenly feels much less steady.",
});
syncPsychologicalDevelopment(world);
const conflictScore = world.psychology.exposures.adversity.family_conflict.score;
syncPsychologicalDevelopment(world);
assert.equal(
  world.psychology.exposures.adversity.family_conflict.score,
  conflictScore,
  "syncing the same event twice must not double-count it",
);
assert.ok(psychologySnapshot(world).observations.every((item) => typeof item === "string"), "player-facing psychology should be qualitative");

console.log("Psychological development phase 1 smoke test passed");
