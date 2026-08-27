const VERSION = 1;
const clamp = (value, min = 0, max = 100) => Math.max(min, Math.min(max, value));
const age = (state) => state.character?.ageMonths || 0;
const first = (person) => String(person?.name || "Someone").trim().split(/\s+/)[0] || "Someone";

const TRAITS = [
  ["quiet", "Quiet", "They tend to listen for a while before joining in."],
  ["outgoing", "Outgoing", "They usually find it easy to enter a conversation."],
  ["playful", "Playful", "They often turn ordinary moments into jokes or games."],
  ["serious", "Serious", "They tend to take promises and responsibilities seriously."],
  ["patient", "Patient", "They usually give people time before getting frustrated."],
  ["quick", "Quick-reacting", "Their feelings often show before they have time to edit them."],
  ["private", "Private", "They do not tell everyone what they are thinking."],
  ["open", "Open", "They are fairly willing to say what is on their mind."],
  ["loyal", "Loyal", "They tend to keep showing up for people once they feel close."],
  ["independent", "Independent", "They like having their own space, plans, and interests."],
  ["gentle", "Gentle", "They usually respond softly when someone is upset."],
  ["competitive", "Competitive", "Games and comparisons can matter more to them than they admit."],
];

const INTERESTS = [
  ["drawing", "drawing"], ["reading", "reading"], ["music", "music"], ["games", "games"],
  ["sports", "sports"], ["animals", "animals"], ["cooking", "cooking"], ["nature", "being outdoors"],
  ["making", "making things"], ["stories", "stories and films"], ["gardening", "plants and gardening"],
];

const SENSITIVITIES = [
  ["rush", "They dislike being rushed when they are already trying."],
  ["embarrassed", "They tend to get quieter when they feel embarrassed."],
  ["losing", "Losing can bother them more than they like to show."],
  ["change", "Sudden changes take them a little while to settle into."],
  ["alone", "They sometimes need time alone before they can talk clearly."],
  ["disappoint", "They worry about disappointing people they care about."],
  ["teasing", "Teasing stops being funny to them when it feels too personal."],
  ["conflict", "They do not enjoy leaving an argument unresolved."],
];

function hash(text) {
  let value = 2166136261;
  for (const char of String(text || "")) {
    value ^= char.charCodeAt(0);
    value = Math.imul(value, 16777619) >>> 0;
  }
  return value >>> 0;
}

function mixed(state, salt = 0, personId = "") {
  let value = ((Number(state.seed) || 1) ^ hash(personId) ^ Math.imul((age(state) + 1 + salt) >>> 0, 0x9e3779b1)) >>> 0;
  value = Math.imul(value ^ (value >>> 16), 0x7feb352d) >>> 0;
  value = Math.imul(value ^ (value >>> 15), 0x846ca68b) >>> 0;
  return (value ^ (value >>> 16)) >>> 0;
}

function identityFor(state, person) {
  person.npc ||= {};
  if (person.npc.identity?.version === VERSION) return person.npc.identity;
  const base = mixed(state, 19, person.id);
  const traitA = TRAITS[base % TRAITS.length];
  let traitB = TRAITS[(base >>> 5) % TRAITS.length];
  if (traitB[0] === traitA[0]) traitB = TRAITS[(TRAITS.indexOf(traitA) + 5) % TRAITS.length];
  const interest = INTERESTS[(base >>> 9) % INTERESTS.length];
  const sensitivity = SENSITIVITIES[(base >>> 13) % SENSITIVITIES.length];
  person.npc.identity = {
    version: VERSION,
    traits: [traitA[0], traitB[0]],
    interest: interest[0],
    sensitivity: sensitivity[0],
    knownFactIds: [],
    discoveries: [],
  };
  return person.npc.identity;
}

