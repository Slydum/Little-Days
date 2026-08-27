const clamp = (value, min = 0, max = 100) => Math.max(min, Math.min(max, value));

const PEER_FIRST = [
  "Maya", "Liam", "Zoe", "Nina", "Eli", "Sam", "Noah", "Aya", "Inez", "Joaquin",
  "Bea", "Luis", "Mika", "Gab", "Tala", "Enzo", "Rafi", "Celine", "Milo", "Luna",
  "Ari", "Dani", "Kian", "Sela", "Theo", "Rina", "Marco", "Mina", "Nico", "Sofia",
];
const LAST_NAMES = ["Reyes", "Santos", "Garcia", "Navarro", "Cruz", "Mendoza", "Flores", "Ramos", "Lim", "Tan", "Villanueva", "Dela Cruz", "Aquino"];
const TEACHERS = ["Ms. Santos", "Mr. Lim", "Ms. Rivera", "Mr. Cruz", "Ms. Garcia", "Mr. Navarro", "Ms. Tan", "Mr. Mendoza"];
const SUBJECT_KEYS = ["mathematics", "language", "science", "art", "physicalEducation"];
const ACTIVITY_MAP = {
  drawing: { id: "art-club", label: "Art club", cost: 250, subject: "art" },
  music: { id: "music-club", label: "Music club", cost: 450, subject: "art" },
  reading: { id: "reading-circle", label: "Reading circle", cost: 0, subject: "language" },
  making: { id: "makers-club", label: "Makers club", cost: 350, subject: "science" },
  gaming: { id: "computer-club", label: "Computer club", cost: 300, subject: "science" },
  cooking: { id: "home-economics", label: "Home economics club", cost: 400, subject: "science" },
  gardening: { id: "garden-club", label: "School garden", cost: 120, subject: "science" },
};

function nextRandom(state) {
  state.childhoodRngState = (state.childhoodRngState * 1664525 + 1013904223) >>> 0;
  return state.childhoodRngState / 4294967296;
}

function pick(state, items) {
  return items[Math.floor(nextRandom(state) * items.length)];
}

function between(state, min, max) {
  return Math.round(min + nextRandom(state) * (max - min));
}

function firstName(person, fallback = "someone") {
  return person?.name?.split(" ")[0] || fallback;
}

function personById(state, id) {
  return (state.people || []).find((person) => person.id === id) || null;
}

function compact(...items) {
  return items.filter(Boolean);
}

function relationshipEffect(person, key, delta, note = "") {
  return person ? { type: "relationship", targetId: person.id, key, delta, note } : null;
}

export function childhoodStage(state) {
  const months = state.character?.ageMonths || 0;
  if (months < 3) return "newborn";
  if (months < 12) return "infant";
  if (months < 36) return "toddler";
  if (months < 60) return "preschool";
  if (months < 96) return "early-school";
  if (months < 120) return "middle-childhood";
  return "preteen";
}

function stageLabel(stage) {
  return ({
    newborn: "Newborn",
    infant: "Infancy",
    toddler: "Toddler years",
    preschool: "Preschool years",
    "early-school": "Early school years",
    "middle-childhood": "Middle childhood",
    preteen: "Preteen years",
  })[stage] || "Childhood";
}

function schoolYearIndex(state) {
  return Math.max(0, Math.floor(((state.character?.ageMonths || 0) - 60) / 12));
}

function schoolYearLabel(index) {
  if (index <= 0) return "Kindergarten";
  return `Grade ${Math.min(index, 7)}`;
}

function schoolTerm(state) {
  const month = state.date?.month ?? 0;
  return month <= 3 ? "Term 3 · January–April" : month <= 7 ? "Term 1 · June–August" : "Term 2 · September–December";
}

function defaultSchoolState(state) {
  const started = (state.character?.ageMonths || 0) >= 60;
  const yearIndex = started ? schoolYearIndex(state) : -1;
  return {
    started,
    yearIndex,
    grade: started ? schoolYearLabel(yearIndex) : null,
    currentTeacherId: null,
    currentClassmateIds: [],
    friendIntroductions: 0,
    groupSeen: false,
    teacherSupport: 58,
    effort: clamp(Math.round(52 + ((state.character?.personality?.structure ?? 50) - 50) * 0.35)),
    attendance: 96,
    performance: {},
    overallPerformance: 55,
    activities: [],
    availableActivity: null,
    friendGroupIds: [],
    bullyingIncidents: {},
    yearly: {},
    recaps: [],
    lastPerformanceEventYear: -1,
    lastFieldTripYear: -1,
    lastActivityOfferYear: -1,
    lastGroupProjectAtMonths: -120,
    lastPeerDramaAtMonths: -120,
  };
}

export function ensureChildhoodState(state) {
  if (!state?.character) return state;
  const seed = ((Number(state.seed) || 1) ^ 0x71c39b2d) >>> 0;
  state.childhoodRngState ||= seed || 1;
  state.childhood ||= {
    stage: childhoodStage(state),
    stageEnteredAtMonths: state.character.ageMonths || 0,
    socialConfidence: clamp(Math.round(48 + ((state.character.personality?.social ?? 50) - 50) * 0.35)),
    eventQueue: [],
    seen: [],
    crush: null,
    pastCrushes: [],
    yearRecaps: [],
    school: defaultSchoolState(state),
    lastFriendAddedAtMonths: -120,
    lastSocialEventAtMonths: -120,
  };
  state.childhood.eventQueue ||= [];
  state.childhood.seen ||= [];
  state.childhood.pastCrushes ||= [];
  state.childhood.yearRecaps ||= [];
  state.childhood.school ||= defaultSchoolState(state);
  const school = state.childhood.school;
  const defaults = defaultSchoolState(state);
  for (const [key, value] of Object.entries(defaults)) {
    if (school[key] == null) school[key] = Array.isArray(value) ? [] : typeof value === "object" && value ? {} : value;
  }
  school.currentClassmateIds ||= [];
  school.activities ||= [];
  school.friendGroupIds ||= [];
  school.bullyingIncidents ||= {};
  school.yearly ||= {};
  school.recaps ||= [];
  school.performance ||= {};
  return state;
}

function visiblePeers(state) {
  const age = state.character.ageMonths || 0;
  return (state.people || []).filter((person) => ["friend", "classmate"].includes(person.role) && !person.deceased && (person.introducedAtMonths || 0) <= age);
}

function visibleFriends(state) {
  return visiblePeers(state).filter((person) => person.role === "friend" && person.school?.friendshipStatus !== "former");
}

function currentClassmates(state) {
  const ids = new Set(state.childhood?.school?.currentClassmateIds || []);
  return visiblePeers(state).filter((person) => ids.has(person.id));
}

function queueEvent(state, item) {
  const childhood = ensureChildhoodState(state).childhood;
  if (!item?.key) return;
  if (childhood.seen.includes(item.key) || childhood.eventQueue.some((event) => event.key === item.key)) return;
  childhood.eventQueue.push({ priority: 40, createdAtMonths: state.character.ageMonths, ...item });
  childhood.eventQueue = childhood.eventQueue
    .sort((a, b) => (b.priority || 0) - (a.priority || 0) || (a.createdAtMonths || 0) - (b.createdAtMonths || 0))
    .slice(0, 14);
}

function uniqueName(state, pool = PEER_FIRST) {
  const existing = new Set((state.people || []).map((person) => String(person.name || "").toLowerCase()));
  for (let tries = 0; tries < 40; tries += 1) {
    const name = `${pick(state, pool)} ${pick(state, LAST_NAMES)}`;
    if (!existing.has(name.toLowerCase())) return name;
  }
  return `Alex ${pick(state, LAST_NAMES)}`;
}

function makePeer(state, role = "classmate", introducedAtMonths = state.character.ageMonths) {
  const name = uniqueName(state);
  const first = name.split(" ")[0];
  const id = `${role}-${first.toLowerCase()}-${introducedAtMonths}-${Math.floor(nextRandom(state) * 99999)}`;
  const sex = nextRandom(state) < 0.5 ? "Female" : "Male";
  const closeness = role === "friend" ? between(state, 46, 62) : between(state, 22, 42);
  return {
    id,
    role,
    relationshipLabel: role === "friend" ? "Friend" : "Classmate",
    name,
    sex,
    age: between(state, -1, 1),
    introducedAtMonths,
    closeness,
    trust: role === "friend" ? between(state, 45, 60) : between(state, 30, 48),
    affection: role === "friend" ? between(state, 52, 68) : between(state, 38, 56),
    conflict: between(state, 4, 16),
    familiarity: role === "friend" ? between(state, 38, 56) : between(state, 24, 42),
    lastInteractionAtMonths: introducedAtMonths,
    history: [{ ageMonths: introducedAtMonths, date: { ...state.date }, eventId: "school_peer_introduction", note: `You met ${first} through school.` }],
    family: { branch: "outside", generation: "peer", kinship: "none", caregiver: false, household: false },
    school: {
      friendshipStatus: role === "friend" ? "friend" : "acquaintance",
      currentClass: true,
      metInYear: schoolYearIndex(state),
      transferred: false,
      rival: false,
      bullyingPattern: false,
      groupId: null,
    },
    npc: {
      outsideStress: between(state, 18, 38),
      availability: between(state, 58, 84),
      socialWorld: between(state, 38, 70),
      currentThread: role === "friend" ? `${first} is part of your school-day routine.` : `${first} is one of the classmates you are getting used to.`,
      lastChangedAtMonths: introducedAtMonths,
    },
  };
}

function promoteToFriend(state, person, note = "You started spending more time together.") {
  if (!person) return;
  person.role = "friend";
  person.relationshipLabel = "Friend";
  person.school ||= {};
  person.school.friendshipStatus = "friend";
  person.closeness = Math.max(person.closeness ?? 0, 48);
  person.trust = Math.max(person.trust ?? 0, 44);
  person.history ||= [];
  person.history.push({ ageMonths: state.character.ageMonths, date: { ...state.date }, eventId: "friendship_began", note });
  person.history = person.history.slice(-24);
  state.childhood.lastFriendAddedAtMonths = state.character.ageMonths;
  state.childhood.school.friendIntroductions = (state.childhood.school.friendIntroductions || 0) + 1;
}

function addFriend(state, reason = "school") {
  const friend = makePeer(state, "friend");
  state.people ||= [];
  state.people.push(friend);
  if (state.childhood.school.started && !state.childhood.school.currentClassmateIds.includes(friend.id)) {
    state.childhood.school.currentClassmateIds.push(friend.id);
  }
  state.childhood.lastFriendAddedAtMonths = state.character.ageMonths;
  state.childhood.school.friendIntroductions = (state.childhood.school.friendIntroductions || 0) + 1;
  recordYearChange(state, "friendsGained", friend.name);
  queueEvent(state, { key: `new-friend:${friend.id}`, type: "new_friend", personId: friend.id, priority: 48, data: { reason } });
  return friend;
}

function addClassmate(state) {
  const peer = makePeer(state, "classmate");
  state.people ||= [];
  state.people.push(peer);
  state.childhood.school.currentClassmateIds.push(peer.id);
  queueEvent(state, { key: `new-classmate:${peer.id}`, type: "new_classmate", personId: peer.id, priority: 30 });
  return peer;
}

function desiredFriendCount(state) {
  const months = state.character.ageMonths || 0;
  if (months < 60) return 0;
  if (months < 84) return 2;
  if (months < 120) return 3;
  return 4;
}

