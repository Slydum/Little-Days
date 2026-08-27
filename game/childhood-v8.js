import * as core from "./childhood-v7.js?core=friendship-discovery-v1";

export * from "./childhood-v7.js?core=friendship-discovery-v1";

function firstName(person) {
  return String(person?.name || "A classmate").trim().split(/\s+/)[0] || "A classmate";
}

function seededFutureFriend(person) {
  if (!person || person.role !== "friend") return false;
  if ((person.introducedAtMonths ?? 0) < 60) return false;
  if (person.school?.friendshipStatus) return false;
  const history = person.history || [];
  return history.length === 0;
}

function makeAcquaintance(person, candidate = false) {
  if (!person) return;
  person.role = "classmate";
  person.relationshipLabel = "Classmate";
  person.closeness = Math.min(person.closeness ?? 36, 40);
  person.trust = Math.min(person.trust ?? 40, 45);
  person.affection = Math.min(person.affection ?? 46, 52);
  person.familiarity = Math.min(person.familiarity ?? 32, 40);
  person.school ||= {};
  person.school.friendshipStatus = "acquaintance";
  person.school.friendshipCandidate = Boolean(candidate);
  if (person.school.currentClass == null) person.school.currentClass = true;
  if (person.school.transferred == null) person.school.transferred = false;
  if (person.school.rival == null) person.school.rival = false;
  if (person.school.bullyingPattern == null) person.school.bullyingPattern = false;
  person.npc ||= {};
  person.npc.currentThread = candidate
    ? `${firstName(person)} is a classmate you have been ending up around more often.`
    : `${firstName(person)} is someone from school you do not know very well yet.`;
}

function normalizeSeededPeers(state) {
  for (const person of state.people || []) {
    if (seededFutureFriend(person)) makeAcquaintance(person, false);
  }
}

function candidatePeople(state) {
  return (state.people || []).filter((person) => person.school?.friendshipCandidate === true && person.role === "classmate");
}

function temporarilyCountCandidatesAsFriends(state) {
  const saved = [];
  for (const person of candidatePeople(state)) {
    saved.push({ person, role: person.role, relationshipLabel: person.relationshipLabel, status: person.school?.friendshipStatus });
    person.role = "friend";
    person.relationshipLabel = "Friend";
    person.school.friendshipStatus = "friend";
  }
  return () => {
    for (const item of saved) {
      if (item.person.school?.friendshipCandidate !== true) continue;
      item.person.role = item.role;
      item.person.relationshipLabel = item.relationshipLabel;
      item.person.school.friendshipStatus = item.status;
    }
  };
}

function undoPrematureFriendAccounting(state, person) {
  const school = state.childhood?.school;
  if (!school || person.school?.candidateAccountingFixed) return;
  school.friendIntroductions = Math.max(0, (school.friendIntroductions || 0) - 1);
  const log = school.yearly?.[String(Math.max(0, school.yearIndex ?? 0))];
  if (log?.friendsGained) log.friendsGained = log.friendsGained.filter((name) => name !== person.name);
  person.school.candidateAccountingFixed = true;
}

function normalizeQueuedFriendships(state) {
  const queue = state.childhood?.eventQueue || [];
  for (const item of queue) {
    if (item.type !== "new_friend") continue;
    const person = (state.people || []).find((candidate) => candidate.id === item.personId);
    if (!person) continue;
    makeAcquaintance(person, true);
    undoPrematureFriendAccounting(state, person);
    item.type = "friendship_opening";
    item.priority = Math.max(item.priority || 0, 48);
  }
}

function normalizeFriendshipState(state) {
  normalizeSeededPeers(state);
  normalizeQueuedFriendships(state);
  return state;
}

export function ensureChildhoodState(state) {
  normalizeSeededPeers(state);
  const next = core.ensureChildhoodState(state);
  return normalizeFriendshipState(next);
}

export function advanceChildhoodWorld(state, elapsedMonths = 0, beforeAgeMonths = null) {
  normalizeFriendshipState(state);
  const restore = temporarilyCountCandidatesAsFriends(state);
  const next = core.advanceChildhoodWorld(state, elapsedMonths, beforeAgeMonths);
  restore();
  return normalizeFriendshipState(next);
}

export function childhoodEventForState(state) {
  ensureChildhoodState(state);
  normalizeQueuedFriendships(state);
  return core.childhoodEventForState(state);
}

export function commitChildhoodEvent(state, event, choice) {
  const personId = event?.childhoodPersonId || event?.relationshipPersonId || null;
  const person = personId ? (state.people || []).find((item) => item.id === personId) : null;
  const wasCandidate = Boolean(person?.school?.friendshipCandidate);
  const next = core.commitChildhoodEvent(state, event, choice);

  if (wasCandidate && person) {
    person.school ||= {};
    person.school.friendshipCandidate = false;
    person.school.candidateAccountingFixed = false;
    if (person.role === "friend") {
      person.relationshipLabel = person.relationshipLabel === "Classmate" ? "Friend" : (person.relationshipLabel || "Friend");
      person.school.friendshipStatus = "friend";
      person.npc ||= {};
      person.npc.currentThread = `${firstName(person)} has become someone you deliberately spend time with, not just a familiar classmate.`;
    } else {
      makeAcquaintance(person, false);
      person.npc.currentThread = `${firstName(person)} is still a classmate you know, but the relationship has not become a friendship.`;
    }
  }
  return next;
}

export function socialSnapshot(state) {
  ensureChildhoodState(state);
  return core.socialSnapshot(state);
}

export function schoolWorldSnapshot(state) {
  ensureChildhoodState(state);
  return core.schoolWorldSnapshot(state);
}
