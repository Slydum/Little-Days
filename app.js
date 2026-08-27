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
} from "./game/engine.js";
import {
  advanceRealism,
  deathSummary,
  ensureRealismState,
  getAroundYou,
  getBirthdayRecap,
  healthSnapshot,
} from "./game/realism.js";

const STORAGE_KEY = "little-days-save-v2";

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved?.version === 2 && saved.character && saved.household) return saved;
  } catch {}
  return createNewLife();
}

let state = ensureRealismState(loadState());
let toastTimer;
let initialized = false;
let selectedFamilyId = null;

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
  home: `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="m3 11 9-7 9 7"/><path d="M5 10v10h14V10M9 20v-6h6v6"/></svg>`,
  heart: `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M20.5 5.8c-2.2-2.2-5.6-1.8-7.5.8L12 8l-1-1.4C9.1 4 5.7 3.6 3.5 5.8 1 8.3 1.6 12.1 4 14.4L12 22l8-7.6c2.4-2.3 3-6.1.5-8.6Z"/></svg>`,
  moon: `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M20 15.2A8.5 8.5 0 0 1 8.8 4 8.5 8.5 0 1 0 20 15.2Z"/></svg>`,
  pen: `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="m4 20 4.4-1 9.7-9.7-3.4-3.4L5 15.6 4 20Z"/></svg>`,
  book: `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5.5c3.5-.8 6.2-.2 8 1.6v12c-1.8-1.8-4.5-2.4-8-1.6v-12ZM20 5.5c-3.5-.8-6.2-.2-8 1.6v12c1.8-1.8 4.5-2.4 8-1.6v-12Z"/></svg>`,
  family: `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="8" cy="8" r="2.5"/><circle cx="16.5" cy="8.5" r="2"/><path d="M3.5 18c.6-3.2 2.1-4.8 4.5-4.8s4 1.6 4.6 4.8M13 17.8c.5-2.4 1.7-3.6 3.7-3.6 1.9 0 3.2 1.2 3.8 3.6"/></svg>`,
  calendar: `<svg class="icon sm" viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="6" width="16" height="14" rx="1"/><path d="M8 4v4M16 4v4M4 10h16"/></svg>`,
  shield: `<svg class="icon sm" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 5 6v5c0 4.4 2.3 7.4 7 10 4.7-2.6 7-5.6 7-10V6l-7-3Z"/></svg>`,
};

const navItems = [["life", "Life"], ["people", "People"], ["self", "Self"], ["memories", "Memories"], ["more", "More"]];

function getRoute() { return location.hash.replace("#", "").trim() || "life"; }
function brand(title = "") { return `<p class="brand">Little Days</p>${title ? `<h1 class="page-title">${title}</h1>` : ""}`; }
function bottomNav(route) {
  const activeRoot = route === "family-tree" ? "people" : (["home", "school", "overview", "health"].includes(route) ? "more" : route);
  return `<nav class="bottom-nav" aria-label="Primary">${navItems.map(([key,label])=>`<button class="nav-button ${activeRoot===key?"active":""}" data-route="${key}" aria-label="${label}">${icons[key]}<span>${label}</span></button>`).join("")}</nav>`;
}
function shell(content, route) { return `<section class="screen">${content}</section>${bottomNav(route)}`; }
function categoryIcon(category) {
  const map = { School: icons.school, Family: icons.family, Friends: icons.people, Home: icons.home, Health: icons.moon, Interests: icons.pen, Money: icons.book, Self: icons.self };
  return map[category] || icons.life;
}

