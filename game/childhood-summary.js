import { ensureSchoolCoherence, schoolCoherenceSnapshot } from "./school-coherence.js?v=1";
import { ensureRelationshipContinuity, relationshipContinuitySnapshot } from "./relationship-continuity.js?v=1";
import { syncPsychologicalDevelopment } from "./psychology.js?v=1";
import { PATTERN_DEFINITIONS, syncPsychologyPhase2 } from "./psychology-phase2.js?v=1";
import { psychologyPhase3Snapshot, syncPsychologyPhase3 } from "./psychology-phase3.js?v=1";

const VERSION = 1;
const CHILDHOOD_END_MONTHS = 13 * 12;

const INTEREST_LABELS = {
  drawing: "drawing",
  reading: "reading",
  gardening: "gardening",
  cooking: "cooking",
  gaming: "games",
  music: "music",
  making: "making things",
};

const ROLE_LABELS = {
  guardian: "Parent / guardian",
  secondGuardian: "Parent / guardian",
  mother: "Mother",
  father: "Father",
  sibling: "Sibling",
  grandmother: "Grandmother",
  grandfather: "Grandfather",
  aunt: "Aunt",
  uncle: "Uncle",
  cousin: "Cousin",
  friend: "Friend",
  classmate: "Classmate",
  teacher: "Teacher",
};

const average = (values, fallback = 0) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : fallback;
const ageMonths = (state) => state.character?.ageMonths || 0;
const firstName = (state) => state.character?.firstName || "You";
const first = (person) => String(person?.name || "Someone").split(/\s+/)[0];

function humanList(items) {
  const clean = items.filter(Boolean);
  if (!clean.length) return "";
  if (clean.length === 1) return clean[0];
  if (clean.length === 2) return `${clean[0]} and ${clean[1]}`;
  return `${clean.slice(0, -1).join(", ")}, and ${clean[clean.length - 1]}`;
}

function roleLabel(person) {
  return person?.relationshipLabel || ROLE_LABELS[person?.role] || "Important person";
}

function introducedPeople(state) {
  const now = ageMonths(state);
  return (state.people || []).filter((person) => (person.introducedAtMonths || 0) <= now);
}

function memoryCountFor(state, personId) {
  return (state.memories || []).filter((memory) => memory.personId === personId).length;
}

function relationshipImportance(state, person) {
  const continuity = relationshipContinuitySnapshot(state, person.id);
  const closeness = Number(person.closeness) || 0;
  const trust = Number(person.trust) || 0;
  const affection = Number(person.affection) || 0;
  const beats = continuity?.beatCount || 0;
  const memories = memoryCountFor(state, person.id);
  const familyWeight = person.family?.caregiver || ["guardian", "secondGuardian", "mother", "father", "sibling", "grandmother", "grandfather"].includes(person.role) ? 10 : 0;
  const teacherPenalty = person.role === "teacher" && beats === 0 ? 18 : 0;
  return closeness * 0.42 + trust * 0.32 + affection * 0.14 + beats * 6 + memories * 5 + familyWeight - teacherPenalty;
}

function importantPeople(state) {
  ensureRelationshipContinuity(state);
  return introducedPeople(state)
    .filter((person) => person.role !== "classmate" || person.role === "friend" || memoryCountFor(state, person.id))
    .map((person) => ({ person, continuity: relationshipContinuitySnapshot(state, person.id), importance: relationshipImportance(state, person) }))
    .sort((a, b) => b.importance - a.importance)
    .slice(0, 5)
    .map(({ person, continuity }) => ({
      id: person.id,
      name: person.name,
      role: roleLabel(person),
      deceased: Boolean(person.deceased),
      closeness: person.closeness ?? null,
      trust: person.trust ?? null,
      conflict: person.conflict ?? null,
      arc: continuity?.arc || null,
      beatCount: continuity?.beatCount || 0,
      unresolved: Boolean(continuity?.unresolved),
      currentThread: continuity?.currentThread || person.npc?.currentThread || "",
      significantMoments: [...(continuity?.moments || [])].slice(-3),
    }));
}

