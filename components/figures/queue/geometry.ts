import { circleRing, extrude, insetPlan, knurl as knurlOf, onTop, pathOf, planOutline, radialTicks, sideArc, slabOf, type Flat, type Plan, type Plane, type Point3 } from "@/components/iso/iso-kit";
import {
  BACK_RAIL,
  BASE,
  BASE_H,
  BAR_H,
  BAR_Z,
  CARD,
  CARD_H,
  CARD_Z,
  CARRIAGE,
  CARRIAGE_H,
  CARRIAGE_TOP,
  CARRIAGE_Z,
  DAYS,
  DIAL,
  DIAL_H,
  DIAL_R,
  DOCKS,
  DOCK_H,
  FLOOR,
  FLOOR_H,
  FOOT_H,
  FRONT_RAIL,
  HOLDER,
  HOLDER_H,
  LAMP_Y,
  P,
  RAIL_H,
  at,
} from "./view";

const solid = (plan: Plan, z: number, h: number, steps = 6, bevel = 0) => slabOf(plan, z, h, P, steps, bevel);
const cylinder = (cx: number, cy: number, r: number, z: number, h: number, steps = 32) => extrude(circleRing(cx, cy, r, steps), z, h, P, { convex: true });
const ring = (cx: number, cy: number, r: number, z: number, steps = 40) => onTop(circleRing(cx, cy, r, steps), z, P, true);
const segment = (a: Point3, b: Point3) => pathOf([at(a), at(b)]);
const join = (paths: string[]) => paths.join("");
const top = (x: number, y: number, z: number): Flat => at([x, y, z]);

export const BASE_ART = {
  halo: solid(BASE, -BASE_H - FOOT_H, BASE_H).fill,
  feet: [
    [BASE.x + 18, BASE.y + 16],
    [BASE.x + BASE.w - 18, BASE.y + 16],
    [BASE.x + 18, BASE.y + BASE.d - 16],
    [BASE.x + BASE.w - 18, BASE.y + BASE.d - 16],
  ].map(([x, y]) => [cylinder(x!, y!, 7, -BASE_H - FOOT_H, 1.6), cylinder(x!, y!, 5.5, -BASE_H - FOOT_H + 1.6, FOOT_H - 1.6)]),
  slab: solid(BASE, -BASE_H, BASE_H, 8, 1.6),
  groove: planOutline(insetPlan(BASE, 4.5), 0, P),
};

const BASE_SCREWS: Plane[] = [
  [BASE.x + 8, BASE.y + 8],
  [BASE.x + BASE.w - 8, BASE.y + 8],
  [BASE.x + 8, BASE.y + BASE.d - 8],
  [BASE.x + BASE.w - 8, BASE.y + BASE.d - 8],
];

const PLATE: Plan = { x: 150, y: 31.5, w: 46, d: 6.5, r: 1.5 };

export const BASE_DETAIL = {
  screws: BASE_SCREWS.map(([x, y]) => top(x, y, 0)),
  screwRings: join(BASE_SCREWS.map(([x, y]) => ring(x, y, 2.2, 0, 16))),
  plate: solid(PLATE, 0, 0.8, 4),
  plateLine: planOutline(insetPlan(PLATE, 1.3), 0.8, P),
  plateScrews: [top(PLATE.x + 3, PLATE.y + PLATE.d / 2, 0.8), top(PLATE.x + PLATE.w - 3, PLATE.y + PLATE.d / 2, 0.8)],
  plateRule: join([0, 1, 2].map((row) => onTop([[PLATE.x + 7, PLATE.y + 2 + row * 1.25], [PLATE.x + (row === 1 ? 30 : 40), PLATE.y + 2 + row * 1.25]], 0.8, P))),
};

/* Lamp row in front of the front rail: one pilot lamp per dock. */
export const LAMPS = DOCKS.map((x) => ({
  body: cylinder(x, LAMP_Y, 2.6, 0, 2.4, 20),
  ring: ring(x, LAMP_Y, 1.4, 2.4, 16),
}));

