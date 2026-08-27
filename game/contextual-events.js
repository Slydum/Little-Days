import {
  contextualEventForState as coreContextualEventForState,
  resolveContextualChoice as coreResolveContextualChoice,
} from "./contextual-events-core.js?v=1";

const CAREGIVER_THREAD = "caregiver_change";
const CAREGIVER_STAGE_TWO_EVENT = "context_thread_caregiver_change_1";
const LEGACY_REPEAT_WINDOW_MONTHS = 18;

function currentCaregiverId(state) {
  return state?.realism?.family?.primaryCaregiverId || null;
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
  state.contextual.caregiverContinuity ||= {
    lastCompletedCaregiverId: null,
    lastCompletedAtMonths: null,
  };
  return state.contextual.caregiverContinuity;
}

function inferLegacyCompletion(state, continuity) {
  if (continuity.lastCompletedCaregiverId) return;
  const thread = state.contextual?.activeThread;
  if (thread?.type !== CAREGIVER_THREAD) return;

  const currentId = currentCaregiverId(state);
  if (!currentId || (thread.personId && thread.personId !== currentId)) return;

  const completed = [...(state.history || [])]
    .reverse()
    .find((item) => item?.eventId === CAREGIVER_STAGE_TWO_EVENT);
  if (!completed) return;

  const currentAge = state.character?.ageMonths || 0;
  const completedAge = completed.ageMonths ?? -9999;
  const threadAge = thread.ageMonths ?? currentAge;
  const recentlyCompleted = Math.min(
    Math.abs(currentAge - completedAge),
    Math.abs(threadAge - completedAge),
  ) <= LEGACY_REPEAT_WINDOW_MONTHS;

  if (!recentlyCompleted) return;
  continuity.lastCompletedCaregiverId = currentId;
  continuity.lastCompletedAtMonths = completedAge;
}

function hideCaregiverDuplicates(state) {
  if (Array.isArray(state.realism?.latest)) {
    state.realism.latest = state.realism.latest.filter((item) => !isCaregiverUpdate(item));
  }

  if (Array.isArray(state.realism?.birthday?.items)) {
    state.realism.birthday.items = state.realism.birthday.items.filter((text) => !caregiverText(text));
  }
}

function suppressCompletedCaregiverThread(state, continuity) {
  const currentId = currentCaregiverId(state);
  if (!currentId || continuity.lastCompletedCaregiverId !== currentId) return;

  const thread = state.contextual?.activeThread;
  if (thread?.type === CAREGIVER_THREAD && (!thread.personId || thread.personId === currentId)) {
    state.contextual.activeThread = null;
  }

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

  // The interactive event already explains the caregiving change, so do not
  // repeat the exact same update in the birthday recap and Around You block.
  hideCaregiverDuplicates(state);

  const partnershipStatus = state.realism?.family?.partnership?.status;
  if (partnershipStatus !== "together") return event;

  const clarification = " Your parents are still together. This is a change in who handles more of your day-to-day care, not a separation.";
  if (String(event.body || "").includes("not a separation")) return event;
  return { ...event, body: `${event.body}${clarification}` };
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
  const event = coreContextualEventForState(state);
  return clarifyCaregiverEvent(state, event);
}

export function resolveContextualChoice(state, choiceId) {
  prepareCaregiverContinuity(state);
  coreResolveContextualChoice(state, choiceId);
  rememberCompletedCaregiverThread(state);
  return state;
}
