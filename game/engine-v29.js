import * as core from "./engine-v28.js?core=psychology-events-v1";
import { decorateEventWithPsychology } from "./psychology-events.js?v=1";

export * from "./engine-v28.js?core=psychology-events-v1";

export function getCurrentEvent(state) {
  const event = core.getCurrentEvent(state);
  return event ? decorateEventWithPsychology(state, event) : event;
}
