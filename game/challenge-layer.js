const clamp = (value, min = 0, max = 100) => Math.max(min, Math.min(max, value));

function ageMonths(state) {
  return state.character?.ageMonths || 0;
}

function nextRandom(state) {
  state.challenge.rngState = (state.challenge.rngState * 1664525 + 1013904223) >>> 0;
  return state.challenge.rngState / 4294967296;
}

function between(state, min, max) {
  return Math.round(min + nextRandom(state) * (max - min));
}

function pick(state, items) {
  return items[Math.floor(nextRandom(state) * items.length)];
}

function school(state) {
  return state.childhood?.school || null;
}

function visibleFriends(state) {
  const age = ageMonths(state);
  return (state.people || []).filter((person) =>
    person.role === "friend"
    && !person.deceased
    && (person.introducedAtMonths || 0) <= age
    && person.school?.friendshipStatus !== "former");
}

function closestFriend(state) {
  return [...visibleFriends(state)]
    .sort((a, b) => ((b.closeness || 0) + (b.trust || 0)) - ((a.closeness || 0) + (a.trust || 0)))[0] || null;
}

function caregiver(state) {
  return (state.people || []).find((person) => person.family?.caregiver && !person.deceased)
    || (state.people || []).find((person) => ["guardian", "secondGuardian"].includes(person.role) && !person.deceased)
    || null;
}

function firstName(person, fallback = "someone") {
  return person?.name?.split(" ")[0] || fallback;
}

function queueChallenge(state, item) {
  if (!state.challenge || !item?.key) return;
  if (state.challenge.seen.includes(item.key) || state.challenge.queue.some((queued) => queued.key === item.key)) return;
  state.challenge.queue.push({ priority: 50, createdAtMonths: ageMonths(state), ...item });
  state.challenge.queue.sort((a, b) => (b.priority || 0) - (a.priority || 0) || (a.createdAtMonths || 0) - (b.createdAtMonths || 0));
  state.challenge.queue = state.challenge.queue.slice(0, 8);
}

function academicScore(state) {
  const currentSchool = school(state);
  if (typeof currentSchool?.overallPerformance === "number") return currentSchool.overallPerformance;
  const values = Object.values(state.education?.subjects || {}).filter((value) => typeof value === "number");
  return values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : 50;
}

function friendshipScore(state) {
  const friend = closestFriend(state);
  return friend ? clamp(Math.round(((friend.closeness || 0) + (friend.trust || 0)) / 2)) : 20;
}

function independenceScore(state) {
  return state.character?.development?.autonomy ?? 50;
}

function progressForGoal(state, goal) {
  if (goal.domain === "school") return academicScore(state);
  if (goal.domain === "friendship") return friendshipScore(state);
  if (goal.domain === "independence") return independenceScore(state);
  return 0;
}

function nextBirthdayMonths(state) {
  const current = ageMonths(state);
  return Math.min(156, Math.max(60, (Math.floor(current / 12) + 1) * 12));
}

function createGoals(state) {
  const months = ageMonths(state);
  if (months < 60 || months >= 156) return [];
  const years = Math.floor(months / 12);
  const deadlineMonths = nextBirthdayMonths(state);
  const goals = [
    {
      id: `school-${deadlineMonths}`,
      domain: "school",
      label: years >= 10 ? "Stay academically ready for the next stage" : "Keep up with school this year",
      target: years >= 10 ? 68 : 63,
      deadlineMonths,
    },
    {
      id: `friendship-${deadlineMonths}`,
      domain: "friendship",
      label: "Keep at least one friendship genuinely close",
      target: years >= 10 ? 64 : 58,
      deadlineMonths,
    },
  ];
  if (years >= 9) {
    goals.push({
      id: `independence-${deadlineMonths}`,
      domain: "independence",
      label: "Become more capable without doing everything alone",
      target: years >= 11 ? 64 : 58,
      deadlineMonths,
    });
  }
  return goals;
}

