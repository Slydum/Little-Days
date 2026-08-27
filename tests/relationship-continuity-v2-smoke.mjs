import assert from "node:assert/strict";
import { createNewLife } from "../game/engine-v28.js";
import {
  childhoodEventForState,
  ensureChildhoodState,
  relationshipContinuitySnapshot,
} from "../game/childhood-v4.js";
import { resolveChildhoodChoice } from "../game/childhood-v3-resolve.js";

let state = null;
for (let seed = 1; seed <= 30; seed += 1) {
  const candidate = createNewLife(seed);
  if (candidate.people.some((p) => p.role === "sibling") && candidate.people.some((p) => p.role === "grandmother")) {
    state = candidate;
    break;
  }
}
assert.ok(state, "expected a generated life with sibling and grandmother coverage");

state.character.ageMonths = 72;
state.date.year = state.character.birthYear + 6;
ensureChildhoodState(state);
state.childhood.eventQueue = [];

const guardian = state.people.find((p) => p.role === "guardian");
const friend = state.people.find((p) => p.role === "friend");
const teacher = state.people.find((p) => p.role === "teacher");
const sibling = state.people.find((p) => p.role === "sibling");
const grandmother = state.people.find((p) => p.role === "grandmother");
for (const person of [guardian, friend, teacher, sibling, grandmother]) {
  assert.ok(person?.continuity, `${person?.role || "person"} should have a continuity arc`);
}

for (const person of state.people) {
  if (person.continuity) person.continuity.lastBeatAtMonths = state.character.ageMonths;
}
guardian.continuity.lastBeatAtMonths = 48;
state.relationshipContinuity.queue = [];
state.relationshipContinuity.lastGlobalBeatAtMonths = -120;

const firstEvent = childhoodEventForState(state);
assert.equal(firstEvent.relationshipPersonId, guardian.id, "guardian should receive the first forced relationship beat");
assert.equal(firstEvent.contextKind, "relationship-continuity-v2");
assert.ok(firstEvent.choices.length >= 3);
resolveChildhoodChoice(state, firstEvent.choices[0].id);
assert.equal(state.resolution?.childhoodEventId, firstEvent.id, "relationship beat should resolve through the live childhood resolver");
assert.equal(guardian.continuity.beatCount, 1);
assert.ok(guardian.history.some((entry) => entry.eventId === "relationship-continuity-v2"), "person history should preserve the relationship beat");
assert.ok(guardian.npc.currentThread.includes("Right now"), "person profile thread should be updated");
assert.ok(state.memories.some((memory) => memory.personId === guardian.id), "major relationship beat should become a person-linked memory");

state.resolution = null;
state.character.ageMonths += 12;
state.date.year += 1;
state.childhood.eventQueue = [];
state.relationshipContinuity.queue = [];
state.relationshipContinuity.lastGlobalBeatAtMonths = state.character.ageMonths - 12;
for (const person of state.people) {
  if (person.continuity && person.id !== guardian.id) person.continuity.lastBeatAtMonths = state.character.ageMonths;
}
guardian.continuity.lastBeatAtMonths = state.character.ageMonths - 12;

const secondEvent = childhoodEventForState(state);
assert.equal(secondEvent.relationshipPersonId, guardian.id, "the same guardian should continue their thread");
assert.notEqual(secondEvent.id, firstEvent.id, "continuity beats should progress rather than repeat the same event id");
assert.match(secondEvent.body, /Earlier,/i, "later relationship beats should reference earlier shared history");
resolveChildhoodChoice(state, secondEvent.choices[0].id);
assert.equal(guardian.continuity.beatCount, 2);
assert.equal(guardian.continuity.significantMoments.length, 2);

state.resolution = null;
state.character.ageMonths += 12;
state.date.year += 1;
state.childhood.eventQueue = [];
state.relationshipContinuity.queue = [];
state.relationshipContinuity.lastGlobalBeatAtMonths = state.character.ageMonths - 12;
for (const person of state.people) {
  if (person.continuity) person.continuity.lastBeatAtMonths = state.character.ageMonths;
}
friend.continuity.lastBeatAtMonths = state.character.ageMonths - 12;
friend.school ||= {};
friend.school.friendshipStatus = "friend";
friend.school.currentClass = true;

const friendEvent = childhoodEventForState(state);
assert.equal(friendEvent.relationshipPersonId, friend.id, "friend should receive a persistent relationship beat");
resolveChildhoodChoice(state, friendEvent.choices[0].id);
const friendSnapshot = relationshipContinuitySnapshot(state, friend.id);
assert.equal(friendSnapshot.beatCount, 1);
assert.ok(friendSnapshot.currentThread.length > 20);

console.log("Relationship Continuity v2 smoke test passed");