const stopPlans = (rail: Plan, x: number): Plan => ({ x, y: rail.y, w: 4, d: rail.d, r: 0.8 });
const LEFT_X = -17;
const RIGHT_X = DOCKS[DOCKS.length - 1]! + CARRIAGE.w / 2 + 2;
const STOP_H = 4.5;

function railDetail(rail: Plan) {
  return {
    body: solid(rail, 0, RAIL_H, 4, 0.8),
    groove: planOutline(insetPlan(rail, 1.7), RAIL_H, P),
    screws: [rail.x + 6, rail.x + rail.w - 6].map((x) => top(x, rail.y + rail.d / 2, RAIL_H)),
  };
}

export const BACK_ART = {
  rail: railDetail(BACK_RAIL),
  stops: [LEFT_X, RIGHT_X].map((x) => solid(stopPlans(BACK_RAIL, x), RAIL_H, STOP_H, 3, 0.6)),
  stopScrews: [LEFT_X, RIGHT_X].map((x) => top(x + 2, BACK_RAIL.y + BACK_RAIL.d / 2, RAIL_H + STOP_H)),
};

/* Ruler on the front rail: a tick every 5, longer every 20, and a deep mark at each dock. */
function ruler() {
  const edge = FRONT_RAIL.y + FRONT_RAIL.d;
  const z = RAIL_H;
  const minor: string[] = [];
  const major: string[] = [];
  const marks: string[] = [];
  for (let x = -10; x <= 190; x += 5) {
    if (DOCKS.includes(x)) continue;
    (x % 20 === 0 ? major : minor).push(segment([x, edge, z], [x, edge - (x % 20 === 0 ? 3 : 1.8), z]));
  }
  for (const x of DOCKS) marks.push(segment([x, edge, z], [x, edge - 4.6, z]));
  return { minor: join(minor), major: join(major), marks: join(marks) };
}

const RULER = ruler();

export const FRONT_ART = {
  rail: railDetail(FRONT_RAIL),
  ruler: RULER,
  stops: [LEFT_X, RIGHT_X].map((x) => solid(stopPlans(FRONT_RAIL, x), RAIL_H, STOP_H, 3, 0.6)),
  stopScrews: [LEFT_X, RIGHT_X].map((x) => top(x + 2, FRONT_RAIL.y + FRONT_RAIL.d / 2, RAIL_H + STOP_H)),
};

/* The channel: floor inlay, a dock under each stop with its punched number, the lead bar. */
const DOCK_PLANS: Plan[] = DOCKS.map((x) => ({ x: x - 9, y: -12, w: 18, d: 24, r: 2 }));

export const FLOOR_ART = {
  floor: solid(FLOOR, 0, FLOOR_H, 2),
  floorLine: planOutline(insetPlan(FLOOR, 1.6), FLOOR_H, P, 2),
  docks: DOCK_PLANS.map((plan, index) => ({
    body: solid(plan, FLOOR_H, DOCK_H, 4, 0.4),
    inset: planOutline(insetPlan(plan, 2.2), FLOOR_H + DOCK_H, P),
    punches: Array.from({ length: index + 1 }, (_, k) => top(DOCKS[index]! - (index * 3.2) / 2 + k * 3.2, 8.4, FLOOR_H + DOCK_H)),
    notch: segment([DOCKS[index]!, -9.6, FLOOR_H + DOCK_H], [DOCKS[index]!, -6, FLOOR_H + DOCK_H]),
  })),
};

const BAR: Plan = { x: -17, y: -1.5, w: 208, d: 3, r: 0.8 };
const THREADS = (() => {
  const lines: string[] = [];
  for (let x = -12; x <= 188; x += 3) lines.push(onTop([[x, -1.5], [x, 1.5]], BAR_Z + BAR_H, P));
  return join(lines);
})();

export const BAR_ART = {
  bar: solid(BAR, BAR_Z, BAR_H, 3, 0.4),
  threads: THREADS,
};

