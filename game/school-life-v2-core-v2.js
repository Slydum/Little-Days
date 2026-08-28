import * as core from "./school-life-v2-core.js?v=1";

export const ensureSchoolLifeV2 = core.ensureSchoolLifeV2;
export const advanceSchoolLifeV2 = core.advanceSchoolLifeV2;
export const schoolModeIsConventional = core.schoolModeIsConventional;
export const schoolLifeSnapshot = core.schoolLifeSnapshot;
export const switchEducationMode = core.switchEducationMode;

function purgeSyntheticClassroomPeople(state) {
  const profile = state.childhood?.schoolV2;
  if (!profile || !["homeschool", "out-of-school"].includes(profile.mode)) return;

  const cutoff = Number(profile.enteredAtMonths) || 60;
  const removed = new Set();
  state.people = (state.people || []).filter((person) => {
    if (person.community?.educationAlternative) return true;
    const introduced = Number(person.introducedAtMonths) || 0;
    if (introduced < cutoff) return true;
    const classroomRole = ["teacher", "formerTeacher", "classmate"].includes(person.role);
    const classroomFriend = person.role === "friend" && person.school?.currentClass === true;
    if (!classroomRole && !classroomFriend) return true;
    removed.add(person.id);
    return false;
  });

  const school = state.childhood?.school;
  if (school) {
    school.currentTeacherId = null;
    school.currentClassmateIds = [];
    school.friendGroupIds = (school.friendGroupIds || []).filter((id) => !removed.has(id));
  }
  if (removed.has(state.childhood?.crush?.personId)) state.childhood.crush = null;
}

export function sanitizeLegacySchoolForPath(state) {
  core.sanitizeLegacySchoolForPath(state);
  purgeSyntheticClassroomPeople(state);
  return state;
}
