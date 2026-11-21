// Screenshot scenes behind ?shot=start|drive|chase|complete.
// Each stages a real game state (real world, real renderer, real HUD) and returns the
// screen to draw; the same seed always gives the same frame.
import { SCREEN_TITLE, SCREEN_PLAY, SCREEN_COMPLETE } from './render.js';

function placePoliceChase(world) {
  const s = world.state;
  s.wanted = 3;
  world.spawnPolice();
  // Player in the stolen truck on the taxiway, two interceptors closing in.
  const truck = world.truck;
  truck.x = 1500;
  truck.y = 930;
  truck.angle = 0;
  truck.speed = 300;
  s.player.onFoot = false;
  s.player.vehicle = truck;
  s.player.x = truck.x;
  s.player.y = truck.y;
  s.player.angle = 0;
  const c1 = s.police[0];
  const c2 = s.police[1];
  if (c1) { c1.x = 1330; c1.y = 905; c1.angle = 0; c1.speed = 380; }
  if (c2) { c2.x = 1290; c2.y = 965; c2.angle = 0.1; c2.speed = 360; }
  s.marker = { x: 3050, y: 930, label: 'EAST CHECKPOINT' };
  s.markerLabel = 'EAST CHECKPOINT';
  world.say('M3 — Runway Run: they are right behind you!', 6);
}

export function stageShot(name, world, missions) {
  const s = world.state;
  if (name === 'drive') {
    // Mission 2 in progress: the stolen truck, heading for Hangar 3.
    missions.startMission(1);
    s.missionPhase = 'return';
    s.marker = { x: 2230, y: 1260, label: 'HANGAR 3' };
    s.markerLabel = 'HANGAR 3';
    s.wanted = 1;
    const truck = world.truck;
    truck.x = 1700;
    truck.y = 930;
    truck.angle = 0;
    truck.speed = 280;
    s.player.onFoot = false;
    s.player.vehicle = truck;
    s.player.x = truck.x;
    s.player.y = truck.y;
    s.player.angle = 0;
    s.cash = 520;
    world.say('Truck is yours. Deliver it to Hangar 3.', 6);
    return { screen: SCREEN_PLAY, best: 520 };
  }
  if (name === 'chase') {
    missions.startMission(2);
    placePoliceChase(world);
    s.cash = 1320;
    return { screen: SCREEN_PLAY, best: 1320 };
  }
  if (name === 'complete') {
    missions.startMission(3);
    s.missionPhase = 'done';
    s.missionIndex = 4;
    s.cash = 7820;
    s.wanted = 0;
    s.marker = null;
    const truck = world.truck;
    truck.x = 3080;
    truck.y = 1150;
    truck.angle = 0;
    truck.speed = 0;
    s.player.onFoot = false;
    s.player.vehicle = truck;
    s.player.x = truck.x;
    s.player.y = truck.y;
    s.player.angle = 0;
    return { screen: SCREEN_COMPLETE, best: 7820 };
  }
  // Default: start — title screen over the dawn apron, player on foot by the tug.
  missions.startMission(0);
  s.player.x = 1250;
  s.player.y = 860;
  s.player.onFoot = true;
  s.player.vehicle = null;
  s.cash = 120;
  return { screen: SCREEN_TITLE, best: 0 };
}
