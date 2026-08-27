import * as core from "./childhood-v2.js?core=25";

export * from "./childhood-v2.js?core=25";

const clamp = (value, min = 0, max = 100) => Math.max(min, Math.min(max, value));

function visibleFriends(state) {
  const age = state.character?.ageMonths || 0;
  return (state.people || []).filter((person) =>
    person.role === "friend" &&
    !person.deceased &&
    (person.introducedAtMonths || 0) <= age &&
    person.school?.friendshipStatus !== "former"
  );
}

function meaningfulContactAge(friend) {
  return Math.max(
    friend.lastInteractionAtMonths ?? friend.introducedAtMonths ?? 0,
    friend.school?.lastAmbientContactAtMonths ?? -1,
  );
}

export function friendshipDriftPressure(state, friend) {
  if (!friend || friend.role !== "friend") return 0;
  const age = state.character?.ageMonths || 0;
  const monthsSince = age - meaningfulContactAge(friend);
  const sameClass = friend.school?.currentClass !== false && !friend.school?.transferred;
  let pressure = 0;

  if (sameClass) pressure -= 3;
  else pressure += 2;
  if (friend.school?.transferred) pressure += 2;
  if ((friend.npc?.socialWorld ?? 50) >= 74) pressure += 1;
  if ((friend.closeness ?? 50) < 48) pressure += 1;
  if ((friend.trust ?? 50) < 45) pressure += 1;
  if ((friend.conflict ?? 0) >= 28) pressure += 2;
  if (monthsSince >= 18) pressure += 1;
  if (monthsSince >= 30) pressure += 1;
  if ((friend.closeness ?? 50) >= 66) pressure -= 1;
  if ((friend.trust ?? 50) >= 60) pressure -= 1;

  return clamp(pressure, 0, 10);
}

function rememberAmbientSchoolContact(state) {
  const age = state.character?.ageMonths || 0;
  if (age < 60) return;
  for (const friend of visibleFriends(state)) {
    if (friend.school?.currentClass === false || friend.school?.transferred) continue;
    friend.school ||= {};
    friend.school.lastAmbientContactAtMonths = age;
  }
}

function snapshotFriends(state) {
  return new Map(visibleFriends(state).map((friend) => [friend.id, {
    closeness: friend.closeness ?? 50,
    trust: friend.trust ?? 50,
    conflict: friend.conflict ?? 0,
  }]));
}

function undoMechanicalDecay(state, before) {
  for (const friend of visibleFriends(state)) {
    const previous = before.get(friend.id);
    if (!previous) continue;
    const pressure = friendshipDriftPressure(state, friend);
    const lost = previous.closeness - (friend.closeness ?? previous.closeness);

    // Ordinary school contact should not quietly erode a friendship every turn.
    // Real drift remains possible when there is actual social pressure.
    if (lost > 0 && pressure < 2 && (friend.conflict ?? 0) <= previous.conflict + 1) {
      friend.closeness = previous.closeness;
    } else if (lost > 1 && pressure < 3) {
      friend.closeness = Math.max(friend.closeness, previous.closeness - 1);
    }
  }
}

function suppressUnearnedDriftEvents(state) {
  const childhood = state.childhood;
  if (!childhood?.eventQueue?.length) return;
  const removed = [];
  childhood.eventQueue = childhood.eventQueue.filter((item) => {
    if (item.type !== "friend_drift") return true;
    const friend = (state.people || []).find((person) => person.id === item.personId);
    if (friendshipDriftPressure(state, friend) >= 3) return true;
    removed.push(item.key);
    return false;
  });
  if (removed.length) {
    childhood.seen ||= [];
    for (const key of removed) if (key && !childhood.seen.includes(key)) childhood.seen.push(key);
    childhood.seen = childhood.seen.slice(-260);
  }
}

export function advanceChildhoodWorld(state, elapsedMonths = 0, beforeAgeMonths = null) {
  const before = snapshotFriends(state);
  const next = core.advanceChildhoodWorld(state, elapsedMonths, beforeAgeMonths);
  rememberAmbientSchoolContact(next);
  undoMechanicalDecay(next, before);
  suppressUnearnedDriftEvents(next);
  return next;
}

export function childhoodEventForState(state) {
  rememberAmbientSchoolContact(state);
  suppressUnearnedDriftEvents(state);
  return core.childhoodEventForState(state);
}
