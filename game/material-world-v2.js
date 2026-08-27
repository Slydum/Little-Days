import * as core from "./material-world.js?v=1";
import { age, ensureMaterialChildhood } from "./material-core.js?v=1";

export function advanceMaterialChildhood(state, elapsedMonths = 0, beforeAgeMonths = null) {
  const material = ensureMaterialChildhood(state);
  if (material?.allowance && age(state) >= 6) {
    const alreadyIntroduced = (material.seen || []).some((key) => String(key).startsWith("allowance:"))
      || (material.pending || []).some((event) => event.type === "allowance");
    if (!alreadyIntroduced && (material.allowance.totalReceived || 0) === 0) material.allowance.announced = false;
  }
  return core.advanceMaterialChildhood(state, elapsedMonths, beforeAgeMonths);
}
