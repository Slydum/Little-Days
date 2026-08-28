export function challengeMayPresent(state, urgentContext = false) {
  if (state?.resolution?.challengeEventId) return true;
  return !urgentContext && !state?.resolution;
}
