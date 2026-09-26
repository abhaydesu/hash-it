import React from "react";
import { IlloFrame } from "./illo-frame";
import { timing } from "./illo-utils";

function Check({ x, y, size }: { x: number; y: number; size: number }) {
  const s = size / 12;
  return (
    <>
      <rect x={x} y={y} width={size} height={size} className="fill-primary" />
      <path
        d={`M${x + 3 * s} ${y + 6 * s} l${2.5 * s} ${2.5 * s} l${4.5 * s} -${5 * s}`}
        className="fill-none stroke-primary-foreground"
        strokeWidth={1.5}
      />
    </>
  );
}

/* ── Three cadences ─────────────────────────────────────────────────────── */

const QUEUE_ROWS = [
  { w: 78, sub: 44, diff: "fill-medium", delay: -6, still: 0 },
  { w: 60, sub: 52, diff: "fill-hard", delay: -4, still: 34 },
  { w: 88, sub: 38, diff: "fill-easy", delay: -2, still: 68 },
  { w: 68, sub: 48, diff: "fill-medium", delay: 0, still: null },
];

export function DailyQueueIllo() {
  return (
    <IlloFrame label="Due problems move up the queue; the one at the front is re-solved and checked off.">
      <svg viewBox="0 0 240 124" aria-hidden="true">
        {QUEUE_ROWS.map((row, i) => (
          <g
            key={i}
            data-a="q-row"
            style={timing(8, row.delay, {
              transform: `translateY(${row.still ?? 102}px)`,
              opacity: row.still == null ? 0 : 1,
            })}
          >
            <rect x={36} y={10} width={168} height={26} className="fill-background stroke-border" strokeWidth={1.25} />
            <rect x={46} y={17} width={12} height={12} className="fill-background stroke-foreground" strokeWidth={1.25} />
            <g
              data-a="q-check"
              className="illo-fb"
              style={timing(8, row.delay, { opacity: row.still === 0 ? 1 : 0 })}
            >
              <Check x={46} y={17} size={12} />
            </g>
            <rect x={66} y={17} width={row.w} height={4} className="fill-foreground" />
            <rect x={66} y={26} width={row.sub} height={3} className="fill-border" />
            <rect x={186} y={19} width={8} height={8} className={row.diff} />
          </g>
        ))}
      </svg>
    </IlloFrame>
  );
}

const CHIPS = ["Two Ptr", "Window", "Heap"];

export function WeeklyDrillIllo() {
  const T = 6;
  return (
    <IlloFrame label="A problem cue is shown; the drill weighs each pattern and settles on sliding window.">
      <svg viewBox="0 0 240 124" aria-hidden="true">
        <rect x={28} y={8} width={184} height={50} className="fill-background stroke-foreground" strokeWidth={1.25} />
        <text x={38} y={21} fontSize={7} letterSpacing={1} className="fill-muted-foreground">CUE</text>
        <rect x={38} y={29} width={150} height={3} className="fill-border" />
        <rect x={38} y={39} width={40} height={3} className="fill-border" />
        <rect x={82} y={38} width={58} height={5} className="fill-primary/25" />
        <rect
          x={82}
          y={41}
          width={58}
          height={2}
          data-a="grow-x"
          style={timing(T)}
          className="illo-fb-left fill-primary"
        />
        <rect x={144} y={39} width={44} height={3} className="fill-border" />
        <rect x={38} y={49} width={100} height={3} className="fill-border" />
        <text x={220} y={24} fontSize={18} data-a="ask" style={timing(T)} className="fill-foreground">?</text>

        {CHIPS.map((label, i) => (
          <g key={label}>
            <rect x={28 + i * 64} y={84} width={56} height={24} className="fill-background stroke-foreground" strokeWidth={1.25} />
            <text x={56 + i * 64} y={99} fontSize={8.5} textAnchor="middle" className="fill-foreground">{label}</text>
          </g>
        ))}
        <g data-a="pick" style={timing(T)}>
          <rect x={92} y={84} width={56} height={24} className="fill-primary" />
          <text x={120} y={99} fontSize={8.5} textAnchor="middle" className="fill-primary-foreground">Window</text>
        </g>
        <rect
          x={24}
          y={80}
          width={64}
          height={32}
          data-a="scan"
          style={timing(T, 0, { transform: "translateX(64px)" })}
          className="fill-none stroke-primary"
          strokeWidth={1.5}
        />
      </svg>
    </IlloFrame>
  );
}

export function MonthlyMockIllo() {
  const T = 10;
  return (
    <IlloFrame label="A timer runs down while five blind problems are solved one by one.">
      <svg viewBox="0 0 240 124" aria-hidden="true">
        <rect x={61} y={22} width={6} height={5} className="fill-foreground" />
        <circle cx={64} cy={62} r={30} className="fill-none stroke-border" strokeWidth={3} />
        <circle
          cx={64}
          cy={62}
          r={30}
          pathLength={100}
          transform="rotate(-90 64 62)"
          data-a="timer"
          style={timing(T, 0, { strokeDasharray: 100, strokeDashoffset: 35 })}
          className="fill-none stroke-foreground"
          strokeWidth={3}
        />
        <text x={64} y={66} fontSize={10} textAnchor="middle" className="fill-muted-foreground font-mono">90m</text>

        <text x={112} y={44} fontSize={7} letterSpacing={1} className="fill-muted-foreground">BLIND SET</text>
        {[0, 1, 2, 3, 4].map((i) => {
          const x = 112 + i * 22;
          return (
            <g key={i}>
              <rect x={x} y={53} width={18} height={18} className="fill-background stroke-foreground" strokeWidth={1.25} />
              <text x={x + 9} y={65.5} fontSize={10} textAnchor="middle" className="fill-muted-foreground">?</text>
              <g
                data-a={`step-${i + 1}`}
                className="illo-fb"
                style={timing(T, 0, { opacity: i < 3 ? 1 : 0 })}
              >
                <Check x={x} y={53} size={18} />
              </g>
            </g>
          );
        })}
        <rect x={112} y={82} width={62} height={3} className="fill-border" />
      </svg>
    </IlloFrame>
  );
}
