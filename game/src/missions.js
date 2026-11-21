// The four dawn-shift jobs and the story thread that ties them together.
// Each mission sets a marker in the world; this module moves the story forward.
import { MISSIONS } from './config.js';

export const MISSION_EVENT_NONE = 0;
export const MISSION_EVENT_DONE = 1;
export const MISSION_EVENT_STORY_DONE = 2;

function dist(ax, ay, bx, by) {
  return Math.hypot(ax - bx, ay - by);
}

/** Markers for each mission, in world coordinates. */
const MARKERS = [
  { office: { x: 710, y: 1280, label: 'CARGO OFFICE' } },
  { truck: { x: 700, y: 1560, label: 'CARGO TRUCK' }, hangar: { x: 2230, y: 1260, label: 'HANGAR 3' } },
  { checkpoint: { x: 3050, y: 930, label: 'EAST CHECKPOINT' } },
  { extraction: { x: 3080, y: 1150, label: 'EXTRACTION GATE' } },
];

export function createMissions(world) {
  const state = world.state;

  function startMission(index) {
    state.missionIndex = index;
    state.missionPhase = 'go';
    state.channelT = 0;
    const m = MARKERS[index];
    if (index === 0) {
      state.marker = { ...m.office };
      state.markerLabel = 'CARGO OFFICE';
      world.say('M1 — Hot Manifest: get to the cargo office on foot. Stay out of the guards’ sight.', 6);
    } else if (index === 1) {
      state.marker = { ...m.truck };
      state.markerLabel = 'CARGO TRUCK';
      world.say('M2 — Borrowed Wheels: the truck is in the yard. Take it and haul it to Hangar 3.', 6);
    } else if (index === 2) {
      state.marker = { ...m.checkpoint };
      state.markerLabel = 'EAST CHECKPOINT';
      state.wanted = Math.max(state.wanted, 3);
      world.say('M3 — Runway Run: security is on the radio. Cross Runway 1 to the east checkpoint!', 6);
    } else if (index === 3) {
      state.marker = { ...m.extraction };
      state.markerLabel = 'EXTRACTION GATE';
      state.wanted = Math.max(state.wanted, 4);
      world.say('M4 — Dawn Escape: four interceptors are coming. Reach the extraction gate!', 6);
    }
  }

  function completeMission() {
    const mission = MISSIONS[state.missionIndex];
    state.cash += mission.cash;
    state.missionPhase = 'done';
    state.marker = null;
    world.say(`${mission.title} complete — +$${mission.cash}.`, 5);
    return MISSION_EVENT_DONE;
  }

  /** Advance the story one fixed step. Returns mission events for the main loop. */
  function update(dt, actions) {
    const p = state.player;
    const index = state.missionIndex;
    if (index >= MISSIONS.length) return MISSION_EVENT_NONE;
    // A finished job pays once: while the player waits to press Enter, do not re-complete.
    if (state.missionPhase === 'done') return MISSION_EVENT_NONE;
    const m = MARKERS[index];
    let event = MISSION_EVENT_NONE;

    if (index === 0) {
      if (state.missionPhase === 'go') {
        if (p.onFoot && dist(p.x, p.y, m.office.x, m.office.y) < 90) {
          state.missionPhase = 'channel';
          state.channelT = 0;
          world.say('Lifting the manifest… hold still.', 3);
        }
      } else if (state.missionPhase === 'channel') {
        if (!p.onFoot || dist(p.x, p.y, m.office.x, m.office.y) > 110) {
          state.missionPhase = 'go';
          world.say('Lift interrupted. Get back to the office.', 3);
        } else {
          state.channelT += dt;
          if (state.channelT >= state.channelNeed) {
            state.missionPhase = 'return';
            state.marker = { x: world.tug.x, y: world.tug.y, label: 'YOUR TUG' };
            state.markerLabel = 'YOUR TUG';
            world.say('Manifest lifted! Back to your tug by the terminal.', 5);
          }
        }
      } else if (state.missionPhase === 'return') {
        if (dist(p.x, p.y, world.tug.x, world.tug.y) < 100) {
          event = completeMission();
        }
      }
    } else if (index === 1) {
      if (state.missionPhase === 'go') {
        if (!p.onFoot && p.vehicle === world.truck) {
          state.missionPhase = 'return';
          state.marker = { ...m.hangar };
          state.markerLabel = 'HANGAR 3';
          world.say('Truck is yours. Deliver it to Hangar 3.', 5);
        }
      } else if (state.missionPhase === 'return') {
        if (!p.onFoot && p.vehicle === world.truck && dist(p.x, p.y, m.hangar.x, m.hangar.y) < 130 && Math.abs(p.vehicle.speed) < 120) {
          event = completeMission();
        }
      }
    } else if (index === 2) {
      if (dist(p.x, p.y, m.checkpoint.x, m.checkpoint.y) < 130) {
        event = completeMission();
      }
    } else if (index === 3) {
      if (dist(p.x, p.y, m.extraction.x, m.extraction.y) < 130) {
        event = completeMission();
        event |= MISSION_EVENT_STORY_DONE;
      }
    }

    // A guard spotting the player near the office in M1 raises the heat.
    if (index === 0 && state.missionPhase !== 'done' && state.wanted === 0) {
      for (const g of state.guards) {
        if (g.hp > 0 && dist(g.x, g.y, p.x, p.y) < 260 && dist(p.x, p.y, m.office.x, m.office.y) < 320) {
          world.addWanted(1);
          world.say('Security spotted you near the office!', 4);
          break;
        }
      }
    }
    return event;
  }

  function advance() {
    if (state.missionIndex + 1 < MISSIONS.length) {
      startMission(state.missionIndex + 1);
      return false;
    }
    return true;
  }

  function currentMission() {
    return MISSIONS[Math.min(state.missionIndex, MISSIONS.length - 1)];
  }

  return { startMission, update, advance, completeMission, currentMission };
}
