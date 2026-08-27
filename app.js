import {
  continueLife,
  createNewLife,
  discoveredTraits,
  finalChildhoodSummary,
  formatGameDate,
  getAgeLabel,
  getAgeYears,
  getCurrentEvent,
  getVisiblePeople,
  interestSummary,
  lifeIndicators,
  lifeOverview,
  personalityRows,
  relationshipCopy,
  relationshipLabel,
  resolveChoice,
  schoolSnapshot,
} from "./game/engine.js?v=22";
import {
  advanceRealism,
  deathSummary,
  ensureRealismState,
  getAroundYou,
  getBirthdayRecap,
  healthSnapshot,
} from "./game/realism.js?v=22";
import { contextualEventForState, resolveContextualChoice } from "./game/contextual-events.js?v=22";
import { syncHouseholdMembership } from "./game/household-membership.js?v=22";
import { advanceChildhoodWorld, childhoodEventForState, ensureChildhoodState, socialSnapshot } from "./game/childhood-v2.js?v=22";
import { resolveChildhoodChoice } from "./game/childhood-v2-resolve.js?v=22";

const STORAGE_KEY = "little-days-save-v2";

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved?.version === 2 && saved.character && saved.household) return saved;
  } catch {
    // A damaged save should not take the whole app down with it.
  }
  return createNewLife();
}

let state = ensureChildhoodState(syncHouseholdMembership(ensureRealismState(loadState())));
let toastTimer;
let initialized = false;

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

const icons = {
  life: `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M20 4c-7.4.3-11.7 3.6-13.3 9.9M4 20c1.8-2.4 4.2-4.1 7.1-5.1M6.7 13.9C4 12.4 3 9.7 3 6.5c3.6 0 6.2.8 7.8 2.5"/></svg>`,
  people: `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="8" r="3"/><path d="M3.5 18.5c.8-3 2.8-4.5 5.5-4.5s4.7 1.5 5.5 4.5M16 9.5c2.1.2 3.6 1.4 4.2 3.5M15.5 14.5c2.4 0 4.1 1.2 5 3.6"/></svg>`,
  self: `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="3.5"/><path d="M5 20c.8-4.1 3.1-6 7-6s6.2 1.9 7 6"/></svg>`,
  memories: `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 5.5h10a3 3 0 0 1 3 3V20H8a3 3 0 0 1-3-3V5.5Z"/><path d="M8 5.5v11.8c0 1.5.9 2.7 2 2.7M18 8.5h1.5"/></svg>`,
  more: `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="5" cy="12" r="1" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none"/><circle cx="19" cy="12" r="1" fill="currentColor" stroke="none"/></svg>`,
  school: `<svg class="icon sm" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 8.5 12 4l9 4.5-9 4.5-9-4.5Z"/><path d="M6 11v5.5c3.7 2.2 8.3 2.2 12 0V11M21 9v6"/></svg>`,
  bookmark: `<svg class="icon sm" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 4h12v16l-6-3.7L6 20V4Z"/></svg>`,
  home: `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="m3 11 9-7 9 7"/><path d="M5 10v10h14V10M9 20v-6h6v6"/></svg>`,
  heart: `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M20.5 5.8c-2.2-2.2-5.6-1.8-7.5.8L12 8l-1-1.4C9.1 4 5.7 3.6 3.5 5.8 1 8.3 1.6 12.1 4 14.4L12 22l8-7.6c2.4-2.3 3-6.1.5-8.6Z"/></svg>`,
  moon: `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M20 15.2A8.5 8.5 0 0 1 8.8 4 8.5 8.5 0 1 0 20 15.2Z"/></svg>`,
  pen: `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="m4 20 4.4-1 9.7-9.7-3.4-3.4L5 15.6 4 20Z"/><path d="m13.8 6.8 3.4 3.4"/></svg>`,
  book: `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5.5c3.5-.8 6.2-.2 8 1.6v12c-1.8-1.8-4.5-2.4-8-1.6v-12ZM20 5.5c-3.5-.8-6.2-.2-8 1.6v12c1.8-1.8 4.5-2.4 8-1.6v-12Z"/></svg>`,
  family: `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="8" cy="8" r="2.5"/><circle cx="16.5" cy="8.5" r="2"/><path d="M3.5 18c.6-3.2 2.1-4.8 4.5-4.8s4 1.6 4.6 4.8M13 17.8c.5-2.4 1.7-3.6 3.7-3.6 1.9 0 3.2 1.2 3.8 3.6"/></svg>`,
  calendar: `<svg class="icon sm" viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="6" width="16" height="14" rx="1"/><path d="M8 4v4M16 4v4M4 10h16"/></svg>`,
  shield: `<svg class="icon sm" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 5 6v5c0 4.4 2.3 7.4 7 10 4.7-2.6 7-5.6 7-10V6l-7-3Z"/></svg>`,
};

