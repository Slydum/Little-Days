import { familyTreeContent } from "./family-ui.js";

const STORAGE_KEY = "little-days-save-v2";
let renderToken = 0;

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
  if (!state || !screen) return;
  if (token !== renderToken) return;
  screen.innerHTML = `${tabs()}${familyTreeContent(state)}`;
  bind(screen);
}

function scheduleRender() {
  const token = ++renderToken;
  setTimeout(() => {
    if (token !== renderToken) return;
    renderFamilyTree();
  }, 0);
}

window.addEventListener("hashchange", scheduleRender);
scheduleRender();
