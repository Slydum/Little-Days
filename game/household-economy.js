const clamp = (value, min = 0, max = 100) => Math.max(min, Math.min(max, value));

const OCCUPATIONS = [
  { id: "service", title: "Service crew", base: 16500, ceiling: 27000, growth: 0.035, education: "secondary" },
  { id: "retail", title: "Retail associate", base: 19000, ceiling: 32000, growth: 0.04, education: "secondary" },
  { id: "driver", title: "Driver", base: 21000, ceiling: 35000, growth: 0.035, education: "secondary" },
  { id: "admin", title: "Administrative assistant", base: 24000, ceiling: 41000, growth: 0.045, education: "college" },
  { id: "bpo", title: "Customer support specialist", base: 29000, ceiling: 52000, growth: 0.055, education: "college" },
  { id: "technician", title: "Technician", base: 26000, ceiling: 47000, growth: 0.05, education: "technical" },
  { id: "teacher", title: "Teacher", base: 30000, ceiling: 52000, growth: 0.045, education: "college" },
  { id: "government", title: "Government employee", base: 31000, ceiling: 56000, growth: 0.045, education: "college" },
  { id: "nurse", title: "Nurse", base: 36000, ceiling: 65000, growth: 0.05, education: "college" },
  { id: "accounting", title: "Accounting staff", base: 34000, ceiling: 65000, growth: 0.055, education: "college" },
  { id: "sales", title: "Sales specialist", base: 26000, ceiling: 60000, growth: 0.06, education: "college" },
  { id: "engineer", title: "Engineer", base: 42000, ceiling: 85000, growth: 0.065, education: "college" },
  { id: "it", title: "IT specialist", base: 43000, ceiling: 95000, growth: 0.07, education: "college" },
  { id: "business", title: "Small business owner", base: 30000, ceiling: 90000, growth: 0.055, education: "mixed", selfEmployed: true },
];

const CITY_FACTOR = {
  "Quezon City": 1.18,
  Imus: 0.94,
  "Iloilo City": 0.9,
  "Cebu City": 1.05,
  "Davao City": 0.94,
};

function hash(value) {
  const text = String(value ?? "");
  let h = 2166136261 >>> 0;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  h ^= h >>> 16;
  h = Math.imul(h, 0x7feb352d) >>> 0;
  h ^= h >>> 15;
  h = Math.imul(h, 0x846ca68b) >>> 0;
  return (h ^ (h >>> 16)) >>> 0;
}

function deterministic(seed, key) {
  return hash(`${Number(seed) || 1}:${key}`) / 4294967296;
}

function rand(state) {
  state.economyRngState ||= ((Number(state.seed) || 1) ^ 0x45d9f3b) >>> 0;
  state.economyRngState = (Math.imul(state.economyRngState, 1664525) + 1013904223) >>> 0;
  return state.economyRngState / 4294967296;
}

function guardians(state) {
  return (state.people || []).filter((person) => ["guardian", "secondGuardian"].includes(person.role) && !person.deceased);
}

function householdSize(state) {
  const living = (state.people || []).filter((person) => !person.deceased && person.family?.household === true).length;
  if (living > 0) return living + 1;
  return 1 + (state.people || []).filter((person) => !person.deceased && ["guardian", "secondGuardian", "sibling"].includes(person.role)).length;
}

function money(value) {
  return Math.max(0, Math.round(Number(value) || 0));
}

function monthlyHousingEstimate(state, tenure = "Renting") {
  if (tenure === "Owned") return Math.round(1800 * (CITY_FACTOR[state.household.city] || 1));
  if (tenure === "Staying with relatives") return Math.round(3500 * (CITY_FACTOR[state.household.city] || 1));
  const label = String(state.household.housing || "").toLowerCase();
  let base = 14500;
  if (label.includes("one-bedroom")) base = 10500;
  else if (label.includes("compact")) base = 12500;
  else if (label.includes("two-bedroom apartment")) base = 15500;
  else if (label.includes("townhouse")) base = 18500;
  else if (label.includes("family house") || label.includes("two-bedroom house")) base = 20500;
  const factor = CITY_FACTOR[state.household.city] || 1;
  return Math.round(base * factor * (tenure === "Paying a mortgage" ? 1.06 : 1));
}

