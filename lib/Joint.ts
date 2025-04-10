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

// todo: change max speed and max acceleration to degrees instead of steps
export const MOTOR_CONFIGS: Record<string, MotorConfig> = {
  J1: {
    NAME: "J1",
    STEP_PIN: 27,
    DIR_PIN: 28,
    HOME_SWITCH_PIN: 26,
    STEPS_PER_REV: 400 * 20,
    MAX_ACCELERATION: 500,
    MAX_SPEED: 400,
    RANGE: [0, 30],
  },
  J2: {
    NAME: "J2",
    STEP_PIN: 30,
    DIR_PIN: 31,
    HOME_SWITCH_PIN: 29,
    STEPS_PER_REV: 400 * 50,
    MAX_ACCELERATION: 500,
    MAX_SPEED: 1500,
    RANGE: [0, 120],
  },
};

export default class Joint {
  private deviceNum: number;
  private stepsPerRev: number;
  private homeSwitch: five.Button;
  private isHoming: boolean = false;
  private homeSwitchActivate: boolean = false;
  private homed: boolean = false;
  private logger: pino.Logger;
  private name: string;
  private MAX_SPEED: number;

  public get Homed() {
    return this.homed;
  }

  public get Name() {
    return this.name;
  }

  constructor(config: MotorConfig) {
    this.name = config.NAME;
    this.deviceNum = jointToDeviceMap[config.NAME];
    this.stepsPerRev = config.STEPS_PER_REV;

    this.initializeStepper(config);
    this.initializeHomeSwitch(config.HOME_SWITCH_PIN);
    this.initializeLogger();
  }

  /**
   * Initializes the stepper motor with the given configuration.
   * @param config - The motor configuration.
   */
  private initializeStepper(config: MotorConfig) {
    this.MAX_SPEED = config.MAX_SPEED;
    io.accelStepperConfig({
      deviceNum: this.deviceNum,
      type: io.STEPPER.TYPE.DRIVER,
      stepPin: config.STEP_PIN,
      directionPin: config.DIR_PIN,
    });
    this.setSpeed(config.MAX_SPEED);
    this.setAcceleration(config.MAX_ACCELERATION);
  }

  /**
   * Initializes the home switch for the joint.
   * @param pin - The pin number for the home switch.
   */
  private initializeHomeSwitch(pin: number) {
    this.homeSwitch = new five.Button({
      pin,
      isPullup: true,
      invert: false,
    });
    this.homeSwitch.on("press", this.onHomeSwitchActivate.bind(this));
    this.homeSwitch.on("release", this.onHomeSwitchDeactivate.bind(this));
  }

  /**
   * Initializes the logger for the joint.
   */
  private initializeLogger() {
    this.logger = pino({
      name: this.Name,
      level: "debug",
      base: { name: this.Name },
      timestamp: pino.stdTimeFunctions.isoTime,
    });
  }

  /**
   * Creates a new Joint instance based on the given joint name.
   * @param name - The name of the joint (e.g., J1, J2, etc.).
   * @returns A new Joint instance.
   * @throws If the motor configuration for the given name is not found.
   */
  public static createJoint(name: JointName): Joint {
    const config = MOTOR_CONFIGS[name];
    if (!config) {
      throw new Error(`Motor configuration for ${name} not found.`);
    }
    return new Joint(config);
  }

  /**
   * Sets the speed of the stepper motor.
   * @param speed - The speed in steps per second.
   */
  public setSpeed(speed: number) {
    io.accelStepperSpeed(this.deviceNum, speed);
  }

  /**
   * Sets the acceleration of the stepper motor.
   * @param acceleration - The acceleration in steps per second squared.
   */
  public setAcceleration(acceleration: number) {
    io.accelStepperAcceleration(this.deviceNum, acceleration);
  }

  /**
   * Ensures the joint is homed before performing an action.
   * @throws If the joint is not homed and not currently homing.
   */
  private ensureHomed() {
    if (this.isHoming) return;
    if (!this.homed) {
      throw new Error(
        `Joint ${this.Name} must be homed before performing this action.`
      );
    }
  }

  /**
   * Ensures the target degrees are within the allowed range.
   * @param targetDegrees - The target position in degrees.
   * @throws If the target degrees are out of range.
   */
  private ensureInRange(targetDegrees: number) {
    if (this.isHoming) return;
    const [min, max] = MOTOR_CONFIGS[this.Name].RANGE;
    if (targetDegrees < min || targetDegrees > max) {
      throw new Error(
        `Target degrees ${targetDegrees} out of range [${min}, ${max}]`
      );
    }
  }

