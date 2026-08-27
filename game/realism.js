const clamp = (value, min = 0, max = 100) => Math.max(min, Math.min(max, value));

function seeded(seed) {
  let value = seed >>> 0;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 4294967296;
  };
}

function between(rng, min, max) {
  return Math.round(min + rng() * (max - min));
}

function pick(rng, items) {
  return items[Math.floor(rng() * items.length)];
}

function rand(state) {
  state.realismRngState = (state.realismRngState * 1664525 + 1013904223) >>> 0;
  return state.realismRngState / 4294967296;
}

function personByRole(state, role) {
  return (state.people || []).find((person) => person.role === role && !person.deceased) || null;
}

function guardians(state) {
  return (state.people || []).filter((person) => ["guardian", "secondGuardian"].includes(person.role) && !person.deceased);
}

function healthcareAccess(financeBand, rng) {
  const base = financeBand === "Comfortable" ? 79 : financeBand === "Getting by" ? 60 : 39;
  return clamp(base + between(rng, -11, 11), 18, 94);
}

function congenitalCondition(rng) {
  if (rng() >= 0.018) return null;
  return pick(rng, [
    { id: "hearing", label: "hearing impairment", knownAtBirth: false, discoveryAt: between(rng, 8, 36) },
    { id: "vision", label: "visual impairment", knownAtBirth: false, discoveryAt: between(rng, 18, 54) },
    { id: "heart", label: "congenital heart condition", knownAtBirth: true, discoveryAt: 0 },
    { id: "motor", label: "motor disability", knownAtBirth: false, discoveryAt: between(rng, 8, 30) },
    { id: "developmental", label: "developmental condition", knownAtBirth: false, discoveryAt: between(rng, 24, 72) },
  ]);
}

function makeFamilyState(state, rng) {
  const adults = guardians(state);
  const primary = adults[0] || personByRole(state, "grandmother");
  return {
    atmosphere: between(rng, 54, 78),
    routineStability: between(rng, 50, 82),
    primaryCaregiverId: primary?.id || null,
    partnership: adults.length >= 2
      ? {
          status: "together",
          quality: between(rng, 48, 78),
          lowMonths: 0,
          separatedAtMonths: null,
        }
      : null,
    pregnancy: null,
    births: 0,
    moves: 0,
    lastMoveAtMonths: -120,
    recent: [],
  };
}

function makeProfile(state, rng) {
  return {
    familyHistory: {
      cardiovascular: rng() < 0.2,
      diabetes: rng() < 0.18,
      mood: rng() < 0.14,
      addiction: rng() < 0.12,
      neurodevelopmental: rng() < 0.08,
    },
    constitution: between(rng, 42, 78),
    healthcareAccess: healthcareAccess(state.household.financeBand, rng),
    nutrition: clamp((state.household.financeBand === "Tight" ? 48 : state.household.financeBand === "Getting by" ? 65 : 78) + between(rng, -10, 10)),
    environment: clamp((state.household.comfort === "Basic" ? 55 : 72) + between(rng, -10, 10)),
    congenital: congenitalCondition(rng),
    congenitalKnown: false,
    active: [],
    chronic: [],
    disabilities: [],
    mental: {
      wellbeing: between(rng, 62, 82),
      symptoms: null,
      recognized: false,
      support: null,
    },
    family: makeFamilyState(state, rng),
    latest: [],
    birthday: null,
  };
}

function ensureNpc(state, person, rng) {
  person.npc ||= {};
  if (person.npc.realism) return;
  const guardian = ["guardian", "secondGuardian"].includes(person.role);
  const adult = guardian || person.role === "grandmother" || person.role === "teacher";
  const interests = ["cooking", "music", "sports", "gardening", "reading", "movies", "crafts", "games", "church", "cycling"];
  let issue = null;
  if (guardian && rng() < 0.025) {
    issue = { kind: pick(rng, ["alcohol", "gambling", "substances"]), severity: 1, months: between(rng, 1, 18), visible: false };
  }
  person.npc.realism = {
    health: adult ? between(rng, 58, 84) : between(rng, 68, 90),
    mental: between(rng, 52, 82),
    copingRisk: guardian ? clamp(between(rng, 5, 28) + (state.realism?.familyHistory?.addiction ? 12 : 0)) : between(rng, 2, 12),
    issue,
    employment: guardian
      ? {
          status: rng() < 0.08 ? "unemployed" : rng() < 0.12 ? "self-employed" : "employed",
          stability: between(rng, 42, 84),
          hours: between(rng, 32, 52),
        }
      : null,
    interest: pick(rng, interests),
    school: ["friend", "sibling"].includes(person.role) ? { confidence: between(rng, 42, 72), socialCircle: between(rng, 35, 68) } : null,
    major: null,
  };
}

