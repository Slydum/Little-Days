import * as core from "./childhood-v8.js?v=1";
import { ensureHouseholdEconomy } from "./household-economy.js?v=1";

export * from "./childhood-v8.js?v=1";

const clamp = (value, min = 0, max = 100) => Math.max(min, Math.min(max, value));

const SCHOOL_TRENDS = [
  { id: "school_bag", minAge: 6, maxAge: 12, name: "boxy school bag", short: "bag", price: 1650, cheaper: 650, body: "A particular boxy school bag with a little front pocket has suddenly appeared everywhere. Several classmates have one, and people compare colors before class." },
  { id: "tumbler", minAge: 7, maxAge: 12, name: "insulated tumbler", short: "tumbler", price: 1250, cheaper: 420, body: "Large insulated tumblers have become a school thing. They sit on desks, get covered in stickers, and somehow now seem to be part water bottle and part personality." },
  { id: "white_sneakers", minAge: 7, maxAge: 12, name: "white sneakers", short: "shoes", price: 2200, cheaper: 900, body: "A clean white sneaker style is everywhere at school lately. You notice them in the hallway enough times that your own shoes suddenly feel much more noticeable too." },
  { id: "bag_charm", minAge: 6, maxAge: 11, name: "collectible bag charm", short: "bag charm", price: 780, cheaper: 260, body: "Small collectible charms are dangling from backpacks all over school. Kids trade stories about where they found theirs and which ones are hardest to get." },
  { id: "pencil_case", minAge: 6, maxAge: 10, name: "oversized pencil case", short: "pencil case", price: 620, cheaper: 220, body: "An oversized pencil case with lots of compartments is suddenly popular in class. It is objectively more storage than most pencils have ever requested, but that has not slowed anybody down." },
  { id: "digital_watch", minAge: 8, maxAge: 12, name: "digital watch", short: "watch", price: 1450, cheaper: 520, body: "A simple digital watch has become one of those things people keep showing each other between classes. Half the appeal seems to be pressing buttons nobody actually needs." },
  { id: "crossbody", minAge: 10, maxAge: 12, name: "mini crossbody bag", short: "crossbody bag", price: 1800, cheaper: 700, body: "A small crossbody bag has become popular with older kids at school. It carries very little, which apparently has not prevented it from becoming extremely important." },
  { id: "earbuds", minAge: 11, maxAge: 12, name: "wireless earbuds", short: "earbuds", price: 2600, cheaper: 950, body: "Wireless earbuds are showing up more often before and after class. People compare cases, battery life, and whether theirs are the real thing or a cheaper version." },
];

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

function roll(state, key) {
  return hash(`${Number(state.seed) || 1}:${key}`) / 4294967296;
}

function ageYears(state) {
  return Math.floor((state.character?.ageMonths || 0) / 12);
}

function guardianForTrend(state) {
  return (state.people || [])
    .filter((person) => ["guardian", "secondGuardian"].includes(person.role) && !person.deceased)
    .sort((a, b) => ((b.affection || 0) + (b.trust || 0)) - ((a.affection || 0) + (a.trust || 0)))[0] || null;
}

function ensureTrendState(state) {
  state.childhood ||= {};
  state.childhood.trends ||= {
    nextAtMonths: 78 + Math.floor(roll(state, "first-school-trend") * 13),
    active: null,
    seen: [],
    owned: [],
    wishlist: [],
  };
  const trends = state.childhood.trends;
  trends.seen ||= [];
  trends.owned ||= [];
  trends.wishlist ||= [];
  if (typeof trends.nextAtMonths !== "number") trends.nextAtMonths = 84;
  return trends;
}

function chooseTrend(state) {
  const trends = ensureTrendState(state);
  const age = ageYears(state);
  const eligible = SCHOOL_TRENDS.filter((item) => age >= item.minAge && age <= item.maxAge && !trends.seen.includes(item.id));
  if (!eligible.length) return null;
  const index = hash(`${state.seed}:${state.character.ageMonths}:${trends.seen.join(",")}`) % eligible.length;
  return eligible[index];
}

function askOutcome(state, trend, parent) {
  ensureHouseholdEconomy(state);
  const econ = state.household.economy || {};
  const disposable = Number(econ.monthlyDisposable) || 0;
  const savings = Number(state.household.savings) || 0;
  const band = state.household.financeBand;
  const budgetRoom = Math.max(0, disposable) + Math.max(0, savings / 18);
  const relationship = parent ? ((parent.affection || 55) + (parent.trust || 55)) / 2 : 50;
  const willingness = roll(state, `${trend.id}:parent-response`) + (relationship - 55) / 240;
  const exactEasy = budgetRoom >= trend.price * 2.3;
  const cheaperEasy = budgetRoom >= trend.cheaper * 2;

  if (band === "Comfortable" && exactEasy && willingness > 0.3) return "buy";
  if (band === "Getting by" && exactEasy && willingness > 0.64) return "buy";
  if (cheaperEasy && willingness > (band === "Tight" ? 0.72 : 0.34)) return "compromise";
  if (band !== "Tight" && willingness > 0.42) return "wait";
  return "deny";
}