function recordGoalResult(state, goal, progress, success) {
  state.challenge.goalHistory.push({
    id: goal.id,
    domain: goal.domain,
    label: goal.label,
    target: goal.target,
    progress,
    success,
    ageMonths: ageMonths(state),
  });
  state.challenge.goalHistory = state.challenge.goalHistory.slice(-18);

  const text = success
    ? `You reached a personal goal: ${goal.label.toLowerCase()}.`
    : `You missed a personal goal: ${goal.label.toLowerCase()}. Life kept moving, but the miss changed what came next.`;
  state.worldEvents ||= [];
  state.worldEvents.push({
    category: goal.domain === "school" ? "School" : "Self",
    text,
    note: text,
    ageMonths: ageMonths(state),
    date: { ...state.date },
    source: "challenge-goal",
  });
  state.worldEvents = state.worldEvents.slice(-100);

  if (success) {
    if (goal.domain === "school") state.character.development.confidence = clamp((state.character.development.confidence || 50) + 2);
    if (goal.domain === "friendship" && state.childhood) state.childhood.socialConfidence = clamp((state.childhood.socialConfidence || 50) + 2);
    if (goal.domain === "independence") state.character.development.autonomy = clamp((state.character.development.autonomy || 50) + 2);
  } else {
    state.health.stress = clamp((state.health.stress || 0) + 4);
    if (goal.domain === "school") state.character.development.confidence = clamp((state.character.development.confidence || 50) - 3);
    if (goal.domain === "friendship" && state.childhood) state.childhood.socialConfidence = clamp((state.childhood.socialConfidence || 50) - 3);
    if (goal.domain === "independence") state.character.development.autonomy = clamp((state.character.development.autonomy || 50) - 2);
  }
}

function refreshGoals(state) {
  if (ageMonths(state) < 60) {
    state.challenge.goals = [];
    return;
  }
  const due = (state.challenge.goals || []).filter((goal) => ageMonths(state) >= goal.deadlineMonths);
  if (due.length) {
    for (const goal of due) {
      const progress = progressForGoal(state, goal);
      recordGoalResult(state, goal, progress, progress >= goal.target);
    }
    state.challenge.goals = [];
  }
  if (!state.challenge.goals.length && ageMonths(state) < 156) state.challenge.goals = createGoals(state);
}

function startArc(state, arc) {
  if (state.challenge.arcs.some((item) => item.id === arc.id && item.status !== "complete")) return;
  state.challenge.arcs.push({ status: "active", stage: 1, startedAtMonths: ageMonths(state), ...arc });
  state.challenge.arcs = state.challenge.arcs.slice(-10);
}

function completeArc(state, id) {
  const arc = state.challenge.arcs.find((item) => item.id === id && item.status === "active");
  if (arc) arc.status = "complete";
}

function queueDueArcFollowups(state) {
  for (const arc of state.challenge.arcs || []) {
    if (arc.status !== "active" || arc.followupQueued || ageMonths(state) < (arc.dueAtMonths || 99999)) continue;
    if (arc.type === "friend-uncertainty") {
      queueChallenge(state, {
        key: `${arc.id}:reveal`,
        type: "friend_reveal",
        priority: 78,
        arcId: arc.id,
        personId: arc.personId,
        data: { reason: arc.reason, openingChoice: arc.openingChoice },
      });
      arc.followupQueued = true;
    }
    if (arc.type === "family-squeeze") {
      queueChallenge(state, {
        key: `${arc.id}:followup`,
        type: "family_squeeze_followup",
        priority: 80,
        arcId: arc.id,
        data: { openingChoice: arc.openingChoice },
      });
      arc.followupQueued = true;
    }
  }
}

function schedulerPool(state) {
  const months = ageMonths(state);
  const hasFriend = visibleFriends(state).length > 0;
  const pool = [];

  if (hasFriend) pool.push("competing_demands", "friend_uncertainty");
  if (months >= 84) pool.push("project_pressure");
  if (state.household?.financeBand !== "Comfortable") pool.push("school_cost", "school_cost");
  if (months >= 84 && !state.challenge.seen.some((key) => key.startsWith("family_squeeze_start:"))) pool.push("family_squeeze_start");
  if (!pool.length) pool.push("school_cost");
  return pool;
}

