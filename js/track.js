/**
 * The desert circuit. Control points run clockwise around a simple loop so
 * the spline does not cross itself — lap progress depends on that.
 * Obstacles sit on the shoulders and at a few apexes, never on the start.
 */

import { projectOntoLoop } from "./physics.js";
import { mulberry32 } from "./util.js";

const CONTROL_POINTS = [
  { x: 420, y: 380 },
  { x: 780, y: 260 },
  { x: 1180, y: 300 },
  { x: 1560, y: 420 },
  { x: 1880, y: 680 },
  { x: 1960, y: 1020 },
  { x: 1720, y: 1320 },
  { x: 1280, y: 1480 },
  { x: 860, y: 1420 },
  { x: 480, y: 1280 },
  { x: 280, y: 980 },
  { x: 260, y: 640 },
];

const TRACK_WIDTH = 200;

function catmull(p0, p1, p2, p3, t) {
  const t2 = t * t;
  const t3 = t2 * t;
  return {
    x: 0.5 * ((2 * p1.x) + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
    y: 0.5 * ((2 * p1.y) + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3),
  };
}

/** Closed Catmull-Rom. `samplesPerSegment` includes the start of each span, not the shared end. */
export function sampleClosedCatmullRom(points, samplesPerSegment = 8) {
  const count = points.length;
  const sampled = [];
  for (let i = 0; i < count; i += 1) {
    const p0 = points[(i - 1 + count) % count];
    const p1 = points[i];
    const p2 = points[(i + 1) % count];
    const p3 = points[(i + 2) % count];
    for (let s = 0; s < samplesPerSegment; s += 1) {
      sampled.push(catmull(p0, p1, p2, p3, s / samplesPerSegment));
    }
  }
  return sampled;
}

export function loopMetrics(points) {
  const segLens = [];
  let total = 0;
  for (let i = 0; i < points.length; i += 1) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    segLens.push(len);
    total += len;
  }
  return { segLens, total };
}

export function pointAndHeadingOnLoop(points, progress, metrics) {
  const { segLens, total } = metrics || loopMetrics(points);
  if (total <= 0) return { x: points[0].x, y: points[0].y, heading: 0 };
  let target = (((progress % 1) + 1) % 1) * total;
  for (let i = 0; i < points.length; i += 1) {
    const len = segLens[i];
    if (target <= len || i === points.length - 1) {
      const a = points[i];
      const b = points[(i + 1) % points.length];
      const t = len < 1e-6 ? 0 : Math.min(1, target / len);
      return {
        x: a.x + (b.x - a.x) * t,
        y: a.y + (b.y - a.y) * t,
        heading: Math.atan2(b.y - a.y, b.x - a.x),
      };
    }
    target -= len;
  }
  return { x: points[0].x, y: points[0].y, heading: 0 };
}

function normalAt(points, index) {
  const count = points.length;
  const a = points[(index - 1 + count) % count];
  const b = points[(index + 1) % count];
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  return { x: -dy / len, y: dx / len };
}

function offsetLoop(points, distance) {
  return points.map((point, index) => {
    const normal = normalAt(points, index);
    return { x: point.x + normal.x * distance, y: point.y + normal.y * distance };
  });
}

function farFrom(list, x, y, spacing) {
  for (let i = 0; i < list.length; i += 1) {
    if (Math.hypot(list[i].x - x, list[i].y - y) < spacing) return false;
  }
  return true;
}

