import { familyTreeContent } from "./family-ui.js";
import { schoolWorldSnapshot, socialSnapshot } from "./childhood-v2.js?v=23";
import { refreshLifeEnhancer } from "./life-enhancer.js?v=24";

const STORAGE_KEY = "little-days-save-v2";
let renderToken = 0;
let scheduled = false;

function readState() {
  try {
    const state = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return state?.version === 2 ? state : null;
  } catch {
    return null;
  }
}

function tabs() {
  return `<style>
    .people-tabs{display:grid;grid-template-columns:1fr 1fr;margin:-4px 0 10px;border-bottom:1px solid var(--line)}
    .people-tab{-webkit-appearance:none;appearance:none;border:0;border-bottom:2px solid transparent;background:transparent;color:var(--muted);padding:10px 6px;font:inherit;font-size:11px;cursor:pointer}
    .people-tab.active{color:var(--ink);border-bottom-color:var(--sage);font-weight:700}
  </style>
  <p class="brand">Little Days</p>
  <h1 class="page-title">Family</h1>
  <div class="people-tabs" aria-label="People views">
    <button class="people-tab" data-enhancer-route="people">People</button>
    <button class="people-tab active" data-enhancer-route="family-tree">Family tree</button>
  </div>`;
}

function bind(screen) {
  screen.querySelectorAll("[data-enhancer-route]").forEach((button) => {
    button.addEventListener("click", () => {
      const route = button.dataset.enhancerRoute;
      if (route && route !== location.hash.replace("#", "")) location.hash = route;
    });
  });
  screen.querySelectorAll("[data-person-id]").forEach((button) => {
    button.addEventListener("click", () => {
      location.hash = `person/${encodeURIComponent(button.dataset.personId)}`;
    });
  });
}

function renderFamilyTree() {
  if (location.hash.replace("#", "") !== "family-tree") return;
  const token = ++renderToken;
  const state = readState();
  const screen = document.querySelector(".screen");
  if (!state || !screen || token !== renderToken) return;
  screen.innerHTML = `${tabs()}${familyTreeContent(state)}`;
  bind(screen);
}

function scoreWord(value) {
  if (value >= 78) return "Strong";
  if (value >= 64) return "Steady";
  if (value >= 48) return "Mixed";
  return "Struggling";
}

function schoolPanel(state) {
  const school = schoolWorldSnapshot(state);
  const social = socialSnapshot(state);
  if (!school) return "";
  const friendRows = social.friendTiers.slice(0, 6).map(({ person, tier }) => `
    <button class="school-peer-row" data-person-id="${person.id}">
      <span class="school-peer-name">${person.name}</span>
      <span class="school-peer-tier">${tier}</span>
    </button>`).join("");
  const rivalRows = school.rivals.slice(0, 3).map((person) => `
    <button class="school-peer-row" data-person-id="${person.id}">
      <span class="school-peer-name">${person.name}</span>
      <span class="school-peer-tier">Rival / tense</span>
    </button>`).join("");
  const activities = school.activities.length
    ? school.activities.map((activity) => `<span class="school-pill">${activity.label}${activity.assisted ? " · assisted" : ""}</span>`).join("")
    : `<span class="school-muted">No regular extracurricular activity yet.</span>`;
  const recap = school.recentRecap ? `<section class="school-v2-section"><h2>Last school year</h2><p>${school.recentRecap.text}</p></section>` : "";
  const crush = social.crush ? `<div class="school-v2-row"><span>Crush</span><strong>${social.crush.name.split(" ")[0]}${social.crushReciprocity === "mutual" ? " · mutual" : social.crushReciprocity === "possible" ? " · maybe mutual" : ""}</strong></div>` : "";
  return `<style>
    .school-world-v2-panel{margin-top:20px;padding-top:2px;border-top:1px solid var(--line)}
    .school-v2-heading{margin:18px 0 6px;font-family:var(--serif);font-size:18px;font-weight:500}
    .school-v2-section{margin-top:18px}.school-v2-section h2{margin:0 0 7px;font-family:var(--serif);font-size:16px;font-weight:500}.school-v2-section p{margin:0;color:var(--muted);font-size:11px;line-height:1.5}
    .school-v2-row{display:flex;justify-content:space-between;gap:14px;padding:8px 0;border-top:1px solid var(--line);font-size:11px}.school-v2-row strong{font-weight:600;text-align:right}
    .school-peer-row{-webkit-appearance:none;appearance:none;width:100%;display:flex;justify-content:space-between;gap:12px;padding:9px 0;border:0;border-top:1px solid var(--line);background:transparent;color:var(--ink);font:inherit;text-align:left;cursor:pointer}.school-peer-name{font-family:var(--serif);font-size:13px}.school-peer-tier{color:var(--muted);font-size:10px;text-align:right}
    .school-pill{display:inline-block;margin:2px 5px 2px 0;padding:5px 8px;border:1px solid var(--line);border-radius:999px;font-size:9px}.school-muted{color:var(--muted);font-size:10px}
  </style>
  <div class="school-world-v2-panel">
    <h2 class="school-v2-heading">School life</h2>
    <div class="school-v2-row"><span>Overall progress</span><strong>${scoreWord(school.overallPerformance)}</strong></div>
    <div class="school-v2-row"><span>Attendance</span><strong>${school.attendance}%</strong></div>
    <div class="school-v2-row"><span>Effort</span><strong>${scoreWord(school.effort)}</strong></div>
    <div class="school-v2-row"><span>Teacher support</span><strong>${scoreWord(school.teacherSupport)}</strong></div>
    <div class="school-v2-row"><span>Known classmates this year</span><strong>${school.classSizeKnown}</strong></div>
    ${crush}
    <section class="school-v2-section"><h2>Your social circle</h2>${friendRows || `<p>Friendships are still forming.</p>`}${rivalRows}</section>
    <section class="school-v2-section"><h2>Activities</h2><div>${activities}</div></section>
    ${recap}
  </div>`;
}

function renderSchoolEnhancement() {
  if (location.hash.replace("#", "") !== "school") return;
  const state = readState();
  const screen = document.querySelector(".screen");
  if (!state || !screen || screen.querySelector(".school-world-v2-panel")) return;
  const panel = schoolPanel(state);
  if (!panel) return;
  screen.insertAdjacentHTML("beforeend", panel);
  bind(screen);
}

function renderEnhancements() {
  refreshLifeEnhancer();
  renderFamilyTree();
  renderSchoolEnhancement();
}

function scheduleRender() {
  if (scheduled) return;
  scheduled = true;
  setTimeout(() => {
    scheduled = false;
    renderEnhancements();
  }, 0);
}

window.addEventListener("hashchange", scheduleRender);
const app = document.querySelector("#app");
if (app) new MutationObserver(scheduleRender).observe(app, { childList: true, subtree: true });
scheduleRender();