function scheduleNextChallenge(state) {
  const current = ageMonths(state);
  if (current < 60 || current >= 156 || state.challenge.queue.length) return;
  if (current < (state.challenge.nextChallengeAtMonths || 60)) return;
  const type = pick(state, schedulerPool(state));
  const serial = state.challenge.serial++;
  queueChallenge(state, { key: `${type}:${current}:${serial}`, type, priority: type.includes("squeeze") ? 72 : 56 });
  state.challenge.lastQueuedAtMonths = current;
  state.challenge.nextChallengeAtMonths = current + between(state, 4, 8);
}

export function ensureChallengeState(state) {
  if (!state?.character) return state;
  const seed = ((Number(state.seed) || 1) ^ 0x5f3759df) >>> 0;
  state.challenge ||= {
    version: 1,
    rngState: seed || 1,
    capacity: 6,
    maxCapacity: 6,
    queue: [],
    seen: [],
    arcs: [],
    goals: [],
    goalHistory: [],
    lastQueuedAtMonths: -120,
    nextChallengeAtMonths: 60,
    serial: 1,
  };
  state.challenge.rngState ||= seed || 1;
  state.challenge.maxCapacity ||= 6;
  state.challenge.capacity = clamp(state.challenge.capacity ?? state.challenge.maxCapacity, 0, state.challenge.maxCapacity);
  state.challenge.queue ||= [];
  state.challenge.seen ||= [];
  state.challenge.arcs ||= [];
  state.challenge.goals ||= [];
  state.challenge.goalHistory ||= [];
  state.challenge.serial ||= 1;
  refreshGoals(state);
  queueDueArcFollowups(state);
  scheduleNextChallenge(state);
  return state;
}

function riskChance(state, choice, person = null) {
  if (choice.chance == null) return null;
  let chance = choice.chance;
  const currentSchool = school(state);
  if (choice.risk === "academic") {
    chance += (academicScore(state) - 55) * 0.004;
    chance += ((state.character?.development?.persistence ?? 50) - 50) * 0.0025;
    chance += ((state.health?.energy ?? 60) - 60) * 0.002;
    chance -= Math.max(0, (state.health?.stress ?? 25) - 35) * 0.0025;
    chance += ((currentSchool?.teacherSupport ?? 55) - 55) * 0.0015;
  }
  if (choice.risk === "social") {
    chance += (((person?.trust ?? 50) - 50) + ((person?.closeness ?? 50) - 50)) * 0.0025;
    chance += ((state.childhood?.socialConfidence ?? 50) - 50) * 0.002;
    chance -= Math.max(0, (state.health?.stress ?? 25) - 35) * 0.002;
  }
  if (choice.risk === "mixed") {
    chance += (academicScore(state) - 55) * 0.002;
    chance += ((state.childhood?.socialConfidence ?? 50) - 50) * 0.0015;
    chance += ((state.health?.energy ?? 60) - 60) * 0.0015;
  }
  return clamp(chance, 0.18, 0.88);
}

function riskWord(chance) {
  if (chance == null) return "Certain cost";
  if (chance >= 0.72) return "Likely";
  if (chance >= 0.5) return "Uncertain";
  return "Risky";
}

function decorateChoices(state, event, person = null) {
  const available = state.challenge.capacity;
  return {
    ...event,
    contextKind: "challenge",
    choices: event.choices.map((choice) => {
      const chance = riskChance(state, choice, person);
      const cost = Math.max(0, choice.cost || 0);
      const disabled = cost > available || Boolean(choice.requiresSavings && (state.household?.savings || 0) < choice.requiresSavings);
      const parts = [cost ? `${cost} capacity` : "Preserves capacity"];
      if (chance != null) parts.push(riskWord(chance));
      if (choice.tradeoff) parts.push(choice.tradeoff);
      if (disabled) parts.push(cost > available ? `Need ${cost} capacity` : "Household cannot afford this");
      return { ...choice, chance, disabled, hint: parts.join(" · ") };
    }),
  };
}