function buildWorldUncached() {
  const points = sampleClosedCatmullRom(CONTROL_POINTS, 8);
  const metrics = loopMetrics(points);
  const bounds = { minX: 40, minY: 40, maxX: 2280, maxY: 1760 };
  const half = TRACK_WIDTH / 2;

  const startPose = pointAndHeadingOnLoop(points, 0.02, metrics);
  const startProj = projectOntoLoop(points, startPose.x, startPose.y);
  const start = { ...startPose, progress: startProj.progress };

  const obstacles = [];
  const scenery = [];

  const mesaCandidates = [
    { x: 1120, y: 880, w: 280, h: 190, rot: 0.15 },
    { x: 160, y: 180, w: 300, h: 160, rot: -0.25 },
    { x: 2060, y: 200, w: 280, h: 150, rot: 0.35 },
    { x: 2080, y: 1600, w: 260, h: 140, rot: 0.1 },
    { x: 180, y: 1580, w: 250, h: 150, rot: -0.15 },
    { x: 1160, y: 160, w: 240, h: 120, rot: 0.05 },
  ];
  for (let i = 0; i < mesaCandidates.length; i += 1) {
    const mesa = mesaCandidates[i];
    const proj = projectOntoLoop(points, mesa.x, mesa.y);
    if (proj.distance < 250) continue;
    scenery.push({ type: "mesa", ...mesa, seed: 400 + i });
  }

  function clearOfStart(x, y, extra = 0) {
    return Math.hypot(x - start.x, y - start.y) > 150 + extra;
  }

  for (let i = 0; i < points.length; i += 7) {
    const along = i / points.length;
    if (along < 0.055 || along > 0.955) continue;
    const normal = normalAt(points, i);
    const side = (i / 7) % 2 === 0 ? 1 : -1;
    const offset = half + 22;
    const x = points[i].x + normal.x * side * offset;
    const y = points[i].y + normal.y * side * offset;
    if (!clearOfStart(x, y)) continue;
    if (!farFrom(obstacles, x, y, 64)) continue;
    const type = side > 0 ? "cactus" : "rock";
    obstacles.push({
      type,
      x,
      y,
      radius: type === "cactus" ? 13 : 18,
      seed: 1000 + i,
      rot: side * 0.4,
    });
  }

  // A few apex rocks sit just inside the shoulder so cutting the corner costs you.
  for (let i = 4; i < points.length; i += 11) {
    const count = points.length;
    const prev = points[(i - 3 + count) % count];
    const curr = points[i];
    const next = points[(i + 3) % count];
    const cross = (curr.x - prev.x) * (next.y - curr.y) - (curr.y - prev.y) * (next.x - curr.x);
    if (Math.abs(cross) < 1800) continue;
    const normal = normalAt(points, i);
    const side = cross > 0 ? -1 : 1;
    const offset = half - 4;
    const x = curr.x + normal.x * side * offset;
    const y = curr.y + normal.y * side * offset;
    const proj = projectOntoLoop(points, x, y);
    if (proj.distance < half * 0.55) continue;
    if (!clearOfStart(x, y, 20)) continue;
    if (!farFrom(obstacles, x, y, 78)) continue;
    obstacles.push({ type: "rock", x, y, radius: 16, seed: 2000 + i, rot: 0.2 });
  }

  for (let i = 5; i < points.length; i += 16) {
    const normal = normalAt(points, i);
    const side = i % 2 === 0 ? 1 : -1;
    const offset = half + 78;
    const x = points[i].x + normal.x * side * offset;
    const y = points[i].y + normal.y * side * offset;
    if (!clearOfStart(x, y, 10)) continue;
    if (!farFrom(obstacles, x, y, 80)) continue;
    obstacles.push({ type: "boulder", x, y, radius: 28, seed: 3000 + i, rot: side });
  }

  const rng = mulberry32(11);
  let guard = 0;
  let offTrackCacti = 0;
  while (offTrackCacti < 14 && guard < 500) {
    guard += 1;
    const x = bounds.minX + 80 + rng() * (bounds.maxX - bounds.minX - 160);
    const y = bounds.minY + 80 + rng() * (bounds.maxY - bounds.minY - 160);
    const proj = projectOntoLoop(points, x, y);
    if (proj.distance < half + 48 || proj.distance > 460) continue;
    if (!clearOfStart(x, y)) continue;
    if (!farFrom(obstacles, x, y, 54)) continue;
    const onMesa = scenery.some((item) => item.type === "mesa" && Math.hypot(item.x - x, item.y - y) < Math.max(item.w, item.h) * 0.42);
    if (onMesa) continue;
    obstacles.push({ type: "cactus", x, y, radius: 12, seed: 5000 + guard, rot: rng() * Math.PI });
    offTrackCacti += 1;
  }

  const patchColors = ["rgba(196, 146, 86, 0.45)", "rgba(237, 214, 170, 0.55)", "rgba(168, 112, 68, 0.28)"];
  for (let i = 0; i < 9; i += 1) {
    scenery.push({
      type: "patch",
      x: bounds.minX + rng() * (bounds.maxX - bounds.minX),
      y: bounds.minY + rng() * (bounds.maxY - bounds.minY),
      rx: 80 + rng() * 180,
      ry: 50 + rng() * 110,
      rot: rng() * Math.PI,
      color: patchColors[i % patchColors.length],
    });
  }

  for (let i = 0; i < 180; i += 1) {
    const x = bounds.minX + rng() * (bounds.maxX - bounds.minX);
    const y = bounds.minY + rng() * (bounds.maxY - bounds.minY);
    const proj = projectOntoLoop(points, x, y);
    if (proj.distance < half + 8) continue;
    scenery.push({
      type: "pebble",
      x,
      y,
      r: 1 + rng() * 2.4,
      shade: rng() > 0.5 ? "rgba(110, 72, 42, 0.35)" : "rgba(255, 244, 220, 0.45)",
    });
  }

  return {
    points,
    metrics,
    width: TRACK_WIDTH,
    bounds,
    start,
    obstacles,
    scenery,
    edges: {
      left: offsetLoop(points, half),
      right: offsetLoop(points, -half),
    },
    length: metrics.total,
  };
}

let cachedWorld = null;

export function buildWorld() {
  if (!cachedWorld) cachedWorld = buildWorldUncached();
  return cachedWorld;
}
