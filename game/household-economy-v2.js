import * as core from "./household-economy.js?v=1";

export * from "./household-economy.js?v=1";

const CITY_FACTOR = {
  "Quezon City": 1.18,
  Imus: 0.94,
  "Iloilo City": 0.9,
  "Cebu City": 1.05,
  "Davao City": 0.94,
};

function housingCost(state, tenure) {
  const h = state.household || {};
  const factor = CITY_FACTOR[h.city] || 1;
  if (tenure === "Owned") return Math.round(1800 * factor);
  if (tenure === "Staying with relatives") return Math.round(3500 * factor);
  const label = String(h.housing || "").toLowerCase();
  let base = 14500;
  if (label.includes("one-bedroom")) base = 10500;
  else if (label.includes("compact")) base = 12500;
  else if (label.includes("two-bedroom apartment")) base = 15500;
  else if (label.includes("townhouse")) base = 18500;
  else if (label.includes("family house") || label.includes("two-bedroom house")) base = 20500;
  return Math.round(base * factor * (tenure === "Paying a mortgage" ? 1.06 : 1));
}

function bedrooms(label) {
  const text = String(label || "").toLowerCase();
  if (text.includes("one-bedroom")) return 1;
  if (text.includes("two-bedroom")) return 2;
  if (text.includes("townhouse") || text.includes("family house")) return 2;
  return 1;
}

function repairExternalMove(state, previousHousing, previousTenure, movedHousing) {
  const h = state.household;
  if (!h || !previousHousing || previousHousing === movedHousing || h.housing !== movedHousing) return;

  const ageMonths = state.character?.ageMonths || 0;
  const latest = h.moveHistory?.[h.moveHistory.length - 1];
  if (latest?.ageMonths === ageMonths && latest.housing === movedHousing) {
    h.lastEconomyHousing = movedHousing;
    return;
  }

  const separated = state.realism?.family?.partnership?.status === "separated";
  const pressured = h.financeBand === "Tight" || separated;
  if (pressured) h.tenure = "Renting";
  else if (previousTenure === "Owned" || previousTenure === "Paying a mortgage") h.tenure = "Paying a mortgage";
  else h.tenure = previousTenure === "Staying with relatives" ? "Renting" : (previousTenure || "Renting");

  h.bedrooms = bedrooms(movedHousing);
  h.monthlyHousingCost = housingCost(state, h.tenure);
  if (["Owned", "Paying a mortgage"].includes(h.tenure)) {
    h.homeValue = Math.round(housingCost(state, "Paying a mortgage") * 150);
    h.mortgageBalance = h.tenure === "Paying a mortgage" ? Math.round(h.homeValue * 0.72) : 0;
  } else {
    h.homeValue = 0;
    h.mortgageBalance = 0;
  }

  h.moveHistory ||= [];
  h.moveHistory.push({
    ageMonths,
    housing: movedHousing,
    city: h.city,
    tenure: h.tenure,
    reason: separated ? "parents separated" : pressured ? "financial pressure" : "family needed a different home",
  });
  h.moveHistory = h.moveHistory.slice(-12);
  h.lastEconomyHousing = movedHousing;
}

export function ensureHouseholdEconomy(state) {
  return core.ensureHouseholdEconomy(state);
}

export function advanceHouseholdEconomy(state, elapsedMonths = 0, beforeAgeMonths = null) {
  const previousHousing = state?.household?.lastEconomyHousing || state?.household?.housing || null;
  const previousTenure = state?.household?.tenure || null;
  const movedHousing = state?.household?.housing || null;
  const externalMove = Boolean(previousHousing && movedHousing && previousHousing !== movedHousing);

  const next = core.advanceHouseholdEconomy(state, elapsedMonths, beforeAgeMonths);
  if (externalMove) repairExternalMove(next, previousHousing, previousTenure, movedHousing);
  return next;
}
