import * as core from "./engine.js?core=25";

export * from "./engine.js?core=25";

const clamp = (value, min = 0, max = 100) => Math.max(min, Math.min(max, value));

const EARLY_EVENTS = [
  {
    id: "newborn_feeding_rhythm", category: "Family", min: 0, max: 2, weight: 1.2, once: true,
    title: "A familiar feeding rhythm",
    body: "You wake hungry before the room is ready for you. A caregiver gathers you close, and the familiar sequence of being held, fed, and settled begins again.",
    prompt: "How do you respond?",
    choices: [
      { id: "settle", label: "Settle into the routine", result: "Your body relaxes before you could possibly understand why. Repetition is already teaching you what comes next.", effects: [{ type: "development", key: "attachment", delta: 2 }, { type: "health", key: "stress", delta: -2 }] },
      { id: "eager", label: "Stay eager and alert", result: "You remain wide-eyed through most of it, studying the face above you between hungry little pauses.", effects: [{ type: "personality", key: "curiosity", delta: 2 }, { type: "relationship", target: "guardian", key: "familiarity", delta: 2 }] },
      { id: "fussy", label: "Stay fussy for a while", result: "Hunger, tiredness, and being very new at existing all arrive together. It takes time before you settle.", effects: [{ type: "personality", key: "sensitivity", delta: 1 }] },
    ],
  },
  {
    id: "newborn_face_tracking", category: "Self", min: 0, max: 3, weight: 1.1, once: true,
    title: "A face comes into focus",
    body: "A familiar face leans close enough for the blurry shapes of the world to become eyes, a mouth, and movement.",
    prompt: "What holds your attention?",
    choices: [
      { id: "eyes", label: "Watch their eyes", result: "You stare with the intense seriousness only a newborn can bring to somebody else's eyebrows.", effects: [{ type: "personality", key: "curiosity", delta: 3 }, { type: "relationship", target: "guardian", key: "familiarity", delta: 2 }] },
      { id: "voice", label: "Turn toward their voice", result: "The sound is becoming recognizable even when everything else is still mostly blur and light.", effects: [{ type: "development", key: "attachment", delta: 2 }] },
      { id: "sleep", label: "Lose interest and drift off", result: "The investigation ends because being awake is exhausting work when you have been alive for approximately no time at all.", effects: [{ type: "health", key: "energy", delta: 2 }] },
    ],
  },
  {
    id: "newborn_bath", category: "Home", min: 1, max: 4, weight: 1, once: true,
    title: "Warm water",
    body: "You are lowered into warm bathwater while careful hands keep you supported. The sensation is different from almost everything else you know.",
    prompt: "How does it go?",
    choices: [
      { id: "relax", label: "Relax into the warmth", result: "Your limbs loosen. For several peaceful minutes, the universe seems mostly made of warm water and familiar hands.", effects: [{ type: "health", key: "stress", delta: -2 }, { type: "development", key: "attachment", delta: 1 }] },
      { id: "kick", label: "Kick at the water", result: "A kick creates a splash. This discovery immediately deserves additional research.", effects: [{ type: "personality", key: "curiosity", delta: 3 }, { type: "personality", key: "risk", delta: 1 }] },
      { id: "protest", label: "Object loudly", result: "You announce your objections with the only communication system currently available to you.", effects: [{ type: "personality", key: "sensitivity", delta: 1 }] },
    ],
  },
  {
    id: "infant_reaching", category: "Self", min: 3, max: 8, weight: 1.2, once: true,
    title: "Just out of reach",
    body: "A bright object sits a little beyond your hand. You can see it clearly. Reaching it is a separate engineering problem.",
    prompt: "What do you do?",
    choices: [
      { id: "reach", label: "Keep reaching", result: "After several deeply inefficient attempts, your fingers close around it. An entire field of science is born and immediately drooled on.", effects: [{ type: "development", key: "persistence", delta: 3 }, { type: "personality", key: "curiosity", delta: 2 }] },
      { id: "roll", label: "Try moving your whole body", result: "You shift, twist, and discover that sometimes the rest of you can help your hand solve a problem.", effects: [{ type: "development", key: "autonomy", delta: 2 }, { type: "personality", key: "risk", delta: 1 }] },
      { id: "call", label: "Fuss until someone notices", result: "Someone moves the object closer. Delegation is also a strategy, apparently.", effects: [{ type: "relationship", target: "guardian", key: "closeness", delta: 2 }] },
    ],
  },
  {
    id: "infant_peekaboo", category: "Family", min: 4, max: 10, weight: 1.1, once: true,
    title: "Gone, then back again",
    body: "A caregiver hides their face behind their hands. For a moment they are gone. Then suddenly, impossibly, they are back.",
    prompt: "What do you do?",
    choices: [
      { id: "laugh", label: "Laugh every time", result: "The trick remains excellent despite being performed repeatedly with no meaningful variation.", effects: [{ type: "relationship", target: "guardian", key: "closeness", delta: 3 }, { type: "development", key: "socialComfort", delta: 1 }] },
      { id: "study", label: "Study the trick seriously", result: "You watch the hands closely. Something about people disappearing and returning is becoming less mysterious.", effects: [{ type: "personality", key: "curiosity", delta: 3 }, { type: "development", key: "attachment", delta: 1 }] },
      { id: "startle", label: "Startle when they return", result: "The reappearance is less hilarious from your side of the experiment.", effects: [{ type: "personality", key: "sensitivity", delta: 1 }] },
    ],
  },
  {
    id: "infant_stranger", category: "Self", min: 6, max: 11, weight: 1, once: true,
    title: "An unfamiliar face",
    body: "Someone you do not know well leans in and smiles at you. Their face is friendly. It is also very much not one of the usual faces.",
    prompt: "How do you react?",
    choices: [
      { id: "watch", label: "Watch them carefully", result: "You keep a serious eye on them while staying close to the person you know.", effects: [{ type: "personality", key: "curiosity", delta: 1 }, { type: "development", key: "socialComfort", delta: 1 }] },
      { id: "hide", label: "Turn back toward your caregiver", result: "Familiar shoulders are an excellent place from which to conduct background checks.", effects: [{ type: "development", key: "attachment", delta: 2 }, { type: "personality", key: "social", delta: -1 }] },
      { id: "smile", label: "Smile back", result: "The stranger earns a cautious smile. Apparently the social world may contain more than four approved people.", effects: [{ type: "personality", key: "social", delta: 2 }, { type: "development", key: "socialComfort", delta: 2 }] },
    ],
  },
  {
    id: "infant_first_foods", category: "Health", min: 6, max: 11, weight: 1.1, once: true,
    title: "A suspicious new food",
    body: "A spoon approaches with something soft that is neither milk nor anything you have previously authorized.",
    prompt: "What happens?",
    choices: [
      { id: "taste", label: "Taste it cautiously", result: "The expression on your face suggests a complicated review. You nevertheless open your mouth for another bite.", effects: [{ type: "personality", key: "curiosity", delta: 2 }] },
      { id: "grab", label: "Grab for the spoon", result: "Your interest in feeding yourself arrives well before your qualifications for the position.", effects: [{ type: "development", key: "autonomy", delta: 2 }, { type: "personality", key: "risk", delta: 1 }] },
      { id: "refuse", label: "Refuse it completely", result: "Your mouth closes with the determination of a tiny labor union.", effects: [{ type: "personality", key: "independence", delta: 1 }, { type: "personality", key: "sensitivity", delta: 1 }] },
    ],
  },
  {
    id: "infant_crawling_destination", category: "Home", min: 7, max: 14, weight: 1.1, once: true,
    title: "The room gets bigger",
    body: "You can move across the floor now, slowly and with questionable steering. Several destinations compete for your attention.",
    prompt: "Where do you go?",
    choices: [
      { id: "caregiver", label: "Head toward your caregiver", result: "You cross the room and arrive at a familiar pair of legs, pleased with both the journey and the destination.", effects: [{ type: "development", key: "attachment", delta: 2 }, { type: "relationship", target: "guardian", key: "closeness", delta: 2 }] },
      { id: "object", label: "Investigate something shiny", result: "The object is reached, inspected, and immediately subjected to the standard infant laboratory procedure of trying to put it in your mouth.", effects: [{ type: "personality", key: "curiosity", delta: 3 }, { type: "development", key: "autonomy", delta: 1 }] },
      { id: "doorway", label: "Aim for the doorway", result: "You make a determined attempt to expand your jurisdiction beyond the room before an adult redirects the expedition.", effects: [{ type: "personality", key: "risk", delta: 2 }, { type: "personality", key: "independence", delta: 1 }] },
    ],
  },
  {
    id: "toddler_spoon", category: "Self", min: 12, max: 22, weight: 1.1, once: true,
    title: "I can do it",
    body: "A spoon is placed in your hand at mealtime. Using it yourself is clearly possible. Doing so without redecorating the table is less certain.",
    prompt: "What do you insist on?",
    choices: [
      { id: "self", label: "Feed yourself", result: "Some food reaches your mouth. Some reaches places that raise difficult questions. You remain extremely proud.", effects: [{ type: "development", key: "autonomy", delta: 3 }, { type: "personality", key: "independence", delta: 2 }] },
      { id: "help", label: "Let someone help", result: "You accept assistance and the meal proceeds with suspicious efficiency.", effects: [{ type: "relationship", target: "guardian", key: "trust", delta: 2 }] },
      { id: "both", label: "Take turns", result: "You alternate between independence and help, a compromise civilization will spend the rest of your life rediscovering.", effects: [{ type: "development", key: "autonomy", delta: 2 }, { type: "development", key: "attachment", delta: 1 }] },
    ],
  },
  {
    id: "toddler_words", category: "Self", min: 12, max: 26, weight: 1.2, once: true,
    title: "Words start working",
    body: "You know enough sounds now that adults sometimes understand what you mean without guessing entirely from your pointing.",
    prompt: "What do you use words for most?",
    choices: [
      { id: "name", label: "Name everything you notice", result: "Objects acquire names at an alarming pace. Some pronunciations are creative collaborations between you and language.", effects: [{ type: "education", key: "language", delta: 3 }, { type: "personality", key: "curiosity", delta: 2 }] },
      { id: "ask", label: "Ask for what you want", result: "Words become tools for requesting snacks, toys, people, and occasionally the impossible.", effects: [{ type: "development", key: "autonomy", delta: 2 }, { type: "development", key: "confidence", delta: 1 }] },
      { id: "quiet", label: "Use only a few words", result: "You understand more than you say. For now, watching remains easier than performing conversation on demand.", effects: [{ type: "personality", key: "social", delta: -1 }, { type: "personality", key: "curiosity", delta: 1 }] },
    ],
  },
  {
    id: "toddler_separation", category: "Family", min: 14, max: 30, weight: 1, once: true,
    title: "They leave the room",
    body: "Your caregiver needs to leave you with another familiar adult for a while. You understand enough to know they are going. Time, unfortunately, remains an abstract concept.",
    prompt: "How do you react?",
    choices: [
      { id: "protest", label: "Protest the departure", result: "You make your opinion very clear. The feelings are enormous even though the separation is temporary.", effects: [{ type: "personality", key: "sensitivity", delta: 1 }, { type: "development", key: "attachment", delta: 1 }] },
      { id: "watch", label: "Watch the door for a while", result: "You keep checking where they left. Eventually something else becomes interesting enough to occupy you.", effects: [{ type: "development", key: "emotionalRegulation", delta: 1 }, { type: "personality", key: "curiosity", delta: 1 }] },
      { id: "play", label: "Start playing with the person staying", result: "The transition is easier than expected. Familiarity can apparently exist in more than one person.", effects: [{ type: "development", key: "socialComfort", delta: 2 }, { type: "development", key: "attachment", delta: 1 }] },
    ],
  },
  {
    id: "toddler_blocks", category: "Interests", min: 16, max: 34, weight: 1.1, once: true,
    title: "A tower with ambitions",
    body: "A pile of blocks sits on the floor. Stacking them higher works remarkably well until gravity remembers its responsibilities.",
    prompt: "What do you do when the tower falls?",
    choices: [
      { id: "again", label: "Build it again", result: "The second tower is taller. The third is stranger. Failure is currently just another way to continue playing.", effects: [{ type: "development", key: "persistence", delta: 3 }, { type: "interest", key: "making", delta: 3 }] },
      { id: "knock", label: "Start knocking towers down on purpose", result: "Construction turns into demolition. Both departments report excellent results.", effects: [{ type: "personality", key: "risk", delta: 2 }, { type: "interest", key: "making", delta: 2 }] },
      { id: "leave", label: "Move on to something else", result: "The fallen tower loses your vote. A new activity acquires it immediately.", effects: [{ type: "personality", key: "curiosity", delta: 1 }, { type: "development", key: "persistence", delta: -1 }] },
    ],
  },
  {
    id: "toddler_tantrum_boundary", category: "Self", min: 20, max: 35, weight: 1.2, once: true,
    title: "The answer is no",
    body: "You want something badly enough that the adult answer of “no” feels less like information and more like a constitutional crisis.",
    prompt: "What happens next?",
    choices: [
      { id: "explode", label: "Have the full tantrum", result: "The feeling arrives all at once: loud, physical, and far bigger than the original problem. Eventually it burns itself out.", effects: [{ type: "personality", key: "sensitivity", delta: 2 }, { type: "development", key: "emotionalRegulation", delta: -1 }] },
      { id: "cling", label: "Cry and look for comfort", result: "You remain deeply offended by reality while also wanting to be held through it. Both things can apparently be true.", effects: [{ type: "development", key: "attachment", delta: 2 }, { type: "relationship", target: "guardian", key: "trust", delta: 2 }] },
      { id: "redirect", label: "Let something else distract you", result: "The catastrophe is gradually replaced by another interesting thing. Emotional regulation begins with methods that are not glamorous.", effects: [{ type: "development", key: "emotionalRegulation", delta: 2 }] },
    ],
  },
  {
    id: "toddler_parallel_play", category: "Friends", min: 22, max: 35, weight: 1, once: true,
    title: "Playing beside another child",
    body: "Another child is playing nearby. Neither of you has formally agreed to play together, yet your toys and attention keep drifting into the same small area.",
    prompt: "What do you do?",
    choices: [
      { id: "copy", label: "Copy what they are doing", result: "Soon both of you are doing nearly the same thing while maintaining the fiction that this is entirely independent work.", effects: [{ type: "development", key: "socialComfort", delta: 2 }, { type: "personality", key: "social", delta: 1 }] },
      { id: "share", label: "Offer them one of your toys", result: "The exchange is brief and imperfect, but the idea that another child can join the fun starts making sense.", effects: [{ type: "development", key: "socialComfort", delta: 3 }, { type: "development", key: "confidence", delta: 1 }] },
      { id: "own", label: "Stay focused on your own game", result: "You remain comfortably absorbed in your own small world while another child occupies theirs beside you.", effects: [{ type: "personality", key: "independence", delta: 2 }] },
    ],
  },
  {
    id: "preschool_dress_self", category: "Self", min: 36, max: 48, weight: 1.1, once: true,
    title: "Getting dressed yourself",
    body: "You are old enough to insist that you can get dressed without help. The shirt has several openings and none of them have supplied instructions.",
    prompt: "How do you handle it?",
    choices: [
      { id: "persist", label: "Keep trying alone", result: "It takes far too long, but eventually your head emerges from the correct opening. Victory is slightly crooked.", effects: [{ type: "development", key: "autonomy", delta: 3 }, { type: "development", key: "persistence", delta: 2 }] },
      { id: "ask", label: "Ask for help when you get stuck", result: "You do most of it yourself and accept help with the impossible part. This turns out not to invalidate the achievement.", effects: [{ type: "development", key: "autonomy", delta: 2 }, { type: "relationship", target: "guardian", key: "trust", delta: 2 }] },
      { id: "giveup", label: "Hand the whole problem back", result: "An adult finishes the job in seconds, an irritating demonstration of experience.", effects: [{ type: "development", key: "autonomy", delta: -1 }] },
    ],
  },
  {
    id: "preschool_why", category: "Self", min: 36, max: 55, weight: 1.2, once: true,
    title: "Why?",
    body: "Questions now reproduce faster than adults can answer them. One explanation simply creates three more reasons to ask why.",
    prompt: "What kind of questioner are you?",
    choices: [
      { id: "everything", label: "Ask about everything", result: "The adults begin answering with increasing caution because every sentence may contain another question seed.", effects: [{ type: "personality", key: "curiosity", delta: 4 }, { type: "education", key: "language", delta: 2 }] },
      { id: "test", label: "Try things to find out yourself", result: "Questions turn into experiments. Some are useful. Some explain why adults hide certain objects on higher shelves.", effects: [{ type: "personality", key: "curiosity", delta: 3 }, { type: "personality", key: "risk", delta: 2 }] },
      { id: "listen", label: "Mostly listen to the answers", result: "You store explanations carefully, even when you do not immediately have another question ready.", effects: [{ type: "personality", key: "structure", delta: 2 }, { type: "education", key: "language", delta: 2 }] },
    ],
  },
  {
    id: "preschool_imaginary_game", category: "Interests", min: 36, max: 59, weight: 1.1, once: true,
    title: "The room becomes somewhere else",
    body: "A blanket, two chairs, and several ordinary objects are available. This is enough infrastructure for an entirely different world.",
    prompt: "What does the game become?",
    choices: [
      { id: "house", label: "A house with complicated rules", result: "Everyone receives a role, several rules are invented, and at least one stuffed animal is assigned a job.", effects: [{ type: "interest", key: "making", delta: 3 }, { type: "personality", key: "structure", delta: 2 }] },
      { id: "adventure", label: "An enormous adventure", result: "The floor becomes dangerous territory and the furniture develops geography. Ordinary rooms are surprisingly cooperative about this.", effects: [{ type: "personality", key: "curiosity", delta: 3 }, { type: "personality", key: "risk", delta: 2 }] },
      { id: "quiet", label: "A quiet world just for you", result: "The game stays mostly inside your own head, detailed enough that company would almost complicate it.", effects: [{ type: "personality", key: "independence", delta: 2 }, { type: "interest", key: "making", delta: 2 }] },
    ],
  },
  {
    id: "preschool_night_fear", category: "Home", min: 38, max: 59, weight: 1, once: true,
    title: "Something in the dark",
    body: "At night, a familiar shape in the room becomes much more suspicious than it was during the day.",
    prompt: "What do you do?",
    choices: [
      { id: "call", label: "Call for your caregiver", result: "Someone comes, turns on a light, and reveals the terrifying object to be a piece of furniture behaving badly in shadow.", effects: [{ type: "development", key: "attachment", delta: 2 }, { type: "health", key: "stress", delta: -2 }] },
      { id: "check", label: "Go look at it yourself", result: "The closer you get, the more ordinary it becomes. Courage turns out to involve walking toward some very embarrassing laundry.", effects: [{ type: "development", key: "confidence", delta: 2 }, { type: "development", key: "autonomy", delta: 2 }] },
      { id: "hide", label: "Hide under the blanket", result: "The blanket provides no measurable defensive advantage and nevertheless improves the situation enormously.", effects: [{ type: "personality", key: "sensitivity", delta: 1 }] },
    ],
  },
  {
    id: "preschool_sharing", category: "Friends", min: 40, max: 59, weight: 1.1, once: true,
    title: "Someone wants what you have",
    body: "Another child asks for a turn with something you are using. You are not finished with it, which seems like highly relevant information.",
    prompt: "What do you do?",
    choices: [
      { id: "turn", label: "Agree to take turns", result: "Waiting remains unpleasant, but the game survives the handoff. Social systems have begun infiltrating playtime.", effects: [{ type: "development", key: "socialComfort", delta: 2 }, { type: "development", key: "emotionalRegulation", delta: 2 }] },
      { id: "finish", label: "Say you want to finish first", result: "You keep the toy a little longer, then hand it over. Boundaries and sharing manage an uneasy but functional treaty.", effects: [{ type: "development", key: "autonomy", delta: 2 }, { type: "development", key: "confidence", delta: 1 }] },
      { id: "refuse", label: "Refuse to share", result: "The other child is unhappy. You remain in possession of the object and discover that possession does not automatically produce peace.", effects: [{ type: "personality", key: "independence", delta: 2 }, { type: "development", key: "socialComfort", delta: -1 }] },
    ],
  },
  {
    id: "preschool_helping", category: "Home", min: 42, max: 59, weight: 1, once: true,
    title: "A small job in the house",
    body: "An adult gives you a tiny household job that is genuinely useful rather than merely decorative.",
    prompt: "How do you take it?",
    choices: [
      { id: "serious", label: "Take the job very seriously", result: "The task receives far more concentration than its complexity deserves. Being trusted with something real feels important.", effects: [{ type: "development", key: "confidence", delta: 2 }, { type: "development", key: "persistence", delta: 2 }] },
      { id: "play", label: "Turn it into a game", result: "The work gets done through a process no efficiency expert would approve of, but morale is excellent.", effects: [{ type: "interest", key: "making", delta: 2 }, { type: "health", key: "stress", delta: -1 }] },
      { id: "wander", label: "Get distracted halfway through", result: "The job is abandoned when another object suddenly becomes more urgent to investigate.", effects: [{ type: "personality", key: "curiosity", delta: 2 }, { type: "development", key: "persistence", delta: -1 }] },
    ],
  },
  {
    id: "preschool_small_mistake", category: "Self", min: 48, max: 59, weight: 1.1, once: true,
    title: "You broke something small",
    body: "While playing, you accidentally break something inexpensive but unmistakably not supposed to be broken. No adult saw it happen.",
    prompt: "What do you do?",
    choices: [
      { id: "tell", label: "Tell an adult what happened", result: "You expect the confession to feel worse than hiding it. Instead, the difficult part is over surprisingly quickly.", effects: [{ type: "development", key: "confidence", delta: 2 }, { type: "relationship", target: "guardian", key: "trust", delta: 3 }] },
      { id: "fix", label: "Try to fix it first", result: "Your repair is ambitious and structurally unconvincing, but the attempt itself teaches you something.", effects: [{ type: "development", key: "autonomy", delta: 2 }, { type: "interest", key: "making", delta: 2 }] },
      { id: "hide", label: "Put it somewhere nobody will notice", result: "For a while the object is hidden. Unfortunately, knowing where it is means the problem follows you around internally.", effects: [{ type: "health", key: "stress", delta: 2 }, { type: "personality", key: "sensitivity", delta: 1 }] },
    ],
  },
];

