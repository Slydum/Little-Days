import assert from "node:assert/strict";
import {
  EARLY_EVENTS,
  continueLife,
  createNewLife,
  getCurrentEvent,
  resolveChoice,
} from "../game/engine-v26.js";

const earlyIds = new Set(EARLY_EVENTS.map((event) => event.id));
const openings = new Set();

for (let seed = 1; seed <= 30; seed += 1) {
  const state = createNewLife(seed);
  const event = getCurrentEvent(state);
  assert.ok(earlyIds.has(event.id), `seed ${seed} should begin with an early-childhood event`);
  openings.add(event.id);
}

assert.ok(openings.size >= 3, `expected varied newborn openings, got only ${openings.size}`);

const life = createNewLife(424242);
const seen = [];
while ((life.character?.ageMonths || 0) < 60) {
  const event = getCurrentEvent(life);
  assert.ok(earlyIds.has(event.id), `age ${life.character.ageMonths} should use the early-childhood pool`);
  assert.ok(!seen.includes(event.id), `early-childhood event repeated in one life: ${event.id}`);
  seen.push(event.id);
  assert.ok(event.choices.length >= 2, `${event.id} should provide meaningful choice variety`);
  resolveChoice(life, event.choices[0].id);
  assert.equal(life.resolution?.earlyEventId, event.id, `${event.id} should resolve as a real early event`);
  continueLife(life);
}

assert.ok(seen.length >= 12, `expected a substantial 0-5 event run, got ${seen.length}`);
assert.ok(life.history.filter((entry) => earlyIds.has(entry.eventId)).length >= 12, "early events should be recorded in actual life history");

console.log(`Early-childhood variety smoke test passed with ${openings.size} distinct openings and ${seen.length} unique events in one life`);