function competingDemandsEvent(state, item) {
  const friend = closestFriend(state);
  const name = firstName(friend, "your friend");
  return decorateChoices(state, {
    id: `challenge_competing_${item.key}`,
    category: "School",
    title: "Two things need you at the same time",
    body: `You have an important school assessment tomorrow. ${name} is having a miserable day and asks if you can stay with them after school. You have enough energy to do one thing properly, or try to split yourself between both.`,
    prompt: "What gets your limited attention?",
    challengeQueueKey: item.key,
    challengeType: item.type,
    challengePersonId: friend?.id || null,
    choices: [
      {
        id: "study", label: "Go home and study", cost: 2, chance: 0.78, risk: "academic", tradeoff: `${name} may feel abandoned`,
        result: "You protect your preparation, but the friendship absorbs the cost of not being there.",
        successResult: "The studying pays off and you feel prepared when the assessment arrives.",
        failureResult: "You studied, but the assessment still goes badly enough to sting.",
        effects: [{ type: "relationship", targetId: friend?.id, key: "closeness", delta: -4 }],
        successEffects: [{ type: "school", key: "overallPerformance", delta: 4 }],
        failureEffects: [{ type: "health", key: "stress", delta: 3 }],
      },
      {
        id: "friend", label: `Stay with ${name}`, cost: 2, chance: 0.72, risk: "social", tradeoff: "School preparation suffers",
        result: "You choose the person in front of you and accept that tomorrow may be harder.",
        successResult: `${name} remembers that you showed up when they needed somebody.`,
        failureResult: `You stay, but ${name} is too upset to really connect and you still lose the study time.`,
        effects: [{ type: "school", key: "overallPerformance", delta: -3 }],
        successEffects: [{ type: "relationship", targetId: friend?.id, key: "trust", delta: 7 }],
        failureEffects: [{ type: "health", key: "stress", delta: 2 }],
      },
      {
        id: "split", label: "Try to do both", cost: 3, chance: 0.52, risk: "mixed", tradeoff: "Failure can hit both sides",
        result: "You divide the afternoon and hope competence can be manufactured from scheduling. Humanity keeps trying this despite the evidence.",
        successResult: "You manage enough study and enough time with your friend that neither part collapses.",
        failureResult: "You end the day rushed, underprepared, and not fully present with your friend either.",
        successEffects: [{ type: "school", key: "overallPerformance", delta: 2 }, { type: "relationship", targetId: friend?.id, key: "trust", delta: 3 }],
        failureEffects: [{ type: "school", key: "overallPerformance", delta: -2 }, { type: "relationship", targetId: friend?.id, key: "closeness", delta: -2 }, { type: "health", key: "stress", delta: 4 }],
      },
    ],
  }, friend);
}

function projectPressureEvent(state, item) {
  return decorateChoices(state, {
    id: `challenge_project_${item.key}`,
    category: "School",
    title: "The group project is becoming your problem",
    body: "Two classmates have barely done their parts. The deadline is close. You can carry more of the project, risk confronting them, or submit your own part and let the group grade land where it lands.",
    prompt: "How much do you take on?",
    challengeQueueKey: item.key,
    challengeType: item.type,
    choices: [
      {
        id: "carry", label: "Do the missing work yourself", cost: 3, chance: 0.76, risk: "academic", tradeoff: "Protects grade, drains you",
        result: "You take on work that was never supposed to be yours.",
        successResult: "The project holds together, and the grade is safer because you carried it.",
        failureResult: "You exhaust yourself and still cannot fully rescue the project.",
        successEffects: [{ type: "school", key: "overallPerformance", delta: 4 }, { type: "development", key: "persistence", delta: 1 }],
        failureEffects: [{ type: "health", key: "energy", delta: -5 }, { type: "health", key: "stress", delta: 4 }],
      },
      {
        id: "confront", label: "Tell them they need to finish their parts", cost: 2, chance: 0.56, risk: "mixed", tradeoff: "May create conflict",
        result: "You stop quietly absorbing the problem and make the responsibility visible.",
        successResult: "The confrontation is awkward, but enough work gets done to make the project genuinely shared again.",
        failureResult: "They become defensive. The work is still late, and now the group atmosphere is worse too.",
        successEffects: [{ type: "school", key: "overallPerformance", delta: 2 }, { type: "development", key: "confidence", delta: 2 }],
        failureEffects: [{ type: "health", key: "stress", delta: 3 }],
      },
      {
        id: "own", label: "Finish only your part", cost: 1, chance: 0.62, risk: "academic", tradeoff: "Keeps your energy, risks the grade",
        result: "You refuse to become the unpaid emergency department for the whole group.",
        successResult: "Your teacher notices who actually did what, limiting the damage to you.",
        failureResult: "The group grade falls, and individual effort does not protect you as much as you hoped.",
        successEffects: [{ type: "health", key: "energy", delta: 2 }],
        failureEffects: [{ type: "school", key: "overallPerformance", delta: -4 }],
      },
    ],
  });
}