function nextEarlyRandom(state) {
  state.earlyChildhoodRngState ||= (((Number(state.seed) || 1) ^ 0x4a37b91d) >>> 0) || 1;
  state.earlyChildhoodRngState = (state.earlyChildhoodRngState * 1664525 + 1013904223) >>> 0;
  return state.earlyChildhoodRngState / 4294967296;
}

function ensureEarlyState(state) {
  state.earlyChildhoodVariety ||= { activeEventId: null, seen: [], recent: [] };
  state.earlyChildhoodVariety.seen ||= [];
  state.earlyChildhoodVariety.recent ||= [];
  return state.earlyChildhoodVariety;
}

function earlyRequirements(event, state) {
  const age = state.character?.ageMonths || 0;
  if (age < event.min || age > event.max) return false;
  if (event.once && state.history?.some((entry) => entry.eventId === event.id)) return false;
  if (event.hasSibling && !(state.people || []).some((p) => p.role === "sibling" && !p.deceased && (p.introducedAtMonths || 0) <= age)) return false;
  if (event.hasSecondGuardian && !(state.people || []).some((p) => p.role === "secondGuardian" && !p.deceased && (p.introducedAtMonths || 0) <= age)) return false;
  return true;
}

function chooseEarlyEvent(state) {
  const age = state.character?.ageMonths || 0;
  if (age >= 60) return null;
  const early = ensureEarlyState(state);
  const eligible = EARLY_EVENTS.filter((event) => earlyRequirements(event, state));
  if (!eligible.length) return null;
  const fresh = eligible.filter((event) => !early.recent.includes(event.id));
  const pool = fresh.length ? fresh : eligible;
  const weighted = pool.map((event) => ({ event, weight: event.weight || 1 }));
  const total = weighted.reduce((sum, item) => sum + item.weight, 0);
  let roll = nextEarlyRandom(state) * total;
  for (const item of weighted) {
    roll -= item.weight;
    if (roll <= 0) return item.event;
  }
  return weighted[weighted.length - 1].event;
}

