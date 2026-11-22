/**
 * All sound is synthesized with the Web Audio API.
 * GitHub Pages then has no audio files to fetch, and a mute toggle is just a gain node.
 */

const MUTE_KEY = "cursor-offroad-racing-mute";

function readMuted() {
  try {
    return localStorage.getItem(MUTE_KEY) === "1";
  } catch {
    return false;
  }
}

function writeMuted(muted) {
  try {
    localStorage.setItem(MUTE_KEY, muted ? "1" : "0");
  } catch {
    // Ignore storage failures; mute still applies for this session.
  }
}

export function createAudio() {
  let ctx = null;
  let master = null;
  let engine = null;
  let muted = readMuted();

  function unlock() {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    if (!ctx) {
      ctx = new AudioCtx();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.28;
      master.connect(ctx.destination);

      const osc = ctx.createOscillator();
      osc.type = "triangle";
      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = 320;
      const gain = ctx.createGain();
      gain.gain.value = 0;
      osc.connect(filter);
      filter.connect(gain);
      gain.connect(master);
      osc.start();

      const noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      const data = noiseBuffer.getChannelData(0);
      for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
      const noise = ctx.createBufferSource();
      noise.buffer = noiseBuffer;
      noise.loop = true;
      const noiseFilter = ctx.createBiquadFilter();
      noiseFilter.type = "bandpass";
      noiseFilter.frequency.value = 700;
      noiseFilter.Q.value = 0.7;
      const noiseGain = ctx.createGain();
      noiseGain.gain.value = 0;
      noise.connect(noiseFilter);
      noiseFilter.connect(noiseGain);
      noiseGain.connect(master);
      noise.start();

      engine = { osc, filter, gain, noiseGain };
    }
    if (ctx.state === "suspended") ctx.resume();
  }

  function tone(freq, duration, type, level, when) {
    if (!ctx) return;
    const t = when ?? ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    gain.gain.setValueAtTime(Math.max(0.0001, level), t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    osc.connect(gain);
    gain.connect(master);
    osc.start(t);
    osc.stop(t + duration + 0.02);
  }

  function setEngine({ speed = 0, maxSpeed = 270, throttle = 0, onTrack = true, running = false } = {}) {
    if (!engine || !ctx) return;
    const t = ctx.currentTime;
    const ratio = Math.max(0, speed) / Math.max(1, maxSpeed);
    const freq = 52 + ratio * 86 + throttle * 22;
    engine.osc.frequency.setTargetAtTime(freq, t, 0.06);
    engine.filter.frequency.setTargetAtTime(260 + ratio * 1100 + throttle * 180, t, 0.08);
    const vol = running ? 0.05 + ratio * 0.16 + throttle * 0.05 : 0;
    engine.gain.gain.setTargetAtTime(vol, t, 0.05);
    const gravel = running ? ratio * (onTrack ? 0.012 : 0.05) : 0;
    engine.noiseGain.gain.setTargetAtTime(gravel, t, 0.08);
  }

  function beep() {
    tone(520, 0.12, "square", 0.08);
  }

  function go() {
    tone(740, 0.22, "square", 0.1);
  }

  function crash() {
    if (!ctx) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(180, t);
    osc.frequency.exponentialRampToValueAtTime(48, t + 0.28);
    gain.gain.setValueAtTime(0.22, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.32);
    osc.connect(gain);
    gain.connect(master);
    osc.start(t);
    osc.stop(t + 0.34);

    const length = Math.floor(ctx.sampleRate * 0.18);
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = "highpass";
    filter.frequency.value = 400;
    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.2, t);
    noiseGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(master);
    noise.start(t);
  }

  function finish() {
    if (!ctx) return;
    const t = ctx.currentTime;
    tone(523, 0.12, "square", 0.08, t);
    tone(659, 0.12, "square", 0.08, t + 0.13);
    tone(784, 0.28, "square", 0.09, t + 0.26);
  }

  function toggleMute() {
    muted = !muted;
    writeMuted(muted);
    if (master && ctx) master.gain.setTargetAtTime(muted ? 0 : 0.28, ctx.currentTime, 0.03);
    return muted;
  }

  function isMuted() {
    return muted;
  }

  return { unlock, setEngine, beep, go, crash, finish, toggleMute, isMuted };
}