function schoolCostEvent(state, item) {
  const amount = state.household?.financeBand === "Tight" ? 1800 : 1200;
  return decorateChoices(state, {
    id: `challenge_cost_${item.key}`,
    category: "Money",
    title: "School suddenly costs money",
    body: `Your class has an activity that costs ₱${amount.toLocaleString("en-PH")}. You want to join. The fee is not impossible for your household, but it is large enough that paying it changes something else.`,
    prompt: "What do you do with wanting something your family has to pay for?",
    challengeQueueKey: item.key,
    challengeType: item.type,
    choices: [
      {
        id: "ask", label: "Ask your family to pay", cost: 1, chance: state.household?.financeBand === "Tight" ? 0.42 : 0.68, risk: "mixed", tradeoff: "Household savings take the hit",
        result: "You ask instead of deciding on their behalf.",
        successResult: "They find a way to pay, but the expense is real and the household feels it afterward.",
        failureResult: "They tell you no. Wanting it does not make the money appear, which is a rather rude property of money.",
        successEffects: [{ type: "householdSavings", delta: -amount }, { type: "school", key: "overallPerformance", delta: 1 }],
        failureEffects: [{ type: "health", key: "stress", delta: 2 }],
      },
      {
        id: "assistance", label: "Ask the school about assistance", cost: 2, chance: 0.6, risk: "mixed", tradeoff: "Costs pride, may save money",
        result: "You ask an adult whether there is another way to participate.",
        successResult: "There is a subsidy or alternative arrangement, and you get to join without the full fee.",
        failureResult: "There is no assistance available this time. At least you know instead of quietly assuming.",
        successEffects: [{ type: "development", key: "confidence", delta: 2 }, { type: "school", key: "teacherSupport", delta: 3 }],
        failureEffects: [{ type: "health", key: "stress", delta: 1 }],
      },
      {
        id: "skip", label: "Do not ask. Skip it.", cost: 0, tradeoff: "Protects household money, you miss out",
        result: "You quietly remove yourself from the activity before anyone has to tell you no.",
        effects: [{ type: "development", key: "confidence", delta: -1 }, { type: "health", key: "stress", delta: 1 }],
      },
    ],
  });
}

function friendUncertaintyEvent(state, item) {
  const friend = closestFriend(state);
  const name = firstName(friend, "your friend");
  return decorateChoices(state, {
    id: `challenge_friend_${item.key}`,
    category: "Friends",
    title: `${name} has been different lately`,
    body: `${name} answers normally when you talk, but they have stopped looking for you as often. You do not know whether they are upset with you, dealing with something else, or simply getting closer to other people.`,
    prompt: "You do not get to see their relationship meter. What do you do?",
    challengeQueueKey: item.key,
    challengeType: item.type,
    challengePersonId: friend?.id || null,
    choices: [
      {
        id: "ask", label: `Ask ${name} if something is wrong`, cost: 2, chance: 0.66, risk: "social", tradeoff: "Could feel intrusive",
        result: "You risk an awkward conversation instead of inventing an explanation in your head.",
        successResult: `${name} does not tell you everything, but they are relieved you noticed.`,
        failureResult: `${name} says they are fine and becomes a little guarded about being questioned.`,
        successEffects: [{ type: "relationship", targetId: friend?.id, key: "trust", delta: 4 }],
        failureEffects: [{ type: "relationship", targetId: friend?.id, key: "closeness", delta: -2 }],
      },
      {
        id: "space", label: "Give them some space", cost: 0, chance: 0.58, risk: "social", tradeoff: "May become real distance",
        result: "You decide not to force closeness just because uncertainty is uncomfortable.",
        successResult: `The space does not damage the friendship. ${name} keeps the door open.`,
        failureResult: "Neither of you reaches out much, and temporary distance begins becoming a habit.",
        successEffects: [{ type: "health", key: "stress", delta: -1 }],
        failureEffects: [{ type: "relationship", targetId: friend?.id, key: "closeness", delta: -4 }],
      },
      {
        id: "mirror", label: "Pull away too", cost: 0, tradeoff: "Protects pride, risks the friendship",
        result: "You decide not to be the person who cares more. It feels safer immediately and more complicated later.",
        effects: [{ type: "relationship", targetId: friend?.id, key: "closeness", delta: -5 }, { type: "health", key: "stress", delta: 2 }],
      },
    ],
  }, friend);
}

