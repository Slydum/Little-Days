import assert from "node:assert/strict";
import { createNewLife } from "../game/engine-v25.js";
import {
  childhoodEventForState,
  ensureChildhoodState,
  friendshipDriftPressure,
} from "../game/childhood-v3.js";

const state = createNewLife(9001);
state.character.ageMonths = 108;
ensureChildhoodState(state);

const friend = state.people.find((person) => person.role === "friend");
assert.ok(friend, "test life should have a friend");
friend.introducedAtMonths = 60;
friend.lastInteractionAtMonths = 60;
friend.closeness = 64;
friend.trust = 62;
friend.conflict = 8;
friend.npc.socialWorld = 84;
friend.school = {
  ...(friend.school || {}),
  friendshipStatus: "friend",
  currentClass: true,
  transferred: false,
  lastAmbientContactAtMonths: 108,
};

assert.ok(friendshipDriftPressure(state, friend) < 3, "healthy same-class friendship should not have enough pressure to drift");
state.childhood.eventQueue = [{
  key: "drift:test:9",
  type: "friend_drift",
  personId: friend.id,
  priority: 42,
  createdAtMonths: 108,
}];
childhoodEventForState(state);
assert.ok(!state.childhood.eventQueue.some((item) => item.type === "friend_drift"), "unearned same-class drift event should be suppressed");

friend.school.currentClass = false;
friend.school.transferred = true;
friend.school.lastAmbientContactAtMonths = 60;
friend.lastInteractionAtMonths = 60;
friend.closeness = 43;
friend.trust = 41;
friend.conflict = 30;
friend.npc.socialWorld = 82;
assert.ok(friendshipDriftPressure(state, friend) >= 3, "transfer, low trust, conflict, and long separation should create legitimate drift pressure");

console.log("Friendship continuity smoke test passed");
