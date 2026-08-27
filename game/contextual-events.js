const clamp = (value, min = 0, max = 100) => Math.max(min, Math.min(max, value));

function ensureContextState(state) {
  state.contextual ||= { seen: [], activeThread: null, illness: { label: null, turns: 0 } };
  state.contextual.seen ||= [];
  state.contextual.illness ||= { label: null, turns: 0 };
  return state.contextual;
}

function visiblePeople(state) {
  const ageMonths = state.character?.ageMonths || 0;
  return (state.people || []).filter((person) => !person.deceased && (person.introducedAtMonths || 0) <= ageMonths);
}

function householdPeople(state) {
  const visible = visiblePeople(state).filter((person) => person.role !== "friend" && person.role !== "teacher");
  const explicit = visible.filter((person) => person.family?.household === true);
  if (explicit.length) return explicit;
  return visible.filter((person) => ["guardian", "secondGuardian", "sibling"].includes(person.role));
}

function caregivers(state) {
  const visible = visiblePeople(state);
  const explicit = visible.filter((person) => person.family?.caregiver === true);
  const fallback = visible.filter((person) => ["guardian", "secondGuardian"].includes(person.role));
  const list = explicit.length ? explicit : fallback;
  const preferredId = state.realism?.family?.primaryCaregiverId;
  if (!preferredId) return list;
  return [...list].sort((a, b) => (a.id === preferredId ? -1 : b.id === preferredId ? 1 : 0));
}

function primaryCaregiver(state) {
  return caregivers(state)[0] || null;
}

function personById(state, id) {
  return (state.people || []).find((person) => person.id === id) || null;
}

function firstName(person, fallback = "someone in your family") {
  return person?.name?.split(" ")[0] || fallback;
}

function recentIllnessUpdate(state) {
  return (state.realism?.latest || []).some((item) => {
    if (item.category !== "Health") return false;
    const text = String(item.text || "").toLowerCase();
    return text.includes("get sick enough")
      || text.includes("become seriously ill")
      || text.includes("illness gets worse")
      || text.includes("condition becomes serious");
  });
}

function hasIllnessContext(state) {
  return Boolean(state.realism?.active?.length || recentIllnessUpdate(state));
}

function illnessLabel(state) {
  return state.realism?.active?.[0]?.label || state.contextual?.illness?.label || "illness";
}

function ageBand(state) {
  const months = state.character?.ageMonths || 0;
  if (months < 12) return "infant";
  if (months < 36) return "toddler";
  return "child";
}

function relationshipEffect(person, key, delta) {
  return person ? { type: "relationship", targetId: person.id, key, delta } : null;
}

function compactEffects(...effects) {
  return effects.filter(Boolean);
}

function infantChoices(state, tone = "change") {
  const caregiver = primaryCaregiver(state);
  if (tone === "illness") {
    return [
      { id: "cling", label: "Curl into familiar arms", result: "You stay close to a familiar body and voice. You are still uncomfortable, but the closeness helps you settle for a while.", effects: compactEffects(relationshipEffect(caregiver, "trust", 3), { type: "health", key: "stress", delta: -2 }) },
      { id: "sleep", label: "Sleep when you can", result: "You drift in and out of sleep while the adults around you keep checking on you.", effects: [{ type: "health", key: "energy", delta: 4 }, { type: "health", key: "stress", delta: -1 }] },
      { id: "fuss", label: "Keep fussing", result: "Nothing feels quite right, so you cry and resist being settled. Your caregiver keeps trying anyway.", effects: compactEffects(relationshipEffect(caregiver, "familiarity", 2), { type: "personality", key: "sensitivity", delta: 1 }) },
    ];
  }
  return [
    { id: "comfort", label: "Reach for familiar comfort", result: "You move toward the person and sensations you know best. Familiarity matters even before you have words for it.", effects: compactEffects(relationshipEffect(caregiver, "closeness", 2), { type: "health", key: "stress", delta: -1 }) },
    { id: "watch", label: "Watch what is changing", result: "You stare at faces, movement, and rooms that feel slightly different from before.", effects: [{ type: "personality", key: "curiosity", delta: 2 }] },
    { id: "fuss", label: "Cry when it feels wrong", result: "You cannot explain what changed. You can only make it clear that you noticed.", effects: compactEffects(relationshipEffect(caregiver, "familiarity", 1), { type: "personality", key: "sensitivity", delta: 1 }) },
  ];
}

