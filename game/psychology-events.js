import { ensurePsychologyState } from "./psychology.js?v=1";
import { ensurePsychologyPhase2State, syncPsychologyPhase2 } from "./psychology-phase2.js?v=1";

const clamp = (value, min = 0, max = 100) => Math.max(min, Math.min(max, value));

const REACTION_RULES = [
  { id: "help", pattern: /ask|tell|talk|share|open up|let .* help|listen|check in/i },
  { id: "approach", pattern: /join|walk up|sit with|hang out|friendly|stay near|be curious|one-on-one|meet them halfway/i },
  { id: "soothe", pattern: /slow|breathe|pause|take a moment|give it some space|wait|trust yourself|routine/i },
  { id: "solve", pattern: /try|practice|plan|work through|figure out|ask .*teacher|handle it|what .* expect/i },
  { id: "withdraw", pattern: /pull back|stay away|leave|alone|keep .* private|keep .* yourself|say nothing|avoid|smaller|guarded/i },
  { id: "push", pattern: /snap|argue|refuse|tease|push back|protest|lash|fight/i },
  { id: "perfect", pattern: /perfect|exact|right|correct|recheck|same method/i },
];

function ageMonths(state) {
  return state.character?.ageMonths || 0;
}

function number(value, fallback = 50) {
  return Number.isFinite(value) ? value : fallback;
}

function patterns(state) {
  return state.psychology?.coping?.patterns || {};
}

function patternScore(state, id) {
  return number(patterns(state)[id]?.score, 0);
}

function dimensions(state) {
  return state.psychology?.dimensions || {};
}

function profile(state) {
  const d = dimensions(state);
  return {
    attachment: number(d.attachmentSecurity),
    selfWorth: number(d.selfWorth),
    regulation: number(d.emotionalRegulation),
    trust: number(d.trust),
    threat: number(d.threatSensitivity),
    autonomy: number(d.autonomy),
    socialSafety: number(d.socialSafety),
    shame: number(d.shameSensitivity),
    openness: number(d.emotionalOpenness),
    resilience: number(d.resilience),
    helpSeeking: patternScore(state, "helpSeeking"),
    expression: patternScore(state, "emotionalExpression"),
    selfSoothing: patternScore(state, "selfSoothing"),
    problemSolving: patternScore(state, "problemSolving"),
    socialApproach: patternScore(state, "socialApproach"),
    avoidance: patternScore(state, "avoidance"),
    suppression: patternScore(state, "suppression"),
    withdrawal: patternScore(state, "withdrawal"),
    reassurance: patternScore(state, "reassuranceSeeking"),
    perfectionism: patternScore(state, "perfectionism"),
    aggression: patternScore(state, "aggression"),
    overResponsibility: patternScore(state, "overResponsibility"),
  };
}

function ensureIntegrationState(state) {
  ensurePsychologyState(state);
  ensurePsychologyPhase2State(state);
  state.psychology.eventIntegration ||= {
    version: 1,
    samples: [],
    lastSampleAgeMonths: null,
  };
  state.psychology.eventIntegration.samples ||= [];
  return state.psychology.eventIntegration;
}

function sampleFor(state) {
  const p = profile(state);
  return {
    ageMonths: ageMonths(state),
    attachment: p.attachment,
    selfWorth: p.selfWorth,
    regulation: p.regulation,
    trust: p.trust,
    threat: p.threat,
    socialSafety: p.socialSafety,
    shame: p.shame,
    openness: p.openness,
    resilience: p.resilience,
    withdrawal: p.withdrawal,
    avoidance: p.avoidance,
    suppression: p.suppression,
  };
}

export function syncPsychologyEventIntegration(state) {
  if (!state?.character) return state;
  syncPsychologyPhase2(state);
  const root = ensureIntegrationState(state);
  const now = ageMonths(state);
  if (root.lastSampleAgeMonths == null || now - root.lastSampleAgeMonths >= 3) {
    root.samples.push(sampleFor(state));
    root.samples = root.samples.slice(-20);
    root.lastSampleAgeMonths = now;
  } else if (root.samples.length && root.samples[root.samples.length - 1].ageMonths === now) {
    root.samples[root.samples.length - 1] = sampleFor(state);
  }
  return state;
}

function eventText(event) {
  return `${event?.id || ""} ${event?.category || ""} ${event?.title || ""} ${event?.body || ""} ${event?.prompt || ""}`.toLowerCase();
}

