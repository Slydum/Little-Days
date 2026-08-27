import { getAgeLabel, getAgeYears, getVisiblePeople } from "./engine.js";

function role(person) {
  return person.relationshipLabel || ({
    guardian: "Parent / Guardian",
    secondGuardian: "Parent / Guardian",
    parent: "Biological parent",
    grandmother: "Grandmother",
    grandfather: "Grandfather",
    sibling: "Sibling",
    aunt: "Aunt",
    uncle: "Uncle",
    cousin: "Cousin",
  })[person.role] || "Relative";
}

function initial(person) {
  const parts = String(person?.name || "?").trim().split(/\s+/);
  const honorifics = new Set(["Lola", "Lolo", "Auntie", "Uncle", "Tita", "Tito"]);
  const useful = parts.find((part) => !honorifics.has(part)) || parts[0] || "?";
  return useful[0]?.toUpperCase() || "?";
}

function byId(state, id) {
  return (state.people || []).find((person) => person.id === id) || null;
}

function currentAgeText(state, person) {
  if (person.deceased) return person.diedAtAge != null ? `Died at age ${person.diedAtAge}` : "Deceased";
  return `Age ${person.age + getAgeYears(state)}`;
}

function parentNote(state, person) {
  if (person.role !== "cousin") return "";
  const parent = (person.family?.parentIds || []).map((id) => byId(state, id)).find(Boolean);
  return parent ? `Child of ${parent.name}` : "";
}

function node(state, person, extraClass = "") {
  if (!person) return "";
  const note = parentNote(state, person);
  return `<button class="tree-person ${extraClass} ${person.deceased ? "deceased" : ""}" data-person-id="${person.id}">
    <span class="tree-avatar">${initial(person)}</span>
    <span class="tree-name">${person.name}</span>
    <span class="tree-role">${role(person)}</span>
    <span class="tree-age">${currentAgeText(state, person)}</span>
    ${note ? `<span class="tree-link-note">${note}</span>` : ""}
  </button>`;
}

function miniNode(state, person) {
  if (!person) return "";
  return `<button class="tree-mini ${person.deceased ? "deceased" : ""}" data-person-id="${person.id}">
    <span class="tree-mini-name">${person.name}</span>
    <span>${role(person)} · ${currentAgeText(state, person)}</span>
  </button>`;
}

function playerNode(state) {
  return `<div class="tree-person tree-you" aria-label="You">
    <span class="tree-avatar">${state.character.firstName[0]}</span>
    <span class="tree-name">${state.character.firstName} ${state.character.lastName}</span>
    <span class="tree-role">You</span>
    <span class="tree-age">${getAgeLabel(state)}</span>
  </div>`;
}

function branchCard(state, branch) {
  const parent = byId(state, branch.parentId);
  const grandparents = (branch.grandparentIds || []).map((id) => byId(state, id)).filter(Boolean);
  return `<section class="tree-branch">
    <p class="tree-branch-label">${branch.label}</p>
    ${grandparents.length ? `<div class="tree-mini-row">${grandparents.map((person) => miniNode(state, person)).join("")}</div><div class="tree-branch-stem"></div>` : `<div class="tree-unknown-small">Grandparents not known</div>`}
    ${parent ? node(state, parent, "tree-parent-node") : `<div class="tree-unknown-small">Parent not known</div>`}
  </section>`;
}

function branchExtended(state, branch) {
  const relatives = (branch.relativeIds || []).map((id) => byId(state, id)).filter(Boolean);
  const cousins = (branch.cousinIds || []).map((id) => byId(state, id)).filter(Boolean);
  if (!relatives.length && !cousins.length) return "";
  return `<section class="tree-extended-group">
    <p class="tree-label">${branch.label}</p>
    ${relatives.length ? `<div class="tree-row">${relatives.map((person) => node(state, person)).join("")}</div>` : ""}
    ${cousins.length ? `<div class="tree-row tree-cousins">${cousins.map((person) => node(state, person)).join("")}</div>` : ""}
  </section>`;
}

