// Drawing only: the world state and the current screen in, pixels out.
// A 1280x720 viewport follows the player over the 3200x2200 airfield, dawn light throughout.
import { WORLD, PALETTE, FONT, MISSIONS } from './config.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';
export const SCREEN_COMPLETE = 'complete';

const VIEW = { width: 1280, height: 720 };
const TAU = Math.PI * 2;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function createRenderer(canvas) {
  const context = canvas.getContext('2d');
  const camera = { x: 0, y: 0 };
  const fonts = new Map();

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    canvas.width = Math.round(window.innerWidth * ratio);
    canvas.height = Math.round(window.innerHeight * ratio);
  }
  window.addEventListener('resize', resize);
  resize();

  function text(value, x, y, size, color, align = 'left', weight = '') {
    const key = `${weight}${size}`;
    if (!fonts.has(key)) fonts.set(key, `${weight} ${size}px ${FONT}`.trim());
    context.font = fonts.get(key);
    context.fillStyle = color;
    context.textAlign = align;
    context.textBaseline = 'alphabetic';
    context.fillText(value, x, y);
  }

  function roundRect(x, y, w, h, r) {
    context.beginPath();
    context.moveTo(x + r, y);
    context.arcTo(x + w, y, x + w, y + h, r);
    context.arcTo(x + w, y + h, x, y + h, r);
    context.arcTo(x, y + h, x, y, r);
    context.arcTo(x, y, x + w, y, r);
    context.closePath();
  }

  function drawGround(world) {
    const { zones } = world;
    // Dawn grass with dry patches.
    context.fillStyle = PALETTE.grass;
    context.fillRect(camera.x - 40, camera.y - 40, VIEW.width + 80, VIEW.height + 80);
    context.fillStyle = PALETTE.grassDry;
    for (let i = 0; i < 40; i += 1) {
      const gx = ((i * 733) % WORLD.width) - 100;
      const gy = ((i * 911) % WORLD.height) - 100;
      context.fillRect(gx, gy, 180, 90);
    }
    // Apron and taxiway concrete.
    context.fillStyle = PALETTE.apron;
    context.fillRect(zones.apron.x, zones.apron.y, zones.apron.w, zones.apron.h);
    context.fillStyle = PALETTE.taxiway;
    context.fillRect(zones.taxiway.x, zones.taxiway.y, zones.taxiway.w, zones.taxiway.h);
    // Runways with centreline dashes and thresholds.
    for (const key of ['runway1', 'runway2']) {
      const r = zones[key];
      context.fillStyle = PALETTE.runway;
      context.fillRect(r.x, r.y, r.w, r.h);
      context.fillStyle = PALETTE.markingWhite;
      for (let x = r.x + 40; x < r.x + r.w - 40; x += 90) {
        context.fillRect(x, r.y + r.h / 2 - 3, 50, 6);
      }
      context.fillStyle = PALETTE.markingYellow;
      context.fillRect(r.x, r.y + 8, r.w, 4);
      context.fillRect(r.x, r.y + r.h - 12, r.w, 4);
      text('27', r.x + 60, r.y + r.h / 2 + 12, 34, PALETTE.markingWhite, 'center', 'bold');
      text('09', r.x + r.w - 60, r.y + r.h / 2 + 12, 34, PALETTE.markingWhite, 'center', 'bold');
    }
    // Taxiway centreline.
    context.fillStyle = PALETTE.markingYellow;
    for (let x = zones.taxiway.x + 20; x < zones.taxiway.x + zones.taxiway.w; x += 70) {
      context.fillRect(x, zones.taxiway.y + 27, 40, 6);
    }
    // Perimeter road.
    context.strokeStyle = PALETTE.asphalt;
    context.lineWidth = 34;
    context.strokeRect(160, 160, WORLD.width - 320, WORLD.height - 320);
    context.strokeStyle = PALETTE.markingWhite;
    context.lineWidth = 3;
    context.setLineDash([26, 22]);
    context.strokeRect(160, 160, WORLD.width - 320, WORLD.height - 320);
    context.setLineDash([]);
    // Fuel farm pad.
    context.fillStyle = PALETTE.concrete;
    context.fillRect(zones.fuel.x, zones.fuel.y, zones.fuel.w, zones.fuel.h);
    // Cargo yard pad.
    context.fillStyle = PALETTE.concrete;
    context.fillRect(zones.yard.x, zones.yard.y, zones.yard.w, zones.yard.h);
    // A little dawn water: the harbour creek at the south-west corner.
    context.fillStyle = PALETTE.water;
    context.beginPath();
    context.ellipse(180, 2050, 260, 90, 0.3, 0, TAU);
    context.fill();
  }

  function drawBuildings(world) {
    for (const b of world.buildings) {
      // Long dawn shadow to the west.
      context.fillStyle = 'rgba(20,16,30,0.25)';
      context.fillRect(b.x - 26, b.y + 8, b.w, b.h);
      let fill = PALETTE.hangarRoof;
      if (b.kind === 'terminal') fill = PALETTE.terminalRoof;
      else if (b.kind === 'office' || b.kind === 'gate') fill = '#a8a49a';
      else if (b.kind === 'tower') fill = '#c8ccd2';
      else if (b.kind === 'shed') fill = '#8a7a5a';
      else if (b.kind === 'bridge') fill = '#9aa2ac';
      context.fillStyle = fill;
      context.fillRect(b.x, b.y, b.w, b.h);
      context.strokeStyle = 'rgba(0,0,0,0.35)';
      context.lineWidth = 3;
      context.strokeRect(b.x, b.y, b.w, b.h);
      if (b.kind === 'tower') {
        context.fillStyle = '#2e4a66';
        context.fillRect(b.x + 12, b.y + 12, b.w - 24, 30);
        context.fillStyle = PALETTE.dawnSky;
        context.fillRect(b.x + 12, b.y + 12, b.w - 24, 8);
      }
      if (b.label && b.w > 120) {
        text(b.label, b.x + b.w / 2, b.y + b.h / 2 + 7, 22, 'rgba(20,20,26,0.75)', 'center', 'bold');
      }
    }
    for (const c of world.containers) {
      context.fillStyle = 'rgba(20,16,30,0.25)';
      context.fillRect(c.x - 8, c.y + 6, c.w, c.h);
      context.fillStyle = c.color;
      context.fillRect(c.x, c.y, c.w, c.h);
      context.strokeStyle = 'rgba(0,0,0,0.4)';
      context.lineWidth = 2;
      context.strokeRect(c.x, c.y, c.w, c.h);
      context.strokeStyle = 'rgba(255,255,255,0.25)';
      for (let i = 1; i < 5; i += 1) {
        context.beginPath();
        context.moveTo(c.x + (i * c.w) / 5, c.y);
        context.lineTo(c.x + (i * c.w) / 5, c.y + c.h);
        context.stroke();
      }
    }
    for (const t of world.tanks) {
      context.fillStyle = 'rgba(20,16,30,0.25)';
      context.beginPath();
      context.ellipse(t.x - 10, t.y + 8, t.r, t.r * 0.9, 0, 0, TAU);
      context.fill();
      context.fillStyle = PALETTE.fuelTank;
      context.beginPath();
      context.arc(t.x, t.y, t.r, 0, TAU);
      context.fill();
      context.strokeStyle = '#8a1f1f';
      context.lineWidth = 4;
      context.beginPath();
      context.arc(t.x, t.y, t.r - 8, 0, TAU);
      context.stroke();
      context.fillStyle = '#8a1f1f';
      context.beginPath();
      context.arc(t.x, t.y, 8, 0, TAU);
      context.fill();
    }
  }

  function drawVehicle(v, isPlayer) {
    context.save();
    context.translate(v.x, v.y);
    context.rotate(v.angle);
    // Dawn shadow.
    context.fillStyle = 'rgba(20,16,30,0.3)';
    roundRect(-v.def.w / 2 - 6, -v.def.h / 2 + 6, v.def.w, v.def.h, 8);
    context.fill();
    // Body.
    context.fillStyle = v.color;
    roundRect(-v.def.w / 2, -v.def.h / 2, v.def.w, v.def.h, 8);
    context.fill();
    context.strokeStyle = 'rgba(0,0,0,0.4)';
    context.lineWidth = 2;
    roundRect(-v.def.w / 2, -v.def.h / 2, v.def.w, v.def.h, 8);
    context.stroke();
    // Cabin / windshield.
    context.fillStyle = v.def.cabin;
    if (v.type === 'truck' || v.type === 'tanker') {
      context.fillRect(v.def.w / 2 - 18, -v.def.h / 2 + 4, 14, v.def.h - 8);
      context.fillStyle = 'rgba(255,255,255,0.35)';
      context.fillRect(v.def.w / 2 - 16, -v.def.h / 2 + 6, 4, v.def.h - 12);
    } else {
      context.fillRect(-6, -v.def.h / 2 + 3, 16, v.def.h - 6);
    }
    // Wheels.
    context.fillStyle = '#14161a';
    const wy = v.def.h / 2 - 2;
    context.fillRect(-v.def.w / 2 + 6, -wy - 4, 12, 6);
    context.fillRect(v.def.w / 2 - 18, -wy - 4, 12, 6);
    context.fillRect(-v.def.w / 2 + 6, wy - 2, 12, 6);
    context.fillRect(v.def.w / 2 - 18, wy - 2, 12, 6);
    // Headlights.
    context.fillStyle = '#ffe9a8';
    context.fillRect(v.def.w / 2 - 2, -v.def.h / 2 + 4, 3, 5);
    context.fillRect(v.def.w / 2 - 2, v.def.h / 2 - 9, 3, 5);
    // Police livery and light bar.
    if (v.police) {
      context.fillStyle = '#f2f2ee';
      context.fillRect(-v.def.w / 2 + 10, -v.def.h / 2 + 2, v.def.w - 20, 5);
      text('POLICE', 0, 5, 11, '#1c2733', 'center', 'bold');
      const blink = Math.floor(performance.now() / 180) % 2 === 0;
      context.fillStyle = blink ? '#ff3b30' : '#2f7bff';
      context.beginPath();
      context.arc(-4, 0, 5, 0, TAU);
      context.fill();
      context.fillStyle = blink ? '#2f7bff' : '#ff3b30';
      context.beginPath();
      context.arc(6, 0, 5, 0, TAU);
      context.fill();
    }
    // Tanker hazard stripe.
    if (v.type === 'tanker') {
      context.fillStyle = '#8a1f1f';
      for (let i = 0; i < 4; i += 1) context.fillRect(-v.def.w / 2 + 12 + i * 14, -v.def.h / 2 + 2, 7, 5);
    }
    context.restore();
    if (isPlayer) {
      context.strokeStyle = PALETTE.hudAccent;
      context.lineWidth = 3;
      context.beginPath();
      context.arc(v.x, v.y, Math.max(v.def.w, v.def.h) * 0.75, 0, TAU);
      context.stroke();
    }
    // Damage smoke.
    if (v.hp < 45 && v.hp > 0) {
      context.fillStyle = 'rgba(60,60,60,0.5)';
      context.beginPath();
      context.arc(v.x + Math.sin(performance.now() / 90) * 6, v.y - 10, 9, 0, TAU);
      context.fill();
    }
  }

  function drawPerson(x, y, angle, color, isPlayer, hurt) {
    context.save();
    context.translate(x, y);
    context.rotate(angle);
    if (hurt && Math.floor(performance.now() / 90) % 2 === 0) context.globalAlpha = 0.35;
    context.fillStyle = 'rgba(20,16,30,0.3)';
    context.beginPath();
    context.ellipse(-3, 4, 13, 10, 0, 0, TAU);
    context.fill();
    context.fillStyle = color;
    context.beginPath();
    context.arc(0, 0, 13, 0, TAU);
    context.fill();
    context.strokeStyle = 'rgba(0,0,0,0.4)';
    context.lineWidth = 2;
    context.beginPath();
    context.arc(0, 0, 13, 0, TAU);
    context.stroke();
    // Facing tick + hi-vis vest stripe.
    context.fillStyle = '#ffd23e';
    context.fillRect(8, -3, 8, 6);
    context.fillStyle = 'rgba(255,255,255,0.75)';
    context.fillRect(-8, -2, 16, 4);
    context.restore();
    if (isPlayer) {
      context.strokeStyle = PALETTE.hudAccent;
      context.lineWidth = 3;
      context.beginPath();
      context.arc(x, y, 22, 0, TAU);
      context.stroke();
    }
  }

  function drawWorld(world, screen) {
    const s = world.state;
    const p = s.player;
    // Camera follows the player, clamped to the world.
    camera.x = clamp(p.x - VIEW.width / 2, 0, WORLD.width - VIEW.width);
    camera.y = clamp(p.y - VIEW.height / 2, 0, WORLD.height - VIEW.height);
    const scale = Math.min(canvas.width / VIEW.width, canvas.height / VIEW.height);
    const ox = (canvas.width - VIEW.width * scale) / 2;
    const oy = (canvas.height - VIEW.height * scale) / 2;
    context.setTransform(1, 0, 0, 1, 0, 0);
    // Dawn sky letterbox around the viewport.
    const sky = context.createLinearGradient(0, 0, 0, canvas.height);
    sky.addColorStop(0, '#2c2140');
    sky.addColorStop(0.5, '#e87a8a');
    sky.addColorStop(1, '#f2a35e');
    context.fillStyle = sky;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.setTransform(scale, 0, 0, scale, ox - camera.x * scale, oy - camera.y * scale);
    drawGround(world);
    // Skid marks.
    context.strokeStyle = 'rgba(15,15,18,0.45)';
    context.lineWidth = 5;
    for (const skid of s.skids) {
      context.globalAlpha = clamp(skid.life, 0, 1) * 0.7;
      context.beginPath();
      context.moveTo(skid.x - Math.cos(skid.angle) * 14, skid.y - Math.sin(skid.angle) * 14);
      context.lineTo(skid.x + Math.cos(skid.angle) * 14, skid.y + Math.sin(skid.angle) * 14);
      context.stroke();
    }
    context.globalAlpha = 1;
    drawBuildings(world);
    // Objective marker: pulsing ring + beacon.
    if (s.marker) {
      const pulse = 1 + 0.18 * Math.sin(performance.now() / 260);
      context.strokeStyle = PALETTE.marker;
      context.lineWidth = 4;
      context.beginPath();
      context.arc(s.marker.x, s.marker.y, 42 * pulse, 0, TAU);
      context.stroke();
      context.fillStyle = PALETTE.marker;
      context.beginPath();
      context.moveTo(s.marker.x, s.marker.y - 66);
      context.lineTo(s.marker.x - 12, s.marker.y - 40);
      context.lineTo(s.marker.x + 12, s.marker.y - 40);
      context.closePath();
      context.fill();
      text(s.markerLabel, s.marker.x, s.marker.y - 76, 20, PALETTE.marker, 'center', 'bold');
    }
    for (const v of s.traffic) if (v.hp > 0) drawVehicle(v, false);
    for (const v of s.vehicles) if (v.hp > 0) drawVehicle(v, !p.onFoot && p.vehicle === v);
    for (const car of s.police) if (car.hp > 0) drawVehicle(car, false);
    for (const ped of s.peds) {
      if (ped.hp <= 0) continue;
      drawPerson(ped.x, ped.y, ped.angle, ped.fleeT > 0 ? '#e87a8a' : '#e8e0c8', false, false);
    }
    for (const g of s.guards) {
      if (g.hp <= 0) continue;
      drawPerson(g.x, g.y, g.angle, g.state === 'chase' ? '#c93a2e' : '#2e4a66', false, false);
      if (g.state === 'chase') text('!', g.x, g.y - 26, 22, '#ff5a4e', 'center', 'bold');
    }
    // Bullets and particles.
    for (const b of s.bullets) {
      context.strokeStyle = '#ffe9a8';
      context.lineWidth = 3;
      context.beginPath();
      context.moveTo(b.x - b.vx * 0.02, b.y - b.vy * 0.02);
      context.lineTo(b.x, b.y);
      context.stroke();
    }
    for (const pt of s.particles) {
      context.globalAlpha = clamp(pt.life * 2, 0, 1);
      context.fillStyle = pt.color;
      context.beginPath();
      context.arc(pt.x, pt.y, pt.r, 0, TAU);
      context.fill();
    }
    context.globalAlpha = 1;
    if (p.onFoot) drawPerson(p.x, p.y, p.angle, '#3f7fb8', true, p.hurtT > 0);
    // Channel progress ring while lifting the manifest.
    if (s.missionPhase === 'channel') {
      context.strokeStyle = PALETTE.hudGood;
      context.lineWidth = 6;
      context.beginPath();
      context.arc(p.x, p.y, 34, -Math.PI / 2, -Math.PI / 2 + TAU * (s.channelT / s.channelNeed));
      context.stroke();
    }
    context.setTransform(scale, 0, 0, scale, ox, oy);
    return { camera, scale, ox, oy };
  }

  function drawMinimap(world, view) {
    const s = world.state;
    const mw = 220;
    const mh = 152;
    const mx = VIEW.width - mw - 16;
    const my = 16;
    const sx = mw / WORLD.width;
    const sy = mh / WORLD.height;
    context.fillStyle = PALETTE.hudBg;
    roundRect(mx - 6, my - 6, mw + 12, mh + 12, 10);
    context.fill();
    context.save();
    context.beginPath();
    roundRect(mx, my, mw, mh, 8);
    context.clip();
    context.fillStyle = '#3d5c33';
    context.fillRect(mx, my, mw, mh);
    context.fillStyle = '#2b2f36';
    context.fillRect(mx + world.zones.runway1.x * sx, my + world.zones.runway1.y * sy, world.zones.runway1.w * sx, world.zones.runway1.h * sy);
    context.fillRect(mx + world.zones.runway2.x * sx, my + world.zones.runway2.y * sy, world.zones.runway2.w * sx, world.zones.runway2.h * sy);
    context.fillStyle = '#8d9094';
    context.fillRect(mx + world.zones.apron.x * sx, my + world.zones.apron.y * sy, world.zones.apron.w * sx, world.zones.apron.h * sy);
    context.fillStyle = '#b98a5a';
    context.fillRect(mx + 1500 * sx, my + 560 * sy, 620 * sx, 200 * sy);
    // Marker, police, player.
    if (s.marker) {
      context.fillStyle = PALETTE.marker;
      context.beginPath();
      context.arc(mx + s.marker.x * sx, my + s.marker.y * sy, 6, 0, TAU);
      context.fill();
    }
    for (const car of s.police) {
      if (car.hp <= 0) continue;
      context.fillStyle = '#2f7bff';
      context.beginPath();
      context.arc(mx + car.x * sx, my + car.y * sy, 4, 0, TAU);
      context.fill();
    }
    context.fillStyle = '#ffffff';
    context.beginPath();
    context.arc(mx + s.player.x * sx, my + s.player.y * sy, 5, 0, TAU);
    context.fill();
    context.strokeStyle = PALETTE.hudAccent;
    context.lineWidth = 2;
    context.beginPath();
    context.arc(mx + s.player.x * sx, my + s.player.y * sy, 7, 0, TAU);
    context.stroke();
    context.restore();
    // Viewport rectangle.
    context.strokeStyle = 'rgba(255,255,255,0.5)';
    context.lineWidth = 1;
    context.strokeRect(mx + view.camera.x * sx, my + view.camera.y * sy, VIEW.width * sx, VIEW.height * sy);
    text('PORT VANE INTL', mx + mw / 2, my + mh + 20, 13, PALETTE.hudMuted, 'center');
  }

  function drawHud(world, screen) {
    const s = world.state;
    const p = s.player;
    // Top-left status panel.
    context.fillStyle = PALETTE.hudBg;
    roundRect(14, 14, 300, 96, 10);
    context.fill();
    text('TAILWIND', 28, 42, 24, PALETTE.hudAccent, 'left', 'bold');
    text(`$${s.cash.toLocaleString('en-US')}`, 28, 68, 20, PALETTE.hudText, 'left', 'bold');
    // Wanted stars.
    for (let i = 0; i < 5; i += 1) {
      text(i < s.wanted ? '★' : '☆', 196 + i * 22, 68, 20, i < s.wanted ? PALETTE.star : PALETTE.hudMuted, 'left');
    }
    // Health bar.
    context.fillStyle = 'rgba(255,255,255,0.18)';
    roundRect(28, 80, 200, 12, 6);
    context.fill();
    context.fillStyle = p.hp > 50 ? PALETTE.hudGood : p.hp > 25 ? PALETTE.hudAccent : PALETTE.hudBad;
    roundRect(28, 80, Math.max(0, 200 * (p.hp / 100)), 12, 6);
    context.fill();
    text(`${Math.max(0, Math.round(p.hp))} HP`, 236, 92, 14, PALETTE.hudText, 'left');
    // Mission card, bottom-left.
    const mission = MISSIONS[Math.min(s.missionIndex, MISSIONS.length - 1)];
    context.fillStyle = PALETTE.hudBg;
    roundRect(14, VIEW.height - 108, 560, 94, 10);
    context.fill();
    text(mission.title, 28, VIEW.height - 76, 20, PALETTE.hudAccent, 'left', 'bold');
    const objective = screen === SCREEN_COMPLETE
      ? 'All four jobs complete. Free roam — Port Vane is yours.'
      : s.missionPhase === 'done' ? 'Job done — press Enter for the next one.' : mission.objective;
    text(objective, 28, VIEW.height - 50, 16, PALETTE.hudText, 'left');
    if (s.marker) {
      const d = Math.round(Math.hypot(s.marker.x - p.x, s.marker.y - p.y));
      text(`${d}m  →  ${s.markerLabel}`, 28, VIEW.height - 26, 15, PALETTE.hudMuted, 'left');
    }
    // Vehicle / speed, bottom-right.
    const speedKmh = Math.round((p.onFoot ? p.speed : Math.abs(p.vehicle ? p.vehicle.speed : 0)) * 0.36);
    context.fillStyle = PALETTE.hudBg;
    roundRect(VIEW.width - 214, VIEW.height - 78, 200, 64, 10);
    context.fill();
    const vehicleName = p.onFoot ? 'ON FOOT' : p.vehicle.def.name.toUpperCase();
    text(vehicleName, VIEW.width - 28, VIEW.height - 50, 16, PALETTE.hudText, 'right', 'bold');
    text(`${speedKmh} km/h`, VIEW.width - 28, VIEW.height - 26, 20, PALETTE.hudAccent, 'right', 'bold');
    // Transient message, centre-top.
    if (s.messageT > 0 && s.message) {
      context.globalAlpha = clamp(s.messageT, 0, 1);
      context.fillStyle = PALETTE.hudBg;
      const w = Math.min(760, 20 + s.message.length * 9);
      roundRect((VIEW.width - w) / 2, 120, w, 44, 10);
      context.fill();
      text(s.message, VIEW.width / 2, 150, 18, PALETTE.hudText, 'center');
      context.globalAlpha = 1;
    }
    // Controls hint.
    text('WASD drive / walk · E enter vehicle · Click / Space shoot · P pause · M mute', VIEW.width / 2, VIEW.height - 8, 13, 'rgba(244,239,230,0.65)', 'center');
  }

  function drawPanel(title, lines, prompt, accent) {
    context.fillStyle = 'rgba(10,12,18,0.55)';
    context.fillRect(0, 0, VIEW.width, VIEW.height);
    const width = 680;
    const height = 150 + lines.length * 32 + 70;
    const x = (VIEW.width - width) / 2;
    const y = (VIEW.height - height) / 2;
    context.fillStyle = 'rgba(16,20,28,0.94)';
    roundRect(x, y, width, height, 14);
    context.fill();
    context.strokeStyle = accent ?? PALETTE.hudAccent;
    context.lineWidth = 3;
    roundRect(x, y, width, height, 14);
    context.stroke();
    text(title, VIEW.width / 2, y + 64, 40, accent ?? PALETTE.hudAccent, 'center', 'bold');
    lines.forEach((line, i) => {
      text(line, VIEW.width / 2, y + 116 + i * 32, 19, PALETTE.hudText, 'center');
    });
    text(prompt, VIEW.width / 2, y + height - 30, 18, PALETTE.hudMuted, 'center');
  }

  function drawTitle(world, best) {
    const s = world.state;
    const view = drawWorld(world, SCREEN_TITLE);
    drawHud(world, SCREEN_TITLE);
    drawMinimap(world, view);
    const lines = [
      'Port Vane International — 05:47, the sun is coming up.',
      'You are Rook Vane, cargo pilot turned smuggler.',
      'Four jobs before sunrise. Steal, drive, outrun, vanish.',
      '',
      `Best run: $${best.toLocaleString('en-US')}  ·  Missions done: ${s.missionIndex} / 4`,
    ];
    drawPanel('TAILWIND', lines, 'Press Space or click to start  ·  Continue with C if you have a save', PALETTE.dawnSky);
    void view;
  }

  /** Paint one frame. `best` is the saved best cash for the title screen. */
  function draw(world, screen, best, saveExists) {
    const s = world.state;
    if (screen === SCREEN_TITLE) {
      drawTitle(world, best);
      return;
    }
    const view = drawWorld(world, screen);
    drawHud(world, screen);
    drawMinimap(world, view);
    if (screen === SCREEN_PAUSED) {
      drawPanel('Paused', ['The dawn shift waits for no one — except now.', 'Your progress is saved when a job ends.'], 'Press P to resume');
    } else if (screen === SCREEN_OVER) {
      drawPanel('BUSTED', [
        'Airport security dragged you off the apron.',
        `You kept $${Math.round(s.cash * 0.9).toLocaleString('en-US')} of your cash. The job is still open.`,
      ], 'Press Space to get back on the dawn shift');
    } else if (screen === SCREEN_COMPLETE) {
      drawPanel('DAWN ESCAPE — COMPLETE', [
        'Four jobs. One sunrise. The cargo is gone and so are you.',
        `Final take: $${s.cash.toLocaleString('en-US')}. Port Vane will not forget Rook Vane.`,
        'Thanks for playing Tailwind.',
      ], 'Press Space to play again in free roam', PALETTE.hudGood);
    }
    void saveExists;
  }

  return { draw, camera };
}
