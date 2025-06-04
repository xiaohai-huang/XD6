import five from "johnny-five";
import Firmata from "firmata";
import Joint from "./lib/Joint.ts";
import { type FirmataType } from "./lib/Firmata.ts";
import { createKinematics, Kinematics } from "./lib/kinematics.ts";

export const io = new Firmata("COM3") as unknown as FirmataType;

type BoardType = Omit<five.Board, "io"> & {
  io: typeof io;
};

const board: BoardType = new five.Board({ io, debug: true });

board.on("ready", function () {
  const [J1, J2, J3, J4, J5, J6] = Joint.createAllJoints();
  const joints = [J1, J2, J3, J4, J5, J6];
  const kinematics = createKinematics();
  const fk = () =>
    Kinematics.extractHomogeneousMatrix(
      kinematics.forwardKinematics(joints.map((joint) => joint.Degrees))
    );

  type InverseKinematicsArgs = Parameters<typeof kinematics.inverseKinematics>;

  const ik = (...args: InverseKinematicsArgs) => {
    const angles = kinematics.inverseKinematics(...args);
    console.log(angles);
    joints.forEach((joint, index) => {
      joint.rotateTo(angles[index]);
    });
  };
  // ik(335, 0, 480, 0, -180, 0,"F");
  board.repl.inject({
    io,
    J1,
    J2,
    J3,
    J4,
    J5,
    J6,
    joints,
    kinematics,
    s: Joint.stopAll,
    Joint,
    fk,
    ik,
  });
});
