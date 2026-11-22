/**
 * Pure race math: movement, overlap, lap progress, and scoring.
 * The game loop owns timers and audio; this module only transforms data.
 */

import { clamp, wrapAngle } from "./util.js";

/** True when two circles strictly overlap. A perfect kiss is not a hit. */
export function circlesOverlap(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const radius = a.radius + b.radius;
  return dx * dx + dy * dy < radius * radius;
}

/**
 * Closest point on a closed polyline.
 * `progress` runs 0..1 once around the loop, measured by segment length.
 */
export function projectOntoLoop(points, x, y) {
  const count = points.length;
  let total = 0;
  const lengths = new Array(count);
  for (let i = 0; i < count; i += 1) {
    const a = points[i];
    const b = points[(i + 1) % count];
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    lengths[i] = len;
    total += len;
  }
  if (total <= 0) return { distance: Infinity, progress: 0 };

  let bestDistance = Infinity;
  let bestProgress = 0;
  let walked = 0;
  for (let i = 0; i < count; i += 1) {
    const a = points[i];
    const b = points[(i + 1) % count];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len2 = dx * dx + dy * dy || 1e-8;
    let t = ((x - a.x) * dx + (y - a.y) * dy) / len2;
    t = clamp(t, 0, 1);
    const px = a.x + dx * t;
    const py = a.y + dy * t;
    const distance = Math.hypot(x - px, y - py);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestProgress = (walked + lengths[i] * t) / total;
    }
    walked += lengths[i];
  }
  return { distance: bestDistance, progress: bestProgress };
}

/**
 * Advance lap progress.
 * Small forward steps that cross the start line award a lap.
 * Rejoining the track far from where you left snaps the marker and does not.
 * Leaving the corridor (nearTrack false) freezes progress so the infield is not a shortcut.
 */
export function advanceProgress(prev, next, nearTrack) {
  if (!nearTrack || !Number.isFinite(next)) {
    return { progress: prev, lapCompleted: false };
  }
  let delta = next - prev;
  if (delta < -0.5) delta += 1;
  if (delta > 0.5) delta -= 1;
  if (Math.abs(delta) > 0.2) {
    return { progress: next, lapCompleted: false };
  }
  let progress = prev + delta;
  let lapCompleted = false;
  if (progress >= 1) {
    progress -= 1;
    lapCompleted = true;
  } else if (progress < 0) {
    progress += 1;
  }
  return { progress, lapCompleted };
}

/**
 * One integration step. Returns a new vehicle; the input object is not changed.
 * `surface.onTrack` selects packed dirt versus loose sand.
 */
export function stepVehicle(vehicle, input, surface, dt) {
  const stats = vehicle.stats;
  const dtClamped = clamp(dt, 0, 0.05);
  const onTrack = Boolean(surface?.onTrack);
  const throttle = clamp(input?.throttle ?? 0, 0, 1);
  const brake = clamp(input?.brake ?? 0, 0, 1);
  const steer = clamp(input?.steer ?? 0, -1, 1);

  const next = {
    ...vehicle,
    stats,
    slide: vehicle.slide || 0,
    distance: vehicle.distance || 0,
    speed: vehicle.speed || 0,
    heading: vehicle.heading || 0,
  };

  const drag = onTrack ? stats.drag : stats.offroadDrag;
  const grip = onTrack ? stats.grip : stats.grip * (stats.offroadGrip ?? 0.55);
  const cap = stats.maxSpeed * (onTrack ? 1 : (stats.offroadCap ?? 0.62));

  next.speed += throttle * stats.acceleration * dtClamped;
  next.speed -= brake * stats.brake * dtClamped;
  // Brake from a standstill creeps into a slow reverse, so a spun car can back out.
  if (brake > 0.5 && throttle === 0 && next.speed < 12) {
    next.speed -= stats.acceleration * 0.32 * dtClamped;
  }
  next.speed -= next.speed * drag * dtClamped;
  if (next.speed > cap) {
    next.speed -= (next.speed - cap) * Math.min(1, dtClamped * 2.8);
  }
  next.speed = clamp(next.speed, -stats.maxSpeed * 0.22, stats.maxSpeed);

  const speedAbs = Math.abs(next.speed);
  // Little authority when crawling, and less again as speed climbs toward the top end.
  const steerAuthority = clamp(speedAbs / 70, 0.18, 1) * (1 / (1 + speedAbs / (stats.maxSpeed * 1.35)));
  const direction = next.speed < -8 ? -1 : 1;
  next.heading = wrapAngle(next.heading + steer * stats.handling * steerAuthority * direction * dtClamped);

  // Positive steer is a right turn. Slide is applied along the vehicle's right,
  // so a negative force pushes the car wide — loose sand understeers.
  const slideForce = -steer * next.speed * (1.15 - grip);
  next.slide += slideForce * dtClamped * 2.6;
  next.slide *= Math.exp(-dtClamped * (onTrack ? 8 : 2.3));
  const slideDrag = Math.min(0.5, Math.abs(next.slide) / Math.max(stats.maxSpeed, 1));
  next.speed *= 1 - slideDrag * dtClamped;

  const c = Math.cos(next.heading);
  const s = Math.sin(next.heading);
  next.x += (c * next.speed - s * next.slide) * dtClamped;
  next.y += (s * next.speed + c * next.slide) * dtClamped;
  next.distance += speedAbs * dtClamped;
  return next;
}

