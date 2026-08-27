import * as core from "./material-events.js?v=1";
import { ensureMaterialChildhood } from "./material-core.js?v=1";

export function materialEventForState(state) {
  const event = core.materialEventForState(state);
  if (!event) return event;
  const material = ensureMaterialChildhood(state);
  if (event.materialType === "allowance" && material?.allowance?.mode === "ask-as-needed") {
    event.body = "Your parents explain that they are not going to give you a fixed allowance. If you need or want something, you can ask and they will decide case by case.";
  }
  return event;
}

export function commitMaterialEvent(state, event, choice) {
  if (event?.materialType === "worn" && choice?.id === "popular" && event.premium?.kind !== "new") {
    return core.commitMaterialEvent(state, event, { ...choice, id: "replace" });
  }
  return core.commitMaterialEvent(state, event, choice);
}