function cheaperOutcome(state, trend) {
  ensureHouseholdEconomy(state);
  const disposable = Number(state.household.economy?.monthlyDisposable) || 0;
  const savings = Number(state.household.savings) || 0;
  const room = Math.max(0, disposable) + Math.max(0, savings / 20);
  if (room >= trend.cheaper * 1.7) return "buy";
  return state.household.financeBand === "Tight" ? "deny" : "wait";
}

function parentName(parent) {
  return String(parent?.name || "your parent").trim().split(/\s+/)[0] || "your parent";
}

function resultForAsk(state, trend, parent, outcome) {
  const first = parentName(parent);
  if (outcome === "buy") return `You ask ${first} for the ${trend.name}. They check the price, think about it, and agree. Getting the thing everyone has feels absurdly important for about five minutes, which is roughly how school trends operate.`;
  if (outcome === "compromise") return `You ask ${first}. They say the exact ${trend.name} costs too much for something you mostly want because everyone else has it, but they agree to a cheaper version. It is not identical, but it is yours.`;
  if (outcome === "wait") return `You ask ${first}. They do not say yes, but they do not dismiss you either. They tell you to wait until there is more room in the budget or a birthday gives everyone a socially acceptable excuse to spend money.`;
  return `You ask ${first}. They say no. There is not enough room in the household budget for the ${trend.name} right now, even if half the school seems to have collectively decided it is essential to survival.`;
}

function resultForCheaper(state, trend, parent, outcome) {
  const first = parentName(parent);
  if (outcome === "buy") return `You show ${first} a cheaper version instead. The price is easier to justify, and they agree. It is close enough that you stop thinking about the difference surprisingly quickly.`;
  if (outcome === "wait") return `${first} likes the cheaper option more, but still asks you to wait. Wanting something and being able to buy it have, rudely, remained separate concepts.`;
  return `${first} still says no. Even the cheaper version is not a sensible purchase for the household right now.`;
}

function activeTrendEvent(state) {
  const trends = ensureTrendState(state);
  const ageMonths = state.character?.ageMonths || 0;
  const school = state.childhood?.school;
  if (!school?.started || ageYears(state) < 6 || ageYears(state) > 12) return null;
  if (state.resolution?.childhoodEvent?.schoolTrendId) return state.resolution.childhoodEvent;
  if (!trends.active && ageMonths >= trends.nextAtMonths) {
    const trend = chooseTrend(state);
    if (trend) {
      const parent = guardianForTrend(state);
      trends.active = {
        id: trend.id,
        askOutcome: askOutcome(state, trend, parent),
        cheaperOutcome: cheaperOutcome(state, trend),
        parentId: parent?.id || null,
      };
    }
  }
  if (!trends.active) return null;
  const trend = SCHOOL_TRENDS.find((item) => item.id === trends.active.id);
  if (!trend) return null;
  const parent = (state.people || []).find((person) => person.id === trends.active.parentId) || guardianForTrend(state);
  const ask = trends.active.askOutcome;
  const cheap = trends.active.cheaperOutcome;
  const bought = ask === "buy" || ask === "compromise";

  return {
    id: `school_trend_${trend.id}_${ageMonths}`,
    category: "School",
    title: trend.id === "school_bag" ? "Everyone has that bag" : `Everyone suddenly has a ${trend.short}`,
    body: `${trend.body} You start wondering what it would be like to have one too.`,
    prompt: "What do you do?",
    schoolTrendId: trend.id,
    schoolTrendPrice: trend.price,
    schoolTrendCheaperPrice: trend.cheaper,
    schoolTrendAskOutcome: ask,
    schoolTrendCheaperOutcome: cheap,
    schoolTrendParentId: parent?.id || null,
    choices: [
      {
        id: "ask_parent",
        label: `Ask for the ${trend.short}`,
        result: resultForAsk(state, trend, parent, ask),
        effects: [
          { type: "development", key: "socialComfort", delta: bought ? 1 : 0 },
          { type: "relationship", targetId: parent?.id || null, key: "closeness", delta: 1 },
        ],
      },
      {
        id: "ask_cheaper",
        label: "Ask for a cheaper version",
        result: resultForCheaper(state, trend, parent, cheap),
        effects: [
          { type: "development", key: "autonomy", delta: 1 },
          { type: "personality", key: "structure", delta: 1 },
        ],
      },
      {
        id: "save_for_it",
        label: "Offer to save toward it",
        result: `You decide to save toward it instead of expecting an immediate yes. The trend may still be fashionable by the time you have enough money. Human civilization offers no warranty on this.`,
        effects: [
          { type: "development", key: "persistence", delta: 2 },
          { type: "development", key: "autonomy", delta: 1 },
          { type: "personality", key: "structure", delta: 1 },
        ],
      },
      {
        id: "let_it_go",
        label: "Decide you don't need it",
        result: `You still notice the ${trend.short}s around school, but the feeling passes. Not owning the current object of collective obsession turns out to be survivable.`,
        effects: [
          { type: "development", key: "confidence", delta: 1 },
          { type: "personality", key: "independence", delta: 2 },
        ],
      },
    ],
  };
}