function homeValueEstimate(state) {
  const monthly = monthlyHousingEstimate(state, "Paying a mortgage");
  return Math.round(monthly * 150);
}

function employmentFor(person) {
  person.npc ||= {};
  person.npc.realism ||= {};
  person.npc.realism.employment ||= { status: "employed", stability: 60, hours: 40 };
  return person.npc.realism.employment;
}

function occupationForId(id) {
  return OCCUPATIONS.find((item) => item.id === id) || OCCUPATIONS[3];
}

function chooseOccupation(state, person, work) {
  if (work.status === "self-employed") return OCCUPATIONS.find((item) => item.selfEmployed);
  const roll = deterministic(state.seed, `${person.id}:occupation`);
  const age = Number(person.age) || 30;
  const weighted = age < 27
    ? OCCUPATIONS.filter((job) => !["engineer", "it", "nurse"].includes(job.id) || roll > 0.45)
    : OCCUPATIONS;
  return weighted[Math.floor(roll * weighted.length) % weighted.length];
}

function careerLevelFor(person, job, state) {
  const age = Math.max(18, Number(person.age) || 30);
  const careerYears = Math.max(0, age - (job.education === "college" ? 22 : job.education === "technical" ? 20 : 18));
  const noise = deterministic(state.seed, `${person.id}:level`);
  if (careerYears >= 12 && noise > 0.35) return 2;
  if (careerYears >= 5 && noise > 0.22) return 1;
  return 0;
}

function titleForLevel(job, level) {
  if (job.selfEmployed) return job.title;
  if (level >= 3) return `Senior ${job.title}`;
  if (level === 2 && ["service", "retail", "driver"].includes(job.id)) return `${job.title} supervisor`;
  if (level === 2) return `Senior ${job.title}`;
  if (level === 1 && ["engineer", "it", "accounting", "sales", "admin"].includes(job.id)) return job.title;
  return job.title;
}

function startingPay(state, person, job, level) {
  const cityFactor = CITY_FACTOR[state.household.city] || 1;
  const experienceFactor = 1 + level * 0.17;
  const noise = 0.9 + deterministic(state.seed, `${person.id}:pay`) * 0.22;
  return money(Math.min(job.ceiling * 1.25, job.base * cityFactor * experienceFactor * noise));
}

function ensureParentCareer(state, person) {
  const work = employmentFor(person);
  if (!work.occupationId) {
    const job = chooseOccupation(state, person, work);
    work.occupationId = job.id;
    work.level = careerLevelFor(person, job, state);
    work.title = titleForLevel(job, work.level);
    work.monthlyPay = work.status === "unemployed" ? 0 : startingPay(state, person, job, work.level);
    work.previousMonthlyPay = work.monthlyPay;
    work.experienceMonths = Math.max(0, ((Number(person.age) || 28) - (job.education === "college" ? 22 : 18)) * 12);
    work.lastReviewAtMonths = -Math.floor(deterministic(state.seed, `${person.id}:review`) * 12);
    work.lastCareerChangeAtMonths = -Math.floor(deterministic(state.seed, `${person.id}:change`) * 30);
    work.lastStatus = work.status;
    work.payHistory = [{ ageMonths: 0, title: work.title, monthlyPay: work.monthlyPay, reason: "starting state" }];
  }
  if (work.status === "unemployed") work.monthlyPay = 0;
  return work;
}

function pushUpdate(state, category, text, importance = 2, person = null) {
  const item = {
    category,
    text,
    importance,
    ageMonths: state.character?.ageMonths || 0,
    date: state.date ? { ...state.date } : null,
    personId: person?.id || null,
  };
  state.realism ||= {};
  state.realism.latest ||= [];
  state.worldEvents ||= [];
  state.realism.latest.push(item);
  state.realism.latest = state.realism.latest.sort((a, b) => (b.importance || 0) - (a.importance || 0)).slice(0, 8);
  state.worldEvents.push({ ...item, note: text, source: "household-economy" });
  state.worldEvents = state.worldEvents.slice(-100);
  if (person) {
    person.npc ||= {};
    person.npc.currentThread = text;
    person.npc.lastChangedAtMonths = state.character?.ageMonths || 0;
  }
}

