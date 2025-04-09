import { io } from "../main.ts";
import five from "johnny-five";

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
  private homeSwitch: five.Button;
  private isHoming: boolean = false;
  private homeSwitchActivate: boolean = false;
  private homed: boolean = false;
  public get Homed() {
    return this.homed;
  }
  private name: string;
  public get Name() {
    return this.name;
  }

  constructor(config: MotorConfig) {
    this.name = config.NAME;
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

    this.homeSwitch = new five.Button({
      pin: config.HOME_SWITCH_PIN,
      isPullup: true,
      invert: false,
    });

    this.homeSwitch.on("press", this.onHomeSwitchActivate.bind(this));
    this.homeSwitch.on("release", this.onHomeSwitchDeactivate.bind(this));
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

  private ensureHomed() {
    // special case
    if (this.isHoming) return;
    if (!this.homed) {
      throw new Error(
        `Joint ${this.Name} must be homed before performing this action.`
      );
    }
  }

  step(steps: number, callback = () => {}) {
    this.ensureHomed();
    io.accelStepperStep(this.deviceNum, steps, callback);
  }

  stepTo(position: number, callback = () => {}) {
    this.ensureHomed();
    io.accelStepperTo(this.deviceNum, position, callback);
  }

  rotateDegrees(degrees: number, callback = () => {}) {
    this.ensureHomed();
    const steps = Math.round((degrees / 360) * this.stepsPerRev);
    this.step(steps, () => {
      callback();
    });
  }

  rotateToDegrees(degrees: number, callback = () => {}) {
    this.ensureHomed();
    const steps = Math.round((degrees / 360) * this.stepsPerRev);
    this.stepTo(steps, callback);
  }

  home(onSuccess = () => {}) {
    this.isHoming = true;

    this.rotateToDegrees(-90, async () => {
      const position = await this.reportPosition();
      if (position === 0) {
        onSuccess();
        return;
      } else {
        console.error(
          `WARN: Joint ${this.Name} reached home position and still have not contacted the switch`
        );
      }
    });
  }

  stop() {
    io.accelStepperStop(this.deviceNum);
  }

  reportPosition(): Promise<number> {
    return new Promise((resolve) => {
      io.accelStepperReportPosition(this.deviceNum, (position: number) => {
        resolve(position);
      });
    });
  }

  /**
   * Set the current position to zero
   */
  setPositionZero() {
    io.accelStepperZero(this.deviceNum);
  }

  private onHomeSwitchActivate() {
    this.homeSwitchActivate = true;
    console.warn(`Home switch activated for Joint ${this.Name}`);
    this.stop();
    if (this.isHoming) {
      this.isHoming = false;
      this.homed = true;
      this.setPositionZero();
      this.rotateToDegrees(10);
      console.log(`Homing completed for Joint ${this.Name}`);
    }
  }

  private onHomeSwitchDeactivate() {
    this.homeSwitchActivate = false;
    console.log(`Home switch deactivated for Joint ${this.Name}`);
  }
}
