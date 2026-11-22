/**
 * Best-time records. `considerTime` is pure so the tests can cover it;
 * load and save are the only functions that touch localStorage.
 */

const KEY = "cursor-offroad-racing-v1";

export function emptyBests() {
  return { overall: null, vehicles: {} };
}

export function loadBests() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return emptyBests();
    const data = JSON.parse(raw);
    if (!data || typeof data !== "object") return emptyBests();
    const vehicles = data.vehicles && typeof data.vehicles === "object" ? { ...data.vehicles } : {};
    return {
      overall: typeof data.overall === "number" ? data.overall : null,
      vehicles,
    };
  } catch {
    return emptyBests();
  }
}

export function saveBests(bests) {
  try {
    localStorage.setItem(KEY, JSON.stringify(bests));
  } catch {
    // Private mode and full disks should not crash a finished race.
  }
}

/**
 * Keep a time only when it is strictly faster.
 * The first finish for a vehicle, and the first finish overall, both count.
 */
export function considerTime(bests, vehicleId, timeSeconds) {
  const next = {
    overall: bests?.overall ?? null,
    vehicles: { ...(bests?.vehicles || {}) },
  };
  let isVehicleRecord = false;
  let isOverallRecord = false;
  const previousVehicle = next.vehicles[vehicleId];
  if (previousVehicle == null || timeSeconds < previousVehicle) {
    next.vehicles[vehicleId] = timeSeconds;
    isVehicleRecord = true;
  }
  if (next.overall == null || timeSeconds < next.overall) {
    next.overall = timeSeconds;
    isOverallRecord = true;
  }
  return { bests: next, isVehicleRecord, isOverallRecord };
}
