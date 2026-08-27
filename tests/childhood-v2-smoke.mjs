import assert from "node:assert/strict";
import { createNewLife } from "../game/engine.js";
import { advanceChildhoodWorld, ensureChildhoodState, socialSnapshot } from "../game/childhood-v2.js";

const state = createNewLife(24681357);
state.character.ageMonths = 60;
state.date.year = 2031;
ensureChildhoodState(state);
advanceChildhoodWorld(state, 3, 57);

let social = socialSnapshot(state);
assert.ok(social.friends.length >= 2, "school-age children should be able to have more than one friend");
assert.ok(state.childhood.eventQueue.some((event) => event.type === "new_friend"), "a newly introduced friend should produce a playable event");

state.character.ageMonths = 120;
for (let i = 0; i < 160 && !state.childhood.crush; i += 1) {
  advanceChildhoodWorld(state, 3, 117);
}

social = socialSnapshot(state);
assert.ok(social.friends.length >= 2, "the social circle should persist independently across multiple friends");
assert.ok(state.childhood.crush, "preteen simulation should be able to generate an age-appropriate crush");
assert.ok(state.childhood.crush.personId, "a crush should point to a real known peer");
assert.ok(state.people.some((person) => person.id === state.childhood.crush.personId), "the crush must be an actual persistent person");

console.log(`Childhood v2 smoke test passed with ${social.friends.length} friends and crush ${social.crush?.name || state.childhood.crush.personId}.`);
