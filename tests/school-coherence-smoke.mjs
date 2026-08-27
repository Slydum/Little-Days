import assert from "node:assert/strict";
import { createNewLife } from "../game/engine-v28.js";
import { advanceChildhoodWorld, ensureChildhoodState, schoolWorldSnapshot } from "../game/childhood-v5.js";
import { commitSchoolCoherenceEvent, schoolCoherenceEventForState, syncSchoolCoherence } from "../game/school-coherence.js";

const state = createNewLife(918273);
state.character.ageMonths = 57;
state.date.year = 2030;
state.date.month = state.character.birthMonth || 0;
ensureChildhoodState(state);

const teachers = new Set();
let sawReturningClassmate = false;

for (let months = 60; months <= 126; months += 3) {
  const before = state.character.ageMonths;
  state.character.ageMonths = months;
  const total = (state.character.birthMonth || 0) + months;
  state.date.year = state.character.birthYear + Math.floor(total / 12);
  state.date.month = total % 12;
  advanceChildhoodWorld(state, months - before, before);

  // Create two durable academic patterns so the coherence layer has something
  // longitudinal to recognize rather than merely echoing one term.
  state.childhood.school.performance.mathematics = 48;
  state.childhood.school.performance.art = 80;
  state.education.subjects.mathematics = 48;
  state.education.subjects.art = 80;
  state.childhood.school.overallPerformance = 64;
  syncSchoolCoherence(state);

  const snapshot = schoolWorldSnapshot(state);
  assert.ok(snapshot?.coherence, "school snapshot should expose longitudinal coherence");
  assert.equal(typeof snapshot.coherence.trajectory, "string", "school trajectory should be qualitative text");
  assert.equal(typeof snapshot.coherence.continuityNote, "string", "class continuity should be described qualitatively");
  if (snapshot.teacher?.id) teachers.add(snapshot.teacher.id);
  if ((snapshot.coherence.currentYear?.returningClassmates || 0) > 0) sawReturningClassmate = true;
}

const root = state.schoolCoherence;
const years = Object.values(root.years).sort((a, b) => a.yearIndex - b.yearIndex);
assert.ok(years.length >= 5, `expected multiple tracked school years, got ${years.length}`);
assert.ok(teachers.size >= 3, `teachers should change across years, got ${teachers.size} distinct teachers`);
assert.ok(sawReturningClassmate, "at least one school year should preserve a familiar classmate");

const finalSnapshot = schoolWorldSnapshot(state).coherence;
assert.ok(finalSnapshot.strengths.includes("Art"), `repeated strong Art performance should become a strength: ${finalSnapshot.strengths.join(", ")}`);
assert.ok(finalSnapshot.struggles.includes("Math"), `repeated low Math performance should become a recurring struggle: ${finalSnapshot.struggles.join(", ")}`);
assert.ok(finalSnapshot.recentYears.length >= 3, "school story should retain recent year history");

const event = schoolCoherenceEventForState(state);
assert.ok(event, "a repeated multi-year school pattern should be eligible for a coherence event");
assert.ok(["persistent_struggle", "persistent_strength", "activity_identity", "after_difficult_year", "after_strong_year"].includes(event.schoolCoherenceType), `unexpected school coherence event type ${event.schoolCoherenceType}`);
assert.ok(event.choices.length >= 3, "school coherence event should offer meaningful choices");

const memoryCount = state.memories.length;
commitSchoolCoherenceEvent(state, event, event.choices[0]);
assert.ok(root.seen.includes(event.schoolCoherenceKey), "resolved school coherence beat should be marked seen");
if (["persistent_struggle", "persistent_strength", "after_difficult_year", "activity_identity"].includes(event.schoolCoherenceType)) {
  assert.ok(state.memories.length >= memoryCount + 1, "formative school pattern should create a memory");
}

console.log(`School coherence smoke test passed across ${years.length} school years with ${teachers.size} teachers.`);
