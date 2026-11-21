// Keyboard and mouse input, read every frame. Keys are held state; actions are
// edge-triggered (pressed once, then consumed by the game loop).
export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_INTERACT = 4;
export const ACTION_FIRE = 8;
export const ACTION_MUTE = 16;

const KEY_ACTIONS = {
  Space: ACTION_CONFIRM,
  Enter: ACTION_CONFIRM,
  KeyP: ACTION_PAUSE,
  Escape: ACTION_PAUSE,
  KeyE: ACTION_INTERACT,
  KeyM: ACTION_MUTE,
};

export function createInput(canvas) {
  const keys = new Set();
  const pressed = new Set();
  const mouse = { x: 0, y: 0, down: false, clicked: false };

  function onKeyDown(event) {
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code)) event.preventDefault();
    if (!event.repeat) {
      keys.add(event.code);
      pressed.add(event.code);
    }
  }
  function onKeyUp(event) {
    keys.delete(event.code);
  }
  function onMouseMove(event) {
    const rect = canvas.getBoundingClientRect();
    mouse.x = event.clientX - rect.left;
    mouse.y = event.clientY - rect.top;
  }
  function onMouseDown(event) {
    onMouseMove(event);
    mouse.down = true;
    mouse.clicked = true;
  }
  function onMouseUp() {
    mouse.down = false;
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  canvas.addEventListener('mousemove', onMouseMove);
  canvas.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mouseup', onMouseUp);

  /** Drive axes: -1..1 forward, -1..1 steering. Works on foot too (x = strafe). */
  function axes() {
    let forward = 0;
    let steer = 0;
    if (keys.has('KeyW') || keys.has('ArrowUp')) forward += 1;
    if (keys.has('KeyS') || keys.has('ArrowDown')) forward -= 1;
    if (keys.has('KeyA') || keys.has('ArrowLeft')) steer -= 1;
    if (keys.has('KeyD') || keys.has('ArrowRight')) steer += 1;
    return { forward, steer };
  }

  /** Consume edge-triggered actions pressed since the last call. */
  function takeActions() {
    let actions = 0;
    for (const code of pressed) {
      actions |= KEY_ACTIONS[code] ?? 0;
    }
    if (mouse.clicked) actions |= ACTION_CONFIRM | ACTION_FIRE;
    pressed.clear();
    mouse.clicked = false;
    return actions;
  }

  function isDown(code) {
    return keys.has(code);
  }

  return { axes, takeActions, isDown, mouse };
}
