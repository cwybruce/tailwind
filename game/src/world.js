// The airfield: layout, vehicles, traffic, ground crew, police, combat and the wanted system.
// Everything is plain data and fixed-step updates; rendering lives in render.js.
import { WORLD, PLAYER, VEHICLES, WANTED } from './config.js';

export const EVENT_NONE = 0;
export const EVENT_DIED = 1;
export const EVENT_SHOT_FIRED = 2;
export const EVENT_CRASH = 4;
export const EVENT_STEAL = 8;

const TAU = Math.PI * 2;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
function dist(ax, ay, bx, by) {
  return Math.hypot(ax - bx, ay - by);
}
function angleTo(ax, ay, bx, by) {
  return Math.atan2(by - ay, bx - ax);
}
function angleDiff(a, b) {
  let d = (a - b) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return d;
}

/** Circle vs axis-aligned rectangle: push the circle out, return true on overlap. */
function collideCircleRect(circle, rect) {
  const cx = clamp(circle.x, rect.x, rect.x + rect.w);
  const cy = clamp(circle.y, rect.y, rect.y + rect.h);
  const dx = circle.x - cx;
  const dy = circle.y - cy;
  const d2 = dx * dx + dy * dy;
  if (d2 >= circle.r * circle.r) return false;
  if (d2 > 0.0001) {
    const d = Math.sqrt(d2);
    circle.x = cx + (dx / d) * circle.r;
    circle.y = cy + (dy / d) * circle.r;
  } else {
    // Centre inside the rectangle: push out along the smallest penetration.
    const left = circle.x - rect.x;
    const right = rect.x + rect.w - circle.x;
    const top = circle.y - rect.y;
    const bottom = rect.y + rect.h - circle.y;
    const m = Math.min(left, right, top, bottom);
    if (m === left) circle.x = rect.x - circle.r;
    else if (m === right) circle.x = rect.x + rect.w + circle.r;
    else if (m === top) circle.y = rect.y - circle.r;
    else circle.y = rect.y + rect.h + circle.r;
  }
  return true;
}