function friendshipTier(person, isBest = false) {
  if (!person) return "Acquaintance";
  if (person.school?.rival || (person.conflict ?? 0) >= 55) return "Rival";
  if (person.school?.friendshipStatus === "former") return "Former friend";
  if (person.role !== "friend") return "Acquaintance";
  if (isBest) return "Best friend";
  if ((person.closeness ?? 0) >= 66 && (person.trust ?? 0) >= 58) return "Close friend";
  return "Friend";
}

function updateFriendshipLabels(state) {
  const friends = visibleFriends(state).sort((a, b) => ((b.closeness || 0) + (b.trust || 0)) - ((a.closeness || 0) + (a.trust || 0)));
  const best = friends.find((person) => (person.closeness ?? 0) >= 74 && (person.trust ?? 0) >= 64) || null;
  for (const peer of visiblePeers(state)) {
    const tier = friendshipTier(peer, best?.id === peer.id);
    peer.school ||= {};
    peer.school.displayTier = tier;
    if (tier === "Best friend") peer.relationshipLabel = "Best friend";
    else if (tier === "Close friend") peer.relationshipLabel = "Close friend";
    else if (tier === "Former friend") peer.relationshipLabel = "Former friend";
    else if (tier === "Rival") peer.relationshipLabel = "Rival / classmate";
    else if (peer.role === "friend") peer.relationshipLabel = "Friend";
    else peer.relationshipLabel = "Classmate";
  }
}

function ensureSchoolFriends(state, elapsedMonths) {
  const months = state.character.ageMonths || 0;
  if (months < 60) return;
  state.childhood.school.started = true;
  let friends = visibleFriends(state);
  if (friends.length < 2) {
    addFriend(state, "school");
    friends = visibleFriends(state);
  }
  const desired = desiredFriendCount(state);
  if (friends.length >= desired) return;
  const monthsSinceLast = months - (state.childhood.lastFriendAddedAtMonths ?? -120);
  const chance = clamp(0.035 * Math.max(1, elapsedMonths) + (monthsSinceLast >= 12 ? 0.18 : 0), 0.04, 0.42);
  if (nextRandom(state) < chance) addFriend(state, "growing circle");
}

function currentYearLog(state) {
  const school = state.childhood.school;
  const key = String(Math.max(0, school.yearIndex));
  school.yearly[key] ||= {
    grade: school.grade || schoolYearLabel(Math.max(0, school.yearIndex)),
    startedAtMonths: state.character.ageMonths,
    friendsGained: [],
    friendsLost: [],
    majorEvents: [],
    activitiesJoined: [],
    teacherName: personById(state, school.currentTeacherId)?.name || null,
    openingPerformance: school.overallPerformance || 55,
  };
  return school.yearly[key];
}

function recordYearChange(state, key, value) {
  if ((state.character.ageMonths || 0) < 60) return;
  const log = currentYearLog(state);
  log[key] ||= [];
  if (value && !log[key].includes(value)) log[key].push(value);
}

function markMajorSchoolEvent(state, text) {
  if (!text) return;
  recordYearChange(state, "majorEvents", text);
}

function retireCurrentTeacher(state) {
  const school = state.childhood.school;
  const current = personById(state, school.currentTeacherId);
  if (!current) return;
  current.role = "formerTeacher";
  current.relationshipLabel = "Former teacher";
  current.school ||= {};
  current.school.currentTeacher = false;
  current.npc ||= {};
  current.npc.currentThread = `${firstName(current)} taught you in an earlier school year.`;
}

function createTeacher(state) {
  const existingNames = new Set((state.people || []).map((person) => person.name));
  let name = pick(state, TEACHERS);
  for (let i = 0; i < 12 && existingNames.has(name); i += 1) name = pick(state, TEACHERS);
  const teacher = {
    id: `teacher-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${state.character.ageMonths}`,
    role: "teacher",
    relationshipLabel: "Teacher",
    name,
    sex: name.startsWith("Ms.") ? "Female" : "Male",
    age: between(state, 26, 48) - Math.floor((state.character.ageMonths || 0) / 12),
    introducedAtMonths: state.character.ageMonths,
    closeness: between(state, 38, 54),
    trust: between(state, 45, 60),
    affection: between(state, 42, 60),
    conflict: between(state, 3, 12),
    familiarity: between(state, 35, 50),
    lastInteractionAtMonths: state.character.ageMonths,
    history: [],
    family: { branch: "outside", generation: "adult", kinship: "none", caregiver: false, household: false },
    school: { currentTeacher: true, yearIndex: schoolYearIndex(state) },
    npc: { outsideStress: between(state, 24, 44), availability: between(state, 55, 78), socialWorld: between(state, 30, 50), currentThread: "", lastChangedAtMonths: state.character.ageMonths },
  };
  state.people ||= [];
  state.people.push(teacher);
  return teacher;
}

function ensureCurrentTeacher(state) {
  const school = state.childhood.school;
  let teacher = personById(state, school.currentTeacherId);
  if (teacher && !teacher.deceased && teacher.role === "teacher") return teacher;
  const legacy = (state.people || []).find((person) => person.role === "teacher" && !person.deceased);
  if (legacy) {
    legacy.relationshipLabel ||= "Teacher";
    legacy.school ||= { currentTeacher: true, yearIndex: school.yearIndex };
    school.currentTeacherId = legacy.id;
    return legacy;
  }
  teacher = createTeacher(state);
  school.currentTeacherId = teacher.id;
  return teacher;
}

function seedCurrentClass(state) {
  const school = state.childhood.school;
  const existing = visiblePeers(state).filter((person) => !person.school?.transferred);
  for (const peer of existing) {
    peer.school ||= {};
    if (peer.school.currentClass !== false && !school.currentClassmateIds.includes(peer.id)) school.currentClassmateIds.push(peer.id);
  }
  const target = between(state, 6, 9);
  while (school.currentClassmateIds.length < target) addClassmate(state);
}

function finalizeSchoolYear(state, yearIndex) {
  if (yearIndex < 0) return;
  const school = state.childhood.school;
  const log = school.yearly[String(yearIndex)];
  if (!log || log.finalized) return;
  const friends = visibleFriends(state);
  const closest = [...friends].sort((a, b) => (b.closeness || 0) - (a.closeness || 0))[0];
  const activityText = school.activities.length ? school.activities.map((activity) => activity.label).join(", ") : "no regular extracurricular activity";
  const performance = school.overallPerformance || 55;
  const performanceWord = performance >= 78 ? "a strong academic year" : performance >= 64 ? "a steady academic year" : performance >= 48 ? "an uneven academic year" : "a difficult academic year";
  const pieces = [performanceWord];
  if (log.friendsGained?.length) pieces.push(`you became friends with ${log.friendsGained.slice(0, 2).map((name) => name.split(" ")[0]).join(" and ")}`);
  if (log.friendsLost?.length) pieces.push(`${log.friendsLost.slice(0, 2).map((name) => name.split(" ")[0]).join(" and ")} drifted out of your close circle`);
  if (closest) pieces.push(`${firstName(closest)} was among the people you felt closest to at school`);
  if (school.activities.length) pieces.push(`you spent time in ${activityText}`);
  const text = `${log.grade || schoolYearLabel(yearIndex)} became ${pieces.join("; ")}.`;
  log.finalized = true;
  log.endingPerformance = performance;
  log.summary = text;
  school.recaps.push({ yearIndex, grade: log.grade || schoolYearLabel(yearIndex), text, ageMonths: state.character.ageMonths });
  school.recaps = school.recaps.slice(-8);
  state.childhood.yearRecaps.push({ age: Math.floor((state.character.ageMonths || 0) / 12), ageMonths: state.character.ageMonths, text });
  state.childhood.yearRecaps = state.childhood.yearRecaps.slice(-10);
  state.worldEvents ||= [];
  state.worldEvents.push({ category: "School", text, note: text, importance: 2, ageMonths: state.character.ageMonths, date: { ...state.date }, source: "school-year-recap" });
  state.worldEvents = state.worldEvents.slice(-100);
  queueEvent(state, { key: `school-recap:${yearIndex}`, type: "school_year_recap", priority: 36, data: { yearIndex, text, grade: log.grade || schoolYearLabel(yearIndex) } });
}

function reshuffleClass(state, previousIds) {
  const school = state.childhood.school;
  const kept = [];
  for (const id of previousIds) {
    const peer = personById(state, id);
    if (!peer || peer.deceased) continue;
    peer.school ||= {};
    const keepChance = peer.role === "friend" ? 0.76 : 0.5;
    if (nextRandom(state) < keepChance) {
      peer.school.currentClass = true;
      peer.school.transferred = false;
      kept.push(id);
    } else {
      peer.school.currentClass = false;
      if (nextRandom(state) < 0.18) {
        peer.school.transferred = true;
        peer.school.transferredAtMonths = state.character.ageMonths;
        if (peer.role === "friend") {
          peer.npc.currentThread = `${firstName(peer)} moved to another class or school. You can still be friends, but seeing each other takes more effort.`;
        }
      }
    }
  }
  school.currentClassmateIds = kept;
  const target = between(state, 7, 10);
  while (school.currentClassmateIds.length < target) addClassmate(state);
}

function startSchoolYear(state, newYearIndex, oldYearIndex) {
  const school = state.childhood.school;
  if (oldYearIndex >= 0) finalizeSchoolYear(state, oldYearIndex);
  const previousIds = [...(school.currentClassmateIds || [])];
  retireCurrentTeacher(state);
  school.yearIndex = newYearIndex;
  school.grade = schoolYearLabel(newYearIndex);
  school.currentTeacherId = null;
  school.teacherSupport = between(state, 48, 72);
  school.groupSeen = false;
  school.lastPerformanceEventYear = -1;
  ensureCurrentTeacher(state);
  reshuffleClass(state, previousIds);
  currentYearLog(state).teacherName = personById(state, school.currentTeacherId)?.name || null;
  queueEvent(state, { key: `school-year-start:${newYearIndex}`, type: "school_year_start", priority: 47, data: { yearIndex: newYearIndex, grade: school.grade } });
}

function ensureSchoolYear(state) {
  const months = state.character.ageMonths || 0;
  if (months < 60) return;
  const school = state.childhood.school;
  school.started = true;
  const year = schoolYearIndex(state);
  if (school.yearIndex == null || school.yearIndex < 0) school.yearIndex = year;
  if (!school.grade) school.grade = schoolYearLabel(school.yearIndex);
  ensureCurrentTeacher(state);
  if (!school.currentClassmateIds.length) seedCurrentClass(state);
  currentYearLog(state);
  if (year > school.yearIndex) startSchoolYear(state, year, school.yearIndex);
}

