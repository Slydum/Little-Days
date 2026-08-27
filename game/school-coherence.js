const clamp = (value, min = 0, max = 100) => Math.max(min, Math.min(max, value));

const SUBJECTS = ["mathematics", "language", "science", "art", "physicalEducation"];
const SUBJECT_LABELS = {
  mathematics: "Math",
  language: "Language",
  science: "Science",
  art: "Art",
  physicalEducation: "PE",
};

const ageMonths = (state) => state.character?.ageMonths || 0;
const yearIndexFor = (state) => Math.max(0, Math.floor((ageMonths(state) - 60) / 12));
const firstName = (person) => String(person?.name || "your teacher").split(/\s+/)[0];

function personById(state, id) {
  return (state.people || []).find((person) => person.id === id) || null;
}

function currentClassmateIds(state) {
  return [...(state.childhood?.school?.currentClassmateIds || [])];
}

function currentScores(state) {
  const schoolPerformance = state.childhood?.school?.performance || {};
  const subjects = state.education?.subjects || {};
  return Object.fromEntries(SUBJECTS.map((key) => [key, clamp(Math.round(schoolPerformance[key] ?? subjects[key] ?? 50))]));
}

function activityKey(activity) {
  return activity?.id || activity?.label || "activity";
}

function activityLabel(activity) {
  return activity?.label || activity?.id || "an activity";
}

function schoolGrade(state, index = yearIndexFor(state)) {
  return state.childhood?.school?.grade || (index <= 0 ? "Kindergarten" : `Grade ${Math.min(index, 7)}`);
}

function ensureRoot(state) {
  state.schoolCoherence ||= {
    version: 1,
    activeYearIndex: null,
    years: {},
    queue: [],
    seen: [],
    processedHistoryKeys: [],
    lastGlobalBeatAtMonths: -120,
  };
  const root = state.schoolCoherence;
  root.years ||= {};
  root.queue ||= [];
  root.seen ||= [];
  root.processedHistoryKeys ||= [];
  return root;
}

function historyKey(entry, index) {
  return [entry.ageMonths ?? "?", entry.eventId || "event", entry.choiceId || "choice", entry.personId || "person", index].join(":");
}

function relevantSchoolHistory(entry) {
  const text = `${entry.eventId || ""} ${entry.title || ""} ${entry.continuity || ""}`.toLowerCase();
  return [
    "school", "class", "teacher", "friend", "group", "presentation", "math", "science", "language",
    "art", "bully", "rival", "field trip", "activity", "club", "crush", "homework", "test",
  ].some((term) => text.includes(term));
}

function ensureYear(state, index = yearIndexFor(state)) {
  const root = ensureRoot(state);
  const school = state.childhood?.school;
  if (!school || ageMonths(state) < 60) return null;
  const key = String(index);
  if (!root.years[key]) {
    const previous = root.years[String(index - 1)] || null;
    const classmates = currentClassmateIds(state);
    const previousClass = new Set(previous?.classmateIdsEnd || previous?.classmateIdsStart || []);
    root.years[key] = {
      yearIndex: index,
      grade: schoolGrade(state, index),
      startedAtMonths: ageMonths(state),
      teacherId: school.currentTeacherId || null,
      teacherName: personById(state, school.currentTeacherId)?.name || null,
      classmateIdsStart: classmates,
      classmateIdsEnd: classmates,
      returningClassmateIds: classmates.filter((id) => previousClass.has(id)),
      subjectStart: currentScores(state),
      subjectEnd: currentScores(state),
      overallStart: school.overallPerformance ?? 55,
      overallEnd: school.overallPerformance ?? 55,
      effortStart: school.effort ?? 52,
      effortEnd: school.effort ?? 52,
      attendanceStart: school.attendance ?? 96,
      attendanceEnd: school.attendance ?? 96,
      activities: [...(school.activities || [])].map((activity) => ({ id: activityKey(activity), label: activityLabel(activity), subject: activity.subject || null })),
      majorMoments: [],
      finalized: false,
      recap: null,
    };
  }
  return root.years[key];
}

