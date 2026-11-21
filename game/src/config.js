// Every tuning number and colour for Tailwind, in one place.
// The world is a fixed 3200x2200 airfield; the camera shows a 1280x720 window of it.
export const WORLD = { width: 3200, height: 2200 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

/** Where the best save is kept between visits (this browser only). */
export const SAVE_KEY = 'tailwind.save.v1';

export const PLAYER = {
  radius: 14,
  walkSpeed: 230,
  runSpeed: 330,
  hp: 100,
  pistolDamage: 34,
  fireInterval: 0.28,
  bulletSpeed: 900,
};

/** Vehicle types: top speed (px/s), acceleration, steering, size, colour, label. */
export const VEHICLES = {
  tug: { name: 'Baggage Tug', topSpeed: 300, accel: 420, reverse: 160, steer: 2.6, w: 46, h: 26, color: '#e8a13a', cabin: '#7a4d12', seats: 1 },
  truck: { name: 'Cargo Truck', topSpeed: 380, accel: 330, reverse: 150, steer: 2.1, w: 78, h: 34, color: '#3f7fb8', cabin: '#dfe9f2', seats: 1 },
  tanker: { name: 'Fuel Tanker', topSpeed: 320, accel: 260, reverse: 130, steer: 1.8, w: 84, h: 34, color: '#c8ccd2', cabin: '#8a1f1f', seats: 1 },
  interceptor: { name: 'Interceptor', topSpeed: 520, accel: 560, reverse: 200, steer: 3.1, w: 56, h: 28, color: '#1c2733', cabin: '#dfe9f2', seats: 1 },
  sedan: { name: 'Crew Sedan', topSpeed: 340, accel: 380, reverse: 150, steer: 2.4, w: 52, h: 26, color: '#7d8a99', cabin: '#20262e', seats: 1 },
};

export const WANTED = {
  max: 5,
  decaySeconds: 9,
  guardRange: 400,
  policeAt: 3,
  maxPolice: 4,
};

export const PALETTE = {
  grass: '#5c7a44',
  grassDry: '#7d8a4d',
  concrete: '#8d9094',
  apron: '#9a9da0',
  asphalt: '#33373d',
  runway: '#2b2f36',
  taxiway: '#3a3e45',
  markingYellow: '#e8c33c',
  markingWhite: '#e8e8e2',
  terminalRoof: '#b98a5a',
  hangarRoof: '#7d8894',
  containerA: '#b8452e',
  containerB: '#2e7d6b',
  containerC: '#c98a2e',
  fuelTank: '#d8d5cc',
  fence: '#6a6f76',
  water: '#3f6d8a',
  dawnSky: '#f2a35e',
  dawnPink: '#e87a8a',
  hudBg: 'rgba(12,16,22,0.72)',
  hudText: '#f4efe6',
  hudMuted: '#b9b3a4',
  hudAccent: '#ffb347',
  hudGood: '#7ddc8a',
  hudBad: '#ff5a4e',
  star: '#ffd23e',
  marker: '#ffcf3d',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Story: four dawn-shift jobs for Rook Vane, cargo pilot turned smuggler. */
export const MISSIONS = [
  {
    id: 1,
    title: 'M1 — Hot Manifest',
    brief: 'The cargo office holds a manifest worth a fortune. Slip in on foot, lift it, and get back to your tug before security notices.',
    objective: 'Reach the cargo office and lift the manifest (E), then return to your tug.',
    cash: 400,
  },
  {
    id: 2,
    title: 'M2 — Borrowed Wheels',
    brief: 'The manifest names a sealed container in the yard. Take the cargo truck — it is not yours, and the alarm will say so — and haul it to Hangar 3.',
    objective: 'Steal the cargo truck (E) and drive it to Hangar 3.',
    cash: 800,
  },
  {
    id: 3,
    title: 'M3 — Runway Run',
    brief: 'Airport security is on the radio and the police are rolling. Cross Runway 1 in the open and make the east checkpoint before they box you in.',
    objective: 'Drive across Runway 1 to the east checkpoint. Wanted level 3 — they will chase.',
    cash: 1500,
  },
  {
    id: 4,
    title: 'M4 — Dawn Escape',
    brief: 'Last job of the shift. The sun is up, the whole airfield is awake, and four interceptors want your cargo. Reach the extraction gate and vanish into the dawn.',
    objective: 'Outrun the interceptors and reach the extraction gate east of the fuel farm.',
    cash: 5000,
  },
];
