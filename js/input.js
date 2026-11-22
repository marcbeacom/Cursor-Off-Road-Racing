/**
 * Keyboard and on-screen pedal state.
 * `sample()` is the only thing the race loop reads, so a new control
 * (gamepad, tilt) can be added by folding it into that one object.
 */

const DRIVE_CODES = new Set([
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "KeyW",
  "KeyA",
  "KeyS",
  "KeyD",
]);

function isFormField(target) {
  const tag = target?.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || target?.isContentEditable;
}

export function createInput(touchRoot) {
  const keys = new Set();
  const touch = { gas: false, brake: false, left: false, right: false };
  const heldButtons = new Set();

  function setTouch(name, down) {
    if (name in touch) touch[name] = down;
  }

  function onKeyDown(event) {
    if (isFormField(event.target)) return;
    if (DRIVE_CODES.has(event.code) || event.code === "Space") event.preventDefault();
    keys.add(event.code);
  }

  function onKeyUp(event) {
    keys.delete(event.code);
  }

  function onBlur() {
    keys.clear();
    touch.gas = false;
    touch.brake = false;
    touch.left = false;
    touch.right = false;
    heldButtons.forEach((button) => button.classList.remove("held"));
    heldButtons.clear();
  }

  function onPointerDown(event) {
    const button = event.target.closest("[data-touch]");
    if (!button || !touchRoot.contains(button)) return;
    event.preventDefault();
    button.setPointerCapture?.(event.pointerId);
    setTouch(button.dataset.touch, true);
    button.classList.add("held");
    heldButtons.add(button);
  }

  function onPointerUp(event) {
    const button = event.target.closest?.("[data-touch]");
    if (button) {
      setTouch(button.dataset.touch, false);
      button.classList.remove("held");
      heldButtons.delete(button);
    }
    // A captured pointer can be released outside the button.
    if (!event.target.closest?.("[data-touch]")) {
      touchRoot.querySelectorAll("[data-touch]").forEach((candidate) => {
        if (!candidate.hasPointerCapture?.(event.pointerId)) return;
        setTouch(candidate.dataset.touch, false);
        candidate.classList.remove("held");
        heldButtons.delete(candidate);
      });
    }
  }

  function attach() {
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);
    touchRoot.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerUp);
  }

  function sample() {
    const throttle = keys.has("ArrowUp") || keys.has("KeyW") || touch.gas ? 1 : 0;
    const brake = keys.has("ArrowDown") || keys.has("KeyS") || touch.brake ? 1 : 0;
    let steer = 0;
    if (keys.has("ArrowLeft") || keys.has("KeyA") || touch.left) steer -= 1;
    if (keys.has("ArrowRight") || keys.has("KeyD") || touch.right) steer += 1;
    return { throttle, brake, steer: Math.max(-1, Math.min(1, steer)) };
  }

  return { attach, sample };
}
