import assert from "node:assert/strict";
import { createNewLife } from "../game/engine.js";
import { advanceChildhoodWorld, ensureChildhoodState, schoolWorldSnapshot, socialSnapshot } from "../game/childhood-v2.js";

const failures = [];
let crushLives = 0;
let multiFriendLives = 0;
let recapCount = 0;
let maxKnownPeers = 0;

for (let seed = 1; seed <= 100; seed += 1) {
  try {
    const state = createNewLife(900000 + seed * 7919);
    state.character.ageMonths = 57;
    state.date.year = 2030;
    state.date.month = state.character.birthMonth || 0;
    ensureChildhoodState(state);

    for (let months = 60; months <= 153; months += 3) {
      const before = state.character.ageMonths;
      state.character.ageMonths = months;
      const total = (state.character.birthMonth || 0) + months;
      state.date.year = state.character.birthYear + Math.floor(total / 12);
      state.date.month = total % 12;
      advanceChildhoodWorld(state, months - before, before);

      const school = schoolWorldSnapshot(state);
      const social = socialSnapshot(state);
      assert.ok(school, `seed ${seed}: school snapshot should exist after age five`);
      assert.ok(school.teacher && !school.teacher.deceased, `seed ${seed}: current teacher must be a living known teacher`);
      assert.equal(school.teacher.role, "teacher", `seed ${seed}: current teacher must carry the current teacher role`);
      assert.ok(school.classSizeKnown >= 2, `seed ${seed}: class should contain multiple known peers`);
      assert.ok(school.attendance >= 0 && school.attendance <= 100, `seed ${seed}: attendance out of range`);
      assert.ok(school.effort >= 0 && school.effort <= 100, `seed ${seed}: effort out of range`);
      assert.ok(school.overallPerformance >= 0 && school.overallPerformance <= 100, `seed ${seed}: performance out of range`);

      const ids = state.people.map((person) => person.id);
      assert.equal(new Set(ids).size, ids.length, `seed ${seed}: duplicate person ids detected`);
      for (const classmate of school.classmates) {
        assert.ok(state.people.some((person) => person.id === classmate.id), `seed ${seed}: class references a missing person`);
        assert.ok(!classmate.deceased, `seed ${seed}: deceased classmate should not remain in current class`);
      }

      const bestFriends = social.friendTiers.filter((entry) => entry.tier === "Best friend");
      assert.ok(bestFriends.length <= 1, `seed ${seed}: more than one best friend was assigned at once`);
      if (months < 108) assert.equal(state.childhood.crush, null, `seed ${seed}: crush appeared before the age gate`);
      if (state.childhood.crush) {
        const crushPerson = state.people.find((person) => person.id === state.childhood.crush.personId);
        assert.ok(crushPerson, `seed ${seed}: crush references a missing person`);
        assert.equal(crushPerson.role, "friend", `seed ${seed}: crush must be a known friend, not an invented stranger`);
      }

      for (const queued of state.childhood.eventQueue) {
        if (queued.personId) assert.ok(state.people.some((person) => person.id === queued.personId), `seed ${seed}: queued event references a missing person`);
        if (queued.secondaryPersonId) assert.ok(state.people.some((person) => person.id === queued.secondaryPersonId), `seed ${seed}: queued event references a missing secondary person`);
      }
    }

    const social = socialSnapshot(state);
    const school = schoolWorldSnapshot(state);
    if (social.friends.length >= 2) multiFriendLives += 1;
    if (state.childhood.crush) crushLives += 1;
    recapCount += school.recentRecap ? 1 : 0;
    maxKnownPeers = Math.max(maxKnownPeers, school.classmates.length);
    assert.ok(social.friends.length >= 2, `seed ${seed}: childhood ended with fewer than two friends`);
    assert.ok(school.recentRecap, `seed ${seed}: school-year history should produce at least one recap`);
  } catch (error) {
    failures.push(error.message);
  }
}

assert.equal(failures.length, 0, `100-life school QA failures:\n${failures.slice(0, 20).join("\n")}`);
assert.equal(multiFriendLives, 100, "every simulated school-age life should support multiple friends");
assert.ok(crushLives > 0, "crushes should occur in some, but not necessarily all, preteen lives");
assert.ok(recapCount > 0, "school recaps should be generated");

console.log(`100-life school/social QA passed. ${multiFriendLives}/100 had multiple friends, ${crushLives}/100 had an active preteen crush at the end, max known class size ${maxKnownPeers}.`);
