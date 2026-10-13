import * as React from "react";
import { Dots, Line, Solid } from "@/components/iso/react/draw";
import { BACK_ART, BAR_ART, BASE_ART, BASE_DETAIL, CARD_ART, CARRIAGE_ART, DIAL_ART, FLOOR_ART, FRONT_ART, LAMPS, WHEEL_ART } from "./geometry";
import { QueueLive } from "./live";

const BASE = (
  <g key="base">
    <path className="iso-halo" d={BASE_ART.halo} />
    {BASE_ART.feet.map((parts, index) => (
      <g key={index}>
        {parts.map((paths, part) => (
          <Solid key={part} paths={paths} tone={part ? "mid" : "lo"} crease="faint" />
        ))}
      </g>
    ))}
    <Solid paths={BASE_ART.slab} tone="mid" crease="faint" />
    <Line d={BASE_ART.groove} tone="lo" />
    <Line d={BASE_DETAIL.screwRings} tone="lo" />
    <Dots points={BASE_DETAIL.screws} size={0.5} tone="mid" />
    <Solid paths={BASE_DETAIL.plate} tone="lo" crease="none" />
    <Line d={BASE_DETAIL.plateLine} tone="faint" />
    <Line d={BASE_DETAIL.plateRule} tone="lo" />
    <Dots points={BASE_DETAIL.plateScrews} size={0.45} tone="mid" />
  </g>
);

const LAMP_ROW = (
  <g key="lamps">
    {LAMPS.map((lamp, index) => (
      <g key={index}>
        <Solid paths={lamp.body} tone="mid" crease="faint" className="queue-lamp" />
        <Line d={lamp.ring} tone="lo" />
      </g>
    ))}
  </g>
);

const BACK_RAIL = (
  <g key="back-rail">
    <Solid paths={BACK_ART.rail.body} tone="mid" crease="faint" />
    <Line d={BACK_ART.rail.groove} tone="faint" />
    <Dots points={BACK_ART.rail.screws} size={0.5} tone="mid" />
    {BACK_ART.stops.map((paths, index) => (
      <Solid key={index} paths={paths} tone="mid" crease="faint" />
    ))}
    <Dots points={BACK_ART.stopScrews} size={0.45} tone="mid" />
  </g>
);

const WHEEL = (
  <g key="wheel">
    <Solid paths={WHEEL_ART.post} tone="lo" crease="faint" />
    <Solid paths={WHEEL_ART.wheel} tone="mid" crease="faint" />
    <Line d={WHEEL_ART.knurl} tone="faint" />
    <Line d={WHEEL_ART.face} tone="lo" />
    <Line d={WHEEL_ART.index} tone="hi" />
    <Dots points={WHEEL_ART.cap} size={0.55} tone="hi" />
  </g>
);

const CHANNEL = (
  <g key="channel">
    <Solid paths={FLOOR_ART.floor} tone="lo" crease="none" flat />
    <Line d={FLOOR_ART.floorLine} tone="faint" />
    {FLOOR_ART.docks.map((dock, index) => (
      <g key={index}>
        <Solid paths={dock.body} tone="mid" crease="faint" />
        <Line d={dock.inset} tone="faint" />
        <Line d={dock.notch} tone="lo" />
        <Dots points={dock.punches} size={0.55} tone="hi" />
      </g>
    ))}
    <Solid paths={BAR_ART.bar} tone="mid" crease="faint" />
    <Line d={BAR_ART.threads} tone="lo" />
  </g>
);

const FRONT_RAIL = (
  <g key="front-rail">
    <Solid paths={FRONT_ART.rail.body} tone="mid" crease="faint" />
    <Line d={FRONT_ART.rail.groove} tone="faint" />
    <Line d={FRONT_ART.ruler.minor} tone="lo" />
    <Line d={FRONT_ART.ruler.major} tone="mid" />
    <Line d={FRONT_ART.ruler.marks} tone="hi" />
    <Dots points={FRONT_ART.rail.screws} size={0.5} tone="mid" />
  </g>
);

const CARRIAGE_BODY = (
  <g key="carriage-body">
    <path className="iso-halo queue-shadow" d={CARRIAGE_ART.halo} />
    <Solid paths={CARRIAGE_ART.plate} tone="mid" crease="faint" />
    <Line d={CARRIAGE_ART.seat} tone="lo" />
    <Line d={CARRIAGE_ART.seatInner} tone="faint" />
    <Line d={CARRIAGE_ART.screwRings} tone="lo" />
    <Dots points={CARRIAGE_ART.screws} size={0.45} tone="mid" />
    <Line d={CARRIAGE_ART.seam} tone="faint" />
    <Line d={CARRIAGE_ART.pointerLine} tone="lo" />
    <Solid paths={CARRIAGE_ART.holder} tone="mid" crease="faint" />
    <Line d={CARRIAGE_ART.holderSeam} tone="faint" />
  </g>
);

const CARD = (
  <g key="card">
    <Solid paths={CARD_ART.card} tone="hi" crease="faint" lit />
    <Line d={CARD_ART.head} tone="hi" free />
    <Line d={CARD_ART.rules} tone="lo" free />
    <Line d={CARD_ART.box} tone="mid" />
    <Line d={CARD_ART.edge} tone="faint" free />
  </g>
);

const CARRIAGE_FRONT = (
  <g key="carriage-front">
    <Dots points={CARRIAGE_ART.holderScrews} size={0.45} tone="mid" />
    <Solid paths={CARRIAGE_ART.tab} tone="hi" crease="faint" lit />
    <Line d={CARRIAGE_ART.tabIndex} tone="lit" />
  </g>
);

const FRONT_STOPS = (
  <g key="front-stops">
    {FRONT_ART.stops.map((paths, index) => (
      <Solid key={index} paths={paths} tone="mid" crease="faint" />
    ))}
    <Dots points={FRONT_ART.stopScrews} size={0.45} tone="mid" />
  </g>
);

const DIAL = (
  <g key="dial">
    <Solid paths={DIAL_ART.puck} tone="mid" crease="faint" />
    <Line d={DIAL_ART.band} tone="faint" />
    <Line d={DIAL_ART.knurl} tone="faint" />
    <Line d={DIAL_ART.bezel} tone="lo" />
    <Line d={DIAL_ART.face} tone="faint" />
    <Line d={DIAL_ART.minor} tone="lo" />
    <Line d={DIAL_ART.major} tone="mid" />
    <Dots points={DIAL_ART.marks} size={0.55} tone="hi" />
  </g>
);

const HUB = (
  <g key="hub">
    <Dots points={DIAL_ART.hub} size={0.9} tone="hi" />
  </g>
);

const LABEL =
  "A bench for spaced review. A problem card stands in a holder on a carriage that rides two rails over a lead bar. Five docks sit along the rail, each farther from the last: one, three, eight, twenty and fifty days. Solve the card cold and the carriage moves on to the next dock; struggle and it slides back one. A dial gauge at the end reads the wait in days on a log scale, and a pilot lamp behind the rail lights at the current dock.";

export function QueueArt() {
  return (
    <QueueLive
      label={LABEL}
      base={BASE}
      lamps={LAMP_ROW}
      backRail={BACK_RAIL}
      wheel={WHEEL}
      channel={CHANNEL}
      frontRail={FRONT_RAIL}
      carriageBody={CARRIAGE_BODY}
      card={CARD}
      carriageFront={CARRIAGE_FRONT}
      frontStops={FRONT_STOPS}
      dial={DIAL}
      hub={HUB}
    />
  );
}
