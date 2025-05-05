import five from "johnny-five";
import Firmata from "firmata";
import Joint from "./lib/Joint.ts";
import { Test } from "./tests.ts";

export const io = new Firmata("COM3");

type BoardType = Omit<five.Board, "io"> & {
  io: typeof io;
};

const board: BoardType = new five.Board({ io, debug: true });

board.on("ready", function () {
  const J1 = Joint.createJoint("J1");
  const J2 = Joint.createJoint("J2");
  board.repl.inject({ J1, J2, Test });
});