const navItems = [["life", "Life"], ["people", "People"], ["self", "Self"], ["memories", "Memories"], ["more", "More"]];

function getRoute() {
  return location.hash.replace("#", "").trim() || "life";
}

function brand(title = "") {
  return `<p class="brand">Little Days</p>${title ? `<h1 class="page-title">${title}</h1>` : ""}`;
}

function bottomNav(route) {
  const peopleRoute = route === "family-tree" || route.startsWith("person/");
  const activeRoot = peopleRoute ? "people" : (["home", "school", "overview", "health"].includes(route) ? "more" : route);
  return `<nav class="bottom-nav" aria-label="Primary">${navItems.map(([key,label])=>`<button class="nav-button ${activeRoot===key?"active":""}" data-route="${key}" aria-label="${label}">${icons[key]}<span>${label}</span></button>`).join("")}</nav>`;
}

function shell(content, route) {
  return `<section class="screen">${content}</section>${bottomNav(route)}`;
}

function categoryIcon(category) {
  const map = { School: icons.school, Family: icons.family, Friends: icons.people, Home: icons.home, Health: icons.moon, Interests: icons.pen, Money: icons.book, Self: icons.self };
  return map[category] || icons.life;
}

function aroundYouBlock() {
  const birthday = getBirthdayRecap(state);
  const updates = getAroundYou(state);
  if (!birthday && !updates.length) return "";
  return `
    ${birthday ? `<section class="data-section"><h2 class="section-title">You turned ${birthday.age}</h2>${birthday.items.map(item=>`<p class="body-note">${item}</p>`).join("")}</section>` : ""}
    ${updates.length ? `<section class="data-section"><h2 class="section-title">Around you</h2>${updates.map(update=>`<div class="overview-row"><div>${categoryIcon(update.category)}</div><div><h3>${update.category}</h3><p>${update.text}</p></div></div>`).join("")}</section>` : ""}
  `;
}

function lifeScreen() {
  if (state.death) {
    const summary = deathSummary(state);
    return shell(`${brand()}<h1 class="age-title">${getAgeLabel(state)}</h1><p class="date-line">${formatGameDate(state)}</p><div class="eyebrow">${icons.memories} Life ended</div><h2 class="event-title">${summary.title}</h2><p class="event-copy">${summary.copy}</p><div class="divider"></div><p class="body-note">Cause: ${summary.cause}.</p><button class="utility-button" data-new-life>Begin another life</button>`,"life");
  }

  if (state.completed) {
    const summary = finalChildhoodSummary(state);
    return shell(`${brand()}<h1 class="age-title">Age 13</h1><p class="date-line">${formatGameDate(state)}</p><div class="eyebrow">${icons.memories} Childhood complete</div><h2 class="event-title">${summary.title}</h2><p class="event-copy">${summary.copy}</p><div class="divider"></div><p class="body-note">This is the end of the current childhood MVP. Adolescence is deliberately not simulated yet.</p><button class="utility-button" data-new-life>Begin another life</button>`,"life");
  }

  const contextualEvent = contextualEventForState(state);
  const childhoodEvent = state.resolution?.childhoodEvent || childhoodEventForState(state);
  const contextualHasPriority = contextualEvent && ["illness", "recovery", "thread", "development"].includes(contextualEvent.contextKind);
  const event = contextualHasPriority ? contextualEvent : (childhoodEvent || contextualEvent || getCurrentEvent(state));
  const indicators = lifeIndicators(state);
  const resolvedChoice = state.resolution?.choiceId;
  const usingChildhood = Boolean(childhoodEvent && event === childhoodEvent);
  const choiceAttribute = usingChildhood ? "data-childhood-choice" : contextualEvent && event === contextualEvent ? "data-context-choice" : "data-choice";
  return shell(`
    ${brand()}
    <h1 class="age-title">${getAgeLabel(state)}</h1>
    <p class="date-line">${formatGameDate(state)}</p>
    <div class="status-strip" aria-label="Life indicators">
      <div class="status-item"><span class="status-dot"></span><div class="status-copy"><strong>Wellbeing</strong>${indicators.wellbeing}</div></div>
      <div class="status-item"><span class="status-dot gold"></span><div class="status-copy"><strong>Energy</strong>${indicators.energy}</div></div>
      <div class="status-item"><span class="status-dot"></span><div class="status-copy"><strong>Stress</strong>${indicators.stress}</div></div>
    </div>
    ${aroundYouBlock()}
    <div class="eyebrow">${categoryIcon(event.category)} ${event.category}</div>
    <h2 class="event-title">${event.title}</h2>
    <p class="event-copy">${event.body}</p>
    <div class="divider"></div>
    <p class="prompt">${event.prompt}</p>
    <div class="choices">${event.choices.map(choice=>`<button class="choice-button ${resolvedChoice===choice.id?"primary":""}" ${choiceAttribute}="${choice.id}" ${state.resolution?"disabled":""} aria-pressed="${resolvedChoice===choice.id}">${choice.label}</button>`).join("")}</div>
    ${state.resolution?`<div class="result-card">${state.resolution.result}</div><button class="utility-button" id="continue-life">Continue</button>`:""}
  `,"life");
}

