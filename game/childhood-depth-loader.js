import {
  availableRelationshipActions,
  ensureChildhoodDepth,
  npcKnowledgeSnapshot,
  queueRelationshipInteraction,
} from "./childhood-depth.js?v=1";

const STORAGE_KEY = "little-days-save-v2";
let scheduled = false;

function readState() {
  try {
    const state = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return state?.version === 2 ? state : null;
  } catch {
    return null;
  }
}

function writeState(state) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { /* save may be unavailable */ }
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function currentPersonId() {
  const route = location.hash.replace(/^#/, "");
  return route.startsWith("person/") ? decodeURIComponent(route.slice(7)) : null;
}

function knowledgeHtml(snapshot) {
  const known = snapshot?.known || [];
  if (!known.length) return `<p>You know them, but you have not learned enough yet to reduce them to a neat little personality card. Spend time together and ordinary details will become clearer.</p>`;
  return `${known.map((fact) => `<div class="depth-known-fact"><strong>${escapeHtml(fact.label)}</strong><p>${escapeHtml(fact.copy)}</p></div>`).join("")}${snapshot.unknownCount ? `<p class="depth-unknown-note">There are still things about them you do not know.</p>` : ""}`;
}

function actionHtml(actions, blocked) {
  if (blocked) return `<p>Finish the current moment before starting another interaction.</p>`;
  if (!actions.length) return `<p>You have already spent deliberate time with people in this part of life. More relationship time becomes available as the calendar moves.</p>`;
  return `<div class="depth-actions">${actions.map((action) => `<button class="depth-action-button" data-depth-action="${escapeHtml(action.id)}">${escapeHtml(action.label)}</button>`).join("")}</div><p class="depth-action-note">These are optional. Choosing someone repeatedly is one way a relationship becomes central to your life.</p>`;
}

function installStyles(screen) {
  if (screen.querySelector("#childhood-depth-styles")) return;
  screen.insertAdjacentHTML("afterbegin", `<style id="childhood-depth-styles">
    .depth-known-fact{padding:9px 0;border-top:1px solid var(--line)}.depth-known-fact:first-of-type{border-top:0}.depth-known-fact strong{display:block;margin-bottom:3px;font-family:var(--serif);font-size:13px;font-weight:500}.depth-known-fact p,.depth-unknown-note,.depth-action-note{margin:0;color:var(--muted);font-size:10px;line-height:1.5}.depth-unknown-note{margin-top:8px;font-style:italic}.depth-actions{display:grid;gap:7px;margin-top:8px}.depth-action-button{-webkit-appearance:none;appearance:none;width:100%;border:1px solid var(--line-strong);border-radius:7px;background:rgba(255,255,255,.28);color:var(--ink);padding:10px 12px;text-align:left;font:inherit;font-size:11px;cursor:pointer}.depth-action-button:active{background:var(--sage-soft)}.depth-action-button:focus-visible{outline:1px solid var(--sage);outline-offset:2px}.depth-action-note{margin-top:8px}
  </style>`);
}

function renderProfileDepth() {
  if (typeof document === "undefined" || typeof localStorage === "undefined") return;
  const personId = currentPersonId();
  if (!personId) return;
  const screen = document.querySelector(".screen");
  if (!screen || screen.dataset.depthProfileFor === personId) return;
  const state = readState();
  if (!state) return;
  ensureChildhoodDepth(state);
  const snapshot = npcKnowledgeSnapshot(state, personId);
  if (!snapshot) return;
  // ensureChildhoodDepth can discover or initialize person-specific identity data as time passes.
  // Persist the whole state, not just the depth root, so those discoveries survive navigation/reload.
  writeState(state);
  installStyles(screen);

  const sections = [...screen.querySelectorAll(".profile-section")];
  const personality = sections.find((section) => /personality/i.test(section.querySelector("h2")?.textContent || ""));
  if (personality) personality.innerHTML = `<h2>What you know about them</h2>${knowledgeHtml(snapshot)}`;

  const relationship = sections.find((section) => /your relationship/i.test(section.querySelector("h2")?.textContent || ""));
  const blocked = Boolean(state.resolution || state.childhoodDepth?.pendingAdvance || state.childhoodDepth?.requestedInteraction);
  const actions = availableRelationshipActions(state, personId);
  const interactionSection = document.createElement("section");
  interactionSection.className = "profile-section childhood-depth-actions";
  interactionSection.innerHTML = `<h2>Spend time</h2>${actionHtml(actions, blocked)}`;
  if (relationship) relationship.insertAdjacentElement("afterend", interactionSection);
  else screen.appendChild(interactionSection);

  interactionSection.querySelectorAll("[data-depth-action]").forEach((button) => {
    button.addEventListener("click", () => {
      const latest = readState();
      if (!latest) return;
      ensureChildhoodDepth(latest);
      if (!queueRelationshipInteraction(latest, personId, button.dataset.depthAction)) return;
      writeState(latest);
      window.dispatchEvent(new CustomEvent("little-days-state-sync", { detail: { state: latest } }));
      location.hash = "life";
    });
  });
  screen.dataset.depthProfileFor = personId;
}

function schedule() {
  if (scheduled) return;
  scheduled = true;
  setTimeout(() => {
    scheduled = false;
    renderProfileDepth();
  }, 0);
}

if (typeof window !== "undefined") {
  window.addEventListener("hashchange", schedule);
  window.addEventListener("storage", schedule);
  const app = document.querySelector("#app");
  if (app) new MutationObserver(schedule).observe(app, { childList: true, subtree: true });
  schedule();
}
