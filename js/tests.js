/**
 * Unit tests for collision, lap progress, scoring, vehicle stats, and records.
 * Open tests.html, or from the repo root run: node js/tests.js
 */

import { createVehicleState } from "./entities.js";
import {
  advanceProgress,
  circlesOverlap,
  clampToBounds,
  computeScore,
  projectOntoLoop,
  resolveCircleHit,
  separateFromObstacles,
  stepVehicle,
} from "./physics.js";
import { considerTime, emptyBests } from "./storage.js";
import { buildWorld, pointAndHeadingOnLoop } from "./track.js";
import { angleDelta, clamp, countdownLabel, formatTime, speedToMph } from "./util.js";
import { VEHICLES, getVehicle } from "./vehicles.js";

function assert(condition, message) {
  if (!condition) throw new Error(message || "assertion failed");
}

export function runTests() {
  const results = [];

  function test(name, fn) {
    try {
      fn();
      results.push({ name, pass: true });
    } catch (error) {
      results.push({ name, pass: false, error: error.message });
    }
  }

  test("circles overlap only when the centers are strictly inside the combined radius", () => {
    assert(circlesOverlap({ x: 0, y: 0, radius: 5 }, { x: 9.9, y: 0, radius: 5 }));
    assert(!circlesOverlap({ x: 0, y: 0, radius: 5 }, { x: 10, y: 0, radius: 5 }));
    assert(!circlesOverlap({ x: 0, y: 0, radius: 5 }, { x: 30, y: 0, radius: 5 }));
    assert(circlesOverlap({ x: 2, y: 2, radius: 4 }, { x: 2, y: 2, radius: 1 }));
  });

  test("a hit pushes the body out and scrubs speed", () => {
    const clear = resolveCircleHit(
      { x: 0, y: 0, heading: 0, speed: 100, slide: 0, radius: 10 },
      { x: 40, y: 0, radius: 10 },
    );
    assert(clear === null);

    const body = { x: 0, y: 0, heading: 0, speed: 120, slide: 0, radius: 10 };
    const obstacle = { x: 16, y: 0, radius: 10 };
    const hit = resolveCircleHit(body, obstacle);
    assert(hit, "expected a collision");
    const separated = Math.hypot(hit.x - obstacle.x, hit.y - obstacle.y);
    assert(separated >= 20 - 0.01, `separated ${separated}`);
    assert(hit.speed < 80, `speed ${hit.speed}`);
  });

  test("obstacle clusters report a single crash and still separate", () => {
    const body = { x: 0, y: 0, heading: 0, speed: 80, slide: 0, radius: 10 };
    const obstacles = [
      { x: 12, y: 0, radius: 10 },
      { x: 0, y: 12, radius: 10 },
    ];
    const result = separateFromObstacles(body, obstacles);
    assert(result.crash);
    assert(!circlesOverlap({ ...result.vehicle, radius: 10 }, obstacles[0]));
  });

  test("projection sits on a polyline and reports distance around the loop", () => {
    const points = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
      { x: 0, y: 100 },
    ];
    const mid = projectOntoLoop(points, 50, 0);
    assert(mid.distance < 0.001, `distance ${mid.distance}`);
    assert(Math.abs(mid.progress - 0.125) < 0.02, `progress ${mid.progress}`);
    const corner = projectOntoLoop(points, 100, 50);
    assert(corner.progress > mid.progress);
  });

  test("only a small forward step across the line completes a lap", () => {
    const forward = advanceProgress(0.9, 0.05, true);
    assert(forward.lapCompleted);
    assert(forward.progress < 0.2);

    const backward = advanceProgress(0.05, 0.9, true);
    assert(!backward.lapCompleted);

    const jump = advanceProgress(0.1, 0.5, true);
    assert(!jump.lapCompleted);
    assert(Math.abs(jump.progress - 0.5) < 0.001);

    const off = advanceProgress(0.4, 0.42, false);
    assert(!off.lapCompleted);
    assert(off.progress === 0.4);
  });

  test("throttle builds speed, steering turns, and the original vehicle is left alone", () => {
    const vehicle = createVehicleState(getVehicle("buggy"), 10, 20, 0);
    const snapshot = JSON.stringify(vehicle);
    let moved = vehicle;
    for (let i = 0; i < 30; i += 1) {
      moved = stepVehicle(moved, { throttle: 1, brake: 0, steer: 0 }, { onTrack: true }, 1 / 60);
    }
    assert(moved.speed > 40, `speed ${moved.speed}`);
    assert(JSON.stringify(vehicle) === snapshot);

    let turned = createVehicleState(getVehicle("atv"), 0, 0, 0);
    for (let i = 0; i < 90; i += 1) {
      turned = stepVehicle(turned, { throttle: 1, brake: 0, steer: 1 }, { onTrack: true }, 1 / 60);
    }
    assert(turned.heading > 0.4, `heading ${turned.heading}`);
  });

  test("loose sand settles slower than packed dirt", () => {
    function settle(onTrack) {
      let vehicle = createVehicleState(getVehicle("buggy"), 0, 0, 0);
      for (let i = 0; i < 240; i += 1) {
        vehicle = stepVehicle(vehicle, { throttle: 1, brake: 0, steer: 0 }, { onTrack }, 1 / 60);
      }
      return vehicle.speed;
    }
    const sand = settle(false);
    const dirt = settle(true);
    assert(sand < dirt - 40, `sand ${sand} dirt ${dirt}`);
  });

  test("the desert edge slows a vehicle that leaves the map", () => {
    const stuck = clampToBounds(
      { x: -20, y: 100, speed: 200, heading: 0, radius: 10 },
      { minX: 0, minY: 0, maxX: 500, maxY: 500 },
    );
    assert(stuck.hit);
    assert(stuck.x >= 10);
    assert(stuck.speed < 200);
  });

  test("score falls with time and crashes and never goes negative", () => {
    const clean = computeScore({ timeSeconds: 30, crashes: 0 });
    const slow = computeScore({ timeSeconds: 50, crashes: 0 });
    const messy = computeScore({ timeSeconds: 30, crashes: 4 });
    assert(clean > slow);
    assert(clean > messy);
    assert(computeScore({ timeSeconds: 400, crashes: 30 }) === 0);
    assert(computeScore({ timeSeconds: 30, crashes: 0 }) === computeScore({ timeSeconds: 30, crashes: 0 }));
  });

  test("the three rigs differ in speed, acceleration, and handling", () => {
    assert(VEHICLES.length >= 3);
    const ids = new Set(VEHICLES.map((vehicle) => vehicle.id));
    assert(ids.has("buggy") && ids.has("jeep") && ids.has("atv"));
    for (const key of ["maxSpeed", "acceleration", "handling"]) {
      const values = new Set(VEHICLES.map((vehicle) => vehicle.stats[key]));
      assert(values.size === VEHICLES.length, key);
    }
    for (const vehicle of VEHICLES) {
      assert(vehicle.stats.radius > 0);
      assert(vehicle.stats.brake > 0);
      assert(vehicle.stats.offroadCap > 0 && vehicle.stats.offroadCap < 1);
      assert(getVehicle(vehicle.id).name === vehicle.name);
    }
    assert(getVehicle("jeep").stats.maxSpeed > getVehicle("buggy").stats.maxSpeed);
    assert(getVehicle("atv").stats.handling > getVehicle("jeep").stats.handling);
  });

  test("best times replace a record only when the new time is faster", () => {
    const first = considerTime(emptyBests(), "jeep", 40);
    assert(first.isOverallRecord && first.isVehicleRecord);
    assert(first.bests.overall === 40);
    const other = considerTime(first.bests, "buggy", 42);
    assert(!other.isOverallRecord && other.isVehicleRecord);
    assert(other.bests.overall === 40);
    assert(other.bests.vehicles.buggy === 42);
    const better = considerTime(other.bests, "jeep", 39);
    assert(better.isOverallRecord);
    assert(better.bests.vehicles.jeep === 39);
    const worse = considerTime(better.bests, "jeep", 50);
    assert(!worse.isVehicleRecord);
    assert(worse.bests.vehicles.jeep === 39);
    assert(worse.bests.overall === 39);
  });

  test("the circuit is a short clockwise loop with a clear racing line", () => {
    const world = buildWorld();
    assert(world.points.length > 40);
    assert(world.length > 3500 && world.length < 7000, `length ${world.length}`);
    const start = projectOntoLoop(world.points, world.start.x, world.start.y);
    assert(start.distance < 1, `start distance ${start.distance}`);

    let cx = 0;
    let cy = 0;
    for (const point of world.points) {
      cx += point.x;
      cy += point.y;
    }
    cx /= world.points.length;
    cy /= world.points.length;
    let previous = null;
    for (const t of [0.05, 0.3, 0.55, 0.8]) {
      const pose = pointAndHeadingOnLoop(world.points, t, world.metrics);
      const angle = Math.atan2(pose.y - cy, pose.x - cx);
      if (previous != null) {
        assert(angleDelta(angle, previous) > 0.4, "loop should run clockwise around its center");
      }
      previous = angle;
    }

    assert(world.obstacles.length >= 12, `obstacles ${world.obstacles.length}`);
    for (const obstacle of world.obstacles) {
      const proj = projectOntoLoop(world.points, obstacle.x, obstacle.y);
      assert(proj.distance > world.width * 0.32, "obstacle sits on the racing line");
      const gap = Math.hypot(obstacle.x - world.start.x, obstacle.y - world.start.y);
      assert(gap > obstacle.radius + 40, "obstacle crowds the start");
    }
  });

  test("a buggy following the track can finish a lap", () => {
    const world = buildWorld();
    let vehicle = createVehicleState(getVehicle("buggy"), world.start.x, world.start.y, world.start.heading);
    let progress = world.start.progress;
    let laps = 0;
    let cooldown = 0;
    const limit = 60 * 50;
    for (let frame = 0; frame < limit && laps < 1; frame += 1) {
      const look = pointAndHeadingOnLoop(world.points, progress + 0.03, world.metrics);
      const desired = Math.atan2(look.y - vehicle.y, look.x - vehicle.x);
      const steer = clamp(angleDelta(desired, vehicle.heading) / 0.45, -1, 1);
      const before = projectOntoLoop(world.points, vehicle.x, vehicle.y);
      vehicle = stepVehicle(
        vehicle,
        { throttle: 1, brake: 0, steer },
        { onTrack: before.distance <= world.width * 0.5 },
        1 / 60,
      );
      cooldown = Math.max(0, cooldown - 1 / 60);
      const separated = separateFromObstacles(vehicle, world.obstacles, { damp: cooldown <= 0 });
      vehicle = separated.vehicle;
      if (separated.crash) cooldown = 0.55;
      const bounded = clampToBounds(vehicle, world.bounds);
      vehicle = { ...vehicle, x: bounded.x, y: bounded.y, speed: bounded.speed };
      const after = projectOntoLoop(world.points, vehicle.x, vehicle.y);
      const adv = advanceProgress(progress, after.progress, after.distance < world.width * 0.85);
      progress = adv.progress;
      if (adv.lapCompleted) laps += 1;
    }
    assert(laps >= 1, `finished at progress ${progress.toFixed(3)}`);
  });

  test("time and countdown labels match the HUD", () => {
    assert(formatTime(65.436) === "1:05.43");
    assert(formatTime(0) === "0:00.00");
    assert(formatTime(null) === "—");
    assert(countdownLabel(3.5) === "3");
    assert(countdownLabel(2.5) === "2");
    assert(countdownLabel(1.2) === "1");
    assert(countdownLabel(0.4) === "GO");
    assert(countdownLabel(0) === "");
    assert(speedToMph(270) === 86);
  });

  return results;
}

function runningAsScript() {
  if (typeof process === "undefined" || !process.argv?.[1]) return false;
  return process.argv[1].endsWith("tests.js");
}

if (runningAsScript()) {
  const results = runTests();
  let failed = 0;
  for (const result of results) {
    if (result.pass) {
      console.log(`PASS ${result.name}`);
    } else {
      failed += 1;
      console.error(`FAIL ${result.name}\n  ${result.error}`);
    }
  }
  console.log(`${results.length - failed} passed, ${failed} failed`);
  process.exitCode = failed === 0 ? 0 : 1;
}