function childAwareWorkText(state, person, action, detail = "") {
  const first = String(person.name || "Your parent").split(" ")[0];
  const age = Math.floor((state.character?.ageMonths || 0) / 12);
  if (action === "promotion") {
    return age < 7
      ? `${first} has a new title at work. You mostly notice that the adults seem pleased and keep talking about it.`
      : `${first} was promoted to ${detail}. Their pay goes up, along with some of the responsibility.`;
  }
  if (action === "raise") {
    return age < 9
      ? `${first}'s job is paying a little better now. At home, it shows up in small ways rather than suddenly changing everything.`
      : `${first} received a raise at work. The household has a little more room in the monthly budget.`;
  }
  if (action === "job-change") {
    return age < 8
      ? `${first} starts going to a different workplace. Their schedule and the rhythm at home take a while to settle.`
      : `${first} changes jobs and is now working as ${detail}. The new pay and schedule change the household budget a little.`;
  }
  return `${first}'s work situation changes.`;
}

function recordPay(work, state, reason) {
  work.payHistory ||= [];
  work.payHistory.push({
    ageMonths: state.character?.ageMonths || 0,
    title: work.title,
    monthlyPay: work.monthlyPay,
    reason,
  });
  work.payHistory = work.payHistory.slice(-20);
}

function handleStatusTransition(state, person, work) {
  if (work.lastStatus === work.status) return;
  const previous = work.lastStatus;
  work.lastStatus = work.status;
  if (work.status === "unemployed") {
    work.previousMonthlyPay = work.monthlyPay || work.previousMonthlyPay || 0;
    work.monthlyPay = 0;
    return;
  }
  if ((previous === "unemployed" || !work.monthlyPay) && ["employed", "self-employed"].includes(work.status)) {
    const oldJob = occupationForId(work.occupationId);
    const change = rand(state) < 0.48;
    const nextJob = change ? OCCUPATIONS[Math.floor(rand(state) * OCCUPATIONS.length)] : oldJob;
    work.occupationId = nextJob.id;
    work.title = titleForLevel(nextJob, work.level || 0);
    const oldPay = work.previousMonthlyPay || startingPay(state, person, nextJob, work.level || 0);
    work.monthlyPay = money(Math.max(startingPay(state, person, nextJob, work.level || 0), oldPay * (0.92 + rand(state) * 0.22)));
    work.lastCareerChangeAtMonths = state.character?.ageMonths || 0;
    recordPay(work, state, "returned to work");
  }
}

function simulateCareer(state, person, elapsedMonths) {
  const work = ensureParentCareer(state, person);
  handleStatusTransition(state, person, work);
  if (work.status === "unemployed") return;
  work.experienceMonths = (work.experienceMonths || 0) + elapsedMonths;
  const ageMonths = state.character?.ageMonths || 0;
  const job = occupationForId(work.occupationId);

  if (work.status === "self-employed") {
    const swing = 0.95 + rand(state) * 0.11;
    work.monthlyPay = money(clamp(work.monthlyPay * swing, job.base * 0.55, job.ceiling * 1.55));
  }

  if (ageMonths - (work.lastReviewAtMonths ?? -12) >= 12) {
    work.lastReviewAtMonths = ageMonths;
    const stability = work.stability ?? 60;
    const promotionChance = clamp(0.055 + (stability - 55) / 500 + Math.min(0.06, (work.experienceMonths || 0) / 6000), 0.035, 0.17);
    if (!job.selfEmployed && (work.level || 0) < 3 && rand(state) < promotionChance) {
      work.level = (work.level || 0) + 1;
      work.title = titleForLevel(job, work.level);
      const raise = 1.11 + rand(state) * 0.12;
      work.monthlyPay = money(Math.min(job.ceiling * 1.35, work.monthlyPay * raise));
      work.lastCareerChangeAtMonths = ageMonths;
      recordPay(work, state, "promotion");
      pushUpdate(state, "Family", childAwareWorkText(state, person, "promotion", work.title), 3, person);
    } else if (work.status === "employed") {
      const raise = 1.018 + rand(state) * (job.growth + 0.025);
      const old = work.monthlyPay;
      work.monthlyPay = money(Math.min(job.ceiling * 1.25, work.monthlyPay * raise));
      if (work.monthlyPay - old >= 900) {
        recordPay(work, state, "annual raise");
        if (rand(state) < 0.42) pushUpdate(state, "Money", childAwareWorkText(state, person, "raise"), 2, person);
      }
    }
  }

  if (work.status === "employed" && ageMonths - (work.lastCareerChangeAtMonths ?? -24) >= 18 && rand(state) < 0.0045 * elapsedMonths) {
    const oldPay = work.monthlyPay;
    const nextJob = OCCUPATIONS[Math.floor(rand(state) * OCCUPATIONS.length)];
    work.occupationId = nextJob.id;
    work.level = Math.max(0, Math.min(2, work.level || 0));
    work.title = titleForLevel(nextJob, work.level);
    work.monthlyPay = money(Math.max(startingPay(state, person, nextJob, work.level), oldPay * (0.97 + rand(state) * 0.2)));
    work.lastCareerChangeAtMonths = ageMonths;
    recordPay(work, state, "job change");
    pushUpdate(state, "Family", childAwareWorkText(state, person, "job-change", work.title), 3, person);
  }
}

