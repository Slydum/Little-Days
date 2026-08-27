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

const STORAGE_KEY = "little-days-save-v2";

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved?.version === 2 && saved.character && saved.household) return saved;
  } catch {
    // A broken save should never make the whole childhood unplayable.
  }
  return createNewLife();
}

let state = loadState();
let toastTimer;

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

const navItems = [
  ["life", "Life"],
  ["people", "People"],
  ["self", "Self"],
  ["memories", "Memories"],
  ["more", "More"],
];

function getRoute() {
  const route = location.hash.replace("#", "").trim();
  return route || "life";
}

function brand(title = "") {
  return `<p class="brand">Little Days</p>${title ? `<h1 class="page-title">${title}</h1>` : ""}`;
}

function bottomNav(route) {
  const activeRoot = ["home", "school", "overview"].includes(route) ? "more" : route;
  return `
    <nav class="bottom-nav" aria-label="Primary">
      ${navItems
        .map(
          ([key, label]) => `
            <button class="nav-button ${activeRoot === key ? "active" : ""}" data-route="${key}" aria-label="${label}">
              ${icons[key]}
              <span>${label}</span>
            </button>`,
        )
        .join("")}
    </nav>
  `;
}

function shell(content, route) {
  return `<section class="screen">${content}</section>${bottomNav(route)}`;
}

function categoryIcon(category) {
  const map = {
    School: icons.school,
    Family: icons.family,
    Friends: icons.people,
    Home: icons.home,
    Health: icons.moon,
    Interests: icons.pen,
    Money: icons.book,
    Self: icons.self,
  };
  return map[category] || icons.life;
}

function lifeScreen() {
  if (state.completed) {
    const summary = finalChildhoodSummary(state);
    return shell(
      `
        ${brand()}
        <h1 class="age-title">Age 13</h1>
        <p class="date-line">${formatGameDate(state)}</p>
        <div class="eyebrow">${icons.memories} Childhood complete</div>
        <h2 class="event-title">${summary.title}</h2>
        <p class="event-copy">${summary.copy}</p>
        <div class="divider"></div>
        <p class="body-note">This is the end of the current childhood MVP. Adolescence is deliberately not simulated yet.</p>
        <button class="utility-button" data-new-life>Begin another life</button>
      `,
      "life",
    );
  }

  const event = getCurrentEvent(state);
  const indicators = lifeIndicators(state);
  const resolvedChoice = state.resolution?.choiceId;

  return shell(
    `
      ${brand()}
      <h1 class="age-title">${getAgeLabel(state)}</h1>
      <p class="date-line">${formatGameDate(state)}</p>

      <div class="status-strip" aria-label="Life indicators">
        <div class="status-item"><span class="status-dot"></span><div class="status-copy"><strong>Wellbeing</strong>${indicators.wellbeing}</div></div>
        <div class="status-item"><span class="status-dot gold"></span><div class="status-copy"><strong>Energy</strong>${indicators.energy}</div></div>
        <div class="status-item"><span class="status-dot"></span><div class="status-copy"><strong>Stress</strong>${indicators.stress}</div></div>
      </div>

      <div class="eyebrow">${categoryIcon(event.category)} ${event.category}</div>
      <h2 class="event-title">${event.title}</h2>
      <p class="event-copy">${event.body}</p>
      <div class="divider"></div>
      <p class="prompt">${event.prompt}</p>
      <div class="choices">
        ${event.choices
          .map(
            (choice) => `
              <button
                class="choice-button ${resolvedChoice === choice.id ? "primary" : ""}"
                data-choice="${choice.id}"
                ${state.resolution ? "disabled" : ""}
                aria-pressed="${resolvedChoice === choice.id}"
              >${choice.label}</button>
            `,
          )
          .join("")}
      </div>
      ${
        state.resolution
          ? `<div class="result-card">${state.resolution.result}</div><button class="utility-button" id="continue-life">Continue</button>`
          : ""
      }
    `,
    "life",
  );
}

function peopleScreen() {
  const roleLabel = {
    guardian: "Parent / Guardian",
    secondGuardian: "Parent / Guardian",
    grandmother: "Grandmother",
    sibling: "Sibling",
    friend: "Friend",
  };
  const age = getAgeYears(state);
  const people = getVisiblePeople(state);

  return shell(
    `
      ${brand("People")}
      <div class="people-list">
        ${people
          .map(
            (person) => `
              <article class="person-card">
                <div class="avatar" aria-hidden="true">${person.name[0]}</div>
                <div>
                  <h2 class="person-name">${person.name}</h2>
                  <p class="person-role">${roleLabel[person.role] || "Relationship"} — ${relationshipLabel(person)}</p>
                  <p class="person-copy">${relationshipCopy(person)}</p>
                  <p class="person-meta">${person.role === "friend" ? `Known for — ${Math.max(0, age - 5)} year${Math.max(0, age - 5) === 1 ? "" : "s"}` : `Age — ${person.age + age}`}</p>
                </div>
              </article>
            `,
          )
          .join("")}
      </div>
    `,
    "people",
  );
}