export function ensureRealismState(state) {
  if (!state?.character || !state?.household) return state;
  const seed = ((Number(state.seed) || 1) ^ 0xa53c91e5) >>> 0;
  const rng = seeded(seed || 1);
  state.realismRngState ||= (seed ^ 0x6d2b79f5) >>> 0;
  state.realism ||= makeProfile(state, rng);
  state.realism.latest ||= [];
  state.realism.active ||= [];
  state.realism.chronic ||= [];
  state.realism.disabilities ||= [];
  state.realism.mental ||= { wellbeing: 70, symptoms: null, recognized: false, support: null };
  state.realism.family ||= makeFamilyState(state, rng);
  state.realism.family.recent ||= [];
  state.worldEvents ||= [];
  (state.people || []).forEach((person) => ensureNpc(state, person, rng));

  const congenital = state.realism.congenital;
  if (congenital?.knownAtBirth && !state.realism.congenitalKnown) {
    state.realism.congenitalKnown = true;
    state.realism.chronic.push({ id: congenital.id, label: congenital.label, since: 0, congenital: true });
  }
  return state;
}

function update(state, category, text, importance = 1, person = null) {
  const item = {
    category,
    text,
    importance,
    ageMonths: state.character.ageMonths,
    date: { ...state.date },
    personId: person?.id || null,
  };
  state.realism.latest.push(item);
  state.worldEvents.push({ ...item, note: text, source: "world" });
  state.worldEvents = state.worldEvents.slice(-60);
  state.realism.family.recent.push(item);
  state.realism.family.recent = state.realism.family.recent.slice(-12);
  if (person) {
    person.npc.currentThread = text;
    person.npc.lastChangedAtMonths = state.character.ageMonths;
  }
}

function discoverCongenital(state) {
  const condition = state.realism.congenital;
  if (!condition || state.realism.congenitalKnown || state.character.ageMonths < condition.discoveryAt) return;
  state.realism.congenitalKnown = true;
  state.realism.chronic.push({ id: condition.id, label: condition.label, since: state.character.ageMonths, congenital: true });
  update(state, "Health", `After a series of checkups, your family learns that you have a ${condition.label}. It becomes part of the practical reality of growing up, not the whole story of who you are.`, 4);
}

function simulateEmployment(state, person, elapsedMonths) {
  const profile = person.npc.realism;
  const work = profile.employment;
  if (!work) return;
  const first = person.name.split(" ")[0];

  if (work.status === "employed" && rand(state) < (100 - work.stability) * 0.00018 * elapsedMonths) {
    work.status = "unemployed";
    state.household.financeBand = state.household.financeBand === "Comfortable" ? "Getting by" : "Tight";
    state.health.stress = clamp(state.health.stress + 5);
    update(state, "Family", `${first} lost their job. Money at home becomes more uncertain while the adults figure out what comes next.`, 4, person);
  } else if (work.status === "unemployed" && rand(state) < 0.055 * elapsedMonths) {
    work.status = "employed";
    work.stability = clamp(work.stability + 8);
    if (state.household.financeBand === "Tight" && rand(state) < 0.55) state.household.financeBand = "Getting by";
    update(state, "Family", `${first} found work. The household does not transform overnight, but there is a little more room to breathe.`, 3, person);
  }

  if (work.status === "employed" && rand(state) < 0.012 * elapsedMonths) {
    const oldHours = work.hours;
    work.hours = clamp(work.hours + Math.round((rand(state) - 0.45) * 10), 24, 65);
    if (work.hours - oldHours >= 6) update(state, "Family", `${first}'s job has started taking more of their time. They are home less often on workdays.`, 2, person);
  }
}

