import { advanceRealism, ensureRealismState, getAroundYou, getBirthdayRecap, healthSnapshot } from "../game/realism.js";

const state = {
  version: 2,
  seed: 123456,
  rngState: 987654,
  character: {
    firstName: "Test",
    lastName: "Reyes",
    ageMonths: 0,
    development: { attachment: 60 },
  },
  date: { year: 2026, month: 0, day: 12 },
  household: {
    financeBand: "Getting by",
    comfort: "Modest",
    privacy: "Moderate",
    housing: "Modest townhouse",
    city: "Imus",
    country: "Philippines",
    savings: 15000,
  },
  health: { wellbeing: 75, energy: 70, stress: 20 },
  people: [
    {
      id: "guardian-ana",
      role: "guardian",
      name: "Ana Reyes",
      age: 29,
      introducedAtMonths: 0,
      closeness: 65,
      trust: 67,
      affection: 72,
      conflict: 10,
      familiarity: 65,
      npc: { outsideStress: 36, availability: 72, socialWorld: 35, currentThread: "", lastChangedAtMonths: 0 },
    },
    {
      id: "guardian-marco",
      role: "secondGuardian",
      name: "Marco Reyes",
      age: 31,
      introducedAtMonths: 0,
      closeness: 61,
      trust: 63,
      affection: 70,
      conflict: 12,
      familiarity: 64,
      npc: { outsideStress: 40, availability: 68, socialWorld: 38, currentThread: "", lastChangedAtMonths: 0 },
    },
    {
      id: "friend-maya",
      role: "friend",
      name: "Maya Santos",
      age: 0,
      introducedAtMonths: 60,
      closeness: 58,
      trust: 59,
      affection: 62,
      conflict: 7,
      familiarity: 55,
      npc: { outsideStress: 18, availability: 75, socialWorld: 48, currentThread: "", lastChangedAtMonths: 0 },
    },
  ],
  memories: [],
  history: [],
  worldEvents: [],
  completed: false,
  currentEventId: "held_after_crying",
  resolution: null,
};

ensureRealismState(state);
if (!state.realism?.family) throw new Error("Living household state was not initialized");
if (!state.people.every((person) => person.npc.realism)) throw new Error("NPC life profiles were not initialized");

for (let turn = 0; turn < 30 && !state.death; turn += 1) {
  const before = state.character.ageMonths;
  const elapsed = before < 24 ? 6 : before < 72 ? 4 : 3;
  state.character.ageMonths += elapsed;
  state.date.month += elapsed;
  state.date.year += Math.floor(state.date.month / 12);
  state.date.month %= 12;
  advanceRealism(state, elapsed, before);
  getAroundYou(state);
  getBirthdayRecap(state);
  healthSnapshot(state);
}

if (!Array.isArray(state.worldEvents)) throw new Error("World history was not preserved");
if (typeof state.realism.family.atmosphere !== "number") throw new Error("Family atmosphere stopped being numeric");
if (!state.people.every((person) => person.npc?.realism)) throw new Error("A generated person is missing a life profile");

console.log("Living household smoke test passed");
