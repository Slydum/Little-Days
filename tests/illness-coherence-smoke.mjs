import { applyIllnessSchoolAbsence, normalizeRepeatedIllness } from "../game/realism-v2.js";

function illnessState(severity, turns) {
  return {
    character: { ageMonths: 84 },
    date: { year: 2033, month: 6, day: 12 },
    health: { wellbeing: 70, energy: 60, stress: 25 },
    realism: {
      active: [{ id: "test-illness", label: "respiratory infection", severity, months: 3, delayed: false }],
      latest: [],
    },
    contextual: { illness: { label: "respiratory infection", turns } },
    childhood: {
      school: { started: true, attendance: 96, effort: 55 },
    },
    worldEvents: [],
  };
}

const routine = illnessState(2, 1);
if (!normalizeRepeatedIllness(routine)) throw new Error("A handled routine illness was not moved toward recovery");
if (routine.realism.active.length !== 0) throw new Error("Routine illness repeated after its interactive sick-day beat");
if (routine.health.wellbeing <= 70) throw new Error("Forced routine recovery did not restore any wellbeing");

const severeContinuation = illnessState(3, 1);
normalizeRepeatedIllness(severeContinuation);
if (severeContinuation.realism.active.length !== 1) throw new Error("Severe illness lost its one allowed continuation beat");

const severeTooLong = illnessState(3, 2);
if (!normalizeRepeatedIllness(severeTooLong)) throw new Error("Long-running severe illness was not capped at two interactive beats");
if (severeTooLong.realism.active.length !== 0) throw new Error("Severe illness kept repeating identical sickness turns");

const school = illnessState(2, 0);
applyIllnessSchoolAbsence(school, 2);
if (school.childhood.school.attendance !== 94) throw new Error("Routine illness did not reduce school attendance");
if (school.childhood.school.effort !== 54) throw new Error("Routine illness did not affect school effort");
if (!school.realism.latest.some((item) => item.category === "School" && item.text.includes("miss some school"))) {
  throw new Error("School absence was not surfaced in the life updates");
}

const severeSchool = illnessState(3, 0);
applyIllnessSchoolAbsence(severeSchool, 3);
if (severeSchool.childhood.school.attendance !== 91) throw new Error("Severe illness did not create a larger attendance hit");
if (!severeSchool.realism.latest.some((item) => item.text.includes("longer stretch of school"))) {
  throw new Error("Severe illness did not explain the longer absence");
}

console.log("Illness coherence smoke test passed");