function simulateCoping(state, person, elapsedMonths) {
  const profile = person.npc.realism;
  const first = person.name.split(" ")[0];
  const stress = person.npc.outsideStress ?? 35;
  profile.mental = clamp(profile.mental + Math.round((rand(state) - 0.55) * 5) - (stress > 70 ? 2 : 0));

  if (!profile.issue) {
    const stressFactor = stress > 70 ? 2.4 : stress > 55 ? 1.5 : 0.8;
    if (rand(state) < (profile.copingRisk / 100) * 0.0015 * elapsedMonths * stressFactor) {
      profile.issue = { kind: pick(() => rand(state), ["alcohol", "gambling", "substances"]), severity: 1, months: 0, visible: false };
    }
    return;
  }

  const issue = profile.issue;
  issue.months += elapsedMonths;
  if (rand(state) < (stress > 65 ? 0.045 : 0.018) * elapsedMonths && issue.severity < 3) issue.severity += 1;
  else if (rand(state) < (profile.mental > 65 ? 0.035 : 0.012) * elapsedMonths && issue.severity > 1) issue.severity -= 1;

  if (!issue.visible && (issue.months >= 4 || issue.severity >= 2) && rand(state) < 0.45) {
    issue.visible = true;
    const text = issue.kind === "alcohol"
      ? `${first} has been drinking more often lately. The change is becoming noticeable at home.`
      : issue.kind === "gambling"
        ? `${first} has been spending more time and money gambling. It has started to affect the household.`
        : `${first} has been relying on substances more often. The adults around you are beginning to notice that something is wrong.`;
    update(state, "Family", text, 4, person);
  }

  if (issue.visible && issue.severity >= 2) {
    state.health.stress = clamp(state.health.stress + 2);
    state.household.savings = Math.max(0, (state.household.savings || 0) - Math.round(350 * elapsedMonths * issue.severity));
    state.realism.family.atmosphere = clamp(state.realism.family.atmosphere - issue.severity * 2);
    if (state.household.savings < 1500) state.household.financeBand = "Tight";
  }

  if (rand(state) < 0.008 * elapsedMonths * (issue.severity === 1 ? 2 : 1)) {
    profile.issue = null;
    if (issue.visible) update(state, "Family", `${first} has started getting help. Recovery is not perfectly straight, but home life is beginning to change.`, 4, person);
  }
}

function simulatePartnership(state, elapsedMonths) {
  const family = state.realism.family;
  const partnership = family.partnership;
  const adults = guardians(state);
  if (!partnership || adults.length < 2) return;

  const pressure = (state.household.financeBand === "Tight" ? 7 : 0)
    + adults.reduce((sum, person) => sum + ((person.npc.outsideStress ?? 35) > 65 ? 4 : 0) + (person.npc.realism?.issue?.visible ? person.npc.realism.issue.severity * 5 : 0), 0);
  const support = adults.reduce((sum, person) => sum + (person.trust > 68 ? 2 : 0) + (person.npc.realism?.mental > 68 ? 1 : 0), 0);

  partnership.quality = clamp(partnership.quality + Math.round((rand(state) - 0.5) * 6) - Math.round(pressure / 8) + support);
  family.atmosphere = clamp(family.atmosphere + Math.round((partnership.quality - 55) / 18) - Math.round(pressure / 12));

  if (partnership.status === "together") {
    partnership.lowMonths = partnership.quality < 30 ? partnership.lowMonths + elapsedMonths : Math.max(0, partnership.lowMonths - elapsedMonths);
    if (partnership.lowMonths >= 6 && rand(state) < 0.006 * elapsedMonths) {
      partnership.status = "separated";
      partnership.separatedAtMonths = state.character.ageMonths;
      family.atmosphere = clamp(family.atmosphere - 12);
      state.health.stress = clamp(state.health.stress + 9);
      update(state, "Family", `${adults[0].name.split(" ")[0]} and ${adults[1].name.split(" ")[0]} have decided to separate. The practical details are still being worked out, and home no longer feels arranged the same way.`, 5);
    }
  } else if (partnership.status === "separated") {
    if (partnership.quality > 58 && rand(state) < 0.0025 * elapsedMonths) {
      partnership.status = "together";
      partnership.lowMonths = 0;
      family.atmosphere = clamp(family.atmosphere + 8);
      update(state, "Family", `${adults[0].name.split(" ")[0]} and ${adults[1].name.split(" ")[0]} have decided to try living together again. Nobody pretends the difficult period did not happen.`, 4);
    } else if (rand(state) < 0.018 * elapsedMonths) {
      update(state, "Family", `Your parents are still figuring out a separate routine. Some days the handoffs feel ordinary; other days the tension is obvious.`, 2);
    }
  }
}

