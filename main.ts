import five from "johnny-five";
import Firmata from "firmata";
import Joint, { JointToDeviceMap, MOTOR_CONFIGS } from "./lib/Joint.ts";
import { type FirmataType } from "./lib/Firmata.ts";

export const io = new Firmata("COM3") as unknown as FirmataType;

type BoardType = Omit<five.Board, "io"> & {
  io: typeof io;
};

const board: BoardType = new five.Board({ io, debug: true });

const joint = "J3";
const deviceNum = JointToDeviceMap[joint];
function InitMotor() {
  io.accelStepperConfig({
    deviceNum,
    type: io.STEPPER.TYPE.DRIVER,
    stepPin: MOTOR_CONFIGS[joint].STEP_PIN,
    directionPin: MOTOR_CONFIGS[joint].DIR_PIN,
  });
  console.log(MOTOR_CONFIGS[joint]);

  io.accelStepperSpeed(deviceNum, 1600);
  io.accelStepperAcceleration(deviceNum, 400);
}

function s() {
  io.accelStepperStop(deviceNum);
}

function step(steps: number) {
  io.accelStepperStep(deviceNum, steps, () => {
    console.log(`done stepping ${joint} for ${steps} steps`);
  });
}

board.on("ready", function () {
  // const J1 = Joint.createJoint("J1");
  // const J2 = Joint.createJoint("J2");
  const J3 = Joint.createJoint("J3");
  const J4 = Joint.createJoint("J4");
  const J5 = Joint.createJoint("J5");
  // InitMotor();

  board.repl.inject({ step, s, io, J3, J4, J5 });
});
