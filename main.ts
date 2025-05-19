import five from "johnny-five";
import Firmata from "firmata";
import Joint, { JointToDeviceMap, MOTOR_CONFIGS } from "./lib/Joint.ts";
import { type FirmataType } from "./lib/Firmata.ts";

export const io = new Firmata("COM3") as unknown as FirmataType;

type BoardType = Omit<five.Board, "io"> & {
  io: typeof io;
};

const board: BoardType = new five.Board({ io, debug: true });

board.on("ready", function () {
  const J1 = Joint.createJoint("J1");
  const J2 = Joint.createJoint("J2");
  const J3 = Joint.createJoint("J3");
  const J4 = Joint.createJoint("J4");
  const J5 = Joint.createJoint("J5");
  // InitMotor();
  const joints = [J1, J2, J3, J4, J5];
  async function home() {
    await Promise.all([J1.home(), J2.home(), J4.home(), J5.home()]);

    await J3.home();
  }

  const s = () => {
    joints.forEach((joint) => joint.stop());
  };

  board.repl.inject({ io, J1, J2, J3, J4, J5, home, s });
});
