import { continueLife } from "./engine.js?v=24";
import { advanceRealism, ensureRealismState } from "./realism.js?v=24";
import { contextualEventForState } from "./contextual-events.js?v=24";
import { syncHouseholdMembership } from "./household-membership.js?v=24";
import { advanceChildhoodWorld, ensureChildhoodState } from "./childhood-v2.js?v=24";
import {
  advanceChallengeWorld,
  challengeEventForState,
  challengeSnapshot,
  ensureChallengeState,
  resolveChallengeChoice,
} from "./challenge-layer.js?v=1";

const STORAGE_KEY = "little-days-save-v2";
const urgentContextKinds = new Set(["illness", "recovery", "thread", "development"]);
let applying = false;
let observer = null;

function readState() {
  try {
    const state = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!state?.character || !state?.household) return null;
    return ensureChallengeState(ensureChildhoodState(syncHouseholdMembership(ensureRealismState(state))));
  } catch {
    return null;
  }
}

function writeState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  window.dispatchEvent(new CustomEvent("little-days-state-sync", { detail: { state } }));
}

function getLifeScreen() {
  if ((location.hash.replace("#", "").trim() || "life") !== "life") return null;
  return document.querySelector("#app .screen");
}

function goalTone(goal) {
  if (goal.status === "On track") return "good";
  if (goal.status === "Close") return "close";
  return "risk";
}

function goalsMarkup(snapshot) {
  if (!snapshot.goals.length) return "";
  return `<div class="challenge-goals">
    <div class="challenge-panel-head">
      <div><span class="challenge-kicker">What you're trying to do</span><strong>Goals before your next birthday</strong></div>
      <span class="challenge-capacity" title="Capacity recovers gradually as life advances">Capacity ${snapshot.capacity}/${snapshot.maxCapacity}</span>
    </div>
    ${snapshot.goals.map((goal) => {
      const width = Math.min(100, Math.max(4, Math.round((goal.progress / goal.target) * 100)));
      return `<div class="challenge-goal ${goalTone(goal)}">
        <div class="challenge-goal-copy"><span>${goal.label}</span><strong>${goal.status}</strong></div>
        <div class="challenge-goal-track"><i style="width:${width}%"></i></div>
        <small>${goal.progress} / ${goal.target}${snapshot.activeArcs ? ` · ${snapshot.activeArcs} unresolved thread${snapshot.activeArcs === 1 ? "" : "s"}` : ""}</small>
      </div>`;
    }).join("")}
  </div>`;
}

function choiceMarkup(choice, selectedId, resolved) {
  const selected = selectedId === choice.id;
  return `<button class="challenge-choice ${selected ? "selected" : ""}" data-challenge-layer-choice="${choice.id}" ${resolved || choice.disabled ? "disabled" : ""} aria-pressed="${selected}">
    <span>${choice.label}</span>
    ${choice.hint ? `<small>${choice.hint}</small>` : ""}
  </button>`;
}

function eventMarkup(state, event, snapshot) {
  const resolved = Boolean(state.resolution?.challengeEventId);
  const selectedId = state.resolution?.choiceId || null;
  return `<section class="challenge-event" aria-label="Current challenge">
    <div class="challenge-event-meta"><span>Pressure moment</span><span>${snapshot.capacity}/${snapshot.maxCapacity} capacity</span></div>
    <h2>${event.title}</h2>
    <p>${event.body}</p>
    <div class="challenge-rule"></div>
    <p class="challenge-prompt">${event.prompt}</p>
    <div class="challenge-choices">${event.choices.map((choice) => choiceMarkup(choice, selectedId, resolved)).join("")}</div>
    ${resolved ? `<div class="challenge-result ${state.resolution.challengeOutcome === false ? "failure" : state.resolution.challengeOutcome === true ? "success" : ""}">${state.resolution.result}</div><button class="challenge-continue" id="challenge-layer-continue">Continue</button>` : ""}
  </section>`;
}