function allFacts(state, person) {
  const identity = identityFor(state, person);
  const traits = identity.traits.map((id) => TRAITS.find((row) => row[0] === id)).filter(Boolean);
  const interest = INTERESTS.find((row) => row[0] === identity.interest);
  const sensitivity = SENSITIVITIES.find((row) => row[0] === identity.sensitivity);
  return [
    ...traits.map((row) => ({ id: `trait:${row[0]}`, label: row[1], copy: row[2], kind: "trait" })),
    interest ? { id: `interest:${interest[0]}`, label: "Interest", copy: `${first(person)} seems to genuinely enjoy ${interest[1]}.`, kind: "interest" } : null,
    sensitivity ? { id: `sensitivity:${sensitivity[0]}`, label: "Something you've noticed", copy: sensitivity[1], kind: "sensitivity" } : null,
  ].filter(Boolean);
}

function discoverFact(state, person, factId, source = "time") {
  if (!person || !factId) return null;
  const identity = identityFor(state, person);
  if (identity.knownFactIds.includes(factId)) return allFacts(state, person).find((fact) => fact.id === factId) || null;
  const fact = allFacts(state, person).find((item) => item.id === factId);
  if (!fact) return null;
  identity.knownFactIds.push(factId);
  identity.knownFactIds = identity.knownFactIds.slice(-8);
  identity.discoveries.push({ factId, ageMonths: age(state), source });
  identity.discoveries = identity.discoveries.slice(-12);
  return fact;
}

function autoDiscover(state, person) {
  if (!person || person.deceased || (person.introducedAtMonths || 0) > age(state)) return;
  const knownMonths = Math.max(0, age(state) - (person.introducedAtMonths || 0));
  const facts = allFacts(state, person);
  const identity = identityFor(state, person);
  const baseline = person.role === "guardian" || person.family?.caregiver ? 12 : 24;
  const target = Math.min(2, Math.max(0, Math.floor((knownMonths + baseline) / 42)));
  for (let index = 0; index < target; index += 1) {
    const fact = facts[(mixed(state, 71 + index, person.id) + index) % facts.length];
    if (fact && !identity.knownFactIds.includes(fact.id)) discoverFact(state, person, fact.id, "ordinary time together");
  }
}

function root(state) {
  state.childhoodDepth ||= {
    version: VERSION,
    sceneCount: 0,
    littleMomentCount: 0,
    majorMomentCount: 0,
    pendingAdvance: null,
    activeLittleMoment: null,
    requestedInteraction: null,
    recentLittleMomentIds: [],
    interactionBudget: { ageMonths: null, used: 0 },
    interactionCooldowns: {},
  };
  const depth = state.childhoodDepth;
  depth.version = VERSION;
  depth.recentLittleMomentIds ||= [];
  depth.interactionCooldowns ||= {};
  depth.interactionBudget ||= { ageMonths: null, used: 0 };
  return depth;
}

export function ensureChildhoodDepth(state) {
  if (!state?.character) return state;
  const depth = root(state);
  if (depth.interactionBudget.ageMonths !== age(state)) depth.interactionBudget = { ageMonths: age(state), used: 0 };
  for (const person of state.people || []) {
    identityFor(state, person);
    autoDiscover(state, person);
  }
  return state;
}

export function npcKnowledgeSnapshot(state, personId) {
  ensureChildhoodDepth(state);
  const person = (state.people || []).find((item) => item.id === personId);
  if (!person) return null;
  const identity = identityFor(state, person);
  const facts = allFacts(state, person);
  return {
    personId,
    known: identity.knownFactIds.map((id) => facts.find((fact) => fact.id === id)).filter(Boolean),
    unknownCount: Math.max(0, facts.length - identity.knownFactIds.length),
  };
}

function relationshipEffect(person, key, delta, note = null) {
  return { type: "relationship", targetId: person.id, key, delta, note };
}

function visiblePeople(state, roles = null) {
  const now = age(state);
  return (state.people || []).filter((person) => !person.deceased && (person.introducedAtMonths || 0) <= now && (!roles || roles.includes(person.role)));
}

function choosePerson(state, roles, salt) {
  const people = visiblePeople(state, roles);
  if (!people.length) return null;
  return people[mixed(state, salt) % people.length];
}