function spendOnTrend(state, amount) {
  ensureHouseholdEconomy(state);
  const econ = state.household.economy;
  const price = Math.max(0, Number(amount) || 0);
  econ.recentDiscretionarySpending = (econ.recentDiscretionarySpending || 0) + price;
  const savingsHit = Math.min(state.household.savings || 0, Math.round(price * 0.35));
  state.household.savings = Math.max(0, (state.household.savings || 0) - savingsHit);
}

function addOwned(trends, id, version) {
  if (!trends.owned.some((item) => item.id === id)) trends.owned.push({ id, version });
}

function commitTrend(state, event, choice) {
  const trends = ensureTrendState(state);
  const trend = SCHOOL_TRENDS.find((item) => item.id === event.schoolTrendId);
  if (!trend) return state;

  if (choice.id === "ask_parent") {
    if (event.schoolTrendAskOutcome === "buy") {
      spendOnTrend(state, trend.price);
      addOwned(trends, trend.id, "popular");
    } else if (event.schoolTrendAskOutcome === "compromise") {
      spendOnTrend(state, trend.cheaper);
      addOwned(trends, trend.id, "cheaper");
    } else if (event.schoolTrendAskOutcome === "wait") {
      if (!trends.wishlist.includes(trend.id)) trends.wishlist.push(trend.id);
    }
  } else if (choice.id === "ask_cheaper") {
    if (event.schoolTrendCheaperOutcome === "buy") {
      spendOnTrend(state, trend.cheaper);
      addOwned(trends, trend.id, "cheaper");
    } else if (!trends.wishlist.includes(trend.id)) trends.wishlist.push(trend.id);
  } else if (choice.id === "save_for_it") {
    if (!trends.wishlist.includes(trend.id)) trends.wishlist.push(trend.id);
    state.money ||= { savings: 0 };
    state.money.savingsGoal = { kind: "school-trend", itemId: trend.id, target: trend.cheaper };
  }

  trends.seen.push(trend.id);
  trends.seen = [...new Set(trends.seen)].slice(-12);
  trends.active = null;
  trends.nextAtMonths = (state.character?.ageMonths || 0) + 18 + Math.floor(roll(state, `${trend.id}:next`) * 13);
  state.worldEvents ||= [];
  state.worldEvents.push({
    category: "School",
    text: `The ${trend.name} trend becomes part of the small social economy of school for a while.`,
    importance: 1,
    ageMonths: state.character?.ageMonths || 0,
    date: state.date ? { ...state.date } : null,
    source: "school-trend",
  });
  state.worldEvents = state.worldEvents.slice(-100);
  return state;
}

export function ensureChildhoodState(state) {
  const next = core.ensureChildhoodState(state);
  ensureTrendState(next);
  return next;
}

export function advanceChildhoodWorld(state, elapsedMonths = 0, beforeAgeMonths = null) {
  const next = core.advanceChildhoodWorld(state, elapsedMonths, beforeAgeMonths);
  ensureTrendState(next);
  return next;
}

export function childhoodEventForState(state) {
  ensureChildhoodState(state);
  const trend = activeTrendEvent(state);
  const ordinary = core.childhoodEventForState(state);
  if (!trend) return ordinary;
  if (ordinary?.childhoodDepthKind === "interaction" || ordinary?.childhoodDepthKind === "little-moment") return ordinary;
  return trend;
}

export function commitChildhoodEvent(state, event, choice) {
  if (event?.schoolTrendId) return commitTrend(state, event, choice);
  return core.commitChildhoodEvent(state, event, choice);
}

export function socialSnapshot(state) {
  ensureChildhoodState(state);
  return core.socialSnapshot(state);
}

export function schoolWorldSnapshot(state) {
  ensureChildhoodState(state);
  return core.schoolWorldSnapshot(state);
}
