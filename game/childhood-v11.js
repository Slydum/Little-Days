import * as core from "./childhood-v10.js?v=1";
import {
  adaptLegacySchoolEvent,
  advanceSchoolLifeV2,
  commitSchoolLifeV2Event,
  ensureSchoolLifeV2,
  sanitizeLegacySchoolForPath,
  schoolLifeSnapshot,
  schoolLifeV2EventForState,
  schoolModeIsConventional,
} from "./school-life-v2.js?v=1";

export * from "./childhood-v10.js?v=1";
export { schoolLifeSnapshot } from "./school-life-v2.js?v=1";

function nonTraditionalSocialSnapshot(state) {
  const friends = (state.people || [])
    .filter((person) => person.role === "friend" && !person.deceased && person.school?.friendshipStatus !== "former")
    .sort((a, b) => (b.closeness || 0) - (a.closeness || 0));
  const crushState = state.childhood?.crush;
  const crush = crushState && ["active", "fading"].includes(crushState.status)
    ? (state.people || []).find((person) => person.id === crushState.personId) || null
    : null;
  return {
    stage: state.childhood?.stage || null,
    stageLabel: state.childhood?.stage || "Childhood",
    friends,
    friendTiers: friends.map((person, index) => ({ person, tier: index === 0 && (person.closeness || 0) >= 74 ? "Best friend" : "Friend" })),
    closest: friends[0] || null,
    crush,
    crushIntensity: crushState?.intensity ?? null,
    crushReciprocity: crushState?.reciprocity || null,
    socialConfidence: state.childhood?.socialConfidence ?? 50,
    classmates: [],
    school: schoolWorldSnapshot(state),
  };
}

export function ensureChildhoodState(state) {
  const next = core.ensureChildhoodState(state);
  ensureSchoolLifeV2(next);
  sanitizeLegacySchoolForPath(next);
  return next;
}

export function advanceChildhoodWorld(state, elapsedMonths = 0, beforeAgeMonths = null) {
  // Establish the education path before the legacy school simulator sees the new age.
  // This matters at the first school-age tick: otherwise every child would be silently
  // enrolled in a conventional classroom before access/finances got a vote.
  ensureSchoolLifeV2(state);
  const next = core.advanceChildhoodWorld(state, elapsedMonths, beforeAgeMonths);
  ensureSchoolLifeV2(next);
  advanceSchoolLifeV2(next, elapsedMonths, beforeAgeMonths);
  sanitizeLegacySchoolForPath(next);
  return next;
}

export function childhoodEventForState(state) {
  ensureChildhoodState(state);
  const ordinary = core.childhoodEventForState(state);
  if (ordinary?.childhoodDepthKind === "interaction" || ordinary?.childhoodDepthKind === "little-moment") return ordinary;

  const schoolEvent = schoolLifeV2EventForState(state);
  if (schoolEvent) return schoolEvent;

  return adaptLegacySchoolEvent(state, ordinary);
}

export function commitChildhoodEvent(state, event, choice) {
  if (event?.schoolV2Key) {
    commitSchoolLifeV2Event(state, event, choice);
    sanitizeLegacySchoolForPath(state);
    return state;
  }
  const next = core.commitChildhoodEvent(state, event, choice);
  ensureSchoolLifeV2(next);
  sanitizeLegacySchoolForPath(next);
  return next;
}

export function socialSnapshot(state) {
  ensureChildhoodState(state);
  if (!schoolModeIsConventional(state)) return nonTraditionalSocialSnapshot(state);
  return core.socialSnapshot(state);
}

export function schoolWorldSnapshot(state) {
  ensureChildhoodState(state);
  const access = schoolLifeSnapshot(state);
  if (!access) return null;
  if (!schoolModeIsConventional(state)) {
    const friends = (state.people || []).filter((person) => person.role === "friend" && !person.deceased);
    return {
      grade: access.grade,
      term: access.mode === "homeschool" ? "Flexible home-study schedule" : "No current school term",
      teacher: null,
      teacherSupport: 0,
      attendance: access.mode === "homeschool" ? 100 : 0,
      effort: state.childhood?.school?.effort ?? 50,
      performance: { ...(state.education?.subjects || {}) },
      overallPerformance: state.childhood?.school?.overallPerformance ?? 50,
      classmates: [],
      friends,
      friendTiers: friends.map((person) => ({ person, tier: "Friend" })),
      rivals: [],
      activities: [],
      access,
    };
  }
  const snapshot = core.schoolWorldSnapshot(state);
  return snapshot ? { ...snapshot, access } : { access };
}
