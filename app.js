const STORAGE_KEY = "little-days-demo-v1";

const defaultState = {
  selectedChoice: "tell-mom",
  memories: [
    {
      age: 5,
      date: "May 10, 2031",
      title: "First day of school",
      copy: "You were nervous, but your teacher was very kind.",
      featured: true,
    },
    {
      age: 7,
      date: "April 22, 2033",
      title: "Planted sunflowers with Grandma",
      copy: "You got soil on your hands and smiled a lot.",
    },
    {
      age: 8,
      date: "February 3, 2034",
      title: "Maya became your best friend",
      copy: "You laughed together so much that day.",
    },
  ],
};

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return { ...defaultState, ...saved };
  } catch {
    return { ...defaultState };
  }
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

function lifeScreen() {
  const choices = [
    ["tell-mom", "Tell Mom when you get home"],
    ["show-maya", "Show Maya"],
    ["not-big-deal", "Pretend it isn't a big deal"],
    ["keep-it", "Keep it to yourself"],
  ];

  const selectedCopy = {
    "tell-mom": "You decide you want Mom to know. You are already imagining the small smile she makes when she is proud of you.",
    "show-maya": "You fold the test carefully so you can show Maya at lunch. Sharing good news feels easier with her.",
    "not-big-deal": "You shrug when anyone notices. Part of you is pleased anyway.",
    "keep-it": "You tuck the paper into your bag. The result matters to you, even if nobody else sees it.",
  }[state.selectedChoice];

  return shell(
    `
      ${brand()}
      <h1 class="age-title">Age 8</h1>
      <p class="date-line">March 14, 2034</p>

      <div class="status-strip" aria-label="Life indicators">
        <div class="status-item"><span class="status-dot"></span><div class="status-copy"><strong>Wellbeing</strong>Good</div></div>
        <div class="status-item"><span class="status-dot gold"></span><div class="status-copy"><strong>Energy</strong>Steady</div></div>
        <div class="status-item"><span class="status-dot"></span><div class="status-copy"><strong>Stress</strong>Calm</div></div>
      </div>

      <div class="eyebrow">${icons.school} School</div>
      <h2 class="event-title">Mathematics test</h2>
      <p class="event-copy">You got your mathematics test back today.</p>
      <p class="score">84%</p>
      <p class="event-copy">Your teacher told you that you've improved a lot this term.</p>
      <p class="event-copy">You feel proud.</p>
      <div class="divider"></div>
      <p class="prompt">What do you do?</p>
      <div class="choices">
        ${choices
          .map(
            ([value, label]) => `
              <button class="choice-button ${state.selectedChoice === value ? "primary" : ""}" data-choice="${value}" aria-pressed="${state.selectedChoice === value}">${label}</button>
            `,
          )
          .join("")}
      </div>
      <div class="result-card">${selectedCopy}</div>
    `,
    "life",
  );
}