function makeSibling(state) {
  const firstNames = ["Mika", "Leo", "Nina", "Tala", "Enzo", "Gab", "Aya", "Noah"];
  const first = pick(() => rand(state), firstNames);
  const playerAgeYears = Math.floor(state.character.ageMonths / 12);
  const name = `${first} ${state.character.lastName}`;
  return {
    id: `sibling-${first.toLowerCase()}-${state.character.ageMonths}`,
    role: "sibling",
    name,
    age: -playerAgeYears,
    introducedAtMonths: state.character.ageMonths,
    closeness: 48,
    trust: 52,
    affection: 68,
    conflict: 4,
    familiarity: 20,
    lastInteractionAtMonths: state.character.ageMonths,
    history: [],
    npc: {
      outsideStress: 8,
      availability: 80,
      socialWorld: 10,
      currentThread: `${first} is still a newborn, and much of the household now revolves around feeding, sleeping, and being tired.`,
      lastChangedAtMonths: state.character.ageMonths,
    },
  };
}

function simulatePregnancy(state, elapsedMonths) {
  const family = state.realism.family;
  const adults = guardians(state);
  if (adults.length < 2 || family.partnership?.status === "separated" || state.character.ageMonths > 132 || family.births >= 2) return;

  if (!family.pregnancy) {
    const chance = state.character.ageMonths < 84 ? 0.0017 : 0.0011;
    if (rand(state) < chance * elapsedMonths) {
      family.pregnancy = { months: 1 };
      update(state, "Family", `Your family learns that a new baby is expected. The news brings excitement, worry, planning, and a sudden amount of conversation about space and money.`, 4);
    }
    return;
  }

  family.pregnancy.months += elapsedMonths;
  if (family.pregnancy.months >= 9) {
    const sibling = makeSibling(state);
    state.people.push(sibling);
    ensureNpc(state, sibling, seeded((state.seed ^ state.character.ageMonths ^ 0x8143) >>> 0));
    family.pregnancy = null;
    family.births += 1;
    family.atmosphere = clamp(family.atmosphere + 4);
    state.household.privacy = "Limited";
    update(state, "Family", `${sibling.name.split(" ")[0]} is born. Your household gains a person, a lot of noise, and a completely new set of routines.`, 5, sibling);
  }
}

function simulateCaregiving(state) {
  const family = state.realism.family;
  const candidates = [...guardians(state), personByRole(state, "grandmother")].filter(Boolean);
  if (!candidates.length) return;
  const ranked = candidates
    .map((person) => ({ person, score: (person.npc.availability ?? 60) + person.trust * 0.25 - (person.npc.outsideStress ?? 30) * 0.2 }))
    .sort((a, b) => b.score - a.score);
  const next = ranked[0].person;
  if (!family.primaryCaregiverId) {
    family.primaryCaregiverId = next.id;
    return;
  }
  if (family.primaryCaregiverId !== next.id && ranked[0].score - (ranked.find((item) => item.person.id === family.primaryCaregiverId)?.score ?? 0) > 10) {
    family.primaryCaregiverId = next.id;
    update(state, "Family", `${next.name.split(" ")[0]} has become the person handling more of your everyday care lately. Small routines begin to shift around their schedule.`, 3, next);
  }
}

function simulateMove(state, elapsedMonths) {
  const family = state.realism.family;
  if (state.character.ageMonths - family.lastMoveAtMonths < 18) return;
  const pressure = (state.household.financeBand === "Tight" ? 0.0028 : 0.0007)
    + (family.partnership?.status === "separated" ? 0.0022 : 0)
    + (state.household.privacy === "Limited" && family.births > 0 ? 0.0007 : 0);
  if (rand(state) >= pressure * elapsedMonths) return;

  family.moves += 1;
  family.lastMoveAtMonths = state.character.ageMonths;
  const downsize = state.household.financeBand === "Tight" || family.partnership?.status === "separated";
  const oldHousing = state.household.housing;
  state.household.housing = downsize ? pick(() => rand(state), ["Compact apartment", "Small rental house", "One-bedroom apartment"]) : pick(() => rand(state), ["Modest townhouse", "Two-bedroom apartment", "Small family house"]);
  state.household.privacy = state.household.housing.includes("One-bedroom") ? "Limited" : "Moderate";
  state.household.comfort = downsize ? "Basic" : state.household.comfort;
  update(state, "Home", `Your family moves from the ${oldHousing.toLowerCase()} to a ${state.household.housing.toLowerCase()}. The city is familiar, but the rooms, routes, and everyday sounds are different.`, 5);
}

