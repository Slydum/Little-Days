import * as core from "./childhood-depth.js?v=1";

export * from "./childhood-depth.js?v=1";

export function shouldInsertLittleMoment(state) {
  const contextKind = state.resolution?.contextualEvent?.contextKind || null;
  if (["illness", "recovery", "thread"].includes(contextKind)) return false;
  return core.shouldInsertLittleMoment(state);
}