function refreshCurrentYear(state) {
  if (ageMonths(state) < 60 || !state.childhood?.school) return null;
  const root = ensureRoot(state);
  const index = yearIndexFor(state);
  const year = ensureYear(state, index);
  const school = state.childhood.school;
  root.activeYearIndex = index;
  year.grade = school.grade || year.grade;
  year.teacherId = school.currentTeacherId || year.teacherId;
  year.teacherName = personById(state, year.teacherId)?.name || year.teacherName;
  year.classmateIdsEnd = currentClassmateIds(state);
  year.subjectEnd = currentScores(state);
  year.overallEnd = school.overallPerformance ?? year.overallEnd;
  year.effortEnd = school.effort ?? year.effortEnd;
  year.attendanceEnd = school.attendance ?? year.attendanceEnd;
  year.activities = [...(school.activities || [])].map((activity) => ({ id: activityKey(activity), label: activityLabel(activity), subject: activity.subject || null }));

  for (const recap of school.recaps || []) {
    const prior = root.years[String(recap.yearIndex)];
    if (!prior) continue;
    prior.finalized = true;
    prior.recap = recap.text || prior.recap;
    prior.finishedAtMonths = recap.ageMonths ?? prior.finishedAtMonths;
  }
  return year;
}

function digestHistory(state) {
  const root = ensureRoot(state);
  const processed = new Set(root.processedHistoryKeys);
  const history = state.history || [];
  history.forEach((entry, index) => {
    const key = historyKey(entry, index);
    if (processed.has(key)) return;
    processed.add(key);
    if (!relevantSchoolHistory(entry)) return;
    const entryYear = Math.max(0, Math.floor(((entry.ageMonths ?? ageMonths(state)) - 60) / 12));
    const year = root.years[String(entryYear)];
    if (!year) return;
    const summary = entry.result || entry.title || entry.choice;
    if (!summary) return;
    year.majorMoments.push({
      ageMonths: entry.ageMonths ?? ageMonths(state),
      eventId: entry.eventId || null,
      title: entry.title || null,
      summary,
      personId: entry.personId || null,
    });
    year.majorMoments = year.majorMoments.slice(-12);
  });
  root.processedHistoryKeys = [...processed].slice(-320);
}

function subjectYears(root, key) {
  return Object.values(root.years)
    .sort((a, b) => a.yearIndex - b.yearIndex)
    .map((year) => ({ yearIndex: year.yearIndex, score: year.subjectEnd?.[key] ?? year.subjectStart?.[key] ?? 50 }));
}

function repeatedStrengths(root) {
  return SUBJECTS.filter((key) => {
    const scores = subjectYears(root, key).slice(-3).map((item) => item.score);
    return scores.length >= 2 && scores.slice(-2).every((score) => score >= 68);
  });
}

function repeatedStruggles(root) {
  return SUBJECTS.filter((key) => {
    const scores = subjectYears(root, key).slice(-3).map((item) => item.score);
    return scores.length >= 2 && scores.slice(-2).every((score) => score <= 55);
  });
}

function recurringActivities(root) {
  const counts = new Map();
  const labels = new Map();
  for (const year of Object.values(root.years)) {
    const seenThisYear = new Set();
    for (const activity of year.activities || []) {
      if (seenThisYear.has(activity.id)) continue;
      seenThisYear.add(activity.id);
      counts.set(activity.id, (counts.get(activity.id) || 0) + 1);
      labels.set(activity.id, activity.label);
    }
  }
  return [...counts.entries()].filter(([, count]) => count >= 2).map(([id, count]) => ({ id, count, label: labels.get(id) || id }));
}