function urgentContextExists(state) {
  if (state.resolution?.challengeEventId) return false;
  const contextual = contextualEventForState(state);
  return Boolean(contextual && urgentContextKinds.has(contextual.contextKind));
}

function hideUnderlyingEvent(screen, hidden) {
  const selectors = [".eyebrow", ".event-title", ".event-copy", ".prompt", ".choices", ".result-card", "#continue-life"];
  for (const selector of selectors) {
    screen.querySelectorAll(`:scope > ${selector}`).forEach((node) => node.classList.toggle("challenge-hidden", hidden));
  }
  const directDividers = [...screen.children].filter((node) => node.classList?.contains("divider"));
  if (directDividers.length) directDividers[directDividers.length - 1].classList.toggle("challenge-hidden", hidden);
}

function signature(state, event, snapshot) {
  return [
    state.character.ageMonths,
    state.resolution?.choiceId || "",
    state.resolution?.result || "",
    event?.id || "",
    snapshot.capacity,
    snapshot.goals.map((goal) => `${goal.id}:${goal.progress}:${goal.status}`).join("|"),
  ].join("::");
}

function bindPanelEvents(panel) {
  panel.querySelectorAll("[data-challenge-layer-choice]").forEach((button) => {
    button.addEventListener("click", () => {
      if (button.disabled) return;
      const state = readState();
      if (!state || state.resolution) return;
      resolveChallengeChoice(state, button.dataset.challengeLayerChoice);
      writeState(state);
      applyChallengeUI(true);
    }, { once: true });
  });

  panel.querySelector("#challenge-layer-continue")?.addEventListener("click", () => {
    const state = readState();
    if (!state?.resolution?.challengeEventId) return;
    const before = state.character.ageMonths;
    continueLife(state);
    const elapsed = Math.max(0, state.character.ageMonths - before);
    advanceChildhoodWorld(state, elapsed, before);
    advanceRealism(state, elapsed, before);
    advanceChallengeWorld(state, elapsed, before);
    syncHouseholdMembership(state);
    writeState(state);
    window.dispatchEvent(new Event("hashchange"));
    requestAnimationFrame(() => applyChallengeUI(true));
  }, { once: true });
}

function applyChallengeUI(force = false) {
  if (applying) return;
  const screen = getLifeScreen();
  const state = readState();
  if (!screen || !state || state.death || state.completed || state.introPending) return;

  const snapshot = challengeSnapshot(state);
  const urgent = urgentContextExists(state);
  const event = state.resolution?.challengeEvent || (!urgent ? challengeEventForState(state) : null);
  const sig = signature(state, event, snapshot);
  const existing = screen.querySelector("#challenge-layer-panel");
  if (!force && existing && existing.dataset.signature === sig) return;

  applying = true;
  try {
    existing?.remove();
    hideUnderlyingEvent(screen, Boolean(event));

    if (!snapshot.goals.length && !event) return;
    const panel = document.createElement("div");
    panel.id = "challenge-layer-panel";
    panel.dataset.signature = sig;
    panel.innerHTML = `${goalsMarkup(snapshot)}${event ? eventMarkup(state, event, snapshot) : ""}`;

    const aroundSlot = screen.querySelector("#around-you-slot");
    if (aroundSlot) aroundSlot.insertAdjacentElement("afterend", panel);
    else screen.insertAdjacentElement("afterbegin", panel);
    bindPanelEvents(panel);
  } finally {
    applying = false;
  }
}