function toddlerChoices(state, tone = "change") {
  const caregiver = primaryCaregiver(state);
  if (tone === "illness") {
    return [
      { id: "rest", label: "Stay close and rest", result: "You spend more of the day leaning against someone familiar or sleeping nearby.", effects: compactEffects(relationshipEffect(caregiver, "closeness", 2), { type: "health", key: "energy", delta: 4 }) },
      { id: "quiet", label: "Play quietly for a while", result: "You do something small without asking too much from your body, then rest again when you tire.", effects: [{ type: "health", key: "energy", delta: 2 }, { type: "personality", key: "curiosity", delta: 1 }] },
      { id: "resist", label: "Insist you are fine", result: "You keep trying to move around normally until tiredness catches up with you.", effects: [{ type: "health", key: "energy", delta: -2 }, { type: "personality", key: "independence", delta: 1 }] },
    ];
  }
  return [
    { id: "close", label: "Stay close to your caregiver", result: "You keep returning to the person whose presence makes the change easier to understand.", effects: compactEffects(relationshipEffect(caregiver, "closeness", 2), { type: "health", key: "stress", delta: -1 }) },
    { id: "ask", label: "Ask what is happening", result: "Your questions are simple, but the adults answer as best they can. A little explanation makes the change less mysterious.", effects: compactEffects(relationshipEffect(caregiver, "trust", 2), { type: "personality", key: "curiosity", delta: 1 }) },
    { id: "play", label: "Keep playing nearby", result: "You return to play while the adults handle the complicated parts around you.", effects: [{ type: "personality", key: "independence", delta: 1 }, { type: "health", key: "stress", delta: -1 }] },
  ];
}