function driftFriendships(state, elapsedMonths) {
  const friends = visibleFriends(state);
  for (const friend of friends) {
    friend.school ||= {};
    const monthsSince = state.character.ageMonths - (friend.lastInteractionAtMonths ?? friend.introducedAtMonths ?? 0);
    const socialPull = (friend.npc?.socialWorld ?? 50) > 68 ? -1 : 0;
    const differentClass = friend.school.currentClass === false ? -1 : 0;
    const drift = Math.round((nextRandom(state) - 0.52) * 3) + socialPull + differentClass;
    if (drift) friend.closeness = clamp((friend.closeness ?? 50) + drift);
    if (monthsSince >= 12) friend.closeness = clamp((friend.closeness ?? 50) - 1);

    if (friend.closeness < 34 && monthsSince >= 12 && friend.school.friendshipStatus !== "former" && nextRandom(state) < 0.055 * Math.max(1, elapsedMonths)) {
      queueEvent(state, { key: `drift:${friend.id}:${Math.floor(state.character.ageMonths / 12)}`, type: "friend_drift", personId: friend.id, priority: 42 });
    }
    if ((friend.conflict ?? 0) > 32 && nextRandom(state) < 0.04 * Math.max(1, elapsedMonths)) {
      queueEvent(state, { key: `conflict:${friend.id}:${Math.floor(state.character.ageMonths / 12)}`, type: "friend_conflict", personId: friend.id, priority: 46 });
    }
  }

  if (friends.length >= 2 && state.character.ageMonths >= 84 && !state.childhood.school.groupSeen) {
    if (nextRandom(state) < 0.12 * Math.max(1, elapsedMonths)) {
      state.childhood.school.groupSeen = true;
      const members = [...friends].sort((a, b) => (b.closeness || 0) - (a.closeness || 0)).slice(0, Math.min(4, friends.length));
      state.childhood.school.friendGroupIds = members.map((person) => person.id);
      members.forEach((person) => { person.school ||= {}; person.school.groupId = "main"; });
      queueEvent(state, { key: `friend-group:${state.childhood.school.yearIndex}`, type: "friend_group", personIds: members.map((person) => person.id), priority: 43 });
    }
  }
}

function maybePromoteClassmate(state, elapsedMonths) {
  const classmates = currentClassmates(state).filter((person) => person.role === "classmate" && !person.school?.rival);
  if (!classmates.length) return;
  if (visibleFriends(state).length >= 6) return;
  const chance = clamp(0.018 * Math.max(1, elapsedMonths) + ((state.childhood.socialConfidence || 50) > 60 ? 0.02 : 0), 0.02, 0.14);
  if (nextRandom(state) >= chance) return;
  const person = pick(state, classmates);
  queueEvent(state, { key: `friendship-opening:${person.id}`, type: "friendship_opening", personId: person.id, priority: 40 });
}

function maybeQueueFirstDayEcho(state) {
  if ((state.character.ageMonths || 0) < 72) return;
  if (state.childhood.seen.includes("first-day-echo") || state.childhood.eventQueue.some((item) => item.key === "first-day-echo")) return;
  const firstDay = [...(state.history || [])].reverse().find((entry) => entry.eventId === "first_school_day");
  if (!firstDay) return;
  queueEvent(state, { key: "first-day-echo", type: "first_day_echo", priority: 44, data: { choiceId: firstDay.choiceId } });
}

function eligibleCrushes(state) {
  const past = new Set((state.childhood.pastCrushes || []).map((item) => item.personId));
  return visibleFriends(state).filter((person) => !past.has(person.id) && (person.closeness ?? 0) >= 42);
}

function updateCrush(state, elapsedMonths) {
  const age = state.character.ageMonths || 0;
  if (age < 108) return;
  const childhood = state.childhood;
  const crush = childhood.crush;
  if (!crush || crush.status !== "active") {
    const candidates = eligibleCrushes(state);
    if (!candidates.length) return;
    const chance = clamp(0.007 * Math.max(1, elapsedMonths) + (age >= 120 ? 0.008 : 0), 0.01, 0.09);
    if (nextRandom(state) < chance) {
      const person = pick(state, candidates);
      childhood.crush = { personId: person.id, startedAtMonths: age, intensity: between(state, 48, 68), status: "active", followupShown: false, reciprocity: "unknown", sameCrushShown: false };
      queueEvent(state, { key: `crush-begins:${person.id}:${age}`, type: "crush_begin", personId: person.id, priority: 45 });
    }
    return;
  }
  const person = personById(state, crush.personId);
  if (!person || person.deceased) {
    crush.status = "past";
    return;
  }
  crush.intensity = clamp((crush.intensity ?? 55) + Math.round((nextRandom(state) - 0.52) * 5));
  const duration = age - crush.startedAtMonths;
  if (!crush.followupShown && duration >= 6 && nextRandom(state) < 0.08 * Math.max(1, elapsedMonths)) {
    crush.followupShown = true;
    queueEvent(state, { key: `crush-followup:${person.id}`, type: "crush_followup", personId: person.id, priority: 41 });
  }
  if (age >= 120 && duration >= 6 && crush.reciprocity === "unknown" && (person.closeness ?? 0) >= 62 && (person.trust ?? 0) >= 55 && nextRandom(state) < 0.035 * Math.max(1, elapsedMonths)) {
    queueEvent(state, { key: `crush-signal:${person.id}`, type: "crush_signal", personId: person.id, priority: 42 });
  }
  if (age >= 120 && !crush.sameCrushShown && visibleFriends(state).length >= 2 && nextRandom(state) < 0.018 * Math.max(1, elapsedMonths)) {
    const confidant = visibleFriends(state).find((friend) => friend.id !== person.id);
    if (confidant) {
      crush.sameCrushShown = true;
      queueEvent(state, { key: `same-crush:${person.id}:${confidant.id}`, type: "same_crush", personId: person.id, secondaryPersonId: confidant.id, priority: 39 });
    }
  }
  if (duration >= 12 && (crush.intensity < 42 || nextRandom(state) < 0.018 * Math.max(1, elapsedMonths))) {
    crush.status = "fading";
    queueEvent(state, { key: `crush-fades:${person.id}`, type: "crush_fade", personId: person.id, priority: 39 });
  }
}

function queueStageTransition(state, oldStage, nextStage) {
  if (oldStage === nextStage) return;
  const interesting = new Set(["preschool", "early-school", "middle-childhood", "preteen"]);
  if (!interesting.has(nextStage)) return;
  queueEvent(state, { key: `stage:${nextStage}`, type: "stage_transition", priority: nextStage === "early-school" ? 52 : 38, data: { oldStage, nextStage } });
}

function calculatePerformance(state) {
  const school = state.childhood.school;
  const subjects = state.education?.subjects || {};
  const persistence = state.character?.development?.persistence ?? 50;
  const structure = state.character?.personality?.structure ?? 50;
  const energy = state.health?.energy ?? 60;
  const stress = state.health?.stress ?? 30;
  const attendance = school.attendance ?? 95;
  const teacherSupport = school.teacherSupport ?? 58;
  const effort = school.effort ?? 55;
  let total = 0;
  let count = 0;
  for (const key of SUBJECT_KEYS) {
    const ability = subjects[key] ?? 50;
    const interestBoost = key === "art" ? Math.max(state.interests?.drawing || 0, state.interests?.music || 0) * 0.08 : key === "science" ? (state.interests?.making || 0) * 0.05 : key === "language" ? (state.interests?.reading || 0) * 0.05 : 0;
    const raw = ability * 0.46 + effort * 0.16 + persistence * 0.08 + structure * 0.05 + attendance * 0.1 + teacherSupport * 0.06 + energy * 0.06 - stress * 0.05 + interestBoost;
    const score = clamp(Math.round(raw), 20, 96);
    school.performance[key] = score;
    total += score;
    count += 1;
    const current = subjects[key] ?? 50;
    subjects[key] = clamp(Math.round(current * 0.82 + score * 0.18));
  }
  school.overallPerformance = count ? Math.round(total / count) : 50;
  return school.overallPerformance;
}

function updateAttendanceAndEffort(state, elapsedMonths) {
  const school = state.childhood.school;
  const activeIllness = Boolean(state.realism?.active?.length);
  const stress = state.health?.stress ?? 30;
  const energy = state.health?.energy ?? 60;
  const illnessPenalty = activeIllness ? between(state, 3, 9) : 0;
  const stressPenalty = stress > 60 ? 2 : stress > 45 ? 1 : 0;
  const targetAttendance = clamp(97 - illnessPenalty - stressPenalty + between(state, -1, 1), 70, 100);
  school.attendance = clamp(Math.round((school.attendance ?? 95) * 0.72 + targetAttendance * 0.28));
  const effortTarget = clamp(48 + ((state.character.personality?.structure ?? 50) - 50) * 0.35 + ((state.character.development?.persistence ?? 50) - 50) * 0.28 + (energy - 55) * 0.08 - Math.max(0, stress - 45) * 0.12, 25, 90);
  school.effort = clamp(Math.round((school.effort ?? 52) * 0.75 + effortTarget * 0.25));
}

function maybeQueuePerformanceEvent(state, elapsedMonths) {
  const school = state.childhood.school;
  if (school.lastPerformanceEventYear === school.yearIndex) return;
  const monthsIntoYear = (state.character.ageMonths - 60) % 12;
  if (monthsIntoYear < 5) return;
  if (nextRandom(state) < 0.045 * Math.max(1, elapsedMonths)) {
    school.lastPerformanceEventYear = school.yearIndex;
    queueEvent(state, { key: `performance:${school.yearIndex}`, type: "school_performance", priority: 35, data: { score: school.overallPerformance } });
  }
}

function topInterest(state) {
  return Object.entries(state.interests || {}).sort((a, b) => b[1] - a[1])[0] || ["reading", 0];
}

function maybeOfferActivity(state, elapsedMonths) {
  const age = state.character.ageMonths || 0;
  const school = state.childhood.school;
  if (age < 84 || school.lastActivityOfferYear === school.yearIndex) return;
  if (school.activities.length >= 2) return;
  if (nextRandom(state) >= 0.04 * Math.max(1, elapsedMonths)) return;
  const [interestKey] = topInterest(state);
  const activity = ACTIVITY_MAP[interestKey] || ACTIVITY_MAP.reading;
  if (school.activities.some((item) => item.id === activity.id)) return;
  school.availableActivity = { ...activity, interestKey };
  school.lastActivityOfferYear = school.yearIndex;
  queueEvent(state, { key: `activity:${school.yearIndex}:${activity.id}`, type: "activity_offer", priority: 36, data: { activity: school.availableActivity } });
}

function maybeQueueFieldTrip(state, elapsedMonths) {
  const age = state.character.ageMonths || 0;
  const school = state.childhood.school;
  if (age < 84 || school.lastFieldTripYear === school.yearIndex) return;
  if (nextRandom(state) >= 0.032 * Math.max(1, elapsedMonths)) return;
  school.lastFieldTripYear = school.yearIndex;
  queueEvent(state, { key: `field-trip:${school.yearIndex}`, type: "field_trip", priority: 34, data: { cost: between(state, 350, 900) } });
}

function maybeQueueGroupProject(state, elapsedMonths) {
  const school = state.childhood.school;
  if ((state.character.ageMonths || 0) < 72) return;
  if (state.character.ageMonths - (school.lastGroupProjectAtMonths ?? -120) < 9) return;
  if (nextRandom(state) >= 0.03 * Math.max(1, elapsedMonths)) return;
  const peers = currentClassmates(state).filter((person) => !person.deceased);
  if (!peers.length) return;
  const person = pick(state, peers);
  school.lastGroupProjectAtMonths = state.character.ageMonths;
  queueEvent(state, { key: `group-project:${state.character.ageMonths}:${person.id}`, type: "group_project", personId: person.id, priority: 34 });
}