function homeSection(state) {
  const livingCaregivers = introducedPeople(state).filter((person) => !person.deceased && (person.family?.caregiver || ["guardian", "secondGuardian", "mother", "father"].includes(person.role)));
  const caregiverTrust = average(livingCaregivers.map((person) => person.trust ?? 50), 50);
  const caregiverCloseness = average(livingCaregivers.map((person) => person.closeness ?? 50), 50);
  const adversity = state.psychology?.exposures?.adversity || {};
  const protective = state.psychology?.exposures?.protective || {};
  const conflict = adversity.family_conflict?.score || 0;
  const instability = adversity.instability?.score || 0;
  const unavailable = adversity.caregiver_unavailability?.score || 0;
  const stable = protective.stable_caregiver?.score || 0;
  const repair = protective.repair_after_conflict?.score || 0;

  let copy;
  if (instability >= 12) copy = "Home changed shape enough during childhood that stability could not always be taken for granted.";
  else if (conflict >= 12) copy = repair >= 8
    ? "Home had real periods of tension, but some of those ruptures were followed by repair instead of simply being forgotten."
    : "Home had periods where tension or conflict became part of the emotional background.";
  else if ((caregiverTrust + caregiverCloseness) / 2 >= 66 || stable >= 14) copy = "Home was mostly a place where familiar people and routines could function as a secure base.";
  else if (unavailable >= 10) copy = "Care and connection existed, but there were also stretches when support did not always feel immediately available.";
  else copy = "Home was a mixture of ordinary routines, limits, affection, and the changing moods of the people living there.";

  const items = [];
  if (livingCaregivers.length) items.push(`${humanList(livingCaregivers.slice(0, 3).map((person) => first(person)))} remained among the adults responsible for your day-to-day care.`);
  if (state.household?.financeBand === "Tight") items.push("Money often placed limits on what the household could comfortably do, without defining the whole childhood.");
  if (state.household?.financeBand === "Comfortable") items.push("The household generally had more financial room than many families do.");
  if (instability >= 12 && livingCaregivers.length) items.push("Even through change, the people who stayed present mattered to how secure those changes eventually felt.");
  return { id: "home", title: "The home you grew up in", copy, items };
}

function peopleSection(state, people) {
  if (!people.length) return { id: "people", title: "People who shaped childhood", copy: "No single relationship dominated the story of childhood.", items: [] };
  const items = people.map((person) => {
    let relationship = person.currentThread || `${person.name} was part of your childhood.`;
    if (person.deceased) relationship += " They had died by the end of childhood, but their place in your history remained.";
    else if (person.unresolved) relationship += " Something between you still felt unfinished as childhood ended.";
    return `${person.name} · ${person.role}. ${relationship}`;
  });
  const closest = people[0];
  return {
    id: "people",
    title: "People who shaped childhood",
    copy: `${closest.name} was among the relationships carrying the most weight by thirteen. Childhood was shaped not just by who was present, but by what happened repeatedly between you.`,
    items,
  };
}

function schoolSection(state) {
  ensureSchoolCoherence(state);
  const school = schoolCoherenceSnapshot(state);
  if (!school) return { id: "school", title: "School years", copy: "School had not yet become a large enough part of the life to summarize.", items: [] };
  const items = [];
  if (school.strengths?.length) items.push(`${humanList(school.strengths)} became recurring academic strengths rather than one-off good terms.`);
  if (school.struggles?.length) items.push(`${humanList(school.struggles)} kept requiring more work across school years.`);
  if (school.recurringActivities?.length) items.push(`${humanList(school.recurringActivities)} lasted long enough to become part of the rhythm of school life.`);
  if (school.continuityNote) items.push(school.continuityNote);
  return { id: "school", title: "School years", copy: school.trajectory, items, snapshot: school };
}