function friendRevealEvent(state, item) {
  const friend = (state.people || []).find((person) => person.id === item.personId) || closestFriend(state);
  const name = firstName(friend, "your friend");
  const reason = item.data?.reason || "home";
  const body = reason === "upset"
    ? `${name} finally admits that something you said weeks ago bothered them. They were waiting to see whether you would notice the distance.`
    : reason === "other-friends"
      ? `${name} has been spending more time with another group. They still like you. Their social world simply stopped revolving around one friendship.`
      : `${name} has been dealing with tension at home and did not know how to talk about it. The distance was real, but it was not actually about you.`;
  return decorateChoices(state, {
    id: `challenge_friend_reveal_${item.arcId}`,
    category: "Friends",
    title: "You finally learn what the distance meant",
    body,
    prompt: "What do you do now that you know more?",
    challengeQueueKey: item.key,
    challengeType: item.type,
    challengeArcId: item.arcId,
    challengePersonId: friend?.id || null,
    choices: [
      {
        id: "repair", label: reason === "upset" ? "Own your part and apologize" : `Make time for ${name}`, cost: 2, chance: 0.72, risk: "social", tradeoff: "Requires vulnerability",
        result: "You respond to the real problem instead of the version you had imagined.",
        successResult: "The friendship feels less automatic than before, but more honest.",
        failureResult: "The conversation helps less than you hoped. Repair takes more than one decent sentence.",
        successEffects: [{ type: "relationship", targetId: friend?.id, key: "trust", delta: 6 }, { type: "relationship", targetId: friend?.id, key: "closeness", delta: 3 }],
        failureEffects: [{ type: "health", key: "stress", delta: 2 }],
      },
      {
        id: "accept", label: "Accept that the friendship is changing", cost: 0, tradeoff: "Less closeness, less chasing",
        result: "You stop treating change as proof that something has gone wrong.",
        effects: [{ type: "development", key: "emotionalRegulation", delta: 2 }, { type: "relationship", targetId: friend?.id, key: "closeness", delta: -1 }],
      },
    ],
  }, friend);
}

function familySqueezeStartEvent(state, item) {
  const adult = caregiver(state);
  const name = firstName(adult, "your caregiver");
  return decorateChoices(state, {
    id: `challenge_family_squeeze_${item.key}`,
    category: "Family",
    title: "Money at home gets tighter",
    body: `${name}'s work hours have been cut. Nobody announces a family crisis, but small things start changing: fewer extras, more conversations that stop when you enter the room, more attention paid to prices.`,
    prompt: "How do you respond to a problem you cannot actually solve?",
    challengeQueueKey: item.key,
    challengeType: item.type,
    challengePersonId: adult?.id || null,
    choices: [
      {
        id: "ask", label: `Ask ${name} what is happening`, cost: 1, chance: 0.72, risk: "social", tradeoff: "You may hear things that worry you",
        result: "You ask for information instead of trying to reconstruct the household budget from whispers.",
        successResult: `${name} gives you an age-appropriate version of the truth. It is worrying, but less frightening than not knowing.`,
        failureResult: `${name} says not to worry about adult problems. The reassurance does not answer much.`,
        successEffects: [{ type: "relationship", targetId: adult?.id, key: "trust", delta: 3 }],
        failureEffects: [{ type: "health", key: "stress", delta: 2 }],
      },
      {
        id: "help", label: "Start cutting your own extras", cost: 1, tradeoff: "Helpful, but you may take on too much responsibility",
        result: "You start saying no to small things before anybody asks you to.",
        effects: [{ type: "development", key: "autonomy", delta: 2 }, { type: "health", key: "stress", delta: 2 }],
      },
      {
        id: "stay-out", label: "Try not to think about it", cost: 0, tradeoff: "Protects you now, uncertainty remains",
        result: "You let the adults handle the adult problem, although the atmosphere still reaches you.",
        effects: [{ type: "health", key: "stress", delta: 1 }],
      },
    ],
  }, adult);
}