export function psychologicalEventContext(event) {
  const text = eventText(event);
  if (/conflict|argument|tension|bully|rival|rejection|left out|excluded|fight|off with|repair/.test(text)) return "conflict";
  if (/test|presentation|performance|grade|homework|subject|math|science|language|art |schoolwork|mistake|difficult year|strong year/.test(text)) return "performance";
  if (/friend|classmate|group|crush|social|hang out|school day|circle/.test(text)) return "social";
  if (/guardian|mother|father|parent|sibling|grandmother|grandfather|family|home|household|caregiver/.test(text)) return "family";
  if (/new |first |change|different|transition|unknown|uncertain|begin|start|moving/.test(text)) return "uncertainty";
  return "general";
}

function historyTendencies(state) {
  const counts = Object.fromEntries(REACTION_RULES.map((rule) => [rule.id, 0]));
  const recent = (state.history || []).slice(-28);
  for (const entry of recent) {
    const text = `${entry.choice || ""} ${entry.result || ""}`;
    for (const rule of REACTION_RULES) if (rule.pattern.test(text)) counts[rule.id] += 1;
  }
  return counts;
}

function lensFor(context, p, tendencies) {
  if (context === "social") {
    if (p.socialSafety <= 43 || p.withdrawal >= 28 || tendencies.withdraw >= 5) {
      return "Before doing anything, you notice who already seems connected and where you might fit.";
    }
    if (p.socialSafety >= 64 && (p.socialApproach >= 18 || tendencies.approach >= 4)) {
      return "Being around people feels familiar enough that curiosity gets a chance to arrive before self-consciousness.";
    }
    if (p.threat >= 62 || p.reassurance >= 28) {
      return "You find yourself reading small reactions closely before deciding what they mean.";
    }
    return "You are aware that a small social moment can quietly change where you feel you belong.";
  }

  if (context === "performance") {
    if (p.perfectionism >= 28 || p.shame >= 62 || tendencies.perfect >= 4) {
      return "Part of you wants to get it exactly right, because mistakes can feel more exposing than they look from the outside.";
    }
    if (p.selfWorth >= 64 && p.resilience >= 60) {
      return "The outcome matters, but it does not feel like a verdict on who you are.";
    }
    if (p.problemSolving >= 18 || tendencies.solve >= 4) {
      return "Your mind starts looking for the next manageable thing you can actually do.";
    }
    if (p.selfWorth <= 43) {
      return "It is difficult not to let the result feel personal, even when you know it is only one piece of school.";
    }
    return "You care about how this goes, though you are still working out what success and failure mean to you.";
  }

  if (context === "conflict") {
    if (p.regulation <= 43 || p.aggression >= 26 || tendencies.push >= 4) {
      return "The feeling arrives quickly, before you have fully decided what you want to do with it.";
    }
    if (p.regulation >= 62 || p.selfSoothing >= 18 || tendencies.soothe >= 4) {
      return "You can feel the tension without having to answer it immediately.";
    }
    if (p.suppression >= 28 || tendencies.withdraw >= 5) {
      return "Your first instinct is to contain the feeling rather than let anyone see how much it matters.";
    }
    return "Part of the difficulty is deciding whether this needs a response, space, or a conversation.";
  }

  if (context === "family") {
    if (p.attachment >= 65 && p.trust >= 62 && p.openness >= 58) {
      return "Part of you expects there may be room to say what you actually need.";
    }
    if (p.attachment <= 43 || p.threat >= 62) {
      return "You pay attention to the other person's mood before deciding how much of yourself to show.";
    }
    if (p.suppression >= 28 || tendencies.withdraw >= 5) {
      return "Keeping some feelings private has become easier than finding the right moment to explain them.";
    }
    if (p.helpSeeking >= 18 || tendencies.help >= 4) {
      return "You have learned that bringing someone into a problem can sometimes make it more manageable.";
    }
    return "You are still learning how much independence and closeness can exist in the same relationship.";
  }

  if (context === "uncertainty") {
    if (p.resilience >= 64 && p.threat <= 52) return "Not knowing exactly what comes next feels manageable enough to leave room for curiosity.";
    if (p.threat >= 62) return "Uncertainty makes your attention sharpen; you look for clues about what might happen next.";
    if (p.avoidance >= 28 || tendencies.withdraw >= 5) return "A familiar part of you would rather wait until the situation feels more predictable.";
    return "The unfamiliarity is noticeable, but it has not yet decided the moment for you.";
  }

  if (p.resilience >= 66) return "You have a little more confidence that an uncomfortable moment can pass without defining everything that follows.";
  if (p.threat >= 64) return "You notice possible problems quickly, sometimes before you know whether they are really there.";
  if (p.openness >= 64) return "You are increasingly able to notice what you feel without immediately hiding it from yourself.";
  return "Your first reaction is becoming part of a pattern, but it is not the only response available to you.";
}

function pastSample(state, minimumMonthsAgo = 9) {
  const root = state.psychology?.eventIntegration;
  const now = ageMonths(state);
  return [...(root?.samples || [])].reverse().find((sample) => now - sample.ageMonths >= minimumMonthsAgo) || null;
}