const LITTLE_MOMENTS = [
  { id: "infant_quiet_hold", min: 0, max: 11, roles: ["guardian", "secondGuardian", "mother", "father"], category: "Family", title: (p) => `A quiet minute with ${first(p)}`, body: (p) => `${first(p)} holds you without trying to entertain you. The room is ordinary and familiar.`, prompt: "What do you do?", choices: (p) => [
    { id: "settle", label: "Settle against them", result: "Nothing dramatic happens. You simply stay close for a while.", effects: [relationshipEffect(p, "closeness", 1), { type: "development", key: "attachment", delta: 1 }] },
    { id: "watch", label: "Watch their face", result: "You study small movements and expressions until something else catches your attention.", effects: [relationshipEffect(p, "familiarity", 1), { type: "personality", key: "curiosity", delta: 1 }] },
    { id: "squirm", label: "Want to move again", result: "The quiet minute ends because you have other extremely urgent infant business.", effects: [{ type: "development", key: "autonomy", delta: 1 }] },
  ]},
  { id: "toddler_snack_table", min: 12, max: 35, roles: ["guardian", "secondGuardian", "sibling", "grandmother", "grandfather"], category: "Home", title: () => "A snack at the table", body: (p) => `${first(p)} is nearby while you work through a very ordinary snack. Nobody is in a hurry.`, prompt: "What fills the moment?", choices: (p) => [
    { id: "copy", label: `Copy what ${first(p)} is doing`, result: "You imitate a small gesture or habit with complete seriousness.", effects: [relationshipEffect(p, "familiarity", 1)] },
    { id: "talk", label: "Use whatever words you have", result: "The conversation is limited by vocabulary but not enthusiasm.", effects: [relationshipEffect(p, "closeness", 1), { type: "education", key: "language", delta: 1 }] },
    { id: "focus", label: "Concentrate on your snack", result: "For once, food receives your undivided attention.", effects: [{ type: "development", key: "autonomy", delta: 1 }] },
  ]},
  { id: "toddler_walk_beside", min: 18, max: 47, roles: ["guardian", "secondGuardian", "sibling", "grandmother", "grandfather"], category: "Home", title: (p) => `Walking beside ${first(p)}`, body: (p) => `You and ${first(p)} are going somewhere close enough that the trip itself becomes part of the outing.`, prompt: "What do you do along the way?", choices: (p) => [
    { id: "hold", label: "Stay close", result: "You match their pace and keep them within easy reach.", effects: [relationshipEffect(p, "closeness", 1), { type: "development", key: "attachment", delta: 1 }] },
    { id: "notice", label: "Point out everything interesting", result: "The walk takes longer because the world contains an unreasonable number of things worth noticing.", effects: [{ type: "personality", key: "curiosity", delta: 1 }] },
    { id: "ahead", label: "Try to walk ahead", result: "You test how far your independence can travel while someone is still keeping track of you.", effects: [{ type: "development", key: "autonomy", delta: 1 }] },
  ]},
  { id: "preschool_helping", min: 36, max: 59, roles: ["guardian", "secondGuardian", "sibling", "grandmother", "grandfather"], category: "Home", title: (p) => `Helping ${first(p)} with something small`, body: (p) => `${first(p)} is doing an ordinary task and gives you one small part that is actually useful.`, prompt: "How do you help?", choices: (p) => [
    { id: "careful", label: "Try to do it properly", result: "It takes longer with you involved, but you finish your part.", effects: [relationshipEffect(p, "closeness", 1), { type: "development", key: "persistence", delta: 1 }] },
    { id: "questions", label: "Ask a lot of questions", result: "The task comes with a running commentary of why, how, and what happens next.", effects: [{ type: "personality", key: "curiosity", delta: 1 }] },
    { id: "own_way", label: "Invent your own method", result: "Your method is not the official method. This appears not to trouble you.", effects: [{ type: "development", key: "autonomy", delta: 1 }] },
  ]},
  { id: "preschool_make_believe", min: 36, max: 59, roles: ["sibling", "friend", "guardian", "secondGuardian"], category: "Interests", title: (p) => `A made-up game with ${first(p)}`, body: (p) => `A few ordinary objects have acquired new identities. You and ${first(p)} are now responsible for the rules.`, prompt: "What kind of game is it?", choices: (p) => [
    { id: "story", label: "Make up a whole story", result: "The story changes whenever reality becomes inconvenient.", effects: [relationshipEffect(p, "closeness", 1), { type: "interest", key: "making", delta: 1 }] },
    { id: "rules", label: "Decide the rules first", result: "Everyone knows what is supposed to happen, at least until somebody changes it.", effects: [{ type: "personality", key: "structure", delta: 1 }] },
    { id: "follow", label: `Follow ${first(p)}'s idea`, result: "You let their imagination lead for a while and add your own pieces as you go.", effects: [relationshipEffect(p, "trust", 1)] },
  ]},
  { id: "school_after_snack", min: 60, max: 107, roles: ["guardian", "secondGuardian", "sibling", "grandmother", "grandfather"], category: "Home", title: () => "After-school snack", body: (p) => `School is over. ${first(p)} is nearby while the day starts turning back into home.`, prompt: "What happens in the ordinary part after school?", choices: (p) => [
    { id: "tell", label: "Tell them one thing that happened", result: "It is not the biggest event of your life. It is simply part of letting someone know your day.", effects: [relationshipEffect(p, "trust", 1), { type: "pattern", key: "connecting", delta: 1 }] },
    { id: "quiet", label: "Eat quietly together", result: "Company does not require a full report. You share the room and let the school day settle.", effects: [relationshipEffect(p, "closeness", 1), { type: "health", key: "stress", delta: -1 }] },
    { id: "escape", label: "Finish quickly and go do your own thing", result: "You reclaim a little piece of the day for yourself.", effects: [{ type: "development", key: "autonomy", delta: 1 }] },
  ]},
  { id: "school_lunch_table", min: 60, max: 155, roles: ["friend"], category: "Friends", title: (p) => `Lunch with ${first(p)}`, body: (p) => `You and ${first(p)} end up eating together. There is no crisis to solve and no friendship milestone scheduled.`, prompt: "What fills the lunch break?", choices: (p) => [
    { id: "joke", label: "Talk about something silly", result: "Most of the conversation would sound pointless to anyone else. That is part of why it is yours.", effects: [relationshipEffect(p, "closeness", 1)] },
    { id: "listen", label: `Ask what ${first(p)} has been doing lately`, result: "You hear about a part of their life that did not involve you.", effects: [relationshipEffect(p, "trust", 1)] },
    { id: "quiet", label: "Mostly just sit together", result: "The friendship is comfortable enough that neither of you has to fill every silence.", effects: [relationshipEffect(p, "familiarity", 1)] },
  ]},
  { id: "school_homework_nearby", min: 72, max: 155, roles: ["guardian", "secondGuardian", "sibling", "friend", "grandmother", "grandfather"], category: "School", title: (p) => `Homework near ${first(p)}`, body: (p) => `You work on something from school while ${first(p)} is doing their own thing nearby.`, prompt: "What do you do when you get stuck?", choices: (p) => [
    { id: "ask", label: `Ask ${first(p)} for a little help`, result: "They help with what they can, or at least help you think through the problem.", effects: [relationshipEffect(p, "trust", 1), { type: "development", key: "persistence", delta: 1 }] },
    { id: "try", label: "Keep working on it yourself", result: "You stay with the problem a little longer before deciding whether you really need help.", effects: [{ type: "development", key: "persistence", delta: 1 }] },
    { id: "break", label: "Take a short break", result: "The problem is still there afterward, but your brain is less annoyed by it.", effects: [{ type: "health", key: "stress", delta: -1 }] },
  ]},
  { id: "older_quiet_evening", min: 96, max: 155, roles: ["guardian", "secondGuardian", "sibling", "grandmother", "grandfather"], category: "Home", title: (p) => `An ordinary evening with ${first(p)}`, body: (p) => `You and ${first(p)} are in the same room doing mostly separate things. The household has settled into one of its quieter stretches.`, prompt: "How do you spend it?", choices: (p) => [
    { id: "join", label: "Go sit nearer to them", result: "You drift into the same small space without needing a reason.", effects: [relationshipEffect(p, "closeness", 1)] },
    { id: "own", label: "Stay absorbed in your own thing", result: "Being close to someone does not require sharing every minute.", effects: [{ type: "development", key: "autonomy", delta: 1 }] },
    { id: "show", label: "Show them what you're doing", result: "You let them into a small part of your private world.", effects: [relationshipEffect(p, "trust", 1), { type: "development", key: "confidence", delta: 1 }] },
  ]},
  { id: "older_weekend_errand", min: 96, max: 155, roles: ["guardian", "secondGuardian", "grandmother", "grandfather"], category: "Home", title: (p) => `An errand with ${first(p)}`, body: (p) => `You go along with ${first(p)} for something thoroughly unremarkable: groceries, a small purchase, paperwork, or another adult task.`, prompt: "What do you make of the trip?", choices: (p) => [
    { id: "talk", label: "Talk on the way", result: "The errand becomes one of those places where conversation happens because neither of you planned a conversation.", effects: [relationshipEffect(p, "trust", 1)] },
    { id: "help", label: "Help keep track of something", result: "You take responsibility for one small piece of the task.", effects: [{ type: "development", key: "autonomy", delta: 1 }, { type: "personality", key: "structure", delta: 1 }] },
    { id: "observe", label: "Mostly watch how they do things", result: "Adult life contains an astonishing amount of waiting, checking, paying, and remembering.", effects: [{ type: "personality", key: "curiosity", delta: 1 }] },
  ]},
];

