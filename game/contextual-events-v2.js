import * as core from "./contextual-events.js?core=psychology-events-v2";
import { decorateEventWithPsychology } from "./psychology-events-v2.js?v=1";

export * from "./contextual-events.js?core=psychology-events-v2";

export function contextualEventForState(state) {
  const event = core.contextualEventForState(state);
  return event ? decorateEventWithPsychology(state, event) : event;
}