function recoveryCopy(state, context, current) {
  const past = pastSample(state);
  if (!past) return null;
  const improved = (key, amount = 7) => current[key] >= number(past[key]) + amount;
  const softened = (key, amount = 7) => current[key] <= number(past[key]) - amount;

  if (context === "social" && (improved("socialSafety", 7) || softened("withdrawal", 7))) {
    return "This kind of moment used to make pulling back feel more automatic. Lately, there is a little more room before that reaction takes over.";
  }
  if (context === "performance" && (improved("selfWorth", 7) || softened("shame", 7))) {
    return "Mistakes used to feel heavier than they do now; the old pressure is still familiar, but it has less authority.";
  }
  if (context === "conflict" && improved("regulation", 7)) {
    return "You still feel tension, but you recover enough space to choose what to do with it more often than you used to.";
  }
  if (context === "family" && (improved("attachment", 7) || improved("trust", 7) || improved("openness", 7))) {
    return "Being known by people close to you has become a little safer than it once felt.";
  }
  if (context === "uncertainty" && (improved("resilience", 7) || softened("threat", 7))) {
    return "Uncertainty still registers, but it no longer takes up quite as much of the room.";
  }
  if (improved("resilience", 9) || softened("threat", 9)) {
    return "Your first reaction is not as fixed as it used to be; newer experiences have started changing what feels possible.";
  }
  return null;
}

function reactionTags(choice) {
  const text = `${choice?.id || ""} ${choice?.label || ""} ${choice?.result || ""}`;
  return REACTION_RULES.filter((rule) => rule.pattern.test(text)).map((rule) => rule.id);
}

function choiceFit(state, choice, context, p, tendencies) {
  const tags = reactionTags(choice);
  let score = 0;
  for (const tag of tags) {
    if (tag === "help") score += p.helpSeeking * 0.18 + p.openness * 0.08 + tendencies.help * 1.4;
    if (tag === "approach") score += p.socialApproach * 0.18 + p.socialSafety * 0.08 + tendencies.approach * 1.4;
    if (tag === "soothe") score += p.selfSoothing * 0.18 + p.regulation * 0.08 + tendencies.soothe * 1.4;
    if (tag === "solve") score += p.problemSolving * 0.18 + p.resilience * 0.07 + tendencies.solve * 1.4;
    if (tag === "withdraw") score += p.withdrawal * 0.18 + p.avoidance * 0.12 + p.suppression * 0.08 + tendencies.withdraw * 1.4;
    if (tag === "push") score += p.aggression * 0.2 + Math.max(0, 52 - p.regulation) * 0.12 + tendencies.push * 1.4;
    if (tag === "perfect") score += p.perfectionism * 0.2 + p.shame * 0.07 + tendencies.perfect * 1.4;
  }
  if (context === "social" && tags.includes("approach")) score += Math.max(0, p.socialSafety - 50) * 0.08;
  if (context === "performance" && tags.includes("solve")) score += Math.max(0, p.resilience - 50) * 0.07;
  if (context === "conflict" && tags.includes("soothe")) score += Math.max(0, p.regulation - 50) * 0.08;
  if (context === "family" && tags.includes("help")) score += Math.max(0, p.trust - 50) * 0.07;
  return score;
}

function orderedChoices(state, event, context, p, tendencies) {
  const original = event.choices || [];
  return original
    .map((choice, index) => ({ choice, index, fit: choiceFit(state, choice, context, p, tendencies) }))
    .sort((a, b) => b.fit - a.fit || a.index - b.index)
    .map(({ choice, fit }) => ({ ...choice, psychologyFit: Math.round(fit * 10) / 10 }));
}

export function decorateEventWithPsychology(state, event) {
  if (!state?.character || !event) return event;
  syncPsychologyEventIntegration(state);
  if (ageMonths(state) < 60) return event;
  const p = profile(state);
  const context = psychologicalEventContext(event);
  const tendencies = historyTendencies(state);
  const lens = lensFor(context, p, tendencies);
  const recovery = recoveryCopy(state, context, p);
  const body = [event.body, lens, recovery].filter(Boolean).join(" ");
  return {
    ...event,
    body,
    choices: orderedChoices(state, event, context, p, tendencies),
    psychologyContext: context,
    psychologyLens: lens,
    psychologyRecovery: recovery,
  };
}

export function psychologyEventSnapshot(state) {
  syncPsychologyEventIntegration(state);
  const p = profile(state);
  const tendencies = historyTendencies(state);
  return {
    profile: { ...p },
    repeatedReactions: { ...tendencies },
    samples: [...(state.psychology?.eventIntegration?.samples || [])],
  };
}
