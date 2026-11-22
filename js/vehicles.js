/**
 * Vehicle roster. Stats are the tuning knobs for feel:
 * acceleration and brake are pixels/sec^2, maxSpeed is pixels/sec,
 * handling is radians/sec at the reference speed, grip is 0..1,
 * and radius is the collision circle in world pixels.
 *
 * Adding a vehicle is a new entry plus a draw function in renderer.js.
 */

export const VEHICLES = [
  {
    id: "buggy",
    name: "Dune Buggy",
    blurb: "Balanced and forgiving. The desert classic.",
    color: "#e07a2f",
    accent: "#f2c14e",
    cage: "#f6e2a8",
    stats: {
      acceleration: 220,
      maxSpeed: 270,
      handling: 2.55,
      brake: 420,
      drag: 0.22,
      offroadDrag: 1.25,
      grip: 0.9,
      offroadGrip: 0.55,
      offroadCap: 0.62,
      radius: 20,
    },
  },
  {
    id: "jeep",
    name: "Jeep",
    blurb: "Long legs on the straight. Takes a wide line.",
    color: "#6b7c3a",
    accent: "#c2b280",
    cage: "#d5ecf2",
    stats: {
      acceleration: 155,
      maxSpeed: 315,
      handling: 1.8,
      brake: 360,
      drag: 0.16,
      offroadDrag: 0.95,
      grip: 0.74,
      offroadGrip: 0.5,
      offroadCap: 0.7,
      radius: 24,
    },
  },
  {
    id: "atv",
    name: "4-Wheeler",
    blurb: "Jumps off the line and flicks through corners.",
    color: "#d64532",
    accent: "#f4efe6",
    cage: "#241815",
    stats: {
      acceleration: 290,
      maxSpeed: 235,
      handling: 3.25,
      brake: 460,
      drag: 0.3,
      offroadDrag: 1.45,
      grip: 0.96,
      offroadGrip: 0.62,
      offroadCap: 0.58,
      radius: 16,
    },
  },
];

/** Bars shown on the select screen, in display order. */
export const STAT_BARS = [
  ["maxSpeed", "Speed"],
  ["acceleration", "Accel"],
  ["handling", "Handling"],
];

export function getVehicle(id) {
  const found = VEHICLES.find((vehicle) => vehicle.id === id);
  if (!found) throw new Error(`Unknown vehicle: ${id}`);
  return found;
}

/**
 * Map a stat onto a 0.34..1 bar so the slowest rig still shows a visible fill.
 * Higher is always better for the stats we display.
 */
export function statRatio(id, key) {
  const values = VEHICLES.map((vehicle) => vehicle.stats[key]);
  const max = Math.max(...values);
  const min = Math.min(...values);
  const value = getVehicle(id).stats[key];
  if (max === min) return 1;
  return 0.34 + 0.66 * ((value - min) / (max - min));
}