function personRole(person) {
  return person.relationshipLabel || ({guardian:"Parent / Guardian",secondGuardian:"Parent / Guardian",grandmother:"Grandmother",grandfather:"Grandfather",sibling:"Sibling",aunt:"Aunt",uncle:"Uncle",cousin:"Cousin",friend:"Friend"})[person.role] || "Relationship";
}

function personInitial(person) {
  const parts = String(person.name || "?").trim().split(/\s+/);
  const honorifics = new Set(["Lola", "Lolo", "Auntie", "Uncle", "Tita", "Tito"]);
  const useful = parts.find(part => !honorifics.has(part)) || parts[0] || "?";
  return useful[0]?.toUpperCase() || "?";
}

function peopleTabs(active) {
  return `<div class="people-tabs" aria-label="People views"><button class="people-tab ${active==="people"?"active":""}" data-route="people">People</button><button class="people-tab ${active==="family"?"active":""}" data-route="family-tree">Family tree</button></div>`;
}

function peopleSharedStyles() {
  return `<style>
    .people-tabs{display:grid;grid-template-columns:1fr 1fr;margin:-4px 0 10px;border-bottom:1px solid var(--line)}
    .people-tab{-webkit-appearance:none;appearance:none;border:0;border-bottom:2px solid transparent;background:transparent;color:var(--muted);padding:10px 6px;font:inherit;font-size:11px;cursor:pointer}
    .people-tab.active{color:var(--ink);border-bottom-color:var(--sage);font-weight:700}
    .person-card-button{-webkit-appearance:none;appearance:none;width:100%;margin:0;border:0;border-bottom:1px solid var(--line);border-radius:0;background:transparent;color:var(--ink);text-align:left;font:inherit;cursor:pointer}
    .person-card-button:last-child{border-bottom:0}
    .person-card-button:active{background:rgba(113,129,105,.06)}
    .person-card-button .person-name,.person-card-button .person-role,.person-card-button .person-copy,.person-card-button .person-meta{color:inherit}
    .person-card-button .person-role{color:#3f413a}
    .person-card-button .person-meta{color:var(--muted)}
    .person-card-button:focus-visible{outline:1px solid var(--sage);outline-offset:2px}
  </style>`;
}

function peopleScreen() {
  const people = getVisiblePeople(state);
  const social = socialSnapshot(state);
  return shell(`${peopleSharedStyles()}${brand("People")}${peopleTabs("people")}<div class="people-list">${people.map(person=>{
    const relation = person.deceased ? "Remembered" : relationshipLabel(person);
    const isCrush = social.crush?.id === person.id;
    const copy = person.deceased ? (person.npc?.currentThread || `${person.name} is no longer alive.`) : relationshipCopy(person);
    const knownMonths = Math.max(0, state.character.ageMonths - (person.introducedAtMonths || 0));
    const knownYears = Math.floor(knownMonths / 12);
    const knownText = knownYears > 0 ? `Known for — ${knownYears} year${knownYears===1?"":"s"}` : knownMonths > 0 ? `Known for — ${knownMonths} month${knownMonths===1?"":"s"}` : "Recently met";
    const meta = person.deceased ? `Died at age ${person.diedAtAge}` : person.role==="friend" ? knownText : `Age — ${person.age+getAgeYears(state)}`;
    return `<button class="person-card person-card-button" data-person-id="${person.id}"><div class="avatar" aria-hidden="true">${personInitial(person)}</div><div><h2 class="person-name">${person.name}</h2><p class="person-role">${personRole(person)} — ${relation}${isCrush?" · Crush":""}</p><p class="person-copy">${copy}</p><p class="person-meta">${meta} · View profile</p></div></button>`;
  }).join("")}</div>`,"people");
}

function familyNode(person) {
  const age = getAgeYears(state);
  const ageText = person.deceased ? "Deceased" : `Age ${person.age + age}`;
  return `<button class="tree-person ${person.deceased?"deceased":""}" data-person-id="${person.id}"><span class="tree-avatar">${personInitial(person)}</span><span class="tree-name">${person.name}</span><span class="tree-role">${personRole(person)}</span><span class="tree-age">${ageText}</span></button>`;
}

