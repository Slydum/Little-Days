import * as core from "./realism.js";

export * from "./realism.js";

const clamp = (value, min = 0, max = 100) => Math.max(min, Math.min(max, value));

function activeIllnesses(state) {
  return Array.isArray(state?.realism?.active) ? state.realism.active : [];
}

function illnessSeverity(items) {
  return items.reduce((highest, illness) => Math.max(highest, Number(illness?.severity) || 2), 0);
}

function addSchoolAbsence(state, severity) {
  const school = state.childhood?.school;
  if (!school?.started || (state.character?.ageMonths || 0) < 60) return;

  const attendanceDrop = severity >= 3 ? 5 : 2;
  school.attendance = clamp((school.attendance ?? 96) - attendanceDrop, 65, 100);
  school.effort = clamp((school.effort ?? 52) - (severity >= 3 ? 2 : 1));
  school.lastIllnessAbsenceAtMonths = state.character.ageMonths;

  const text = severity >= 3
    ? "You miss a longer stretch of school because you are too unwell to attend. Classes continue without you, and catching up will take time."
    : "You miss some school while you recover. Classes continue without you, and your attendance takes a small hit.";

  const item = {
    category: "School",
    text,
    importance: severity >= 3 ? 3 : 2,
    ageMonths: state.character.ageMonths,
    date: state.date ? { ...state.date } : null,
    personId: null,
  };

  state.realism.latest ||= [];
  if (!state.realism.latest.some((entry) => entry.category === "School" && entry.text === text)) {
    state.realism.latest.push(item);
    state.realism.latest = state.realism.latest
      .sort((a, b) => (b.importance || 0) - (a.importance || 0))
      .slice(0, 5);
  }

  state.worldEvents ||= [];
  if (!state.worldEvents.some((entry) => entry.ageMonths === item.ageMonths && entry.text === text)) {
    state.worldEvents.push({ ...item, note: text, source: "illness-coherence" });
    state.worldEvents = state.worldEvents.slice(-100);
  }
}

/**
 * Acute illnesses should not occupy an unlimited number of three-month game turns.
 * A routine illness gets one interactive sick-day beat, then moves to recovery.
 * A severe illness may get one continuation beat so escalation still has weight.
 */
export function normalizeRepeatedIllness(state) {
  const illnesses = activeIllnesses(state);
  const turns = Number(state?.contextual?.illness?.turns) || 0;
  if (!illnesses.length || turns <= 0 || state.death) return false;

  let forcedRecovery = false;
  const remaining = illnesses.filter((illness) => {
    const severity = Number(illness?.severity) || 2;
    if (severity <= 2) {
      forcedRecovery = true;
      return false;
    }
    if (turns >= 2) {
      forcedRecovery = true;
      return false;
    }
    return true;
  });

  if (forcedRecovery) {
    state.realism.active = remaining;
    if (!remaining.length) state.health.wellbeing = clamp((state.health?.wellbeing ?? 70) + 2);
  }
  return forcedRecovery;
}

/**
 * Wrap the existing realism simulation with turn-scale coherence.
 * Little Days advances several months per choice, while common childhood illnesses
 * usually last days or weeks. The wrapper keeps that mismatch from turning one cold
 * into half a school year of identical prompts.
 */
export function advanceRealism(state, elapsedMonths, beforeAgeMonths) {
  const before = activeIllnesses(state).map((illness) => ({
    id: illness.id,
    severity: Number(illness.severity) || 2,
  }));
  const beforeIds = new Set(before.map((illness) => illness.id));

  const next = core.advanceRealism(state, elapsedMonths, beforeAgeMonths);
  const afterSimulation = activeIllnesses(next);

  // The core simulation currently advances a newly-created illness through the same
  // multi-month interval immediately. Reset the displayed duration for survivors so
  // the illness starts now instead of arriving already "three months old."
  for (const illness of afterSimulation) {
    if (!beforeIds.has(illness.id)) illness.months = 0;
  }

  const affectedThisTurn = before.length > 0 || afterSimulation.length > 0;
  const severity = illnessSeverity([...before, ...afterSimulation]) || 2;

  normalizeRepeatedIllness(next);

  if (affectedThisTurn && !next.death) addSchoolAbsence(next, severity);
  return next;
}
