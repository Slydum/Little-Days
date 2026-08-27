import { refreshLifeEnhancer as refreshLegacyLifeEnhancer } from "./life-enhancer.js?v=27";

const STORAGE_KEY = "little-days-save-v2";
const RELOAD_PREFIX = "little-days-enhancer-reload-v27";

function readState() {
  try {
    const state = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return state?.version === 2 ? state : null;
  } catch {
    return null;
  }
}

function suppressLegacyReload(state) {
  if (!state || typeof sessionStorage === "undefined") return;
  const key = `${RELOAD_PREFIX}:${state.seed}:${state.character?.ageMonths || 0}`;
  sessionStorage.setItem(key, "1");
}

function syncAppState() {
  const state = readState();
  if (!state || typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("little-days-state-sync", { detail: { state } }));
}

export function refreshLifeEnhancer() {
  // The legacy enhancer used a full browser reload as a crude way to make its
  // localStorage changes visible to the main app. Keep the world processing,
  // but suppress that reload and sync the fresh state in memory instead.
  suppressLegacyReload(readState());
  refreshLegacyLifeEnhancer();
  syncAppState();
}