function simulateYoungPeople(state, elapsedMonths) {
  const ageYears = Math.floor(state.character.ageMonths / 12);
  for (const person of state.people || []) {
    if (person.deceased || person.introducedAtMonths > state.character.ageMonths || !["friend", "sibling"].includes(person.role)) continue;
    const profile = person.npc.realism;
    if (!profile.school) continue;
    profile.school.confidence = clamp(profile.school.confidence + Math.round((rand(state) - 0.5) * 5));
    profile.school.socialCircle = clamp(profile.school.socialCircle + Math.round((rand(state) - 0.46) * 5));

    const personAge = Math.max(0, person.age + ageYears);
    const first = person.name.split(" ")[0];
    if (personAge >= 4 && rand(state) < 0.015 * elapsedMonths) {
      const nextInterest = pick(() => rand(state), ["drawing", "football", "music", "books", "games", "dance", "science", "making things"]);
      if (nextInterest !== profile.interest) {
        profile.interest = nextInterest;
        update(state, person.role === "friend" ? "Friends" : "Family", `${first} has become very interested in ${nextInterest}. It has started taking up a noticeable amount of their attention.`, 2, person);
      }
    }
    if (person.role === "friend" && personAge >= 5 && rand(state) < 0.013 * elapsedMonths) {
      const direction = rand(state) < 0.55 ? 1 : -1;
      profile.school.socialCircle = clamp(profile.school.socialCircle + direction * 8);
      update(state, "Friends", direction > 0 ? `${first} has been making more friends at school. You are still part of their life, but you are not the only person in it.` : `${first} has been keeping to a smaller circle lately and seems more selective about who they spend time with.`, 2, person);
    }
  }
}

function treatmentDelay(state) {
  return clamp((state.household.financeBand === "Tight" ? 0.24 : state.household.financeBand === "Getting by" ? 0.08 : 0.02) + (55 - state.realism.healthcareAccess) / 180, 0.01, 0.5);
}

function addIllness(state, severity) {
  const label = severity >= 3
    ? (rand(state) < 0.5 ? "serious respiratory infection" : "severe infection")
    : (rand(state) < 0.55 ? "respiratory infection" : "stomach illness");
  const illness = {
    id: `ill-${state.character.ageMonths}-${Math.floor(rand(state) * 99999)}`,
    label,
    severity,
    months: 0,
    delayed: rand(state) < treatmentDelay(state),
  };
  state.realism.active.push(illness);
  if (severity >= 3) update(state, "Health", `You become seriously ill with a ${label}. Your family is frightened enough that the illness changes the rhythm of the household.`, 5);
  else update(state, "Health", `You get sick enough that your usual routine stops for a while.`, 2);
  if (illness.delayed && severity >= 2) update(state, "Money", `Your family waits longer than they would like before getting medical care. Cost and practical access are part of the reason.`, 4);
}

function lastingConsequence(state) {
  const consequence = pick(() => rand(state), [
    { id: "hearing-acquired", label: "lasting hearing loss", kind: "disability" },
    { id: "mobility-acquired", label: "a lasting mobility impairment", kind: "disability" },
    { id: "respiratory-acquired", label: "a chronic respiratory condition", kind: "chronic" },
  ]);
  if (consequence.kind === "chronic") state.realism.chronic.push({ ...consequence, since: state.character.ageMonths });
  else state.realism.disabilities.push({ ...consequence, since: state.character.ageMonths });
  state.health.wellbeing = clamp(state.health.wellbeing - 8);
  update(state, "Health", `You recover, but not exactly to where you were before. The illness leaves you with ${consequence.label}. Your family begins learning what needs to change and what does not.`, 5);
}

