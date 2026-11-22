/**
 * Runtime objects: a vehicle instance, a fresh race, and dust puffs.
 * Drawing lives in renderer.js; these are just the numbers the loop updates.
 */

import { getVehicle } from "./vehicles.js";

export const TOTAL_LAPS = 2;

export function createVehicleState(definition, x, y, heading) {
  return {
    id: definition.id,
    name: definition.name,
    x,
    y,
    heading,
    speed: 0,
    slide: 0,
    distance: 0,
    radius: definition.stats.radius,
    stats: definition.stats,
    color: definition.color,
    accent: definition.accent,
    cage: definition.cage,
  };
}

export function createRace(world, vehicleId) {
  const definition = getVehicle(vehicleId);
  const vehicle = createVehicleState(definition, world.start.x, world.start.y, world.start.heading);
  return {
    vehicle,
    vehicleId,
    vehicleName: definition.name,
    time: 0,
    laps: 0,
    totalLaps: TOTAL_LAPS,
    progress: world.start.progress,
    crashes: 0,
    hitCooldown: 0,
    shake: 0,
    countdown: 3.5,
    lastCue: "",
    banner: "",
    bannerTime: 0,
    dust: [],
    finished: false,
  };
}

/** Age dust and kick up a new puff behind the tires when the vehicle is moving. */
export function updateDust(dust, vehicle, onTrack, dt) {
  const next = [];
  for (let i = 0; i < dust.length; i += 1) {
    const puff = dust[i];
    puff.life -= dt;
    puff.x += puff.vx * dt;
    puff.y += puff.vy * dt;
    if (puff.life > 0) next.push(puff);
  }

  const speed = Math.abs(vehicle.speed);
  if (speed < 36 || next.length > 80) return next;

  const rate = onTrack ? 16 : 38;
  let spawn = rate * dt * (speed / vehicle.stats.maxSpeed);
  let count = Math.floor(spawn);
  if (Math.random() < spawn - count) count += 1;

  const c = Math.cos(vehicle.heading);
  const s = Math.sin(vehicle.heading);
  for (let i = 0; i < count && next.length < 90; i += 1) {
    const side = (Math.random() - 0.5) * vehicle.radius * 1.4;
    const life = 0.35 + Math.random() * 0.3;
    next.push({
      x: vehicle.x - c * (vehicle.radius + 4) - s * side,
      y: vehicle.y - s * (vehicle.radius + 4) + c * side,
      vx: -c * 16 + (Math.random() - 0.5) * 24,
      vy: -s * 16 + (Math.random() - 0.5) * 24,
      life,
      max: life,
      size: 3 + Math.random() * (onTrack ? 3 : 6),
    });
  }
  return next;
}
