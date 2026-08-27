import { ensureHouseholdEconomy, householdMoneySnapshot, parentEmploymentLabel, parentPayLabel } from "./household-economy.js?v=1";

const STORAGE_KEY = "little-days-save-v2";
let scheduled = false;

function readState() {
  try {
    const state = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!state?.character || !state?.household) return null;
    ensureHouseholdEconomy(state);
    return state;
  } catch {
    return null;
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

function peso(value) {
  return `₱${Math.max(0, Math.round(Number(value) || 0)).toLocaleString("en-PH")}`;
}

function currentRoute() {
  return location.hash.replace(/^#/, "") || "life";
}

function injectStyles(screen) {
  if (screen.querySelector("#economy-ui-styles")) return;
  screen.insertAdjacentHTML("afterbegin", `<style id="economy-ui-styles">
    .economy-note{margin:4px 0 0;color:var(--muted);font-size:10px;line-height:1.45}.economy-section{margin-top:18px}.economy-section .data-heading{margin-bottom:4px}.economy-money-row{display:flex;align-items:baseline;justify-content:space-between;gap:12px;padding:9px 0;border-top:1px solid var(--line);font-size:11px}.economy-money-row strong{font-family:var(--serif);font-size:14px;font-weight:500;text-align:right}.economy-money-row span{color:var(--muted)}
  </style>`);
}

function renderHome(state, screen) {
  if (screen.dataset.economyHome === "1") return;
  const snapshot = householdMoneySnapshot(state);
  const subtitle = screen.querySelector(".home-subtitle");
  const kicker = screen.querySelector(".kicker-copy");
  if (subtitle && !subtitle.querySelector(".economy-note")) {
    subtitle.insertAdjacentHTML("afterend", `<p class="economy-note">${escapeHtml(snapshot.tenure)} · ${snapshot.bedrooms} bedroom${snapshot.bedrooms === 1 ? "" : "s"}</p>`);
  } else if (kicker && !screen.querySelector(".economy-note")) {
    kicker.insertAdjacentHTML("afterend", `<p class="economy-note">${escapeHtml(snapshot.tenure)} · ${snapshot.bedrooms} bedroom${snapshot.bedrooms === 1 ? "" : "s"}</p>`);
  }

  const sections = [...screen.querySelectorAll(".data-section")];
  const homeLife = sections.find((section) => /home life/i.test(section.querySelector(".data-heading")?.textContent || ""));
  if (homeLife) {
    const block = document.createElement("section");
    block.className = "data-section economy-section";
    block.innerHTML = `<h3 class="data-heading">Household money</h3>
      <div class="economy-money-row"><span>Combined monthly income</span><strong>${peso(snapshot.monthlyIncome)}</strong></div>
      <div class="economy-money-row"><span>Essential monthly costs</span><strong>${peso(snapshot.monthlyEssentialCosts)}</strong></div>
      <div class="economy-money-row"><span>${snapshot.tenure === "Renting" ? "Rent" : snapshot.tenure === "Paying a mortgage" ? "Mortgage / housing" : "Housing costs"}</span><strong>${peso(snapshot.monthlyHousingCost)}</strong></div>
      <div class="economy-money-row"><span>Household savings</span><strong>${peso(snapshot.savings)}</strong></div>
      ${snapshot.debt > 0 ? `<div class="economy-money-row"><span>Other household debt</span><strong>${peso(snapshot.debt)}</strong></div>` : ""}
      <p class="economy-note">Money changes over time as adults get raises, lose work, change jobs, take on housing costs, and save. A comfortable family can still be emotionally messy, because apparently income declined to solve that one.</p>`;
    homeLife.insertAdjacentElement("afterend", block);
  }
  screen.dataset.economyHome = "1";
}

function renderPerson(state, screen, personId) {
  if (screen.dataset.economyPerson === personId) return;
  const person = (state.people || []).find((item) => item.id === personId);
  if (!person || !["guardian", "secondGuardian"].includes(person.role)) return;
  const grids = [...screen.querySelectorAll(".profile-grid")];
  const grid = grids[0];
  if (!grid) return;
  const work = parentEmploymentLabel(person);
  const pay = parentPayLabel(person);
  const workFact = [...grid.querySelectorAll(".profile-fact")].find((fact) => /work/i.test(fact.querySelector("span")?.textContent || ""));
  if (workFact && work) workFact.querySelector("strong").textContent = work;
  if (pay && !grid.querySelector("[data-economy-pay]")) {
    const fact = document.createElement("div");
    fact.className = "profile-fact";
    fact.dataset.economyPay = "1";
    fact.innerHTML = `<span>Monthly pay</span><strong>${escapeHtml(pay)}</strong>`;
    grid.appendChild(fact);
  }
  const employment = person.npc?.realism?.employment;
  if (employment?.payHistory?.length && !screen.querySelector("[data-career-history]")) {
    const section = document.createElement("section");
    section.className = "profile-section";
    section.dataset.careerHistory = "1";
    const recent = [...employment.payHistory].slice(-4).reverse();
    section.innerHTML = `<h2>Work history</h2>${recent.map((item) => `<p style="margin-bottom:7px">${escapeHtml(item.title || work)} · ${peso(item.monthlyPay)} <span style="color:var(--muted)">(${escapeHtml(item.reason || "career change")})</span></p>`).join("")}`;
    const relationship = [...screen.querySelectorAll(".profile-section")].find((item) => /your relationship/i.test(item.querySelector("h2")?.textContent || ""));
    if (relationship) relationship.insertAdjacentElement("beforebegin", section);
    else grid.insertAdjacentElement("afterend", section);
  }
  screen.dataset.economyPerson = personId;
}

function renderEconomyUi() {
  scheduled = false;
  const screen = document.querySelector(".screen");
  if (!screen) return;
  const state = readState();
  if (!state) return;
  injectStyles(screen);
  const route = currentRoute();
  if (route === "home") renderHome(state, screen);
  else if (route.startsWith("person/")) renderPerson(state, screen, decodeURIComponent(route.slice(7)));
}

function scheduleRender() {
  if (scheduled) return;
  scheduled = true;
  queueMicrotask(renderEconomyUi);
}

if (typeof MutationObserver !== "undefined") {
  new MutationObserver(scheduleRender).observe(document.documentElement, { childList: true, subtree: true });
}
window.addEventListener("hashchange", scheduleRender);
window.addEventListener("little-days-state-sync", scheduleRender);
if (document.readyState === "loading") window.addEventListener("DOMContentLoaded", scheduleRender, { once: true });
else scheduleRender();
