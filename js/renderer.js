/**
 * Canvas drawing. The race loop passes plain data in; this file does not
 * decide who won or how fast a vehicle may go.
 */

import { pointAndHeadingOnLoop } from "./track.js";
import { mulberry32 } from "./util.js";

function roundRect(ctx, x, y, w, h, r) {
  const radius = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

export function resizeCanvas(canvas) {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const width = window.innerWidth;
  const height = window.innerHeight;
  const nextWidth = Math.max(1, Math.round(width * dpr));
  const nextHeight = Math.max(1, Math.round(height * dpr));
  if (canvas.width !== nextWidth || canvas.height !== nextHeight) {
    canvas.width = nextWidth;
    canvas.height = nextHeight;
  }
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  return { dpr, width, height };
}

let sandPattern = null;

function getSandPattern(ctx) {
  if (sandPattern) return sandPattern;
  const tile = document.createElement("canvas");
  tile.width = 256;
  tile.height = 256;
  const tileCtx = tile.getContext("2d");
  tileCtx.fillStyle = "#e4c59a";
  tileCtx.fillRect(0, 0, 256, 256);
  const rng = mulberry32(42);
  for (let i = 0; i < 220; i += 1) {
    tileCtx.fillStyle = rng() > 0.55 ? "rgba(120, 74, 40, 0.16)" : "rgba(255, 236, 206, 0.28)";
    tileCtx.beginPath();
    tileCtx.ellipse(rng() * 256, rng() * 256, 0.4 + rng() * 2.6, 0.3 + rng() * 1.6, rng() * 6, 0, Math.PI * 2);
    tileCtx.fill();
  }
  sandPattern = ctx.createPattern(tile, "repeat");
  return sandPattern;
}

function traceLoop(ctx, points) {
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i += 1) ctx.lineTo(points[i].x, points[i].y);
  ctx.closePath();
}

