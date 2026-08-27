import assert from "node:assert/strict";
import {
  continueLife,
  createNewLife,
  getCurrentEvent,
  resolveChoice,
} from "../game/engine-v30.js";
import {
  advanceChildhoodWorld,
  childhoodEventForState,
  ensureChildhoodState,
} from "../game/childhood-v7.js";
import { resolveChildhoodChoice } from "../game/childhood-v6-resolve.js";
import {
  availableRelationshipActions,
  ensureChildhoodDepth,
  npcKnowledgeSnapshot,
  queueRelationshipInteraction,
} from "../game/childhood-depth.js";

function step(state) {
  ensureChildhoodState(state);
  const childhood = childhoodEventForState(state);
  if (childhood) resolveChildhoodChoice(state, childhood.choices[0].id);
  else {
    const event = getCurrentEvent(state);
    assert.ok(event, "a playable event should exist");
    resolveChoice(state, event.choices[0].id);
  }
  assert.ok(state.resolution, "a choice should resolve");
  const before = state.character.ageMonths;
  continueLife(state);
  const elapsed = state.character.ageMonths - before;
  advanceChildhoodWorld(state, elapsed, before);
  return { elapsed, childhood };
}

// A full childhood should contain substantially more lived scenes than the old ~47 major turns.
const life = ensureChildhoodState(createNewLife(81234));
let scenes = 0;
let zeroMonthScenes = 0;
let guard = 0;
while (!life.completed && guard < 220) {
  const before = life.character.ageMonths;
  step(life);
  scenes += 1;
  if (life.character.ageMonths === before) zeroMonthScenes += 1;
  guard += 1;
}
assert.ok(life.completed, "depth-paced life should still reach age 13");
assert.ok(scenes >= 70, `childhood should contain at least 70 playable scenes, got ${scenes}`);
assert.ok(zeroMonthScenes >= 18, `ordinary scenes should sometimes happen without a multi-month jump, got ${zeroMonthScenes}`);

// Player-initiated relationship time should be extra time, not another 3-month jump.
const social = ensureChildhoodState(createNewLife(91021));
social.character.ageMonths = 96;
ensureChildhoodDepth(social);
const friend = (social.people || []).find((person) => person.role === "friend" && !person.deceased);
assert.ok(friend, "test life should have a friend");
friend.introducedAtMonths = Math.min(friend.introducedAtMonths || 60, 60);
const actions = availableRelationshipActions(social, friend.id);
assert.ok(actions.some((action) => action.id === "spend" || action.id === "talk"), "friend profile should offer an age-appropriate interaction");
const action = actions.find((item) => item.id === "talk") || actions[0];
assert.equal(queueRelationshipInteraction(social, friend.id, action.id), true, "profile action should queue an interaction");
const interaction = childhoodEventForState(social);
assert.equal(interaction?.childhoodDepthKind, "interaction", "queued interaction should become the next relationship scene");
const beforeAge = social.character.ageMonths;
resolveChildhoodChoice(social, interaction.choices[0].id);
assert.equal(social.resolution?.depthKind, "interaction");
continueLife(social);
assert.equal(social.character.ageMonths, beforeAge, "player-initiated time together should not skip months");
assert.equal(social.resolution, null, "interaction should finish cleanly");
assert.equal(social.childhoodDepth.interactionBudget.used, 1, "interaction should consume a limited social-action slot");

// NPC identity is richer than the old relationship-derived personality card and remains partly unknown.
const knowledge = npcKnowledgeSnapshot(social, friend.id);
assert.ok(knowledge, "friend should have a knowledge snapshot");
assert.ok(knowledge.unknownCount > 0, "the player should not magically know everything about a friend");
assert.ok(knowledge.known.length < knowledge.known.length + knowledge.unknownCount, "NPC knowledge should be discoverable over time");

console.log(`Childhood depth pacing smoke test passed with ${scenes} scenes (${zeroMonthScenes} ordinary/extra-time scenes).`);