function activeEarlyEvent(state) {
  const early = ensureEarlyState(state);
  let event = EARLY_EVENTS.find((item) => item.id === early.activeEventId && earlyRequirements(item, state));
  if (!event) {
    event = chooseEarlyEvent(state);
    early.activeEventId = event?.id || null;
  }
  return event || null;
}

function targetPerson(state, target) {
  return (state.people || []).find((person) => person.role === target && !person.deceased) || null;
}

function adjust(object, key, delta) {
  if (!object || typeof object[key] !== "number") return;
  object[key] = clamp(object[key] + delta);
}

function applyEarlyEffect(state, effect) {
  if (!effect) return;
  if (effect.type === "personality") adjust(state.character?.personality, effect.key, effect.delta);
  else if (effect.type === "development") adjust(state.character?.development, effect.key, effect.delta);
  else if (effect.type === "health") adjust(state.health, effect.key, effect.delta);
  else if (effect.type === "interest") adjust(state.interests, effect.key, effect.delta);
  else if (effect.type === "education") adjust(state.education?.subjects, effect.key, effect.delta);
  else if (effect.type === "relationship") {
    const person = targetPerson(state, effect.target);
    adjust(person, effect.key, effect.delta);
    if (person) person.lastInteractionAtMonths = state.character?.ageMonths || 0;
  }
}