function chooseInitialTenure(state) {
  const band = state.household.financeBand;
  const roll = deterministic(state.seed, "housing-tenure");
  if (band === "Comfortable") return roll < 0.5 ? "Paying a mortgage" : roll < 0.62 ? "Owned" : "Renting";
  if (band === "Getting by") return roll < 0.24 ? "Paying a mortgage" : roll < 0.33 ? "Staying with relatives" : "Renting";
  return roll < 0.08 ? "Paying a mortgage" : roll < 0.31 ? "Staying with relatives" : "Renting";
}

function bedroomsForHousing(label) {
  const text = String(label || "").toLowerCase();
  if (text.includes("one-bedroom")) return 1;
  if (text.includes("two-bedroom")) return 2;
  if (text.includes("townhouse") || text.includes("family house")) return 2;
  return 1;
}

function ensureHousingState(state) {
  const h = state.household;
  h.tenure ||= chooseInitialTenure(state);
  h.bedrooms ||= bedroomsForHousing(h.housing);
  h.monthlyHousingCost ||= monthlyHousingEstimate(state, h.tenure);
  h.homeValue ||= ["Owned", "Paying a mortgage"].includes(h.tenure) ? homeValueEstimate(state) : 0;
  h.mortgageBalance ??= h.tenure === "Paying a mortgage" ? Math.round(h.homeValue * (0.55 + deterministic(state.seed, "mortgage-balance") * 0.35)) : 0;
  h.moveHistory ||= [{
    ageMonths: 0,
    housing: h.housing,
    city: h.city,
    tenure: h.tenure,
    reason: "starting home",
  }];
  h.lastEconomyHousing = h.housing;
}

function essentialCosts(state) {
  const size = householdSize(state);
  const factor = CITY_FACTOR[state.household.city] || 1;
  const groceries = (5500 + Math.max(0, size - 2) * 2200) * factor;
  const utilities = (3200 + Math.max(0, size - 2) * 600) * factor;
  const transport = guardians(state).length * 2600 * factor;
  const schoolAndHealth = Math.floor((state.character?.ageMonths || 0) / 12) >= 5 ? 2600 : 1700;
  return money(groceries + utilities + transport + schoolAndHealth + (state.household.monthlyHousingCost || 0));
}

function syncFinanceBand(state) {
  const econ = state.household.economy;
  const income = econ.monthlyIncome;
  const costs = econ.monthlyEssentialCosts;
  const savings = state.household.savings || 0;
  const runway = costs > 0 ? savings / costs : 0;
  const ratio = costs > 0 ? income / costs : 0;
  let band = "Getting by";
  if (ratio < 1.04 || econ.debt > income * 2.2 || runway < 0.35) band = "Tight";
  else if (ratio >= 1.42 && runway >= 2) band = "Comfortable";
  state.household.financeBand = band;
  state.household.comfort = band === "Comfortable" ? "Comfortable" : band === "Tight" ? "Basic" : "Modest";
}