function childChoices(state, type, stage, person) {
  const caregiver = primaryCaregiver(state);
  const close = compactEffects(relationshipEffect(caregiver, "trust", 2), { type: "health", key: "stress", delta: -1 });
  const personTrust = compactEffects(relationshipEffect(person, "trust", 2));
  const common = [
    { id: "ask", label: "Ask what is going to change", result: "You ask for the practical version rather than pretending you do not care. Knowing a little more makes the situation easier to place.", effects: close },
    { id: "quiet", label: "Keep your feelings mostly to yourself", result: "You watch what everyone else is doing and try to understand the change privately.", effects: [{ type: "personality", key: "independence", delta: 1 }, { type: "personality", key: "sensitivity", delta: 1 }] },
    { id: "near", label: "Stay near someone familiar", result: "You do not solve anything. You simply choose not to be alone with it.", effects: compactEffects(relationshipEffect(caregiver, "closeness", 2), relationshipEffect(person, "closeness", 1), { type: "health", key: "stress", delta: -1 }) },
  ];

  if (type === "job_loss" && stage > 0) {
    return [
      { id: "understand", label: "Ask what the family can still afford", result: "The answer is not a full household budget, but you begin to understand why some choices are changing.", effects: close },
      { id: "help", label: "Try to be easier about small wants", result: "You stop asking for a few things you would normally want. It does not fix the money problem, but it changes the pressure around small decisions.", effects: [{ type: "personality", key: "structure", delta: 1 }, { type: "personality", key: "independence", delta: 1 }] },
      { id: "normal", label: "Try to keep life feeling normal", result: "You hold onto familiar routines while the adults deal with the money problem.", effects: [{ type: "health", key: "stress", delta: -1 }] },
    ];
  }
  if (type === "separation" && stage > 0) {
    return [
      { id: "schedule", label: "Ask about the new routine", result: "You learn where you will sleep, who will be there, and what parts of the week will look different.", effects: close },
      { id: "miss", label: `Admit you miss ${firstName(person, "them")}`, result: "Saying it out loud does not reverse the separation, but it gives the feeling somewhere to go.", effects: personTrust },
      { id: "space", label: "Keep some distance from the tension", result: "You spend more time in your own corner of the household while the adults handle their relationship.", effects: [{ type: "personality", key: "independence", delta: 2 }] },
    ];
  }
  if (type === "move" && stage > 0) {
    return [
      { id: "explore", label: "Learn the new neighborhood", result: "Routes that felt unfamiliar begin turning into places you recognize.", effects: [{ type: "personality", key: "curiosity", delta: 2 }, { type: "personality", key: "risk", delta: 1 }] },
      { id: "room", label: "Make your space feel like yours", result: "A few familiar objects and routines make the new room stop feeling temporary.", effects: [{ type: "personality", key: "structure", delta: 2 }, { type: "health", key: "stress", delta: -1 }] },
      { id: "old", label: "Keep thinking about the old home", result: "You compare the new place with the old one for a while. Familiarity takes longer than an address change.", effects: [{ type: "personality", key: "sensitivity", delta: 1 }] },
    ];
  }
  if (type === "birth" && stage > 0) {
    return [
      { id: "help", label: "Help with one small thing", result: "You take on one tiny part of the new routine and begin finding your place in it.", effects: [{ type: "personality", key: "structure", delta: 1 }, { type: "personality", key: "independence", delta: 1 }] },
      { id: "attention", label: "Ask for time with your caregiver too", result: "You make it clear that the new baby is not the only person who still needs attention.", effects: compactEffects(relationshipEffect(caregiver, "closeness", 2), { type: "health", key: "stress", delta: -1 }) },
      { id: "observe", label: "Watch the baby from a distance", result: "You study the new person and the way everyone behaves around them before deciding how involved you want to be.", effects: [{ type: "personality", key: "curiosity", delta: 1 }] },
    ];
  }
  if (type === "death" && stage > 0) {
    return [
      { id: "remember", label: "Talk about something you remember", result: "The memory does not make the loss smaller, but it makes the person feel less erased by it.", effects: close },
      { id: "private", label: "Grieve privately", result: "You keep most of your feelings inside and let them arrive when they arrive.", effects: [{ type: "personality", key: "sensitivity", delta: 1 }] },
      { id: "routine", label: "Hold onto ordinary routines", result: "Meals, school, chores, and sleep become useful simply because they still happen in the expected order.", effects: [{ type: "personality", key: "structure", delta: 2 }, { type: "health", key: "stress", delta: -1 }] },
    ];
  }
  return common;
}

function eventChoicesFor(state, type, stage, person) {
  const band = ageBand(state);
  if (band === "infant") return infantChoices(state, type === "illness" ? "illness" : "change");
  if (band === "toddler") return toddlerChoices(state, type === "illness" ? "illness" : "change");
  if (type === "illness") {
    return [
      { id: "rest", label: "Actually rest", result: "You let the day become quiet and uneventful. Your body has more use for rest than for proving anything right now.", effects: [{ type: "health", key: "energy", delta: 5 }, { type: "health", key: "stress", delta: -2 }] },
      { id: "quiet", label: "Find something quiet to do", result: "You keep yourself occupied without asking much from your body, then rest when you need to.", effects: [{ type: "health", key: "energy", delta: 2 }, { type: "interest", key: "reading", delta: 1 }, { type: "interest", key: "drawing", delta: 1 }] },
      { id: "push", label: "Keep trying to get up", result: "You keep insisting you are less tired than you are. Your body eventually wins the argument.", effects: [{ type: "health", key: "energy", delta: -3 }, { type: "personality", key: "risk", delta: 1 }] },
    ];
  }
  return childChoices(state, type, stage, person);
}