function die(state, cause) {
  state.death = { ageMonths: state.character.ageMonths, date: { ...state.date }, cause };
  state.completed = true;
  state.currentEventId = null;
  state.resolution = null;
  update(state, "Health", `Your condition became too severe for your body to recover from.`, 5);
}

function simulatePhysicalHealth(state, elapsedMonths) {
  if (state.death) return;
  const realism = state.realism;
  const age = Math.floor(state.character.ageMonths / 12);
  const vulnerability = clamp((65 - realism.constitution) / 100 + (55 - realism.nutrition) / 180 + (55 - realism.environment) / 220, -0.1, 0.7);

  if (!realism.active.length) {
    const moderateChance = clamp((0.018 + Math.max(0, vulnerability) * 0.018) * elapsedMonths, 0.01, 0.22);
    const severeChance = clamp((0.00035 + Math.max(0, vulnerability) * 0.00055) * elapsedMonths * (age < 2 ? 1.45 : 1), 0.0002, 0.015);
    const roll = rand(state);
    if (roll < severeChance) addIllness(state, 3);
    else if (roll < severeChance + moderateChance) addIllness(state, 2);
  }

  const remaining = [];
  for (const illness of realism.active) {
    illness.months += elapsedMonths;
    const care = illness.delayed ? realism.healthcareAccess - 20 : realism.healthcareAccess;
    const recoveryChance = clamp((illness.severity === 2 ? 0.55 : 0.2) + (realism.constitution - 55) / 180 + (care - 50) / 220, 0.08, 0.9);
    if (rand(state) < recoveryChance) {
      if (illness.severity >= 3) update(state, "Health", `After a frightening stretch of illness, you begin to recover.`, 4);
      state.health.wellbeing = clamp(state.health.wellbeing + 3);
      continue;
    }
    if (illness.severity === 2 && rand(state) < 0.12 * elapsedMonths) {
      illness.severity = 3;
      update(state, "Health", `The illness gets worse instead of better. Your family seeks more help as your condition becomes serious.`, 5);
    }
    if (illness.severity >= 3) {
      const delayFactor = illness.delayed ? 1.9 : 1;
      if (rand(state) < 0.008 * elapsedMonths * delayFactor * (1 + Math.max(0, vulnerability))) lastingConsequence(state);
      if (rand(state) < 0.00055 * elapsedMonths * delayFactor * (1 + Math.max(0, vulnerability) * 1.8)) {
        die(state, illness.label);
        return;
      }
    }
    remaining.push(illness);
  }
  realism.active = remaining;
}

function adversity(state) {
  let amount = state.household.financeBand === "Tight" ? 12 : state.household.financeBand === "Getting by" ? 4 : 0;
  for (const person of guardians(state)) {
    const profile = person.npc.realism;
    if (profile?.issue?.visible) amount += profile.issue.severity * 9;
    if ((person.npc.outsideStress ?? 0) > 70) amount += 7;
    if (profile?.employment?.status === "unemployed") amount += 8;
  }
  if (state.realism.family.partnership?.status === "separated") amount += 8;
  return amount;
}