function interestSection(state) {
  const ranked = Object.entries(state.interests || {}).sort((a, b) => b[1] - a[1]).slice(0, 3);
  if (!ranked.length) return { id: "interests", title: "Things that became yours", copy: "Interests were still taking shape.", items: [] };
  const labels = ranked.map(([key]) => INTEREST_LABELS[key] || key);
  const lead = ranked[0];
  const gap = lead && ranked[1] ? lead[1] - ranked[1][1] : 0;
  const copy = gap >= 10
    ? `${INTEREST_LABELS[lead[0]] || lead[0]} stood out as the clearest interest by the end of childhood.`
    : `${humanList(labels)} all became meaningful parts of how you spent attention and free time.`;
  return { id: "interests", title: "Things that became yours", copy, items: labels.map((label) => `${label.charAt(0).toUpperCase()}${label.slice(1)} kept returning often enough to matter.`), ranked };
}

function selfObservations(state) {
  const d = state.psychology?.dimensions || {};
  const p = state.character?.personality || {};
  const observations = [];
  if ((d.autonomy ?? 50) >= 64) observations.push("You increasingly wanted room to make decisions for yourself rather than simply follow the shape adults gave you.");
  if ((d.socialSafety ?? 50) >= 64) observations.push("Other people generally began to feel approachable enough that curiosity could compete with self-consciousness.");
  else if ((d.socialSafety ?? 50) <= 42) observations.push("You often needed more time to decide whether a social situation felt safe enough to enter fully.");
  if ((d.resilience ?? 50) >= 64) observations.push("You became better at recovering after difficult moments instead of treating each one as permanent.");
  else if ((d.emotionalRegulation ?? 50) <= 42) observations.push("Strong feelings could still arrive faster than you could organize them, especially under pressure.");
  if ((d.selfWorth ?? 50) >= 64) observations.push("Success and failure were becoming less likely to decide your whole opinion of yourself.");
  else if ((d.shameSensitivity ?? 50) >= 64) observations.push("Being wrong, criticized, or exposed could still feel heavier than the situation looked from the outside.");
  if ((d.emotionalOpenness ?? 50) >= 64) observations.push("You had become more willing to notice what you felt and let trusted people see some of it.");
  if ((p.curiosity ?? 50) >= 64) observations.push("Curiosity remained one of the clearest forces pulling you toward new ideas, objects, and experiences.");
  return observations.slice(0, 4);
}

function selfSection(state) {
  const observations = selfObservations(state);
  return {
    id: "self",
    title: "The person taking shape",
    copy: observations[0] || "By thirteen, personality was clearer than it had been in early childhood, but still very much capable of changing.",
    items: observations.slice(1),
  };
}

function copingSection(state) {
  const patterns = state.psychology?.coping?.patterns || {};
  const adaptive = Object.entries(patterns)
    .filter(([id, item]) => PATTERN_DEFINITIONS[id]?.adaptive && (item.score || 0) >= 12)
    .sort((a, b) => (b[1].score || 0) - (a[1].score || 0))
    .slice(0, 3)
    .map(([id]) => PATTERN_DEFINITIONS[id].label);
  const defensive = Object.entries(patterns)
    .filter(([id, item]) => !PATTERN_DEFINITIONS[id]?.adaptive && (item.score || 0) >= 16)
    .sort((a, b) => (b[1].score || 0) - (a[1].score || 0))
    .slice(0, 2)
    .map(([id]) => PATTERN_DEFINITIONS[id].label);
  const items = [];
  if (adaptive.length) items.push(`More familiar constructive responses included ${humanList(adaptive)}.`);
  if (defensive.length) items.push(`Under pressure, you could also fall back on ${humanList(defensive)}. Those habits were learned responses, not permanent traits.`);
  const copy = adaptive.length || defensive.length
    ? "Repeated choices had begun turning individual reactions into recognizable coping habits."
    : "Your coping style was still relatively flexible, without one response dominating most difficult situations.";
  return { id: "coping", title: "How you learned to cope", copy, items, adaptive, defensive };
}