function resolveEarlyChoice(state, event, choice) {
  for (const effect of choice.effects || []) applyEarlyEffect(state, effect);
  state.history ||= [];
  state.history.push({
    ageMonths: state.character?.ageMonths || 0,
    date: { ...(state.date || {}) },
    eventId: event.id,
    title: event.title,
    choiceId: choice.id,
    choice: choice.label,
    result: choice.result,
    continuity: "Early experiences quietly shape later patterns.",
  });
  state.history = state.history.slice(-320);
  if (choice.memory?.importance >= 2) {
    state.memories ||= [];
    state.memories.push({
      id: `${event.id}-${state.history.length}`,
      age: Math.floor((state.character?.ageMonths || 0) / 12),
      ageMonths: state.character?.ageMonths || 0,
      title: choice.memory.title,
      copy: choice.memory.copy,
      importance: choice.memory.importance,
      featured: choice.memory.importance >= 4,
      sourceEventId: event.id,
      sourceChoiceId: choice.id,
    });
  }
  state.resolution = { choiceId: choice.id, result: choice.result, earlyEventId: event.id };
  if (state.health && typeof state.health.stress === "number") state.health.stress = clamp(state.health.stress - 1);
  return state;
}

function stableSchoolFriend(friend) {
  if (!friend || friend.role !== "friend") return false;
  const sameClass = friend.school?.currentClass !== false && !friend.school?.transferred;
  const healthyBond = (friend.trust ?? 50) >= 48 || (friend.closeness ?? 50) >= 54;
  return sameClass && healthyBond && (friend.conflict ?? 0) < 30;
}

