(function () {
  "use strict";

  const STORAGE_KEY = "little-days-save-v2";
  let renderedSnapshot = null;
  let resolving = false;

  function readState() {
    try {
      const state = JSON.parse(localStorage.getItem(STORAGE_KEY));
      return state?.version === 2 && state.character && state.household ? state : null;
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

  function buttonChoiceId(button) {
    return button?.dataset?.childhoodChoice || button?.dataset?.contextChoice || button?.dataset?.choice || null;
  }

  function rememberVisiblePrompt() {
    const choices = [...document.querySelectorAll(".screen .choices .choice-button")];
    if (!choices.length) return;
    const state = readState();
    if (!state || state.resolution) return;

    renderedSnapshot = {
      state: clone(state),
      ageMonths: Number(state.character?.ageMonths) || 0,
      choiceIds: choices.map(buttonChoiceId),
      title: document.querySelector(".screen .event-title")?.textContent || "",
    };
  }

  function installPromptWatcher() {
    const app = document.querySelector("#app");
    if (!app) return;
    const capture = () => queueMicrotask(rememberVisiblePrompt);
    new MutationObserver(capture).observe(app, { childList: true, subtree: true });
    capture();
  }

  function visibleSnapshotMatches(state, button) {
    if (!renderedSnapshot) return false;
    if ((Number(state.character?.ageMonths) || 0) !== renderedSnapshot.ageMonths) return false;
    const id = buttonChoiceId(button);
    return Boolean(id && renderedSnapshot.choiceIds.includes(id));
  }

  function showResolution(state, clickedButton) {
    const choices = clickedButton.closest(".choices") || document.querySelector(".screen .choices");
    if (!choices || !state.resolution) return;
    const selectedId = state.resolution.choiceId;

    choices.querySelectorAll(".choice-button").forEach((button) => {
      const selected = buttonChoiceId(button) === selectedId;
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

  async function resolveChoiceClick(button) {
    if (resolving || button.disabled) return;
    let state = readState();
    if (!state) return;

    // A stale hidden resolution should never make a visibly active prompt untappable.
    if (state.resolution && !document.querySelector(".screen .result-card")) {
      state.resolution = null;
    }
    if (state.resolution) return;

    resolving = true;
    const group = button.closest(".choices");
    group?.setAttribute("aria-busy", "true");

    try {
      if (button.dataset.childhoodChoice) {
        const [{ resolveChildhoodChoice }, childhood] = await Promise.all([
          import("./childhood-v10-resolve.js?v=4"),
          import("./childhood-v12.js?v=1"),
        ]);

        let visibleEvent = null;
        if (visibleSnapshotMatches(state, button)) {
          try {
            visibleEvent = childhood.childhoodEventForState(clone(renderedSnapshot.state));
          } catch {
            visibleEvent = null;
          }
        }
        resolveChildhoodChoice(state, button.dataset.childhoodChoice, visibleEvent);
      } else if (button.dataset.contextChoice) {
        const contextual = await import("./contextual-events-v3.js?v=1");
        contextual.resolveContextualChoice(state, button.dataset.contextChoice);
      } else if (button.dataset.choice) {
        const engine = await import("./engine-v31.js?v=1");
        engine.resolveChoice(state, button.dataset.choice);
      }

      if (!state.resolution) {
        // The DOM is the question the player actually answered. If another system changed
        // state between render and tap, restore the captured state once and resolve there.
        if (button.dataset.childhoodChoice && visibleSnapshotMatches(state, button)) {
          const [{ resolveChildhoodChoice }, childhood] = await Promise.all([
            import("./childhood-v10-resolve.js?v=4"),
            import("./childhood-v12.js?v=1"),
          ]);
          const fallback = clone(renderedSnapshot.state);
          fallback.resolution = null;
          const visibleEvent = childhood.childhoodEventForState(clone(fallback));
          resolveChildhoodChoice(fallback, button.dataset.childhoodChoice, visibleEvent);
          if (fallback.resolution) state = fallback;
        }
      }

      if (!state.resolution) {
        // Do not leave a dead button. Re-render from the saved state so a stale prompt
        // cannot remain onscreen pretending it is interactive.
        window.dispatchEvent(new HashChangeEvent("hashchange"));
        return;
      }

      writeState(state);
      showResolution(state, button);
    } catch (error) {
      console.error("Little Days choice hotfix failed", error);
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    } finally {
      resolving = false;
      group?.removeAttribute("aria-busy");
    }
  }

  async function continueLifeClick() {
    if (resolving) return;
    let state = readState();
    if (!state?.resolution) return;
    resolving = true;

    try {
      const [engine, childhood, realism, membership] = await Promise.all([
        import("./engine-v31.js?v=1"),
        import("./childhood-v12.js?v=1"),
        import("./realism-v5.js?v=1"),
        import("./household-membership.js?v=24"),
      ]);

      const before = Number(state.character.ageMonths) || 0;
      engine.continueLife(state);
      const elapsed = Math.max(0, (Number(state.character.ageMonths) || 0) - before);
      childhood.advanceChildhoodWorld(state, elapsed, before);
      realism.advanceRealism(state, elapsed, before);
      membership.syncHouseholdMembership(state);
      writeState(state);
      renderedSnapshot = null;
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    } catch (error) {
      console.error("Little Days continue hotfix failed", error);
    } finally {
      resolving = false;
    }
  }

  document.addEventListener(
    "click",
    (event) => {
      const target = event.target.closest?.("#continue-life,[data-childhood-choice],[data-context-choice],[data-choice]");
      if (!target || !target.closest?.(".screen")) return;

      // Capture before every other life-screen listener. The app has several layers of
      // event systems now; one authoritative click path is less glamorous and much saner.
      event.preventDefault();
      event.stopImmediatePropagation();

      if (target.id === "continue-life") continueLifeClick();
      else resolveChoiceClick(target);
    },
    true,
  );

  installPromptWatcher();
})();
