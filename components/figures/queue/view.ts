import { fitProjection, iso, type Plan, type Point3, type Projection } from "@/components/iso/iso-kit";

export const WIDTH = 380;
export const HEIGHT = 268;
export const AZIMUTH = 42;

/** Days until the next review at each dock: each step is a longer wait. */
export const DAYS = [1, 3, 8, 20, 50];
/** Where each dock sits along the rail. Gaps widen: 16, 26, 40, 58. */
export const DOCKS = [0, 16, 42, 82, 140];
export const DOCK_COUNT = DOCKS.length;
export const REST_DOCK = 2;

export const BASE: Plan = { x: -34, y: -40, w: 258, d: 80, r: 8 };
export const BASE_H = 8;
export const FOOT_H = 4;

export const RAIL_X = -18;
export const RAIL_W = 214;
export const RAIL_H = 9;
export const BACK_RAIL: Plan = { x: RAIL_X, y: -24, w: RAIL_W, d: 9, r: 2 };
export const FRONT_RAIL: Plan = { x: RAIL_X, y: 15, w: RAIL_W, d: 13, r: 2 };

export const FLOOR: Plan = { x: -16, y: -15, w: 210, d: 30, r: 0 };
export const FLOOR_H = 0.8;
export const DOCK_H = 0.8;

export const BAR_Z = FLOOR_H + DOCK_H;
export const BAR_H = 2.4;

export const CARRIAGE: Plan = { x: -14, y: -22, w: 28, d: 44, r: 3 };
export const CARRIAGE_Z = RAIL_H;
export const CARRIAGE_H = 3.5;
export const CARRIAGE_TOP = CARRIAGE_Z + CARRIAGE_H;

export const HOLDER: Plan = { x: -12, y: -3, w: 24, d: 6, r: 1.2 };
export const HOLDER_H = 3.5;
export const CARD: Plan = { x: -11, y: -1, w: 22, d: 2, r: 0.6 };
export const CARD_Z = CARRIAGE_TOP + HOLDER_H;
export const CARD_H = 32;
export const CARD_TOP = CARD_Z + CARD_H;

export const DIAL: [number, number] = [209, 0];
export const DIAL_R = 12;
export const DIAL_H = 7;

export const LAMP_Y = 34.5;

function corners({ x, y, w, d }: Plan, z0: number, z1: number): Point3[] {
  const out: Point3[] = [];
  for (const px of [x, x + w]) for (const py of [y, y + d]) for (const z of [z0, z1]) out.push([px, py, z]);
  return out;
}

const LAST = DOCKS[DOCK_COUNT - 1]!;

export const P: Projection = fitProjection(
  [
    ...corners(BASE, -BASE_H - FOOT_H, 0),
    ...corners({ ...CARRIAGE, x: CARRIAGE.x + LAST }, 0, CARD_TOP + 1),
    ...corners({ ...CARRIAGE, x: CARRIAGE.x }, 0, CARD_TOP + 1),
  ],
  WIDTH,
  HEIGHT,
  { pad: 14, azimuth: AZIMUTH },
);

export const at = (point: Point3) => iso(point, P);
