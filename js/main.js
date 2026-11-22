/**
 * DOM shell: menus, HUD, touch pedals, and the buttons that drive the race.
 * The canvas and the simulation stay in game.js.
 */

import { createAudio } from "./audio.js";
import { createGame } from "./game.js";
import { createInput } from "./input.js";
import { formatTime } from "./util.js";
import { STAT_BARS, VEHICLES, statRatio } from "./vehicles.js";

const canvas = document.querySelector("#view");
const touchRoot = document.querySelector("#touch-controls");
const cards = document.querySelector("#cards");
const titleBest = document.querySelector("#title-best");
const controlHint = document.querySelector("#control-hint");
const live = document.querySelector("#live");
const hud = document.querySelector("#hud");
const hudTime = document.querySelector("#hud-time");
const hudLap = document.querySelector("#hud-lap");
const hudSpeed = document.querySelector("#hud-speed");
const hudCrashes = document.querySelector("#hud-crashes");
const pauseOverlay = document.querySelector("#pause-overlay");
const resultsHeadline = document.querySelector("#results-headline");
const resultsTime = document.querySelector("#results-time");
const resultsCrashes = document.querySelector("#results-crashes");
const resultsScore = document.querySelector("#results-score");
const resultsBest = document.querySelector("#results-best");
const resultsVehicle = document.querySelector("#results-vehicle");
const muteButton = document.querySelector("#btn-mute");

const screens = {
  title: document.querySelector("#screen-title"),
  select: document.querySelector("#screen-select"),
  results: document.querySelector("#screen-results"),
};

const audio = createAudio();
const input = createInput(touchRoot);
input.attach();

const coarse = window.matchMedia("(pointer: coarse)").matches || navigator.maxTouchPoints > 0;
if (coarse) controlHint.textContent = "Gas on the right, steer on the left.";

function renderBest(bests) {
  titleBest.textContent = formatTime(bests?.overall);
}

function setLive(text) {
  if (live.textContent !== text) live.textContent = text;
}

function syncTouch() {
  const mode = document.body.dataset.mode;
  const racing = mode === "race" || mode === "countdown";
  const narrow = window.innerWidth < 900;
  touchRoot.hidden = !(racing && (coarse || narrow));
}

function syncMuteLabel() {
  const muted = audio.isMuted();
  muteButton.textContent = muted ? "Muted" : "Sound";
  muteButton.setAttribute("aria-pressed", muted ? "true" : "false");
}

for (let index = 0; index < VEHICLES.length; index += 1) {
  const vehicle = VEHICLES[index];
  const card = document.createElement("article");
  card.className = "card";
  card.style.setProperty("--rig", vehicle.color);
  const bars = STAT_BARS.map(([key, label]) => {
    const width = Math.round(statRatio(vehicle.id, key) * 100);
    return `<div class="stat"><span>${label}</span><div class="bar" role="presentation"><span style="width:${width}%"></span></div></div>`;
  }).join("");
  card.innerHTML = `
    <canvas class="preview" data-vehicle="${vehicle.id}" aria-hidden="true"></canvas>
    <div class="card-body">
      <p class="key">${index + 1}</p>
      <h2>${vehicle.name}</h2>
      <p>${vehicle.blurb}</p>
      ${bars}
      <button type="button" class="btn primary" data-vehicle="${vehicle.id}">Race this rig</button>
    </div>
  `;
  cards.append(card);
}

const previewCanvases = [...document.querySelectorAll(".preview")];

const game = createGame({
  canvas,
  input,
  audio,
  previewCanvases,
  ui: {
    onMode(mode) {
      screens.title.classList.toggle("active", mode === "title");
      screens.select.classList.toggle("active", mode === "select");
      screens.results.classList.toggle("active", mode === "results");
      hud.hidden = !(mode === "race" || mode === "countdown" || mode === "paused");
      pauseOverlay.hidden = mode !== "paused";
      document.body.dataset.mode = mode;
      syncTouch();
      if (mode === "title") document.querySelector("#btn-start").focus();
      if (mode === "select") cards.querySelector("button")?.focus();
      if (mode === "results") document.querySelector("#btn-again").focus();
      if (mode === "paused") document.querySelector("#btn-resume").focus();
      if (mode === "race" || mode === "countdown") {
        if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
      }
    },
    onHud(hudState) {
      hudTime.textContent = hudState.time;
      hudLap.textContent = hudState.lap;
      hudSpeed.textContent = hudState.speed;
      hudCrashes.textContent = hudState.crashes;
    },
    onResults(result) {
      resultsHeadline.hidden = !result.headline;
      resultsHeadline.textContent = result.headline;
      resultsVehicle.textContent = result.vehicleName;
      resultsTime.textContent = result.time;
      resultsCrashes.textContent = result.crashes;
      resultsScore.textContent = result.score;
      resultsBest.textContent = result.best;
    },
    onBests: renderBest,
    onCue: setLive,
  },
});

document.querySelector("#btn-start").addEventListener("click", () => {
  audio.unlock();
  game.toSelect();
});

document.querySelector("#btn-back").addEventListener("click", () => game.toTitle());

cards.addEventListener("click", (event) => {
  const button = event.target.closest("[data-vehicle]");
  if (!button) return;
  audio.unlock();
  game.startRace(button.dataset.vehicle);
});

document.querySelector("#btn-pause").addEventListener("click", () => game.togglePause());
document.querySelector("#btn-resume").addEventListener("click", () => {
  audio.unlock();
  game.togglePause();
});
document.querySelector("#btn-quit").addEventListener("click", () => game.toTitle());
document.querySelector("#btn-again").addEventListener("click", () => {
  audio.unlock();
  game.restart();
});
document.querySelector("#btn-change").addEventListener("click", () => game.toSelect());

muteButton.addEventListener("click", () => {
  audio.unlock();
  audio.toggleMute();
  syncMuteLabel();
});

window.addEventListener("keydown", (event) => {
  if (event.repeat) return;
  if (event.target instanceof HTMLElement && (event.target.tagName === "INPUT" || event.target.tagName === "TEXTAREA")) return;
  const mode = game.getMode();
  if ((event.code === "KeyP" || event.code === "Escape") && (mode === "race" || mode === "countdown" || mode === "paused")) {
    event.preventDefault();
    game.togglePause();
  } else if (event.code === "Enter" && mode === "title") {
    audio.unlock();
    game.toSelect();
  } else if (mode === "select" && event.code === "Digit1") {
    audio.unlock();
    game.startRace("buggy");
  } else if (mode === "select" && event.code === "Digit2") {
    audio.unlock();
    game.startRace("jeep");
  } else if (mode === "select" && event.code === "Digit3") {
    audio.unlock();
    game.startRace("atv");
  } else if (event.code === "KeyM") {
    audio.toggleMute();
    syncMuteLabel();
  }
});

window.addEventListener("resize", syncTouch);
window.addEventListener("pointerdown", () => audio.unlock(), { passive: true });
canvas.addEventListener("contextmenu", (event) => event.preventDefault());
syncMuteLabel();