function illnessEvent(state) {
  const context = ensureContextState(state);
  const label = illnessLabel(state);
  if (context.illness.label !== label) context.illness = { label, turns: 0 };
  const turns = context.illness.turns || 0;
  const person = primaryCaregiver(state);
  const delayed = state.realism?.active?.[0]?.delayed;
  const intro = turns > 0
    ? `You are still dealing with a ${label}. This has lasted beyond a single bad day, and the household routine continues bending around it.`
    : ageBand(state) === "infant"
      ? `Your body feels wrong in a way you cannot understand yet. You are tired, uncomfortable, and harder to settle than usual while ${person?.name || "the person caring for you"} keeps checking on you.`
      : `You are dealing with a ${label}. The plans you would normally have are pushed aside while your body tries to recover.`;
  return {
    id: turns > 0 ? "context_illness_continues" : "context_illness_begins",
    category: "Health",
    title: turns > 0 ? "You are still sick" : ageBand(state) === "infant" ? "You don't feel well" : "A sick day",
    body: delayed ? `${intro} Getting medical care is taking longer than your family would like because money and practical access are getting in the way.` : intro,
    prompt: ageBand(state) === "infant" ? "How do you respond?" : "What do you do while you're sick?",
    choices: eventChoicesFor(state, "illness", turns, person),
    contextKind: "illness",
  };
}

function recoveryEvent(state) {
  const label = state.contextual?.illness?.label || "illness";
  const band = ageBand(state);
  const caregiver = primaryCaregiver(state);
  const choices = band === "infant" ? infantChoices(state) : band === "toddler" ? toddlerChoices(state) : [
    { id: "slow", label: "Take it slowly", result: "You return to normal routines without pretending your energy is completely back yet.", effects: [{ type: "health", key: "energy", delta: 2 }, { type: "health", key: "stress", delta: -1 }] },
    { id: "normal", label: "Go back to normal", result: "You are relieved enough to throw yourself back into the routines you missed.", effects: [{ type: "personality", key: "independence", delta: 1 }] },
    { id: "thank", label: `Stay close to ${firstName(caregiver, "your caregiver")}`, result: "The days of being cared for leave a small mark on how safe that person feels to you.", effects: compactEffects(relationshipEffect(caregiver, "trust", 2), relationshipEffect(caregiver, "closeness", 1)) },
  ];
  return {
    id: "context_recovery",
    category: "Health",
    title: "You are getting better",
    body: `The ${label} has finally loosened its grip. Your routine starts returning, although recovery is less dramatic than getting sick was.`,
    prompt: band === "infant" ? "What settles you now?" : "How do you return to normal?",
    choices,
    contextKind: "recovery",
  };
}

const majorRules = [
  { type: "death", priority: 100, category: "Family", match: (text) => /\bdied\b|\bdeath\b/.test(text) },
  { type: "separation", priority: 82, category: "Family", match: (text) => text.includes("decided to separate") || text.includes("separate routine") },
  { type: "move", priority: 74, category: "Home", match: (text) => text.includes("family moves from") || text.includes("family move") },
  { type: "birth", priority: 70, category: "Family", match: (text) => text.includes(" is born") && text.includes("household") },
  { type: "job_loss", priority: 66, category: "Family", match: (text) => text.includes("lost their job") },
  { type: "caregiver_change", priority: 62, category: "Family", match: (text) => text.includes("everyday care lately") || text.includes("primary caregiver") },
  { type: "family_health", priority: 60, category: "Family", match: (text) => text.includes("developed a health problem") },
  { type: "family_crisis", priority: 58, category: "Family", match: (text) => text.includes("drinking more") || text.includes("gambling") || text.includes("relying on substances") },
];

function classifyMajorUpdate(item) {
  const text = String(item.text || item.note || "").toLowerCase();
  for (const rule of majorRules) {
    if (item.category === rule.category && rule.match(text)) return { ...rule, text: item.text || item.note || "" };
  }
  return null;
}