/* Thumb wheel at the rail's left end: it turns the lead bar. */
const WHEEL: Flat = [-22.5, 0];
export const WHEEL_ART = {
  post: cylinder(WHEEL[0], WHEEL[1], 2.4, 0, 6.8, 20),
  wheel: cylinder(WHEEL[0], WHEEL[1], 6.4, 6.8, 3.2, 32),
  knurl: knurlOf(WHEEL[0], WHEEL[1], 6.4, 6.8, 10, 28, P),
  face: ring(WHEEL[0], WHEEL[1], 4.6, 10, 28),
  index: onTop([[WHEEL[0] + 1.2, WHEEL[1] - 1.2], [WHEEL[0] + 4.4, WHEEL[1] - 4.4]], 10, P),
  cap: [top(WHEEL[0], WHEEL[1], 10)],
};

/* The carriage: rides the rails, holds the card, and points at the ruler. */
const TAB: Plan = { x: -1.3, y: CARRIAGE.y + CARRIAGE.d, w: 2.6, d: 6, r: 0.5 };
const TAB_Z = RAIL_H;
const SEAT: Plan = { x: -11, y: -17, w: 22, d: 34, r: 3 };

export const CARRIAGE_ART = {
  halo: solid(insetPlan(CARRIAGE, 3), RAIL_H - 0.4, 0.1).fill,
  plate: solid(CARRIAGE, CARRIAGE_Z, CARRIAGE_H, 6, 0.8),
  seat: planOutline(SEAT, CARRIAGE_TOP, P, 6),
  seatInner: planOutline(insetPlan(SEAT, 2), CARRIAGE_TOP, P, 6),
  screws: [
    [CARRIAGE.x + 4, CARRIAGE.y + 4],
    [CARRIAGE.x + CARRIAGE.w - 4, CARRIAGE.y + 4],
    [CARRIAGE.x + 4, CARRIAGE.y + CARRIAGE.d - 4],
    [CARRIAGE.x + CARRIAGE.w - 4, CARRIAGE.y + CARRIAGE.d - 4],
  ].map(([x, y]) => top(x!, y!, CARRIAGE_TOP)),
  screwRings: join(
    [
      [CARRIAGE.x + 4, CARRIAGE.y + 4],
      [CARRIAGE.x + CARRIAGE.w - 4, CARRIAGE.y + 4],
      [CARRIAGE.x + 4, CARRIAGE.y + CARRIAGE.d - 4],
      [CARRIAGE.x + CARRIAGE.w - 4, CARRIAGE.y + CARRIAGE.d - 4],
    ].map(([x, y]) => ring(x!, y!, 1.5, CARRIAGE_TOP, 12)),
  ),
  /* the front face of the plate: one seam, edge to edge */
  seam: segment([CARRIAGE.x + 3, CARRIAGE.y + CARRIAGE.d, CARRIAGE_Z + 1.8], [CARRIAGE.x + CARRIAGE.w - 3, CARRIAGE.y + CARRIAGE.d, CARRIAGE_Z + 1.8]),
  holder: solid(HOLDER, CARRIAGE_TOP, HOLDER_H, 4, 0.5),
  holderSeam: segment([HOLDER.x + 1.2, HOLDER.y + HOLDER.d, CARRIAGE_TOP + 1.7], [HOLDER.x + HOLDER.w - 1.2, HOLDER.y + HOLDER.d, CARRIAGE_TOP + 1.7]),
  holderScrews: [-9.2, 9.2].map((x) => top(x, 2.1, CARRIAGE_TOP + HOLDER_H)),
  tab: solid(TAB, TAB_Z, 2, 3, 0.2),
  tabIndex: onTop([[0, TAB.y + 0.6], [0, TAB.y + TAB.d - 0.4]], TAB_Z + 2, P),
  pointerLine: onTop([[0, 17], [0, CARRIAGE.y + CARRIAGE.d]], CARRIAGE_TOP, P),
};

/* The card: the one lit part. Its printed lines sit on the face toward the viewer. */
const FACE = CARD.y + CARD.d;
const face = (x0: number, x1: number, z: number) => segment([x0, FACE, z], [x1, FACE, z]);

