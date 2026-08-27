const clamp = (value, min = 0, max = 100) => Math.max(min, Math.min(max, value));

const FRIEND_NAMES = [
  "Maya", "Liam", "Zoe", "Nina", "Eli", "Sam", "Noah", "Aya", "Inez", "Joaquin",
  "Bea", "Luis", "Mika", "Gab", "Tala", "Enzo", "Rafi", "Celine", "Milo", "Luna",
];
const LAST_NAMES = ["Reyes", "Santos", "Garcia", "Navarro", "Cruz", "Mendoza", "Flores", "Ramos", "Lim", "Tan", "Villanueva"];

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
    school: { started: (state.character.ageMonths || 0) >= 60, friendIntroductions: 0, groupSeen: false },
    lastFriendAddedAtMonths: -120,
    lastSocialEventAtMonths: -120,
  };
  state.childhood.eventQueue ||= [];
  state.childhood.seen ||= [];
  state.childhood.pastCrushes ||= [];
  state.childhood.yearRecaps ||= [];
  state.childhood.school ||= { started: (state.character.ageMonths || 0) >= 60, friendIntroductions: 0, groupSeen: false };
  return state;
}

function visibleFriends(state) {
  const age = state.character.ageMonths || 0;
  return (state.people || []).filter((person) => person.role === "friend" && !person.deceased && (person.introducedAtMonths || 0) <= age);
}

function personById(state, id) {
  return (state.people || []).find((person) => person.id === id) || null;
}

function firstName(person) {
  return person?.name?.split(" ")[0] || "someone";
}

function relationshipEffect(person, key, delta, note = "") {
  return person ? { type: "relationship", targetId: person.id, key, delta, note } : null;
}

function compact(...items) {
  return items.filter(Boolean);
}

function queueEvent(state, item) {
  const childhood = ensureChildhoodState(state).childhood;
  if (!item?.key) return;
  if (childhood.seen.includes(item.key) || childhood.eventQueue.some((event) => event.key === item.key)) return;
  childhood.eventQueue.push({ priority: 40, createdAtMonths: state.character.ageMonths, ...item });
  childhood.eventQueue = childhood.eventQueue.sort((a, b) => (b.priority || 0) - (a.priority || 0) || (a.createdAtMonths || 0) - (b.createdAtMonths || 0)).slice(0, 8);
}

function uniqueFriendName(state) {
  const existing = new Set((state.people || []).map((person) => String(person.name || "").toLowerCase()));
  for (let tries = 0; tries < 30; tries += 1) {
    const name = `${pick(state, FRIEND_NAMES)} ${pick(state, LAST_NAMES)}`;
    if (!existing.has(name.toLowerCase())) return name;
  }
  return `Alex ${pick(state, LAST_NAMES)}`;
}

function makeFriend(state) {
  const name = uniqueFriendName(state);
  const first = name.split(" ")[0];
  const id = `friend-${first.toLowerCase()}-${state.character.ageMonths}-${Math.floor(nextRandom(state) * 9999)}`;
  const sex = nextRandom(state) < 0.5 ? "Female" : "Male";
  return {
    id,
    role: "friend",
    relationshipLabel: "Friend",
    name,
    sex,
    age: between(state, -1, 1),
    introducedAtMonths: state.character.ageMonths,
    closeness: between(state, 46, 62),
    trust: between(state, 45, 60),
    affection: between(state, 52, 68),
    conflict: between(state, 4, 14),
    familiarity: between(state, 38, 56),
    lastInteractionAtMonths: state.character.ageMonths,
    history: [{ ageMonths: state.character.ageMonths, date: { ...state.date }, eventId: "friend_introduction", note: `You met ${first} through school and started spending time together.` }],
    family: { branch: "outside", generation: "peer", kinship: "none", caregiver: false, household: false },
    npc: {
      outsideStress: between(state, 18, 38),
      availability: between(state, 58, 84),
      socialWorld: between(state, 38, 65),
      currentThread: `${first} is becoming part of your school-day routine.`,
      lastChangedAtMonths: state.character.ageMonths,
    },
  };
}

function addFriend(state, reason = "school") {
  const friend = makeFriend(state);
  state.people ||= [];
  state.people.push(friend);
  state.childhood.lastFriendAddedAtMonths = state.character.ageMonths;
  state.childhood.school.friendIntroductions = (state.childhood.school.friendIntroductions || 0) + 1;
  queueEvent(state, {
    key: `new-friend:${friend.id}`,
    type: "new_friend",
    personId: friend.id,
    priority: 48,
    data: { reason },
  });
  return friend;
}

function desiredFriendCount(state) {
  const months = state.character.ageMonths || 0;
  if (months < 60) return 0;
  if (months < 84) return 2;
  if (months < 120) return 3;
  return 4;
}

