const STORAGE_KEY = "little-days-save-v2";
const META_KEY = "little-days-enhancer-meta-v1";
const HONORIFICS = new Set(["Lola", "Lolo", "Auntie", "Uncle", "Tita", "Tito"]);

const ITEM_CATALOG = [
  { key: "blanket", name: "soft blanket", kind: "Comfort", minMonths: 0, maxMonths: 48 },
  { key: "plush", name: "plush rabbit", kind: "Toy", minMonths: 6, maxMonths: 84 },
  { key: "blocks", name: "building blocks", kind: "Toy", hobby: "making", minMonths: 18, maxMonths: 96 },
  { key: "crayons", name: "crayon set", kind: "Creative", hobby: "drawing", minMonths: 24, maxMonths: 132 },
  { key: "picture-book", name: "picture book", kind: "Book", hobby: "reading", minMonths: 18, maxMonths: 84 },
  { key: "storybook", name: "storybook", kind: "Book", hobby: "reading", minMonths: 60, maxMonths: 156 },
  { key: "sketchbook", name: "sketchbook", kind: "Creative", hobby: "drawing", minMonths: 60, maxMonths: 156 },
  { key: "craft-kit", name: "small craft kit", kind: "Creative", hobby: "making", minMonths: 60, maxMonths: 156 },
  { key: "keyboard", name: "little keyboard", kind: "Music", hobby: "music", minMonths: 42, maxMonths: 156 },
  { key: "garden-set", name: "small gardening set", kind: "Hobby", hobby: "gardening", minMonths: 60, maxMonths: 156 },
  { key: "cookbook", name: "children's cookbook", kind: "Hobby", hobby: "cooking", minMonths: 84, maxMonths: 156 },
  { key: "handheld", name: "handheld game", kind: "Game", hobby: "gaming", minMonths: 84, maxMonths: 156, comfortableOnly: true },
];

const OUTSIDE_FIRST = ["Alex", "Jamie", "Rina", "Marco", "Celine", "Theo", "Sam", "Dani", "Nico", "Mara", "Paolo", "Iris"];
const OUTSIDE_LAST = ["Santos", "Garcia", "Lim", "Tan", "Cruz", "Mendoza", "Flores", "Ramos", "Villanueva", "Navarro"];

function readState() {
  try {
    const state = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return state?.version === 2 ? state : null;
  } catch {
    return null;
  }
}

function saveState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function readMeta(state) {
  try {
    const meta = JSON.parse(localStorage.getItem(META_KEY));
    if (meta?.seed === state.seed) return meta;
  } catch {}
  return { seed: state.seed, ageMonths: state.character?.ageMonths || 0 };
}

function writeMeta(state, ageMonths) {
  localStorage.setItem(META_KEY, JSON.stringify({ seed: state.seed, ageMonths }));
}