export const CARD_ART = {
  card: solid(CARD, CARD_Z, CARD_H, 3, 0.4),
  head: face(-8.4, 1.4, CARD_Z + CARD_H - 4.6),
  rules: join([
    face(-8.4, 8.4, CARD_Z + CARD_H - 10),
    face(-8.4, 5.8, CARD_Z + CARD_H - 14),
    face(-8.4, 7.2, CARD_Z + CARD_H - 18),
    face(-8.4, 3.6, CARD_Z + CARD_H - 22),
    face(-8.4, 6.4, CARD_Z + CARD_H - 26),
  ]),
  box: pathOf(
    [
      at([5.2, FACE, CARD_Z + CARD_H - 2.8]),
      at([8.4, FACE, CARD_Z + CARD_H - 2.8]),
      at([8.4, FACE, CARD_Z + CARD_H - 6]),
      at([5.2, FACE, CARD_Z + CARD_H - 6]),
    ],
    true,
  ),
  edge: segment([CARD.x + CARD.w - 0.6, FACE, CARD_Z + 1], [CARD.x + CARD.w - 0.6, FACE, CARD_Z + CARD_H - 1]),
};

/* Dial gauge on the base at the rail's far end: a log scale of days. */
const DIAL_Z = DIAL_H;
const DIAL_FROM = Math.PI * 1.25;
const DIAL_SPAN = Math.PI * 1.5;
const DIAL_SCALE = Math.log(DAYS[DAYS.length - 1]!);
const dialAngle = (days: number) => DIAL_FROM + (Math.log(days) / DIAL_SCALE) * DIAL_SPAN;
const TICKS = radialTicks(DIAL[0], DIAL[1], DIAL_R - 2.2, 18, 3, DIAL_Z, [1.2, 2.2], P, DIAL_FROM, DIAL_SPAN);

export const DIAL_ART = {
  puck: cylinder(DIAL[0], DIAL[1], DIAL_R, 0, DIAL_H, 40),
  band: join([1.6, 3.4].map((z) => sideArc(DIAL[0], DIAL[1], DIAL_R, z, P, 28))),
  knurl: knurlOf(DIAL[0], DIAL[1], DIAL_R, 0.8, DIAL_H - 0.8, 44, P),
  bezel: ring(DIAL[0], DIAL[1], DIAL_R - 1, DIAL_Z, 44),
  face: ring(DIAL[0], DIAL[1], DIAL_R - 2.6, DIAL_Z, 44),
  minor: TICKS.minor,
  major: TICKS.major,
  marks: DAYS.map((days) => {
    const a = dialAngle(days);
    return top(DIAL[0] + Math.sin(a) * (DIAL_R - 5), DIAL[1] - Math.cos(a) * (DIAL_R - 5), DIAL_Z);
  }),
  hub: [top(DIAL[0], DIAL[1], DIAL_Z)],
};

/** The needle for a given interval in days (any real number from 1 to 50). */
export function needleAt(days: number) {
  const a = dialAngle(Math.min(Math.max(days, 1), DAYS[DAYS.length - 1]!));
  const sx = Math.sin(a);
  const sy = -Math.cos(a);
  const reach = DIAL_R - 3.4;
  return onTop([[DIAL[0] - sx * 2, DIAL[1] - sy * 2], [DIAL[0] + sx * reach, DIAL[1] + sy * reach]], DIAL_Z, P);
}

/** Interval in days at a carriage position `x` (between docks it slides along the log scale). */
export function daysAt(x: number) {
  const last = DOCKS.length - 1;
  const clamped = Math.min(Math.max(x, DOCKS[0]!), DOCKS[last]!);
  let i = 0;
  while (i < last - 1 && clamped > DOCKS[i + 1]!) i++;
  const t = (clamped - DOCKS[i]!) / (DOCKS[i + 1]! - DOCKS[i]!);
  return Math.exp(Math.log(DAYS[i]!) + t * (Math.log(DAYS[i + 1]!) - Math.log(DAYS[i]!)));
}