function aroundYouBlock() {
  const birthday = getBirthdayRecap(state), updates = getAroundYou(state);
  if (!birthday && !updates.length) return "";
  return `${birthday ? `<section class="data-section"><h2 class="section-title">You turned ${birthday.age}</h2>${birthday.items.map(item=>`<p class="body-note">${item}</p>`).join("")}</section>` : ""}${updates.length ? `<section class="data-section"><h2 class="section-title">Around you</h2>${updates.map(update=>`<div class="overview-row"><div>${categoryIcon(update.category)}</div><div><h3>${update.category}</h3><p>${update.text}</p></div></div>`).join("")}</section>` : ""}`;
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
  const event = getCurrentEvent(state), indicators = lifeIndicators(state), resolvedChoice = state.resolution?.choiceId;
  return shell(`${brand()}<h1 class="age-title">${getAgeLabel(state)}</h1><p class="date-line">${formatGameDate(state)}</p><div class="status-strip"><div class="status-item"><span class="status-dot"></span><div class="status-copy"><strong>Wellbeing</strong>${indicators.wellbeing}</div></div><div class="status-item"><span class="status-dot gold"></span><div class="status-copy"><strong>Energy</strong>${indicators.energy}</div></div><div class="status-item"><span class="status-dot"></span><div class="status-copy"><strong>Stress</strong>${indicators.stress}</div></div></div>${aroundYouBlock()}<div class="eyebrow">${categoryIcon(event.category)} ${event.category}</div><h2 class="event-title">${event.title}</h2><p class="event-copy">${event.body}</p><div class="divider"></div><p class="prompt">${event.prompt}</p><div class="choices">${event.choices.map(choice=>`<button class="choice-button ${resolvedChoice===choice.id?"primary":""}" data-choice="${choice.id}" ${state.resolution?"disabled":""}>${choice.label}</button>`).join("")}</div>${state.resolution?`<div class="result-card">${state.resolution.result}</div><button class="utility-button" id="continue-life">Continue</button>`:""}`,"life");
}

function familyTabs(active) {
  return `<div class="family-tabs" role="tablist" aria-label="People views"><button class="family-tab ${active==="people"?"active":""}" data-route="people">People</button><button class="family-tab ${active==="tree"?"active":""}" data-route="family-tree">Family tree</button></div>`;
}

function labelFor(person) {
  if (person.relationshipLabel) return person.relationshipLabel;
  return ({guardian:"Parent / Guardian",secondGuardian:"Parent / Guardian",grandmother:"Grandmother",grandfather:"Grandfather",sibling:"Sibling",aunt:"Aunt",uncle:"Uncle",cousin:"Cousin",friend:"Friend",teacher:"Teacher"})[person.role] || "Relative";
}

function peopleScreen() {
  const age = getAgeYears(state), people = getVisiblePeople(state);
  return shell(`${brand("People")}${familyTabs("people")}<div class="people-list">${people.map(person=>{
    const relation = person.deceased ? "Remembered" : relationshipLabel(person);
    const copy = person.deceased ? (person.npc?.currentThread || `${person.name} is no longer alive.`) : relationshipCopy(person);
    const meta = person.deceased ? `Died at age ${person.diedAtAge}` : person.role==="friend" ? `Known for — ${Math.max(0,age-5)} year${Math.max(0,age-5)===1?"":"s"}` : `Age — ${person.age+age}`;
    return `<article class="person-card"><div class="avatar">${person.name[0]}</div><div><h2 class="person-name">${person.name}</h2><p class="person-role">${labelFor(person)} — ${relation}</p><p class="person-copy">${copy}</p><p class="person-meta">${meta}</p></div></article>`;
  }).join("")}</div>`,"people");
}

function familyNode(person, extraClass="") {
  const age = getAgeYears(state);
  const status = person.deceased ? "Deceased" : `Age ${person.age + age}`;
  return `<button class="family-node ${extraClass} ${person.deceased?"deceased":""}" data-family-person="${person.id}"><span class="family-initial">${person.name[0]}</span><strong>${person.name}</strong><small>${labelFor(person)}</small><em>${status}</em></button>`;
}