function eligibleLittleMoments(state) {
  const now = age(state);
  const recent = new Set(root(state).recentLittleMomentIds);
  const eligible = LITTLE_MOMENTS.filter((moment) => now >= moment.min && now <= moment.max && !recent.has(moment.id) && visiblePeople(state, moment.roles).length);
  return eligible.length ? eligible : LITTLE_MOMENTS.filter((moment) => now >= moment.min && now <= moment.max && visiblePeople(state, moment.roles).length);
}

function selectLittleMoment(state) {
  const depth = root(state);
  if (depth.activeLittleMoment) return depth.activeLittleMoment;
  const pool = eligibleLittleMoments(state);
  if (!pool.length) return null;
  const template = pool[mixed(state, 131 + depth.littleMomentCount) % pool.length];
  const person = choosePerson(state, template.roles, 151 + depth.littleMomentCount);
  if (!person) return null;
  depth.activeLittleMoment = { templateId: template.id, personId: person.id };
  return depth.activeLittleMoment;
}

function revealCandidate(state, person, salt) {
  const identity = identityFor(state, person);
  const unknown = allFacts(state, person).filter((fact) => !identity.knownFactIds.includes(fact.id));
  if (!unknown.length) return null;
  return unknown[mixed(state, salt, person.id) % unknown.length];
}