function simulateMentalHealth(state, elapsedMonths) {
  if (state.death || state.character.ageMonths < 72) return;
  const mental = state.realism.mental;
  const friend = personByRole(state, "friend");
  const attachment = state.character.development?.attachment ?? 55;
  const protection = (attachment > 68 ? 4 : 0) + (friend?.closeness > 70 ? 4 : 0) + (state.realism.family.atmosphere > 70 ? 3 : 0);
  const pressure = adversity(state) + Math.max(0, state.health.stress - 45) * 0.35;
  mental.wellbeing = clamp(mental.wellbeing + Math.round((rand(state) - 0.48) * 5 - pressure / 18 + protection / 3));

  if (!mental.symptoms && mental.wellbeing < 40 && rand(state) < 0.045 * elapsedMonths) {
    mental.symptoms = { kind: rand(state) < 0.58 ? "anxiety" : "low mood", months: 0 };
    mental.recognized = false;
    state.health.stress = clamp(state.health.stress + 5);
    update(state, "Health", mental.symptoms.kind === "anxiety" ? `Worry has started showing up more often, even when you cannot always explain what it is attached to.` : `For a while now, things that usually interest you have felt flatter and harder to reach.`, 4);
  }
  if (!mental.symptoms) return;

  mental.symptoms.months += elapsedMonths;
  if (!mental.recognized && mental.symptoms.months >= 4 && guardians(state).some((person) => (person.npc.availability ?? 60) > 55) && rand(state) < 0.18 * elapsedMonths) {
    mental.recognized = true;
    update(state, "Family", `An adult who knows you well notices that you have not seemed like yourself lately. What you are feeling is finally spoken about.`, 4);
  }
  if (mental.recognized && !mental.support && rand(state) < (state.realism.healthcareAccess / 100) * 0.08 * elapsedMonths) {
    mental.support = "counseling";
    update(state, "Health", `You begin getting support for how you have been feeling. It does not make everything disappear, but you are no longer carrying it alone.`, 4);
  }
  if (rand(state) < (mental.support ? 0.16 : 0.07) * elapsedMonths) {
    mental.wellbeing = clamp(mental.wellbeing + 10);
    if (mental.wellbeing > 58) {
      mental.symptoms = null;
      mental.recognized = false;
      mental.support = null;
      update(state, "Health", `Your emotional health has been steadier lately. Difficult feelings have not vanished, but they are taking up less of the room.`, 2);
    }
  }
}

function simulateOtherPeopleHealth(state, elapsedMonths) {
  const playerAge = Math.floor(state.character.ageMonths / 12);
  for (const person of state.people || []) {
    if (person.deceased || person.introducedAtMonths > state.character.ageMonths || !["guardian", "secondGuardian", "grandmother", "sibling"].includes(person.role)) continue;
    const profile = person.npc.realism;
    const age = Math.max(0, person.age + playerAge);
    if (!profile.major) {
      const chance = (age >= 70 ? 0.003 : age >= 55 ? 0.0012 : age >= 35 ? 0.00035 : 0.00012) * elapsedMonths;
      if (rand(state) < chance) {
        profile.major = { months: 0, severity: rand(state) < 0.2 ? 3 : 2 };
        update(state, "Family", `${person.name.split(" ")[0]} has developed a health problem that now requires more appointments and rest than before.`, 4, person);
      }
    } else {
      profile.major.months += elapsedMonths;
      if (rand(state) < (age < 65 ? 0.09 : 0.045) * elapsedMonths) {
        profile.major = null;
        update(state, "Family", `${person.name.split(" ")[0]}'s health has improved enough that family life is beginning to feel more normal again.`, 3, person);
      } else if (profile.major.severity >= 3 && rand(state) < (age >= 80 ? 0.007 : age >= 70 ? 0.003 : 0.00035) * elapsedMonths) {
        person.deceased = true;
        person.diedAtAge = age;
        state.health.stress = clamp(state.health.stress + 14);
        state.realism.family.atmosphere = clamp(state.realism.family.atmosphere - 10);
        update(state, "Family", `${person.name.split(" ")[0]} died after a period of poor health. Their absence changes routines that had once seemed permanent.`, 5, person);
      }
    }
  }
}

function simulateHousehold(state, elapsedMonths) {
  for (const person of guardians(state)) {
    simulateEmployment(state, person, elapsedMonths);
    simulateCoping(state, person, elapsedMonths);
  }
  simulatePartnership(state, elapsedMonths);
  simulatePregnancy(state, elapsedMonths);
  simulateCaregiving(state);
  simulateMove(state, elapsedMonths);
  simulateYoungPeople(state, elapsedMonths);

  const family = state.realism.family;
  const adultStress = guardians(state).reduce((sum, person) => sum + (person.npc.outsideStress ?? 35), 0) / Math.max(1, guardians(state).length);
  family.routineStability = clamp(family.routineStability + Math.round((rand(state) - 0.5) * 5) - (adultStress > 65 ? 2 : 0));
  if (family.atmosphere > 72) state.character.development.attachment = clamp((state.character.development.attachment ?? 55) + 0.6);
  if (family.atmosphere < 36) state.health.stress = clamp(state.health.stress + 1);
}