  /**
   * Moves the stepper motor by a specified number of steps.
   * @param steps - The number of steps to move.
   * @param callback - A callback function to execute after the movement is complete.
   */
  private step(steps: number, callback = () => {}) {
    this.ensureHomed();
    io.accelStepperStep(this.deviceNum, steps, callback);
  }

  /**
   * Moves the stepper motor to a specific position in steps.
   * @param position - The target position in steps.
   * @param callback - A callback function to execute after the movement is complete.
   */
  private stepTo(position: number, callback = () => {}) {
    this.ensureHomed();
    io.accelStepperTo(this.deviceNum, position, callback);
  }

  /**
   * Rotates the joint by a specified number of degrees relative to its current position.
   * @param degrees - The number of degrees to rotate.
   */
  public async rotateDegrees(degrees: number) {
    this.ensureHomed();
    this.ensureInRange(degrees + (await this.reportDegrees()));
    const steps = Math.round((degrees / 360) * this.stepsPerRev);
    this.logger.info(`Rotating ${degrees} degrees`);

    return new Promise<void>((resolve) => {
      this.step(steps, () => {
        resolve();
      });
    });
  }

  /**
   * Rotates the joint to an absolute position specified in degrees.
   * @param degrees - The target position in degrees.
   */
  public async rotateToDegrees(degrees: number) {
    this.ensureHomed();
    this.ensureInRange(degrees);
    const steps = Math.round((degrees / 360) * this.stepsPerRev);
    this.logger.info(`Rotating to ${degrees} degrees`);
    return new Promise<void>((resolve) => {
      this.stepTo(steps, () => {
        resolve();
      });
    });
  }

  /**
   * Homes the joint by moving it to its home position.
   * @param onSuccess - A callback function to execute after homing is successful.
   */
  public async home(onSuccess = () => {}) {
    this.logger.info("Homing joint");
    this.isHoming = true;

    // Set the speed to a lower value for homing
    this.setSpeed(200);

    // Move to home position
    // It might be interrupted by the home switch
    await this.rotateDegrees(-90);

    this.setSpeed(this.MAX_SPEED);
    if (this.homeSwitchActivate) {
      this.logger.info("Homing success");
      this.setPositionZero();
      this.homed = true;
      setTimeout(() => {
        this.rotateToDegrees(10);
      }, 500);
      onSuccess();
    } else {
      this.logger.error("Reached home position but switch not activated");
    }

    this.isHoming = false;
  }

  /**
   * Stops the stepper motor immediately.
   */
  public stop() {
    io.accelStepperStop(this.deviceNum);
  }

  /**
   * Reports the current position of the joint in degrees.
   * @returns A promise that resolves to the current position in degrees.
   */
  private reportDegrees(): Promise<number> {
    return new Promise((resolve, reject) => {
      io.accelStepperReportPosition(this.deviceNum, (position: number) => {
        if (position === undefined) {
          reject(new Error("Failed to report position"));
        } else {
          const degrees = (position / this.stepsPerRev) * 360;
          resolve(degrees);
        }
      });
    });
  }

  /**
   * Sets the current position of the joint to zero.
   */
  private setPositionZero() {
    io.accelStepperZero(this.deviceNum);
  }

  /**
   * Handles the activation of the home switch.
   */
  private onHomeSwitchActivate() {
    this.homeSwitchActivate = true;
    this.logger.warn("Home switch activated");
    this.stop();
  }

  /**
   * Handles the deactivation of the home switch.
   */
  private onHomeSwitchDeactivate() {
    this.homeSwitchActivate = false;
    this.logger.warn("Home switch deactivated");
  }

  /**
   * Returns a string representation of the joint's status.
   * @returns A string containing the joint's name, homed status, and current degrees.
   */
  public toString(): string {
    return `Joint Name: ${this.Name}, Homed: ${this.homed}`;
  }

  /**
   * Logs the current status of the joint, including its homed status and position in degrees.
   */
  public async LogInfo(): Promise<void> {
    try {
      const position = await this.reportDegrees();
      this.logger.info(
        { homed: this.homed, degrees: position.toFixed(3) },
        "Joint status"
      );
    } catch (error) {
      this.logger.error("Failed to log joint info: ", error);
    }
  }
}