function missingParentSummary(origin, caregivers) {
  const text = String(origin || "").toLowerCase();
  const roles = caregivers.map(person => personRole(person).toLowerCase());
  const hasMother = roles.some(role => role === "mother" || role.includes("biological mother"));
  const hasFather = roles.some(role => role === "father" || role.includes("biological father"));

  if (text.includes("biological father died")) return { title: "Biological father", copy: "Died before you were born" };
  if (text.includes("biological mother died")) return { title: "Biological mother", copy: "Died before you were born" };
  if (text.includes("parents separated") && hasMother && !hasFather) return { title: "Biological father", copy: "Lives elsewhere" };
  if (text.includes("mother is not part of your household") && hasFather && !hasMother) return { title: "Biological mother", copy: "Not in your household" };
  if (text.includes("adopted at birth")) return { title: "Biological parents", copy: "Not part of your known family yet" };
  if (text.includes("biological parents cannot care") || text.includes("parents are not able to raise")) return { title: "Biological parents", copy: "Not raising you" };
  if (text.includes("abandoned") || text.includes("foster care")) return { title: "Biological parents", copy: "Unknown or absent at the start of your life" };
  return null;
}

function caregiverHeading(caregivers) {
  const labels = caregivers.map(person => personRole(person).toLowerCase());
  if (labels.length && labels.every(label => label === "mother" || label === "father")) return "Parents";
  if (labels.some(label => label.includes("grandmother") || label.includes("grandfather") || label.includes("aunt") || label.includes("uncle"))) return "People raising you";
  if (labels.some(label => label.includes("foster") || label.includes("adoptive") || label.includes("step"))) return "Parents & caregivers";
  return "Parents & caregivers";
}

function familyTreeScreen() {
  const visible = getVisiblePeople(state).filter(person => person.role !== "friend");
  const caregivers = visible.filter(person => ["guardian","secondGuardian"].includes(person.role));
  const siblings = visible.filter(person => person.role === "sibling");
  const grandparents = visible.filter(person => ["grandmother","grandfather"].includes(person.role));
  const auntsUncles = visible.filter(person => ["aunt","uncle"].includes(person.role));
  const cousins = visible.filter(person => person.role === "cousin");
  const origin = state.family?.originStory || "Your family story is still becoming known to you.";
  const missingParent = missingParentSummary(origin, caregivers);
  const player = `<div class="tree-person tree-you" aria-label="You"><span class="tree-avatar">${state.character.firstName[0]}</span><span class="tree-name">${state.character.firstName} ${state.character.lastName}</span><span class="tree-role">You</span><span class="tree-age">${getAgeLabel(state)}</span></div>`;
  const treeStyles = `<style>
    .tree-intro{margin:0 auto 18px;max-width:360px;text-align:center;color:var(--muted);font-family:var(--serif);font-size:13px;line-height:1.5;font-style:italic}
    .family-tree{padding:2px 0 8px}
    .tree-direct{position:relative;padding:8px 0 28px;text-align:center}
    .tree-direct::after{content:"";position:absolute;left:50%;bottom:0;width:1px;height:28px;background:var(--line-strong)}
    .tree-generation{position:relative;padding:8px 0 16px;text-align:center}
    .tree-label{margin:0 0 10px;color:var(--muted);font-size:9px;font-weight:800;letter-spacing:.09em;text-transform:uppercase}
    .tree-row{display:flex;justify-content:center;align-items:stretch;gap:8px;flex-wrap:wrap;position:relative}
    .tree-person{-webkit-appearance:none;appearance:none;width:min(142px,45%);min-height:104px;margin:0;border:1px solid var(--line);border-radius:8px;background:rgba(255,255,255,.28);color:var(--ink);padding:10px 8px;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;font:inherit;cursor:pointer}
    .tree-person:active{background:rgba(113,129,105,.08)}
    .tree-person:focus-visible{outline:1px solid var(--sage);outline-offset:2px}
    .tree-person.deceased{opacity:.62;border-style:dashed}
    .tree-person.tree-you{border-color:var(--sage);background:var(--sage-soft);cursor:default}
    .tree-avatar{width:34px;height:34px;margin-bottom:7px;border:1px solid var(--line-strong);border-radius:999px;background:var(--paper-strong);display:grid;place-items:center;font-family:var(--serif);font-size:16px}
    .tree-name{font-family:var(--serif);font-size:14px;line-height:1.15}
    .tree-role{margin-top:4px;color:#4b4d46;font-size:9px;font-weight:700;line-height:1.25}
    .tree-age{margin-top:3px;color:var(--muted);font-size:9px}
    .tree-placeholder{max-width:292px;margin:0 auto 18px;border:1px dashed var(--line-strong);border-radius:7px;padding:10px 12px;text-align:center;background:rgba(255,255,255,.16)}
    .tree-placeholder strong{display:block;font-family:var(--serif);font-size:14px;font-weight:500}.tree-placeholder span{display:block;margin-top:3px;color:var(--muted);font-size:9px}
    .tree-generation.you-generation{padding-bottom:22px}
    .tree-generation.you-generation::before{content:"";position:absolute;left:50%;top:-8px;width:1px;height:16px;background:var(--line-strong)}
    .tree-extended{margin-top:3px;padding-top:18px;border-top:1px solid var(--line)}
    .tree-extended-title{margin:0 0 14px;text-align:left;font-family:var(--serif);font-size:15px;font-weight:500}
    .tree-extended-group+.tree-extended-group{margin-top:18px}
    .tree-note{margin:14px 0 0;text-align:center;color:var(--muted);font-size:10px;line-height:1.45}
  </style>`;

  const directFamily = caregivers.length
    ? `<section class="tree-direct"><p class="tree-label">${caregiverHeading(caregivers)}</p><div class="tree-row">${caregivers.map(familyNode).join("")}</div></section>`
    : "";
  const yourGeneration = `<section class="tree-generation you-generation"><p class="tree-label">Your generation</p><div class="tree-row">${player}${siblings.map(familyNode).join("")}</div></section>`;
  const extendedGroups = [
    grandparents.length ? `<div class="tree-extended-group"><p class="tree-label">Other known grandparents</p><div class="tree-row">${grandparents.map(familyNode).join("")}</div></div>` : "",
    auntsUncles.length ? `<div class="tree-extended-group"><p class="tree-label">Aunts & uncles</p><div class="tree-row">${auntsUncles.map(familyNode).join("")}</div></div>` : "",
    cousins.length ? `<div class="tree-extended-group"><p class="tree-label">Cousins</p><div class="tree-row">${cousins.map(familyNode).join("")}</div></div>` : "",
  ].join("");

  return shell(`${peopleSharedStyles()}${treeStyles}${brand("Family")}${peopleTabs("family")}<p class="tree-intro">${origin}</p>${missingParent?`<div class="tree-placeholder"><strong>${missingParent.title}</strong><span>${missingParent.copy}</span></div>`:""}<div class="family-tree">${directFamily}${yourGeneration}${extendedGroups?`<section class="tree-extended"><h2 class="tree-extended-title">Known extended family</h2>${extendedGroups}</section>`:`<p class="tree-note">No extended relatives are known to you yet.</p>`}</div><p class="tree-note">Only relationships the game actually knows are connected. Extended relatives stay unconnected until their exact branch is known, instead of inventing who is whose parent.</p>`,"family-tree");
}