function graphTree(state, graph) {
  const branches = (graph.branches || []).filter((branch) => branch && (branch.parentId || (branch.grandparentIds || []).length));
  const siblingPeople = (graph.siblings || []).map((id) => byId(state, id)).filter(Boolean);
  const caregiverPeople = (graph.caregivers || []).map((id) => byId(state, id)).filter(Boolean);
  const biologicalParentIds = [graph.biological?.motherId, graph.biological?.fatherId].filter(Boolean);
  const branchIds = new Set();
  branches.forEach((branch) => {
    if (branch.parentId) branchIds.add(branch.parentId);
    (branch.grandparentIds || []).forEach((id) => branchIds.add(id));
    (branch.relativeIds || []).forEach((id) => branchIds.add(id));
    (branch.cousinIds || []).forEach((id) => branchIds.add(id));
  });
  const nonBiologicalCare = caregiverPeople.filter((person) => !biologicalParentIds.includes(person.id));
  const showCaregivers = graph.caregiverType && !["biological", "adoptive"].includes(graph.caregiverType) && caregiverPeople.length;
  const extended = branches.map((branch) => branchExtended(state, branch)).filter(Boolean).join("");

  return `
    ${graph.biological?.known === false ? `<div class="tree-placeholder"><strong>Biological family</strong><span>${graph.biological.note || "Not known at the start of your life."}</span></div>` : ""}
    ${branches.length ? `<div class="tree-branches ${branches.length === 1 ? "single" : ""}">${branches.map((branch) => branchCard(state, branch)).join("")}</div><div class="tree-converge" aria-hidden="true"></div>` : ""}
    <section class="tree-generation tree-you-generation">
      <p class="tree-label">You & siblings</p>
      <div class="tree-row">${playerNode(state)}${siblingPeople.map((person) => node(state, person)).join("")}</div>
    </section>
    ${showCaregivers ? `<section class="tree-caregivers"><h2>People raising you</h2><p>${graph.caregiverType === "grandparent" ? "Your grandparents are also your day-to-day caregivers." : graph.caregiverType === "kinship" ? "Relatives outside the parent generation are raising you." : graph.caregiverType === "step" ? "Your household includes a step-parent alongside a biological parent." : graph.caregiverType === "foster" ? "Your foster parents are the adults caring for you at home." : "These are the adults caring for you at home."}</p><div class="tree-row">${caregiverPeople.map((person) => node(state, person)).join("")}</div></section>` : ""}
    ${!showCaregivers && graph.caregiverType === "adoptive" && nonBiologicalCare.length ? `<p class="tree-note">Your adoptive parents are shown in the family branches above because they are your parents in this family tree.</p>` : ""}
    ${extended ? `<section class="tree-extended"><h2 class="tree-extended-title">Extended family</h2>${extended}</section>` : `<p class="tree-note">No extended relatives are known to you yet.</p>`}
  `;
}

function legacyTree(state) {
  const visible = getVisiblePeople(state).filter((person) => person.role !== "friend");
  const caregivers = visible.filter((person) => ["guardian", "secondGuardian"].includes(person.role));
  const siblings = visible.filter((person) => person.role === "sibling");
  const grandparents = visible.filter((person) => ["grandmother", "grandfather"].includes(person.role));
  const auntsUncles = visible.filter((person) => ["aunt", "uncle"].includes(person.role));
  const cousins = visible.filter((person) => person.role === "cousin");
  const caregiverLabels = caregivers.map((person) => role(person).toLowerCase());
  const caregiversAreParents = caregivers.length > 0 && caregiverLabels.every((label) => label === "mother" || label === "father" || label.includes("stepmother") || label.includes("stepfather"));

  return `
    <div class="legacy-warning">This life was created before family branches were recorded, so the game will not invent connections it does not actually know.</div>
    ${grandparents.length ? `<section class="tree-generation"><p class="tree-label">Known grandparents · branch not recorded</p><div class="tree-row">${grandparents.map((person) => node(state, person)).join("")}</div></section>` : ""}
    ${caregivers.length ? `<section class="tree-generation"><p class="tree-label">${caregiversAreParents ? "Parents at home" : "People raising you"}</p><div class="tree-row">${caregivers.map((person) => node(state, person)).join("")}</div></section>` : ""}
    <section class="tree-generation"><p class="tree-label">You & siblings</p><div class="tree-row">${playerNode(state)}${siblings.map((person) => node(state, person)).join("")}</div></section>
    ${auntsUncles.length || cousins.length ? `<section class="tree-extended"><h2 class="tree-extended-title">Known extended family</h2>${auntsUncles.length ? `<div class="tree-extended-group"><p class="tree-label">Aunts & uncles · branch not recorded</p><div class="tree-row">${auntsUncles.map((person) => node(state, person)).join("")}</div></div>` : ""}${cousins.length ? `<div class="tree-extended-group"><p class="tree-label">Cousins · parent not recorded</p><div class="tree-row">${cousins.map((person) => node(state, person)).join("")}</div></div>` : ""}</section>` : ""}
  `;
}

