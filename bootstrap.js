window.__littleDaysBooted = true;

const STORAGE_KEY = "little-days-save-v2";

function readSave() {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (value?.version === 2 && value.character && value.household) return value;
  } catch {
    // A broken save should behave like no save, not like a white screen.
  }
  return null;
}

function writeSave(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function cleanName(value, fallback = "") {
  const cleaned = String(value || "")
    .trim()
    .replace(/[^A-Za-zÀ-ÖØ-öø-ÿ' -]/g, "")
    .replace(/\s+/g, " ")
    .slice(0, 28);
  return cleaned || fallback;
}

function replaceSurname(name, lastName) {
  const parts = String(name || "").trim().split(/\s+/);
  if (!parts.length) return lastName;
  parts[parts.length - 1] = lastName;
  return parts.join(" ");
}

function applyCustomIdentity(life, custom) {
  const firstName = cleanName(custom.firstName, life.character.firstName);
  const lastName = cleanName(custom.lastName, life.character.lastName);
  life.character.firstName = firstName;
  life.character.lastName = lastName;
  life.character.sex = ["Female", "Male", "Non-binary"].includes(custom.sex) ? custom.sex : life.character.sex;
  life.household.name = `The ${lastName} Family Home`;

  for (const person of life.people) {
    if (["guardian", "secondGuardian", "sibling"].includes(person.role)) {
      person.name = replaceSurname(person.name, lastName);
    }
  }
  return life;
}

function normalizeEarlyEvent(life) {
  if (!life || life.character.ageMonths >= 36 || life.currentEventId !== "family_evening") return false;

  if (life.resolution) {
    const last = life.history?.[life.history.length - 1];
    if (last?.eventId === "family_evening" && last.ageMonths === life.character.ageMonths) life.history.pop();
    life.resolution = null;
  }

  if (life.character.ageMonths < 12) life.currentEventId = "held_after_crying";
  else if (life.character.ageMonths < 24) life.currentEventId = "cupboard_discovery";
  else life.currentEventId = "playground_edge";
  return true;
}

function formatDate(state) {
  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  return `${monthNames[state.date.month]} ${state.date.day}, ${state.date.year}`;
}

function setupShell(content) {
  const app = document.querySelector("#app");
  if (!app) return;
  app.innerHTML = `<section class="setup-screen">${content}</section>`;
}

function showStartupError(error) {
  console.error(error);
  setupShell(`
    <div class="setup-header">
      <p class="brand">Little Days</p>
      <h1>Something didn't load.</h1>
      <p>The game files may still be updating. Your browser can also be stubbornly holding an older cached version.</p>
    </div>
    <button class="setup-primary" id="retry-startup">Try again</button>
  `);
  document.querySelector("#retry-startup")?.addEventListener("click", () => {
    const url = new URL(window.location.href);
    url.searchParams.set("fresh", Date.now().toString());
    window.location.replace(url.toString());
  });
}

function showLifeChoice() {
  setupShell(`
    <div class="setup-header">
      <p class="brand">Little Days</p>
      <h1>Begin a life</h1>
      <p>Every life starts with things you choose and things you don't.</p>
    </div>

    <div class="setup-options">
      <button class="setup-option" id="random-life">
        <strong>Random life</strong>
        <span>Let everything be generated, including your character.</span>
      </button>
      <button class="setup-option" id="custom-life">
        <strong>Custom character</strong>
        <span>Choose your character's identity. Their family, money, home, birthplace, temperament, and circumstances are still generated.</span>
      </button>
    </div>

    <p class="setup-footnote">You can choose the person. You cannot choose the life waiting for them.</p>
  `);

  document.querySelector("#random-life")?.addEventListener("click", () => createAndIntroduce("random"));
  document.querySelector("#custom-life")?.addEventListener("click", showCustomCharacter);
}

function showCustomCharacter() {
  setupShell(`
    <div class="setup-header compact">
      <p class="brand">Little Days</p>
      <h1>Create your character</h1>
      <p>You choose who the character is. You do not choose the world they are born into.</p>
    </div>

    <form class="custom-form" id="custom-character-form">
      <label>
        <span>First name</span>
        <input name="firstName" autocomplete="given-name" maxlength="28" required placeholder="First name" />
      </label>
      <label>
        <span>Last name</span>
        <input name="lastName" autocomplete="family-name" maxlength="28" required placeholder="Last name" />
      </label>
      <label>
        <span>Identity</span>
        <select name="sex">
          <option value="Female">Female</option>
          <option value="Male">Male</option>
          <option value="Non-binary">Non-binary</option>
        </select>
      </label>

      <div class="setup-note">
        <strong>Still generated</strong>
        <p>Birthplace, parents or guardians, siblings, household finances, home, neighborhood, natural tendencies, abilities, health, and future opportunities.</p>
      </div>

      <button class="setup-primary" type="submit">Create this life</button>
      <button class="setup-secondary" type="button" id="back-to-life-choice">Back</button>
    </form>
  `);

  document.querySelector("#back-to-life-choice")?.addEventListener("click", showLifeChoice);
  document.querySelector("#custom-character-form")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const firstName = cleanName(data.get("firstName"));
    const lastName = cleanName(data.get("lastName"));
    if (!firstName || !lastName) return;
    createAndIntroduce("custom", { firstName, lastName, sex: data.get("sex") });
  });
}

async function createAndIntroduce(mode, custom = null) {
  setupShell(`
    <div class="setup-header">
      <p class="brand">Little Days</p>
      <h1>A life is beginning.</h1>
      <p>Some things are already being decided without you.</p>
    </div>
  `);

  try {
    const { createNewLife } = await import("./game/engine.js?v=7");
    let life = createNewLife();
    if (mode === "custom") life = applyCustomIdentity(life, custom);
    life.startMode = mode;
    life.introPending = true;
    normalizeEarlyEvent(life);
    writeSave(life);
    showIntroduction(life);
  } catch (error) {
    showStartupError(error);
  }
}

function showIntroduction(state) {
  const family = state.people.filter((person) => ["guardian", "secondGuardian", "sibling", "grandmother"].includes(person.role));
  const guardians = family
    .filter((person) => ["guardian", "secondGuardian"].includes(person.role))
    .map((person) => person.name)
    .join(" and ");
  const sibling = family.find((person) => person.role === "sibling");
  const grandmother = family.find((person) => person.role === "grandmother");
  const customLine = state.startMode === "custom"
    ? "You chose your character. You did not choose the circumstances waiting for them."
    : "You did not choose who you would be or the circumstances waiting for you.";

  setupShell(`
    <div class="birth-intro">
      <p class="brand">Little Days</p>
      <p class="birth-kicker">A new life</p>
      <h1>You were born.</h1>
      <p class="birth-date">${formatDate(state)}</p>

      <div class="birth-rule"></div>

      <p class="birth-copy">Your name is <strong>${state.character.firstName} ${state.character.lastName}</strong>. You were born in ${state.character.birthplace}.</p>
      <p class="birth-copy">You begin life in a ${state.household.housing.toLowerCase()} in ${state.household.city}. ${guardians ? `Your home is shared with ${guardians}.` : "Your household is already taking shape around you."}${sibling ? ` You have a sibling, ${sibling.name}.` : ""}${grandmother ? ` ${grandmother.name} is part of your family world too.` : ""}</p>
      <p class="birth-copy">Money in the household is <strong>${state.household.financeBand.toLowerCase()}</strong>. The neighborhood is ${state.household.neighborhood.toLowerCase()}.</p>

      <div class="birth-rule"></div>
      <p class="birth-philosophy">${customLine}</p>
      <p class="birth-philosophy">You will discover the rest by living.</p>

      <button class="setup-primary" id="begin-life">Begin</button>
    </div>
  `);

  document.querySelector("#begin-life")?.addEventListener("click", () => {
    const save = readSave();
    if (!save) return showLifeChoice();
    save.introPending = false;
    writeSave(save);
    loadGame();
  });
}

function installNewLifeInterceptor() {
  document.addEventListener(
    "click",
    (event) => {
      const button = event.target.closest?.("[data-new-life]");
      if (!button) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      if (!window.confirm("Begin a different life? Your current childhood will be replaced.")) return;
      localStorage.removeItem(STORAGE_KEY);
      history.replaceState(null, "", location.pathname + location.search);
      showLifeChoice();
      window.scrollTo({ top: 0, behavior: "auto" });
    },
    true,
  );

  document.addEventListener("click", (event) => {
    if (!event.target.closest?.("#continue-life")) return;
    setTimeout(() => {
      const save = readSave();
      if (!save) return;
      if (normalizeEarlyEvent(save)) {
        writeSave(save);
        window.location.reload();
      }
    }, 0);
  });
}

async function loadGame() {
  installNewLifeInterceptor();
  try {
    await import("./app.js?v=7");
  } catch (error) {
    showStartupError(error);
  }
}

async function boot() {
  const saved = readSave();

  if (!saved) {
    showLifeChoice();
    return;
  }

  const corrected = normalizeEarlyEvent(saved);
  if (corrected) writeSave(saved);

  if (saved.introPending) {
    showIntroduction(saved);
    return;
  }

  await loadGame();
}

boot().catch(showStartupError);
