import assert from "node:assert/strict";
import { createNewLife } from "../game/engine.js";
import { ensureChildhoodState, advanceChildhoodWorld } from "../game/childhood-v5.js";
import { ensureRelationshipContinuity } from "../game/relationship-continuity.js";
import { ensureSchoolCoherence } from "../game/school-coherence.js";
import { ensureChildhoodSummary } from "../game/childhood-summary.js";

function setDateForAge(state, months) {
  const total = (state.character.birthMonth || 0) + months;
  state.date.year = state.character.birthYear + Math.floor(total / 12);
  state.date.month = total % 12;
}

const state = createNewLife(771311);
state.character.ageMonths = 60;
setDateForAge(state, 60);
ensureChildhoodState(state);

let before = 60;
for (let months = 72; months <= 156; months += 12) {
  state.character.ageMonths = months;
  setDateForAge(state, months);
  advanceChildhoodWorld(state, months - before, before);
  ensureSchoolCoherence(state);
  before = months;
}
state.completed = true;
state.interests.drawing = 82;
state.interests.reading = 68;
state.interests.music = 57;

ensureRelationshipContinuity(state);
const important = state.people.find((person) => person.role === "guardian") || state.people[0];
assert.ok(important, "test life should have an important person");
important.closeness = 86;
important.trust = 82;
important.affection = 84;
important.continuity ||= {
  version: 2,
  active: true,
  closed: false,
  arc: "safe-base",
  beatCount: 0,
  lastBeatAtMonths: 144,
  lastChoiceId: null,
  lastBeatType: null,
  unresolved: null,
  significantMoments: [],
};
important.continuity.beatCount = 3;
important.continuity.unresolved = { sinceAgeMonths: 150, beatType: "strain", choiceId: "wait" };
important.continuity.significantMoments = [
  { ageMonths: 96, beatType: "routine", choiceId: "tell", summary: `${important.name.split(" ")[0]} became part of a familiar routine in your life.` },
  { ageMonths: 150, beatType: "strain", choiceId: "wait", summary: `You and ${important.name.split(" ")[0]} went through a period of tension.` },
];
important.npc ||= {};
important.npc.currentThread = `You and ${important.name.split(" ")[0]} went through a period of tension. Right now, the relationship feels guarded.`;

state.memories.push({
  id: "summary-test-memory",
  age: 11,
  ageMonths: 132,
  title: "A day you kept",
  copy: "A small moment with someone important stayed vivid long after the day ended.",
  importance: 4,
  featured: true,
  personId: important.id,
});

const summary = ensureChildhoodSummary(state, { force: true });
assert.ok(summary, "age thirteen should produce a childhood summary");
assert.equal(summary.version, 1);
assert.equal(summary.finalized, true);
assert.match(summary.title, /childhood/i);
assert.match(summary.copy, /By thirteen/i);

const ids = new Set(summary.sections.map((section) => section.id));
for (const expected of ["home", "people", "school", "interests", "self", "coping", "memories", "carrying-forward"]) {
  assert.ok(ids.has(expected), `summary should include ${expected}`);
}

const peopleSection = summary.sections.find((section) => section.id === "people");
assert.ok(peopleSection.items.some((item) => item.includes(important.name)), "important people should be named in the childhood record");
const unresolved = summary.sections.find((section) => section.id === "carrying-forward");
assert.ok(unresolved.items.some((item) => item.includes(important.name.split(" ")[0])), "unfinished relationship threads should carry forward");
const memorySection = summary.sections.find((section) => section.id === "memories");
assert.ok(memorySection.items.some((item) => item.includes("A day you kept")), "important memories should appear in the record");

assert.ok(state.adolescenceHandoff, "the summary should create an adolescence handoff");
assert.equal(state.adolescenceHandoff.version, 1);
assert.equal(state.adolescenceHandoff.ageMonths, 156);
assert.ok(state.adolescenceHandoff.relationships.some((person) => person.id === important.id), "handoff should preserve important relationship state");
assert.ok(state.adolescenceHandoff.psychology?.dimensions, "handoff should preserve hidden developmental psychology");
assert.ok(state.adolescenceHandoff.school, "handoff should preserve school trajectory");
assert.ok(state.adolescenceHandoff.memoryIds.includes("summary-test-memory"), "handoff should point to formative memories");

const visible = JSON.stringify({ title: summary.title, copy: summary.copy, sections: summary.sections });
assert.doesNotMatch(visible, /threatSensitivity|shameSensitivity|attachmentSecurity|\"score\"/i, "public childhood record must stay qualitative rather than exposing hidden psychology scores");

const again = ensureChildhoodSummary(state);
assert.strictEqual(again, state.childhoodSummary, "finalized summary should be idempotent");
assert.deepEqual(again, summary, "re-reading a finalized summary should not rewrite childhood");

const legacy = createNewLife(771312);
legacy.character.ageMonths = 156;
setDateForAge(legacy, 156);
legacy.completed = true;
delete legacy.psychology;
delete legacy.schoolCoherence;
delete legacy.relationshipContinuity;
const migrated = ensureChildhoodSummary(legacy, { force: true });
assert.ok(migrated?.handoff, "older saves should gain a summary/handoff without requiring pre-existing psychology or coherence state");
assert.ok(legacy.adolescenceHandoff, "older saves should receive the adolescence handoff in place");

console.log("Age 13 childhood summary smoke test passed");
