// Boot and the one loop: input is read every frame, the world advances in fixed 1/60 s
// steps, and the renderer paints what is there. Screens: title, play, paused, busted, complete.
//
// ?seed=N fixes the airfield. ?shot=start|drive|chase|complete stages that scene instead of
// running the loop, paints it twice and sets window.__shotReady for a screenshot.
// window.__tailwind exposes the live state for debugging and play-testing.
import { STEP, SAVE_KEY, MISSIONS } from './config.js';
import { createRandom } from './random.js';
import { createWorld, EVENT_DIED, EVENT_SHOT_FIRED, EVENT_CRASH, EVENT_STEAL } from './world.js';
import { createMissions, MISSION_EVENT_DONE, MISSION_EVENT_STORY_DONE } from './missions.js';
import { ACTION_CONFIRM, ACTION_PAUSE, ACTION_INTERACT, ACTION_FIRE, ACTION_MUTE, createInput } from './input.js';
import { createAudio } from './audio.js';
import { createRenderer, SCREEN_TITLE, SCREEN_PLAY, SCREEN_PAUSED, SCREEN_OVER, SCREEN_COMPLETE } from './render.js';
import { stageShot } from './shots.js';

const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const audio = createAudio();

function buildGame() {
  const world = createWorld(createRandom(seed));
  const missions = createMissions(world);
  return { world, missions };
}

let { world, missions } = buildGame();
const renderer = createRenderer(canvas);

function readSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const save = JSON.parse(raw);
    if (typeof save.cash !== 'number' || typeof save.missionIndex !== 'number') return null;
    return save;
  } catch {
    return null;
  }
}

function writeSave() {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify({
      cash: world.state.cash,
      missionIndex: Math.min(world.state.missionIndex, MISSIONS.length - 1),
      savedAt: Date.now(),
    }));
  } catch {
    // Storage can be off (private windows): progress then lasts this visit only.
  }
}

function applySave(save) {
  world.state.cash = save.cash;
  missions.startMission(Math.min(save.missionIndex, MISSIONS.length - 1));
}

function runShot(name) {
  const scene = stageShot(name, world, missions);
  let painted = 0;
  function paint() {
    renderer.draw(world, scene.screen, scene.best, false);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let save = readSave();
  let best = save ? save.cash : 0;
  let accumulator = 0;
  let last = performance.now();

  window.__tailwind = {
    get state() { return world.state; },
    get screen() { return screen; },
    get save() { return readSave(); },
    startMission: (i) => { missions.startMission(i); screen = SCREEN_PLAY; },
    teleport: (x, y) => { world.state.player.x = x; world.state.player.y = y; },
  };

  function announce(message) {
    status.textContent = message;
  }

  function startGame(fresh) {
    if (fresh) {
      const rebuilt = buildGame();
      world = rebuilt.world;
      missions = rebuilt.missions;
      window.__tailwind.state;
    }
    missions.startMission(0);
    screen = SCREEN_PLAY;
    announce('Playing. Four jobs before sunrise.');
  }

  function continueGame() {
    const rebuilt = buildGame();
    world = rebuilt.world;
    missions = rebuilt.missions;
    const current = readSave();
    if (current) applySave(current);
    screen = SCREEN_PLAY;
    announce('Continuing your dawn shift.');
  }

  function endGame() {
    screen = SCREEN_OVER;
    world.state.cash = Math.round(world.state.cash * 0.9);
    writeSave();
    audio.busted();
    announce(`Busted. Cash kept $${world.state.cash}.`);
  }

  function handleActions() {
    const actions = input.takeActions();
    const bits = {
      confirm: !!(actions & ACTION_CONFIRM),
      pause: !!(actions & ACTION_PAUSE),
      interact: !!(actions & ACTION_INTERACT),
      fire: !!(actions & ACTION_FIRE),
      mute: !!(actions & ACTION_MUTE),
    };
    if (bits.mute) {
      const muted = audio.toggleMute();
      world.say(muted ? 'Sound off.' : 'Sound on.', 2);
    }
    if (bits.confirm && screen === SCREEN_TITLE) {
      audio.ensure();
      startGame(false);
      return bits;
    }
    if (bits.confirm && (screen === SCREEN_OVER || screen === SCREEN_COMPLETE)) {
      audio.ensure();
      startGame(true);
      return bits;
    }
    if (bits.pause && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    } else if (bits.pause && screen === SCREEN_PAUSED) {
      screen = SCREEN_PLAY;
      announce('Playing.');
    }
    // Continue a save with C on the title screen.
    if (screen === SCREEN_TITLE && input.isDown('KeyC') && save) {
      audio.ensure();
      continueGame();
    }
    return bits;
  }

  function step(bits) {
    // Aim on foot: mouse position in world coordinates.
    const p = world.state.player;
    if (p.onFoot) {
      const rect = canvas.getBoundingClientRect();
      const scale = Math.min(canvas.width / 1280, canvas.height / 720);
      const ox = (canvas.width - 1280 * scale) / 2;
      const oy = (canvas.height - 720 * scale) / 2;
      const camX = Math.min(Math.max(p.x - 640, 0), 3200 - 1280);
      const camY = Math.min(Math.max(p.y - 360, 0), 2200 - 720);
      const mx = ((input.mouse.x * (canvas.width / rect.width)) - ox) / scale + camX;
      const my = ((input.mouse.y * (canvas.height / rect.height)) - oy) / scale + camY;
      p.aimX = mx;
      p.aimY = my;
    }
    const events = world.step(STEP, input, bits);
    if (events & EVENT_SHOT_FIRED) audio.shot();
    if (events & EVENT_CRASH) audio.crash();
    if (events & EVENT_STEAL) audio.alarm();
    const missionEvents = missions.update(STEP, bits);
    if (missionEvents & MISSION_EVENT_DONE) {
      audio.jingle();
      best = Math.max(best, world.state.cash);
      writeSave();
      if (missionEvents & MISSION_EVENT_STORY_DONE) {
        screen = SCREEN_COMPLETE;
        announce('Dawn escape complete.');
      } else {
        // Brief beat, then the next job starts on Enter.
        world.state.missionPhase = 'done';
      }
    }
    if (events & EVENT_DIED) endGame();
    // Advance to the next mission with Enter once a job is done.
    if (world.state.missionPhase === 'done' && bits.confirm && screen === SCREEN_PLAY) {
      const storyDone = missions.advance();
      if (storyDone) screen = SCREEN_COMPLETE;
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    const bits = handleActions();
    if (screen === SCREEN_PLAY) {
      // Edge-triggered bits (confirm / interact / fire) fire once per frame, not once per step.
      let first = true;
      while (accumulator >= STEP) {
        step(first ? bits : { ...bits, confirm: false, interact: false, fire: false });
        first = false;
        accumulator -= STEP;
        if (screen !== SCREEN_PLAY) break;
      }
    } else {
      accumulator = 0;
    }
    // Engine + siren follow the game, even on the title screen's idle world.
    const p = world.state.player;
    const speedRatio = p.onFoot ? 0 : Math.abs(p.vehicle ? p.vehicle.speed : 0) / 520;
    audio.update(speedRatio, world.state.wanted, 0.016);
    renderer.draw(world, screen, best, !!save);
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('Tailwind. Press Space or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