function maybeQueueFriendSocialEvent(state, elapsedMonths) {
  const age = state.character.ageMonths || 0;
  const friends = visibleFriends(state);
  if (age < 84 || !friends.length) return;
  if (nextRandom(state) >= 0.028 * Math.max(1, elapsedMonths)) return;
  const friend = pick(state, friends);
  const type = age >= 108 && nextRandom(state) < 0.42 ? "sleepover" : "friend_birthday";
  queueEvent(state, { key: `${type}:${friend.id}:${state.childhood.school.yearIndex}`, type, personId: friend.id, priority: 32 });
}

function maybeQueuePeerDrama(state, elapsedMonths) {
  const school = state.childhood.school;
  const age = state.character.ageMonths || 0;
  if (age < 84 || age - (school.lastPeerDramaAtMonths ?? -120) < 8) return;
  const peers = currentClassmates(state);
  if (!peers.length) return;
  const chance = 0.025 * Math.max(1, elapsedMonths);
  if (nextRandom(state) >= chance) return;
  school.lastPeerDramaAtMonths = age;
  const friends = visibleFriends(state);
  const possibleRival = [...peers].sort((a, b) => (b.conflict || 0) - (a.conflict || 0))[0];
  if (possibleRival && ((possibleRival.conflict || 0) >= 28 || nextRandom(state) < 0.3)) {
    queueEvent(state, { key: `rivalry:${possibleRival.id}:${school.yearIndex}`, type: "rivalry", personId: possibleRival.id, priority: 38 });
    return;
  }
  if (friends.length >= 3 && nextRandom(state) < 0.45) {
    queueEvent(state, { key: `exclusion:${school.yearIndex}:${age}`, type: "social_exclusion", personIds: friends.slice(0, 3).map((person) => person.id), priority: 39 });
  }
}

function maybeQueueBullying(state, elapsedMonths) {
  const age = state.character.ageMonths || 0;
  if (age < 84) return;
  const peers = currentClassmates(state).filter((person) => person.role === "classmate" || person.school?.rival);
  if (!peers.length) return;
  const candidate = [...peers].sort((a, b) => (b.conflict || 0) - (a.conflict || 0))[0];
  if (!candidate) return;
  const existing = state.childhood.school.bullyingIncidents[candidate.id] || 0;
  const base = existing > 0 ? 0.012 : 0.006;
  const conflictBoost = Math.max(0, (candidate.conflict || 0) - 25) * 0.0006;
  if (nextRandom(state) < (base + conflictBoost) * Math.max(1, elapsedMonths)) {
    queueEvent(state, { key: `bullying:${candidate.id}:${existing + 1}:${Math.floor(age / 6)}`, type: "bullying", personId: candidate.id, priority: existing > 0 ? 55 : 44, data: { incident: existing + 1 } });
  }
}

function maybeQueueTeacherMoment(state, elapsedMonths) {
  const school = state.childhood.school;
  const teacher = personById(state, school.currentTeacherId);
  if (!teacher || teacher.deceased) return;
  if (nextRandom(state) < 0.018 * Math.max(1, elapsedMonths)) {
    const weakest = [...SUBJECT_KEYS].sort((a, b) => (school.performance[a] || 50) - (school.performance[b] || 50))[0];
    queueEvent(state, { key: `teacher-support:${school.yearIndex}:${weakest}`, type: "teacher_support", personId: teacher.id, priority: 31, data: { subject: weakest } });
  }
}

function addYearRecap(state, beforeAgeMonths) {
  const oldAge = Math.floor((beforeAgeMonths || 0) / 12);
  const age = Math.floor((state.character.ageMonths || 0) / 12);
  if (age <= oldAge || age <= 0) return;
  const friends = visibleFriends(state).sort((a, b) => (b.closeness || 0) - (a.closeness || 0));
  const crushPerson = state.childhood.crush?.status === "active" ? personById(state, state.childhood.crush.personId) : null;
  const parts = [];
  if (friends.length) parts.push(`${friends.length} friend${friends.length === 1 ? "" : "s"} are part of your school world${friends[0] ? `, with ${firstName(friends[0])} among the closest` : ""}`);
  if (crushPerson) parts.push(`you have a quiet crush on ${firstName(crushPerson)}`);
  if (state.childhood.school?.started) parts.push(`school is ${state.childhood.school.overallPerformance >= 65 ? "going fairly well" : state.childhood.school.overallPerformance < 48 ? "harder than usual" : "mixed"}`);
  const stage = stageLabel(childhoodStage(state)).toLowerCase();
  const text = `At ${age}, ${parts.length ? parts.join("; ") : `your ${stage} is still centered mostly on family and routine`}.`;
  state.childhood.yearRecaps.push({ age, ageMonths: state.character.ageMonths, text });
  state.childhood.yearRecaps = state.childhood.yearRecaps.slice(-10);
  state.worldEvents ||= [];
  state.worldEvents.push({ category: "Self", text, note: text, importance: 1, ageMonths: state.character.ageMonths, date: { ...state.date }, source: "childhood-v2" });
  state.worldEvents = state.worldEvents.slice(-100);
}

function advanceSchoolWorld(state, elapsedMonths) {
  if ((state.character.ageMonths || 0) < 60) return;
  ensureSchoolYear(state);
  ensureSchoolFriends(state, elapsedMonths);
  updateAttendanceAndEffort(state, elapsedMonths);
  calculatePerformance(state);
  driftFriendships(state, elapsedMonths);
  maybePromoteClassmate(state, elapsedMonths);
  maybeQueueGroupProject(state, elapsedMonths);
  maybeQueuePeerDrama(state, elapsedMonths);
  maybeQueueBullying(state, elapsedMonths);
  maybeQueueTeacherMoment(state, elapsedMonths);
  maybeQueuePerformanceEvent(state, elapsedMonths);
  maybeOfferActivity(state, elapsedMonths);
  maybeQueueFieldTrip(state, elapsedMonths);
  maybeQueueFriendSocialEvent(state, elapsedMonths);
  maybeQueueFirstDayEcho(state);
  updateCrush(state, elapsedMonths);
  updateFriendshipLabels(state);
}

export function advanceChildhoodWorld(state, elapsedMonths = 0, beforeAgeMonths = null) {
  ensureChildhoodState(state);
  const previousStage = state.childhood.stage;
  const nextStage = childhoodStage(state);
  if (previousStage !== nextStage) {
    state.childhood.stage = nextStage;
    state.childhood.stageEnteredAtMonths = state.character.ageMonths;
    queueStageTransition(state, previousStage, nextStage);
  }
  advanceSchoolWorld(state, elapsedMonths);
  addYearRecap(state, beforeAgeMonths ?? Math.max(0, state.character.ageMonths - elapsedMonths));
  return state;
}

function stageTransitionEvent(state, item) {
  const next = item.data?.nextStage;
  const caregiver = (state.people || []).find((person) => person.family?.caregiver && !person.deceased) || (state.people || []).find((person) => ["guardian", "secondGuardian"].includes(person.role) && !person.deceased);
  if (next === "early-school") return {
    id: "childhood_stage_early_school", category: "School", title: "Your world gets bigger",
    body: "School is becoming a world of its own. There are adults who are not family, children with different homes and personalities, rules that belong to classrooms, and friendships that can exist without your caregivers arranging them.",
    prompt: "What matters most at first?",
    choices: [
      { id: "people", label: "Finding people you like", result: "You start noticing who makes ordinary school days easier and more interesting.", effects: [{ type: "personality", key: "social", delta: 2 }, { type: "childhood", key: "socialConfidence", delta: 3 }] },
      { id: "rules", label: "Understanding how school works", result: "Knowing the routine makes the unfamiliar parts feel easier to manage.", effects: [{ type: "personality", key: "structure", delta: 2 }, { type: "education", key: "language", delta: 1 }] },
      { id: "home", label: `Knowing ${firstName(caregiver)} is still there after`, result: "The new world feels easier to enter when you know exactly where you return afterward.", effects: compact(relationshipEffect(caregiver, "trust", 2, "Starting school made familiar care at home feel especially important."), { type: "development", key: "attachment", delta: 1 }) },
    ],
  };
  if (next === "middle-childhood") return {
    id: "childhood_stage_middle", category: "Self", title: "People are becoming more complicated",
    body: "Friendships now have histories. People can be close to you and annoy you in the same week. You are also getting better at noticing where you fit, where you do not, and what other people may think of you.",
    prompt: "What do you pay the most attention to?",
    choices: [
      { id: "friends", label: "Your friendships", result: "You become more attentive to the small things that make one friendship different from another.", effects: [{ type: "childhood", key: "socialConfidence", delta: 2 }, { type: "pattern", key: "connecting", delta: 1 }] },
      { id: "skills", label: "What you are good at", result: "Competence begins becoming one of the ways you understand yourself.", effects: [{ type: "development", key: "confidence", delta: 2 }] },
      { id: "private", label: "Your own private world", result: "You keep more thoughts to yourself now. Not everything has to become family knowledge immediately.", effects: [{ type: "personality", key: "independence", delta: 2 }] },
    ],
  };
  if (next === "preteen") return {
    id: "childhood_stage_preteen", category: "Self", title: "You notice yourself being noticed",
    body: "You are old enough now that classmates, friendships, embarrassment, admiration, and belonging can occupy a surprising amount of mental space. Some feelings are still simple. Others are beginning to have layers.",
    prompt: "What do you tend to do with that awareness?",
    choices: [
      { id: "connect", label: "Lean into your friendships", result: "Friends become a more important place to test ideas, jokes, worries, and versions of yourself.", effects: [{ type: "personality", key: "social", delta: 2 }, { type: "pattern", key: "connecting", delta: 2 }] },
      { id: "observe", label: "Observe people carefully", result: "You pay attention before deciding how much of yourself to show.", effects: [{ type: "personality", key: "sensitivity", delta: 1 }, { type: "personality", key: "curiosity", delta: 1 }] },
      { id: "own", label: "Focus on your own interests", result: "The social world matters, but it does not get every piece of your attention.", effects: [{ type: "personality", key: "independence", delta: 2 }] },
    ],
  };
  return {
    id: "childhood_stage_preschool", category: "Self", title: "You are becoming more capable",
    body: "You can now do more things without an adult physically guiding every step. Play, language, questions, small rules, and very strong opinions take up more of your days.", prompt: "What do you keep trying to do?",
    choices: [
      { id: "self", label: "Do more by yourself", result: "Independence becomes something you practice in tiny, repetitive ways.", effects: [{ type: "personality", key: "independence", delta: 2 }] },
      { id: "ask", label: "Ask endless questions", result: "Every answer appears to generate at least two more questions. Adults discover this is mathematically unsustainable.", effects: [{ type: "personality", key: "curiosity", delta: 3 }] },
      { id: "play", label: "Turn everything into play", result: "Play remains one of the main ways you learn what people and objects can do.", effects: [{ type: "interest", key: "making", delta: 2 }] },
    ],
  };
}