export function littleMomentEventForState(state) {
  ensureChildhoodDepth(state);
  const depth = root(state);
  if (!depth.pendingAdvance || depth.requestedInteraction) return null;
  const active = selectLittleMoment(state);
  if (!active) return null;
  const template = LITTLE_MOMENTS.find((item) => item.id === active.templateId);
  const person = (state.people || []).find((item) => item.id === active.personId);
  if (!template || !person) return null;
  const reveal = revealCandidate(state, person, 181 + depth.littleMomentCount);
  return {
    id: `little_moment_${template.id}_${Math.floor(age(state) / 2)}_${depth.littleMomentCount}`,
    category: template.category,
    title: template.title(person),
    body: template.body(person),
    prompt: template.prompt,
    choices: template.choices(person).map((choice, index) => ({ ...choice, depthRevealFactId: index === 1 && reveal ? reveal.id : null })),
    childhoodDepthKind: "little-moment",
    childhoodPersonId: person.id,
    depthTemplateId: template.id,
  };
}

function actionDefinitions(state, person) {
  const now = age(state);
  if (now < 12) {
    if (["guardian", "secondGuardian", "mother", "father"].includes(person.role)) return [
      { id: "seek", label: "Reach for them" }, { id: "play", label: "Play together" },
    ];
    return [];
  }
  if (now < 36) return [
    { id: "spend", label: "Spend time together" }, { id: "play", label: "Play together" },
  ];
  const byRole = {
    friend: [{ id: "spend", label: "Spend time together" }, { id: "talk", label: "Talk" }, ...(now >= 72 ? [{ id: "invite", label: "Make plans together" }] : [])],
    sibling: [{ id: "spend", label: "Hang out" }, { id: "talk", label: "Talk" }, { id: "help", label: "Help them with something" }],
    guardian: [{ id: "spend", label: "Spend time together" }, { id: "talk", label: "Talk about your day" }, { id: "ask_help", label: "Ask for help" }],
    secondGuardian: [{ id: "spend", label: "Spend time together" }, { id: "talk", label: "Talk about your day" }, { id: "ask_help", label: "Ask for help" }],
    mother: [{ id: "spend", label: "Spend time together" }, { id: "talk", label: "Talk about your day" }, { id: "ask_help", label: "Ask for help" }],
    father: [{ id: "spend", label: "Spend time together" }, { id: "talk", label: "Talk about your day" }, { id: "ask_help", label: "Ask for help" }],
    grandmother: [{ id: "spend", label: "Spend time together" }, { id: "talk", label: "Talk" }, { id: "help", label: "Help with something" }],
    grandfather: [{ id: "spend", label: "Spend time together" }, { id: "talk", label: "Talk" }, { id: "help", label: "Help with something" }],
  };
  return byRole[person.role] || [{ id: "spend", label: "Spend time together" }, { id: "talk", label: "Talk" }];
}