function installStyles() {
  if (document.querySelector("#challenge-layer-styles")) return;
  const style = document.createElement("style");
  style.id = "challenge-layer-styles";
  style.textContent = `
    .challenge-hidden{display:none!important}
    #challenge-layer-panel{margin:14px 0 18px}
    .challenge-goals{border:1px solid var(--line);border-radius:14px;padding:13px 14px;background:rgba(255,255,255,.28);margin-bottom:16px}
    .challenge-panel-head{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;margin-bottom:12px}
    .challenge-panel-head strong{display:block;font-family:var(--serif);font-size:17px;font-weight:500;line-height:1.15;margin-top:2px}
    .challenge-kicker{display:block;color:var(--muted);font-size:9px;text-transform:uppercase;letter-spacing:.08em}
    .challenge-capacity{flex:0 0 auto;border:1px solid var(--line-strong);border-radius:999px;padding:5px 8px;color:var(--ink);font-size:9px;background:var(--paper,#f7f2e8)}
    .challenge-goal{padding:9px 0;border-top:1px solid var(--line)}
    .challenge-goal-copy{display:flex;justify-content:space-between;gap:12px;font-size:11px;line-height:1.3}
    .challenge-goal-copy strong{font-size:9px;text-transform:uppercase;letter-spacing:.05em;font-weight:700}
    .challenge-goal.risk .challenge-goal-copy strong{font-weight:800}
    .challenge-goal-track{height:4px;border-radius:999px;background:rgba(0,0,0,.07);overflow:hidden;margin:6px 0 4px}
    .challenge-goal-track i{display:block;height:100%;background:var(--sage);border-radius:inherit}
    .challenge-goal.risk .challenge-goal-track i{opacity:.55}
    .challenge-goal small{display:block;color:var(--muted);font-size:9px}
    .challenge-event{border-top:1px solid var(--line-strong);padding-top:18px}
    .challenge-event-meta{display:flex;justify-content:space-between;gap:12px;color:var(--muted);font-size:9px;text-transform:uppercase;letter-spacing:.08em;margin-bottom:9px}
    .challenge-event h2{font-family:var(--serif);font-size:27px;line-height:1.08;font-weight:500;margin:0 0 10px}
    .challenge-event>p{font-size:13px;line-height:1.6;margin:0;color:var(--ink)}
    .challenge-rule{height:1px;background:var(--line);margin:17px 0}
    .challenge-event .challenge-prompt{font-weight:700;font-size:12px;margin-bottom:10px}
    .challenge-choices{display:grid;gap:8px}
    .challenge-choice{-webkit-appearance:none;appearance:none;width:100%;border:1px solid var(--line-strong);border-radius:11px;background:transparent;color:var(--ink);text-align:left;padding:12px 13px;font:inherit;cursor:pointer}
    .challenge-choice span{display:block;font-size:12px;font-weight:650;line-height:1.3}
    .challenge-choice small{display:block;color:var(--muted);font-size:9px;line-height:1.35;margin-top:4px}
    .challenge-choice.selected{background:rgba(113,129,105,.1);border-color:var(--sage)}
    .challenge-choice:disabled:not(.selected){opacity:.45;cursor:not-allowed}
    .challenge-result{margin-top:12px;border-left:2px solid var(--line-strong);padding:10px 12px;background:rgba(255,255,255,.3);font-size:12px;line-height:1.5}
    .challenge-result.success{border-left-color:var(--sage)}
    .challenge-result.failure{border-left-color:#947465}
    .challenge-continue{-webkit-appearance:none;appearance:none;width:100%;margin-top:11px;border:0;border-radius:10px;background:var(--ink);color:var(--paper,#f7f2e8);padding:12px;font:inherit;font-size:12px;font-weight:700;cursor:pointer}
  `;
  document.head.appendChild(style);
}

function install() {
  installStyles();
  observer = new MutationObserver(() => requestAnimationFrame(() => applyChallengeUI(false)));
  const app = document.querySelector("#app");
  if (app) observer.observe(app, { childList: true, subtree: true });
  window.addEventListener("hashchange", () => requestAnimationFrame(() => applyChallengeUI(true)));
  window.addEventListener("little-days-state-sync", () => requestAnimationFrame(() => applyChallengeUI(true)));
  requestAnimationFrame(() => applyChallengeUI(true));
}

if (document.readyState === "loading") window.addEventListener("DOMContentLoaded", install, { once: true });
else install();
