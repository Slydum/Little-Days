import {
  contextualEventForState as coreContextualEventForState,
  resolveContextualChoice as coreResolveContextualChoice,
} from "./contextual-events-core.js?v=1";

const CAREGIVER_THREAD = "caregiver_change";
const CAREGIVER_STAGE_TWO_EVENT = "context_thread_caregiver_change_1";
const LEGACY_REPEAT_WINDOW_MONTHS = 18;
const CUSTOM_THREADS = new Set(["death", "affair", "separation", "move", "birth", "job_loss", "caregiver_change", "family_health", "family_crisis"]);
const clamp = (value, min = 0, max = 100) => Math.max(min, Math.min(max, value));

function currentCaregiverId(state) {
  return state?.realism?.family?.primaryCaregiverId || null;
}

function personById(state, id) {
  return (state.people || []).find((person) => person.id === id) || null;
}

function firstName(person, fallback = "someone in your family") {
  const parts = String(person?.name || "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return fallback;
  const honorifics = new Set(["Lola", "Lolo", "Auntie", "Uncle", "Tita", "Tito"]);
  return honorifics.has(parts[0]) && parts[1] ? `${parts[0]} ${parts[1]}` : parts[0];
}

function primaryCaregiver(state) {
  return personById(state, currentCaregiverId(state))
    || (state.people || []).find((person) => ["guardian", "secondGuardian"].includes(person.role) && !person.deceased)
    || null;
}

function relationship(person, key, delta) {
  return person ? { type: "relationship", targetId: person.id, key, delta } : null;
}

function effects(...items) {
  return items.filter(Boolean);
}

function choice(id, label, result, choiceEffects = []) {
  return { id, label, result, effects: choiceEffects };
}

function caregiverText(value) {
  const text = String(value || "").toLowerCase();
  return text.includes("everyday care lately")
    || text.includes("handling more of your everyday care")
    || text.includes("primary caregiver");
}

function isCaregiverUpdate(item) {
  return item?.category === "Family" && caregiverText(item.text || item.note);
}

function ensureCaregiverContinuity(state) {
  state.contextual ||= {};
  state.contextual.caregiverContinuity ||= { lastCompletedCaregiverId: null, lastCompletedAtMonths: null };
  return state.contextual.caregiverContinuity;
}

function inferLegacyCompletion(state, continuity) {
  if (continuity.lastCompletedCaregiverId) return;
  const thread = state.contextual?.activeThread;
  if (thread?.type !== CAREGIVER_THREAD) return;
  const currentId = currentCaregiverId(state);
  if (!currentId || (thread.personId && thread.personId !== currentId)) return;

  const completed = [...(state.history || [])].reverse().find((item) => item?.eventId === CAREGIVER_STAGE_TWO_EVENT);
  if (!completed) return;
  const currentAge = state.character?.ageMonths || 0;
  const completedAge = completed.ageMonths ?? -9999;
  const threadAge = thread.ageMonths ?? currentAge;
  if (Math.min(Math.abs(currentAge - completedAge), Math.abs(threadAge - completedAge)) > LEGACY_REPEAT_WINDOW_MONTHS) return;

  continuity.lastCompletedCaregiverId = currentId;
  continuity.lastCompletedAtMonths = completedAge;
}

function hideCaregiverDuplicates(state) {
  if (Array.isArray(state.realism?.latest)) state.realism.latest = state.realism.latest.filter((item) => !isCaregiverUpdate(item));
  if (Array.isArray(state.realism?.birthday?.items)) state.realism.birthday.items = state.realism.birthday.items.filter((text) => !caregiverText(text));
}

function suppressCompletedCaregiverThread(state, continuity) {
  const currentId = currentCaregiverId(state);
  if (!currentId || continuity.lastCompletedCaregiverId !== currentId) return;
  const thread = state.contextual?.activeThread;
  if (thread?.type === CAREGIVER_THREAD && (!thread.personId || thread.personId === currentId)) state.contextual.activeThread = null;
  hideCaregiverDuplicates(state);
}

function prepareCaregiverContinuity(state) {
  if (!state?.character) return null;
  const continuity = ensureCaregiverContinuity(state);
  inferLegacyCompletion(state, continuity);
  suppressCompletedCaregiverThread(state, continuity);
  return continuity;
}

function clarifyCaregiverEvent(state, event) {
  if (!event || event.threadType !== CAREGIVER_THREAD) return event;
  if (state.realism?.family?.partnership?.status !== "together") return event;
  if (String(event.body || "").includes("not a separation")) return event;
  return { ...event, body: `${event.body} Your parents are still together. This is a change in who handles more of your day-to-day care, not a separation.` };
}

function hideActiveThreadDuplicate(state, event) {
  if (!event || event.contextKind !== "thread") return;
  const sourceText = String(state.contextual?.activeThread?.text || "").trim();
  if (!sourceText) return;
  if (Array.isArray(state.realism?.latest)) {
    state.realism.latest = state.realism.latest.filter((item) => String(item?.text || item?.note || "").trim() !== sourceText);
  }
  if (Array.isArray(state.realism?.birthday?.items)) {
    state.realism.birthday.items = state.realism.birthday.items.filter((text) => String(text || "").trim() !== sourceText);
  }
}

function promptFor(type, person, stage) {
  const who = firstName(person, "them");
  const prompts = {
    death: stage ? "How do you carry the loss now?" : "How do you respond to the loss?",
    affair: "What do you do with the tension at home?",
    separation: stage ? "How do you settle into the new routine?" : "What do you need to understand first?",
    move: stage ? "How do you make the new place feel familiar?" : "What matters most as you move?",
    birth: "How do you find your place in the new family routine?",
    job_loss: "How do you respond to the money changes?",
    caregiver_change: "How do you settle into the new caregiving routine?",
    family_health: `How do you respond to ${who} being unwell?`,
    family_crisis: "What helps you feel safer when home is tense?",
  };
  return prompts[type] || "What do you do?";
}

function choicesForThread(state, type, person) {
  if (!CUSTOM_THREADS.has(type) || (state.character?.ageMonths || 0) < 36) return null;
  const caregiver = primaryCaregiver(state);
  const who = firstName(person, "them");
  const caregiverName = firstName(caregiver, "someone you trust");
  const trustPerson = relationship(person, "trust", 2);
  const closePerson = relationship(person, "closeness", 2);
  const trustCaregiver = relationship(caregiver, "trust", 2);
  const closeCaregiver = relationship(caregiver, "closeness", 2);

  const sets = {
    family_health: [
      choice("check-in", `Ask ${who} how they are feeling`, `You ask ${who} directly instead of guessing. They give you an age-appropriate idea of how they are doing.`, effects(trustPerson, { type: "personality", key: "social", delta: 1 })),
      choice("small-help", "Help with a small chore", "You take care of one ordinary task that genuinely helps without making yourself responsible for an adult's health.", effects(closePerson, { type: "personality", key: "structure", delta: 1 })),
      choice("quiet-time", `Spend some quiet time with ${who}`, `You stay near ${who} without asking much from them. Being nearby becomes its own kind of company.`, effects(closePerson, { type: "health", key: "stress", delta: -1 })),
    ],
    caregiver_change: [
      choice("ask-routine", "Ask how the new routine will work", "You ask practical questions about mornings, meals, school, and who will be around. The change becomes easier to understand once it has a schedule.", effects(trustPerson || trustCaregiver, { type: "health", key: "stress", delta: -1 })),
      choice("shared-routine", `Do something familiar with ${who}`, `You keep one ordinary activity familiar while ${who} handles more of your care.`, effects(closePerson)),
      choice("own-routine", "Handle one routine more independently", "You take responsibility for one age-appropriate part of the day and make the transition a little easier on yourself.", [{ type: "personality", key: "independence", delta: 2 }, { type: "personality", key: "structure", delta: 1 }]),
    ],
    job_loss: [
      choice("ask-money", "Ask what this means for home", "You ask what will actually change instead of filling in the blanks yourself. The adults give you the practical version.", effects(trustCaregiver, { type: "health", key: "stress", delta: -1 })),
      choice("skip-extra", "Be flexible about a few small wants", "You let a few optional things wait. It does not fix the money problem, but it reduces some everyday pressure.", [{ type: "personality", key: "independence", delta: 1 }]),
      choice("keep-normal", "Keep your normal school routine", "You keep doing the parts of life that are still yours to do while the adults handle the job problem.", [{ type: "health", key: "stress", delta: -1 }]),
    ],
    separation: [
      choice("where-live", "Ask where everyone will live", "You ask the question that matters most: where people will be and what your week will look like. The adults give you the clearest answer they can.", effects(trustCaregiver, { type: "health", key: "stress", delta: -1 })),
      choice("say-worried", "Tell someone you are worried", "You make it clear that the separation affects you too. The feeling is no longer something you have to hide.", effects(closeCaregiver, { type: "health", key: "stress", delta: -2 })),
      choice("steady-routine", "Keep one familiar routine steady", "You hold onto school, bedtime, or another ordinary part of the day while the adults sort out the larger change.", [{ type: "personality", key: "structure", delta: 1 }, { type: "health", key: "stress", delta: -1 }]),
    ],
    move: [
      choice("school-question", "Ask what will happen with school", "You ask about the part of the move that shapes most of your weekdays. Knowing the plan gives the move a clearer outline.", effects(trustCaregiver, { type: "health", key: "stress", delta: -1 })),
      choice("pack-important", "Pack something important yourself", "You choose a few things to keep close during the move. Having control over something small makes the larger change easier.", [{ type: "personality", key: "independence", delta: 1 }, { type: "personality", key: "structure", delta: 1 }]),
      choice("explore", "Look around the new neighborhood", "You start noticing streets, shops, sounds, and places that may eventually become familiar.", [{ type: "personality", key: "curiosity", delta: 2 }]),
    ],
    birth: [
      choice("meet-baby", "Spend a little time near the baby", "You get used to the baby's noises, moods, and strange schedule in small doses. They begin becoming a person rather than an event.", [{ type: "personality", key: "curiosity", delta: 1 }]),
      choice("ask-time", `Ask ${caregiverName} for some one-on-one time`, "You ask for a little time that is still just yours. The baby needs a lot, but your relationship with your caregiver still matters.", effects(closeCaregiver, { type: "health", key: "stress", delta: -1 })),
      choice("keep-own", "Keep one part of your routine for yourself", "You keep reading, playing, schoolwork, or another familiar activity in place while the household adjusts.", [{ type: "personality", key: "independence", delta: 1 }, { type: "personality", key: "structure", delta: 1 }]),
    ],
    affair: [
      choice("ask-change", "Ask what is actually changing at home", "You ask for the part of the truth that affects you: whether people are leaving, whether routines are changing, and what happens next.", effects(trustCaregiver, { type: "health", key: "stress", delta: -1 })),
      choice("quiet-place", "Go somewhere quieter", "You move away from the argument and let the adults handle the adult problem. A quieter room gives you room to settle.", [{ type: "health", key: "stress", delta: -2 }]),
      choice("trusted-adult", `Stay close to ${caregiverName}`, "You stay near someone familiar while the mood at home feels unpredictable. The closeness does not solve the conflict, but it makes you feel less alone.", effects(closeCaregiver, { type: "health", key: "stress", delta: -1 })),
    ],
    family_crisis: [
      choice("trusted-person", `Stay near ${caregiverName}`, "You stay close to the adult who feels safest and most predictable. The household problem remains real, but you are not facing it alone.", effects(closeCaregiver, { type: "health", key: "stress", delta: -2 })),
      choice("calm-place", "Spend time somewhere calmer", "You move away from the tense part of the house and focus on something ordinary until your body feels less alert.", [{ type: "health", key: "stress", delta: -2 }, { type: "personality", key: "structure", delta: 1 }]),
      choice("say-unsafe", "Tell an adult when you feel unsafe", "You say plainly when the situation is frightening or too much. The problem belongs to the adults, but your safety still belongs in the conversation.", effects(trustCaregiver, { type: "personality", key: "social", delta: 1 })),
    ],
    death: [
      choice("ask-happened", "Ask what happened", "You ask for an explanation you can understand. The answer is sad, but clearer than being left to imagine what nobody is saying.", effects(trustCaregiver)),
      choice("share-memory", `Talk about a memory of ${who}`, `You tell someone about a small thing you remember about ${who}. The memory gives the person a place in the conversation again.`, effects(trustCaregiver, { type: "health", key: "stress", delta: -1 })),
      choice("stay-family", "Stay close to your family", "You spend time near people who are grieving too. Nobody has to find the perfect thing to say for the closeness to matter.", effects(closeCaregiver, { type: "health", key: "stress", delta: -1 })),
    ],
  };
  return sets[type] || null;
}

function customizeThreadEvent(state, event) {
  if (!event || event.contextKind !== "thread") return event;
  hideActiveThreadDuplicate(state, event);
  const thread = state.contextual?.activeThread;
  const type = event.threadType || thread?.type;
  const person = personById(state, thread?.personId);
  const choices = choicesForThread(state, type, person);
  if (!choices) return event;
  return { ...event, prompt: promptFor(type, person, thread?.stage || 0), choices, customContextChoices: true };
}

function adjust(target, key, delta) {
  if (!target || typeof target[key] !== "number") return;
  target[key] = clamp(target[key] + (delta || 0));
}

function applyCustomEffect(state, effect) {
  if (!effect) return;
  if (effect.type === "health") adjust(state.health, effect.key, effect.delta);
  if (effect.type === "personality") adjust(state.character?.personality, effect.key, effect.delta);
  if (effect.type === "relationship") {
    const person = personById(state, effect.targetId);
    adjust(person, effect.key, effect.delta);
    if (person) {
      person.lastInteractionAtMonths = state.character.ageMonths;
      person.history ||= [];
      if (Math.abs(effect.delta || 0) >= 2) {
        person.history.push({ ageMonths: state.character.ageMonths, date: { ...state.date }, eventId: "contextual", key: effect.key, delta: effect.delta });
        person.history = person.history.slice(-12);
      }
    }
  }
}

function resolveCustomThreadChoice(state, event, selected) {
  (selected.effects || []).forEach((effect) => applyCustomEffect(state, effect));
  state.history ||= [];
  state.history.push({ ageMonths: state.character.ageMonths, date: { ...state.date }, eventId: event.id, title: event.title, choiceId: selected.id, choice: selected.label, result: selected.result, continuity: "contextual" });

  const context = state.contextual;
  if (event.contextKind === "thread" && context?.activeThread) {
    context.activeThread.lastChoiceId = selected.id;
    if ((context.activeThread.stage || 0) >= 1) context.activeThread = null;
    else context.activeThread.stage = 1;
  }

  state.resolution = { choiceId: selected.id, result: selected.result, contextualEventId: event.id, contextualEvent: event };
}

function rememberCompletedCaregiverThread(state) {
  const event = state.resolution?.contextualEvent;
  if (event?.threadType !== CAREGIVER_THREAD || event.id !== CAREGIVER_STAGE_TWO_EVENT) return;
  const currentId = currentCaregiverId(state);
  if (!currentId) return;
  const continuity = ensureCaregiverContinuity(state);
  continuity.lastCompletedCaregiverId = currentId;
  continuity.lastCompletedAtMonths = state.character?.ageMonths ?? null;
  hideCaregiverDuplicates(state);
}

export function contextualEventForState(state) {
  prepareCaregiverContinuity(state);
  const coreEvent = coreContextualEventForState(state);
  return customizeThreadEvent(state, clarifyCaregiverEvent(state, coreEvent));
}

export function resolveContextualChoice(state, choiceId) {
  prepareCaregiverContinuity(state);
  const event = contextualEventForState(state);
  const selected = event?.choices?.find((item) => item.id === choiceId);
  if (event?.customContextChoices && selected && !state.resolution) resolveCustomThreadChoice(state, event, selected);
  else coreResolveContextualChoice(state, choiceId);
  rememberCompletedCaregiverThread(state);
  return state;
}
