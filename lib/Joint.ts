import { io } from "../main.ts";

// Mapping of joint names (J1 - J6) to device numbers in accelStepper
const jointToDeviceMap = {
  J1: 0,
  J2: 1,
  J3: 2,
  J4: 3,
  J5: 4,
  J6: 5,
};

type JointName = keyof typeof jointToDeviceMap;

type MotorConfig = {
  NAME: string;
  STEP_PIN: number;
  DIR_PIN: number;
  HOME_SWITCH_PIN: number;
  STEPS_PER_REV: number;
  MAX_ACCELERATION: number;
  MAX_SPEED: number;
};

export const MOTOR_CONFIGS: Record<string, MotorConfig> = {
  J2: {
    NAME: "J2",
    STEP_PIN: 27,
    DIR_PIN: 28,
    HOME_SWITCH_PIN: 26,
    STEPS_PER_REV: 400 * 50,
    MAX_ACCELERATION: 500,
    MAX_SPEED: 1500,
  },
};

export default class Joint {
  private deviceNum: number;
  private stepsPerRev: number;

  constructor(config: MotorConfig) {
    this.deviceNum = jointToDeviceMap[config.NAME];
    this.stepsPerRev = config.STEPS_PER_REV;

    io.accelStepperConfig({
      deviceNum: this.deviceNum,
      type: io.STEPPER.TYPE.DRIVER,
      stepPin: config.STEP_PIN,
      directionPin: config.DIR_PIN,
    });

    this.setSpeed(config.MAX_SPEED);
    this.setAcceleration(config.MAX_ACCELERATION);
  }

  static createJoint(name: JointName): Joint {
    const config = MOTOR_CONFIGS[name];
    if (!config) {
      throw new Error(`Motor configuration for ${name} not found.`);
    }
    return new Joint(config);
  }

  setSpeed(speed: number) {
    io.accelStepperSpeed(this.deviceNum, speed);
  }

  setAcceleration(acceleration: number) {
    io.accelStepperAcceleration(this.deviceNum, acceleration);
  }

  step(steps: number, callback: any) {
    io.accelStepperStep(this.deviceNum, steps, callback);
  }

  rotateDegrees(degrees: number, callback: any) {
    const steps = Math.round((degrees / 360) * this.stepsPerRev);
    this.step(steps, callback);
  }
}
