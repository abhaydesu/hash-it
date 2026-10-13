"use client";

import * as React from "react";
import { IsoFigure } from "@/components/iso/react/draw";
import { spring, useInView, useLoop, useReadout, type Spring } from "@/components/iso/react/live";
import { translateAlong } from "@/components/iso/iso-kit";
import { daysAt, needleAt } from "./geometry";
import { DAYS, DOCKS, DOCK_COUNT, HEIGHT, P, REST_DOCK, WIDTH, at } from "./view";

/** The idle tour: solve, solve, solve, struggle (back one), solve, solve, then a new card. */
const TOUR = [0, 1, 2, 3, 2, 3, 4];
const DWELL = 1.15;
const FIRST_AFTER = 1.4;
const RESUME_AFTER = 3.6;

const nearest = (x: number) => DOCKS.reduce((best, dock, index) => (Math.abs(dock - x) < Math.abs(DOCKS[best]! - x) ? index : best), 0);
const plural = (days: number) => `${days} ${days === 1 ? "day" : "days"}`;

function sayOf(dock: number, moved: number) {
  const days = DAYS[dock]!;
  if (dock === 0) return `New card · back in ${days} d`;
  return `${moved < 0 ? "Struggled" : "Solved cold"} · back in ${days} d`;
}

interface Props {
  label: string;
  base: React.ReactNode;
  lamps: React.ReactNode;
  backRail: React.ReactNode;
  wheel: React.ReactNode;
  channel: React.ReactNode;
  frontRail: React.ReactNode;
  carriageBody: React.ReactNode;
  card: React.ReactNode;
  carriageFront: React.ReactNode;
  frontStops: React.ReactNode;
  dial: React.ReactNode;
  hub: React.ReactNode;
}

export function QueueLive({ label, base, lamps, backRail, wheel, channel, frontRail, carriageBody, card, carriageFront, frontStops, dial, hub }: Props) {
  const root = React.useRef<HTMLDivElement>(null);
  const carriage = React.useRef<SVGGElement>(null);
  const needle = React.useRef<SVGPathElement>(null);
  const { anchor, say } = useReadout<HTMLDivElement>();
  const inView = useInView(root);

  const state = React.useRef({
    x: { at: DOCKS[REST_DOCK]!, rate: 0 } as Spring,
    target: REST_DOCK,
    moved: 1,
    tour: TOUR.indexOf(REST_DOCK),
    clock: 0,
    idle: RESUME_AFTER - FIRST_AFTER,
    hovering: false,
    lit: -1,
  });

  const paint = React.useCallback(() => {
    const s = state.current;
    const x = s.x.at;
    carriage.current?.setAttribute("transform", translateAlong(P, [x, 0, 0]));
    needle.current?.setAttribute("d", needleAt(daysAt(x)));
    const dock = nearest(x);
    if (dock !== s.lit) {
      s.lit = dock;
      root.current?.querySelectorAll(".queue-lamp").forEach((lamp, index) => (index === dock ? lamp.setAttribute("data-lit", "") : lamp.removeAttribute("data-lit")));
      say(sayOf(dock, s.moved));
      root.current?.setAttribute("aria-valuenow", String(dock + 1));
      root.current?.setAttribute("aria-valuetext", `Review ${dock + 1} of ${DOCK_COUNT}: back in ${plural(DAYS[dock]!)}`);
    }
  }, [say]);

  const go = React.useCallback((dock: number) => {
    const s = state.current;
    const next = Math.min(Math.max(dock, 0), DOCK_COUNT - 1);
    if (next === s.target) return;
    s.moved = next - s.target;
    s.target = next;
    s.tour = Math.max(TOUR.indexOf(next), 0);
    s.clock = 0;
  }, []);

  const kick = useLoop(
    (dt, still) => {
      const s = state.current;
      if (!still) {
        s.idle = s.hovering ? 0 : s.idle + dt;
        if (s.idle >= RESUME_AFTER) {
          s.clock += dt;
          if (s.clock >= DWELL) {
            s.clock = 0;
            s.tour = (s.tour + 1) % TOUR.length;
            const next = TOUR[s.tour]!;
            s.moved = next === 0 ? 0 : next - s.target;
            s.target = next;
          }
        }
      }
      const settled = spring(s.x, DOCKS[s.target]!, dt, 70, 13, still);
      paint();
      return !settled || (!still && inView);
    },
    inView,
  );

  React.useEffect(() => {
    paint();
  }, [paint]);

  const touch = React.useCallback(() => {
    state.current.idle = 0;
    kick();
  }, [kick]);

  const aim = (event: React.PointerEvent) => {
    const svg = root.current?.querySelector("svg");
    if (!svg) return;
    const box = svg.getBoundingClientRect();
    const px = ((event.clientX - box.left) / box.width) * WIDTH;
    let best = 0;
    DOCKS.forEach((dock, index) => {
      if (Math.abs(at([dock, 0, 0])[0] - px) < Math.abs(at([DOCKS[best]!, 0, 0])[0] - px)) best = index;
    });
    go(best);
    touch();
  };

  const key = (event: React.KeyboardEvent) => {
    const s = state.current;
    const jump: Record<string, number> = { ArrowRight: s.target + 1, ArrowUp: s.target + 1, ArrowLeft: s.target - 1, ArrowDown: s.target - 1, Home: 0, End: DOCK_COUNT - 1 };
    const next = jump[event.key];
    if (next === undefined) return;
    event.preventDefault();
    go(next);
    touch();
  };

  return (
    <div
      ref={(node) => {
        root.current = node;
        (anchor as React.MutableRefObject<HTMLDivElement | null>).current = node;
      }}
      className="queue"
      role="slider"
      tabIndex={0}
      aria-label={label}
      aria-orientation="horizontal"
      aria-valuemin={1}
      aria-valuemax={DOCK_COUNT}
      aria-valuenow={REST_DOCK + 1}
      aria-valuetext={`Review ${REST_DOCK + 1} of ${DOCK_COUNT}: back in ${plural(DAYS[REST_DOCK]!)}`}
      onKeyDown={key}
      onPointerEnter={(event) => {
        state.current.hovering = true;
        aim(event);
      }}
      onPointerMove={aim}
      onPointerDown={aim}
      onPointerLeave={() => {
        state.current.hovering = false;
        state.current.idle = 0;
        kick();
      }}
    >
      <IsoFigure width={WIDTH} height={HEIGHT} label={label}>
        {base}
        {backRail}
        {wheel}
        {channel}
        {frontRail}
        <g ref={carriage}>
          {carriageBody}
          {card}
          {carriageFront}
        </g>
        {frontStops}
        {lamps}
        {dial}
        <path ref={needle} className="iso-line queue-needle" data-tone="lit" d={needleAt(DAYS[REST_DOCK]!)} />
        {hub}
      </IsoFigure>
    </div>
  );
}