function levelWord(value, low, mid, high) {
  if (value >= 72) return high;
  if (value >= 45) return mid;
  return low;
}

function personProfileScreen(id) {
  const person = (state.people || []).find(item => item.id === id);
  if (!person) return shell(`${brand("People")}<p class="body-note">This person is not part of your known world yet.</p><button class="utility-button" data-route="people">Back to people</button>`,"people");
  const age = getAgeYears(state);
  const realism = person.npc?.realism || {};
  const social = person.npc?.socialWorld ?? 50;
  const socialWorld = socialSnapshot(state);
  const isCrush = socialWorld.crush?.id === person.id;
  const patience = 100 - (person.conflict ?? 20);
  const steadiness = 100 - (person.npc?.outsideStress ?? 35);
  const warmth = Math.round(((person.affection ?? 60) + (person.closeness ?? 55)) / 2);
  const personality = [
    ["Social style", levelWord(social,"Private","Balanced","Outgoing")],
    ["Warmth", levelWord(warmth,"Reserved","Warm","Very affectionate")],
    ["Patience", levelWord(patience,"Quick-tempered","Usually patient","Very patient")],
    ["Steadiness", levelWord(steadiness,"Easily stressed","Steady","Very calm")],
  ];
  const work = realism.employment?.status ? realism.employment.status.replace("-"," ") : null;
  const current = person.npc?.currentThread || (person.deceased ? "They are remembered as part of your life." : relationshipCopy(person));
  const relation = person.deceased ? "Remembered" : relationshipLabel(person);
  const currentAge = person.deceased ? `Died at age ${person.diedAtAge}` : `Age ${person.age + age}`;
  const history = [...(person.history || [])].slice(-6).reverse();
  const styles = `<style>
    .person-profile-head{text-align:center;padding:5px 0 12px}.profile-avatar{width:72px;height:72px;margin:0 auto 10px;border:1px solid var(--line-strong);border-radius:999px;display:grid;place-items:center;font-family:var(--serif);font-size:32px;background:#f4efe5}.profile-name{margin:0;font-family:var(--serif);font-size:27px;font-weight:500}.profile-role{margin:4px 0;color:var(--muted);font-size:12px}.profile-back{-webkit-appearance:none;appearance:none;border:0;background:transparent;padding:4px 0 12px;color:var(--sage);font-size:12px;cursor:pointer}.profile-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:10px 0 16px}.profile-fact{border-top:1px solid var(--line);padding:9px 0}.profile-fact span{display:block;color:var(--muted);font-size:9px;text-transform:uppercase;letter-spacing:.06em}.profile-fact strong{display:block;margin-top:2px;font-family:var(--serif);font-size:15px;font-weight:500}.personality-row{display:flex;justify-content:space-between;gap:12px;border-top:1px solid var(--line);padding:9px 0;font-size:12px}.personality-row:last-child{border-bottom:1px solid var(--line)}.personality-row strong{font-weight:500;text-align:right}.profile-section{margin-top:18px}.profile-section h2{margin:0 0 6px;font-family:var(--serif);font-size:18px;font-weight:500}.profile-section p{margin:0;font-size:12px;line-height:1.5}
  </style>`;
  return shell(`${styles}<button class="profile-back" data-route="people">‹ People</button>${brand()}<div class="person-profile-head"><div class="profile-avatar">${personInitial(person)}</div><h1 class="profile-name">${person.name}</h1><p class="profile-role">${personRole(person)} · ${relation}${isCrush?" · Your crush":""}</p></div><div class="profile-grid"><div class="profile-fact"><span>Age</span><strong>${currentAge}</strong></div><div class="profile-fact"><span>Sex</span><strong>${person.sex || "Unknown"}</strong></div><div class="profile-fact"><span>Interest</span><strong>${realism.interest || "Not known yet"}</strong></div><div class="profile-fact"><span>Work</span><strong>${work || (["sibling","cousin","friend"].includes(person.role) ? "Student / child" : "Not known")}</strong></div></div>${isCrush?`<section class="profile-section"><h2>How you feel</h2><p>You have a crush on ${person.name.split(" ")[0]}. That describes your feelings, not theirs. The game will not assume the feeling is mutual unless something actually happens between you.</p></section>`:""}<section class="profile-section"><h2>Personality</h2>${personality.map(([label,value])=>`<div class="personality-row"><span>${label}</span><strong>${value}</strong></div>`).join("")}</section><section class="profile-section"><h2>Your relationship</h2><p>${current}</p><div class="profile-grid"><div class="profile-fact"><span>Closeness</span><strong>${levelWord(person.closeness ?? 50,"Distant","Growing","Very close")}</strong></div><div class="profile-fact"><span>Trust</span><strong>${levelWord(person.trust ?? 50,"Low","Developing","Strong")}</strong></div></div></section>${realism.health?`<section class="profile-section"><h2>Life lately</h2><p>${realism.health < 45 ? "Their health has been difficult lately." : realism.mental < 45 ? "They seem to be carrying a lot emotionally." : "Their life seems fairly steady at the moment."}${realism.interest?` They are interested in ${realism.interest}.`:""}</p></section>`:""}${history.length?`<section class="profile-section"><h2>Shared history</h2>${history.map(item=>`<p style="margin-bottom:8px">${item.note || item.text || item.result || "A moment you shared became part of your history."}</p>`).join("")}</section>`:""}`,`person/${id}`);
}