function ensureSchoolFriends(state, elapsedMonths) {
  const months = state.character.ageMonths || 0;
  if (months < 60) return;
  state.childhood.school.started = true;
  let friends = visibleFriends(state);

  // The original build supplied one school friend. Add a second peer quickly so a child's
  // social world is never modeled as a single designated human.
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

function driftFriendships(state, elapsedMonths) {
  const friends = visibleFriends(state);
  for (const friend of friends) {
    const monthsSince = state.character.ageMonths - (friend.lastInteractionAtMonths ?? friend.introducedAtMonths ?? 0);
    const socialPull = (friend.npc?.socialWorld ?? 50) > 68 ? -1 : 0;
    const drift = Math.round((nextRandom(state) - 0.52) * 3) + socialPull;
    if (Math.abs(drift) > 0) friend.closeness = clamp((friend.closeness ?? 50) + drift);
    if (monthsSince >= 12) friend.closeness = clamp((friend.closeness ?? 50) - 1);

    if (friend.closeness < 38 && monthsSince >= 9 && nextRandom(state) < 0.06 * Math.max(1, elapsedMonths)) {
      queueEvent(state, { key: `drift:${friend.id}:${Math.floor(state.character.ageMonths / 12)}`, type: "friend_drift", personId: friend.id, priority: 42 });
    }
    if ((friend.conflict ?? 0) > 32 && nextRandom(state) < 0.04 * Math.max(1, elapsedMonths)) {
      queueEvent(state, { key: `conflict:${friend.id}:${Math.floor(state.character.ageMonths / 12)}`, type: "friend_conflict", personId: friend.id, priority: 46 });
    }
  }

  if (friends.length >= 2 && state.character.ageMonths >= 84 && !state.childhood.school.groupSeen) {
    if (nextRandom(state) < 0.12 * Math.max(1, elapsedMonths)) {
      state.childhood.school.groupSeen = true;
      queueEvent(state, { key: "first-friend-group", type: "friend_group", personIds: friends.slice(0, 3).map((person) => person.id), priority: 43 });
    }
  }
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
      childhood.crush = {
        personId: person.id,
        startedAtMonths: age,
        intensity: between(state, 48, 68),
        status: "active",
        followupShown: false,
      };
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

function addYearRecap(state, beforeAgeMonths) {
  const oldAge = Math.floor((beforeAgeMonths || 0) / 12);
  const age = Math.floor((state.character.ageMonths || 0) / 12);
  if (age <= oldAge || age <= 0) return;
  const friends = visibleFriends(state).sort((a, b) => (b.closeness || 0) - (a.closeness || 0));
  const crushPerson = state.childhood.crush?.status === "active" ? personById(state, state.childhood.crush.personId) : null;
  const parts = [];
  if (friends.length) parts.push(`${friends.length} school friend${friends.length === 1 ? "" : "s"} are part of your world${friends[0] ? `, with ${firstName(friends[0])} among the closest` : ""}`);
  if (crushPerson) parts.push(`you have a quiet crush on ${firstName(crushPerson)}`);
  const stage = stageLabel(childhoodStage(state)).toLowerCase();
  const text = `At ${age}, ${parts.length ? parts.join("; ") : `your ${stage} is still centered mostly on family and routine`}.`;
  state.childhood.yearRecaps.push({ age, ageMonths: state.character.ageMonths, text });
  state.childhood.yearRecaps = state.childhood.yearRecaps.slice(-8);
  state.worldEvents ||= [];
  state.worldEvents.push({ category: "Self", text, note: text, importance: 1, ageMonths: state.character.ageMonths, date: { ...state.date }, source: "childhood-v2" });
  state.worldEvents = state.worldEvents.slice(-80);
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

  ensureSchoolFriends(state, elapsedMonths);
  if ((state.character.ageMonths || 0) >= 60) {
    driftFriendships(state, elapsedMonths);
    maybeQueueFirstDayEcho(state);
    updateCrush(state, elapsedMonths);
  }
  addYearRecap(state, beforeAgeMonths ?? Math.max(0, state.character.ageMonths - elapsedMonths));
  return state;
}

function stageTransitionEvent(state, item) {
  const next = item.data?.nextStage;
  const caregiver = (state.people || []).find((person) => person.family?.caregiver && !person.deceased) || (state.people || []).find((person) => ["guardian", "secondGuardian"].includes(person.role) && !person.deceased);
  if (next === "early-school") {
    return {
      id: "childhood_stage_early_school", category: "School", title: "Your world gets bigger",
      body: "School is becoming a world of its own. There are adults who are not family, children with different homes and personalities, rules that belong to classrooms, and friendships that can exist without your caregivers arranging them.",
      prompt: "What matters most at first?",
      choices: [
        { id: "people", label: "Finding people you like", result: "You start noticing who makes ordinary school days easier and more interesting.", effects: [{ type: "personality", key: "social", delta: 2 }, { type: "childhood", key: "socialConfidence", delta: 3 }] },
        { id: "rules", label: "Understanding how school works", result: "Knowing the routine makes the unfamiliar parts feel easier to manage.", effects: [{ type: "personality", key: "structure", delta: 2 }, { type: "education", key: "language", delta: 1 }] },
        { id: "home", label: `Knowing ${firstName(caregiver)} is still there after`, result: "The new world feels easier to enter when you know exactly where you return afterward.", effects: compact(relationshipEffect(caregiver, "trust", 2, "Starting school made familiar care at home feel especially important."), { type: "development", key: "attachment", delta: 1 }) },
      ],
    };
  }
  if (next === "middle-childhood") {
    return {
      id: "childhood_stage_middle", category: "Self", title: "People are becoming more complicated",
      body: "Friendships now have histories. People can be close to you and annoy you in the same week. You are also getting better at noticing where you fit, where you do not, and what other people may think of you.",
      prompt: "What do you pay the most attention to?",
      choices: [
        { id: "friends", label: "Your friendships", result: "You become more attentive to the small things that make one friendship different from another.", effects: [{ type: "childhood", key: "socialConfidence", delta: 2 }, { type: "pattern", key: "connecting", delta: 1 }] },
        { id: "skills", label: "What you are good at", result: "Competence begins becoming one of the ways you understand yourself.", effects: [{ type: "development", key: "confidence", delta: 2 }] },
        { id: "private", label: "Your own private world", result: "You keep more thoughts to yourself now. Not everything has to become family knowledge immediately.", effects: [{ type: "personality", key: "independence", delta: 2 }] },
      ],
    };
  }
  if (next === "preteen") {
    return {
      id: "childhood_stage_preteen", category: "Self", title: "You notice yourself being noticed",
      body: "You are old enough now that classmates, friendships, embarrassment, admiration, and belonging can occupy a surprising amount of mental space. Some feelings are still simple. Others are beginning to have layers.",
      prompt: "What do you tend to do with that awareness?",
      choices: [
        { id: "connect", label: "Lean into your friendships", result: "Friends become a more important place to test ideas, jokes, worries, and versions of yourself.", effects: [{ type: "personality", key: "social", delta: 2 }, { type: "pattern", key: "connecting", delta: 2 }] },
        { id: "observe", label: "Observe people carefully", result: "You pay attention before deciding how much of yourself to show.", effects: [{ type: "personality", key: "sensitivity", delta: 1 }, { type: "personality", key: "curiosity", delta: 1 }] },
        { id: "own", label: "Focus on your own interests", result: "The social world matters, but it does not get every piece of your attention.", effects: [{ type: "personality", key: "independence", delta: 2 }] },
      ],
    };
  }
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

function newFriendEvent(state, item) {
  const person = personById(state, item.personId);
  const name = firstName(person);
  return {
    id: `childhood_new_friend_${person?.id || "peer"}`, category: "Friends", title: `${name} keeps ending up near you`,
    body: `You and ${name} have been talking and playing together more often at school. It is not a grand declaration of friendship. It is mostly repetition: sitting nearby, finding each other at breaks, remembering what the other person likes.`,
    prompt: "What do you do as the friendship starts?",
    choices: [
      { id: "seek", label: `Look for ${name} at break`, result: `You start choosing each other on purpose instead of only ending up together by accident.`, effects: compact(relationshipEffect(person, "closeness", 6, `You started seeking ${name} out during breaks.`), relationshipEffect(person, "trust", 3), { type: "childhood", key: "socialConfidence", delta: 2 }) },
      { id: "easy", label: "Let it develop naturally", result: "The friendship grows through ordinary days without either of you having to define it.", effects: compact(relationshipEffect(person, "familiarity", 5, `Your friendship with ${name} grew slowly through ordinary school days.`), relationshipEffect(person, "closeness", 2)) },
      { id: "group", label: "Include other kids too", result: "You make room for a wider circle instead of turning one new friendship into the whole social universe.", effects: compact(relationshipEffect(person, "trust", 2), { type: "personality", key: "social", delta: 2 }, { type: "childhood", key: "socialConfidence", delta: 2 }) },
    ],
  };
}

function friendGroupEvent(state, item) {
  const people = (item.personIds || []).map((id) => personById(state, id)).filter(Boolean);
  const names = people.map(firstName);
  return {
    id: "childhood_friend_group", category: "Friends", title: "Your friendships start overlapping",
    body: `${names.slice(0, 3).join(", ")} do not belong to separate little boxes anymore. Sometimes you are all together. Sometimes two people are closer on a particular day. The group has its own rhythm, jokes, and tiny frictions.`,
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
    body: `Nothing dramatic happened. You simply stopped finding each other as often, and the friendship has begun to feel less automatic than it used to.`,
    prompt: "What do you do?",
    choices: [
      { id: "reach", label: `Ask ${name} to hang out`, result: "The first few minutes feel slightly unfamiliar, then older habits begin returning.", effects: compact(relationshipEffect(person, "closeness", 6, `You noticed the distance and reached out to ${name}.`), relationshipEffect(person, "trust", 2)) },
      { id: "accept", label: "Let the friendship change", result: "You do not turn the distance into a fight. Some friendships become smaller without becoming meaningless.", effects: [{ type: "development", key: "emotionalRegulation", delta: 2 }, { type: "personality", key: "independence", delta: 1 }] },
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

function crushFadeEvent(state, item) {
  const person = personById(state, item.personId);
  const name = firstName(person);
  return {
    id: `childhood_crush_fade_${person?.id || "peer"}`, category: "Self", title: `The feeling about ${name} is changing`,
    body: `At some point you realize you are not checking the room for ${name} the way you used to. The crush did not end in a dramatic scene. It simply became less important while other parts of your life kept growing.`,
    prompt: "How do you think about it now?",
    choices: [
      { id: "fond", label: "Remember it fondly", result: "You keep the feeling as one of those small private chapters that mattered mostly because it was yours.", effects: [{ type: "development", key: "emotionalRegulation", delta: 1 }] },
      { id: "friend", label: `Just see ${name} as a friend`, result: `The friendship becomes easier to see without the extra layer of nervous attention.`, effects: compact(relationshipEffect(person, "trust", 2, `Your crush on ${name} faded, and the friendship remained.`), { type: "childhood", key: "crushIntensity", delta: -20 }) },
      { id: "shrug", label: "Barely think about it", result: "The feeling becomes old information surprisingly quickly.", effects: [{ type: "personality", key: "independence", delta: 1 }] },
    ],
  };
}

function buildEvent(state, item) {
  if (!item) return null;
  if (item.type === "stage_transition") return stageTransitionEvent(state, item);
  if (item.type === "new_friend") return newFriendEvent(state, item);
  if (item.type === "friend_group") return friendGroupEvent(state, item);
  if (item.type === "friend_drift") return friendDriftEvent(state, item);
  if (item.type === "friend_conflict") return friendConflictEvent(state, item);
  if (item.type === "first_day_echo") return firstDayEchoEvent(state, item);
  if (item.type === "crush_begin") return crushBeginEvent(state, item);
  if (item.type === "crush_followup") return crushFollowupEvent(state, item);
  if (item.type === "crush_fade") return crushFadeEvent(state, item);
  return null;
}

export function childhoodEventForState(state) {
  ensureChildhoodState(state);
  const item = state.childhood.eventQueue[0];
  const event = buildEvent(state, item);
  if (!event) return null;
  return { ...event, contextKind: "childhood-v2", childhoodQueueKey: item.key, childhoodType: item.type };
}

export function applyChildhoodEffect(state, effect) {
  ensureChildhoodState(state);
  if (effect.key === "socialConfidence") state.childhood.socialConfidence = clamp((state.childhood.socialConfidence ?? 50) + (effect.delta || 0));
  if (effect.key === "crushIntensity" && state.childhood.crush) state.childhood.crush.intensity = clamp((state.childhood.crush.intensity ?? 50) + (effect.delta || 0));
}

export function commitChildhoodEvent(state, event, choice) {
  ensureChildhoodState(state);
  const key = event.childhoodQueueKey;
  if (key && !state.childhood.seen.includes(key)) state.childhood.seen.push(key);
  state.childhood.seen = state.childhood.seen.slice(-80);
  state.childhood.eventQueue = state.childhood.eventQueue.filter((item) => item.key !== key);
  state.childhood.lastSocialEventAtMonths = state.character.ageMonths;

  if (event.childhoodType === "crush_fade" && state.childhood.crush) {
    state.childhood.pastCrushes.push({ ...state.childhood.crush, endedAtMonths: state.character.ageMonths, endingChoice: choice?.id || null });
    state.childhood.pastCrushes = state.childhood.pastCrushes.slice(-6);
    state.childhood.crush = null;
  }
}

export function socialSnapshot(state) {
  ensureChildhoodState(state);
  const friends = visibleFriends(state).sort((a, b) => (b.closeness || 0) - (a.closeness || 0));
  const crush = state.childhood.crush?.status === "active" || state.childhood.crush?.status === "fading" ? personById(state, state.childhood.crush.personId) : null;
  return {
    stage: childhoodStage(state),
    stageLabel: stageLabel(childhoodStage(state)),
    friends,
    closest: friends[0] || null,
    crush,
    crushIntensity: state.childhood.crush?.intensity ?? null,
    socialConfidence: state.childhood.socialConfidence,
  };
}
