import assert from "node:assert/strict";
import { syncHouseholdMembership } from "../game/household-membership.js";

function person(id, role, household = true) {
  return {
    id,
    role,
    name: id,
    age: 30,
    introducedAtMonths: 0,
    family: { caregiver: ["guardian", "secondGuardian"].includes(role), household },
  };
}

{
  const state = {
    character: { ageMonths: 84 },
    people: [person("parent-a", "guardian"), person("parent-b", "secondGuardian")],
    family: { graph: { biological: { known: true, motherId: "parent-a", fatherId: "parent-b" }, caregivers: ["parent-a", "parent-b"], siblings: [] } },
    realism: { family: { partnership: { status: "separated" }, primaryCaregiverId: "parent-a" } },
  };
  syncHouseholdMembership(state);
  assert.equal(state.people[0].family.household, true);
  assert.equal(state.people[1].family.household, false);
  assert.equal(state.realism.family.livingArrangement.otherParentId, "parent-b");

  state.realism.family.partnership.status = "together";
  syncHouseholdMembership(state);
  assert.equal(state.people[1].family.household, true);
  assert.equal(state.realism.family.livingArrangement, null);
}

{
  const state = {
    character: { ageMonths: 60 },
    people: [person("parent-a", "guardian"), person("parent-b", "secondGuardian"), { id: "new-baby", role: "sibling", name: "Mika Reyes", age: -5, introducedAtMonths: 60 }],
    family: { graph: { biological: { known: true, motherId: "parent-a", fatherId: "parent-b" }, caregivers: ["parent-a", "parent-b"], siblings: [] } },
    realism: { family: { partnership: { status: "together" }, primaryCaregiverId: "parent-a" } },
  };
  syncHouseholdMembership(state);
  const baby = state.people[2];
  assert.equal(baby.family.household, true);
  assert.deepEqual(baby.family.parentIds, ["parent-a", "parent-b"]);
  assert.ok(state.family.graph.siblings.includes("new-baby"));
  assert.ok(["Female", "Male"].includes(baby.sex));
}

console.log("household membership smoke test passed");