function schoolYearStartEvent(state, item) {
  const school = state.childhood.school;
  const teacher = personById(state, school.currentTeacherId);
  const classmates = currentClassmates(state);
  const familiar = classmates.filter((person) => (person.introducedAtMonths || 0) < state.character.ageMonths).length;
  return {
    id: `school_year_start_${school.yearIndex}`, category: "School", title: `${school.grade} begins`,
    body: `${teacher?.name || "A new teacher"} is leading your class this year. ${familiar ? `${familiar} people in the room are already familiar, while other faces are new.` : "Most of the room still feels new."} Friendships from last year do not automatically disappear, but the daily geography of school has changed again.`,
    prompt: "What do you focus on first?",
    choices: [
      { id: "friends", label: "Find familiar friends", result: "You look for the people who already make school feel less anonymous.", effects: [{ type: "childhood", key: "socialConfidence", delta: 2 }] },
      { id: "new", label: "Notice the new people", result: "You pay attention to classmates you did not know last year. A reshuffled class means new possibilities as well as awkwardness.", effects: [{ type: "personality", key: "curiosity", delta: 2 }] },
      { id: "teacher", label: `Figure out ${teacher?.name || "your teacher"}`, result: "You watch what the new teacher rewards, corrects, and ignores. Understanding an adult's expectations makes the year easier to read.", effects: [{ type: "childhood", key: "teacherSupport", delta: 2 }, { type: "personality", key: "structure", delta: 1 }] },
    ],
  };
}

function newFriendEvent(state, item) {
  const person = personById(state, item.personId);
  const name = firstName(person);
  return {
    id: `childhood_new_friend_${person?.id || "peer"}`, category: "Friends", title: `${name} keeps ending up near you`,
    body: `You and ${name} have been talking and spending time together more often at school. It is not a grand declaration of friendship. It is mostly repetition: sitting nearby, finding each other at breaks, remembering what the other person likes.`,
    prompt: "What do you do as the friendship starts?",
    choices: [
      { id: "seek", label: `Look for ${name} at break`, result: "You start choosing each other on purpose instead of only ending up together by accident.", effects: compact(relationshipEffect(person, "closeness", 6, `You started seeking ${name} out during breaks.`), relationshipEffect(person, "trust", 3), { type: "childhood", key: "socialConfidence", delta: 2 }) },
      { id: "easy", label: "Let it develop naturally", result: "The friendship grows through ordinary days without either of you having to define it.", effects: compact(relationshipEffect(person, "familiarity", 5, `Your friendship with ${name} grew slowly through ordinary school days.`), relationshipEffect(person, "closeness", 2)) },
      { id: "group", label: "Include other kids too", result: "You make room for a wider circle instead of turning one new friendship into the whole social universe.", effects: compact(relationshipEffect(person, "trust", 2), { type: "personality", key: "social", delta: 2 }, { type: "childhood", key: "socialConfidence", delta: 2 }) },
    ],
  };
}

function newClassmateEvent(state, item) {
  const person = personById(state, item.personId);
  const name = firstName(person);
  return {
    id: `school_new_classmate_${person?.id || "peer"}`, category: "School", title: `${name} is new to your class`,
    body: `${name} is one of the classmates you do not know well yet. They have their own friends, habits, and opinions already. Being in the same room does not automatically make either of you important to the other.`,
    prompt: "What do you do?",
    choices: [
      { id: "hello", label: "Say hello sometime", result: "The conversation is brief, but the next interaction is now less strange than the first.", effects: compact(relationshipEffect(person, "familiarity", 4, `You made an effort to get to know ${name}.`), { type: "childhood", key: "socialConfidence", delta: 1 }) },
      { id: "observe", label: "See what they're like first", result: "You notice who they sit with and how they behave before deciding whether you want more contact.", effects: [{ type: "personality", key: "curiosity", delta: 1 }] },
      { id: "nothing", label: "Do nothing special", result: "They remain one of many people in the room. Not every classmate becomes part of your story immediately.", effects: [] },
    ],
  };
}

function friendshipOpeningEvent(state, item) {
  const person = personById(state, item.personId);
  const name = firstName(person);
  return {
    id: `school_friendship_opening_${person?.id || "peer"}`, category: "Friends", title: `You and ${name} keep talking`,
    body: `You have known ${name} as a classmate for a while. Lately the conversations have started continuing after the practical reason for talking is over.`,
    prompt: "What do you do?",
    choices: [
      { id: "friend", label: "Start looking for them at break", result: `The relationship crosses the vague line from classmate to friend because both of you keep choosing it.`, effects: compact(relationshipEffect(person, "closeness", 8, `You and ${name} became friends after spending more time together.`), relationshipEffect(person, "trust", 4), { type: "childhood", key: "promoteFriend", delta: 0 }) },
      { id: "class", label: "Keep it mostly in class", result: "You like talking to each other, but the relationship stays attached to the classroom for now.", effects: compact(relationshipEffect(person, "familiarity", 4)) },
      { id: "group", label: "Bring them into your group", result: "You introduce them to people you already spend time with. The social map changes a little around the new connection.", effects: compact(relationshipEffect(person, "closeness", 5), { type: "personality", key: "social", delta: 2 }, { type: "childhood", key: "promoteFriend", delta: 0 }) },
    ],
  };
}

function friendGroupEvent(state, item) {
  const people = (item.personIds || []).map((id) => personById(state, id)).filter(Boolean);
  const names = people.map(firstName);
  return {
    id: `childhood_friend_group_${state.childhood.school.yearIndex}`, category: "Friends", title: "Your friendships start overlapping",
    body: `${names.slice(0, 4).join(", ")} do not belong to separate little boxes anymore. Sometimes you are all together. Sometimes two people are closer on a particular day. The group has its own rhythm, jokes, and tiny frictions.`,
    prompt: "How do you fit into the group?",
    choices: [
      { id: "mix", label: "Move easily between people", result: "You stop treating friendship like a choice where liking one person means choosing against another.", effects: [{ type: "personality", key: "social", delta: 2 }, { type: "childhood", key: "socialConfidence", delta: 3 }] },
      { id: "closest", label: `Stay closest to ${names[0] || "one friend"}`, result: "You enjoy the group, but one friendship still feels like the safest center of it.", effects: compact(relationshipEffect(people[0], "closeness", 3, `Even in a larger friend group, you stayed especially close to ${names[0]}.`)) },
      { id: "edge", label: "Hang back when the group gets loud", result: "You like having several friends without needing to be the center of every group moment.", effects: [{ type: "personality", key: "social", delta: -1 }, { type: "personality", key: "independence", delta: 1 }] },
    ],
  };
}

function friendDriftEvent(state, item) {
  const person = personById(state, item.personId);
  const name = firstName(person);
  return {
    id: `childhood_friend_drift_${person?.id || "friend"}`, category: "Friends", title: `You and ${name} have been drifting`,
    body: "Nothing dramatic happened. You simply stopped finding each other as often, and the friendship has begun to feel less automatic than it used to.",
    prompt: "What do you do?",
    choices: [
      { id: "reach", label: `Ask ${name} to hang out`, result: "The first few minutes feel slightly unfamiliar, then older habits begin returning.", effects: compact(relationshipEffect(person, "closeness", 6, `You noticed the distance and reached out to ${name}.`), relationshipEffect(person, "trust", 2)) },
      { id: "accept", label: "Let the friendship change", result: "You do not turn the distance into a fight. Some friendships become smaller without becoming meaningless.", effects: [{ type: "development", key: "emotionalRegulation", delta: 2 }, { type: "personality", key: "independence", delta: 1 }, { type: "childhood", key: "allowFormerFriend", delta: 0 }] },
      { id: "hurt", label: "Take the distance personally", result: "You cannot help reading the distance as rejection, at least for now.", effects: [{ type: "health", key: "stress", delta: 2 }, { type: "personality", key: "sensitivity", delta: 1 }] },
    ],
  };
}

function friendConflictEvent(state, item) {
  const person = personById(state, item.personId);
  const name = firstName(person);
  return {
    id: `childhood_friend_conflict_${person?.id || "friend"}`, category: "Friends", title: `You and ${name} are annoyed with each other`,
    body: "The disagreement is small enough that adults would probably call it silly and important enough that neither of you experiences it that way.",
    prompt: "What do you do next?",
    choices: [
      { id: "talk", label: "Talk to them directly", result: "The conversation is awkward, but both of you leave it understanding a little more than before.", effects: compact(relationshipEffect(person, "conflict", -6, `You and ${name} talked through a disagreement.`), relationshipEffect(person, "trust", 4), { type: "development", key: "emotionalRegulation", delta: 2 }) },
      { id: "cool", label: "Take some space first", result: "A little distance keeps the argument from growing teeth it did not originally have.", effects: compact(relationshipEffect(person, "conflict", -3), { type: "development", key: "emotionalRegulation", delta: 1 }) },
      { id: "double", label: "Refuse to back down", result: "The disagreement lasts longer because being right currently feels more important than being close.", effects: compact(relationshipEffect(person, "conflict", 4, `A disagreement with ${name} became more stubborn before it became better.`), relationshipEffect(person, "closeness", -2)) },
    ],
  };
}

function firstDayEchoEvent(state, item) {
  const choice = item.data?.choiceId;
  const text = choice === "friendly"
    ? "On your first day, you chose to sit beside someone who smiled at you. Since then, school has filled with more names and more relationships. One friendly face was only the beginning."
    : choice === "back"
      ? "On your first day, you chose a quiet place where you could watch the room. You still tend to understand new groups from the edges first, but now there are people inside the room who know you too."
      : "On your first day, you focused on the classroom itself. Now school is no longer just desks, teachers, and rules. It also contains people who have histories with you.";
  return {
    id: "childhood_first_day_echo", category: "School", title: "School does not feel new anymore", body: text, prompt: "What has changed most?",
    choices: [
      { id: "friends", label: "You know who your people are", result: "Belonging has become less theoretical. There are specific people you expect to see.", effects: [{ type: "childhood", key: "socialConfidence", delta: 2 }, { type: "pattern", key: "connecting", delta: 1 }] },
      { id: "confidence", label: "You know how to handle the day", result: "Familiarity with the routine has quietly become competence.", effects: [{ type: "development", key: "confidence", delta: 2 }, { type: "personality", key: "structure", delta: 1 }] },
      { id: "still", label: "Some parts still feel hard", result: "Familiar does not automatically mean easy. You have learned the shape of the difficulty, which is still a kind of knowledge.", effects: [{ type: "development", key: "persistence", delta: 2 }] },
    ],
  };
}

function groupProjectEvent(state, item) {
  const person = personById(state, item.personId);
  const name = firstName(person);
  return {
    id: `school_group_project_${item.key}`, category: "School", title: `A project with ${name}`,
    body: `Your teacher pairs you with ${name} for a project that will take more than one afternoon. How well this goes depends partly on the work and partly on whether two children can agree on what “done” means.`,
    prompt: "How do you handle the project?",
    choices: [
      { id: "plan", label: "Make a plan together", result: "Splitting the work makes the project less chaotic, and both of you know what the other person is supposed to do.", effects: compact(relationshipEffect(person, "trust", 3, `You worked well with ${name} on a school project.`), { type: "personality", key: "structure", delta: 2 }, { type: "education", key: "science", delta: 2 }, { type: "childhood", key: "effort", delta: 2 }) },
      { id: "lead", label: "Take the lead", result: "You make sure the project moves forward, though ${name} sometimes looks like they would enjoy being consulted more.", effects: compact(relationshipEffect(person, "closeness", -1), { type: "development", key: "confidence", delta: 2 }, { type: "childhood", key: "effort", delta: 2 }) },
      { id: "coast", label: "Do only your part", result: "The project gets finished without becoming a friendship milestone. Functional cooperation is still cooperation.", effects: [{ type: "education", key: "language", delta: 1 }] },
    ],
  };
}

