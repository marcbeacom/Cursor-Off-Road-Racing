/**
 * Screen flow and the animation loop.
 * States: title → select → countdown → race → results.
 * Pause can interrupt the countdown or the race.
 */

import { createRace, createVehicleState, updateDust } from "./entities.js";
import {
  advanceProgress,
  clampToBounds,
  computeScore,
  projectOntoLoop,
  separateFromObstacles,
  stepVehicle,
} from "./physics.js";
import { drawFrame, drawPreview, resizeCanvas } from "./renderer.js";
import { considerTime, loadBests, saveBests } from "./storage.js";
import { buildWorld, pointAndHeadingOnLoop } from "./track.js";
import { angleDelta, countdownLabel, formatTime, speedToMph } from "./util.js";
import { getVehicle } from "./vehicles.js";

function zoomFor(menu, view) {
  const targetW = menu ? 1500 : (view.width < 740 ? 540 : 940);
  const targetH = menu ? 980 : 640;
  return Math.max(0.35, Math.min(view.width / targetW, view.height / targetH, 1.8));
}

export function createGame({ canvas, input, audio, previewCanvases = [], ui = {} }) {
  const ctx = canvas.getContext("2d");
  const world = buildWorld();
  let mode = "title";
  let view = resizeCanvas(canvas);
  let race = null;
  let vehicleId = "buggy";
  let pausedFrom = "race";
  let ghost = null;
  let attract = world.start.progress;
  let clock = 0;
  let last = 0;
  const camera = {
    x: world.start.x,
    y: world.start.y,
    rot: -Math.PI / 2 - world.start.heading,
    zoom: 1,
  };

  function show(next) {
    mode = next;
    ui.onMode?.(next, race);
  }

  function updateCamera(vehicle, dt, menu) {
    const look = menu ? 40 : 150;
    const targetX = vehicle.x + Math.cos(vehicle.heading) * look;
    const targetY = vehicle.y + Math.sin(vehicle.heading) * look;
    const follow = 1 - Math.exp(-dt * (menu ? 2.2 : 5));
    camera.x += (targetX - camera.x) * follow;
    camera.y += (targetY - camera.y) * follow;
    const desired = -Math.PI / 2 - vehicle.heading;
    camera.rot += angleDelta(desired, camera.rot) * (1 - Math.exp(-dt * (menu ? 2 : 6)));
    camera.zoom = zoomFor(menu, view);
  }

  function syncHud() {
    if (!race) return;
    ui.onHud?.({
      time: formatTime(race.time),
      lap: `${Math.min(race.laps + 1, race.totalLaps)} / ${race.totalLaps}`,
      speed: String(speedToMph(race.vehicle.speed)),
      crashes: String(race.crashes),
    });
  }

  function finishRace() {
    if (!race || race.finished) return;
    race.finished = true;
    const score = computeScore({ timeSeconds: race.time, crashes: race.crashes });
    const judged = considerTime(loadBests(), race.vehicleId, race.time);
    saveBests(judged.bests);
    audio?.finish();
    audio?.setEngine({ running: false });
    show("results");
    ui.onResults?.({
      time: formatTime(race.time),
      crashes: String(race.crashes),
      score: score.toLocaleString("en-US"),
      best: formatTime(judged.bests.overall),
      headline: judged.isOverallRecord ? "New best time" : judged.isVehicleRecord ? "New vehicle best" : "",
      vehicleName: race.vehicleName,
    });
    ui.onBests?.(judged.bests);
    ui.onCue?.(`${race.vehicleName} finished in ${formatTime(race.time)}`);
  }

  function updateAttract(dt) {
    attract = (attract + dt * 0.028) % 1;
    const pose = pointAndHeadingOnLoop(world.points, attract, world.metrics);
    ghost = createVehicleState(getVehicle("buggy"), pose.x, pose.y, pose.heading);
    ghost.distance = clock * 150;
    ghost.speed = ghost.stats.maxSpeed * 0.7;
    updateCamera(ghost, dt, true);
    audio?.setEngine({ running: false });
  }

  function updateCountdown(dt) {
    const pedal = input.sample();
    race.countdown -= dt;
    const label = countdownLabel(race.countdown);
    if (label !== race.lastCue) {
      race.lastCue = label;
      if (label === "GO") audio?.go();
      else if (label) audio?.beep();
      if (label) ui.onCue?.(label === "GO" ? "Go" : label);
    }
    audio?.setEngine({
      speed: 36 + pedal.throttle * 80,
      maxSpeed: race.vehicle.stats.maxSpeed,
      throttle: pedal.throttle,
      onTrack: true,
      running: true,
    });
    updateCamera(race.vehicle, dt, false);
    if (race.countdown <= 0) show("race");
    syncHud();
  }

  function updateRace(dt) {
    const pedal = input.sample();
    const before = projectOntoLoop(world.points, race.vehicle.x, race.vehicle.y);
    const onTrack = before.distance <= world.width * 0.5;
    let vehicle = stepVehicle(race.vehicle, pedal, { onTrack }, dt);

    race.hitCooldown = Math.max(0, race.hitCooldown - dt);
    const separated = separateFromObstacles(vehicle, world.obstacles, { damp: race.hitCooldown <= 0 });
    vehicle = separated.vehicle;
    if (separated.crash) {
      race.crashes += 1;
      race.hitCooldown = 0.55;
      race.shake = 0.34;
      audio?.crash();
    }

    const bounded = clampToBounds(vehicle, world.bounds);
    vehicle = { ...vehicle, x: bounded.x, y: bounded.y, speed: bounded.speed };
    if (bounded.hit) race.shake = Math.max(race.shake, 0.14);

    const after = projectOntoLoop(world.points, vehicle.x, vehicle.y);
    const adv = advanceProgress(race.progress, after.progress, after.distance < world.width * 0.85);
    race.progress = adv.progress;
    if (adv.lapCompleted) {
      race.laps += 1;
      if (race.laps >= race.totalLaps) {
        race.vehicle = vehicle;
        race.time += dt;
        finishRace();
        return;
      }
      race.banner = `Lap ${race.laps + 1}`;
      race.bannerTime = 1.15;
      ui.onCue?.(`Lap ${race.laps + 1}`);
    }

    race.time += dt;
    race.shake = Math.max(0, race.shake - dt);
    race.bannerTime = Math.max(0, race.bannerTime - dt);
    race.dust = updateDust(race.dust, vehicle, onTrack, dt);
    race.vehicle = vehicle;
    updateCamera(vehicle, dt, false);
    audio?.setEngine({
      speed: Math.abs(vehicle.speed),
      maxSpeed: vehicle.stats.maxSpeed,
      throttle: pedal.throttle,
      onTrack,
      running: true,
    });
    syncHud();
  }

  function draw() {
    const menu = mode === "title" || mode === "select";
    const subject = menu ? ghost : race?.vehicle;
    if (!subject) return;
    const shaking = mode === "race" && race && race.shake > 0;
    const guide = !menu && race && (mode === "race" || mode === "countdown")
      ? pointAndHeadingOnLoop(world.points, race.progress + 0.045, world.metrics)
      : null;
    drawFrame(ctx, {
      view,
      camera,
      world,
      vehicle: subject,
      dust: menu || !race ? [] : race.dust,
      guide,
      clock,
      shakeX: shaking ? Math.sin(clock * 78) * race.shake * 16 : 0,
      shakeY: shaking ? Math.cos(clock * 61) * race.shake * 16 : 0,
      countdownText: mode === "countdown" ? countdownLabel(race.countdown) : "",
      banner: mode === "race" && race.bannerTime > 0 ? race.banner : "",
      flash: Boolean(race && mode === "race" && race.hitCooldown > 0.12 && Math.sin(clock * 48) > 0),
      menu,
      minimap: !menu && mode !== "results",
    });
  }

  function drawPreviews() {
    for (let i = 0; i < previewCanvases.length; i += 1) {
      const preview = previewCanvases[i];
      const rect = preview.getBoundingClientRect();
      if (rect.width < 2 || rect.height < 2) continue;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const width = Math.round(rect.width * dpr);
      const height = Math.round(rect.height * dpr);
      if (preview.width !== width || preview.height !== height) {
        preview.width = width;
        preview.height = height;
      }
      const definition = getVehicle(preview.dataset.vehicle);
      drawPreview(preview.getContext("2d"), {
        id: definition.id,
        color: definition.color,
        accent: definition.accent,
        cage: definition.cage,
        radius: 20,
        stats: definition.stats,
      }, width, height, clock + i);
    }
  }

  function frame(timestamp) {
    const dt = Math.min(0.033, last ? (timestamp - last) / 1000 : 0.016);
    last = timestamp;
    clock += dt;
    if (mode === "title" || mode === "select") updateAttract(dt);
    else if (mode === "countdown") updateCountdown(dt);
    else if (mode === "race") updateRace(dt);
    draw();
    if (mode === "select") drawPreviews();
    requestAnimationFrame(frame);
  }

  window.addEventListener("resize", () => {
    view = resizeCanvas(canvas);
  });

  ui.onBests?.(loadBests());
  show("title");
  requestAnimationFrame(frame);

  return {
    getMode: () => mode,
    toTitle() {
      race = null;
      audio?.setEngine({ running: false });
      show("title");
      ui.onBests?.(loadBests());
    },
    toSelect() {
      audio?.setEngine({ running: false });
      show("select");
    },
    startRace(id) {
      vehicleId = id;
      race = createRace(world, id);
      const { vehicle } = race;
      camera.x = vehicle.x + Math.cos(vehicle.heading) * 90;
      camera.y = vehicle.y + Math.sin(vehicle.heading) * 90;
      camera.rot = -Math.PI / 2 - vehicle.heading;
      audio?.unlock();
      show("countdown");
      syncHud();
    },
    restart() {
      this.startRace(vehicleId);
    },
    togglePause() {
      if (mode === "paused") {
        show(pausedFrom);
        return;
      }
      if (mode === "race" || mode === "countdown") {
        pausedFrom = mode;
        audio?.setEngine({ running: false });
        show("paused");
      }
    },
  };
}