function trajectoryFor(root) {
  const years = Object.values(root.years).sort((a, b) => a.yearIndex - b.yearIndex);
  if (!years.length) return "School is still becoming part of your life.";
  const current = years[years.length - 1];
  const previous = years.length > 1 ? years[years.length - 2] : null;
  if (!previous) return `${current.grade} is establishing your first real school patterns.`;
  const delta = (current.overallEnd ?? 55) - (previous.overallEnd ?? 55);
  if (delta >= 8) return `School has been getting noticeably easier since ${previous.grade}.`;
  if (delta <= -8) return `School has felt harder than it did during ${previous.grade}.`;
  if ((current.overallEnd ?? 55) >= 72 && (previous.overallEnd ?? 55) >= 68) return "Your academic progress has been consistently strong across school years.";
  if ((current.overallEnd ?? 55) <= 52 && (previous.overallEnd ?? 55) <= 55) return "Schoolwork has been a recurring source of difficulty rather than one bad term.";
  return "Your school progress has been fairly steady from one year to the next.";
}

function continuityNote(state, year) {
  const count = year?.returningClassmateIds?.length || 0;
  if (count >= 4) return `Several familiar classmates carried into ${year.grade}, so the room did not feel entirely new.`;
  if (count >= 2) return `A couple of familiar classmates carried into ${year.grade}.`;
  if (count === 1) return `Only one familiar classmate carried into ${year.grade}; most of the room was new.`;
  if ((year?.yearIndex || 0) > 0) return `${year.grade} brought a mostly new classroom around you.`;
  return "These are the first classmates becoming familiar through school.";
}

function queueCandidate(state, candidate) {
  const root = ensureRoot(state);
  if (!candidate?.key || root.seen.includes(candidate.key) || root.queue.some((item) => item.key === candidate.key)) return;
  root.queue.push(candidate);
  root.queue.sort((a, b) => (b.priority || 0) - (a.priority || 0));
  root.queue = root.queue.slice(0, 6);
}

function maybeQueueCoherenceEvent(state) {
  const root = ensureRoot(state);
  const current = refreshCurrentYear(state);
  if (!current || current.yearIndex < 1 || root.queue.length) return;
  const now = ageMonths(state);
  if (now - (root.lastGlobalBeatAtMonths ?? -120) < 6) return;
  const monthsIntoYear = Math.max(0, (now - 60) % 12);
  const previous = root.years[String(current.yearIndex - 1)] || null;
  const strengths = repeatedStrengths(root);
  const struggles = repeatedStruggles(root);
  const activities = recurringActivities(root);
  const candidates = [];

  if (monthsIntoYear >= 1 && monthsIntoYear <= 4 && previous) {
    if ((previous.overallEnd ?? 55) <= 52) candidates.push({ key: `school-coherence:reset:${current.yearIndex}`, type: "after_difficult_year", priority: 49, yearIndex: current.yearIndex, previousYearIndex: previous.yearIndex });
    if ((previous.overallEnd ?? 55) >= 76) candidates.push({ key: `school-coherence:expectations:${current.yearIndex}`, type: "after_strong_year", priority: 46, yearIndex: current.yearIndex, previousYearIndex: previous.yearIndex });
  }

  if (monthsIntoYear >= 4) {
    if (struggles.length) {
      const subject = [...struggles].sort((a, b) => (current.subjectEnd?.[a] ?? 50) - (current.subjectEnd?.[b] ?? 50))[0];
      candidates.push({ key: `school-coherence:struggle:${current.yearIndex}:${subject}`, type: "persistent_struggle", subject, priority: 51, yearIndex: current.yearIndex });
    }
    if (strengths.length) {
      const subject = [...strengths].sort((a, b) => (current.subjectEnd?.[b] ?? 50) - (current.subjectEnd?.[a] ?? 50))[0];
      candidates.push({ key: `school-coherence:strength:${current.yearIndex}:${subject}`, type: "persistent_strength", subject, priority: 43, yearIndex: current.yearIndex });
    }
    if (activities.length && now >= 96) {
      const activity = activities.sort((a, b) => b.count - a.count)[0];
      candidates.push({ key: `school-coherence:activity:${current.yearIndex}:${activity.id}`, type: "activity_identity", activityId: activity.id, activityLabel: activity.label, priority: 41, yearIndex: current.yearIndex });
    }
  }

  if (!candidates.length) return;
  candidates.sort((a, b) => b.priority - a.priority);
  queueCandidate(state, candidates[0]);
}