function syncMajorThread(state) {
  const context = ensureContextState(state);
  const updates = state.realism?.latest || [];
  const candidates = updates.map((item) => {
    const classified = classifyMajorUpdate(item);
    if (!classified) return null;
    const sourceKey = `${item.ageMonths ?? state.character.ageMonths}|${item.category}|${item.text || item.note}`;
    return { ...classified, sourceKey, personId: item.personId || null, ageMonths: item.ageMonths ?? state.character.ageMonths };
  }).filter(Boolean).sort((a, b) => b.priority - a.priority);

  const next = candidates.find((candidate) => !context.seen.includes(candidate.sourceKey));
  if (!next) return context.activeThread;
  if (!context.activeThread || next.priority > (context.activeThread.priority || 0)) {
    context.activeThread = { ...next, stage: 0 };
    context.seen.push(next.sourceKey);
    context.seen = context.seen.slice(-30);
  }
  return context.activeThread;
}

function threadCopy(thread, person, stage) {
  const who = firstName(person, "someone in your family");
  const map = {
    death: stage === 0
      ? ["Someone is gone", thread.text || `${who} has died. The household changes immediately around an absence nobody chose.`]
      : ["Their absence is part of the routine now", `The first shock has passed, but ${who}'s absence keeps appearing in ordinary places: meals, rooms, habits, and conversations that used to include them.`],
    separation: stage === 0
      ? ["Your family is changing shape", thread.text || "The adults who were together have decided to separate. Home no longer has one obvious routine."]
      : ["A different routine is taking shape", "The separation did not end after one conversation. Schedules, rooms, handoffs, and loyalties are slowly becoming part of everyday life."],
    move: stage === 0
      ? ["Your family moves", thread.text || "Your family leaves one home and starts living in another. Familiar routines suddenly happen in unfamiliar rooms."]
      : ["The new place is becoming familiar", "You are starting to know which sounds belong to this home, where things are kept, and how the neighborhood fits together."],
    birth: stage === 0
      ? ["There is a new baby at home", thread.text || "A new baby has joined the household. Sleep, attention, noise, and routines all rearrange themselves around one very small person."]
      : ["Life with the baby", "The baby is no longer a single big event. They are becoming part of the household's ordinary rhythm, including the inconvenient parts."],
    job_loss: stage === 0
      ? ["Work disappears", thread.text || `${who} has lost their job. The adults start talking more carefully about money and what can wait.`]
      : ["Money feels tighter", "The job loss is still affecting ordinary choices. Some purchases are delayed, some plans get smaller, and adults notice prices more than before."],
    caregiver_change: stage === 0
      ? ["Someone else is caring for you more", thread.text || `${who} has started handling more of your everyday care. Familiar routines begin reorganizing around a different person.`]
      : ["A new caregiving rhythm", "The change is becoming normal. The person who wakes you, feeds you, helps you, or waits for you is not always the same person who did before."],
    family_health: stage === 0
      ? ["Someone at home is unwell", thread.text || `${who} has a health problem that now affects the household routine.`]
      : ["Care takes time", "Appointments, rest, worry, and practical help continue to take up space in family life."],
    family_crisis: stage === 0
      ? ["Something is wrong at home", thread.text || "An adult's coping has started affecting the household. The tension is becoming difficult to ignore."]
      : ["The tension has not disappeared", "The problem has become part of the background of home life. Some days are calmer, but everyone has started adjusting around it."],
  };
  return map[thread.type] || ["Something changes", thread.text || "A major change has reached your household."];
}

function majorThreadEvent(state, thread) {
  const person = personById(state, thread.personId);
  const [title, body] = threadCopy(thread, person, thread.stage || 0);
  return {
    id: `context_thread_${thread.type}_${thread.stage || 0}`,
    category: thread.category || "Family",
    title,
    body,
    prompt: ageBand(state) === "infant" ? "How do you respond to the change around you?" : ageBand(state) === "toddler" ? "What do you do as things change?" : "What do you do?",
    choices: eventChoicesFor(state, thread.type, thread.stage || 0, person),
    contextKind: "thread",
    threadType: thread.type,
  };
}