function updateBudget(state, elapsedMonths) {
  const econ = state.household.economy;
  econ.monthlyIncome = guardians(state).reduce((sum, person) => sum + (ensureParentCareer(state, person).monthlyPay || 0), 0);
  econ.monthlyEssentialCosts = essentialCosts(state);
  econ.monthlyDisposable = econ.monthlyIncome - econ.monthlyEssentialCosts;
  const net = econ.monthlyDisposable * elapsedMonths;
  if (net >= 0) {
    const saved = net * (state.household.financeBand === "Comfortable" ? 0.54 : 0.38);
    state.household.savings = money((state.household.savings || 0) + saved);
    if (econ.debt > 0) {
      const payment = Math.min(econ.debt, money(net * 0.22));
      econ.debt = money(econ.debt - payment);
    }
  } else {
    const shortage = Math.abs(net);
    const fromSavings = Math.min(state.household.savings || 0, shortage);
    state.household.savings = money((state.household.savings || 0) - fromSavings);
    econ.debt = money(econ.debt + Math.max(0, shortage - fromSavings));
  }
  syncFinanceBand(state);
}

function recordMove(state, reason) {
  const h = state.household;
  h.moveHistory ||= [];
  h.moveHistory.push({
    ageMonths: state.character?.ageMonths || 0,
    housing: h.housing,
    city: h.city,
    tenure: h.tenure,
    reason,
  });
  h.moveHistory = h.moveHistory.slice(-12);
  h.lastEconomyHousing = h.housing;
}

function syncCoreMove(state) {
  const h = state.household;
  if (h.lastEconomyHousing === h.housing) return;
  h.bedrooms = bedroomsForHousing(h.housing);
  if (h.tenure === "Owned") h.tenure = "Renting";
  if (h.tenure === "Paying a mortgage" && state.household.financeBand === "Tight") h.tenure = "Renting";
  h.monthlyHousingCost = monthlyHousingEstimate(state, h.tenure);
  h.homeValue = ["Owned", "Paying a mortgage"].includes(h.tenure) ? homeValueEstimate(state) : 0;
  h.mortgageBalance = h.tenure === "Paying a mortgage" ? Math.round(h.homeValue * 0.8) : 0;
  recordMove(state, "family move");
}

function maybeBuyHome(state, elapsedMonths) {
  const h = state.household;
  const econ = h.economy;
  if (!["Renting", "Staying with relatives"].includes(h.tenure)) return;
  const adults = guardians(state);
  if (!adults.length || adults.some((person) => ensureParentCareer(state, person).status === "unemployed")) return;
  const value = homeValueEstimate(state);
  const downPayment = Math.round(value * 0.1);
  if ((h.savings || 0) < downPayment * 1.35 || econ.monthlyDisposable < 9000) return;
  if (rand(state) >= 0.0032 * elapsedMonths) return;

  const old = h.housing;
  h.savings = money(h.savings - downPayment);
  h.tenure = "Paying a mortgage";
  h.housing = h.bedrooms <= 1 ? "Modest townhouse" : "Small family house";
  h.bedrooms = bedroomsForHousing(h.housing);
  h.homeValue = homeValueEstimate(state);
  h.mortgageBalance = money(h.homeValue - downPayment);
  h.monthlyHousingCost = monthlyHousingEstimate(state, h.tenure);
  recordMove(state, "bought a home");
  pushUpdate(state, "Home", `After saving for a long time, your family buys a home. You move from the ${old.toLowerCase()} into a ${h.housing.toLowerCase()}, and the adults now talk about a mortgage instead of rent.`, 5);
}

function maybeFinishMortgage(state, elapsedMonths) {
  const h = state.household;
  if (h.tenure !== "Paying a mortgage" || !h.mortgageBalance) return;
  const principal = Math.max(0, (h.monthlyHousingCost || 0) * 0.42 * elapsedMonths);
  h.mortgageBalance = money(h.mortgageBalance - principal);
  if (h.mortgageBalance > 0) return;
  h.tenure = "Owned";
  h.monthlyHousingCost = monthlyHousingEstimate(state, "Owned");
  pushUpdate(state, "Home", "Your family finishes paying off the home. The house is now owned outright, which changes the monthly budget more than the rooms themselves.", 5);
}

