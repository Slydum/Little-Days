import * as core from "./realism-v5.js?v=1";

export * from "./realism-v5.js?v=1";

function ageMonths(state) {
  return Number(state?.character?.ageMonths) || 0;
}

function isKnownNow(state, person) {
  if (!person || person.deceased) return false;
  return (Number(person.introducedAtMonths) || 0) <= ageMonths(state);
}

function isEligibleCaregiver(state, person) {
  if (!isKnownNow(state, person)) return false;
  if (["guardian", "secondGuardian"].includes(person.role)) return true;
  return person.family?.caregiver === true && person.family?.household !== false;
}

function caregiverScore(person) {
  return (person?.npc?.availability ?? 60)
    + (person?.trust ?? 50) * 0.25
    - (person?.npc?.outsideStress ?? 30) * 0.2;
}

function eligibleCaregivers(state) {
  return (state.people || [])
    .filter((person) => isEligibleCaregiver(state, person))
    .sort((a, b) => caregiverScore(b) - caregiverScore(a));
}

function isCaregiverChangeText(value) {
  const text = String(value || "").toLowerCase();
  return text.includes("handling more of your everyday care")
    || text.includes("has become the person handling more of your everyday care")
    || text.includes("caring for you more")
    || text.includes("caregiving routine");
}

function invalidCaregiverIds(state) {
  return new Set((state.people || [])
    .filter((person) => !isEligibleCaregiver(state, person))
    .map((person) => person.id));
}

function removeImpossibleCaregiverUpdates(state, invalidIds) {
  const impossible = (item) => {
    if (!item) return false;
    if (item.personId && invalidIds.has(item.personId) && isCaregiverChangeText(item.text || item.note)) return true;
    return false;
  };

  if (Array.isArray(state.realism?.latest)) {
    state.realism.latest = state.realism.latest.filter((item) => !impossible(item));
  }
  if (Array.isArray(state.realism?.family?.recent)) {
    state.realism.family.recent = state.realism.family.recent.filter((item) => !impossible(item));
  }
  if (Array.isArray(state.realism?.birthday?.items)) {
    state.realism.birthday.items = state.realism.birthday.items.filter((text) => !isCaregiverChangeText(text));
  }
  if (Array.isArray(state.worldEvents)) {
    state.worldEvents = state.worldEvents.filter((item) => !impossible(item));
  }
}

function clearImpossibleCaregiverThread(state, invalidIds) {
  const thread = state.contextual?.activeThread;
  if (thread?.type !== "caregiver_change") return;
  const threadPersonId = thread.personId || null;
  if (!threadPersonId || invalidIds.has(threadPersonId) || threadPersonId !== state.realism?.family?.primaryCaregiverId) {
    state.contextual.activeThread = null;
  }

  const resolved = state.resolution?.contextualEvent;
  if (resolved?.threadType === "caregiver_change") {
    const personId = resolved.personId || threadPersonId;
    if (!personId || invalidIds.has(personId)) state.resolution = null;
  }
}

function normalizeCaregiverContinuity(state) {
  const family = state.realism?.family;
  if (!family) return state;

  const eligible = eligibleCaregivers(state);
  const eligibleIds = new Set(eligible.map((person) => person.id));
  const invalidIds = invalidCaregiverIds(state);

  if (!family.primaryCaregiverId || !eligibleIds.has(family.primaryCaregiverId)) {
    family.primaryCaregiverId = eligible[0]?.id || null;
  }

  removeImpossibleCaregiverUpdates(state, invalidIds);
  clearImpossibleCaregiverThread(state, invalidIds);
  return state;
}

export function ensureRealismState(state) {
  return normalizeCaregiverContinuity(core.ensureRealismState(state));
}

export function advanceRealism(state, elapsedMonths, beforeAgeMonths) {
  return normalizeCaregiverContinuity(core.advanceRealism(state, elapsedMonths, beforeAgeMonths));
}
