function visibleLiving(state) {
  const ageMonths = state.character?.ageMonths || 0;
  return (state.people || []).filter((person) => !person.deceased && (person.introducedAtMonths || 0) <= ageMonths);
}

function caregivers(state) {
  const visible = visibleLiving(state);
  const explicit = visible.filter((person) => person.family?.caregiver === true);
  if (explicit.length) return explicit;
  return visible.filter((person) => ["guardian", "secondGuardian"].includes(person.role));
}

function householdCaregivers(state) {
  return caregivers(state).filter((person) => person.family?.household !== false);
}

function inferredParentIds(state) {
  const graph = state.family?.graph;
  if (graph?.biological?.known) {
    return [graph.biological.motherId, graph.biological.fatherId].filter(Boolean);
  }
  return (graph?.caregivers || caregivers(state).map((person) => person.id)).filter(Boolean);
}

function ensureSiblingMetadata(state) {
  const graph = state.family?.graph;
  for (const person of state.people || []) {
    if (person.role !== "sibling") continue;
    person.family ||= {
      branch: "your-generation",
      generation: "child",
      kinship: "biological",
      caregiver: false,
      household: true,
      parentIds: inferredParentIds(state),
    };
    person.family.generation ||= "child";
    person.family.branch ||= "your-generation";
    person.family.kinship ||= "biological";
    person.family.caregiver ??= false;
    person.family.household ??= true;
    person.family.parentIds ||= inferredParentIds(state);
    person.relationshipLabel ||= "Sibling";
    if (!person.sex) {
      const value = [...String(person.id || person.name || "sibling")].reduce((sum, char) => sum + char.charCodeAt(0), 0);
      person.sex = value % 2 ? "Female" : "Male";
    }
    if (graph) {
      graph.siblings ||= [];
      if (!graph.siblings.includes(person.id)) graph.siblings.push(person.id);
    }
  }
}

function syncSeparation(state) {
  const family = state.realism?.family;
  const partnership = family?.partnership;
  if (!family || !partnership) return;

  const adults = caregivers(state).filter((person) => ["guardian", "secondGuardian"].includes(person.role));
  if (adults.length < 2) return;

  if (partnership.status === "separated") {
    if (!family.livingArrangement) {
      const alreadyAway = adults.find((person) => person.family?.household === false);
      const staying = adults.find((person) => person.id === family.primaryCaregiverId && person !== alreadyAway)
        || adults.find((person) => person.family?.household !== false && person !== alreadyAway)
        || adults[0];
      const leaving = alreadyAway || adults.find((person) => person.id !== staying.id) || adults[1];

      leaving.family ||= {};
      leaving.family.household = false;
      leaving.family.caregiver = true;
      staying.family ||= {};
      staying.family.household = true;
      staying.family.caregiver = true;

      family.primaryCaregiverId = staying.id;
      family.livingArrangement = {
        primaryHouseholdId: staying.id,
        otherParentId: leaving.id,
        arrangement: "lives elsewhere with regular contact",
        sinceMonths: state.character.ageMonths,
        active: true,
      };
    } else {
      const staying = (state.people || []).find((person) => person.id === family.livingArrangement.primaryHouseholdId);
      const leaving = (state.people || []).find((person) => person.id === family.livingArrangement.otherParentId);
      if (staying) {
        staying.family ||= {};
        staying.family.household = true;
      }
      if (leaving) {
        leaving.family ||= {};
        leaving.family.household = false;
      }
      if (staying) family.primaryCaregiverId = staying.id;
      family.livingArrangement.active = true;
    }
    return;
  }

  if (partnership.status === "together" && family.livingArrangement?.active) {
    const returning = (state.people || []).find((person) => person.id === family.livingArrangement.otherParentId);
    if (returning) {
      returning.family ||= {};
      returning.family.household = true;
      returning.family.caregiver = true;
    }
    family.livingArrangement = null;
  }
}

function repairPrimaryCaregiver(state) {
  const family = state.realism?.family;
  if (!family) return;
  const current = (state.people || []).find((person) => person.id === family.primaryCaregiverId);
  if (current && !current.deceased && current.family?.household !== false) return;
  const replacement = householdCaregivers(state)[0];
  if (replacement) family.primaryCaregiverId = replacement.id;
}

export function syncHouseholdMembership(state) {
  if (!state?.character || !state?.people) return state;
  ensureSiblingMetadata(state);
  syncSeparation(state);
  repairPrimaryCaregiver(state);
  return state;
}
