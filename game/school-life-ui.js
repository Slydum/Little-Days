import { ensureSchoolLifeV2, schoolLifeSnapshot } from "./school-life-v2.js?v=1";

const STORAGE_KEY = "little-days-save-v2";
let scheduled = false;

function readState() {
  try {
    const state = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!state?.character || !state?.childhood) return null;
    ensureSchoolLifeV2(state);
    return state;
  } catch {
    return null;
  }
}

function route() {
  return location.hash.replace(/^#/, "") || "life";
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

function level(value, low, mid, high) {
  const v = Number(value) || 0;
  return v >= 72 ? high : v >= 48 ? mid : low;
}

function styles(screen) {
  if (screen.querySelector("#school-life-v2-styles")) return;
  screen.insertAdjacentHTML("afterbegin", `<style id="school-life-v2-styles">
    .school-v2-card{margin:12px 0 18px;padding:13px 0;border-top:1px solid var(--line);border-bottom:1px solid var(--line)}
    .school-v2-kicker{margin:0 0 3px;color:var(--muted);font-size:9px;font-weight:800;letter-spacing:.08em;text-transform:uppercase}
    .school-v2-name{margin:0;font-family:var(--serif);font-size:19px;font-weight:500;line-height:1.25}
    .school-v2-copy{margin:5px 0 0;color:var(--muted);font-size:10px;line-height:1.5}
    .school-v2-grid{display:grid;grid-template-columns:1fr 1fr;gap:0 14px;margin-top:9px}
    .school-v2-fact{padding:8px 0;border-top:1px solid var(--line)}
    .school-v2-fact span{display:block;color:var(--muted);font-size:8px;text-transform:uppercase;letter-spacing:.06em}
    .school-v2-fact strong{display:block;margin-top:2px;font-family:var(--serif);font-size:13px;font-weight:500}
    .school-v2-tags{display:flex;flex-wrap:wrap;gap:5px;margin-top:8px}.school-v2-tag{border:1px solid var(--line);border-radius:999px;padding:3px 7px;font-size:9px;color:var(--muted)}
    .school-v2-warning{margin:10px 0 0;padding:9px 10px;border-left:2px solid var(--line-strong);background:rgba(255,255,255,.2);font-size:10px;line-height:1.5}
  </style>`);
}

function conventionalCard(snapshot) {
  const tuition = snapshot.mode === "private" ? peso(snapshot.tuitionMonthly) + "/month" : "No tuition";
  const tags = snapshot.reputation?.tags?.length ? snapshot.reputation.tags : ["Still forming"];
  return `<section class="school-v2-card" data-school-v2-card>
    <p class="school-v2-kicker">${escapeHtml(snapshot.modeLabel)}</p>
    <h2 class="school-v2-name">${escapeHtml(snapshot.name)}</h2>
    <p class="school-v2-copy">School type changes class size, fees, facilities, pressure, and access to activities. It does not decide whether the people inside it are kind, capable, difficult, or memorable.</p>
    <div class="school-v2-grid">
      <div class="school-v2-fact"><span>Tuition</span><strong>${tuition}</strong></div>
      <div class="school-v2-fact"><span>Other school costs</span><strong>${peso(snapshot.otherMonthlyCost)}/month</strong></div>
      <div class="school-v2-fact"><span>Class size</span><strong>About ${snapshot.classSize}</strong></div>
      <div class="school-v2-fact"><span>Commute</span><strong>~${snapshot.commuteMinutes} min</strong></div>
      <div class="school-v2-fact"><span>Facilities</span><strong>${level(snapshot.facilities,"Limited","Adequate","Strong")}</strong></div>
      <div class="school-v2-fact"><span>Academic pressure</span><strong>${level(snapshot.academicPressure,"Low","Moderate","High")}</strong></div>
    </div>
    <div class="school-v2-tags">${tags.map((tag) => `<span class="school-v2-tag">${escapeHtml(tag)}</span>`).join("")}</div>
    ${snapshot.arrears > 0 ? `<p class="school-v2-warning">Unpaid school costs: ${peso(snapshot.arrears)}. The household is having trouble keeping up with this school.</p>` : ""}
  </section>`;
}

function homeStudyCard(snapshot) {
  return `<section class="school-v2-card" data-school-v2-card>
    <p class="school-v2-kicker">Home study</p>
    <h2 class="school-v2-name">Learning mostly happens at home</h2>
    <p class="school-v2-copy">There is no daily classroom or fixed group of classmates. Learning is more flexible and individual, while friendships grow through family, neighbors, activities, community spaces, and the rest of life.</p>
    <div class="school-v2-grid">
      <div class="school-v2-fact"><span>Tuition</span><strong>No school tuition</strong></div>
      <div class="school-v2-fact"><span>Learning materials</span><strong>${peso(snapshot.otherMonthlyCost)}/month</strong></div>
      <div class="school-v2-fact"><span>Commute</span><strong>None</strong></div>
      <div class="school-v2-fact"><span>Schedule</span><strong>Flexible</strong></div>
      <div class="school-v2-fact"><span>Resources</span><strong>${level(snapshot.facilities,"Basic","Adequate","Strong")}</strong></div>
      <div class="school-v2-fact"><span>Group activities</span><strong>${level(snapshot.clubAccess,"Limited","Some access","Good access")}</strong></div>
    </div>
  </section>`;
}

function outOfSchoolCard(snapshot) {
  return `<section class="school-v2-card" data-school-v2-card>
    <p class="school-v2-kicker">Education access</p>
    <h2 class="school-v2-name">Not currently enrolled</h2>
    <p class="school-v2-copy">${escapeHtml(snapshot.reason || "Regular schooling is not workable for the household right now.")}. This is a circumstance, not a trait. The game will keep reviewing whether enrollment becomes possible as the household changes.</p>
    <p class="school-v2-warning">Missing school can affect academic progress and the child's everyday social world, but it does not mean they stop learning or that poverty automatically determines their future.</p>
  </section>`;
}

function renderSchool(state, screen) {
  if (screen.querySelector("[data-school-v2-card]")) return;
  const snapshot = schoolLifeSnapshot(state);
  if (!snapshot) return;
  styles(screen);

  const title = screen.querySelector(".page-title");
  if (title) title.textContent = snapshot.grade;

  const subjectTable = screen.querySelector(".subject-table");
  const firstSection = screen.querySelector(".data-section");
  const anchor = subjectTable || firstSection;
  const html = snapshot.mode === "homeschool" ? homeStudyCard(snapshot) : snapshot.mode === "out-of-school" ? outOfSchoolCard(snapshot) : conventionalCard(snapshot);
  if (anchor) anchor.insertAdjacentHTML("beforebegin", html);
  else screen.insertAdjacentHTML("beforeend", html);

  if (snapshot.mode === "out-of-school") {
    subjectTable?.remove();
    firstSection?.remove();
    const lately = [...screen.querySelectorAll(".section-title")].find((item) => /school lately/i.test(item.textContent || ""));
    if (lately) {
      const note = lately.nextElementSibling;
      lately.textContent = "Learning lately";
      if (note) note.textContent = "Your learning comes from home, daily life, whatever materials are available, and the people around you rather than a regular classroom right now.";
    }
  } else if (snapshot.mode === "homeschool") {
    if (firstSection) {
      const rows = [...firstSection.querySelectorAll(".data-row")];
      for (const row of rows) {
        const label = row.querySelector(".label")?.textContent || "";
        const value = row.querySelector(".value");
        if (/teacher/i.test(label) && value) value.textContent = "Parent / home educator";
        if (/current term/i.test(label) && value) value.textContent = "Flexible home-study schedule";
      }
    }
    const lately = [...screen.querySelectorAll(".section-title")].find((item) => /school lately/i.test(item.textContent || ""));
    if (lately) lately.textContent = "Home study lately";
  }
}

function renderHome(state, screen) {
  const snapshot = schoolLifeSnapshot(state);
  if (!snapshot) return;
  const heading = [...screen.querySelectorAll(".data-heading")].find((item) => /household money/i.test(item.textContent || ""));
  const section = heading?.closest(".data-section");
  if (!section || section.querySelector("[data-school-cost-row]")) return;
  const essentialRow = [...section.querySelectorAll(".economy-money-row")].find((item) => /essential monthly costs/i.test(item.querySelector("span")?.textContent || ""));
  const essentialValue = essentialRow?.querySelector("strong");
  if (essentialValue) essentialValue.textContent = peso(state.household.economy?.monthlyEssentialCostsWithEducation || ((state.household.economy?.monthlyEssentialCosts || 0) + snapshot.monthlyCost));

  const row = document.createElement("div");
  row.className = "economy-money-row";
  row.dataset.schoolCostRow = "1";
  const label = snapshot.mode === "private" ? "School tuition + costs" : snapshot.mode === "homeschool" ? "Home-study materials" : "School costs";
  row.innerHTML = `<span>${escapeHtml(label)}</span><strong>${peso(snapshot.monthlyCost)}/mo</strong>`;
  const note = section.querySelector(".economy-note");
  if (note) note.insertAdjacentElement("beforebegin", row);
  else section.appendChild(row);
}

function render() {
  scheduled = false;
  const screen = document.querySelector(".screen");
  if (!screen) return;
  const state = readState();
  if (!state || (state.character.ageMonths || 0) < 60) return;
  const current = route();
  if (current === "school") renderSchool(state, screen);
  if (current === "home") renderHome(state, screen);
}

function schedule() {
  if (scheduled) return;
  scheduled = true;
  queueMicrotask(render);
}

if (typeof MutationObserver !== "undefined") new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true });
window.addEventListener("hashchange", schedule);
window.addEventListener("little-days-state-sync", schedule);
if (document.readyState === "loading") window.addEventListener("DOMContentLoaded", schedule, { once: true });
else schedule();
