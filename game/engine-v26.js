import * as v25 from "./engine-v25.js?core=26";

export * from "./engine-v25.js?core=26";

function mixedEarlySeed(seed) {
  let value = ((Number(seed) || 1) ^ 0x4a37b91d) >>> 0;
  value = Math.imul(value ^ (value >>> 16), 0x85ebca6b) >>> 0;
  value = Math.imul(value ^ (value >>> 13), 0xc2b2ae35) >>> 0;
  value = (value ^ (value >>> 16)) >>> 0;
  return value || 1;
}

function ensureMixedEarlySeed(state, resetActive = false) {
  if (!state?.character) return state;
  if (!state.earlyChildhoodRngMixed) {
    state.earlyChildhoodRngState = mixedEarlySeed(state.seed);
    state.earlyChildhoodRngMixed = true;
    if (resetActive && state.earlyChildhoodVariety) state.earlyChildhoodVariety.activeEventId = null;
  }
  return state;
}

export function createNewLife(seed = Date.now()) {
  const state = v25.createNewLife(seed);
  ensureMixedEarlySeed(state, true);
  v25.getCurrentEvent(state);
  return state;
}

export function getCurrentEvent(state) {
  ensureMixedEarlySeed(state, true);
  return v25.getCurrentEvent(state);
}

export function resolveChoice(state, choiceId) {
  ensureMixedEarlySeed(state);
  return v25.resolveChoice(state, choiceId);
}

export function continueLife(state) {
  ensureMixedEarlySeed(state);
  return v25.continueLife(state);
}