function developmentalEvent(state) {
  const age = state.character?.ageMonths || 0;
  const caregiver = primaryCaregiver(state);
  const caregiverName = firstName(caregiver, "your caregiver");
  let event;
  if (age < 3) event = {
    id: "context_dev_newborn", category: "Family", title: "Familiar voices", body: `Most of the world is light, sound, hunger, warmth, and being moved from place to place. ${caregiverName}'s voice is already becoming one of the sounds you know.`, prompt: "What settles you?",
    choices: [
      { id: "voice", label: "Listen to the familiar voice", result: "The voice stays close while the rest of the world remains mostly impossible to understand.", effects: compactEffects(relationshipEffect(caregiver, "familiarity", 3)) },
      { id: "held", label: "Relax while being held", result: "Warmth, pressure, and a steady body make the world less abrupt for a while.", effects: compactEffects(relationshipEffect(caregiver, "trust", 2), { type: "health", key: "stress", delta: -1 }) },
      { id: "sleep", label: "Fall asleep again", result: "The world disappears for another stretch of sleep, as newborn worlds frequently do.", effects: [{ type: "health", key: "energy", delta: 2 }] },
    ],
  };
  else if (age < 6) event = {
    id: "context_dev_smile", category: "Self", title: "Faces are becoming familiar", body: "You spend longer studying faces now. Sometimes a familiar expression pulls a smile out of you before you know what a smile is for.", prompt: "Who gets most of your attention?", choices: infantChoices(state),
  };
  else if (age < 9) event = {
    id: "context_dev_reach", category: "Self", title: "Everything is within reach, eventually", body: "Your hands are getting better at finding things on purpose. Fabric, fingers, toys, cups, and anything irresponsibly left nearby have become research material.", prompt: "What do you do?",
    choices: [
      { id: "grab", label: "Grab the nearest object", result: "You catch it, lose it, catch it again, and learn more from the repetition than anyone watching can see.", effects: [{ type: "personality", key: "curiosity", delta: 2 }] },
      { id: "face", label: `Reach for ${caregiverName}`, result: "You reach toward a familiar face and get an immediate reaction in return.", effects: compactEffects(relationshipEffect(caregiver, "closeness", 2)) },
      { id: "taste", label: "Try to put something in your mouth", result: "This remains one of your preferred scientific methods. The adults remain committed to peer review.", effects: [{ type: "personality", key: "curiosity", delta: 1 }, { type: "personality", key: "risk", delta: 1 }] },
    ],
  };
  else if (age < 12) event = {
    id: "context_dev_move", category: "Self", title: "You want to get there yourself", body: "The room no longer feels like something you only observe from where somebody puts you. You are finding ways to scoot, crawl, pull, and reach toward whatever interests you.", prompt: "Where do you go?",
    choices: [
      { id: "caregiver", label: `Move toward ${caregiverName}`, result: "You cross the small distance under your own power and arrive at someone familiar.", effects: compactEffects(relationshipEffect(caregiver, "closeness", 2), { type: "personality", key: "independence", delta: 1 }) },
      { id: "object", label: "Go after something interesting", result: "The object becomes important enough to justify the entire journey across the floor.", effects: [{ type: "personality", key: "curiosity", delta: 2 }, { type: "personality", key: "independence", delta: 1 }] },
      { id: "stay", label: "Stay where you feel safe", result: "You watch first. Movement can wait until the room feels predictable again.", effects: [{ type: "personality", key: "risk", delta: -1 }] },
    ],
  };
  else if (age < 16) event = {
    id: "context_dev_stand", category: "Self", title: "The room looks different standing up", body: "Furniture has become something to hold onto while you pull yourself upright. Being vertical is unstable, exciting, and apparently worth repeating.", prompt: "What do you try?",
    choices: [
      { id: "step", label: "Try a step", result: "You shift your weight, wobble, and discover that falling is currently part of the method.", effects: [{ type: "personality", key: "risk", delta: 2 }, { type: "personality", key: "independence", delta: 1 }] },
      { id: "hand", label: `Hold ${caregiverName}'s hand`, result: "A familiar hand makes the experiment less alarming while you work out what your legs are doing.", effects: compactEffects(relationshipEffect(caregiver, "trust", 2)) },
      { id: "crawl", label: "Crawl instead", result: "Crawling remains faster, safer, and frankly better engineered for now.", effects: [{ type: "personality", key: "structure", delta: 1 }] },
    ],
  };
  else if (age < 20) event = {
    id: "context_dev_words", category: "Self", title: "Sounds are becoming words", body: "You understand more than you can say. A few sounds now reliably make adults look at the right object, person, or problem.", prompt: "What do you try to communicate?",
    choices: [
      { id: "person", label: `Call for ${caregiverName}`, result: "The sound is imperfect, but the right person looks toward you. That feels like success.", effects: compactEffects(relationshipEffect(caregiver, "familiarity", 2), { type: "personality", key: "social", delta: 1 }) },
      { id: "thing", label: "Name something you want", result: "You repeat a sound until an adult finally understands which object has become urgently important.", effects: [{ type: "personality", key: "persistence", delta: 1 }, { type: "personality", key: "curiosity", delta: 1 }] },
      { id: "gesture", label: "Point instead", result: "Pointing remains extremely efficient. Language can catch up later.", effects: [{ type: "personality", key: "independence", delta: 1 }] },
    ],
  };
  else event = {
    id: "context_dev_autonomy", category: "Self", title: "You want to do it yourself", body: "You have discovered a powerful phrase even when you cannot say all of it clearly: no, mine, me, I do it. Adults appear to have mixed feelings about this developmental breakthrough.", prompt: "What do you insist on doing?",
    choices: [
      { id: "eat", label: "Feed yourself", result: "A meaningful percentage of the meal reaches you. The rest contributes to the furniture.", effects: [{ type: "personality", key: "independence", delta: 2 }] },
      { id: "choose", label: "Choose what you carry", result: "The object is not especially useful, but the fact that you chose it matters enormously.", effects: [{ type: "personality", key: "independence", delta: 2 }, { type: "personality", key: "curiosity", delta: 1 }] },
      { id: "help", label: `Let ${caregiverName} help`, result: "You accept help after making it very clear that this was a negotiated settlement.", effects: compactEffects(relationshipEffect(caregiver, "trust", 2), { type: "health", key: "stress", delta: -1 }) },
    ],
  };
  event.contextKind = "development";
  return event;
}

