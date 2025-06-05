import five from "johnny-five";
import Firmata from "firmata";
import { type FirmataType } from "./lib/Firmata.ts";
import { Robot } from "./lib/robot.ts";
import { Kinematics } from "./lib/kinematics.ts";

export const io = new Firmata("COM3") as unknown as FirmataType;

type BoardType = Omit<five.Board, "io"> & {
  io: typeof io;
};

const board: BoardType = new five.Board({ io, debug: true });

board.on("ready", function () {
  const robot = new Robot();
  const kinematics = robot.kinematics;
  board.repl.inject({
    robot,
    s: () => {
      robot.halt();
    },
    kinematics,
    Kinematics,
  });
});