function peopleScreen() {
  const people = [
    {
      initial: "M",
      name: "Mom",
      role: "Relationship — Strong",
      copy: "You trust her and usually feel comfortable around her.",
      meta: "Recently — She helped you prepare for school.",
    },
    {
      initial: "G",
      name: "Grandmother",
      role: "Relationship — Very close",
      copy: "Shared memories — 12",
      meta: "You spend many afternoons together.",
    },
    {
      initial: "M",
      name: "Maya",
      role: "Best friend",
      copy: "Your friendship has been growing.",
      meta: "Known for — 2 years",
    },
  ];

  return shell(
    `
      ${brand("People")}
      <div class="people-list">
        ${people
          .map(
            (person) => `
              <article class="person-card">
                <div class="avatar" aria-hidden="true">${person.initial}</div>
                <div>
                  <h2 class="person-name">${person.name}</h2>
                  <p class="person-role">${person.role}</p>
                  <p class="person-copy">${person.copy}</p>
                  <p class="person-meta">${person.meta}</p>
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
  const traits = [
    ["Reserved", "Outgoing", 62],
    ["Cautious", "Adventurous", 76],
    ["Sensitive", "Resilient", 66],
    ["Impulsive", "Structured", 79],
    ["Practical", "Curious", 84],
  ];

  return shell(
    `
      ${brand("Self")}
      <h2 class="section-title">Personality</h2>
      <div class="personality-list">
        ${traits
          .map(
            ([left, right, value]) => `
              <div class="trait-line">
                <span>${left}</span>
                <div class="trait-track" style="--value:${value}%" role="img" aria-label="${left} to ${right}, leaning ${right}"></div>
                <span>${right}</span>
              </div>
            `,
          )
          .join("")}
      </div>
      <div class="divider"></div>
      <h2 class="section-title">Discovered Traits</h2>
      <div class="discovered-trait"><strong>Curious</strong><p>You often investigate things without being asked.</p></div>
      <div class="discovered-trait"><strong>Maker</strong><p>You seem happiest when creating something.</p></div>
      <div class="discovered-trait"><strong>???</strong><p>You haven't learned enough about yourself yet.</p></div>
    `,
    "self",
  );
}

function memoriesScreen() {
  return shell(
    `
      ${brand("Memories")}
      <div class="memory-timeline">
        ${state.memories
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
      </div>
    `,
    "memories",
  );
}

function homeScreen() {
  return shell(
    `
      ${brand()}
      <h1 class="home-title">Home</h1>
      <h2 class="home-subtitle">The Reyes Family Home</h2>
      <p class="kicker-copy">Small two-bedroom house<br />Quezon City, Philippines</p>

      <section class="data-section">
        <h3 class="data-heading">Household</h3>
        <div class="data-row"><span class="initial-chip">M</span><span class="label">Mom</span><span class="value">35</span></div>
        <div class="data-row"><span class="initial-chip">D</span><span class="label">Dad</span><span class="value">37</span></div>
        <div class="data-row"><span class="initial-chip">Y</span><span class="label">You</span><span class="value">8</span></div>
        <div class="data-row"><span class="initial-chip">L</span><span class="label">Younger brother</span><span class="value">3</span></div>
      </section>

      <section class="data-section">
        <h3 class="data-heading">Home Life</h3>
        <div class="data-row">${icons.home}<span class="label">Comfort</span><span class="value">Comfortable</span></div>
        <div class="data-row">${icons.shield}<span class="label">Privacy</span><span class="value">Limited</span></div>
        <div class="data-row">${icons.book}<span class="label">Finances</span><span class="value">Getting by</span></div>
        <div class="data-row">${icons.people}<span class="label">Neighborhood</span><span class="value">Busy</span></div>
      </section>
      <p class="body-note">The house can feel crowded, but evenings are usually peaceful.</p>
    `,
    "home",
  );
}

function schoolScreen() {
  return shell(
    `
      ${brand()}
      <h1 class="page-title">Grade 3</h1>
      <table class="subject-table">
        <caption>Subjects</caption>
        <tbody>
          <tr><td>Mathematics</td><td>Doing well</td></tr>
          <tr><td>Language</td><td>Average</td></tr>
          <tr><td>Science</td><td>Strong interest</td></tr>
          <tr><td>Art</td><td>Excellent</td></tr>
          <tr><td>Physical Education</td><td>Struggling</td></tr>
        </tbody>
      </table>

      <section class="data-section">
        <div class="data-row">${icons.self}<span class="label">Teacher</span><span class="value">Ms. Santos</span></div>
        <div class="data-row">${icons.book}<span class="label">Friends at school</span><span class="value">Maya, Liam, Zoe</span></div>
        <div class="data-row">${icons.calendar}<span class="label">Current term</span><span class="value">Term 2 · Jan–Apr</span></div>
        <div class="data-row">${icons.shield}<span class="label">Coming up</span><span class="value">Science fair</span></div>
      </section>

      <h2 class="section-title">School lately</h2>
      <p class="body-note">You're doing well, although you rarely volunteer answers during class.</p>
    `,
    "school",
  );
}

function overviewScreen() {
  const rows = [
    [icons.family, "Family", "You feel closest to your grandmother."],
    [icons.book, "School", "You're doing well, although you rarely volunteer answers."],
    [icons.heart, "Friends", "You have one very close friend."],
    [icons.moon, "Health", "You sleep okay, but you get tired easily."],
    [icons.pen, "Interests", "You've recently become fascinated with drawing."],
    [icons.home, "Home", "Your home is comfortable, although it can feel crowded."],
  ];

  return shell(
    `
      ${brand("Life")}
      <p class="life-feeling-label">Life lately</p>
      <p class="life-feeling">Safe, curious, and a little lonely.</p>
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
              </button>
            `,
          )
          .join("")}
      </div>
      <button class="utility-button" id="reset-demo">Reset demo choices</button>
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
      state.selectedChoice = button.dataset.choice;
      saveState();
      render();
      showToast("Choice remembered. Small things have a habit of sticking around.");
    });
  });

  document.querySelector("#reset-demo")?.addEventListener("click", () => {
    state = { ...defaultState, memories: [...defaultState.memories] };
    saveState();
    render();
    showToast("Demo state reset.");
  });
}

function showToast(message) {
  clearTimeout(toastTimer);
  document.querySelector(".toast")?.remove();
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.setAttribute("role", "status");
  toast.textContent = message;
  document.body.appendChild(toast);
  toastTimer = setTimeout(() => toast.remove(), 2400);
}

window.addEventListener("hashchange", render);
window.addEventListener("DOMContentLoaded", () => {
  render();

  if ("serviceWorker" in navigator && location.protocol !== "file:") {
    navigator.serviceWorker.register("./sw.js").catch(() => {
      // The app still works normally without offline caching.
    });
  }
});
