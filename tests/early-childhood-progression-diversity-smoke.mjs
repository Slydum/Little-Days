import assert from "node:assert/strict";
import {
  createNewLife,
  getCurrentEvent,
  resolveChoice,
} from "../game/engine-v30.js";
import { continueLife as continueMajorLife } from "../game/engine-v29.js";
import { contextualEventForState } from "../game/contextual-events-v3.js";

function progression(seed, turns = 6) {
  const state = createNewLife(seed);
  const ids = [];

  for (let turn = 0; turn < turns && (state.character?.ageMonths || 0) < 24; turn += 1) {
    const contextual = contextualEventForState(state);
    assert.notEqual(
      contextual?.contextKind,
      "development",
      "healthy infancy must not be forced through the legacy fixed developmental lane",
    );

    const event = getCurrentEvent(state);
    assert.ok(event, `expected a playable early-childhood event for seed ${seed}`);
    ids.push(event.id);

    const choice = event.choices?.[0];
    assert.ok(choice, `event ${event.id} should have a choice`);
    resolveChoice(state, choice.id);
    continueMajorLife(state);
  }

  return ids;
}

const sequences = [];
for (let seed = 7001; seed <= 7040; seed += 1) sequences.push(progression(seed));

const signatures = new Set(sequences.map((ids) => ids.join(" > ")));
assert.ok(
  signatures.size >= 12,
  `expected broad story-order diversity across lives, got only ${signatures.size} distinct sequences`,
);

const longest = Math.max(...sequences.map((ids) => ids.length));
for (let position = 0; position < longest; position += 1) {
  const eventsHere = new Set(sequences.map((ids) => ids[position]).filter(Boolean));
  if (position < 4) {
    assert.ok(
      eventsHere.size >= 3,
      `early turn ${position + 1} is still too deterministic: ${[...eventsHere].join(", ")}`,
    );
  }
}

assert.ok(
  !sequences.every((ids) => ids.slice(0, 4).join("|") === sequences[0].slice(0, 4).join("|")),
  "different lives must not share one fixed infant story skeleton",
);

console.log(`Early-childhood progression diversity smoke test passed with ${signatures.size} distinct sequences across ${sequences.length} lives.`);