function familySqueezeFollowupEvent(state, item) {
  const savings = state.household?.savings || 0;
  return decorateChoices(state, {
    id: `challenge_family_squeeze_followup_${item.arcId}`,
    category: "Home",
    title: "The tighter months are not over yet",
    body: `A household expense arrives at the wrong time. The adults can cover it, but the remaining savings are now about ₱${Math.max(0, Math.round(savings)).toLocaleString("en-PH")}. You also have something at school you have been hoping to ask for.`,
    prompt: "Do you still ask for the thing you want?",
    challengeQueueKey: item.key,
    challengeType: item.type,
    challengeArcId: item.arcId,
    choices: [
      {
        id: "ask", label: "Ask anyway", cost: 1, chance: 0.46, risk: "mixed", tradeoff: "You may hear no",
        result: "You decide that being part of a struggling household does not require becoming invisible inside it.",
        successResult: "The adults find a smaller way to make it work. You get some of what you wanted without pretending the cost is nothing.",
        failureResult: "The answer is no. It hurts, but at least the decision belongs to the adults instead of to your fear of asking.",
        successEffects: [{ type: "development", key: "confidence", delta: 2 }, { type: "householdSavings", delta: -700 }],
        failureEffects: [{ type: "health", key: "stress", delta: 1 }],
      },
      {
        id: "wait", label: "Decide it can wait", cost: 0, tradeoff: "Protects money, postpones what you wanted",
        result: "You choose not to add another expense right now. The choice is practical, but practicality is not the same thing as not caring.",
        effects: [{ type: "development", key: "emotionalRegulation", delta: 1 }],
      },
    ],
  });
}

function buildEvent(state, item) {
  if (!item) return null;
  if (item.type === "competing_demands") return competingDemandsEvent(state, item);
  if (item.type === "project_pressure") return projectPressureEvent(state, item);
  if (item.type === "school_cost") return schoolCostEvent(state, item);
  if (item.type === "friend_uncertainty") return friendUncertaintyEvent(state, item);
  if (item.type === "friend_reveal") return friendRevealEvent(state, item);
  if (item.type === "family_squeeze_start") return familySqueezeStartEvent(state, item);
  if (item.type === "family_squeeze_followup") return familySqueezeFollowupEvent(state, item);
  return null;
}

export function challengeEventForState(state) {
  ensureChallengeState(state);
  return buildEvent(state, state.challenge.queue[0]);
}

function adjust(target, key, delta) {
  if (!target || typeof target[key] !== "number") return;
  target[key] = clamp(target[key] + (delta || 0));
}

function applyEffect(state, effect) {
  if (!effect) return;
  if (effect.type === "health") adjust(state.health, effect.key, effect.delta);
  if (effect.type === "development") adjust(state.character?.development, effect.key, effect.delta);
  if (effect.type === "personality") adjust(state.character?.personality, effect.key, effect.delta);
  if (effect.type === "school") {
    const currentSchool = school(state);
    if (currentSchool && typeof currentSchool[effect.key] === "number") currentSchool[effect.key] = clamp(currentSchool[effect.key] + (effect.delta || 0));
  }
  if (effect.type === "householdSavings") state.household.savings = Math.max(0, (state.household.savings || 0) + (effect.delta || 0));
  if (effect.type === "relationship") {
    const person = (state.people || []).find((item) => item.id === effect.targetId);
    adjust(person, effect.key, effect.delta);
    if (person) person.lastInteractionAtMonths = ageMonths(state);
  }
}