function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function displayName(person, fallback = "Someone") {
  const parts = String(person?.name || "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return fallback;
  return HONORIFICS.has(parts[0]) && parts[1] ? `${parts[0]} ${parts[1]}` : parts[0];
}

function seededNumber(state, salt = 0) {
  let value = ((Number(state.seed) || 1) ^ (Number(state.character?.ageMonths) || 0) ^ salt) >>> 0;
  value = (value * 1664525 + 1013904223) >>> 0;
  return value / 4294967296;
}

function dramaRandom(state) {
  state.lifeEnhancer.dramaRngState = (state.lifeEnhancer.dramaRngState * 1664525 + 1013904223) >>> 0;
  return state.lifeEnhancer.dramaRngState / 4294967296;
}

function ensureState(state) {
  const seed = ((Number(state.seed) || 1) ^ 0x4f1bbcdc) >>> 0;
  state.lifeEnhancer ||= { version: 1, lastProcessedAgeMonths: state.character?.ageMonths || 0, dramaRngState: seed || 1 };
  state.lifeEnhancer.dramaRngState ||= seed || 1;
  state.possessions ||= { items: [], giftsReceived: 0, giftsGiven: 0, practiceHistory: [] };
  state.possessions.items ||= [];
  state.possessions.practiceHistory ||= [];
  state.relationshipDrama ||= { history: [] };
  state.relationshipDrama.history ||= [];
  state.worldEvents ||= [];
  state.realism ||= {};
  state.realism.latest ||= [];
  return state;
}

function addWorldUpdate(state, category, text, importance = 2, person = null, relatedPerson = null) {
  const item = {
    category,
    text,
    note: text,
    importance,
    ageMonths: state.character.ageMonths,
    date: { ...state.date },
    personId: person?.id || null,
    relatedPersonId: relatedPerson?.id || null,
    source: "life-enhancer",
  };
  state.realism.latest ||= [];
  state.realism.latest.unshift({ ...item });
  state.realism.latest = state.realism.latest.slice(0, 7);
  state.worldEvents.push(item);
  state.worldEvents = state.worldEvents.slice(-90);
  return item;
}

function repairNamedText(text, person) {
  if (!text || !person) return text;
  const short = displayName(person, "");
  if (!short || !short.includes(" ")) return text;
  const generic = short.split(" ")[0];
  const pattern = new RegExp(`^${generic}\\b`);
  return pattern.test(text) ? text.replace(pattern, short) : text;
}

function repairNames(state) {
  let changed = false;
  const replacements = new Map();
  const repairList = (list) => {
    for (const event of list || []) {
      if (!event?.personId) continue;
      const person = (state.people || []).find((entry) => entry.id === event.personId);
      if (!person) continue;
      const before = event.text || event.note;
      const after = repairNamedText(before, person);
      if (after && before !== after) {
        if (event.text) event.text = after;
        if (event.note) event.note = after;
        replacements.set(before, after);
        changed = true;
      }
    }
  };
  repairList(state.worldEvents);
  repairList(state.realism?.latest);
  repairList(state.realism?.family?.recent);
  for (const person of state.people || []) {
    const before = person.npc?.currentThread;
    if (!before) continue;
    const after = replacements.get(before) || repairNamedText(before, person);
    if (after !== before) {
      person.npc.currentThread = after;
      changed = true;
    }
  }
  if (state.realism?.birthday?.items?.length) {
    state.realism.birthday.items = state.realism.birthday.items.map((text) => replacements.get(text) || text);
  }
  if (state.contextual?.activeThread?.text && replacements.has(state.contextual.activeThread.text)) {
    state.contextual.activeThread.text = replacements.get(state.contextual.activeThread.text);
    changed = true;
  }
  return changed;
}

function makeItem(state, template, source = "Already yours", giver = null, acquiredAtMonths = state.character.ageMonths) {
  return {
    id: `item-${template.key}-${acquiredAtMonths}-${Math.floor(seededNumber(state, template.key.length * 901) * 99999)}`,
    key: template.key,
    name: template.name,
    kind: template.kind,
    hobby: template.hobby || null,
    acquiredAtMonths,
    giverId: giver?.id || null,
    source,
    favorite: false,
    usedCount: 0,
    lastUsedAtMonths: null,
    condition: "Good",
    givenAway: false,
    givenToId: null,
  };
}

function starterTemplates(state) {
  const age = state.character.ageMonths || 0;
  if (age < 12) return [ITEM_CATALOG.find((item) => item.key === "blanket")];
  if (age < 30) return [ITEM_CATALOG.find((item) => item.key === "blanket"), ITEM_CATALOG.find((item) => item.key === "plush")];
  if (age < 60) return [ITEM_CATALOG.find((item) => item.key === "plush"), ITEM_CATALOG.find((item) => item.key === "crayons"), ITEM_CATALOG.find((item) => item.key === "picture-book")];
  return [ITEM_CATALOG.find((item) => item.key === "storybook"), ITEM_CATALOG.find((item) => item.key === "crayons")];
}

function ensureStarterPossessions(state) {
  if (state.possessions.items.length) return false;
  const templates = starterTemplates(state).filter(Boolean);
  for (const template of templates) {
    const acquired = Math.max(0, Math.min(state.character.ageMonths, template.minMonths || 0));
    state.possessions.items.push(makeItem(state, template, "Already part of your things", null, acquired));
  }
  return templates.length > 0;
}

function eligibleGiftTemplates(state) {
  const age = state.character.ageMonths || 0;
  const ownedKeys = new Set(state.possessions.items.filter((item) => !item.givenAway).map((item) => item.key));
  const comfortable = state.household?.financeBand === "Comfortable";
  const candidates = ITEM_CATALOG.filter((item) => age >= item.minMonths && age <= item.maxMonths && !ownedKeys.has(item.key) && (!item.comfortableOnly || comfortable));
  return candidates.length ? candidates : ITEM_CATALOG.filter((item) => age >= item.minMonths && age <= item.maxMonths && (!item.comfortableOnly || comfortable));
}

function visibleKnownPeople(state) {
  const age = state.character.ageMonths || 0;
  return (state.people || []).filter((person) => !person.deceased && (person.introducedAtMonths || 0) <= age);
}

function giftGivers(state) {
  const people = visibleKnownPeople(state);
  const family = people.filter((person) => person.family?.caregiver || person.family?.household || ["grandmother", "grandfather", "aunt", "uncle"].includes(person.role));
  const friends = people.filter((person) => person.role === "friend" && state.character.ageMonths >= 60);
  return [...family, ...friends].filter((person, index, list) => list.findIndex((item) => item.id === person.id) === index);
}

function receiveGift(state, giver, template, reason) {
  const item = makeItem(state, template, reason, giver);
  state.possessions.items.push(item);
  state.possessions.giftsReceived = (state.possessions.giftsReceived || 0) + 1;
  if (giver) {
    giver.closeness = clamp((giver.closeness ?? 50) + 2);
    giver.history ||= [];
    giver.history.push({ ageMonths: state.character.ageMonths, date: { ...state.date }, eventId: "gift", note: `${displayName(giver)} gave you ${item.name}.` });
    giver.history = giver.history.slice(-20);
  }
  const who = displayName(giver, "Someone close to you");
  addWorldUpdate(state, "Family", `${who} gave you ${item.name}${reason === "Birthday gift" ? " for your birthday" : ""}. It is now one of your things.`, 3, giver);
  return item;
}

function processGifts(state, beforeMonths, elapsedMonths) {
  const beforeAge = Math.floor(beforeMonths / 12);
  const currentAge = Math.floor((state.character.ageMonths || 0) / 12);
  const givers = giftGivers(state);
  const templates = eligibleGiftTemplates(state);
  if (!givers.length || !templates.length) return false;
  if (currentAge > beforeAge && currentAge >= 1) {
    const giver = givers[Math.floor(seededNumber(state, 0x7711 + currentAge) * givers.length)];
    const template = templates[Math.floor(seededNumber(state, 0x8822 + currentAge) * templates.length)];
    receiveGift(state, giver, template, "Birthday gift");
    return true;
  }
  if (elapsedMonths > 0 && seededNumber(state, 0x9911) < Math.min(0.18, elapsedMonths * 0.018)) {
    const giver = givers[Math.floor(seededNumber(state, 0x6622) * givers.length)];
    const template = templates[Math.floor(seededNumber(state, 0x5533) * templates.length)];
    receiveGift(state, giver, template, "Gift");
    return true;
  }
  return false;
}

function partnerAdults(state) {
  return (state.people || []).filter((person) => ["guardian", "secondGuardian"].includes(person.role) && !person.deceased).slice(0, 2);
}

function uniqueOutsideName(state) {
  const existing = new Set((state.people || []).map((person) => String(person.name || "").toLowerCase()));
  for (let i = 0; i < 20; i += 1) {
    const first = OUTSIDE_FIRST[Math.floor(dramaRandom(state) * OUTSIDE_FIRST.length)];
    const last = OUTSIDE_LAST[Math.floor(dramaRandom(state) * OUTSIDE_LAST.length)];
    const name = `${first} ${last}`;
    if (!existing.has(name.toLowerCase())) return name;
  }
  return `Alex ${Math.floor(dramaRandom(state) * 900 + 100)}`;
}

function makeOutsidePerson(state, actor) {
  const name = uniqueOutsideName(state);
  const first = name.split(" ")[0];
  return {
    id: `family-connection-${first.toLowerCase()}-${state.character.ageMonths}-${Math.floor(dramaRandom(state) * 9999)}`,
    role: "family_connection",
    relationshipLabel: `Connected to ${displayName(actor)}`,
    name,
    sex: dramaRandom(state) < 0.5 ? "Female" : "Male",
    age: Math.max(20, (actor?.age || 30) + Math.round((dramaRandom(state) - 0.5) * 10)),
    introducedAtMonths: state.character.ageMonths + 99999,
    closeness: 5,
    trust: 10,
    affection: 10,
    conflict: 20,
    familiarity: 5,
    lastInteractionAtMonths: state.character.ageMonths,
    history: [],
    family: { branch: "outside", generation: "adult", kinship: "none", caregiver: false, household: false },
    npc: { outsideStress: 35, availability: 50, socialWorld: 55, currentThread: "", lastChangedAtMonths: state.character.ageMonths },
  };
}

function startAffair(state, adults) {
  const actor = adults[Math.floor(dramaRandom(state) * adults.length)];
  const partner = adults.find((person) => person.id !== actor.id);
  const outsider = makeOutsidePerson(state, actor);
  state.people.push(outsider);
  state.realism.family.partnership.affair = {
    status: "secret",
    actorId: actor.id,
    partnerId: partner?.id || null,
    otherPersonId: outsider.id,
    startedAtMonths: state.character.ageMonths,
    months: 0,
    discoveredAtMonths: null,
  };
  state.relationshipDrama.history.push({ type: "affair_started", ageMonths: state.character.ageMonths, actorId: actor.id, partnerId: partner?.id || null, otherPersonId: outsider.id });
}

function revealAffair(state, affair) {
  const actor = (state.people || []).find((person) => person.id === affair.actorId);
  const partner = (state.people || []).find((person) => person.id === affair.partnerId);
  const outsider = (state.people || []).find((person) => person.id === affair.otherPersonId);
  affair.status = "discovered";
  affair.discoveredAtMonths = state.character.ageMonths;
  if (outsider) outsider.introducedAtMonths = state.character.ageMonths;
  const partnership = state.realism.family.partnership;
  partnership.quality = clamp((partnership.quality ?? 55) - 28);
  state.realism.family.atmosphere = clamp((state.realism.family.atmosphere ?? 60) - 15);
  state.health.stress = clamp((state.health.stress ?? 25) + 8);
  const actorName = displayName(actor, "One of your caregivers");
  const partnerName = displayName(partner, "their partner");
  const otherName = outsider?.name || "someone else";
  const text = `${actorName} has been involved with ${otherName} outside their relationship with ${partnerName}. The adults are hurt and angry, and home suddenly feels much less steady.`;
  addWorldUpdate(state, "Family", text, 5, actor, outsider);
  if (actor?.npc) actor.npc.currentThread = text;
  if (partner?.npc) partner.npc.currentThread = `The relationship with ${actorName} has been shaken by what happened with ${otherName}.`;
  state.relationshipDrama.history.push({ type: "affair_discovered", ageMonths: state.character.ageMonths, actorId: actor?.id || null, partnerId: partner?.id || null, otherPersonId: outsider?.id || null });
}

function resolveAffair(state, affair) {
  const partnership = state.realism.family.partnership;
  const actor = (state.people || []).find((person) => person.id === affair.actorId);
  const partner = (state.people || []).find((person) => person.id === affair.partnerId);
  const outsider = (state.people || []).find((person) => person.id === affair.otherPersonId);
  const actorName = displayName(actor, "One caregiver");
  const partnerName = displayName(partner, "the other caregiver");
  const otherName = outsider?.name || "the other person";
  const monthsSinceDiscovery = state.character.ageMonths - (affair.discoveredAtMonths || state.character.ageMonths);
  if (monthsSinceDiscovery < 3) return false;
  const separationPressure = clamp((45 - (partnership.quality ?? 45)) / 60 + 0.08, 0.08, 0.48);
  if (dramaRandom(state) < separationPressure) {
    partnership.status = "separated";
    partnership.separatedAtMonths = state.character.ageMonths;
    affair.status = "ended_relationship";
    state.realism.family.atmosphere = clamp((state.realism.family.atmosphere ?? 55) - 8);
    addWorldUpdate(state, "Family", `${actorName} and ${partnerName} decide to separate after the affair. The argument turns into a practical question about where people will live and how everyday care will work.`, 5, actor, partner);
    state.relationshipDrama.history.push({ type: "affair_separation", ageMonths: state.character.ageMonths, actorId: actor?.id || null, partnerId: partner?.id || null });
    return true;
  }
  if (dramaRandom(state) < 0.4) {
    affair.status = "ended";
    partnership.quality = clamp((partnership.quality ?? 45) + 6);
    addWorldUpdate(state, "Family", `${actorName} says the relationship with ${otherName} is over. ${partnerName} has not simply forgotten what happened, but the adults are trying to decide whether trust can be rebuilt.`, 4, actor, outsider);
    state.relationshipDrama.history.push({ type: "affair_ended", ageMonths: state.character.ageMonths, actorId: actor?.id || null, partnerId: partner?.id || null });
    return true;
  }
  return false;
}

function processRelationshipDrama(state, elapsedMonths) {
  const partnership = state.realism?.family?.partnership;
  const adults = partnerAdults(state);
  if (!partnership || adults.length < 2 || partnership.status !== "together") return false;
  const affair = partnership.affair;
  if (!affair) {
    const quality = partnership.quality ?? 60;
    const pressure = adults.reduce((sum, person) => sum + Math.max(0, (person.npc?.outsideStress ?? 35) - 55), 0);
    const monthly = 0.00025 + Math.max(0, 48 - quality) * 0.000035 + pressure * 0.000008;
    if (dramaRandom(state) < monthly * Math.max(1, elapsedMonths)) {
      startAffair(state, adults);
      return true;
    }
    return false;
  }
  affair.months = (affair.months || 0) + elapsedMonths;
  if (affair.status === "secret" && affair.months >= 3) {
    const discoveryChance = clamp(0.08 + affair.months * 0.025, 0.1, 0.55);
    if (dramaRandom(state) < discoveryChance) {
      revealAffair(state, affair);
      return true;
    }
  } else if (affair.status === "discovered") {
    return resolveAffair(state, affair);
  }
  return false;
}

function processWorld(state) {
  ensureState(state);
  let changed = false;
  changed = repairNames(state) || changed;
  changed = ensureStarterPossessions(state) || changed;
  const current = state.character?.ageMonths || 0;
  const meta = readMeta(state);
  const before = Math.min(current, meta.ageMonths ?? current);
  const elapsed = Math.max(0, current - before);
  if (elapsed > 0) {
    changed = processGifts(state, before, elapsed) || changed;
    changed = processRelationshipDrama(state, elapsed) || changed;
    writeMeta(state, current);
  } else if (meta.ageMonths !== current) {
    writeMeta(state, current);
  }
  return changed;
}

function ageLabel(months) {
  const years = Math.floor(months / 12);
  const rest = months % 12;
  if (!years) return `${months} month${months === 1 ? "" : "s"}`;
  return `Age ${years}${rest ? ` + ${rest}m` : ""}`;
}

function icon() {
  return `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 7h14v13H5z"/><path d="M8 7V5h8v2M8 11h8M8 15h5"/></svg>`;
}

function styles() {
  return `<style>
    .things-intro{margin:0 0 16px;color:var(--muted);font-size:12px;line-height:1.5}
    .thing-card{border-top:1px solid var(--line);padding:14px 0}.thing-card:last-child{border-bottom:1px solid var(--line)}
    .thing-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}.thing-name{margin:0;font-family:var(--serif);font-size:19px;font-weight:500}.thing-kind{margin:3px 0 0;color:var(--muted);font-size:10px;text-transform:uppercase;letter-spacing:.06em}.thing-copy{margin:8px 0 0;font-size:12px;line-height:1.45}.thing-actions{display:flex;gap:7px;flex-wrap:wrap;margin-top:10px}.thing-action{-webkit-appearance:none;appearance:none;border:1px solid var(--line-strong);border-radius:7px;background:transparent;color:var(--ink);padding:7px 10px;font:inherit;font-size:10px;cursor:pointer}.thing-action.primary{border-color:var(--sage);background:var(--sage-soft)}.thing-action:disabled{opacity:.45}.favorite-mark{font-size:15px;color:var(--sage)}
    .give-list{margin-top:14px}.give-person{-webkit-appearance:none;appearance:none;width:100%;display:flex;justify-content:space-between;align-items:center;border:0;border-top:1px solid var(--line);background:transparent;padding:12px 0;color:var(--ink);font:inherit;text-align:left;cursor:pointer}.give-person:last-child{border-bottom:1px solid var(--line)}.give-person small{color:var(--muted)}
    .things-empty{padding:20px 0;color:var(--muted);font-family:var(--serif);font-size:16px;line-height:1.5}.things-back{-webkit-appearance:none;appearance:none;border:0;background:transparent;color:var(--sage);padding:0 0 12px;font:inherit;font-size:11px;cursor:pointer}
  </style>`;
}

function itemOrigin(state, item) {
  const giver = item.giverId ? (state.people || []).find((person) => person.id === item.giverId) : null;
  if (giver) return `${displayName(giver)} gave this to you at ${ageLabel(item.acquiredAtMonths)}.`;
  return `${item.source || "It became one of your things"} at ${ageLabel(item.acquiredAtMonths)}.`;
}

function inventoryContent(state) {
  const items = (state.possessions?.items || []).filter((item) => !item.givenAway).sort((a, b) => Number(b.favorite) - Number(a.favorite) || b.acquiredAtMonths - a.acquiredAtMonths);
  const age = state.character.ageMonths || 0;
  return `${styles()}<p class="brand">Little Days</p><h1 class="page-title">Things</h1><p class="things-intro">Objects can become part of a life too. Gifts remember who gave them to you, hobby tools can be used, and things you no longer want can be given to someone else.</p>${items.length ? items.map((item) => {
    const canPractice = item.hobby && age >= 30;
    const already = item.lastUsedAtMonths === age;
    return `<article class="thing-card"><div class="thing-head"><div><h2 class="thing-name">${item.name}</h2><p class="thing-kind">${item.kind}${item.hobby ? ` · ${item.hobby}` : ""}</p></div>${item.favorite ? `<span class="favorite-mark" aria-label="Favorite">♡</span>` : ""}</div><p class="thing-copy">${itemOrigin(state, item)}${item.usedCount ? ` You have used it ${item.usedCount} time${item.usedCount === 1 ? "" : "s"}.` : ""}</p><div class="thing-actions">${canPractice ? `<button class="thing-action primary" data-practice-item="${item.id}" ${already ? "disabled" : ""}>${already ? "Practiced this turn" : `Practice ${item.hobby}`}</button>` : ""}<button class="thing-action" data-favorite-item="${item.id}">${item.favorite ? "Unfavorite" : "Favorite"}</button>${age >= 36 ? `<button class="thing-action" data-give-route="${item.id}">Give to someone</button>` : ""}</div></article>`;
  }).join("") : `<p class="things-empty">You do not have any recorded belongings yet.</p>`}`;
}

function giveContent(state, itemId) {
  const item = (state.possessions?.items || []).find((entry) => entry.id === itemId && !entry.givenAway);
  if (!item) return `${styles()}<button class="things-back" data-enhancer-route="inventory">‹ Things</button><p class="brand">Little Days</p><h1 class="page-title">Give something</h1><p class="things-empty">That object is no longer in your things.</p>`;
  const people = visibleKnownPeople(state).filter((person) => person.role !== "teacher" && person.role !== "family_connection");
  return `${styles()}<button class="things-back" data-enhancer-route="inventory">‹ Things</button><p class="brand">Little Days</p><h1 class="page-title">Give ${item.name}</h1><p class="things-intro">Giving something away means it leaves your inventory. The relationship and the memory of the gift remain.</p><div class="give-list">${people.map((person) => `<button class="give-person" data-give-item="${item.id}" data-recipient-id="${person.id}"><span>${person.name}</span><small>${person.relationshipLabel || person.role}</small></button>`).join("")}</div>`;
}

function bindInventory(screen) {
  screen.querySelectorAll("[data-enhancer-route]").forEach((button) => button.addEventListener("click", () => { location.hash = button.dataset.enhancerRoute; }));
  screen.querySelectorAll("[data-give-route]").forEach((button) => button.addEventListener("click", () => { location.hash = `inventory/give/${encodeURIComponent(button.dataset.giveRoute)}`; }));
  screen.querySelectorAll("[data-favorite-item]").forEach((button) => button.addEventListener("click", () => {
    const state = ensureState(readState());
    const item = state.possessions.items.find((entry) => entry.id === button.dataset.favoriteItem);
    if (!item) return;
    item.favorite = !item.favorite;
    saveState(state);
    renderInventory(true);
  }));
  screen.querySelectorAll("[data-practice-item]").forEach((button) => button.addEventListener("click", () => {
    const state = ensureState(readState());
    const item = state.possessions.items.find((entry) => entry.id === button.dataset.practiceItem && !entry.givenAway);
    if (!item?.hobby || item.lastUsedAtMonths === state.character.ageMonths) return;
    item.usedCount = (item.usedCount || 0) + 1;
    item.lastUsedAtMonths = state.character.ageMonths;
    if (typeof state.interests?.[item.hobby] === "number") state.interests[item.hobby] = clamp(state.interests[item.hobby] + 3);
    state.health.stress = clamp((state.health.stress ?? 25) - 1);
    state.possessions.practiceHistory.push({ ageMonths: state.character.ageMonths, itemId: item.id, hobby: item.hobby, date: { ...state.date } });
    state.possessions.practiceHistory = state.possessions.practiceHistory.slice(-40);
    state.history ||= [];
    state.history.push({ ageMonths: state.character.ageMonths, date: { ...state.date }, eventId: "hobby_practice", title: `Practiced ${item.hobby}`, choice: item.name, result: `You spent time practicing ${item.hobby} with ${item.name}.`, continuity: "objects" });
    saveState(state);
    location.reload();
  }));
  screen.querySelectorAll("[data-give-item]").forEach((button) => button.addEventListener("click", () => {
    const state = ensureState(readState());
    const item = state.possessions.items.find((entry) => entry.id === button.dataset.giveItem && !entry.givenAway);
    const person = (state.people || []).find((entry) => entry.id === button.dataset.recipientId && !entry.deceased);
    if (!item || !person) return;
    item.givenAway = true;
    item.givenToId = person.id;
    item.givenAwayAtMonths = state.character.ageMonths;
    state.possessions.giftsGiven = (state.possessions.giftsGiven || 0) + 1;
    person.closeness = clamp((person.closeness ?? 50) + 4);
    person.trust = clamp((person.trust ?? 50) + 2);
    person.history ||= [];
    person.history.push({ ageMonths: state.character.ageMonths, date: { ...state.date }, eventId: "gift_given", note: `You gave ${person.name} your ${item.name}.` });
    addWorldUpdate(state, person.role === "friend" ? "Friends" : "Family", `You gave ${person.name} your ${item.name}. The object leaves your things, but the gesture becomes part of your relationship.`, 3, person);
    saveState(state);
    location.hash = "inventory";
    location.reload();
  }));
}

function renderInventory(force = false) {
  const route = location.hash.replace("#", "");
  if (!route.startsWith("inventory")) return;
  const screen = document.querySelector(".screen");
  const state = readState();
  if (!screen || !state) return;
  if (!force && screen.dataset.lifeEnhancerRoute === route) return;
  screen.dataset.lifeEnhancerRoute = route;
  const giveMatch = route.match(/^inventory\/give\/(.+)$/);
  screen.innerHTML = giveMatch ? giveContent(state, decodeURIComponent(giveMatch[1])) : inventoryContent(state);
  bindInventory(screen);
}

function injectMoreLink() {
  if (location.hash.replace("#", "") !== "more") return;
  const panel = document.querySelector(".more-panel");
  if (!panel || panel.querySelector("[data-enhancer-route='inventory']")) return;
  const button = document.createElement("button");
  button.className = "more-link";
  button.dataset.enhancerRoute = "inventory";
  button.innerHTML = `<span>${icon()}</span><span><strong>Things</strong>Inventory, gifts, favorite objects, and hobby practice.</span><span class="chevron" aria-hidden="true">›</span>`;
  button.addEventListener("click", () => { location.hash = "inventory"; });
  panel.appendChild(button);
}

function scheduleUi() {
  setTimeout(() => {
    renderInventory();
    injectMoreLink();
  }, 0);
}

export function refreshLifeEnhancer() {
  const state = readState();
  if (!state) return;
  ensureState(state);
  const changed = processWorld(state);
  if (changed) {
    saveState(state);
    location.reload();
    return;
  }
  scheduleUi();
}

refreshLifeEnhancer();
