import { io } from "../main.ts";
import five from "johnny-five";
import pino from "pino";

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
  RANGE: [number, number]; // range in degrees
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
    RANGE: [0, 180],
  },
};

export default class Joint {
  private deviceNum: number;
  private stepsPerRev: number;
  private homeSwitch: five.Button;
  private isHoming: boolean = false;
  private homeSwitchActivate: boolean = false;
  private homed: boolean = false;
  private degrees: number = 0;
  private logger: pino.Logger;
  public get Degrees() {
    return this.degrees;
  }
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

    this.logger = pino({
      name: this.Name,
      level: "debug",
      base: { name: this.Name }, // Exclude pid and hostname by not including them in the base
      timestamp: pino.stdTimeFunctions.isoTime, // Use ISO timestamp format
    });
  }

  public static createJoint(name: JointName): Joint {
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

  private step(steps: number, callback = () => {}) {
    this.ensureHomed();
    io.accelStepperStep(this.deviceNum, steps, () => {
      this.updateDegrees();
      callback();
    });
  }

  private stepTo(position: number, callback = () => {}) {
    this.ensureHomed();
    io.accelStepperTo(this.deviceNum, position, () => {
      this.updateDegrees();
      callback();
    });
  }

  rotateDegrees(degrees: number, callback = () => {}) {
    this.ensureHomed();
    const steps = Math.round((degrees / 360) * this.stepsPerRev);
    this.logger.info(`Rotating ${degrees} degrees`);
    this.step(steps, () => {
      callback();
    });
  }

  rotateToDegrees(degrees: number, callback = () => {}) {
    this.ensureHomed();
    const steps = Math.round((degrees / 360) * this.stepsPerRev);
    this.logger.info(`Rotating to ${degrees} degrees`);
    this.stepTo(steps, callback);
  }

  home(onSuccess = () => {}) {
    this.logger.info("Homing joint");
    this.isHoming = true;

    this.rotateDegrees(-90, async () => {
      if ((await this.reportDegrees()) === 0) {
        this.logger.info("Homing success");
        onSuccess();
      } else {
        this.logger.error("Reached home position but switch not activated");
      }
      this.isHoming = false;
    });
  }

  stop() {
    io.accelStepperStop(this.deviceNum);
  }

  private reportDegrees(): Promise<number> {
    return new Promise((resolve) => {
      io.accelStepperReportPosition(this.deviceNum, (position: number) => {
        const degrees = (position / this.stepsPerRev) * 360;
        resolve(degrees);
      });
    });
  }

  private updateDegrees() {
    this.reportDegrees().then((position) => {
      this.degrees = position;
    });
  }

  /**
   * Set the current position to zero
   */
  private setPositionZero() {
    io.accelStepperZero(this.deviceNum);
    this.degrees = 0;
  }

  private onHomeSwitchActivate() {
    this.homeSwitchActivate = true;
    this.logger.warn("Home switch activated");
    this.stop();
    if (this.isHoming) {
      this.homed = true;
      this.setPositionZero();
      setTimeout(() => {
        this.rotateToDegrees(10);
      }, 500);
    }
  }

  private onHomeSwitchDeactivate() {
    this.homeSwitchActivate = false;
    this.logger.warn("Home switch deactivated");
  }

  public toString(): string {
    return `Joint Name: ${this.Name}, Homed: ${
      this.homed
    }, Degrees: ${this.Degrees.toFixed(3)}`;
  }

  async LogInfo(): Promise<void> {
    const position = await this.reportDegrees();
    this.logger.info(
      { homed: this.homed, degrees: position.toFixed(3) },
      "Joint status"
    );
  }
}
