import * as core from "./engine-v29.js?core=depth-v2";
import {
  beginLittleMomentPause,
  clearDepthResolutionWithoutTime,
  ensureChildhoodDepth,
  restorePendingAdvance,
  shouldInsertLittleMoment,
} from "./childhood-depth-v2.js?v=1";

export * from "./engine-v29.js?core=depth-v2";

export function createNewLife(seed = Date.now()) {
  const state = core.createNewLife(seed);
  ensureChildhoodDepth(state);
  return state;
}

export function getCurrentEvent(state) {
  ensureChildhoodDepth(state);
  return core.getCurrentEvent(state);
}

export function continueLife(state) {
  ensureChildhoodDepth(state);
  const kind = state.resolution?.depthKind || null;

  // Player-initiated relationship time is extra life, not a three-month tax.
  if (kind === "interaction") return clearDepthResolutionWithoutTime(state);

  // An ordinary moment inserted between major beats finishes the pending major advance.
  if (kind === "little-moment") {
    const pending = restorePendingAdvance(state);
    if (!pending) return clearDepthResolutionWithoutTime(state);
    const next = core.continueLife(state);
    ensureChildhoodDepth(next);
    return next;
  }

  // Most major events now have room for one ordinary scene before the calendar jumps.
  if (shouldInsertLittleMoment(state)) {
    beginLittleMomentPause(state);
    return state;
  }

  const next = core.continueLife(state);
  ensureChildhoodDepth(next);
  return next;
}
