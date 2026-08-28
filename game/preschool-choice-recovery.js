(function () {
  "use strict";

  const STORAGE_KEY = "little-days-save-v2";
  const TITLE = "You are becoming more capable";
  const EVENT_ID = "childhood_stage_preschool";
  const QUEUE_KEY = "stage:preschool";
  let handling = false;

  const choiceData = {
    self: {
      label: "Do more by yourself",
      result: "Independence becomes something you practice in tiny, repetitive ways.",
      apply(state) {
        state.character.personality ||= {};
        state.character.personality.independence = clamp((state.character.personality.independence ?? 50) + 2);
      },
    },
    ask: {
      label: "Ask endless questions",
      result: "Every answer appears to generate at least two more questions. Adults discover this is mathematically unsustainable.",
      apply(state) {
        state.character.personality ||= {};
        state.character.personality.curiosity = clamp((state.character.personality.curiosity ?? 50) + 3);
      },
    },
    play: {
      label: "Turn everything into play",
      result: "Play remains one of the main ways you learn what people and objects can do.",
      apply(state) {
        state.interests ||= {};
        state.interests.making = clamp((state.interests.making ?? 50) + 2);
      },
    },
  };

  function clamp(value) {
    return Math.max(0, Math.min(100, Number(value) || 0));
  }

  function readState() {
    try {
      const state = JSON.parse(localStorage.getItem(STORAGE_KEY));
      return state?.version === 2 && state.character && state.household ? state : null;
    } catch {
      return null;
    }
  }

  function visibleButton(event) {
    const raw = event.target;
    const element = raw instanceof Element ? raw : raw?.parentElement;
    const button = element?.closest?.(".screen .choice-button[data-childhood-choice]");
    if (!button) return null;
    const title = button.closest(".screen")?.querySelector(".event-title")?.textContent?.trim();
    if (title !== TITLE) return null;
    return button;
  }

  function preschoolEvent() {
    return {
      id: EVENT_ID,
      category: "Self",
      title: TITLE,
      body: "You can now do more things without an adult physically guiding every step. Play, language, questions, small rules, and very strong opinions take up more of your days.",
      prompt: "What do you keep trying to do?",
      choices: Object.entries(choiceData).map(([id, choice]) => ({
        id,
        label: choice.label,
        result: choice.result,
      })),
      contextKind: "childhood-v2",
      childhoodQueueKey: QUEUE_KEY,
      childhoodType: "stage_transition",
      childhoodPersonId: null,
      childhoodSecondaryPersonId: null,
    };
  }

  function resolve(button) {
    if (handling || button.disabled) return;
    const choiceId = button.dataset.childhoodChoice;
    const selected = choiceData[choiceId];
    if (!selected) return;

    const state = readState();
    if (!state) return;
    handling = true;

    // Old saves could carry a hidden resolution while the preschool card stayed visibly active.
    // The visible card is authoritative here, so clear that stale blocker before resolving it.
    if (state.resolution && !document.querySelector(".screen .result-card")) state.resolution = null;
    if (state.resolution) {
      handling = false;
      return;
    }

    selected.apply(state);
    state.childhood ||= {};
    state.childhood.seen ||= [];
    if (!state.childhood.seen.includes(QUEUE_KEY)) state.childhood.seen.push(QUEUE_KEY);
    state.childhood.seen = state.childhood.seen.slice(-160);
    if (Array.isArray(state.childhood.eventQueue)) {
      state.childhood.eventQueue = state.childhood.eventQueue.filter((item) => item?.key !== QUEUE_KEY);
    }

    const event = preschoolEvent();
    state.history ||= [];
    state.history.push({
      ageMonths: state.character.ageMonths,
      date: { ...(state.date || {}) },
      eventId: EVENT_ID,
      title: TITLE,
      choiceId,
      choice: selected.label,
      result: selected.result,
      continuity: "childhood-v10",
    });
    state.history = state.history.slice(-1400);
    state.resolution = {
      choiceId,
      result: selected.result,
      childhoodEventId: EVENT_ID,
      childhoodEvent: event,
      depthKind: null,
      depthPersonId: null,
      adolescenceType: null,
      adulthoodType: null,
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    window.dispatchEvent(new CustomEvent("little-days-state-sync", { detail: { state } }));
    window.dispatchEvent(new Event("hashchange"));
    handling = false;
  }

  function intercept(event) {
    const button = visibleButton(event);
    if (!button) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    resolve(button);
  }

  // iOS Safari occasionally behaves differently between touch and synthetic click.
  // Handle both paths, but only for this exact legacy preschool card.
  document.addEventListener("touchend", intercept, { capture: true, passive: false });
  document.addEventListener("click", intercept, true);
  document.documentElement.dataset.preschoolChoiceRecovery = "1";
})();