function familyTreeScreen() {
  const visible = getVisiblePeople(state);
  const grandparents = visible.filter(p=>["grandmother","grandfather"].includes(p.role));
  const guardians = visible.filter(p=>["guardian","secondGuardian"].includes(p.role));
  const siblings = visible.filter(p=>p.role==="sibling");
  const aunties = visible.filter(p=>["aunt","uncle"].includes(p.role));
  const cousins = visible.filter(p=>p.role==="cousin");
  const selected = visible.find(p=>p.id===selectedFamilyId);
  const player = `<div class="family-node you"><span class="family-initial">${state.character.firstName[0]}</span><strong>${state.character.firstName} ${state.character.lastName}</strong><small>You</small><em>${getAgeLabel(state)}</em></div>`;
  const origin = state.family?.originStory || "This life began before you knew the names for any of these relationships.";
  const extended = aunties.length || cousins.length;

  const styles = `<style>
    .family-tabs{display:grid;grid-template-columns:1fr 1fr;margin:0 0 18px;border-bottom:1px solid var(--line)}
    .family-tab{border:0;background:transparent;padding:10px 6px;color:var(--muted);font-size:12px;cursor:pointer;border-bottom:2px solid transparent}
    .family-tab.active{color:var(--ink);font-weight:700;border-bottom-color:var(--sage)}
    .tree-intro{margin:0 0 18px;color:var(--muted);font-size:12px;line-height:1.5;text-align:center}
    .family-tree{position:relative;display:grid;gap:0;padding:4px 0 12px}
    .generation{position:relative;padding:12px 0 24px;text-align:center}
    .generation:not(:last-child)::after{content:"";position:absolute;left:50%;bottom:0;width:1px;height:24px;background:var(--line-strong)}
    .generation-label{margin:0 0 8px;color:var(--muted);font-size:9px;font-weight:800;letter-spacing:.09em;text-transform:uppercase}
    .family-row{display:flex;justify-content:center;align-items:stretch;gap:8px;flex-wrap:wrap;position:relative}
    .family-row.connected::before{content:"";position:absolute;top:-8px;left:16%;right:16%;height:1px;background:var(--line)}
    .family-node{width:min(142px,44%);min-height:102px;border:1px solid var(--line);border-radius:8px;background:#faf7ef;color:var(--ink);padding:10px 7px;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;cursor:pointer}
    .family-node.you{border-color:var(--sage);background:var(--sage-soft);cursor:default}
    .family-node.deceased{opacity:.64;border-style:dashed}
    .family-initial{width:31px;height:31px;border:1px solid var(--line-strong);border-radius:50%;display:grid;place-items:center;margin-bottom:6px;font-family:var(--serif);font-size:15px;background:var(--paper-strong)}
    .family-node strong{font-family:var(--serif);font-size:14px;line-height:1.15;font-weight:600}
    .family-node small{margin-top:4px;font-size:9px;color:var(--muted);line-height:1.2}
    .family-node em{margin-top:4px;font-size:9px;font-style:normal;color:#55574f}
    .extended-branch{margin-top:8px;padding-top:18px;border-top:1px solid var(--line)}
    .family-detail{margin:8px 0 18px;padding:13px;border:1px solid var(--line);border-radius:7px;background:#faf7ef}
    .family-detail h2{margin:0 0 4px;font-family:var(--serif);font-size:18px}
    .family-detail p{margin:3px 0;font-size:11px;line-height:1.45}
    .family-legend{display:flex;justify-content:center;gap:14px;margin:4px 0 14px;color:var(--muted);font-size:9px}
    .legend-mark{display:inline-block;width:15px;height:10px;border:1px solid var(--line-strong);border-radius:3px;margin-right:4px;vertical-align:-1px}
    .legend-mark.you{border-color:var(--sage);background:var(--sage-soft)}
    .legend-mark.dead{border-style:dashed}
  </style>`;

  return shell(`${styles}${brand("Family")}${familyTabs("tree")}<p class="tree-intro">${origin}</p><div class="family-legend"><span><i class="legend-mark you"></i>You</span><span><i class="legend-mark dead"></i>Deceased</span></div>${selected?`<section class="family-detail"><h2>${selected.name}</h2><p><strong>${labelFor(selected)}</strong></p><p>${selected.deceased ? (selected.npc?.currentThread || "This person is remembered in your family.") : relationshipCopy(selected)}</p></section>`:""}<div class="family-tree">${grandparents.length?`<section class="generation"><p class="generation-label">Grandparents</p><div class="family-row">${grandparents.map(p=>familyNode(p)).join("")}</div></section>`:""}${guardians.length?`<section class="generation"><p class="generation-label">Parents & guardians</p><div class="family-row ${guardians.length>1?"connected":""}">${guardians.map(p=>familyNode(p)).join("")}</div></section>`:""}<section class="generation"><p class="generation-label">Your generation</p><div class="family-row">${player}${siblings.map(p=>familyNode(p)).join("")}</div></section>${extended?`<section class="extended-branch"><p class="generation-label">Extended family</p>${aunties.length?`<div class="family-row">${aunties.map(p=>familyNode(p)).join("")}</div>`:""}${cousins.length?`<div class="family-row" style="margin-top:8px">${cousins.map(p=>familyNode(p)).join("")}</div>`:""}</section>`:"<p class="body-note" style="text-align:center">No extended relatives are known to you yet.</p>"}</div><p class="body-note">This tree shows the family you currently know about. New relatives, hidden branches, remarriages, births, deaths, and discoveries can change it as your life unfolds.</p>`,"family-tree");
}

