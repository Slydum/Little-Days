(function () {
  "use strict";

  const STORAGE_KEY = "little-days-save-v2";
  let busy = false;

  function readState() {
    try {
      const value = JSON.parse(localStorage.getItem(STORAGE_KEY));
      return value?.version === 2 && value.character && value.household ? value : null;
    } catch {
      return null;
    }
  }

  function writeState(state) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    window.dispatchEvent(new CustomEvent("little-days-state-sync", { detail: { state } }));
  }

  function clone(value) {
    try {
      return structuredClone(value);
    } catch {
      return JSON.parse(JSON.stringify(value));
    }
  }

  function visiblePrompt() {
    const screen = document.querySelector(".screen");
    if (!screen) return null;
    const title = screen.querySelector(".event-title")?.textContent?.trim() || "";
    const buttons = [...screen.querySelectorAll(".choices .choice-button[data-childhood-choice]")];
    if (!title || !buttons.length) return null;
    return {
      title,
      ids: buttons.map((button) => button.dataset.childhoodChoice).filter(Boolean),
    };
  }

  function eventMatches(event, prompt, choiceId) {
    if (!event || !prompt) return false;
    if (String(event.title || "").trim() !== prompt.title) return false;
    const ids = (event.choices || []).map((choice) => choice.id);
    return prompt.ids.every((id) => ids.includes(id)) && ids.includes(choiceId);
  }

  function preschoolEvent() {
    return {
      id: "childhood_stage_preschool",
      category: "Self",
      title: "You are becoming more capable",
      body: "You can now do more things without an adult physically guiding every step. Play, language, questions, small rules, and very strong opinions take up more of your days.",
      prompt: "What do you keep trying to do?",
      choices: [
        { id: "self", label: "Do more by yourself", result: "Independence becomes something you practice in tiny, repetitive ways.", effects: [{ type: "personality", key: "independence", delta: 2 }] },
        { id: "ask", label: "Ask endless questions", result: "Every answer appears to generate at least two more questions. Adults discover this is mathematically unsustainable.", effects: [{ type: "personality", key: "curiosity", delta: 3 }] },
        { id: "play", label: "Turn everything into play", result: "Play remains one of the main ways you learn what people and objects can do.", effects: [{ type: "interest", key: "making", delta: 2 }] },
      ],
      contextKind: "childhood-v2",
      childhoodQueueKey: "stage:preschool",
      childhoodType: "stage_transition",
      childhoodPersonId: null,
      childhoodSecondaryPersonId: null,
    };
  }

  async function findDisplayedEvent(state, choiceId) {
    const prompt = visiblePrompt();
    if (!prompt) return null;
    const lifeStages = await import("./life-stages-v1.js?v=2");

    try {
      const current = lifeStages.childhoodEventForState(clone(state));
      if (eventMatches(current, prompt, choiceId)) return current;
    } catch {
      // Keep looking. The visible DOM is the question the player actually answered.
    }

    const queue = state.childhood?.eventQueue || [];
    for (let index = 0; index < queue.length; index += 1) {
      try {
        const probe = clone(state);
        probe.resolution = null;
        const candidate = clone(queue[index]);
        probe.childhood.eventQueue = [candidate, ...probe.childhood.eventQueue.filter((_, itemIndex) => itemIndex !== index)];
        const event = lifeStages.childhoodEventForState(probe);
        if (eventMatches(event, prompt, choiceId)) return event;
      } catch {
        // Ignore one malformed background item and keep searching.
      }
    }

    const fallback = preschoolEvent();
    return eventMatches(fallback, prompt, choiceId) ? fallback : null;
  }

  function showResolution(state, clickedButton) {
    const choices = clickedButton.closest(".choices");
    if (!choices || !state.resolution) return;
    const selectedId = state.resolution.choiceId;

    choices.querySelectorAll(".choice-button").forEach((button) => {
      const id = button.dataset.childhoodChoice || button.dataset.contextChoice || button.dataset.choice;
      const selected = id === selectedId;
      button.disabled = true;
      button.classList.toggle("primary", selected);
      button.setAttribute("aria-pressed", String(selected));
    });

    let result = choices.nextElementSibling;
    if (!result || !result.classList.contains("result-card")) {
      result = document.createElement("div");
      result.className = "result-card";
      choices.insertAdjacentElement("afterend", result);
    }
    result.textContent = state.resolution.result || "Your choice becomes part of what happens next.";

    let next = result.nextElementSibling;
    if (!next || next.id !== "continue-life") {
      next = document.createElement("button");
      next.id = "continue-life";
      next.className = "utility-button";
      next.textContent = "Continue";
      result.insertAdjacentElement("afterend", next);
    }
    next.dataset.stabilityContinue = "2";
  }

  async function resolveChildhoodButton(button) {
    if (busy || button.disabled) return;
    busy = true;
    const choices = button.closest(".choices");
    choices?.setAttribute("aria-busy", "true");

    try {
      let state = readState();
      if (!state) return;

      if (state.resolution && !document.querySelector(".screen .result-card")) state.resolution = null;
      if (state.resolution) return;

      const choiceId = button.dataset.childhoodChoice;
      const displayedEvent = await findDisplayedEvent(state, choiceId);
      if (!displayedEvent) {
        window.dispatchEvent(new HashChangeEvent("hashchange"));
        return;
      }

      const resolver = await import("./life-stages-resolve-v1.js?v=2");
      resolver.resolveChildhoodChoice(state, choiceId, displayedEvent);

      if (!state.resolution) {
        const fallback = readState();
        if (fallback) {
          fallback.resolution = null;
          resolver.resolveChildhoodChoice(fallback, choiceId, displayedEvent);
          if (fallback.resolution) state = fallback;
        }
      }

      if (!state.resolution) return;
      writeState(state);
      showResolution(state, button);
    } catch (error) {
      console.error("Little Days stable choice resolver failed", error);
    } finally {
      choices?.removeAttribute("aria-busy");
      busy = false;
    }
  }

  async function continueStableLife(button) {
    if (busy) return;
    busy = true;
    try {
      let state = readState();
      if (!state?.resolution) return;

      const [engine, lifeStages, realism, membership] = await Promise.all([
        import("./engine-v32.js?v=2"),
        import("./life-stages-v1.js?v=2"),
        import("./realism-v5.js?v=2"),
        import("./household-membership.js?v=24"),
      ]);

      const before = Number(state.character.ageMonths) || 0;
      engine.continueLife(state);
      const elapsed = Math.max(0, (Number(state.character.ageMonths) || 0) - before);
      lifeStages.advanceChildhoodWorld(state, elapsed, before);
      realism.advanceRealism(state, elapsed, before);
      membership.syncHouseholdMembership(state);
      writeState(state);
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    } catch (error) {
      console.error("Little Days stable continue failed", error);
      button.disabled = false;
    } finally {
      busy = false;
    }
  }

  document.addEventListener("click", (event) => {
    const childhoodButton = event.target.closest?.(".screen .choice-button[data-childhood-choice]");
    if (childhoodButton) {
      event.preventDefault();
      event.stopImmediatePropagation();
      resolveChildhoodButton(childhoodButton);
      return;
    }

    const continueButton = event.target.closest?.(".screen #continue-life[data-stability-continue='2']");
    if (continueButton) {
      event.preventDefault();
      event.stopImmediatePropagation();
      continueStableLife(continueButton);
    }
  }, true);

  document.documentElement.dataset.choiceStability = "2";
})();