function householdEveningEvent(state) {
  const band = ageBand(state);
  const caregiver = primaryCaregiver(state);
  const sibling = householdPeople(state).find((person) => person.role === "sibling");
  const names = householdPeople(state).map((person) => firstName(person)).slice(0, 4);
  const peopleCopy = names.length ? `${names.join(", ")} ${names.length === 1 ? "is" : "are"} part of the rooms and routines around you tonight.` : "The people caring for you move through their usual routines tonight.";
  if (band === "infant") {
    return { id: "context_household_infant", category: "Home", title: "A quiet evening at home", body: `${peopleCopy} You move between feeding, being held, watching familiar faces, and getting sleepy.`, prompt: "What holds your attention?", choices: infantChoices(state), contextKind: "household" };
  }
  if (band === "toddler") {
    return { id: "context_household_toddler", category: "Home", title: "An ordinary evening", body: `${peopleCopy} You are old enough to move through the house on your own, but still small enough that the adults' routines shape most of the evening.`, prompt: "What do you do?", choices: sibling ? [
      { id: "sibling", label: `Follow ${firstName(sibling)} around`, result: "You make yourself part of whatever they were doing, with mixed success.", effects: compactEffects(relationshipEffect(sibling, "closeness", 2)) },
      ...toddlerChoices(state).slice(0, 2),
    ] : toddlerChoices(state), contextKind: "household" };
  }
  return {
    id: "context_household_child", category: "Home", title: "An ordinary evening", body: `${peopleCopy} Nothing dramatic is happening, which leaves room for the small choices that make a household feel close or distant over time.`, prompt: "Where do you spend the evening?", contextKind: "household",
    choices: [
      { id: "caregiver", label: `Stay near ${firstName(caregiver, "your caregiver")}`, result: "You spend time nearby without needing the conversation to become important.", effects: compactEffects(relationshipEffect(caregiver, "closeness", 2), { type: "health", key: "stress", delta: -1 }) },
      sibling ? { id: "sibling", label: `Spend time with ${firstName(sibling)}`, result: "The evening becomes one more ordinary piece of your relationship, which is how most closeness is actually built.", effects: compactEffects(relationshipEffect(sibling, "closeness", 2)) } : { id: "own", label: "Do something on your own", result: "You settle into something that belongs only to you for a while.", effects: [{ type: "personality", key: "independence", delta: 2 }] },
      { id: "talk", label: "Talk about something on your mind", result: "The subject is not necessarily profound. Somebody listening still changes how it feels to carry it.", effects: compactEffects(relationshipEffect(caregiver, "trust", 2), { type: "personality", key: "social", delta: 1 }) },
    ],
  };
}