function rivalryEvent(state, item) {
  const person = personById(state, item.personId);
  const name = firstName(person);
  return {
    id: `school_rivalry_${person?.id || "peer"}_${state.childhood.school.yearIndex}`, category: "School", title: `${name} keeps turning things into a competition`,
    body: `Lately, ${name} seems to notice your scores, who gets picked first, and who the teacher praises. Sometimes the competition is motivating. Sometimes it is exhausting.`,
    prompt: "How do you respond?",
    choices: [
      { id: "compete", label: "Compete back", result: "You start paying more attention to the comparison too. Your effort rises, along with the chance that every small result starts feeling personal.", effects: compact(relationshipEffect(person, "conflict", 5, `You and ${name} became competitive at school.`), { type: "childhood", key: "effort", delta: 4 }, { type: "health", key: "stress", delta: 1 }) },
      { id: "own", label: "Focus on your own work", result: "You let the comparison exist without agreeing that it has to decide how you feel about yourself.", effects: [{ type: "development", key: "confidence", delta: 2 }, { type: "development", key: "emotionalRegulation", delta: 2 }] },
      { id: "friendly", label: "Keep the competition friendly", result: "You joke about the rivalry and make room for both of you to do well without treating success as a limited resource.", effects: compact(relationshipEffect(person, "conflict", -2), relationshipEffect(person, "familiarity", 3), { type: "childhood", key: "socialConfidence", delta: 1 }) },
    ],
  };
}

function socialExclusionEvent(state, item) {
  const people = (item.personIds || []).map((id) => personById(state, id)).filter(Boolean);
  const names = people.map(firstName);
  return {
    id: `school_exclusion_${state.childhood.school.yearIndex}_${item.createdAtMonths}`, category: "Friends", title: "You realize a plan happened without you",
    body: `${names.slice(0, 3).join(", ")} are talking about something they did together. Nobody announced that you were excluded. You simply understand, a few sentences into the conversation, that you were not there and were not asked.`,
    prompt: "What do you do with that feeling?",
    choices: [
      { id: "ask", label: "Ask why you weren't invited", result: "The answer is less dramatic than your imagination made it. It still gives you useful information about where you stand.", effects: compact(relationshipEffect(people[0], "trust", 2), { type: "development", key: "confidence", delta: 2 }) },
      { id: "other", label: "Spend time with someone else", result: "You remember that one group is not the entire social world available to you.", effects: [{ type: "personality", key: "independence", delta: 2 }, { type: "health", key: "stress", delta: -1 }] },
      { id: "pretend", label: "Pretend it doesn't bother you", result: "You keep the feeling private. It fades eventually, though not as quickly as you would like.", effects: [{ type: "personality", key: "sensitivity", delta: 1 }, { type: "health", key: "stress", delta: 2 }] },
    ],
  };
}

function bullyingEvent(state, item) {
  const person = personById(state, item.personId);
  const name = firstName(person);
  const repeated = (item.data?.incident || 1) > 1;
  const teacher = personById(state, state.childhood.school.currentTeacherId);
  return {
    id: `school_bullying_${person?.id || "peer"}_${item.data?.incident || 1}`, category: "School", title: repeated ? `${name} has not stopped` : `${name} keeps picking at you`,
    body: repeated
      ? `This is no longer one unpleasant interaction. ${name} has repeated the teasing or exclusion enough that you have started anticipating it before it happens. That pattern matters.`
      : `${name} makes a pointed joke at your expense and keeps going after it is obvious you are not enjoying it. One incident does not define the relationship, but you notice the line that was crossed.`,
    prompt: "What do you do?",
    choices: [
      { id: "adult", label: `Tell ${teacher?.name || "a trusted adult at school"}`, result: "An adult knows what has been happening now. That does not guarantee an instant solution, but the problem is no longer yours to manage alone.", effects: compact(relationshipEffect(teacher, "trust", 3), relationshipEffect(person, "conflict", -2), { type: "childhood", key: "teacherSupport", delta: 5 }, { type: "health", key: "stress", delta: -1 }) },
      { id: "firm", label: "Tell them clearly to stop", result: `You make the boundary unmistakable. ${name}'s reaction is not entirely under your control, but your position is.`, effects: compact(relationshipEffect(person, "conflict", 1), { type: "development", key: "confidence", delta: 3 }) },
      { id: "friends", label: "Stay close to your friends", result: "You reduce the number of moments when you are alone around the problem. Being accompanied changes the social balance even before anyone says much.", effects: [{ type: "pattern", key: "connecting", delta: 2 }, { type: "health", key: "stress", delta: -1 }] },
    ],
  };
}

function teacherSupportEvent(state, item) {
  const teacher = personById(state, item.personId);
  const subject = item.data?.subject || "schoolwork";
  const label = ({ mathematics: "mathematics", language: "language", science: "science", art: "art", physicalEducation: "PE" })[subject] || subject;
  return {
    id: `school_teacher_support_${state.childhood.school.yearIndex}_${subject}`, category: "School", title: `${teacher?.name || "Your teacher"} notices where you are getting stuck`,
    body: `${teacher?.name || "Your teacher"} keeps you for a few minutes after an activity and explains part of ${label} in a different way. It is not a rescue. It is simply an adult paying enough attention to notice the exact part that is difficult.`,
    prompt: "How do you respond?",
    choices: [
      { id: "ask", label: "Ask the questions you were hiding", result: "Once you start asking, the confusion becomes specific enough to work on.", effects: compact(relationshipEffect(teacher, "trust", 4, `${teacher?.name || "Your teacher"} helped you when you were struggling with ${label}.`), { type: "education", key: subject, delta: 4 }, { type: "childhood", key: "teacherSupport", delta: 4 }) },
      { id: "practice", label: "Try the explanation again yourself", result: "You repeat the method until it feels less borrowed and more like something you can actually use.", effects: [{ type: "education", key: subject, delta: 3 }, { type: "development", key: "persistence", delta: 2 }, { type: "childhood", key: "effort", delta: 2 }] },
      { id: "embarrassed", label: "Feel embarrassed about needing help", result: "You understand more afterward, even if being seen struggling still stings.", effects: [{ type: "education", key: subject, delta: 2 }, { type: "personality", key: "sensitivity", delta: 1 }] },
    ],
  };
}

function schoolPerformanceEvent(state, item) {
  const score = item.data?.score ?? state.childhood.school.overallPerformance;
  const attendance = state.childhood.school.attendance;
  const effort = state.childhood.school.effort;
  const title = score >= 76 ? "Your schoolwork is going well" : score >= 58 ? "Your schoolwork is mixed" : "School has been difficult lately";
  const body = score >= 76
    ? `Your recent work has been strong. It is not just ability: your attendance is around ${attendance}% and your effort has been fairly consistent.`
    : score >= 58
      ? `Some subjects are going better than others. Attendance, energy, effort, and what is happening at home are all showing up in the pattern rather than every result being a pure measure of talent.`
      : `Your recent results have been rough. That does not automatically mean you are incapable. Attendance is around ${attendance}%, your current effort level is ${effort}, and stress or low energy can make school harder to access even when you understand the material.`;
  return {
    id: `school_performance_${state.childhood.school.yearIndex}`, category: "School", title, body, prompt: "What do you do about it?",
    choices: [
      { id: "work", label: "Put more effort into the weakest subject", result: "You decide that improvement deserves a specific target instead of a vague promise to 'do better.'", effects: [{ type: "childhood", key: "effort", delta: 5 }, { type: "development", key: "persistence", delta: 2 }] },
      { id: "help", label: "Ask for help where you need it", result: "You treat difficulty as information instead of a verdict. Someone else can sometimes see the missing step faster than you can.", effects: [{ type: "childhood", key: "teacherSupport", delta: 3 }, { type: "development", key: "confidence", delta: 1 }] },
      { id: "balance", label: "Protect your energy too", result: "You make room for rest instead of trying to solve school by exhausting yourself further.", effects: [{ type: "health", key: "energy", delta: 3 }, { type: "health", key: "stress", delta: -2 }] },
    ],
  };
}

function activityOfferEvent(state, item) {
  const activity = item.data?.activity || state.childhood.school.availableActivity || ACTIVITY_MAP.reading;
  const tight = state.household?.financeBand === "Tight";
  const feeCopy = activity.cost > 0 ? ` It costs about ₱${activity.cost} for materials or participation.` : " It does not require a fee.";
  return {
    id: `school_activity_${activity.id}_${state.childhood.school.yearIndex}`, category: "Interests", title: `${activity.label} is open to new members`,
    body: `A school activity lines up with something you already seem to enjoy.${feeCopy}${tight && activity.cost ? " Money at home is tight enough that the fee is not a trivial detail." : ""}`,
    prompt: "What do you do?",
    choices: tight && activity.cost ? [
      { id: "assistance", label: "Ask if there is a cheaper way to join", result: "The school finds a way to reduce or waive some of the cost. You get to participate without pretending money was irrelevant.", effects: [{ type: "childhood", key: "joinActivityAssisted", delta: 0 }, { type: "interest", key: activity.interestKey || "reading", delta: 4 }] },
      { id: "ask_home", label: "Ask your family anyway", result: "The adults at home look at the cost before they answer. The activity becomes one of those small decisions where money and opportunity meet.", effects: [{ type: "childhood", key: "joinActivityPaid", delta: 0 }, { type: "childhood", key: "householdSavings", delta: -activity.cost }] },
      { id: "skip", label: "Skip it for now", result: "You keep the interest without joining the formal activity. Not every skill needs a club to exist.", effects: [{ type: "personality", key: "independence", delta: 1 }] },
    ] : [
      { id: "join", label: `Join ${activity.label}`, result: "The interest gains a regular place in your week and puts you around other children who chose the same thing.", effects: [{ type: "childhood", key: "joinActivityPaid", delta: 0 }, { type: "childhood", key: "householdSavings", delta: -activity.cost }, { type: "interest", key: activity.interestKey || "reading", delta: 5 }] },
      { id: "try", label: "Try it before committing", result: "You give the activity a chance without turning one afternoon of curiosity into a lifelong identity.", effects: [{ type: "interest", key: activity.interestKey || "reading", delta: 2 }] },
      { id: "skip", label: "Keep your time free", result: "You decide you like having some afternoons without another scheduled thing waiting for you.", effects: [{ type: "health", key: "stress", delta: -1 }] },
    ],
  };
}