function snapshotFriendCloseness(state) {
  return new Map((state.people || []).filter((p) => p.role === "friend").map((p) => [p.id, p.closeness]));
}

function restoreLegacySameClassDecay(state, before) {
  for (const friend of (state.people || []).filter((p) => p.role === "friend")) {
    const previous = before.get(friend.id);
    if (previous == null || !stableSchoolFriend(friend)) continue;
    if ((friend.closeness ?? previous) === previous - 1) friend.closeness = previous;
  }
}

export function createNewLife(seed = Date.now()) {
  const state = core.createNewLife(seed);
  ensureEarlyState(state);
  activeEarlyEvent(state);
  return state;
}

export function getCurrentEvent(state) {
  const earlyEvent = activeEarlyEvent(state);
  if (earlyEvent) return {
    id: earlyEvent.id,
    category: earlyEvent.category,
    title: earlyEvent.title,
    body: earlyEvent.body,
    prompt: earlyEvent.prompt,
    continuity: "Early experiences quietly shape later patterns.",
    choices: earlyEvent.choices.map(({ id, label, result }) => ({ id, label, result })),
  };
  return core.getCurrentEvent(state);
}

export function resolveChoice(state, choiceId) {
  if (!state?.resolution) {
    const earlyEvent = activeEarlyEvent(state);
    const choice = earlyEvent?.choices.find((item) => item.id === choiceId);
    if (earlyEvent && choice) return resolveEarlyChoice(state, earlyEvent, choice);
  }
  return core.resolveChoice(state, choiceId);
}

export function continueLife(state) {
  const early = ensureEarlyState(state);
  if (state.resolution?.earlyEventId) {
    const id = state.resolution.earlyEventId;
    if (!early.seen.includes(id)) early.seen.push(id);
    early.recent = [id, ...early.recent.filter((item) => item !== id)].slice(0, 6);
    early.activeEventId = null;
  }
  const before = snapshotFriendCloseness(state);
  const next = core.continueLife(state);
  restoreLegacySameClassDecay(next, before);
  if (!next.completed && (next.character?.ageMonths || 0) < 60) activeEarlyEvent(next);
  return next;
}

export { EARLY_EVENTS };