export function familyTreeContent(state) {
  const origin = state.family?.originStory || "Your family story is still becoming known to you.";
  const graph = state.family?.graph;
  const styles = `<style>
    .tree-intro{margin:0 auto 18px;max-width:370px;text-align:center;color:var(--muted);font-family:var(--serif);font-size:13px;line-height:1.5;font-style:italic}
    .family-tree{padding:2px 0 8px}.tree-label{margin:0 0 10px;color:var(--muted);font-size:9px;font-weight:800;letter-spacing:.09em;text-transform:uppercase}
    .tree-row{display:flex;justify-content:center;align-items:stretch;gap:8px;flex-wrap:wrap;position:relative}.tree-person{-webkit-appearance:none;appearance:none;width:min(142px,45%);min-height:104px;margin:0;border:1px solid var(--line);border-radius:8px;background:rgba(255,255,255,.28);color:var(--ink);padding:10px 8px;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;font:inherit;cursor:pointer}.tree-person:active,.tree-mini:active{background:rgba(113,129,105,.08)}.tree-person:focus-visible,.tree-mini:focus-visible{outline:1px solid var(--sage);outline-offset:2px}.tree-person.deceased,.tree-mini.deceased{opacity:.62;border-style:dashed}.tree-person.tree-you{border-color:var(--sage);background:var(--sage-soft);cursor:default}.tree-avatar{width:34px;height:34px;margin-bottom:7px;border:1px solid var(--line-strong);border-radius:999px;background:var(--paper-strong);display:grid;place-items:center;font-family:var(--serif);font-size:16px}.tree-name{font-family:var(--serif);font-size:14px;line-height:1.15}.tree-role{margin-top:4px;color:#4b4d46;font-size:9px;font-weight:700;line-height:1.25}.tree-age{margin-top:3px;color:var(--muted);font-size:9px}.tree-link-note{margin-top:4px;color:var(--sage);font-size:8px;line-height:1.25}
    .tree-placeholder{max-width:330px;margin:0 auto 18px;border:1px dashed var(--line-strong);border-radius:7px;padding:10px 12px;text-align:center;background:rgba(255,255,255,.16)}.tree-placeholder strong{display:block;font-family:var(--serif);font-size:14px;font-weight:500}.tree-placeholder span{display:block;margin-top:3px;color:var(--muted);font-size:9px;line-height:1.4}
    .tree-branches{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;align-items:stretch}.tree-branches.single{grid-template-columns:minmax(0,1fr);max-width:220px;margin:0 auto}.tree-branch{position:relative;border:1px solid var(--line);border-radius:10px;padding:10px 8px 12px;background:rgba(255,255,255,.16);text-align:center}.tree-branch-label{margin:0 0 9px;font-size:9px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:var(--muted)}.tree-mini-row{display:grid;grid-template-columns:1fr 1fr;gap:5px}.tree-mini{-webkit-appearance:none;appearance:none;min-width:0;border:1px solid var(--line);border-radius:7px;background:var(--paper-strong);color:var(--ink);padding:7px 5px;font:inherit;text-align:center;cursor:pointer}.tree-mini-name{display:block;font-family:var(--serif);font-size:11px;line-height:1.1}.tree-mini span:last-child{display:block;margin-top:3px;color:var(--muted);font-size:7px;line-height:1.25}.tree-branch-stem{width:1px;height:14px;margin:0 auto;background:var(--line-strong)}.tree-branch .tree-parent-node{width:100%;min-height:92px}.tree-unknown-small{border:1px dashed var(--line);border-radius:7px;padding:9px 5px;color:var(--muted);font-size:8px}
    .tree-converge{position:relative;height:32px;margin:0 18%}.tree-converge::before{content:"";position:absolute;left:0;right:0;top:10px;height:1px;background:var(--line-strong)}.tree-converge::after{content:"";position:absolute;left:50%;top:10px;width:1px;height:22px;background:var(--line-strong)}.tree-branches.single+.tree-converge::before{display:none}.tree-generation{position:relative;padding:8px 0 18px;text-align:center}.tree-you-generation{padding-top:5px}.tree-caregivers{margin-top:9px;padding-top:17px;border-top:1px solid var(--line)}.tree-caregivers h2,.tree-extended-title{margin:0 0 5px;font-family:var(--serif);font-size:16px;font-weight:500}.tree-caregivers p{margin:0 0 10px;color:var(--muted);font-size:10px;line-height:1.45}.tree-extended{margin-top:14px;padding-top:18px;border-top:1px solid var(--line)}.tree-extended-title{margin-bottom:14px}.tree-extended-group+.tree-extended-group{margin-top:20px}.tree-cousins{margin-top:8px}.tree-note{margin:14px 0 0;text-align:center;color:var(--muted);font-size:10px;line-height:1.45}.legacy-warning{margin:0 0 16px;border-left:2px solid var(--line-strong);padding:4px 0 4px 10px;color:var(--muted);font-size:9px;line-height:1.45}
    @media(max-width:380px){.tree-branches{gap:7px}.tree-branch{padding-left:6px;padding-right:6px}.tree-mini-row{grid-template-columns:1fr}.tree-mini span:last-child{font-size:7px}.tree-person{width:47%}}
  </style>`;

  return `${styles}<p class="tree-intro">${origin}</p><div class="family-tree">${graph?.version === 1 ? graphTree(state, graph) : legacyTree(state)}</div><p class="tree-note">Tap a relative to open their profile. New lives now record exact family branches, parent-child links, caregiver roles, and cousin parentage instead of guessing from ages.</p>`;
}
