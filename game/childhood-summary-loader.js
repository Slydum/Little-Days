import { ensureChildhoodSummary } from "./childhood-summary.js?v=1";

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
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // The summary is still useful on screen even if storage is unavailable.
  }
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function sectionHtml(section) {
  const items = (section.items || []).filter(Boolean);
  return `<section class="childhood-summary-section childhood-summary-${escapeHtml(section.id)}">
    <h3>${escapeHtml(section.title)}</h3>
    ${section.copy ? `<p class="childhood-summary-copy">${escapeHtml(section.copy)}</p>` : ""}
    ${items.length ? `<div class="childhood-summary-items">${items.map((item) => `<p>${escapeHtml(item)}</p>`).join("")}</div>` : ""}
  </section>`;
}

function panelHtml(summary) {
  return `<style>
    .childhood-summary-record{margin:22px 0 18px;border-top:1px solid var(--line);border-bottom:1px solid var(--line)}
    .childhood-summary-record-header{padding:18px 0 10px}.childhood-summary-record-header h2{margin:0 0 6px;font-family:var(--serif);font-size:18px;font-weight:500}.childhood-summary-record-header p{margin:0;color:var(--muted);font-size:10px;line-height:1.55}
    .childhood-summary-section{padding:15px 0;border-top:1px solid var(--line)}.childhood-summary-section h3{margin:0 0 7px;font-family:var(--serif);font-size:15px;font-weight:500}.childhood-summary-copy{margin:0;color:var(--ink);font-size:11px;line-height:1.55}.childhood-summary-items{margin-top:8px}.childhood-summary-items p{position:relative;margin:0;padding:7px 0 7px 14px;border-top:1px solid color-mix(in srgb,var(--line) 70%,transparent);color:var(--muted);font-size:10px;line-height:1.5}.childhood-summary-items p:before{content:"";position:absolute;left:1px;top:13px;width:4px;height:4px;border-radius:50%;background:var(--sage)}
    .childhood-summary-handoff{margin:0;padding:13px 0 16px;border-top:1px solid var(--line);color:var(--muted);font-size:9px;line-height:1.55}
  </style>
  <div class="childhood-summary-record">
    <div class="childhood-summary-record-header">
      <h2>Your childhood record</h2>
      <p>This is the version of childhood adolescence will inherit. It keeps the history without pretending thirteen is a reset button.</p>
    </div>
    ${(summary.sections || []).map(sectionHtml).join("")}
    <p class="childhood-summary-handoff">Relationships, school history, developmental patterns, coping, memories, and unresolved threads are saved in the adolescence handoff.</p>
  </div>`;
}

function render() {
  if (typeof document === "undefined" || typeof localStorage === "undefined") return;
  const state = readState();
  if (!state?.completed || (state.character?.ageMonths || 0) < 156) return;
  const screen = document.querySelector(".screen");
  if (!screen) return;

  const before = JSON.stringify(state.childhoodSummary || null);
  const summary = ensureChildhoodSummary(state);
  if (!summary) return;
  const after = JSON.stringify(state.childhoodSummary || null);
  if (before !== after || !state.adolescenceHandoff) writeState(state);

  const title = screen.querySelector(".event-title");
  const copy = screen.querySelector(".event-copy");
  if (title) title.textContent = summary.title;
  if (copy) copy.textContent = summary.copy;

  for (const note of screen.querySelectorAll(".body-note")) {
    if (/end of the current childhood mvp|adolescence is deliberately not simulated/i.test(note.textContent || "")) {
      note.textContent = "Adolescence is not simulated yet. This childhood record is saved so the next life stage can continue from the same relationships, patterns, and history.";
    }
  }

  if (screen.querySelector(".childhood-summary-record")) return;
  const newLifeButton = screen.querySelector("[data-new-life]");
  if (newLifeButton) newLifeButton.insertAdjacentHTML("beforebegin", panelHtml(summary));
  else screen.insertAdjacentHTML("beforeend", panelHtml(summary));
}

function schedule() {
  if (scheduled) return;
  scheduled = true;
  setTimeout(() => {
    scheduled = false;
    render();
  }, 0);
}

if (typeof window !== "undefined") {
  window.addEventListener("hashchange", schedule);
  window.addEventListener("storage", schedule);
  const app = document.querySelector("#app");
  if (app) new MutationObserver(schedule).observe(app, { childList: true, subtree: true });
  schedule();
}
