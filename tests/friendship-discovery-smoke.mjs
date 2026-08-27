import assert from "node:assert/strict";
import { createNewLife } from "../game/engine-v30.js";
import {
  advanceChildhoodWorld,
  childhoodEventForState,
  ensureChildhoodState,
  socialSnapshot,
} from "../game/childhood-v8.js";
import { resolveChildhoodChoice } from "../game/childhood-v7-resolve.js";

function schoolStart(seed) {
  const state = ensureChildhoodState(createNewLife(seed));
  assert.equal(socialSnapshot(state).friends.length, 0, "a newborn should not already have a friend");
  state.character.ageMonths = 60;
  state.date.year = state.character.birthYear + 5;
  advanceChildhoodWorld(state, 3, 57);
  return state;
}

function friendshipQueueItem(state, person) {
  return (state.childhood?.eventQueue || []).find((item) => item.personId === person.id && item.type === "friendship_opening") || null;
}

function isolateFriendshipOpening(state, person) {
  const queued = friendshipQueueItem(state, person);
  assert.ok(queued, "potential friendship should be queued as a friendship opening");
  state.childhood.eventQueue = [queued];
  if (state.relationshipContinuity) {
    state.relationshipContinuity.queue = [];
    state.relationshipContinuity.lastGlobalBeatAtMonths = state.character.ageMonths;
  }
  if (state.schoolCoherence) {
    state.schoolCoherence.queue = [];
    state.schoolCoherence.lastGlobalBeatAtMonths = state.character.ageMonths;
  }
  const opening = childhoodEventForState(state);
  assert.ok(opening, "friendship opening should become playable when it reaches the front of the story");
  assert.match(opening.id || "", /friendship_opening/);
  return opening;
}

const acquaintanceLife = schoolStart(44117);
assert.equal(socialSnapshot(acquaintanceLife).friends.length, 0, "school should begin with classmates, not automatic friends");
const candidate = (acquaintanceLife.people || []).find((person) => person.school?.friendshipCandidate === true);
assert.ok(candidate, "school should be able to create a potential friendship");
assert.equal(candidate.role, "classmate", "a potential friend should remain a classmate before the player lives the friendship");
assert.equal(candidate.relationshipLabel, "Classmate");
assert.ok(friendshipQueueItem(acquaintanceLife, candidate), "automatic friend creation should be rewritten as a friendship-opening queue item");
const opening = isolateFriendshipOpening(acquaintanceLife, candidate);
assert.ok(opening.choices.some((choice) => choice.id === "class"), "the player must be allowed to keep the relationship as a classmate");
resolveChildhoodChoice(acquaintanceLife, "class");
assert.equal(candidate.role, "classmate", "choosing classroom-only contact must not secretly create a friendship");
assert.equal(socialSnapshot(acquaintanceLife).friends.length, 0);

const friendshipLife = schoolStart(88231);
const candidate2 = (friendshipLife.people || []).find((person) => person.school?.friendshipCandidate === true);
assert.ok(candidate2);
isolateFriendshipOpening(friendshipLife, candidate2);
resolveChildhoodChoice(friendshipLife, "friend");
assert.equal(candidate2.role, "friend", "choosing to seek the classmate out should be what creates the friendship");
assert.ok(socialSnapshot(friendshipLife).friends.some((person) => person.id === candidate2.id));

console.log("Friendship discovery smoke test passed");