function teacherEffect(state, key, delta, note) {
  const teacherId = state.childhood?.school?.currentTeacherId;
  return teacherId ? { type: "relationship", targetId: teacherId, key, delta, note } : null;
}

function compact(items) {
  return items.filter(Boolean);
}

function buildEvent(state, item) {
  if (!item) return null;
  const current = ensureYear(state, item.yearIndex ?? yearIndexFor(state));
  const previous = item.previousYearIndex != null ? ensureRoot(state).years[String(item.previousYearIndex)] : null;
  const teacher = personById(state, state.childhood?.school?.currentTeacherId);
  const teacherName = firstName(teacher);

  if (item.type === "persistent_struggle") {
    const label = SUBJECT_LABELS[item.subject] || item.subject;
    return {
      id: `school_coherence_struggle_${item.subject}_${current.yearIndex}`,
      category: "School",
      title: `${label} is still taking work`,
      body: `This is not just one difficult assignment anymore. ${label} has been one of the harder parts of school across more than one year.`,
      prompt: "What do you do with a difficulty that keeps returning?",
      choices: [
        { id: "ask", label: `Ask ${teacherName} for more help`, result: "The problem becomes something you can work on with another person instead of something you privately endure.", effects: compact([{ type: "education", key: item.subject, delta: 3 }, { type: "development", key: "confidence", delta: 1 }, teacherEffect(state, "trust", 3, `You asked ${teacherName} for help with a subject that had been difficult for a while.`)]) },
        { id: "practice", label: "Practice it more deliberately", result: "Progress is slow enough to be annoying, but repetition begins making parts of it less mysterious.", effects: [{ type: "education", key: item.subject, delta: 3 }, { type: "development", key: "persistence", delta: 2 }, { type: "health", key: "stress", delta: 1 }] },
        { id: "avoid", label: "Do only what you have to", result: "Avoiding it reduces the immediate frustration, but the subject remains difficult when it returns.", effects: [{ type: "education", key: item.subject, delta: -1 }, { type: "development", key: "confidence", delta: -1 }, { type: "health", key: "stress", delta: -1 }] },
      ],
    };
  }

  if (item.type === "persistent_strength") {
    const label = SUBJECT_LABELS[item.subject] || item.subject;
    return {
      id: `school_coherence_strength_${item.subject}_${current.yearIndex}`,
      category: "School",
      title: `${label} has become one of your strengths`,
      body: `Across more than one school year, ${label} keeps being one of the places where things click more easily for you.`,
      prompt: "What do you do with something you are becoming good at?",
      choices: [
        { id: "lean", label: "Lean into it", result: "You start treating the subject as something worth developing, not merely something you happen to score well in.", effects: [{ type: "education", key: item.subject, delta: 3 }, { type: "development", key: "persistence", delta: 1 }, { type: "development", key: "confidence", delta: 1 }] },
        { id: "help", label: "Help classmates when you can", result: "Knowing something feels different when you have to explain it clearly to someone else.", effects: [{ type: "education", key: item.subject, delta: 2 }, { type: "development", key: "socialComfort", delta: 1 }, { type: "development", key: "confidence", delta: 1 }] },
        { id: "balanced", label: "Enjoy it without making it your whole identity", result: "You let the strength stay useful without turning every good result into a new expectation.", effects: [{ type: "education", key: item.subject, delta: 1 }, { type: "development", key: "emotionalRegulation", delta: 1 }] },
      ],
    };
  }

  if (item.type === "after_difficult_year") {
    return {
      id: `school_coherence_reset_${current.yearIndex}`,
      category: "School",
      title: `${current.grade} starts after a difficult year`,
      body: `${previous?.grade || "Last year"} was hard academically. A new teacher and a new school year do not erase that, but they do give the pattern somewhere to change.`,
      prompt: "How do you approach the new year?",
      choices: [
        { id: "reset", label: "Treat it like a fresh start", result: "You try not to let last year's results decide in advance what this year will become.", effects: [{ type: "development", key: "confidence", delta: 2 }, { type: "development", key: "persistence", delta: 1 }] },
        { id: "support", label: `Tell ${teacherName} you struggled last year`, result: "The difficulty becomes useful context instead of a secret you have to hide until the next bad result.", effects: compact([{ type: "development", key: "confidence", delta: 1 }, teacherEffect(state, "trust", 3, `You told ${teacherName} that school had been difficult the year before.`)]) },
        { id: "guard", label: "Keep your expectations low", result: "Expecting less protects you from some disappointment, but it also makes trying fully feel riskier.", effects: [{ type: "health", key: "stress", delta: -2 }, { type: "development", key: "confidence", delta: -1 }] },
      ],
    };
  }

  if (item.type === "after_strong_year") {
    return {
      id: `school_coherence_expectations_${current.yearIndex}`,
      category: "School",
      title: `A strong year follows you into ${current.grade}`,
      body: `${previous?.grade || "Last year"} went well. That confidence comes with you, but so does the strange pressure of wondering whether you are supposed to keep proving it.`,
      prompt: "How do you carry that success forward?",
      choices: [
        { id: "push", label: "Try to do even better", result: "You turn the old success into a new target.", effects: [{ type: "development", key: "persistence", delta: 2 }, { type: "health", key: "stress", delta: 1 }] },
        { id: "steady", label: "Aim to stay steady", result: "You treat consistency as enough instead of demanding that every year become a personal record.", effects: [{ type: "development", key: "emotionalRegulation", delta: 2 }, { type: "health", key: "stress", delta: -1 }] },
        { id: "share", label: "Use what you know to help other people", result: "Being capable becomes something social instead of something you only measure privately.", effects: [{ type: "development", key: "socialComfort", delta: 1 }, { type: "development", key: "confidence", delta: 1 }] },
      ],
    };
  }

  if (item.type === "activity_identity") {
    return {
      id: `school_coherence_activity_${item.activityId}_${current.yearIndex}`,
      category: "School",
      title: `${item.activityLabel} is becoming part of your school life`,
      body: `You have kept returning to ${item.activityLabel} across school years. It no longer feels like a random activity you happened to try.`,
      prompt: "How important do you want it to become?",
      choices: [
        { id: "deepen", label: "Take it more seriously", result: "You start caring about getting better instead of merely showing up.", effects: [{ type: "development", key: "persistence", delta: 2 }, { type: "development", key: "confidence", delta: 1 }] },
        { id: "people", label: "Keep it mostly for the people", result: "The activity becomes one of the places where belonging matters as much as skill.", effects: [{ type: "development", key: "socialComfort", delta: 2 }] },
        { id: "casual", label: "Keep it as something you simply enjoy", result: "You protect the activity from becoming another thing you have to perform perfectly.", effects: [{ type: "development", key: "emotionalRegulation", delta: 1 }, { type: "health", key: "stress", delta: -1 }] },
      ],
    };
  }
  return null;
}