function selfScreen() {
  const rows = personalityRows(state), traits = discoveredTraits(state);
  return shell(`${brand("Self")}<h2 class="section-title">Personality</h2><div class="personality-list">${rows.map(([left,right,value])=>`<div class="trait-line"><span>${left}</span><div class="trait-track" style="--value:${value}%"></div><span>${right}</span></div>`).join("")}</div><div class="divider"></div><h2 class="section-title">Discovered Traits</h2>${traits.length?traits.map(([name,copy])=>`<div class="discovered-trait"><strong>${name}</strong><p>${copy}</p></div>`).join(""):`<div class="discovered-trait"><strong>???</strong><p>You haven't learned enough about yourself yet.</p></div>`}`,"self");
}
function memoriesScreen() {
  const memories=[...state.memories].reverse();
  return shell(`${brand("Memories")}${memories.length?`<div class="memory-timeline">${memories.map(memory=>`<article class="memory-entry ${memory.featured?"featured":""}"><p class="memory-date">Age ${memory.age} · ${memory.date}</p><h2 class="memory-title">${memory.title}</h2><p class="memory-copy">${memory.copy}</p></article>`).join("")}</div>`:`<p class="body-note">Nothing has become a lasting memory yet.</p>`}`,"memories");
}
function homeScreen() {
  const age=getAgeYears(state), householdPeople=getVisiblePeople(state).filter(person=>["guardian","secondGuardian","sibling"].includes(person.role));
  return shell(`${brand()}<h1 class="home-title">Home</h1><h2 class="home-subtitle">${state.household.name}</h2><p class="kicker-copy">${state.household.housing}<br />${state.household.city}, ${state.household.country}</p><section class="data-section"><h3 class="data-heading">Household</h3><div class="data-row"><span class="initial-chip">${state.character.firstName[0]}</span><span class="label">You · ${state.character.firstName}</span><span class="value">${age}</span></div>${householdPeople.map(person=>`<div class="data-row"><span class="initial-chip">${person.name[0]}</span><span class="label">${person.name} · ${labelFor(person)}</span><span class="value">${person.deceased?"Remembered":person.age+age}</span></div>`).join("")}</section><section class="data-section"><h3 class="data-heading">Home Life</h3><div class="data-row">${icons.home}<span class="label">Comfort</span><span class="value">${state.household.comfort}</span></div><div class="data-row">${icons.shield}<span class="label">Privacy</span><span class="value">${state.household.privacy}</span></div><div class="data-row">${icons.book}<span class="label">Finances</span><span class="value">${state.household.financeBand}</span></div><div class="data-row">${icons.people}<span class="label">Neighborhood</span><span class="value">${state.household.neighborhood}</span></div></section>`,"home");
}
function schoolScreen() {
  const school=schoolSnapshot(state);
  if(!school)return shell(`${brand()}<h1 class="page-title">School</h1><p class="body-note">School has not started yet. For now, most of your world is still home and family.</p>`,"school");
  return shell(`${brand()}<h1 class="page-title">${school.grade}</h1><table class="subject-table"><caption>Subjects</caption><tbody>${school.subjects.map(([subject,status])=>`<tr><td>${subject}</td><td>${status}</td></tr>`).join("")}</tbody></table><section class="data-section"><div class="data-row">${icons.self}<span class="label">Teacher</span><span class="value">${school.teacher}</span></div><div class="data-row">${icons.book}<span class="label">Closest school friend</span><span class="value">${school.friend}</span></div><div class="data-row">${icons.calendar}<span class="label">Current term</span><span class="value">${school.term}</span></div></section>`,"school");
}
function healthScreen() {
  const health=healthSnapshot(state);
  return shell(`${brand("Health")}<p class="life-feeling-label">Your body and mind</p><p class="life-feeling">Health is something that happens over time, not a single score.</p><section class="data-section"><h3 class="data-heading">Physical health</h3><p class="body-note">${health.physical}</p>${health.known.length?health.known.map(item=>`<div class="data-row">${icons.moon}<span class="label">Known condition</span><span class="value">${item}</span></div>`).join(""):""}</section><section class="data-section"><h3 class="data-heading">Emotional health</h3><p class="body-note">${health.emotional}</p></section><section class="data-section"><h3 class="data-heading">Healthcare</h3><div class="data-row">${icons.shield}<span class="label">Access</span><span class="value">${health.care}</span></div></section>`,"health");
}
function overviewScreen() {
  const overview=lifeOverview(state), rows=[[icons.family,"Family",overview.rows.family],[icons.book,"School",overview.rows.school],[icons.heart,"Friends",overview.rows.friends],[icons.moon,"Health",healthSnapshot(state).physical],[icons.pen,"Interests",overview.rows.interests],[icons.home,"Home",overview.rows.home]];
  return shell(`${brand("Life")}<p class="life-feeling-label">Life lately</p><p class="life-feeling">${overview.feeling}</p><div>${rows.map(([icon,title,copy])=>`<article class="overview-row"><div>${icon}</div><div><h3>${title}</h3><p>${copy}</p></div></article>`).join("")}</div>`,"overview");
}
function moreScreen() {
  const links=[["home",icons.home,"Home","Household, comfort, privacy, and neighborhood."],["school",icons.book,"School","Subjects, teacher, friends, and current term."],["health",icons.moon,"Health","Physical conditions, emotional health, and access to care."],["overview",icons.life,"Life overview","A quiet summary of what life currently feels like."]];
  return shell(`${brand("More")}<div class="more-panel">${links.map(([route,icon,title,copy])=>`<button class="more-link" data-route="${route}"><span>${icon}</span><span><strong>${title}</strong>${copy}</span><span class="chevron">›</span></button>`).join("")}</div><p class="body-note">Playing as <strong>${state.character.firstName} ${state.character.lastName}</strong>, born in ${state.character.birthplace}. ${interestSummary(state)}</p><button class="utility-button" data-new-life>Begin a different life</button>`,"more");
}

const screens={life:lifeScreen,people:peopleScreen,"family-tree":familyTreeScreen,self:selfScreen,memories:memoriesScreen,more:moreScreen,home:homeScreen,school:schoolScreen,health:healthScreen,overview:overviewScreen};
function render(){ensureRealismState(state);const route=getRoute(),screen=screens[route]||screens.life;document.querySelector("#app").innerHTML=screen();bindEvents()}
function startNewLife(){if(!window.confirm("Begin a different life? Your current childhood will be replaced."))return;state=ensureRealismState(createNewLife());saveState();location.hash="life";render();showToast(`A new life begins. Meet ${state.character.firstName}.`)}
function bindEvents(){
  document.querySelectorAll("[data-route]").forEach(button=>button.addEventListener("click",()=>{const route=button.dataset.route;if(route!==getRoute())location.hash=route}));
  document.querySelectorAll("[data-choice]").forEach(button=>button.addEventListener("click",()=>{resolveChoice(state,button.dataset.choice);saveState();render();showToast("Choice remembered.")}));
  document.querySelector("#continue-life")?.addEventListener("click",()=>{const before=state.character.ageMonths;continueLife(state);const elapsed=Math.max(0,state.character.ageMonths-before);advanceRealism(state,elapsed,before);saveState();render();window.scrollTo({top:0,behavior:"smooth"})});
  document.querySelectorAll("[data-new-life]").forEach(button=>button.addEventListener("click",startNewLife));
  document.querySelectorAll("[data-family-person]").forEach(button=>button.addEventListener("click",()=>{selectedFamilyId=button.dataset.familyPerson;render();window.scrollTo({top:0,behavior:"smooth"})}));
}
function showToast(message){clearTimeout(toastTimer);document.querySelector(".toast")?.remove();const toast=document.createElement("div");toast.className="toast";toast.setAttribute("role","status");toast.textContent=message;document.body.appendChild(toast);toastTimer=setTimeout(()=>toast.remove(),2200)}
export function initializeApp(){ensureRealismState(state);if(initialized){render();return}initialized=true;saveState();render();if("serviceWorker" in navigator&&location.protocol!=="file:"){navigator.serviceWorker.getRegistrations().then(registrations=>registrations.forEach(registration=>registration.unregister())).catch(()=>{})}}
window.addEventListener("hashchange",render);
if(document.readyState==="loading")window.addEventListener("DOMContentLoaded",initializeApp,{once:true});else initializeApp();