/**
 * Bounce a circle out of another circle.
 * Speed is kept as a scalar along `heading`; the bounce aims that heading
 * along the reflected velocity and dumps most of it.
 */
export function resolveCircleHit(body, obstacle) {
  const radius = body.radius ?? body.stats?.radius ?? 0;
  const dx = body.x - obstacle.x;
  const dy = body.y - obstacle.y;
  let dist = Math.hypot(dx, dy);
  const min = radius + obstacle.radius;
  if (dist >= min) return null;
  if (dist < 1e-4) dist = 1e-4;

  const nx = dx / dist;
  const ny = dy / dist;
  const overlap = min - dist + 0.25;
  const heading = body.heading || 0;
  const c = Math.cos(heading);
  const s = Math.sin(heading);
  const slide = body.slide || 0;
  let vx = c * (body.speed || 0) - s * slide;
  let vy = s * (body.speed || 0) + c * slide;
  const into = vx * nx + vy * ny;
  if (into < 0) {
    vx -= 1.65 * into * nx;
    vy -= 1.65 * into * ny;
  }
  const mag = Math.hypot(vx, vy);
  const nextHeading = mag > 12 ? Math.atan2(vy, vx) : heading;
  return {
    x: body.x + nx * overlap,
    y: body.y + ny * overlap,
    heading: nextHeading,
    speed: mag * 0.42,
    slide: 0,
  };
}

/**
 * Separate `body` from every overlapping obstacle.
 * The first contact absorbs the crash (new heading and speed). Further
 * contacts in the same frame only push the body out, so a cluster of
 * cacti cannot zero the car several times over.
 */
export function separateFromObstacles(body, obstacles, { damp = true } = {}) {
  let next = { ...body };
  let crash = false;
  for (let i = 0; i < obstacles.length; i += 1) {
    const resolved = resolveCircleHit(next, obstacles[i]);
    if (!resolved) continue;
    if (damp && !crash) {
      next = { ...next, ...resolved };
      crash = true;
    } else {
      next = { ...next, x: resolved.x, y: resolved.y };
    }
  }
  return { vehicle: next, crash: Boolean(damp && crash) };
}

/** Keep the vehicle inside the desert. Hitting the edge scrubs speed. */
export function clampToBounds(body, bounds) {
  const radius = body.radius ?? body.stats?.radius ?? 0;
  let { x, y, speed } = body;
  let hit = false;
  if (x < bounds.minX + radius) {
    x = bounds.minX + radius;
    hit = true;
  } else if (x > bounds.maxX - radius) {
    x = bounds.maxX - radius;
    hit = true;
  }
  if (y < bounds.minY + radius) {
    y = bounds.minY + radius;
    hit = true;
  } else if (y > bounds.maxY - radius) {
    y = bounds.maxY - radius;
    hit = true;
  }
  if (hit) speed *= 0.45;
  return { x, y, speed, hit };
}

/**
 * Higher is better. Time and crashes both spend the same pool of points,
 * and the result never goes negative.
 */
export function computeScore({ timeSeconds, crashes }) {
  const time = Math.max(0, Number(timeSeconds) || 0);
  const crashCount = Math.max(0, crashes | 0);
  const raw = 12000 - Math.floor(time * 80) - crashCount * 500;
  return Math.max(0, raw);
}