function selfScreen() {
  const rows = personalityRows(state);
  const traits = discoveredTraits(state);

  return shell(
    `
      ${brand("Self")}
      <h2 class="section-title">Personality</h2>
      <div class="personality-list">
        ${rows
          .map(
            ([left, right, value]) => `
              <div class="trait-line">
                <span>${left}</span>
                <div class="trait-track" style="--value:${value}%" role="img" aria-label="${left} to ${right}"></div>
                <span>${right}</span>
              </div>
            `,
          )
          .join("")}
      </div>
      <div class="divider"></div>
      <h2 class="section-title">Discovered Traits</h2>
      ${
        traits.length
          ? traits.map(([name, copy]) => `<div class="discovered-trait"><strong>${name}</strong><p>${copy}</p></div>`).join("")
          : `<div class="discovered-trait"><strong>???</strong><p>You haven't learned enough about yourself yet.</p></div>`
      }
    `,
    "self",
  );
}

function memoriesScreen() {
  const memories = [...state.memories].reverse();
  return shell(
    `
      ${brand("Memories")}
      ${
        memories.length
          ? `<div class="memory-timeline">
              ${memories
                .map(
                  (memory) => `
                    <article class="memory-entry ${memory.featured ? "featured" : ""}">
                      <p class="memory-date">Age ${memory.age} · ${memory.date}</p>
                      <h2 class="memory-title">${memory.title}</h2>
                      <p class="memory-copy">${memory.copy}</p>
                    </article>
                  `,
                )
                .join("")}
            </div>`
          : `<p class="body-note">Nothing has become a lasting memory yet. That will change. Childhood is annoyingly efficient at leaving evidence behind.</p>`
      }
    `,
    "memories",
  );
}

function homeScreen() {
  const age = getAgeYears(state);
  const householdPeople = getVisiblePeople(state).filter((person) => person.role !== "friend");
  return shell(
    `
      ${brand()}
      <h1 class="home-title">Home</h1>
      <h2 class="home-subtitle">${state.household.name}</h2>
      <p class="kicker-copy">${state.household.housing}<br />${state.household.city}, ${state.household.country}</p>

      <section class="data-section">
        <h3 class="data-heading">Household</h3>
        <div class="data-row"><span class="initial-chip">${state.character.firstName[0]}</span><span class="label">You · ${state.character.firstName}</span><span class="value">${age}</span></div>
        ${householdPeople
          .map(
            (person) => `<div class="data-row"><span class="initial-chip">${person.name[0]}</span><span class="label">${person.name}</span><span class="value">${person.age + age}</span></div>`,
          )
          .join("")}
      </section>

      <section class="data-section">
        <h3 class="data-heading">Home Life</h3>
        <div class="data-row">${icons.home}<span class="label">Comfort</span><span class="value">${state.household.comfort}</span></div>
        <div class="data-row">${icons.shield}<span class="label">Privacy</span><span class="value">${state.household.privacy}</span></div>
        <div class="data-row">${icons.book}<span class="label">Finances</span><span class="value">${state.household.financeBand}</span></div>
        <div class="data-row">${icons.people}<span class="label">Neighborhood</span><span class="value">${state.household.neighborhood}</span></div>
      </section>
      <p class="body-note">${state.household.financeBand === "Tight" ? "Money sometimes changes what the household can say yes to." : state.household.privacy === "Limited" ? "The home can feel crowded, although familiar routines make it feel like yours." : "Home life is fairly steady at the moment."}</p>
    `,
    "home",
  );
}

function schoolScreen() {
  const school = schoolSnapshot(state);
  if (!school) {
    return shell(
      `
        ${brand()}
        <h1 class="page-title">School</h1>
        <p class="body-note">School has not started yet. For now, most of your world is still home, family, and whatever happens to be within reach.</p>
      `,
      "school",
    );
  }

  return shell(
    `
      ${brand()}
      <h1 class="page-title">${school.grade}</h1>
      <table class="subject-table">
        <caption>Subjects</caption>
        <tbody>
          ${school.subjects.map(([subject, status]) => `<tr><td>${subject}</td><td>${status}</td></tr>`).join("")}
        </tbody>
      </table>

      <section class="data-section">
        <div class="data-row">${icons.self}<span class="label">Teacher</span><span class="value">${school.teacher}</span></div>
        <div class="data-row">${icons.book}<span class="label">Closest school friend</span><span class="value">${school.friend}</span></div>
        <div class="data-row">${icons.calendar}<span class="label">Current term</span><span class="value">${school.term}</span></div>
      </section>

      <h2 class="section-title">School lately</h2>
      <p class="body-note">${state.character.personality.social < 42 ? "You tend to watch and listen before volunteering yourself." : state.character.personality.structure > 65 ? "You usually feel best when you understand what is expected of you." : "School is becoming one of the places where more of your personality shows."}</p>
    `,
    "school",
  );
}

function overviewScreen() {
  const overview = lifeOverview(state);
  const rows = [
    [icons.family, "Family", overview.rows.family],
    [icons.book, "School", overview.rows.school],
    [icons.heart, "Friends", overview.rows.friends],
    [icons.moon, "Health", overview.rows.health],
    [icons.pen, "Interests", overview.rows.interests],
    [icons.home, "Home", overview.rows.home],
  ];

  return shell(
    `
      ${brand("Life")}
      <p class="life-feeling-label">Life lately</p>
      <p class="life-feeling">${overview.feeling}</p>
      <div>
        ${rows
          .map(
            ([icon, title, copy]) => `
              <article class="overview-row">
                <div>${icon}</div>
                <div><h3>${title}</h3><p>${copy}</p></div>
              </article>
            `,
          )
          .join("")}
      </div>
    `,
    "overview",
  );
}

function moreScreen() {
  const links = [
    ["home", icons.home, "Home", "Household, comfort, privacy, and neighborhood."],
    ["school", icons.book, "School", "Subjects, teacher, friends, and current term."],
    ["overview", icons.life, "Life overview", "A quiet summary of what life currently feels like."],
  ];

  return shell(
    `
      ${brand("More")}
      <div class="more-panel">
        ${links
          .map(
            ([route, icon, title, copy]) => `
              <button class="more-link" data-route="${route}">
                <span>${icon}</span>
                <span><strong>${title}</strong>${copy}</span>
                <span class="chevron" aria-hidden="true">›</span>
              </button>`,
          )
          .join("")}
      </div>
      <p class="body-note">Playing as <strong>${state.character.firstName} ${state.character.lastName}</strong>, born in ${state.character.birthplace}. ${interestSummary(state)}</p>
      <button class="utility-button" data-new-life>Begin a different life</button>
    `,
    "more",
  );
}

const screens = {
  life: lifeScreen,
  people: peopleScreen,
  self: selfScreen,
  memories: memoriesScreen,
  more: moreScreen,
  home: homeScreen,
  school: schoolScreen,
  overview: overviewScreen,
};

function render() {
  const route = getRoute();
  const screen = screens[route] || screens.life;
  document.querySelector("#app").innerHTML = screen();
  bindEvents();
}

function startNewLife() {
  if (!window.confirm("Begin a different life? Your current childhood will be replaced.")) return;
  state = createNewLife();
  saveState();
  location.hash = "life";
  render();
  showToast(`A new life begins. Meet ${state.character.firstName}.`);
}

function bindEvents() {
  document.querySelectorAll("[data-route]").forEach((button) => {
    button.addEventListener("click", () => {
      const route = button.dataset.route;
      if (route === getRoute()) return;
      location.hash = route;
    });
  });

  document.querySelectorAll("[data-choice]").forEach((button) => {
    button.addEventListener("click", () => {
      resolveChoice(state, button.dataset.choice);
      saveState();
      render();
      showToast("Choice remembered.");
    });
  });

  document.querySelector("#continue-life")?.addEventListener("click", () => {
    continueLife(state);
    saveState();
    render();
    window.scrollTo({ top: 0, behavior: "smooth" });
  });

  document.querySelectorAll("[data-new-life]").forEach((button) => button.addEventListener("click", startNewLife));
}

function showToast(message) {
  clearTimeout(toastTimer);
  document.querySelector(".toast")?.remove();
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.setAttribute("role", "status");
  toast.textContent = message;
  document.body.appendChild(toast);
  toastTimer = setTimeout(() => toast.remove(), 2200);
}

function initializeApp() {
  saveState();
  render();

  // Service workers were useful for the installable prototype, but during active
  // development a stale worker can keep serving old JavaScript on iOS. Retire any
  // existing registrations for now so refreshing always resumes the latest build.
  if ("serviceWorker" in navigator && location.protocol !== "file:") {
    navigator.serviceWorker
      .getRegistrations()
      .then((registrations) => registrations.forEach((registration) => registration.unregister()))
      .catch(() => {});
  }
}

window.addEventListener("hashchange", render);

// app.js is often imported after the page has already finished loading (for example
// after pressing Begin on the birth introduction). In that case DOMContentLoaded has
// already happened, so waiting for it would leave the app stuck on "Opening your life…".
if (document.readyState === "loading") {
  window.addEventListener("DOMContentLoaded", initializeApp, { once: true });
} else {
  initializeApp();
}
