import { Plate } from "@/components/iso/react/draw";
import "@/components/iso/iso.css";
import { QueueArt } from "./art";
import "./queue.css";

/** The review queue as a bench: a card rides a rail whose docks sit farther and farther apart. */
export function QueueFigure() {
  return (
    <div className="iso queue-fig">
      <Plate fig="" readout="Solved cold · back in 8 d">
        <QueueArt />
      </Plate>
    </div>
  );
}