export function availableRelationshipActions(state, personId) {
  ensureChildhoodDepth(state);
  const depth = root(state);
  const person = (state.people || []).find((item) => item.id === personId && !item.deceased && (item.introducedAtMonths || 0) <= age(state));
  if (!person || state.resolution || depth.pendingAdvance || depth.requestedInteraction) return [];
  if (depth.interactionBudget.used >= 2) return [];
  const cooldownAt = depth.interactionCooldowns[person.id] ?? -999;
  if (age(state) - cooldownAt < 2) return [];
  return actionDefinitions(state, person).slice(0, 3);
}

export function queueRelationshipInteraction(state, personId, actionId) {
  ensureChildhoodDepth(state);
  const actions = availableRelationshipActions(state, personId);
  if (!actions.some((action) => action.id === actionId)) return false;
  root(state).requestedInteraction = { personId, actionId, requestedAtMonths: age(state) };
  return true;
}

function interactionChoices(state, person, actionId) {
  const reveal = revealCandidate(state, person, 241 + root(state).sceneCount);
  if (actionId === "talk") return [
    { id: "share_day", label: "Tell them something about your day", result: `You let ${first(person)} into one ordinary piece of what happened.`, effects: [relationshipEffect(person, "trust", 2), { type: "pattern", key: "connecting", delta: 1 }] },
    { id: "ask_them", label: "Ask about them instead", result: `${first(person)} tells you a little more about what has been occupying their attention lately.`, effects: [relationshipEffect(person, "familiarity", 2)], depthRevealFactId: reveal?.id || null },
    { id: "hard_thing", label: "Mention something that's been bothering you", result: `You say a little more than usual. ${first(person)} does not solve everything, but the problem is no longer completely private.`, effects: [relationshipEffect(person, "trust", 3), { type: "development", key: "emotionalRegulation", delta: 1 }] },
  ];
  if (actionId === "ask_help") return [
    { id: "school", label: "Ask for help with school", result: `${first(person)} helps with what they can and stays with the problem for a while.`, effects: [relationshipEffect(person, "trust", 2), { type: "development", key: "persistence", delta: 1 }] },
    { id: "decision", label: "Ask what they think about a decision", result: `You hear ${first(person)}'s opinion without having to follow it exactly.`, effects: [relationshipEffect(person, "trust", 2), { type: "development", key: "autonomy", delta: 1 }], depthRevealFactId: reveal?.id || null },
    { id: "feeling", label: "Ask for help because you feel overwhelmed", result: `You admit that handling it alone is not working very well. ${first(person)} helps you slow the situation down.`, effects: [relationshipEffect(person, "closeness", 2), { type: "health", key: "stress", delta: -2 }] },
  ];
  if (actionId === "help") return [
    { id: "ask", label: "Ask what would actually help", result: `${first(person)} gives you one small thing you can genuinely do.`, effects: [relationshipEffect(person, "trust", 2)] },
    { id: "do", label: "Just take care of a small task", result: "You handle one ordinary thing without turning yourself into the person responsible for everything.", effects: [relationshipEffect(person, "closeness", 2), { type: "development", key: "autonomy", delta: 1 }] },
    { id: "company", label: "Keep them company instead", result: `You stay near ${first(person)} without making the moment into a project.`, effects: [relationshipEffect(person, "closeness", 2)], depthRevealFactId: reveal?.id || null },
  ];
  if (actionId === "invite") return [
    { id: "one_on_one", label: "Make a one-on-one plan", result: `You and ${first(person)} make room for time that is deliberately just yours.`, effects: [relationshipEffect(person, "closeness", 3), relationshipEffect(person, "trust", 1)] },
    { id: "group", label: "Include other friends too", result: "The plan becomes part of a wider social circle instead of a test of one friendship.", effects: [relationshipEffect(person, "closeness", 2), { type: "development", key: "socialComfort", delta: 1 }] },
    { id: "their_idea", label: `Ask what ${first(person)} wants to do`, result: `You let ${first(person)} choose the shape of the plan this time.`, effects: [relationshipEffect(person, "trust", 2)], depthRevealFactId: reveal?.id || null },
  ];
  if (actionId === "seek") return [
    { id: "close", label: "Stay close to them", result: `You settle near ${first(person)} until your attention moves somewhere else.`, effects: [relationshipEffect(person, "closeness", 2), { type: "development", key: "attachment", delta: 1 }] },
    { id: "watch", label: "Watch what they are doing", result: "Their movements are familiar enough to hold your attention for a while.", effects: [relationshipEffect(person, "familiarity", 2)], depthRevealFactId: reveal?.id || null },
  ];
  if (actionId === "play") return [
    { id: "follow", label: `Follow ${first(person)}'s game`, result: `You let ${first(person)} lead and find your own place inside the game.`, effects: [relationshipEffect(person, "trust", 2)], depthRevealFactId: reveal?.id || null },
    { id: "lead", label: "Decide what to play", result: "You take the lead and keep adjusting the game until it works for both of you.", effects: [relationshipEffect(person, "closeness", 2), { type: "development", key: "confidence", delta: 1 }] },
    { id: "silly", label: "Make it as silly as possible", result: "The game becomes less coherent and substantially funnier.", effects: [relationshipEffect(person, "closeness", 2)] },
  ];
  return [
    { id: "their_interest", label: `Do something ${first(person)} enjoys`, result: `You spend a little time inside ${first(person)}'s interests instead of always choosing yours.`, effects: [relationshipEffect(person, "closeness", 2)], depthRevealFactId: reveal?.id || null },
    { id: "your_interest", label: "Suggest something you enjoy", result: `You invite ${first(person)} into something that feels more like yours.`, effects: [relationshipEffect(person, "trust", 1), relationshipEffect(person, "closeness", 1)] },
    { id: "nothing_big", label: "Just be around each other", result: "You do not need an activity impressive enough to justify the time. You simply share some of it.", effects: [relationshipEffect(person, "familiarity", 2)] },
  ];
}