function fieldTripEvent(state, item) {
  const cost = item.data?.cost || 500;
  const tight = state.household?.financeBand === "Tight";
  const friend = visibleFriends(state)[0];
  return {
    id: `school_field_trip_${state.childhood.school.yearIndex}`, category: "School", title: "A field trip permission slip comes home",
    body: `Your class is going on a field trip. The fee is ₱${cost}. ${tight ? "At home, that amount is large enough to require an actual conversation instead of a quick signature." : "Your family can probably manage it, although it is still money being spent."}`,
    prompt: "What do you do?",
    choices: tight ? [
      { id: "ask", label: "Ask if you can still go", result: "You bring the slip home instead of deciding for the adults. They look at the cost, the timing, and what else the household needs this week.", effects: [{ type: "childhood", key: "householdSavings", delta: -Math.round(cost * 0.5) }, { type: "development", key: "confidence", delta: 1 }] },
      { id: "assistance", label: "Ask the school about assistance", result: "There is a quieter path through the problem: a reduced fee, sponsorship, or another arrangement. You get to go without the household carrying the full cost.", effects: [{ type: "childhood", key: "teacherSupport", delta: 2 }, { type: "health", key: "stress", delta: -1 }] },
      { id: "skip", label: "Tell your family it's okay to skip it", result: "You miss the trip. The decision is practical, not a moral lesson about gratitude, and you are still allowed to be disappointed.", effects: [{ type: "personality", key: "sensitivity", delta: 1 }] },
    ] : [
      { id: "go", label: "Go on the trip", result: `${friend ? `You spend part of the day with ${firstName(friend)} outside the usual classroom.` : "The class feels different outside the usual room."} The trip becomes one of the year's distinct school memories.`, effects: compact(relationshipEffect(friend, "closeness", 2), { type: "childhood", key: "householdSavings", delta: -cost }, { type: "personality", key: "curiosity", delta: 2 }), memory: { importance: 3, title: "A school field trip", copy: "You went somewhere with your class and saw your school world outside its usual walls." } },
      { id: "skip", label: "Skip it", result: "You stay behind while most of the class goes. It is quieter than a normal school day and slightly strange to hear about the trip afterward.", effects: [{ type: "personality", key: "independence", delta: 1 }] },
      { id: "friend", label: `Check whether ${firstName(friend, "your friends")} is going`, result: "Part of the decision becomes social. Places often feel more appealing when you already know who will be beside you.", effects: compact(relationshipEffect(friend, "closeness", 1)) },
    ],
  };
}

function friendBirthdayEvent(state, item) {
  const person = personById(state, item.personId);
  const name = firstName(person);
  return {
    id: `school_friend_birthday_${person?.id || "friend"}_${state.childhood.school.yearIndex}`, category: "Friends", title: `${name} invites you to a birthday`,
    body: `${name} is having a small birthday gathering and asks if you can come. For once the friendship exists somewhere other than school corridors and lunch breaks.`,
    prompt: "What do you do?",
    choices: [
      { id: "go", label: "Go", result: "You meet pieces of their life that do not belong to school: family, home routines, and other people who know them differently.", effects: compact(relationshipEffect(person, "closeness", 5, `You went to ${name}'s birthday and saw more of their life outside school.`), relationshipEffect(person, "trust", 2)), memory: { importance: 2, title: `${name}'s birthday`, copy: `You went to ${name}'s birthday and spent time together outside school.` } },
      { id: "gift", label: "Make them something small", result: "The gift is not expensive. The time you spent making it communicates something money would have communicated less precisely.", effects: compact(relationshipEffect(person, "affection", 4), { type: "interest", key: "making", delta: 2 }) },
      { id: "decline", label: "Say you can't go", result: "You miss the gathering without turning it into a statement about the friendship.", effects: compact(relationshipEffect(person, "closeness", -1)) },
    ],
  };
}

function sleepoverEvent(state, item) {
  const person = personById(state, item.personId);
  const name = firstName(person);
  return {
    id: `school_sleepover_${person?.id || "friend"}_${state.childhood.school.yearIndex}`, category: "Friends", title: `${name} asks if you can stay over`,
    body: `${name} asks whether you can sleep at their house after a weekend hangout. Your caregiver still has to agree, and their answer can depend on how well they know the family and what they consider safe.`,
    prompt: "What do you do?",
    choices: [
      { id: "ask", label: "Ask your caregiver", result: "You bring the request home instead of assuming the answer. The adults ask predictable adult questions about who will be there and when you would come home.", effects: compact(relationshipEffect(person, "trust", 2), { type: "development", key: "autonomy", delta: 1 }) },
      { id: "day", label: "Suggest hanging out during the day instead", result: "You keep the friendship outside school without needing an overnight plan.", effects: compact(relationshipEffect(person, "closeness", 2)) },
      { id: "no", label: "Say you'd rather not", result: "You decline without needing a dramatic reason. Friendship does not require agreeing to every form of closeness.", effects: [{ type: "development", key: "confidence", delta: 1 }] },
    ],
  };
}

function crushBeginEvent(state, item) {
  const person = personById(state, item.personId);
  const name = firstName(person);
  const otherFriend = visibleFriends(state).find((friend) => friend.id !== person?.id);
  return {
    id: `childhood_crush_begin_${person?.id || "peer"}`, category: "Friends", title: `You keep noticing ${name}`,
    body: `You have known ${name} as a person at school, but lately your attention behaves differently around them. You notice when they arrive, remember small things they said, and feel strangely aware of yourself when they are nearby. It is a crush, although the word feels larger than the actual situation.`,
    prompt: "What do you do with the feeling?",
    choices: [
      { id: "near", label: `Find reasons to be near ${name}`, result: `You talk to ${name} a little more often. Nothing cinematic happens. You simply become more aware of every ordinary interaction.`, effects: compact(relationshipEffect(person, "closeness", 3, `You developed a crush on ${name} and started seeking them out a little more.`), { type: "childhood", key: "crushIntensity", delta: 5 }, { type: "childhood", key: "socialConfidence", delta: 1 }) },
      { id: "normal", label: "Act exactly the same as usual", result: "You make a determined effort to behave normally, which mostly makes you notice how hard you are trying to behave normally.", effects: [{ type: "childhood", key: "crushIntensity", delta: 1 }, { type: "development", key: "emotionalRegulation", delta: 1 }] },
      otherFriend ? { id: "tell", label: `Tell ${firstName(otherFriend)}`, result: `${firstName(otherFriend)} reacts with the enormous seriousness that childhood gossip requires, then promises not to tell anyone.`, effects: compact(relationshipEffect(otherFriend, "trust", 4, `You trusted ${firstName(otherFriend)} with the fact that you liked ${name}.`), { type: "childhood", key: "socialConfidence", delta: 1 }) } : { id: "private", label: "Keep it completely private", result: "The feeling becomes a small private fact you carry around school with you.", effects: [{ type: "personality", key: "independence", delta: 1 }] },
    ],
  };
}

function crushFollowupEvent(state, item) {
  const person = personById(state, item.personId);
  const name = firstName(person);
  return {
    id: `childhood_crush_followup_${person?.id || "peer"}`, category: "Friends", title: `${name} makes you laugh`,
    body: `During an otherwise ordinary school day, ${name} says something that makes you laugh harder than it deserves. For the rest of the afternoon, the moment keeps replaying in your head. There is no evidence this means anything to them beyond a joke. Your brain is unconcerned with that limitation.`,
    prompt: "What do you do afterward?",
    choices: [
      { id: "talk", label: `Talk to ${name} again later`, result: "You manage another ordinary conversation. The fact that it is ordinary is both reassuring and mildly disappointing.", effects: compact(relationshipEffect(person, "familiarity", 3, `You became more comfortable talking to ${name} while your crush continued.`), { type: "childhood", key: "socialConfidence", delta: 2 }) },
      { id: "replay", label: "Replay it privately", result: "The joke improves dramatically in memory, as crush-related archival systems are not known for objectivity.", effects: [{ type: "childhood", key: "crushIntensity", delta: 3 }] },
      { id: "move", label: "Distract yourself with friends", result: "Other friendships pull you back into the larger school day. One person does not get to consume the whole social map.", effects: [{ type: "childhood", key: "crushIntensity", delta: -2 }, { type: "pattern", key: "connecting", delta: 1 }] },
    ],
  };
}

function crushSignalEvent(state, item) {
  const person = personById(state, item.personId);
  const name = firstName(person);
  return {
    id: `childhood_crush_signal_${person?.id || "peer"}`, category: "Friends", title: `${name} starts seeking you out too`,
    body: `${name} has been choosing the seat near you, starting conversations, and finding small reasons to stay around after everyone else moves on. It could mean they like you. It could also mean they simply feel close to you. You do not actually know yet.`,
    prompt: "How do you handle the possibility?",
    choices: [
      { id: "enjoy", label: "Enjoy it without forcing an answer", result: "You let the closeness exist without interrogating every interaction for proof.", effects: compact(relationshipEffect(person, "closeness", 3), { type: "development", key: "emotionalRegulation", delta: 2 }, { type: "childhood", key: "crushPossibleMutual", delta: 0 }) },
      { id: "ask", label: "Eventually ask if they like you", result: `${name} admits they like you too, in the awkward, incomplete way children often admit things that suddenly feel enormous. Nothing else has to happen immediately.`, effects: compact(relationshipEffect(person, "trust", 4, `${name} told you they liked you too.`), { type: "childhood", key: "crushMutual", delta: 0 }), memory: { importance: 3, title: `Finding out ${name} liked you too`, copy: `${name} admitted that your preteen crush was mutual.` } },
      { id: "avoid", label: "Get nervous and pull back a little", result: "The possibility feels more frightening once it might be real, so you create a little distance while you work out what you want.", effects: compact(relationshipEffect(person, "closeness", -2), { type: "childhood", key: "crushIntensity", delta: 1 }) },
    ],
  };
}

function sameCrushEvent(state, item) {
  const crush = personById(state, item.personId);
  const friend = personById(state, item.secondaryPersonId);
  const crushName = firstName(crush);
  const friendName = firstName(friend);
  return {
    id: `childhood_same_crush_${crush?.id || "peer"}_${friend?.id || "friend"}`, category: "Friends", title: `${friendName} tells you they like ${crushName}`, 
    body: `${friendName} trusts you with a secret: they have a crush on ${crushName}. They do not know that you like the same person. Nobody has betrayed anyone. Human feelings have simply managed to create paperwork without a single form being involved.`,
    prompt: "What do you do?",
    choices: [
      { id: "honest", label: `Tell ${friendName} you like ${crushName} too`, result: "The conversation becomes awkward, but at least neither of you has to build a friendship around a hidden competition.", effects: compact(relationshipEffect(friend, "trust", 5, `You and ${friendName} discovered you both liked ${crushName}.`), { type: "development", key: "confidence", delta: 2 }) },
      { id: "private", label: "Keep your crush private", result: "You listen without telling them. The secret becomes heavier now that another person's feelings are sitting beside it.", effects: [{ type: "health", key: "stress", delta: 1 }] },
      { id: "support", label: `Support ${friendName}`, result: "You decide the friendship matters more than turning the crush into a contest. That does not instantly switch your feelings off, but it changes what you do with them.", effects: compact(relationshipEffect(friend, "closeness", 4), { type: "childhood", key: "crushIntensity", delta: -4 }, { type: "development", key: "emotionalRegulation", delta: 2 }) },
    ],
  };
}

function crushFadeEvent(state, item) {
  const person = personById(state, item.personId);
  const name = firstName(person);
  return {
    id: `childhood_crush_fade_${person?.id || "peer"}`, category: "Self", title: `The feeling about ${name} is changing`,
    body: `At some point you realize you are not checking the room for ${name} the way you used to. The crush did not end in a dramatic scene. It simply became less important while other parts of your life kept growing.`,
    prompt: "How do you think about it now?",
    choices: [
      { id: "fond", label: "Remember it fondly", result: "You keep the feeling as one of those small private chapters that mattered mostly because it was yours.", effects: [{ type: "development", key: "emotionalRegulation", delta: 1 }] },
      { id: "friend", label: `Just see ${name} as a friend`, result: "The friendship becomes easier to see without the extra layer of nervous attention.", effects: compact(relationshipEffect(person, "trust", 2, `Your crush on ${name} faded, and the friendship remained.`), { type: "childhood", key: "crushIntensity", delta: -20 }) },
      { id: "shrug", label: "Barely think about it", result: "The feeling becomes old information surprisingly quickly.", effects: [{ type: "personality", key: "independence", delta: 1 }] },
    ],
  };
}

