/**
 * Small pure helpers shared by the simulation, the renderer, and the tests.
 * Nothing in this file touches the DOM, so it can run in Node or the browser.
 */

/** Clamp a number into an inclusive range. */
export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

/** Wrap an angle into (-PI, PI]. */
export function wrapAngle(angle) {
  if (!Number.isFinite(angle)) return 0;
  return Math.atan2(Math.sin(angle), Math.cos(angle));
}

/** Shortest signed difference target - current, in (-PI, PI]. */
export function angleDelta(target, current) {
  return wrapAngle(target - current);
}

/** Deterministic PRNG. Same seed always yields the same sequence. */
export function mulberry32(seed) {
  let state = seed >>> 0;
  return function next() {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Arcade speed readout. World units are pixels per second; this scales them
 * into a number that reads like miles per hour on the HUD.
 */
export function speedToMph(pixelsPerSecond) {
  return Math.round(Math.abs(pixelsPerSecond) * 0.32);
}

/** Format a race time as m:ss.hh. Non-finite values become an em dash. */
export function formatTime(seconds) {
  if (seconds == null || !Number.isFinite(seconds)) return "—";
  const safe = Math.max(0, seconds);
  const minutes = Math.floor(safe / 60);
  const remainder = safe - minutes * 60;
  const whole = Math.floor(remainder);
  const hundredths = Math.min(99, Math.floor((remainder - whole) * 100 + 1e-4));
  return `${minutes}:${String(whole).padStart(2, "0")}.${String(hundredths).padStart(2, "0")}`;
}

/**
 * Countdown copy for a timer that starts at 3.5 seconds.
 * 3, 2, and 1 each hold for about a second, then GO holds for half a second.
 */
export function countdownLabel(countdown) {
  if (countdown <= 0) return "";
  if (countdown > 2.5) return "3";
  if (countdown > 1.5) return "2";
  if (countdown > 0.5) return "1";
  return "GO";
}