function blob(ctx, seed, radius) {
  const rng = mulberry32(seed);
  const steps = 7;
  ctx.beginPath();
  for (let i = 0; i < steps; i += 1) {
    const angle = (i / steps) * Math.PI * 2;
    const mag = radius * (0.72 + rng() * 0.38);
    const x = Math.cos(angle) * mag;
    const y = Math.sin(angle) * mag * 0.84;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

function drawMesa(ctx, mesa) {
  ctx.save();
  ctx.translate(mesa.x, mesa.y);
  ctx.rotate(mesa.rot || 0);
  ctx.fillStyle = "rgba(70, 36, 18, 0.22)";
  ctx.beginPath();
  ctx.ellipse(16, 20, mesa.w * 0.46, mesa.h * 0.26, 0, 0, Math.PI * 2);
  ctx.fill();

  const layers = [
    { dx: 0, dy: 0, scale: 1, color: "#7a4632" },
    { dx: -10, dy: -12, scale: 0.8, color: "#9a5a3c" },
    { dx: -16, dy: -22, scale: 0.6, color: "#c4845a" },
    { dx: -20, dy: -30, scale: 0.42, color: "#e6c79a" },
  ];
  for (let i = 0; i < layers.length; i += 1) {
    const layer = layers[i];
    const w = mesa.w * layer.scale;
    const h = mesa.h * layer.scale;
    ctx.fillStyle = layer.color;
    ctx.beginPath();
    ctx.moveTo(layer.dx - w * 0.5, layer.dy + h * 0.16);
    ctx.lineTo(layer.dx - w * 0.28, layer.dy - h * 0.22);
    ctx.lineTo(layer.dx + w * 0.22, layer.dy - h * 0.3);
    ctx.lineTo(layer.dx + w * 0.48, layer.dy + h * 0.02);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

function drawCactus(ctx, cactus) {
  ctx.save();
  ctx.translate(cactus.x, cactus.y);
  ctx.rotate(cactus.rot || 0);
  ctx.fillStyle = "rgba(50, 28, 12, 0.25)";
  ctx.beginPath();
  ctx.ellipse(8, 12, 16, 7, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.translate(-3, -10);
  const green = "#2c6b44";
  const light = "#5aa56e";
  const arm = cactus.seed % 3;

  ctx.fillStyle = green;
  if (arm !== 1) {
    roundRect(ctx, -20, -6, 16, 9, 4);
    ctx.fill();
    roundRect(ctx, -20, -26, 10, 24, 5);
    ctx.fill();
  }
  if (arm !== 2) {
    roundRect(ctx, 6, 0, 16, 9, 4);
    ctx.fill();
    roundRect(ctx, 12, -22, 10, 26, 5);
    ctx.fill();
  }
  roundRect(ctx, -6, -28, 12, 48, 6);
  ctx.fill();
  ctx.fillStyle = light;
  roundRect(ctx, -3, -24, 3.5, 36, 2);
  ctx.fill();

  ctx.strokeStyle = "#1a3d28";
  ctx.lineWidth = 1;
  for (let y = -20; y <= 14; y += 8) {
    ctx.beginPath();
    ctx.moveTo(-6, y);
    ctx.lineTo(-11, y - 3);
    ctx.moveTo(6, y);
    ctx.lineTo(11, y - 3);
    ctx.stroke();
  }
  ctx.restore();
}

function drawRock(ctx, rock) {
  ctx.save();
  ctx.translate(rock.x, rock.y);
  const radius = rock.radius;
  ctx.fillStyle = "rgba(50, 28, 12, 0.28)";
  ctx.save();
  ctx.translate(radius * 0.22, radius * 0.28);
  blob(ctx, rock.seed, radius);
  ctx.fill();
  ctx.restore();

  ctx.translate(-radius * 0.1, -radius * 0.18);
  ctx.fillStyle = rock.type === "boulder" ? "#5a463c" : "#746053";
  blob(ctx, rock.seed, radius);
  ctx.fill();
  ctx.save();
  ctx.clip();
  ctx.fillStyle = "rgba(255, 232, 204, 0.28)";
  ctx.beginPath();
  ctx.ellipse(-radius * 0.2, -radius * 0.25, radius * 0.38, radius * 0.22, -0.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  ctx.restore();
}

function drawTrack(ctx, world) {
  traceLoop(ctx, world.points);
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.strokeStyle = "#6b442c";
  ctx.lineWidth = world.width + 36;
  ctx.stroke();

  ctx.strokeStyle = "#f0d7a8";
  ctx.lineWidth = world.width;
  ctx.stroke();

  ctx.strokeStyle = "rgba(122, 74, 40, 0.55)";
  ctx.lineWidth = 3;
  traceLoop(ctx, world.edges.left);
  ctx.stroke();
  traceLoop(ctx, world.edges.right);
  ctx.stroke();

  ctx.setLineDash([16, 20]);
  ctx.strokeStyle = "rgba(122, 78, 42, 0.45)";
  ctx.lineWidth = 3;
  traceLoop(ctx, world.points);
  ctx.stroke();
  ctx.setLineDash([]);
}

function drawFinish(ctx, world) {
  const pose = pointAndHeadingOnLoop(world.points, 0, world.metrics);
  const nx = -Math.sin(pose.heading);
  const ny = Math.cos(pose.heading);
  const half = world.width / 2 - 6;
  const bands = 10;
  ctx.save();
  for (let i = 0; i < bands; i += 1) {
    const t0 = -half + (i * (half * 2)) / bands;
    const t1 = -half + ((i + 1) * (half * 2)) / bands;
    ctx.fillStyle = i % 2 === 0 ? "#1c140f" : "#f7f1e4";
    ctx.beginPath();
    ctx.moveTo(pose.x + nx * t0 - Math.cos(pose.heading) * 7, pose.y + ny * t0 - Math.sin(pose.heading) * 7);
    ctx.lineTo(pose.x + nx * t1 - Math.cos(pose.heading) * 7, pose.y + ny * t1 - Math.sin(pose.heading) * 7);
    ctx.lineTo(pose.x + nx * t1 + Math.cos(pose.heading) * 7, pose.y + ny * t1 + Math.sin(pose.heading) * 7);
    ctx.lineTo(pose.x + nx * t0 + Math.cos(pose.heading) * 7, pose.y + ny * t0 + Math.sin(pose.heading) * 7);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

function drawBanner(ctx, world, cameraRot) {
  const pose = pointAndHeadingOnLoop(world.points, 0.012, world.metrics);
  const nx = -Math.sin(pose.heading);
  const ny = Math.cos(pose.heading);
  const side = world.width / 2 + 36;
  for (const sign of [-1, 1]) {
    ctx.save();
    ctx.translate(pose.x + nx * side * sign, pose.y + ny * side * sign);
    // Cancel the chase-camera rotation so the word stays upright on screen.
    ctx.rotate(-cameraRot);
    ctx.fillStyle = "#5a3a28";
    ctx.fillRect(-3, 6, 6, 26);
    ctx.fillStyle = "#c0392b";
    roundRect(ctx, -30, -20, 60, 24, 4);
    ctx.fill();
    ctx.fillStyle = "#fff6e8";
    ctx.font = "700 13px Oswald, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("START", 0, -8);
    ctx.restore();
  }
}

function drawWheel(ctx, x, y, length, width, spin) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = "#1a120e";
  roundRect(ctx, -length / 2, -width / 2, length, width, 3);
  ctx.fill();
  ctx.strokeStyle = "#3d2b22";
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.rotate(spin);
  ctx.strokeStyle = "#8a7060";
  ctx.beginPath();
  ctx.moveTo(-length * 0.28, 0);
  ctx.lineTo(length * 0.28, 0);
  ctx.moveTo(0, -width * 0.28);
  ctx.lineTo(0, width * 0.28);
  ctx.stroke();
  ctx.restore();
}

function drawHelmet(ctx, x, y) {
  ctx.fillStyle = "#f4efe4";
  ctx.beginPath();
  ctx.arc(x, y, 3.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#2a211c";
  ctx.fillRect(x - 3, y - 0.4, 6, 1.6);
}

function drawBuggy(ctx, vehicle, spin) {
  drawWheel(ctx, -8, -14, 16, 8, spin);
  drawWheel(ctx, -8, 14, 16, 8, spin);
  drawWheel(ctx, 14, -12, 13, 7, spin);
  drawWheel(ctx, 14, 12, 13, 7, spin);

  ctx.fillStyle = "#3a2c26";
  roundRect(ctx, -22, -7, 12, 14, 2);
  ctx.fill();
  ctx.fillStyle = "#2a211c";
  ctx.fillRect(-20, -2, 6, 4);

  ctx.fillStyle = vehicle.color;
  roundRect(ctx, -12, -9, 26, 18, 5);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(14, -7);
  ctx.lineTo(26, -3);
  ctx.lineTo(26, 3);
  ctx.lineTo(14, 7);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = vehicle.cage;
  ctx.lineWidth = 2.2;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(-8, -8);
  ctx.lineTo(-8, -13);
  ctx.quadraticCurveTo(2, -18, 10, -8);
  ctx.moveTo(-8, 8);
  ctx.lineTo(-8, 13);
  ctx.quadraticCurveTo(2, 18, 10, 8);
  ctx.moveTo(-8, -13);
  ctx.quadraticCurveTo(-2, -4, -8, 13);
  ctx.stroke();

  ctx.fillStyle = "#2a211c";
  roundRect(ctx, -4, -4, 9, 8, 2);
  ctx.fill();
  drawHelmet(ctx, 0, 0);

  ctx.strokeStyle = vehicle.accent;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(6, -2);
  ctx.lineTo(6, -16);
  ctx.stroke();
  ctx.fillStyle = "#c0392b";
  ctx.beginPath();
  ctx.moveTo(6, -16);
  ctx.lineTo(14, -13);
  ctx.lineTo(6, -10);
  ctx.fill();

  ctx.fillStyle = "#fff4c8";
  ctx.beginPath();
  ctx.arc(22, -3.5, 1.7, 0, Math.PI * 2);
  ctx.arc(22, 3.5, 1.7, 0, Math.PI * 2);
  ctx.fill();
}

function drawJeep(ctx, vehicle, spin) {
  drawWheel(ctx, -14, -13, 14, 8, spin);
  drawWheel(ctx, 12, -13, 14, 8, spin);
  drawWheel(ctx, -14, 13, 14, 8, spin);
  drawWheel(ctx, 12, 13, 14, 8, spin);

  ctx.fillStyle = "#4e5c2c";
  roundRect(ctx, -18, -11, 36, 22, 4);
  ctx.fill();
  ctx.fillStyle = vehicle.color;
  roundRect(ctx, -16, -10, 32, 20, 3);
  ctx.fill();

  ctx.fillStyle = "#8a9a55";
  roundRect(ctx, 4, -8, 14, 16, 3);
  ctx.fill();

  ctx.fillStyle = vehicle.cage;
  ctx.beginPath();
  ctx.moveTo(2, -7);
  ctx.lineTo(8, -5);
  ctx.lineTo(8, 5);
  ctx.lineTo(2, 7);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "rgba(40, 60, 70, 0.35)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(5, -6);
  ctx.lineTo(5, 6);
  ctx.stroke();

  ctx.fillStyle = "#3d3428";
  ctx.beginPath();
  ctx.arc(-16, 0, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = vehicle.accent;
  ctx.lineWidth = 1.4;
  ctx.stroke();

  ctx.fillStyle = "#2a211c";
  roundRect(ctx, -6, -4.5, 8, 9, 2);
  ctx.fill();
  drawHelmet(ctx, -2, 0);

  ctx.fillStyle = "#f4efe4";
  ctx.fillRect(16, -6, 2, 4);
  ctx.fillRect(16, 2, 2, 4);
}

function drawAtv(ctx, vehicle, spin) {
  drawWheel(ctx, -10, -11, 13, 9, spin);
  drawWheel(ctx, 10, -11, 13, 9, spin);
  drawWheel(ctx, -10, 11, 13, 9, spin);
  drawWheel(ctx, 10, 11, 13, 9, spin);

  ctx.fillStyle = "#a92d22";
  roundRect(ctx, -12, -8, 26, 16, 6);
  ctx.fill();
  ctx.fillStyle = vehicle.color;
  roundRect(ctx, -8, -6, 18, 12, 5);
  ctx.fill();

  ctx.strokeStyle = vehicle.accent;
  ctx.lineWidth = 2.4;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(10, -7);
  ctx.lineTo(18, -11);
  ctx.moveTo(10, 7);
  ctx.lineTo(18, 11);
  ctx.moveTo(16, -11);
  ctx.lineTo(16, 11);
  ctx.stroke();

  ctx.fillStyle = vehicle.cage;
  roundRect(ctx, -6, -3.5, 10, 7, 2);
  ctx.fill();
  drawHelmet(ctx, -1, 0);

  ctx.fillStyle = "#2a211c";
  ctx.fillRect(-14, -2, 5, 4);
}

export function drawVehicle(ctx, vehicle, { flash = false } = {}) {
  ctx.save();
  ctx.translate(vehicle.x, vehicle.y);
  ctx.rotate(vehicle.heading);
  const scale = (vehicle.radius || vehicle.stats?.radius || 20) / 20;
  ctx.scale(scale, scale);

  ctx.fillStyle = "rgba(50, 28, 12, 0.28)";
  ctx.beginPath();
  ctx.ellipse(4, 6, 22, 12, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.translate(-3, -5);
  if (flash) ctx.globalAlpha = 0.45;
  const spin = (vehicle.distance || 0) / 18;
  if (vehicle.id === "jeep") drawJeep(ctx, vehicle, spin);
  else if (vehicle.id === "atv") drawAtv(ctx, vehicle, spin);
  else drawBuggy(ctx, vehicle, spin);
  ctx.restore();
}

function drawGuide(ctx, guide, clock) {
  if (!guide) return;
  ctx.save();
  ctx.translate(guide.x, guide.y);
  ctx.rotate(guide.heading);
  const pulse = 0.55 + Math.sin(clock * 6) * 0.25;
  ctx.globalAlpha = pulse;
  ctx.fillStyle = "#fff6e8";
  ctx.strokeStyle = "#2a160c";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(16, 0);
  ctx.lineTo(-8, -10);
  ctx.lineTo(-4, 0);
  ctx.lineTo(-8, 10);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function drawDust(ctx, dust) {
  for (let i = 0; i < dust.length; i += 1) {
    const puff = dust[i];
    ctx.globalAlpha = Math.max(0, puff.life / puff.max) * 0.4;
    ctx.fillStyle = "#c9a06a";
    ctx.beginPath();
    ctx.ellipse(puff.x, puff.y, puff.size, puff.size * 0.65, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawMinimap(ctx, world, vehicle, view) {
  if (view.width < 760) return;
  const pad = 14;
  const mapW = 150;
  const mapH = 112;
  const x = view.width - mapW - pad;
  const y = 74;
  const { bounds } = world;
  const spanX = bounds.maxX - bounds.minX;
  const spanY = bounds.maxY - bounds.minY;

  ctx.save();
  ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
  roundRect(ctx, x, y, mapW, mapH, 12);
  ctx.fillStyle = "rgba(32, 20, 14, 0.78)";
  ctx.fill();

  const project = (px, py) => ({
    x: x + 10 + ((px - bounds.minX) / spanX) * (mapW - 20),
    y: y + 10 + ((py - bounds.minY) / spanY) * (mapH - 20),
  });

  ctx.beginPath();
  const first = project(world.points[0].x, world.points[0].y);
  ctx.moveTo(first.x, first.y);
  for (let i = 1; i < world.points.length; i += 3) {
    const p = project(world.points[i].x, world.points[i].y);
    ctx.lineTo(p.x, p.y);
  }
  ctx.closePath();
  ctx.strokeStyle = "#f0d7a8";
  ctx.lineWidth = 3;
  ctx.stroke();

  const dot = project(vehicle.x, vehicle.y);
  ctx.fillStyle = vehicle.color || "#e07a2f";
  ctx.beginPath();
  ctx.arc(dot.x, dot.y, 3.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawVignette(ctx, view) {
  const gradient = ctx.createRadialGradient(
    view.width / 2,
    view.height / 2,
    view.width * 0.2,
    view.width / 2,
    view.height / 2,
    view.width * 0.72,
  );
  gradient.addColorStop(0, "rgba(0, 0, 0, 0)");
  gradient.addColorStop(1, "rgba(90, 42, 16, 0.28)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, view.width, view.height);
}

function drawBannerText(ctx, view, text) {
  if (!text) return;
  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "700 64px Oswald, sans-serif";
  ctx.lineWidth = 8;
  ctx.strokeStyle = "rgba(32, 20, 14, 0.85)";
  ctx.fillStyle = "#fff6e8";
  ctx.strokeText(text, view.width / 2, view.height * 0.28);
  ctx.fillText(text, view.width / 2, view.height * 0.28);
  ctx.restore();
}

export function drawFrame(ctx, frame) {
  const { view, camera, world, vehicle, dust = [], guide = null, clock = 0, shakeX = 0, shakeY = 0, countdownText = "", banner = "", flash = false, menu = false, minimap = false } = frame;

  ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
  ctx.clearRect(0, 0, view.width, view.height);
  ctx.fillStyle = "#e4c59a";
  ctx.fillRect(0, 0, view.width, view.height);

  ctx.save();
  const anchorY = menu ? view.height * 0.5 : view.height * 0.54;
  ctx.translate(view.width / 2 + shakeX, anchorY + shakeY);
  ctx.scale(camera.zoom, camera.zoom);
  ctx.rotate(camera.rot);
  ctx.translate(-camera.x, -camera.y);

  const { bounds } = world;
  ctx.fillStyle = getSandPattern(ctx) || "#e4c59a";
  ctx.fillRect(bounds.minX - 200, bounds.minY - 200, bounds.maxX - bounds.minX + 400, bounds.maxY - bounds.minY + 400);

  for (let i = 0; i < world.scenery.length; i += 1) {
    const item = world.scenery[i];
    if (item.type !== "patch") continue;
    ctx.save();
    ctx.translate(item.x, item.y);
    ctx.rotate(item.rot || 0);
    ctx.fillStyle = item.color;
    ctx.beginPath();
    ctx.ellipse(0, 0, item.rx, item.ry, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  for (let i = 0; i < world.scenery.length; i += 1) {
    const item = world.scenery[i];
    if (item.type !== "pebble") continue;
    ctx.fillStyle = item.shade;
    ctx.beginPath();
    ctx.ellipse(item.x, item.y, item.r, item.r * 0.7, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  for (let i = 0; i < world.scenery.length; i += 1) {
    if (world.scenery[i].type === "mesa") drawMesa(ctx, world.scenery[i]);
  }

  drawTrack(ctx, world);
  drawFinish(ctx, world);
  drawBanner(ctx, world, camera.rot);

  for (let i = 0; i < world.obstacles.length; i += 1) {
    const obstacle = world.obstacles[i];
    if (obstacle.type === "cactus") drawCactus(ctx, obstacle);
    else drawRock(ctx, obstacle);
  }

  drawDust(ctx, dust);
  drawGuide(ctx, guide, clock);
  if (vehicle) drawVehicle(ctx, vehicle, { flash });
  ctx.restore();

  ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
  drawVignette(ctx, view);
  if (vehicle && minimap) drawMinimap(ctx, world, vehicle, view);
  drawBannerText(ctx, view, countdownText || banner);
}

export function drawPreview(ctx, vehicle, width, height, phase) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, width, height);
  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, "#f0d3a4");
  gradient.addColorStop(1, "#d7b07a");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  ctx.save();
  ctx.translate(width * 0.22, height * 0.72);
  drawCactus(ctx, { x: 0, y: 0, seed: 2, rot: -0.2, radius: 12 });
  ctx.restore();

  ctx.save();
  ctx.translate(width / 2, height * 0.58);
  const previewVehicle = {
    ...vehicle,
    x: 0,
    y: 0,
    heading: -0.4 + Math.sin(phase * 0.8) * 0.35,
    distance: phase * 70,
    radius: 20,
  };
  ctx.scale(width / 180, width / 180);
  drawVehicle(ctx, previewVehicle);
  ctx.restore();
}