export function ensureSchoolCoherence(state) {
  if (!state?.character || ageMonths(state) < 60 || !state.childhood?.school) return state;
  ensureRoot(state);
  refreshCurrentYear(state);
  digestHistory(state);
  return state;
}

export function syncSchoolCoherence(state) {
  ensureSchoolCoherence(state);
  if (ageMonths(state) < 60 || !state.childhood?.school) return state;
  refreshCurrentYear(state);
  digestHistory(state);
  maybeQueueCoherenceEvent(state);
  return state;
}

export function schoolCoherenceEventForState(state) {
  syncSchoolCoherence(state);
  const item = state.schoolCoherence?.queue?.[0];
  const event = buildEvent(state, item);
  if (!event || !item) return null;
  return {
    ...event,
    contextKind: "school-coherence-v1",
    schoolCoherenceKey: item.key,
    schoolCoherenceType: item.type,
    schoolCoherenceYearIndex: item.yearIndex,
    schoolCoherenceSubject: item.subject || null,
  };
}

export function commitSchoolCoherenceEvent(state, event, choice) {
  const root = ensureRoot(state);
  const key = event?.schoolCoherenceKey;
  if (!key) return state;
  if (!root.seen.includes(key)) root.seen.push(key);
  root.seen = root.seen.slice(-160);
  root.queue = root.queue.filter((item) => item.key !== key);
  root.lastGlobalBeatAtMonths = ageMonths(state);
  const year = root.years[String(event.schoolCoherenceYearIndex ?? yearIndexFor(state))];
  const summary = choice?.result || event.title;
  if (year) {
    year.majorMoments ||= [];
    year.majorMoments.push({ ageMonths: ageMonths(state), eventId: event.id, title: event.title, summary });
    year.majorMoments = year.majorMoments.slice(-12);
  }

  const school = state.childhood?.school;
  if (school) {
    if (event.schoolCoherenceType === "persistent_struggle" && choice?.id === "ask") school.teacherSupport = clamp((school.teacherSupport ?? 58) + 4);
    if (event.schoolCoherenceType === "persistent_struggle" && choice?.id === "practice") school.effort = clamp((school.effort ?? 52) + 3);
    if (event.schoolCoherenceType === "persistent_struggle" && choice?.id === "avoid") school.effort = clamp((school.effort ?? 52) - 2);
    if (event.schoolCoherenceType === "persistent_strength" && choice?.id === "lean") school.effort = clamp((school.effort ?? 52) + 2);
    if (event.schoolCoherenceType === "after_difficult_year" && choice?.id === "support") school.teacherSupport = clamp((school.teacherSupport ?? 58) + 4);
  }

  const memoryWorthy = new Set(["persistent_struggle", "persistent_strength", "after_difficult_year", "activity_identity"]);
  if (memoryWorthy.has(event.schoolCoherenceType)) {
    state.memories ||= [];
    const memoryId = `school-coherence:${key}`;
    if (!state.memories.some((memory) => memory.id === memoryId)) {
      state.memories.push({
        id: memoryId,
        age: Math.floor(ageMonths(state) / 12),
        ageMonths: ageMonths(state),
        date: state.date ? { ...state.date } : null,
        title: event.title,
        copy: summary,
        importance: 2,
        featured: false,
        sourceEventId: event.id,
        sourceChoiceId: choice?.id || null,
        schoolYearIndex: event.schoolCoherenceYearIndex ?? yearIndexFor(state),
      });
      state.memories = state.memories.slice(-180);
    }
  }
  return state;
}