export function createWorld(random) {
  const state = {
    time: 0,
    cash: 120,
    wanted: 0,
    wantedTimer: 0,
    missionIndex: 0,
    missionPhase: 'go', // go | channel | return | done | complete
    channelT: 0,
    channelNeed: 1.5,
    marker: null,
    markerLabel: '',
    message: '',
    messageT: 0,
    player: {
      x: 1250, y: 860, angle: -Math.PI / 2, hp: PLAYER.hp, onFoot: true,
      vehicle: null, fireT: 0, hurtT: 0, speed: 0, r: PLAYER.radius,
    },
    vehicles: [],
    traffic: [],
    peds: [],
    guards: [],
    police: [],
    bullets: [],
    particles: [],
    skids: [],
    spawn: { x: 1250, y: 860 },
    stats: { stolen: 0, shots: 0, hits: 0, chases: 0 },
  };

  // ---- Static layout: buildings, containers, tanks, zones -----------------
  const buildings = [
    // Terminal (big, with a roof garden strip) and its jet bridges.
    { x: 1500, y: 560, w: 620, h: 200, kind: 'terminal', label: 'TERMINAL' },
    { x: 1500, y: 760, w: 90, h: 60, kind: 'bridge', label: '' },
    { x: 1720, y: 760, w: 90, h: 60, kind: 'bridge', label: '' },
    { x: 1940, y: 760, w: 90, h: 60, kind: 'bridge', label: '' },
    // Hangars along the south taxiway.
    { x: 1500, y: 1050, w: 260, h: 170, kind: 'hangar', label: 'HANGAR 1' },
    { x: 1800, y: 1050, w: 260, h: 170, kind: 'hangar', label: 'HANGAR 2' },
    { x: 2100, y: 1050, w: 260, h: 170, kind: 'hangar', label: 'HANGAR 3' },
    // Cargo office (mission 1 target) and the freight shed.
    { x: 620, y: 1120, w: 180, h: 120, kind: 'office', label: 'CARGO OFFICE' },
    { x: 900, y: 1120, w: 160, h: 120, kind: 'shed', label: 'FREIGHT SHED' },
    // Control tower.
    { x: 2350, y: 560, w: 90, h: 90, kind: 'tower', label: 'TOWER' },
    // Fuel farm office.
    { x: 2620, y: 1180, w: 130, h: 90, kind: 'office', label: 'FUEL OFFICE' },
    // Perimeter gate houses.
    { x: 40, y: 900, w: 70, h: 60, kind: 'gate', label: 'WEST GATE' },
    { x: 3090, y: 900, w: 70, h: 60, kind: 'gate', label: 'EAST GATE' },
  ];
  const containers = [];
  const contColors = ['#b8452e', '#2e7d6b', '#c98a2e', '#4a6b8a', '#8a4a6b'];
  for (let row = 0; row < 3; row += 1) {
    for (let col = 0; col < 5; col += 1) {
      if (row === 1 && col === 2) continue; // gap for the truck
      containers.push({
        x: 420 + col * 130, y: 1300 + row * 70, w: 110, h: 52,
        color: contColors[(row * 5 + col) % contColors.length],
      });
    }
  }
  const tanks = [
    { x: 2680, y: 1020, r: 52 }, { x: 2840, y: 1020, r: 52 }, { x: 2760, y: 1140, r: 44 },
  ];
  const zones = {
    runway1: { x: 200, y: 300, w: 2800, h: 120 },
    runway2: { x: 200, y: 1500, w: 2800, h: 120 },
    taxiway: { x: 200, y: 900, w: 2800, h: 60 },
    apron: { x: 1400, y: 820, w: 900, h: 200 },
    yard: { x: 380, y: 1000, w: 700, h: 520 },
    fuel: { x: 2580, y: 980, w: 420, h: 300 },
  };

  // ---- Vehicles ------------------------------------------------------------
  function addVehicle(type, x, y, angle, opts = {}) {
    const def = VEHICLES[type];
    const vehicle = {
      type, def, x, y, angle, speed: 0, hp: 100,
      traffic: !!opts.traffic, police: !!opts.police, guard: false, r: 24,
      color: opts.color ?? def.color, wp: 0, waitT: 0, siren: !!opts.police,
      post: opts.police ? { x, y } : null,
      id: state.vehicles.length + state.traffic.length,
    };
    if (opts.traffic) state.traffic.push(vehicle);
    else if (opts.police) state.police.push(vehicle);
    else state.vehicles.push(vehicle);
    return vehicle;
  }

  const tug = addVehicle('tug', 1250, 900, -Math.PI / 2);
  const truck = addVehicle('truck', 700, 1560, 0);
  addVehicle('tanker', 2760, 1240, 0);
  addVehicle('sedan', 1600, 880, Math.PI, { color: '#a03a30' });
  addVehicle('sedan', 2300, 950, 0, { color: '#3a6b4a' });
  addVehicle('interceptor', 2900, 930, Math.PI, { police: true });

  // Traffic sedans on a perimeter loop.
  const loop = [
    { x: 160, y: 160 }, { x: 3040, y: 160 }, { x: 3040, y: 2040 },
    { x: 160, y: 2040 }, { x: 160, y: 160 },
  ];
  for (let i = 0; i < 8; i += 1) {
    const v = addVehicle('sedan', 160 + i * 340, 160, 0, { traffic: true, color: random.pick(['#7d8a99', '#b8b0a0', '#5a6b7d', '#8a5a4a']) });
    v.wp = i % loop.length;
    v.x = loop[v.wp].x + random.range(-30, 30);
    v.y = loop[v.wp].y + random.range(-20, 20);
  }

  // ---- Ground crew (pedestrians) ------------------------------------------
  function addPed(x, y, zone) {
    state.peds.push({ x, y, angle: random.range(0, TAU), speed: random.range(40, 70), zone, waitT: random.range(0, 3), hp: 30, fleeT: 0, r: 10 });
  }
  for (let i = 0; i < 10; i += 1) addPed(random.range(1450, 2250), random.range(840, 1000), zones.apron);
  for (let i = 0; i < 6; i += 1) addPed(random.range(420, 1000), random.range(1050, 1500), zones.yard);
  for (let i = 0; i < 4; i += 1) addPed(random.range(2600, 2960), random.range(1000, 1260), zones.fuel);

  // ---- Airport security guards --------------------------------------------
  function addGuard(x, y) {
    state.guards.push({ x, y, angle: 0, hp: 60, fireT: 0, patrol: random.range(0, TAU), speed: 150, state: 'patrol', r: 12 });
  }
  addGuard(700, 1060);
  addGuard(950, 1400);
  addGuard(1600, 1000);
  addGuard(2300, 900);
  addGuard(2900, 1050);

  function say(text, seconds = 4) {
    state.message = text;
    state.messageT = seconds;
  }
  function addWanted(n) {
    state.wanted = clamp(state.wanted + n, 0, WANTED.max);
    state.wantedTimer = 0;
  }
  function burst(x, y, color, count, speed) {
    for (let i = 0; i < count; i += 1) {
      const a = random.range(0, TAU);
      const s = random.range(speed * 0.3, speed);
      state.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: random.range(0.3, 0.8), color, r: random.range(2, 5) });
    }
  }

  function spawnPolice() {
    const want = state.wanted >= 4 ? 3 : state.wanted >= 3 ? 2 : 0;
    while (state.police.length < want && state.police.length < WANTED.maxPolice) {
      const edge = random.pick([
        { x: 200, y: 930 }, { x: 3000, y: 930 }, { x: 1600, y: 200 }, { x: 1600, y: 2000 },
      ]);
      const car = addVehicle('interceptor', edge.x, edge.y, 0, { police: true });
      state.stats.chases += 1;
    }
  }

  function nearestVehicle(x, y, maxD) {
    let best = null;
    let bestD = maxD;
    for (const v of state.vehicles) {
      if (v.hp <= 0) continue;
      const d = dist(x, y, v.x, v.y);
      if (d < bestD) { bestD = d; best = v; }
    }
    return best;
  }

  function driveVehicle(v, forward, steer, dt) {
    const def = v.def;
    const target = forward > 0 ? def.topSpeed : forward < 0 ? -def.reverse : 0;
    const accel = forward !== 0 ? def.accel : def.accel * 1.6;
    if (v.speed < target) v.speed = Math.min(target, v.speed + accel * dt);
    else if (v.speed > target) v.speed = Math.max(target, v.speed - accel * dt);
    if (Math.abs(v.speed) > 20) {
      v.angle += steer * def.steer * (v.speed / def.topSpeed) * dt * (v.speed < 0 ? -1 : 1);
    }
    v.x += Math.cos(v.angle) * v.speed * dt;
    v.y += Math.sin(v.angle) * v.speed * dt;
    v.x = clamp(v.x, 60, WORLD.width - 60);
    v.y = clamp(v.y, 60, WORLD.height - 60);
    if (Math.abs(v.speed) > 120 && Math.abs(steer) > 0.5) {
      state.skids.push({ x: v.x, y: v.y, angle: v.angle, life: 1.2 });
      if (state.skids.length > 220) state.skids.shift();
    }
  }

  function collideWorld(circle) {
    for (const b of buildings) collideCircleRect(circle, b);
    for (const c of containers) collideCircleRect(circle, c);
    for (const t of tanks) {
      const d = dist(circle.x, circle.y, t.x, t.y);
      if (d < t.r + circle.r && d > 0.001) {
        circle.x = t.x + ((circle.x - t.x) / d) * (t.r + circle.r);
        circle.y = t.y + ((circle.y - t.y) / d) * (t.r + circle.r);
      }
    }
  }

  function fireBullet(fromX, fromY, angle, friendly) {
    state.bullets.push({
      x: fromX + Math.cos(angle) * 22, y: fromY + Math.sin(angle) * 22,
      vx: Math.cos(angle) * PLAYER.bulletSpeed, vy: Math.sin(angle) * PLAYER.bulletSpeed,
      life: 0.9, friendly,
    });
  }

  function damagePlayer(amount) {
    const p = state.player;
    if (p.hurtT > 0) return;
    p.hp -= amount;
    p.hurtT = 0.5;
    state.quietT = 0;
    burst(p.x, p.y, '#ff5a4e', 8, 160);
  }

  function updateTraffic(dt) {
    for (const v of state.traffic) {
      if (v.hp <= 0) continue;
      const target = loop[v.wp];
      const d = dist(v.x, v.y, target.x, target.y);
      if (d < 60) { v.wp = (v.wp + 1) % loop.length; continue; }
      const want = angleTo(v.x, v.y, target.x, target.y);
      const diff = angleDiff(want, v.angle);
      v.angle += clamp(diff, -1.8 * dt, 1.8 * dt);
      v.speed = 240;
      v.x += Math.cos(v.angle) * v.speed * dt;
      v.y += Math.sin(v.angle) * v.speed * dt;
    }
  }

  function updatePeds(dt) {
    for (const ped of state.peds) {
      if (ped.hp <= 0) continue;
      const p = state.player;
      const nearDanger = dist(ped.x, ped.y, p.x, p.y) < 120 && (!p.onFoot || state.bullets.length > 0);
      if (nearDanger || ped.fleeT > 0) {
        ped.fleeT = Math.max(0.2, ped.fleeT - dt);
        const away = angleTo(p.x, p.y, ped.x, ped.y);
        ped.x += Math.cos(away) * ped.speed * 1.8 * dt;
        ped.y += Math.sin(away) * ped.speed * 1.8 * dt;
      } else if (ped.waitT > 0) {
        ped.waitT -= dt;
      } else {
        ped.x += Math.cos(ped.angle) * ped.speed * dt;
        ped.y += Math.sin(ped.angle) * ped.speed * dt;
        if (random.next() < dt * 0.25) ped.angle = random.range(0, TAU);
        if (random.next() < dt * 0.05) ped.waitT = random.range(1, 4);
      }
      ped.x = clamp(ped.x, ped.zone.x, ped.zone.x + ped.zone.w);
      ped.y = clamp(ped.y, ped.zone.y, ped.zone.y + ped.zone.h);
      collideWorld(ped);
    }
  }

  function updateGuards(dt, events) {
    const p = state.player;
    for (const g of state.guards) {
      if (g.hp <= 0) continue;
      const d = dist(g.x, g.y, p.x, p.y);
      const alerted = state.wanted >= 1 && d < WANTED.guardRange;
      if (alerted) {
        g.state = 'chase';
        const want = angleTo(g.x, g.y, p.x, p.y);
        g.angle = want;
        g.x += Math.cos(want) * g.speed * dt;
        g.y += Math.sin(want) * g.speed * dt;
        if (d < 380 && d > 40) {
          g.fireT -= dt;
          if (g.fireT <= 0) {
            g.fireT = random.range(1.4, 2.4);
            fireBullet(g.x, g.y, want + random.range(-0.08, 0.08), false);
            events.value |= EVENT_SHOT_FIRED;
          }
        }
      } else {
        g.state = 'patrol';
        g.patrol += dt * 0.4;
        g.x += Math.cos(g.patrol) * 40 * dt;
        g.y += Math.sin(g.patrol) * 40 * dt;
        g.x = clamp(g.x, 100, WORLD.width - 100);
        g.y = clamp(g.y, 100, WORLD.height - 100);
      }
      collideWorld(g);
    }
  }

  function updatePolice(dt) {
    const p = state.player;
    const px = p.onFoot ? p.x : p.vehicle.x;
    const py = p.onFoot ? p.y : p.vehicle.y;
    for (const car of state.police) {
      if (car.hp <= 0) continue;
      // Below wanted 3 the interceptors hold their posts; only the chase is hot.
      if (state.wanted < WANTED.policeAt) {
        const dPost = dist(car.x, car.y, car.post.x, car.post.y);
        if (dPost > 60) {
          const wantPost = angleTo(car.x, car.y, car.post.x, car.post.y);
          const diffPost = angleDiff(wantPost, car.angle);
          driveVehicle(car, 0.5, clamp(diffPost * 1.6, -1, 1), dt);
        } else {
          driveVehicle(car, 0, 0, dt);
        }
        collideWorld(car);
        continue;
      }
      const d = dist(car.x, car.y, px, py);
      const want = angleTo(car.x, car.y, px, py);
      const diff = angleDiff(want, car.angle);
      const steer = clamp(diff * 1.6, -1, 1);
      const forward = d > 90 ? 1 : 0.4;
      driveVehicle(car, forward, steer, dt);
      // Ram: contact hurts the player and slows both cars.
      if (d < 52) {
        if (p.onFoot) damagePlayer(18);
        else {
          p.vehicle.speed *= 0.55;
          car.speed *= 0.5;
          damagePlayer(6);
          burst(px, py, '#ffd23e', 10, 200);
          return EVENT_CRASH;
        }
      }
      collideWorld(car);
    }
    return EVENT_NONE;
  }

  function updateBullets(dt) {
    const p = state.player;
    for (const b of state.bullets) {
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      if (b.life <= 0) continue;
      if (b.friendly) {
        for (const g of state.guards) {
          if (g.hp > 0 && dist(b.x, b.y, g.x, g.y) < 16) {
            g.hp -= PLAYER.pistolDamage;
            b.life = 0;
            state.stats.hits += 1;
            burst(b.x, b.y, '#ff5a4e', 6, 140);
            if (g.hp <= 0) { addWanted(1); say('Guard down. That will be noticed.'); }
            break;
          }
        }
        for (const car of state.police) {
          if (b.life > 0 && car.hp > 0 && dist(b.x, b.y, car.x, car.y) < 30) {
            car.hp -= PLAYER.pistolDamage;
            b.life = 0;
            state.stats.hits += 1;
            burst(b.x, b.y, '#ffd23e', 6, 140);
          }
        }
      } else if (dist(b.x, b.y, p.x, p.y) < (p.onFoot ? 16 : 26)) {
        b.life = 0;
        damagePlayer(5);
      }
    }
    state.bullets = state.bullets.filter((b) => b.life > 0 && b.x > 0 && b.x < WORLD.width && b.y > 0 && b.y < WORLD.height);
  }

  function updateParticles(dt) {
    for (const pt of state.particles) {
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.vx *= 0.92;
      pt.vy *= 0.92;
      pt.life -= dt;
    }
    state.particles = state.particles.filter((pt) => pt.life > 0);
    for (const s of state.skids) s.life -= dt;
    state.skids = state.skids.filter((s) => s.life > 0);
  }

  function step(dt, input, actions) {
    const events = { value: EVENT_NONE };
    const p = state.player;
    state.time += dt;
    if (state.messageT > 0) state.messageT -= dt;
    if (p.hurtT > 0) p.hurtT -= dt;
    if (p.fireT > 0) p.fireT -= dt;
    // Slow health regen after six quiet seconds, so a scrape is not a death sentence.
    if (p.hp > 0 && p.hp < PLAYER.hp) {
      state.quietT = (state.quietT ?? 0) + dt;
      if (state.quietT > 6) p.hp = Math.min(PLAYER.hp, p.hp + 6 * dt);
    }

    // Wanted decays when no law is near.
    if (state.wanted > 0) {
      const px = p.onFoot ? p.x : p.vehicle.x;
      const py = p.onFoot ? p.y : p.vehicle.y;
      const near = state.police.some((c) => c.hp > 0 && dist(c.x, c.y, px, py) < 700)
        || state.guards.some((g) => g.hp > 0 && dist(g.x, g.y, px, py) < WANTED.guardRange);
      if (!near) {
        state.wantedTimer += dt;
        if (state.wantedTimer > WANTED.decaySeconds) {
          state.wanted -= 1;
          state.wantedTimer = 0;
          say(state.wanted === 0 ? 'You lost them. For now.' : 'Heat is cooling off.');
        }
      } else state.wantedTimer = 0;
    }
    spawnPolice();

    const axes = input.axes();
    if (p.onFoot) {
      const run = input.isDown('ShiftLeft') || input.isDown('ShiftRight');
      const speed = run ? PLAYER.runSpeed : PLAYER.walkSpeed;
      const mx = axes.steer;
      const my = -axes.forward;
      const len = Math.hypot(mx, my);
      if (len > 0.01) {
        p.x += (mx / len) * speed * dt;
        p.y += (my / len) * speed * dt;
        p.angle = Math.atan2(my, mx);
        p.speed = speed;
      } else p.speed = 0;
      p.x = clamp(p.x, 40, WORLD.width - 40);
      p.y = clamp(p.y, 40, WORLD.height - 40);
      collideWorld(p);
      // Aim at the mouse (screen space is converted by the caller through input.mouse + camera).
      if (p.aimX !== undefined) p.angle = Math.atan2(p.aimY - p.y, p.aimX - p.x);
      // Fire with mouse or Space (confirm action doubles as fire on foot).
      if ((actions.fire || input.mouse.down) && p.fireT <= 0) {
        p.fireT = PLAYER.fireInterval;
        fireBullet(p.x, p.y, p.angle, true);
        state.stats.shots += 1;
        events.value |= EVENT_SHOT_FIRED;
        if (state.wanted < 1) addWanted(1);
      }
      // Enter / exit vehicles.
      if (actions.interact) {
        const v = nearestVehicle(p.x, p.y, 90);
        if (v) {
          p.onFoot = false;
          p.vehicle = v;
          p.x = v.x;
          p.y = v.y;
          if (v === truck && state.missionIndex === 1 && state.missionPhase === 'go') {
            addWanted(1);
            events.value |= EVENT_STEAL;
            state.stats.stolen += 1;
            say('Alarm! The truck was not yours. Get to Hangar 3, fast.');
          } else {
            say(`Driving the ${v.def.name}.`);
          }
        }
      }
    } else {
      const v = p.vehicle;
      const before = v.speed;
      driveVehicle(v, axes.forward, axes.steer, dt);
      p.x = v.x;
      p.y = v.y;
      p.angle = v.angle;
      p.speed = Math.abs(v.speed);
      const hit = collideWorld(v);
      if (hit && Math.abs(before) > 260) {
        damagePlayer(5);
        v.speed *= 0.4;
        events.value |= EVENT_CRASH;
        burst(v.x, v.y, '#ffd23e', 8, 180);
      }
      // Vehicle-vehicle bumps.
      for (const other of [...state.vehicles, ...state.traffic, ...state.police]) {
        if (other === v || other.hp <= 0) continue;
        const d = dist(v.x, v.y, other.x, other.y);
        if (d < 46 && d > 0.01) {
          const push = (46 - d) / 2;
          const nx = (v.x - other.x) / d;
          const ny = (v.y - other.y) / d;
          v.x += nx * push;
          v.y += ny * push;
          if (Math.abs(v.speed) > 200) {
            damagePlayer(4);
            events.value |= EVENT_CRASH;
            burst(v.x, v.y, '#ffd23e', 6, 160);
          }
          v.speed *= 0.7;
        }
      }
      if (actions.interact) {
        p.onFoot = true;
        p.x = v.x + Math.cos(v.angle + Math.PI / 2) * 40;
        p.y = v.y + Math.sin(v.angle + Math.PI / 2) * 40;
        p.vehicle = null;
        say('On foot.');
      }
    }

    updateTraffic(dt);
    updatePeds(dt);
    updateGuards(dt, events);
    const policeEvent = updatePolice(dt);
    events.value |= policeEvent;
    updateBullets(dt);
    updateParticles(dt);

    if (p.hp <= 0) events.value |= EVENT_DIED;
    return events.value;
  }

  return {
    state, buildings, containers, tanks, zones, tug, truck,
    step, say, addWanted, burst, spawnPolice, nearestVehicle,
    get loop() { return loop; },
  };
}