function healthyReplacementEvent(state) {
  if ((state.character?.ageMonths || 0) < 24) return developmentalEvent(state);
  return householdEveningEvent(state);
}

export function contextualEventForState(state) {
  if (!state?.character || state.death || state.completed) return null;
  const context = ensureContextState(state);
  if (state.resolution?.contextualEvent) return state.resolution.contextualEvent;

  const thread = syncMajorThread(state);
  if (thread?.type === "death") return majorThreadEvent(state, thread);

  if (hasIllnessContext(state)) return illnessEvent(state);
  if (context.illness.turns > 0) return recoveryEvent(state);

  if (thread) return majorThreadEvent(state, thread);

  const ageMonths = state.character.ageMonths || 0;
  if (ageMonths < 24) return developmentalEvent(state);

  if (state.currentEventId === "sick_day") return healthyReplacementEvent(state);
  if (state.currentEventId === "family_evening") return householdEveningEvent(state);
  return null;
}

function adjust(target, key, delta) {
  if (!target || typeof target[key] !== "number") return;
  target[key] = clamp(target[key] + delta);
}

function applyEffect(state, effect) {
  if (effect.type === "health") adjust(state.health, effect.key, effect.delta);
  if (effect.type === "personality") adjust(state.character?.personality, effect.key, effect.delta);
  if (effect.type === "interest") adjust(state.interests, effect.key, effect.delta);
  if (effect.type === "relationship") {
    const person = effect.targetId
      ? (state.people || []).find((item) => item.id === effect.targetId)
      : (state.people || []).find((item) => item.role === effect.target && !item.deceased);
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

export function resolveContextualChoice(state, choiceId) {
  const event = contextualEventForState(state);
  if (!event || state.resolution) return state;
  const choice = event.choices.find((item) => item.id === choiceId);
  if (!choice) return state;

  (choice.effects || []).forEach((effect) => applyEffect(state, effect));
  state.history ||= [];
  state.history.push({
    ageMonths: state.character.ageMonths,
    date: { ...state.date },
    eventId: event.id,
    title: event.title,
    choiceId: choice.id,
    choice: choice.label,
    result: choice.result,
    continuity: "contextual",
  });

  const context = ensureContextState(state);
  if (event.contextKind === "illness") {
    context.illness.label = illnessLabel(state);
    context.illness.turns = (context.illness.turns || 0) + 1;
  } else if (event.contextKind === "recovery") {
    context.illness = { label: null, turns: 0 };
  } else if (event.contextKind === "thread" && context.activeThread) {
    if ((context.activeThread.stage || 0) >= 1) context.activeThread = null;
    else context.activeThread.stage = 1;
  }

  state.resolution = {
    choiceId: choice.id,
    result: choice.result,
    contextualEventId: event.id,
    contextualEvent: event,
  };
  return state;
}