function maybePlannedMove(state, elapsedMonths) {
  const h = state.household;
  const ageMonths = state.character?.ageMonths || 0;
  const last = h.moveHistory?.[h.moveHistory.length - 1]?.ageMonths ?? -60;
  if (ageMonths - last < 24) return;
  const crowded = householdSize(state) > (h.bedrooms || 1) * 2 + 1;
  const improving = h.financeBand === "Comfortable" && h.economy.monthlyDisposable > 15000;
  if (!crowded && !improving) return;
  const chance = crowded ? 0.0028 : 0.0012;
  if (rand(state) >= chance * elapsedMonths) return;

  const old = h.housing;
  h.housing = crowded || improving ? "Small family house" : "Two-bedroom apartment";
  h.bedrooms = bedroomsForHousing(h.housing);
  if (h.tenure === "Renting") h.monthlyHousingCost = monthlyHousingEstimate(state, "Renting");
  else if (h.tenure === "Paying a mortgage") {
    h.homeValue = homeValueEstimate(state);
    h.mortgageBalance = Math.max(h.mortgageBalance || 0, Math.round(h.homeValue * 0.65));
    h.monthlyHousingCost = monthlyHousingEstimate(state, h.tenure);
  }
  recordMove(state, crowded ? "needed more space" : "household finances improved");
  pushUpdate(state, "Home", crowded
    ? `Your family moves from the ${old.toLowerCase()} because the household has started feeling too crowded. The new place has more room, but moving still disrupts everyone for a while.`
    : `With steadier finances, your family decides to move from the ${old.toLowerCase()} to a ${h.housing.toLowerCase()}. It is an upgrade, not a transformation into a different species of human.`, 4);
}

export function ensureHouseholdEconomy(state) {
  if (!state?.household || !state?.character) return state;
  state.money ||= { savings: 0 };
  ensureHousingState(state);
  for (const person of guardians(state)) ensureParentCareer(state, person);
  state.household.economy ||= {
    currency: "PHP",
    monthlyIncome: 0,
    monthlyEssentialCosts: 0,
    monthlyDisposable: 0,
    debt: state.household.financeBand === "Tight" ? money(deterministic(state.seed, "starting-debt") * 45000) : 0,
  };
  state.household.economy.currency ||= "PHP";
  state.household.economy.debt ||= 0;
  state.household.economy.monthlyIncome = guardians(state).reduce((sum, person) => sum + (ensureParentCareer(state, person).monthlyPay || 0), 0);
  state.household.economy.monthlyEssentialCosts = essentialCosts(state);
  state.household.economy.monthlyDisposable = state.household.economy.monthlyIncome - state.household.economy.monthlyEssentialCosts;
  syncFinanceBand(state);
  return state;
}

export function advanceHouseholdEconomy(state, elapsedMonths = 0) {
  ensureHouseholdEconomy(state);
  if (!elapsedMonths || state.death) return state;
  syncCoreMove(state);
  for (const person of guardians(state)) simulateCareer(state, person, elapsedMonths);
  updateBudget(state, elapsedMonths);
  maybeBuyHome(state, elapsedMonths);
  maybePlannedMove(state, elapsedMonths);
  maybeFinishMortgage(state, elapsedMonths);
  updateBudget(state, 0);
  return state;
}

export function parentEmploymentLabel(person) {
  const work = person?.npc?.realism?.employment;
  if (!work) return null;
  if (work.status === "unemployed") return "Currently unemployed";
  if (work.status === "self-employed") return work.title || "Self-employed";
  return work.title || "Employed";
}

export function parentPayLabel(person) {
  const work = person?.npc?.realism?.employment;
  if (!work || work.status === "unemployed") return work?.status === "unemployed" ? "No current salary" : null;
  return `₱${money(work.monthlyPay).toLocaleString("en-PH")}/month`;
}

export function householdMoneySnapshot(state) {
  ensureHouseholdEconomy(state);
  const econ = state.household.economy;
  return {
    tenure: state.household.tenure,
    housing: state.household.housing,
    bedrooms: state.household.bedrooms,
    monthlyHousingCost: state.household.monthlyHousingCost,
    monthlyIncome: econ.monthlyIncome,
    monthlyEssentialCosts: econ.monthlyEssentialCosts,
    monthlyDisposable: econ.monthlyDisposable,
    debt: econ.debt,
    savings: state.household.savings || 0,
    financeBand: state.household.financeBand,
  };
}
