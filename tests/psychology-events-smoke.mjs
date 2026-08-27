import assert from "node:assert/strict";
import { createNewLife } from "../game/engine.js";
import { ensurePsychologyState } from "../game/psychology.js";
import { ensurePsychologyPhase2State } from "../game/psychology-phase2.js";
import {
  decorateEventWithPsychology,
  psychologicalEventContext,
  syncPsychologyEventIntegration,
} from "../game/psychology-events-v2.js";

function schoolAgeState(seed = 42001) {
  const state = createNewLife(seed);
  state.character.ageMonths = 96;
  ensurePsychologyState(state);
  ensurePsychologyPhase2State(state);
  return state;
}

function setPattern(state, id, score) {
  state.psychology.coping.patterns[id].score = score;
}

const socialEvent = {
  id: "social_new_classroom",
  category: "Friends",
  title: "A different classroom",
  body: "The room is full of classmates settling into their places.",
  prompt: "What do you do?",
  choices: [
    { id: "approach", label: "Walk up and join them", result: "You step into the conversation." },
    { id: "withdraw", label: "Pull back and stay away", result: "You keep to the edge of the room." },
    { id: "help", label: "Ask a friend to come with you", result: "You approach together." },
  ],
};

assert.equal(psychologicalEventContext(socialEvent), "social");

const secure = schoolAgeState(42001);
Object.assign(secure.psychology.dimensions, {
  socialSafety: 74,
  threatSensitivity: 38,
  selfWorth: 68,
  resilience: 70,
  emotionalRegulation: 66,
});
setPattern(secure, "socialApproach", 42);
setPattern(secure, "withdrawal", 4);
setPattern(secure, "avoidance", 4);
const secureEvent = decorateEventWithPsychology(secure, socialEvent);
assert.match(secureEvent.body, /curiosity gets a chance/i, "socially safe child should receive a more open social lens");
assert.equal(secureEvent.choices[0].id, "approach", "familiar approach behavior should surface first without removing other choices");
assert.deepEqual(new Set(secureEvent.choices.map((choice) => choice.id)), new Set(socialEvent.choices.map((choice) => choice.id)), "psychology must never remove player choices");

const guarded = schoolAgeState(42002);
Object.assign(guarded.psychology.dimensions, {
  socialSafety: 34,
  threatSensitivity: 72,
  selfWorth: 42,
  resilience: 43,
  emotionalRegulation: 46,
});
setPattern(guarded, "socialApproach", 3);
setPattern(guarded, "withdrawal", 46);
setPattern(guarded, "avoidance", 38);
const guardedEvent = decorateEventWithPsychology(guarded, socialEvent);
assert.match(guardedEvent.body, /who already seems connected/i, "socially guarded child should scan belonging cues first");
assert.equal(guardedEvent.choices[0].id, "withdraw", "well-established withdrawal can surface as the first familiar reaction");
assert.notEqual(secureEvent.body, guardedEvent.body, "the exact same external event should feel different for different children");

const patterned = schoolAgeState(42003);
Object.assign(patterned.psychology.dimensions, { socialSafety: 53, threatSensitivity: 51 });
setPattern(patterned, "withdrawal", 8);
for (let i = 0; i < 5; i += 1) {
  patterned.history.push({ ageMonths: 72 + i * 3, eventId: `prior-${i}`, choiceId: "back", choice: "Pull back and stay away", result: "You avoid the situation." });
}
const patternedEvent = decorateEventWithPsychology(patterned, socialEvent);
assert.match(patternedEvent.body, /who already seems connected/i, "repeated choices should influence later narration even before a diagnostic label exists");

const recovering = schoolAgeState(42004);
recovering.character.ageMonths = 72;
Object.assign(recovering.psychology.dimensions, { socialSafety: 34, threatSensitivity: 72, resilience: 40 });
setPattern(recovering, "withdrawal", 42);
syncPsychologyEventIntegration(recovering);
recovering.character.ageMonths = 84;
Object.assign(recovering.psychology.dimensions, { socialSafety: 53, threatSensitivity: 59, resilience: 54 });
setPattern(recovering, "withdrawal", 24);
syncPsychologyEventIntegration(recovering);
recovering.character.ageMonths = 96;
Object.assign(recovering.psychology.dimensions, { socialSafety: 66, threatSensitivity: 48, resilience: 66 });
setPattern(recovering, "withdrawal", 10);
const recoveringEvent = decorateEventWithPsychology(recovering, socialEvent);
assert.ok(recoveringEvent.psychologyRecovery, "meaningful improvement over time should produce recovery-sensitive narration");
assert.match(recoveringEvent.body, /used to|lately|less authority|no longer|newer experiences/i, "recovery copy should acknowledge change rather than freezing the child in an old pattern");

const preschool = createNewLife(42005);
preschool.character.ageMonths = 48;
ensurePsychologyState(preschool);
ensurePsychologyPhase2State(preschool);
const preschoolEvent = decorateEventWithPsychology(preschool, socialEvent);
assert.equal(preschoolEvent.body, socialEvent.body, "school-age introspective narration should not be projected backward onto preschoolers");

assert.equal(secure.psychology.conditions, undefined, "event framing must not create diagnoses");
assert.equal(secure.psychology.diagnoses, undefined, "event framing must not create diagnoses");

console.log("Psychology-aware everyday event smoke test passed");