function schoolYearRecapEvent(state, item) {
  return {
    id: `school_year_recap_${item.data?.yearIndex ?? 0}`, category: "School", title: `${item.data?.grade || "The school year"} is becoming part of your past`,
    body: item.data?.text || "Another school year has accumulated enough ordinary days to become a chapter of its own.",
    prompt: "What stays with you most?",
    choices: [
      { id: "people", label: "The people", result: "Names, jokes, arguments, and ordinary routines are what make the year feel specific when you look back.", effects: [{ type: "pattern", key: "connecting", delta: 1 }] },
      { id: "work", label: "What you learned", result: "Some subjects became easier, some stayed difficult, and your idea of what you can do shifted with the evidence.", effects: [{ type: "development", key: "confidence", delta: 1 }] },
      { id: "change", label: "How different you feel", result: "The year is evidence that growing up usually happens too slowly to notice until you compare two distant versions of yourself.", effects: [{ type: "development", key: "autonomy", delta: 1 }] },
    ],
  };
}

function buildEvent(state, item) {
  if (!item) return null;
  if (item.type === "stage_transition") return stageTransitionEvent(state, item);
  if (item.type === "school_year_start") return schoolYearStartEvent(state, item);
  if (item.type === "new_friend") return newFriendEvent(state, item);
  if (item.type === "new_classmate") return newClassmateEvent(state, item);
  if (item.type === "friendship_opening") return friendshipOpeningEvent(state, item);
  if (item.type === "friend_group") return friendGroupEvent(state, item);
  if (item.type === "friend_drift") return friendDriftEvent(state, item);
  if (item.type === "friend_conflict") return friendConflictEvent(state, item);
  if (item.type === "first_day_echo") return firstDayEchoEvent(state, item);
  if (item.type === "group_project") return groupProjectEvent(state, item);
  if (item.type === "rivalry") return rivalryEvent(state, item);
  if (item.type === "social_exclusion") return socialExclusionEvent(state, item);
  if (item.type === "bullying") return bullyingEvent(state, item);
  if (item.type === "teacher_support") return teacherSupportEvent(state, item);
  if (item.type === "school_performance") return schoolPerformanceEvent(state, item);
  if (item.type === "activity_offer") return activityOfferEvent(state, item);
  if (item.type === "field_trip") return fieldTripEvent(state, item);
  if (item.type === "friend_birthday") return friendBirthdayEvent(state, item);
  if (item.type === "sleepover") return sleepoverEvent(state, item);
  if (item.type === "crush_begin") return crushBeginEvent(state, item);
  if (item.type === "crush_followup") return crushFollowupEvent(state, item);
  if (item.type === "crush_signal") return crushSignalEvent(state, item);
  if (item.type === "same_crush") return sameCrushEvent(state, item);
  if (item.type === "crush_fade") return crushFadeEvent(state, item);
  if (item.type === "school_year_recap") return schoolYearRecapEvent(state, item);
  return null;
}

export function childhoodEventForState(state) {
  ensureChildhoodState(state);
  const item = state.childhood.eventQueue[0];
  const event = buildEvent(state, item);
  if (!event) return null;
  return { ...event, contextKind: "childhood-v2", childhoodQueueKey: item.key, childhoodType: item.type, childhoodPersonId: item.personId || null, childhoodSecondaryPersonId: item.secondaryPersonId || null };
}

export function applyChildhoodEffect(state, effect) {
  ensureChildhoodState(state);
  const childhood = state.childhood;
  const school = childhood.school;
  const delta = effect.delta || 0;
  if (effect.key === "socialConfidence") childhood.socialConfidence = clamp((childhood.socialConfidence ?? 50) + delta);
  if (effect.key === "crushIntensity" && childhood.crush) childhood.crush.intensity = clamp((childhood.crush.intensity ?? 50) + delta);
  if (effect.key === "teacherSupport") school.teacherSupport = clamp((school.teacherSupport ?? 58) + delta);
  if (effect.key === "effort") school.effort = clamp((school.effort ?? 52) + delta);
  if (effect.key === "attendance") school.attendance = clamp((school.attendance ?? 95) + delta);
  if (effect.key === "householdSavings") state.household.savings = Math.max(0, (state.household.savings || 0) + delta);
  if (effect.key === "crushPossibleMutual" && childhood.crush) childhood.crush.reciprocity = "possible";
  if (effect.key === "crushMutual" && childhood.crush) childhood.crush.reciprocity = "mutual";
}

function addChoiceMemory(state, event, choice) {
  const memory = choice?.memory;
  if (!memory || (memory.importance || 0) < 2) return;
  state.memories ||= [];
  const age = Math.floor((state.character.ageMonths || 0) / 12);
  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  state.memories.push({
    id: `${event.id}-${state.memories.length + 1}`,
    age,
    ageMonths: state.character.ageMonths,
    date: `${monthNames[state.date?.month || 0]} ${state.date?.day || 1}, ${state.date?.year || 2026}`,
    title: memory.title,
    copy: memory.copy,
    importance: memory.importance,
    featured: memory.importance >= 4,
    sourceEventId: event.id,
    sourceChoiceId: choice.id,
  });
}

function commitSpecialConsequences(state, event, choice) {
  const person = personById(state, event.childhoodPersonId);
  const type = event.childhoodType;
  const school = state.childhood.school;
  if (type === "friendship_opening" && ["friend", "group"].includes(choice?.id)) {
    promoteToFriend(state, person, `You and ${firstName(person)} became friends during ${school.grade}.`);
    recordYearChange(state, "friendsGained", person?.name);
  }
  if (type === "friend_drift" && choice?.id === "accept" && person) {
    person.school ||= {};
    person.school.friendshipStatus = "former";
    person.role = "classmate";
    person.relationshipLabel = "Former friend";
    person.npc.currentThread = `You and ${firstName(person)} used to be closer. The friendship became smaller without a single dramatic ending.`;
    recordYearChange(state, "friendsLost", person.name);
  }
  if (type === "rivalry" && choice?.id === "compete" && person) {
    person.school ||= {};
    person.school.rival = true;
    person.relationshipLabel = "Rival / classmate";
    markMajorSchoolEvent(state, `A rivalry with ${firstName(person)} became part of the year.`);
  }
  if (type === "bullying" && person) {
    school.bullyingIncidents[person.id] = Math.max(school.bullyingIncidents[person.id] || 0, Number(event.id.split("_").pop()) || 1);
    person.school ||= {};
    if ((school.bullyingIncidents[person.id] || 0) >= 2) person.school.bullyingPattern = true;
    markMajorSchoolEvent(state, `${firstName(person)} crossed a line with repeated teasing or exclusion.`);
  }
  if (type === "activity_offer") {
    const activity = school.availableActivity;
    if (activity && ["join", "assistance", "ask_home"].includes(choice?.id)) {
      const assisted = choice.id === "assistance";
      if (!school.activities.some((item) => item.id === activity.id)) school.activities.push({ ...activity, assisted, joinedAtMonths: state.character.ageMonths });
      recordYearChange(state, "activitiesJoined", activity.label);
    }
    school.availableActivity = null;
  }
  if (type === "field_trip" && ["go", "assistance", "ask"].includes(choice?.id)) markMajorSchoolEvent(state, "A class field trip became part of the school year.");
  if (type === "teacher_support" && person) markMajorSchoolEvent(state, `${person.name} gave you extra help when schoolwork was difficult.`);
  if (type === "social_exclusion") markMajorSchoolEvent(state, "You had to work out where you fit when a friend-group plan happened without you.");
  if (type === "crush_signal" && choice?.id === "ask" && state.childhood.crush) state.childhood.crush.reciprocity = "mutual";
}

export function commitChildhoodEvent(state, event, choice) {
  ensureChildhoodState(state);
  const key = event.childhoodQueueKey;
  if (key && !state.childhood.seen.includes(key)) state.childhood.seen.push(key);
  state.childhood.seen = state.childhood.seen.slice(-140);
  state.childhood.eventQueue = state.childhood.eventQueue.filter((item) => item.key !== key);
  state.childhood.lastSocialEventAtMonths = state.character.ageMonths;
  commitSpecialConsequences(state, event, choice);
  addChoiceMemory(state, event, choice);

  if (event.childhoodType === "crush_fade" && state.childhood.crush) {
    state.childhood.pastCrushes.push({ ...state.childhood.crush, endedAtMonths: state.character.ageMonths, endingChoice: choice?.id || null });
    state.childhood.pastCrushes = state.childhood.pastCrushes.slice(-8);
    state.childhood.crush = null;
  }
  updateFriendshipLabels(state);
}

export function socialSnapshot(state) {
  ensureChildhoodState(state);
  if ((state.character.ageMonths || 0) >= 60) {
    ensureSchoolYear(state);
    updateFriendshipLabels(state);
  }
  const friends = visibleFriends(state).sort((a, b) => (b.closeness || 0) - (a.closeness || 0));
  const closest = friends[0] || null;
  const bestId = friends.find((person) => person.school?.displayTier === "Best friend")?.id || null;
  const crush = state.childhood.crush?.status === "active" || state.childhood.crush?.status === "fading" ? personById(state, state.childhood.crush.personId) : null;
  return {
    stage: childhoodStage(state),
    stageLabel: stageLabel(childhoodStage(state)),
    friends,
    friendTiers: friends.map((person) => ({ person, tier: friendshipTier(person, person.id === bestId) })),
    closest,
    crush,
    crushIntensity: state.childhood.crush?.intensity ?? null,
    crushReciprocity: state.childhood.crush?.reciprocity || null,
    socialConfidence: state.childhood.socialConfidence,
    classmates: currentClassmates(state),
    school: schoolWorldSnapshot(state),
  };
}

export function schoolWorldSnapshot(state) {
  ensureChildhoodState(state);
  const school = state.childhood.school;
  if ((state.character.ageMonths || 0) < 60) return null;
  ensureSchoolYear(state);
  updateFriendshipLabels(state);
  const teacher = personById(state, school.currentTeacherId);
  const friends = visibleFriends(state).sort((a, b) => (b.closeness || 0) - (a.closeness || 0));
  const classmates = currentClassmates(state);
  const rivals = classmates.filter((person) => person.school?.rival || (person.conflict || 0) >= 55);
  const recaps = [...(school.recaps || [])].reverse();
  return {
    grade: school.grade || schoolYearLabel(school.yearIndex),
    term: schoolTerm(state),
    teacher,
    teacherSupport: school.teacherSupport,
    attendance: school.attendance,
    effort: school.effort,
    performance: { ...school.performance },
    overallPerformance: school.overallPerformance,
    classmates,
    friends,
    friendTiers: friends.map((person, index) => ({ person, tier: friendshipTier(person, index === 0 && (person.closeness || 0) >= 74 && (person.trust || 0) >= 64) })),
    rivals,
    activities: [...school.activities],
    recentRecap: recaps[0] || null,
    classSizeKnown: classmates.length,
  };
}
