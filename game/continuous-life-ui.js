import {
  continueLife,
  formatGameDate,
  getAgeLabel,
  getCurrentEvent,
  resolveChoice,
} from "./engine.js?v=24";
import {
  advanceRealism,
  ensureRealismState,
} from "./realism.js?v=24";
import {
  contextualEventForState,
  resolveContextualChoice,
} from "./contextual-events.js?v=24";
import { syncHouseholdMembership } from "./household-membership.js?v=24";
import {
  advanceChildhoodWorld,
  childhoodEventForState,
  ensureChildhoodState,
} from "./childhood-v2.js?v=24";
import { resolveChildhoodChoice } from "./childhood-v2-resolve.js?v=24";

const STORAGE_KEY = "little-days-save-v2";
let displayedEventInfo = null;

function readState() {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!value?.version || !value.character || !value.household) return null;
    return ensureChildhoodState(syncHouseholdMembership(ensureRealismState(value)));
  } catch {
    return null;
  }
}

function saveState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  const normalized = readState() || state;
  window.dispatchEvent(new CustomEvent("little-days-state-sync", { detail: { state: normalized } }));
  return normalized;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function route() {
  return location.hash.replace(/^#/, "").trim() || "life";
}

function eventInfo(state) {
  const contextualEvent = contextualEventForState(state);
  const childhoodEvent = state.resolution?.childhoodEvent || childhoodEventForState(state);
  const contextualHasPriority = contextualEvent && ["illness", "recovery", "thread", "development"].includes(contextualEvent.contextKind);
  const event = contextualHasPriority ? contextualEvent : (childhoodEvent || contextualEvent || getCurrentEvent(state));
  const kind = childhoodEvent && event === childhoodEvent
    ? "childhood"
    : contextualEvent && event === contextualEvent
      ? "context"
      : "core";
  return { event, kind };
}

function choiceAttribute(kind) {
  if (kind === "childhood") return "data-childhood-choice";
  if (kind === "context") return "data-context-choice";
  return "data-choice";
}

function buttonChoiceId(button) {
  return button?.dataset?.childhoodChoice || button?.dataset?.contextChoice || button?.dataset?.choice || null;
}

function rememberRenderedEvent(state) {
  if (route() !== "life" || !state || state.resolution) return;
  const choices = [...document.querySelectorAll(".screen .choices .choice-button")];
  if (!choices.length) return;

  const info = eventInfo(state);
  const eventChoices = info.event?.choices || [];
  const domIds = choices.map(buttonChoiceId);
  const eventIds = eventChoices.map((choice) => choice.id);

  // Only remember the event if it actually matches what is on screen. This is the
  // important bit: background systems are allowed to update state, but a tap must
  // still resolve the question the player can see rather than a newer hidden one.
  if (domIds.length !== eventIds.length || domIds.some((id, index) => id !== eventIds[index])) return;

  displayedEventInfo = {
    event: info.event,
    kind: info.kind,
    ageMonths: state.character?.ageMonths ?? null,
  };
}

function eventAnchor() {
  const title = document.querySelector(".screen .event-title");
  if (!title) return null;
  return { element: title, top: title.getBoundingClientRect().top };
}

function restoreAnchor(anchor) {
  if (!anchor?.element?.isConnected) return;
  requestAnimationFrame(() => {
    if (!anchor.element.isConnected) return;
    const delta = anchor.element.getBoundingClientRect().top - anchor.top;
    if (Math.abs(delta) > 1) window.scrollBy({ top: delta, left: 0, behavior: "auto" });
  });
}

function setEyebrowCategory(category) {
  const eyebrow = document.querySelector(".screen .eyebrow");
  if (!eyebrow) return;
  const icon = eyebrow.querySelector("svg")?.outerHTML || "";
  eyebrow.innerHTML = `${icon}${icon ? " " : ""}${escapeHtml(category || "Life")}`;
}

function removeResolutionUi() {
  document.querySelector(".screen .result-card")?.remove();
  document.querySelector(".screen #continue-life")?.remove();
}

function renderChoices(event, kind) {
  const choices = document.querySelector(".screen .choices");
  if (!choices || !event) return;
  const attr = choiceAttribute(kind);
  choices.innerHTML = (event.choices || []).map((choice) => (
    `<button class="choice-button" ${attr}="${escapeHtml(choice.id)}" aria-pressed="false">${escapeHtml(choice.label)}</button>`
  )).join("");
}

function patchPrompt(state) {
  if (route() !== "life") return;
  const screen = document.querySelector(".screen");
  if (!screen) return;

  if (state.death || state.completed) {
    // End-of-life / stage-complete screens have a different structure. They are
    // rare enough to let the normal app render them when the route changes.
    window.dispatchEvent(new HashChangeEvent("hashchange"));
    return;
  }

  const { event, kind } = eventInfo(state);
  if (!event) return;
  const anchor = eventAnchor();

  const age = screen.querySelector(".age-title");
  const date = screen.querySelector(".date-line");
  const title = screen.querySelector(".event-title");
  const copy = screen.querySelector(".event-copy");
  const prompt = screen.querySelector(".prompt");

  if (age) age.textContent = getAgeLabel(state);
  if (date) date.textContent = formatGameDate(state);
  setEyebrowCategory(event.category);
  if (title) title.textContent = event.title;
  if (copy) copy.textContent = event.body;
  if (prompt) prompt.textContent = event.prompt;

  removeResolutionUi();
  renderChoices(event, kind);
  displayedEventInfo = {
    event,
    kind,
    ageMonths: state.character?.ageMonths ?? null,
  };
  restoreAnchor(anchor);
}

function showResolution(state, clickedButton) {
  const choices = clickedButton?.closest(".choices") || document.querySelector(".screen .choices");
  if (!choices || !state.resolution) return;
  const selected = state.resolution.choiceId;

  choices.querySelectorAll(".choice-button").forEach((button) => {
    const id = buttonChoiceId(button);
    const isSelected = id === selected;
    button.disabled = true;
    button.classList.toggle("primary", isSelected);
    button.setAttribute("aria-pressed", String(isSelected));
  });

  let result = choices.nextElementSibling;
  if (!result || !result.classList.contains("result-card")) {
    result = document.createElement("div");
    result.className = "result-card";
    choices.insertAdjacentElement("afterend", result);
  }
  result.innerHTML = state.resolution.result || "Your choice becomes part of what happens next.";

  let next = result.nextElementSibling;
  if (!next || next.id !== "continue-life") {
    next = document.createElement("button");
    next.id = "continue-life";
    next.className = "utility-button";
    next.textContent = "Continue";
    result.insertAdjacentElement("afterend", next);
  }
}

function resolveFromButton(button) {
  const state = readState();
  if (!state || state.resolution || button.disabled) return;

  const rendered = displayedEventInfo?.ageMonths === state.character?.ageMonths
    ? displayedEventInfo
    : null;

  if (button.dataset.childhoodChoice) {
    const displayedChildhoodEvent = rendered?.kind === "childhood" ? rendered.event : null;
    resolveChildhoodChoice(state, button.dataset.childhoodChoice, displayedChildhoodEvent);
  } else if (button.dataset.contextChoice) {
    resolveContextualChoice(state, button.dataset.contextChoice);
  } else if (button.dataset.choice) {
    resolveChoice(state, button.dataset.choice);
  } else {
    return;
  }

  // If a background system really did invalidate the visible question, do not eat
  // the tap and leave a dead-looking button. Replace the stale prompt with the real
  // current one so the next action is unambiguous.
  if (!state.resolution) {
    patchPrompt(state);
    return;
  }

  const fresh = saveState(state);
  showResolution(fresh, button);
}

function continueInPlace() {
  let state = readState();
  if (!state || !state.resolution) return;

  const before = state.character.ageMonths;
  continueLife(state);
  const elapsed = Math.max(0, state.character.ageMonths - before);
  advanceChildhoodWorld(state, elapsed, before);
  advanceRealism(state, elapsed, before);
  syncHouseholdMembership(state);
  state = saveState(state);
  patchPrompt(state);
}

function interceptLifeClicks(event) {
  if (route() !== "life") return;
  const target = event.target.closest?.("#continue-life,[data-childhood-choice],[data-context-choice],[data-choice]");
  if (!target) return;

  // Keep the life screen mounted between prompts, but resolve the event the player
  // actually saw. State can evolve behind the scenes; invisible questions do not get
  // to steal clicks from visible ones. Civilization advances by several millimeters.
  event.preventDefault();
  event.stopImmediatePropagation();

  if (target.id === "continue-life") continueInPlace();
  else resolveFromButton(target);
}

function watchRenderedPrompt() {
  const root = document.querySelector("#app");
  if (!root) return;

  const capture = () => {
    const state = readState();
    if (state) rememberRenderedEvent(state);
  };

  capture();
  const observer = new MutationObserver(capture);
  observer.observe(root, { childList: true, subtree: true });
}

document.addEventListener("click", interceptLifeClicks, true);
watchRenderedPrompt();
