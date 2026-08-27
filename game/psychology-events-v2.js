import * as core from "./psychology-events.js?v=1";

export * from "./psychology-events.js?v=1";

function normalizedEvent(event) {
  if (!event) return event;
  return {
    ...event,
    id: String(event.id || "").replace(/[_-]+/g, " "),
  };
}

export function psychologicalEventContext(event) {
  return core.psychologicalEventContext(normalizedEvent(event));
}

export function decorateEventWithPsychology(state, event) {
  if (!event) return event;
  const decorated = core.decorateEventWithPsychology(state, normalizedEvent(event));
  return { ...decorated, id: event.id };
}