export function schoolCoherenceSnapshot(state) {
  ensureSchoolCoherence(state);
  const root = state.schoolCoherence;
  if (!root || ageMonths(state) < 60) return null;
  const current = root.years[String(root.activeYearIndex ?? yearIndexFor(state))] || null;
  const strengths = repeatedStrengths(root).map((key) => SUBJECT_LABELS[key] || key);
  const struggles = repeatedStruggles(root).map((key) => SUBJECT_LABELS[key] || key);
  const activities = recurringActivities(root);
  const years = Object.values(root.years).sort((a, b) => a.yearIndex - b.yearIndex);
  return {
    trajectory: trajectoryFor(root),
    strengths,
    struggles,
    recurringActivities: activities.map((activity) => activity.label),
    yearsTracked: years.length,
    continuityNote: continuityNote(state, current),
    currentYear: current ? {
      yearIndex: current.yearIndex,
      grade: current.grade,
      teacherName: current.teacherName,
      returningClassmates: current.returningClassmateIds?.length || 0,
      majorMoments: [...(current.majorMoments || [])].slice(-4),
    } : null,
    recentYears: years.slice(-3).map((year) => ({
      yearIndex: year.yearIndex,
      grade: year.grade,
      overall: year.overallEnd,
      teacherName: year.teacherName,
      recap: year.recap,
    })),
  };
}