function birthdayRecap(state, beforeAgeMonths) {
  const oldAge = Math.floor(beforeAgeMonths / 12);
  const newAge = Math.floor(state.character.ageMonths / 12);
  if (newAge <= oldAge || newAge <= 0) return null;
  const seen = new Set();
  const items = state.worldEvents
    .filter((event) => event.ageMonths > Math.max(0, state.character.ageMonths - 12))
    .sort((a, b) => (b.importance || 0) - (a.importance || 0))
    .map((event) => event.text || event.note)
    .filter((text) => text && !seen.has(text) && seen.add(text))
    .slice(0, 5);
  if (!items.length) items.push(`Most of the year passed in ordinary routines, which is how a surprising amount of childhood is actually made.`);
  return { age: newAge, items };
}

export function advanceRealism(state, elapsedMonths, beforeAgeMonths) {
  ensureRealismState(state);
  if (!elapsedMonths || elapsedMonths < 0) return state;
  state.realism.latest = [];
  state.realism.birthday = null;

  discoverCongenital(state);
  simulateHousehold(state, elapsedMonths);
  simulatePhysicalHealth(state, elapsedMonths);
  if (!state.death) {
    simulateMentalHealth(state, elapsedMonths);
    simulateOtherPeopleHealth(state, elapsedMonths);
  }

  state.realism.healthcareAccess = clamp(state.realism.healthcareAccess + (state.household.financeBand === "Tight" ? -1 : state.household.financeBand === "Comfortable" ? 1 : 0));
  state.realism.latest = state.realism.latest.sort((a, b) => b.importance - a.importance).slice(0, 5);
  state.realism.birthday = birthdayRecap(state, beforeAgeMonths ?? Math.max(0, state.character.ageMonths - elapsedMonths));
  return state;
}

export function getAroundYou(state) {
  ensureRealismState(state);
  return state.realism.latest || [];
}

export function getBirthdayRecap(state) {
  ensureRealismState(state);
  return state.realism.birthday;
}

export function healthSnapshot(state) {
  ensureRealismState(state);
  const realism = state.realism;
  const known = [...realism.chronic.map((item) => item.label), ...realism.disabilities.map((item) => item.label)];
  const active = realism.active[0]?.label || null;
  const mental = realism.mental;
  let emotional = "No major emotional-health concern has been recognized.";
  if (mental.symptoms && !mental.recognized) emotional = mental.symptoms.kind === "anxiety" ? "You have been dealing with more worry than usual, though nobody has put a formal name to it." : "Your mood has been lower for a while, though nobody has put a formal name to it.";
  if (mental.symptoms && mental.recognized) emotional = mental.support ? "People around you have noticed you are struggling, and you are receiving support." : "People around you have noticed that you are struggling emotionally.";
  return {
    physical: active ? `You are currently dealing with a ${active}.` : known.length ? `Your health includes ${known.join(", ")}.` : "No lasting physical condition is currently known.",
    known,
    active,
    emotional,
    care: realism.healthcareAccess >= 72 ? "Good access" : realism.healthcareAccess >= 52 ? "Usually accessible" : realism.healthcareAccess >= 36 ? "Sometimes difficult" : "Limited",
    disabilities: realism.disabilities,
  };
}

export function deathSummary(state) {
  ensureRealismState(state);
  const ageMonths = state.death?.ageMonths ?? state.character.ageMonths;
  const years = Math.floor(ageMonths / 12);
  const months = ageMonths % 12;
  const age = years ? `${years} year${years === 1 ? "" : "s"}${months ? ` and ${months} month${months === 1 ? "" : "s"}` : ""}` : `${months} month${months === 1 ? "" : "s"}`;
  const closest = [...(state.people || [])].filter((person) => person.introducedAtMonths <= ageMonths).sort((a, b) => (b.closeness || 0) - (a.closeness || 0))[0];
  const memories = (state.memories || []).slice(-2).map((memory) => memory.title.toLowerCase());
  const parts = [];
  if (closest) parts.push(`${closest.name} was one of the people closest to you.`);
  parts.push(memories.length ? `Your life already contained memories of ${memories.join(" and ")}.` : `Most of your life was made of ordinary routines, familiar rooms, and people learning who you were.`);
  return {
    title: `${state.character.firstName}'s life`,
    copy: `You lived for ${age}. ${parts.join(" ")} There is no score for a life ending early. It was still a life that happened to other people, and to you.`,
    cause: state.death?.cause || "illness",
  };
}