export function interactionEventForState(state) {
  ensureChildhoodDepth(state);
  const request = root(state).requestedInteraction;
  if (!request) return null;
  const person = (state.people || []).find((item) => item.id === request.personId && !item.deceased);
  if (!person) {
    root(state).requestedInteraction = null;
    return null;
  }
  const action = actionDefinitions(state, person).find((item) => item.id === request.actionId);
  if (!action) {
    root(state).requestedInteraction = null;
    return null;
  }
  return {
    id: `relationship_action_${request.actionId}_${person.id}_${age(state)}`,
    category: person.role === "friend" ? "Friends" : "Family",
    title: `${action.label} · ${first(person)}`,
    body: `You choose to make a little room for ${first(person)} instead of waiting for the day to force the relationship into an event.`,
    prompt: "How does the time together take shape?",
    choices: interactionChoices(state, person, request.actionId),
    childhoodDepthKind: "interaction",
    childhoodPersonId: person.id,
    depthActionId: request.actionId,
  };
}

export function shouldInsertLittleMoment(state) {
  ensureChildhoodDepth(state);
  const depth = root(state);
  if (state.completed || age(state) >= 156 || depth.pendingAdvance || depth.requestedInteraction) return false;
  if (!state.resolution || state.resolution.depthKind) return false;
  const roll = mixed(state, 311 + depth.majorMomentCount) % 100;
  const chance = age(state) < 36 ? 82 : age(state) < 60 ? 76 : 64;
  return roll < chance && eligibleLittleMoments(state).length > 0;
}

