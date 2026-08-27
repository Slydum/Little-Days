import assert from "node:assert/strict";
import { contextualEventForState, resolveContextualChoice } from "../game/contextual-events.js";
import { continueLife } from "../game/engine.js";

function baseState(ageMonths = 6) {
  return {
    version: 2,
    seed: 1234,
    rngState: 987654321,
    character: {
      firstName: "Mara",
      lastName: "Reyes",
      ageMonths,
      personality: { social: 50, risk: 50, structure: 50, sensitivity: 50, curiosity: 50, independence: 50 },
      development: { attachment: 55, confidence: 50, emotionalRegulation: 55, autonomy: 45, socialComfort: 45, persistence: 50 },
      patterns: { connecting: 0, exploring: 0, creating: 0, persisting: 0, selfReliance: 0 },
    },
    date: { year: 2026, month: 6, day: 10 },
    household: { financeBand: "Getting by", housing: "Small house", city: "Imus", country: "Philippines", neighborhood: "Growing", comfort: "Modest", privacy: "Moderate", savings: 10000 },
    health: { wellbeing: 70, energy: 65, stress: 20 },
    interests: { drawing: 20, reading: 20, gardening: 15, cooking: 15, gaming: 15, music: 15, making: 20 },
    education: { subjects: { mathematics: 50, language: 50, science: 50, art: 50, physicalEducation: 50 } },
    money: { savings: 0 },
    people: [
      { id: "mom", role: "guardian", name: "Isabel Reyes", age: 30, introducedAtMonths: 0, closeness: 65, trust: 65, affection: 70, conflict: 10, familiarity: 65, family: { caregiver: true, household: true }, history: [], npc: { outsideStress: 30, availability: 75, socialWorld: 35 } },
      { id: "dad-away", role: "parent", name: "Carlo Reyes", age: 31, introducedAtMonths: 0, closeness: 50, trust: 50, affection: 55, conflict: 15, familiarity: 45, family: { caregiver: false, household: false }, history: [], npc: { outsideStress: 30, availability: 40, socialWorld: 35 } },
      { id: "lola", role: "grandmother", name: "Lola Rosa Cruz", age: 58, introducedAtMonths: 0, closeness: 55, trust: 55, affection: 65, conflict: 8, familiarity: 55, family: { caregiver: false, household: false }, history: [], npc: { outsideStress: 25, availability: 60, socialWorld: 30 } },
    ],
    realism: { active: [], latest: [], family: { primaryCaregiverId: "mom" } },
    history: [], memories: [], worldEvents: [], recentEventIds: [], currentEventId: "family_evening", resolution: null, completed: false,
  };
}

{
  const state = baseState(6);
  const event = contextualEventForState(state);
  assert.equal(event.id, "context_dev_reach");
  assert.equal(event.category, "Self");
  assert.ok(event.choices.every((choice) => !/tell someone about your day/i.test(choice.label)));
}

{
  const state = baseState(6);
  state.realism.active = [{ id: "ill-1", label: "respiratory infection", severity: 2, delayed: true }];
  const event = contextualEventForState(state);
  assert.equal(event.category, "Health");
  assert.match(event.title, /sick|well/i);
  assert.match(event.body, /medical care|care/i);
  resolveContextualChoice(state, event.choices[0].id);
  assert.equal(state.contextual.illness.turns, 1);
  assert.ok(state.resolution?.contextualEvent);

  state.resolution = null;
  state.realism.active = [];
  state.realism.latest = [];
  const recovery = contextualEventForState(state);
  assert.equal(recovery.id, "context_recovery");
}

{
  const state = baseState(72);
  state.realism.latest = [{ category: "Family", text: "Isabel lost their job. Money at home becomes more uncertain while the adults figure out what comes next.", importance: 4, ageMonths: 72, personId: "mom" }];
  const event = contextualEventForState(state);
  assert.match(event.id, /context_thread_job_loss_0/);
  assert.match(event.body, /job|money/i);
  resolveContextualChoice(state, event.choices[0].id);
  assert.equal(state.contextual.activeThread.stage, 1);

  state.resolution = null;
  state.realism.latest = [];
  const followup = contextualEventForState(state);
  assert.match(followup.id, /context_thread_job_loss_1/);
  assert.match(followup.body, /choices|purchases|money/i);
}

{
  const state = baseState(60);
  const event = contextualEventForState(state);
  assert.equal(event.id, "context_household_child");
  assert.match(event.body, /Isabel/);
  assert.doesNotMatch(event.body, /Carlo|Rosa/);
}

{
  const state = baseState(0);
  state.resolution = { choiceId: "dummy", result: "done" };
  const before = state.character.ageMonths;
  continueLife(state);
  assert.equal(state.character.ageMonths - before, 3, "infancy should advance in three-month turns");
}

console.log("contextual life loop smoke test passed");
