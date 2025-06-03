import five from "johnny-five";
import Firmata from "firmata";
import Joint from "./lib/Joint.ts";
import { type FirmataType } from "./lib/Firmata.ts";
import { createKinematics } from "./lib/kinematics.ts";

export const io = new Firmata("COM3") as unknown as FirmataType;

type BoardType = Omit<five.Board, "io"> & {
  io: typeof io;
};

const board: BoardType = new five.Board({ io, debug: true });

board.on("ready", function () {
  const [J1, J2, J3, J4, J5, J6] = Joint.createAllJoints();
  const joints = [J1, J2, J3, J4, J5, J6];
  const kinematics = createKinematics();
  const tf = kinematics.forwardKinematics(joints.map((joint) => joint.Degrees));
  console.log(tf);

  board.repl.inject({ io, J1, J2, J3, J4, J5, J6, joints, kinematics });
});