function specialConsequences(state, event, choice) {
  if (event.challengeType === "friend_uncertainty") {
    const friend = (state.people || []).find((person) => person.id === event.challengePersonId);
    const reason = pick(state, ["home", "other-friends", "upset"]);
    startArc(state, {
      id: `friend-uncertainty:${friend?.id || "friend"}:${ageMonths(state)}`,
      type: "friend-uncertainty",
      personId: friend?.id || null,
      openingChoice: choice.id,
      reason,
      dueAtMonths: ageMonths(state) + between(state, 3, 6),
    });
  }
  if (event.challengeType === "friend_reveal" && event.challengeArcId) completeArc(state, event.challengeArcId);
  if (event.challengeType === "family_squeeze_start") {
    startArc(state, {
      id: `family-squeeze:${ageMonths(state)}`,
      type: "family-squeeze",
      openingChoice: choice.id,
      dueAtMonths: ageMonths(state) + between(state, 4, 8),
    });
    state.household.savings = Math.max(0, (state.household.savings || 0) - between(state, 900, 2400));
  }
  if (event.challengeType === "family_squeeze_followup" && event.challengeArcId) completeArc(state, event.challengeArcId);
}

export function resolveChallengeChoice(state, choiceId) {
  ensureChallengeState(state);
  if (state.resolution) return state;
  const event = challengeEventForState(state);
  if (!event) return state;
  const choice = event.choices.find((item) => item.id === choiceId);
  if (!choice || choice.disabled) return state;

  state.challenge.capacity = clamp(state.challenge.capacity - (choice.cost || 0), 0, state.challenge.maxCapacity);
  (choice.effects || []).forEach((effect) => applyEffect(state, effect));

  let succeeded = null;
  let result = choice.result;
  if (choice.chance != null) {
    succeeded = nextRandom(state) < choice.chance;
    if (succeeded) {
      (choice.successEffects || []).forEach((effect) => applyEffect(state, effect));
      result = choice.successResult || result;
    } else {
      (choice.failureEffects || []).forEach((effect) => applyEffect(state, effect));
      result = choice.failureResult || result;
    }
  }

  specialConsequences(state, event, choice);
  state.challenge.seen.push(event.challengeQueueKey);
  state.challenge.seen = state.challenge.seen.slice(-120);
  state.challenge.queue = state.challenge.queue.filter((item) => item.key !== event.challengeQueueKey);
  state.history ||= [];
  state.history.push({
    ageMonths: ageMonths(state),
    date: { ...state.date },
    eventId: event.id,
    title: event.title,
    choiceId: choice.id,
    choice: choice.label,
    result,
    continuity: "challenge-layer",
    challengeOutcome: succeeded,
  });
  state.resolution = {
    choiceId: choice.id,
    result,
    challengeOutcome: succeeded,
    challengeEventId: event.id,
    challengeEvent: event,
  };
  return state;
}

export function advanceChallengeWorld(state, elapsedMonths = 0) {
  ensureChallengeState(state);
  const energy = state.health?.energy ?? 60;
  const stress = state.health?.stress ?? 25;
  let recovery = energy >= 70 && stress <= 35 ? 3 : energy >= 45 && stress <= 55 ? 2 : 1;
  if (elapsedMonths <= 0) recovery = 0;
  state.challenge.capacity = clamp(state.challenge.capacity + recovery, 0, state.challenge.maxCapacity);
  if (state.challenge.capacity <= 1) {
    state.health.energy = clamp((state.health.energy || 0) - 2);
    state.health.stress = clamp((state.health.stress || 0) + 2);
  }
  refreshGoals(state);
  queueDueArcFollowups(state);
  scheduleNextChallenge(state);

  if (ageMonths(state) >= 156 && !state.challenge.completedGoals) {
    for (const goal of state.challenge.goals || []) {
      const progress = progressForGoal(state, goal);
      recordGoalResult(state, goal, progress, progress >= goal.target);
    }
    state.challenge.goals = [];
    state.challenge.completedGoals = true;
  }
  return state;
}

export function challengeSnapshot(state) {
  ensureChallengeState(state);
  return {
    capacity: state.challenge.capacity,
    maxCapacity: state.challenge.maxCapacity,
    goals: (state.challenge.goals || []).map((goal) => {
      const progress = progressForGoal(state, goal);
      return {
        ...goal,
        progress,
        status: progress >= goal.target ? "On track" : progress >= goal.target - 8 ? "Close" : "At risk",
        deadlineAge: Math.floor(goal.deadlineMonths / 12),
      };
    }),
    activeArcs: (state.challenge.arcs || []).filter((arc) => arc.status === "active").length,
  };
}