export function beginLittleMomentPause(state) {
  ensureChildhoodDepth(state);
  const depth = root(state);
  if (!state.resolution || depth.pendingAdvance) return false;
  depth.pendingAdvance = { resolution: state.resolution, currentEventId: state.currentEventId || null };
  depth.activeLittleMoment = null;
  depth.majorMomentCount += 1;
  depth.sceneCount += 1;
  state.resolution = null;
  return true;
}

export function restorePendingAdvance(state) {
  ensureChildhoodDepth(state);
  const depth = root(state);
  if (!depth.pendingAdvance) return null;
  const pending = depth.pendingAdvance;
  state.resolution = pending.resolution || { choiceId: "depth-pending", result: "" };
  if (pending.currentEventId != null) state.currentEventId = pending.currentEventId;
  depth.pendingAdvance = null;
  depth.activeLittleMoment = null;
  return pending;
}

export function clearDepthResolutionWithoutTime(state) {
  ensureChildhoodDepth(state);
  state.resolution = null;
  root(state).activeLittleMoment = null;
  return state;
}

export function commitDepthEvent(state, event, choice) {
  ensureChildhoodDepth(state);
  const depth = root(state);
  const person = event.childhoodPersonId ? (state.people || []).find((item) => item.id === event.childhoodPersonId) : null;
  if (choice.depthRevealFactId && person) discoverFact(state, person, choice.depthRevealFactId, event.childhoodDepthKind === "interaction" ? "conversation" : "time together");
  if (person) {
    person.lastInteractionAtMonths = age(state);
    person.history ||= [];
    person.history.push({
      ageMonths: age(state), date: { ...(state.date || {}) }, eventId: event.id, choiceId: choice.id,
      note: choice.result, ordinary: true, playerInitiated: event.childhoodDepthKind === "interaction",
    });
    person.history = person.history.slice(-50);
  }
  if (event.childhoodDepthKind === "little-moment") {
    depth.littleMomentCount += 1;
    depth.sceneCount += 1;
    depth.recentLittleMomentIds = [event.depthTemplateId, ...depth.recentLittleMomentIds.filter((id) => id !== event.depthTemplateId)].slice(0, 5);
    depth.activeLittleMoment = null;
  }
  if (event.childhoodDepthKind === "interaction") {
    depth.sceneCount += 1;
    depth.interactionBudget.used += 1;
    if (person) depth.interactionCooldowns[person.id] = age(state);
    depth.requestedInteraction = null;
  }
  if (person && (person.closeness || 0) >= 72 && mixed(state, 401 + depth.sceneCount, person.id) % 9 === 0) {
    state.memories ||= [];
    state.memories.push({
      id: `ordinary-${person.id}-${age(state)}-${depth.sceneCount}`,
      age: Math.floor(age(state) / 12), ageMonths: age(state),
      date: `${state.date?.year || ""}-${(state.date?.month ?? 0) + 1}-${state.date?.day || 1}`,
      title: `An ordinary moment with ${first(person)}`,
      copy: choice.result,
      importance: 2,
      featured: false,
      sourceEventId: event.id,
      sourceChoiceId: choice.id,
      personId: person.id,
    });
    state.memories = state.memories.slice(-160);
  }
  return state;
}

export function depthPacingSnapshot(state) {
  ensureChildhoodDepth(state);
  const depth = root(state);
  return {
    scenes: depth.sceneCount,
    majorMoments: depth.majorMomentCount,
    littleMoments: depth.littleMomentCount,
    pendingAdvance: Boolean(depth.pendingAdvance),
    interactionBudgetUsed: depth.interactionBudget.used,
  };
}