function selfScreen() {
  const rows = personalityRows(state), traits = discoveredTraits(state);
  return shell(`${brand("Self")}<h2 class="section-title">Personality</h2><div class="personality-list">${rows.map(([left,right,value])=>`<div class="trait-line"><span>${left}</span><div class="trait-track" style="--value:${value}%" role="img" aria-label="${left} to ${right}"></div><span>${right}</span></div>`).join("")}</div><div class="divider"></div><h2 class="section-title">Discovered Traits</h2>${traits.length?traits.map(([name,copy])=>`<div class="discovered-trait"><strong>${name}</strong><p>${copy}</p></div>`).join(""):`<div class="discovered-trait"><strong>???</strong><p>You haven't learned enough about yourself yet.</p></div>`}`,"self");
}

function memoriesScreen() {
  const memories=[...state.memories].reverse();
  return shell(`${brand("Memories")}${memories.length?`<div class="memory-timeline">${memories.map(memory=>`<article class="memory-entry ${memory.featured?"featured":""}"><p class="memory-date">Age ${memory.age} · ${memory.date}</p><h2 class="memory-title">${memory.title}</h2><p class="memory-copy">${memory.copy}</p></article>`).join("")}</div>`:`<p class="body-note">Nothing has become a lasting memory yet. That will change. Childhood is annoyingly efficient at leaving evidence behind.</p>`}`,"memories");
}

function householdMembers() {
  const visible = getVisiblePeople(state).filter(person => person.role !== "friend" && person.role !== "teacher" && !person.deceased);
  const explicit = visible.filter(person => person.family?.household === true);
  return explicit.length ? explicit : visible.filter(person => ["guardian", "secondGuardian", "sibling"].includes(person.role));
}

function homeScreen() {
  const age=getAgeYears(state), householdPeople=householdMembers();
  return shell(`${brand()}<h1 class="home-title">Home</h1><h2 class="home-subtitle">${state.household.name}</h2><p class="kicker-copy">${state.household.housing}<br />${state.household.city}, ${state.household.country}</p><section class="data-section"><h3 class="data-heading">Household</h3><div class="data-row"><span class="initial-chip">${state.character.firstName[0]}</span><span class="label">You · ${state.character.firstName}</span><span class="value">${age}</span></div>${householdPeople.map(person=>`<div class="data-row"><span class="initial-chip">${personInitial(person)}</span><span class="label">${person.name}</span><span class="value">${person.age+age}</span></div>`).join("")}</section><section class="data-section"><h3 class="data-heading">Home Life</h3><div class="data-row">${icons.home}<span class="label">Comfort</span><span class="value">${state.household.comfort}</span></div><div class="data-row">${icons.shield}<span class="label">Privacy</span><span class="value">${state.household.privacy}</span></div><div class="data-row">${icons.book}<span class="label">Finances</span><span class="value">${state.household.financeBand}</span></div><div class="data-row">${icons.people}<span class="label">Neighborhood</span><span class="value">${state.household.neighborhood}</span></div></section><p class="body-note">${state.household.financeBand==="Tight"?"Money sometimes changes what the household can say yes to.":state.household.privacy==="Limited"?"The home can feel crowded, although familiar routines make it feel like yours.":"Home life is fairly steady at the moment."}</p>`,"home");
}

function schoolScreen() {
  const school=schoolSnapshot(state);
  if(!school)return shell(`${brand()}<h1 class="page-title">School</h1><p class="body-note">School has not started yet. For now, most of your world is still home, family, and whatever happens to be within reach.</p>`,"school");
  const social = socialSnapshot(state);
  const friendNames = social.friends.slice(0,4).map(person=>person.name.split(" ")[0]);
  return shell(`${brand()}<h1 class="page-title">${school.grade}</h1><table class="subject-table"><caption>Subjects</caption><tbody>${school.subjects.map(([subject,status])=>`<tr><td>${subject}</td><td>${status}</td></tr>`).join("")}</tbody></table><section class="data-section"><div class="data-row">${icons.self}<span class="label">Teacher</span><span class="value">${school.teacher}</span></div><div class="data-row">${icons.people}<span class="label">Friends</span><span class="value">${friendNames.length?friendNames.join(", "):"Still forming"}</span></div>${social.crush?`<div class="data-row">${icons.heart}<span class="label">Crush</span><span class="value">${social.crush.name.split(" ")[0]}</span></div>`:""}<div class="data-row">${icons.calendar}<span class="label">Current term</span><span class="value">${school.term}</span></div></section><h2 class="section-title">School lately</h2><p class="body-note">${state.character.personality.social<42?"You tend to watch and listen before volunteering yourself.":social.friends.length>=3?"School has become a real social world, with different friendships that do not all feel the same.":state.character.personality.structure>65?"You usually feel best when you understand what is expected of you.":"School is becoming one of the places where more of your personality shows."}</p>`,"school");
}

function healthScreen() {
  const health=healthSnapshot(state);
  return shell(`${brand("Health")}<p class="life-feeling-label">Your body and mind</p><p class="life-feeling">Health is something that happens over time, not a single score.</p><section class="data-section"><h3 class="data-heading">Physical health</h3><p class="body-note">${health.physical}</p>${health.known.length?health.known.map(item=>`<div class="data-row">${icons.moon}<span class="label">Known condition</span><span class="value">${item}</span></div>`).join(""):""}</section><section class="data-section"><h3 class="data-heading">Emotional health</h3><p class="body-note">${health.emotional}</p></section><section class="data-section"><h3 class="data-heading">Healthcare</h3><div class="data-row">${icons.shield}<span class="label">Access</span><span class="value">${health.care}</span></div></section><p class="body-note">Some risks remain hidden until life gives you a reason to discover them. Money, family history, environment, treatment, and luck can all matter without deciding your future by themselves.</p>`,"health");
}

function overviewScreen() {
  const overview=lifeOverview(state), rows=[[icons.family,"Family",overview.rows.family],[icons.book,"School",overview.rows.school],[icons.heart,"Friends",overview.rows.friends],[icons.moon,"Health",healthSnapshot(state).physical],[icons.pen,"Interests",overview.rows.interests],[icons.home,"Home",overview.rows.home]];
  return shell(`${brand("Life")}<p class="life-feeling-label">Life lately</p><p class="life-feeling">${overview.feeling}</p><div>${rows.map(([icon,title,copy])=>`<article class="overview-row"><div>${icon}</div><div><h3>${title}</h3><p>${copy}</p></div></article>`).join("")}</div>`,"overview");
}

function moreScreen() {
  const links=[["home",icons.home,"Home","Household, comfort, privacy, and neighborhood."],["school",icons.book,"School","Subjects, teacher, friends, and current term."],["health",icons.moon,"Health","Physical conditions, emotional health, and access to care."],["overview",icons.life,"Life overview","A quiet summary of what life currently feels like."]];
  return shell(`${brand("More")}<div class="more-panel">${links.map(([route,icon,title,copy])=>`<button class="more-link" data-route="${route}"><span>${icon}</span><span><strong>${title}</strong>${copy}</span><span class="chevron" aria-hidden="true">›</span></button>`).join("")}</div><p class="body-note">Playing as <strong>${state.character.firstName} ${state.character.lastName}</strong>, born in ${state.character.birthplace}. ${interestSummary(state)}</p><button class="utility-button" data-new-life>Begin a different life</button>`,"more");
}

const screens={life:lifeScreen,people:peopleScreen,"family-tree":familyTreeScreen,self:selfScreen,memories:memoriesScreen,more:moreScreen,home:homeScreen,school:schoolScreen,health:healthScreen,overview:overviewScreen};

function render(){
  ensureRealismState(state);
  ensureChildhoodState(state);
  syncHouseholdMembership(state);
  const route=getRoute();
  const screen=route.startsWith("person/") ? ()=>personProfileScreen(decodeURIComponent(route.slice(7))) : (screens[route]||screens.life);
  document.querySelector("#app").innerHTML=screen();
  bindEvents();
}

function startNewLife(){if(!window.confirm("Begin a different life? Your current childhood will be replaced."))return;state=ensureChildhoodState(syncHouseholdMembership(ensureRealismState(createNewLife())));saveState();location.hash="life";render();showToast(`A new life begins. Meet ${state.character.firstName}.`)}

function bindEvents(){
  document.querySelectorAll("[data-route]").forEach(button=>button.addEventListener("click",()=>{const route=button.dataset.route;if(route!==getRoute())location.hash=route}));
  document.querySelectorAll("[data-person-id]").forEach(button=>button.addEventListener("click",()=>{location.hash=`person/${encodeURIComponent(button.dataset.personId)}`}));
  document.querySelectorAll("[data-childhood-choice]").forEach(button=>button.addEventListener("click",()=>{resolveChildhoodChoice(state,button.dataset.childhoodChoice);saveState();render();showToast("Choice remembered.")}));
  document.querySelectorAll("[data-context-choice]").forEach(button=>button.addEventListener("click",()=>{resolveContextualChoice(state,button.dataset.contextChoice);saveState();render();showToast("Choice remembered.")}));
  document.querySelectorAll("[data-choice]").forEach(button=>button.addEventListener("click",()=>{resolveChoice(state,button.dataset.choice);saveState();render();showToast("Choice remembered.")}));
  document.querySelector("#continue-life")?.addEventListener("click",()=>{const before=state.character.ageMonths;continueLife(state);const elapsed=Math.max(0,state.character.ageMonths-before);advanceChildhoodWorld(state,elapsed,before);advanceRealism(state,elapsed,before);syncHouseholdMembership(state);saveState();render();window.scrollTo({top:0,behavior:"smooth"})});
  document.querySelectorAll("[data-new-life]").forEach(button=>button.addEventListener("click",startNewLife));
}

function showToast(message){clearTimeout(toastTimer);document.querySelector(".toast")?.remove();const toast=document.createElement("div");toast.className="toast";toast.setAttribute("role","status");toast.textContent=message;document.body.appendChild(toast);toastTimer=setTimeout(()=>toast.remove(),2200)}

export function initializeApp(){ensureRealismState(state);ensureChildhoodState(state);syncHouseholdMembership(state);if(initialized){render();return}initialized=true;saveState();render();if("serviceWorker" in navigator&&location.protocol!=="file:"){navigator.serviceWorker.getRegistrations().then(registrations=>registrations.forEach(registration=>registration.unregister())).catch(()=>{})}}

window.addEventListener("hashchange",render);
if(document.readyState==="loading")window.addEventListener("DOMContentLoaded",initializeApp,{once:true});else initializeApp();