function mentalWellbeingSection(state) {
  const snapshot = psychologyPhase3Snapshot(state);
  const meaningful = snapshot.symptoms?.length || snapshot.diagnosed?.length || snapshot.care?.length || snapshot.recognition;
  if (!meaningful) return null;
  const items = [];
  if (snapshot.symptoms?.length) items.push(...snapshot.symptoms.slice(0, 3));
  if (snapshot.diagnosed?.length) items.push(...snapshot.diagnosed.map((item) => `${item.label} was ${item.status} by the end of childhood.`));
  if (snapshot.care?.length) items.push(`Support had included ${humanList(snapshot.care)}.`);
  return {
    id: "mental-wellbeing",
    title: "Mental wellbeing",
    copy: snapshot.recognition || "Some emotional-health experiences had become important enough to carry forward into adolescence.",
    items,
    diagnosed: snapshot.diagnosed || [],
    care: snapshot.care || [],
  };
}

function memorySection(state) {
  const memories = [...(state.memories || [])]
    .sort((a, b) => Number(Boolean(b.featured)) - Number(Boolean(a.featured)) || (b.importance || 0) - (a.importance || 0) || (b.ageMonths || 0) - (a.ageMonths || 0));
  const unique = [];
  const seen = new Set();
  for (const memory of memories) {
    const key = `${memory.title || ""}|${memory.copy || ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(memory);
    if (unique.length >= 5) break;
  }
  const items = unique.map((memory) => {
    const age = memory.age ?? Math.floor((memory.ageMonths || 0) / 12);
    return `Age ${age}: ${memory.title || "A memory"}. ${memory.copy || ""}`.trim();
  });
  return {
    id: "memories",
    title: "Memories that stayed",
    copy: unique.length ? "Not every childhood event stayed equally vivid. These were among the moments that carried the most weight into thirteen." : "No moment had yet been marked as a lasting memory.",
    items,
    memoryIds: unique.map((memory) => memory.id).filter(Boolean),
  };
}

function unresolvedSection(state, people, school, mental) {
  const items = [];
  const unfinishedPeople = people.filter((person) => person.unresolved);
  if (unfinishedPeople.length) items.push(`${humanList(unfinishedPeople.map((person) => first(person)))} remained part of relationship stories that did not feel completely finished.`);
  if (school?.struggles?.length) items.push(`${humanList(school.struggles)} remained recurring school difficulties rather than fully solved problems.`);
  if (mental?.diagnosed?.some((item) => item.status === "active")) items.push("An active mental-health condition would still need care and context as adolescence begins.");
  else if (mental?.recognition) items.push("Some recurring emotional difficulties still deserved attention rather than being dismissed as a finished childhood phase.");
  const activeHealth = state.realism?.active || [];
  if (activeHealth.length) items.push("A current health issue was still active as childhood ended.");
  return {
    id: "carrying-forward",
    title: "What you carry forward",
    copy: items.length ? "Turning thirteen did not reset the person childhood had been shaping." : "No single unresolved issue was dominating the transition, but adolescence will still begin with the relationships, habits, strengths, and memories already formed.",
    items,
  };
}

function buildHandoff(state, people, school, mental, memoryIds) {
  const psychology = state.psychology || {};
  return {
    version: VERSION,
    ageMonths: ageMonths(state),
    generatedDate: { ...(state.date || {}) },
    personality: { ...(state.character?.personality || {}) },
    development: { ...(state.character?.development || {}) },
    interests: { ...(state.interests || {}) },
    household: {
      financeBand: state.household?.financeBand || null,
      housing: state.household?.housing || null,
      city: state.household?.city || null,
      country: state.household?.country || null,
      memberIds: introducedPeople(state).filter((person) => !person.deceased && person.family?.household).map((person) => person.id),
    },
    relationships: people.map((person) => ({
      id: person.id,
      role: person.role,
      deceased: person.deceased,
      closeness: person.closeness,
      trust: person.trust,
      conflict: person.conflict,
      arc: person.arc,
      unresolved: person.unresolved,
      currentThread: person.currentThread,
    })),
    school: school ? {
      trajectory: school.trajectory,
      strengths: [...(school.strengths || [])],
      struggles: [...(school.struggles || [])],
      recurringActivities: [...(school.recurringActivities || [])],
      yearsTracked: school.yearsTracked || 0,
      subjectState: { ...(state.education?.subjects || {}) },
    } : null,
    psychology: {
      dimensions: { ...(psychology.dimensions || {}) },
      imprints: [...(psychology.imprints || [])].map((item) => ({ id: item.id, valence: item.valence, belief: item.belief, strength: item.strength })),
      coping: Object.fromEntries(Object.entries(psychology.coping?.patterns || {}).map(([id, item]) => [id, { score: item.score || 0, episodes: item.episodes || 0 }])),
      mentalHealth: psychology.mentalHealth ? {
        conditions: Object.fromEntries(Object.entries(psychology.mentalHealth.conditions || {}).map(([id, item]) => [id, { status: item.status, diagnosedAtMonths: item.diagnosedAtMonths, remissionAtMonths: item.remissionAtMonths, relapseCount: item.relapseCount || 0 }])),
        symptoms: Object.fromEntries(Object.entries(psychology.mentalHealth.symptoms || {}).map(([id, item]) => [id, { intensity: item.intensity || 0, monthsElevated: item.monthsElevated || 0, episodes: item.episodes || 0 }])),
        careHistory: [...(psychology.mentalHealth.care?.history || [])],
      } : null,
    },
    memoryIds: [...memoryIds],
    unresolved: {
      relationshipIds: people.filter((person) => person.unresolved).map((person) => person.id),
      schoolStruggles: [...(school?.struggles || [])],
      activeMentalHealth: [...(mental?.diagnosed || [])].filter((item) => item.status === "active").map((item) => item.label),
      emotionalConcernRecognized: Boolean(mental?.recognition),
    },
  };
}

function summaryCopy(state, people, school, interests, self) {
  const name = firstName(state);
  const pieces = [];
  const selfLead = self.items?.length ? self.copy : self.copy;
  if (selfLead) pieces.push(selfLead);
  if (people[0]) pieces.push(`${people[0].name} remained one of the relationships carrying the most weight.`);
  if (interests.ranked?.[0]) pieces.push(`${INTEREST_LABELS[interests.ranked[0][0]] || interests.ranked[0][0]} had become one of the clearest recurring interests.`);
  if (school?.trajectory) pieces.push(school.trajectory);
  return `By thirteen, ${name}'s childhood had become a history rather than a blank beginning. ${pieces.slice(0, 3).join(" ")}`;
}

export function buildChildhoodSummary(state) {
  if (!state?.character) return null;
  syncPsychologicalDevelopment(state);
  syncPsychologyPhase2(state);
  syncPsychologyPhase3(state);
  ensureRelationshipContinuity(state);
  ensureSchoolCoherence(state);

  const people = importantPeople(state);
  const schoolSectionData = schoolSection(state);
  const school = schoolSectionData.snapshot || null;
  const interests = interestSection(state);
  const self = selfSection(state);
  const coping = copingSection(state);
  const mental = mentalWellbeingSection(state);
  const memories = memorySection(state);
  const unresolved = unresolvedSection(state, people, school, mental);
  const sections = [
    homeSection(state),
    peopleSection(state, people),
    schoolSectionData,
    interests,
    self,
    coping,
    mental,
    memories,
    unresolved,
  ].filter(Boolean).map(({ snapshot, ranked, diagnosed, care, memoryIds, adaptive, defensive, ...section }) => section);

  const handoff = buildHandoff(state, people, school, mental, memories.memoryIds || []);
  return {
    version: VERSION,
    finalized: Boolean(state.completed || ageMonths(state) >= CHILDHOOD_END_MONTHS),
    ageMonths: ageMonths(state),
    title: `${firstName(state)}'s childhood`,
    copy: summaryCopy(state, people, school, interests, self),
    sections,
    handoff,
  };
}

export function ensureChildhoodSummary(state, { force = false } = {}) {
  if (!state?.character) return null;
  if (!force && state.childhoodSummary?.version === VERSION && state.childhoodSummary.finalized) {
    state.adolescenceHandoff ||= state.childhoodSummary.handoff;
    return state.childhoodSummary;
  }
  const summary = buildChildhoodSummary(state);
  if (!summary) return null;
  state.childhoodSummary = summary;
  state.adolescenceHandoff = summary.handoff;
  return summary;
}

export { VERSION as CHILDHOOD_SUMMARY_VERSION, CHILDHOOD_END_MONTHS };
