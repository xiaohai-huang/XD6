import { io } from "../main.ts";
import five from "johnny-five";
import pino from "pino";

// Mapping of joint names (J1 - J6) to device numbers in accelStepper
export const JointToDeviceMap = {
  J1: 0,
  J2: 1,
  J3: 2,
  J4: 3,
  J5: 4,
  J6: 5,
};

type JointName = keyof typeof JointToDeviceMap;

type MotorConfig = {
  NAME: string;
  STEP_PIN: number;
  DIR_PIN: number;
  HOME_SWITCH_PIN: number;
  STEPS_PER_REV: number;
  /**
   * In degrees
   */
  MAX_ACCELERATION: number;
  /**
   * In degrees
   */
  MAX_SPEED: number;
  /**
   * In degrees, the position where the motor is at rest
   */
  READY_POSITION: number;
  RANGE: [number, number]; // range in degrees
  HOMING_SPEED: number; // Add homing speed in degrees per second
};

// todo: change max speed and max acceleration to degrees instead of steps
export const MOTOR_CONFIGS: Record<string, MotorConfig> = {
  J1: {
    NAME: "J1",
    STEP_PIN: 25,
    DIR_PIN: 24,
    HOME_SWITCH_PIN: 23,
    STEPS_PER_REV: 800 * 10 * 4, //
    MAX_ACCELERATION: 4, // in degrees per second squared
    MAX_SPEED: 10, // in degrees per second
    READY_POSITION: 55,
    RANGE: [0, 105],
    HOMING_SPEED: 3, // Add homing speed
  },
  J2: {
    NAME: "J2",
    STEP_PIN: 21,
    DIR_PIN: 20,
    HOME_SWITCH_PIN: 19,
    STEPS_PER_REV: 800 * 50,
    MAX_ACCELERATION: 5, // in degrees per second squared
    MAX_SPEED: 30, // in degrees per second
    READY_POSITION: 20,
    RANGE: [0, 128],
    HOMING_SPEED: 4, // Add homing speed
  },
  J3: {
    NAME: "J3",
    STEP_PIN: 18,
    DIR_PIN: 17,
    HOME_SWITCH_PIN: 16,
    STEPS_PER_REV: 800 * 50,
    MAX_ACCELERATION: 20, // in degrees per second squared
    MAX_SPEED: 30, // in degrees per second
    READY_POSITION: 37.791,
    RANGE: [0, 140],
    HOMING_SPEED: 4, // Add homing speed
  },
  J4: {
    NAME: "J4",
    STEP_PIN: 15,
    DIR_PIN: 14,
    HOME_SWITCH_PIN: 2,
    STEPS_PER_REV: 800 * 10 * 2,
    MAX_ACCELERATION: 30,
    MAX_SPEED: 60,
    READY_POSITION: 209.655,
    RANGE: [0, 325],
    HOMING_SPEED: 20, // Add homing speed
  },
  J5: {
    NAME: "J5",
    STEP_PIN: 47,
    DIR_PIN: 46,
    HOME_SWITCH_PIN: 45,
    STEPS_PER_REV: 15240,
    MAX_ACCELERATION: 50,
    MAX_SPEED: 60,
    READY_POSITION: 90,
    RANGE: [0, 180],
    HOMING_SPEED: 10, // Add homing speed
  },
  J6: {
    NAME: "J6",
    STEP_PIN: 44,
    DIR_PIN: 43,
    HOME_SWITCH_PIN: 42,
    STEPS_PER_REV: 1600,
    MAX_ACCELERATION: 100,
    MAX_SPEED: 100,
    READY_POSITION: 173,
    RANGE: [0, 330],
    HOMING_SPEED: 10, // Add homing speed
  },
};

export default class Joint {
  private deviceNum: number;
  private STEPS_PER_REV: number;
  private homeSwitch: five.Button;
  private isHoming: boolean = false;
  private homeSwitchActivate: boolean = false;
  private homed: boolean = false;
  private logger: pino.Logger;
  private name: string;
  private MAX_SPEED_IN_DEGREES: number;
  private MAX_ACCELERATION_IN_DEGREES: number;
  private RANGE: [number, number];
  // in degrees per second
  private currentSpeedInDegrees: number = 0;
  // in degrees per second squared
  private currentAcceleration: number = 0;
  /**
   * In degrees per second
   */
  private HOMING_SPEED: number; // Remove static keyword to make it instance-specific

  /**
   * In degrees
   */
  private READY_POSITION: number = 0;

  public static Instances: Joint[] = [];

  // Current Degrees, will be updated after movement is done of stopped
  private degrees: number = 0;
  public get Degrees() {
    return this.degrees;
  }
  public get Homed() {
    return this.homed;
  }

  public get Name() {
    return this.name;
  }

  constructor(config: MotorConfig) {
    this.name = config.NAME;
    this.deviceNum = JointToDeviceMap[config.NAME];

    this.initializeLogger();
    this.initializeStepper(config);
    this.initializeHomeSwitch(config.HOME_SWITCH_PIN);
    Joint.Instances.push(this);
  }

  /**
   * Converts a value in degrees to steps based on the steps per revolution.
   * @param degrees - The value in degrees to convert.
   * @returns The equivalent value in steps.
   */
  private convertDegreesToSteps(degrees: number): number {
    return (degrees / 360) * this.STEPS_PER_REV;
  }

  private convertStepsToDegrees(steps: number): number {
    return (steps / this.STEPS_PER_REV) * 360;
  }

  /**
   * Initializes the stepper motor with the given configuration.
   * @param config - The motor configuration.
   */
  private initializeStepper(config: MotorConfig) {
    this.RANGE = config.RANGE;
    this.READY_POSITION = config.READY_POSITION;
    this.STEPS_PER_REV = config.STEPS_PER_REV;
    this.MAX_SPEED_IN_DEGREES = config.MAX_SPEED;
    this.MAX_ACCELERATION_IN_DEGREES = config.MAX_ACCELERATION;
    this.HOMING_SPEED = config.HOMING_SPEED; // Initialize homing speed here
    io.accelStepperConfig({
      deviceNum: this.deviceNum,
      type: io.STEPPER.TYPE.DRIVER,
      stepPin: config.STEP_PIN,
      directionPin: config.DIR_PIN,
    });
    this.setSpeed(this.MAX_SPEED_IN_DEGREES);
    this.setAcceleration(this.MAX_ACCELERATION_IN_DEGREES);
  }

  /**
   * Resets the speed and acceleration of the stepper motor to their maximum values.
   */
  private async resetSpeedAndAcceleration() {
    this.setSpeed(this.MAX_SPEED_IN_DEGREES);
    this.setAcceleration(this.MAX_ACCELERATION_IN_DEGREES);
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
    // this.homeSwitch.on("hold", this.onHomeSwitchActivate.bind(this));
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
   * @param speedInDegrees - The speed in degrees per second.
   */
  public setSpeed(speedInDegrees: number) {
    const steps = this.convertDegreesToSteps(speedInDegrees);
    io.accelStepperSpeed(this.deviceNum, steps);
    this.currentSpeedInDegrees = speedInDegrees;
    this.logger.info(`Setting speed to ${speedInDegrees} degrees per second`);
  }

  /**
   * Sets the acceleration of the stepper motor.
   * @param acceleration - The acceleration in degrees per second squared.
   */
  public setAcceleration(accelerationInDegrees: number) {
    const accelerationInSteps = this.convertDegreesToSteps(
      accelerationInDegrees
    );
    io.accelStepperAcceleration(this.deviceNum, accelerationInSteps);
    this.currentAcceleration = accelerationInDegrees;
    this.logger.info(
      `Setting acceleration to ${this.currentAcceleration} degrees per second squared`
    );
  }

  /**
   * Ensures the joint has homed before performing an action.
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
    const [min, max] = this.RANGE;
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
  private step(steps: number, callback = (currentAbsSteps: number) => {}) {
    // special case for steps 0, as it is like not moving
    if (steps !== 0) this.ensureHomed();
    io.accelStepperStep(this.deviceNum, steps, callback);
  }

  /**
   * Moves the stepper motor to a specific position in steps.
   * @param position - The target position in steps.
   * @param callback - A callback function to execute after the movement is complete.
   */
  private stepTo(position: number, callback = (currentAbsSteps: number) => {}) {
    this.ensureHomed();
    io.accelStepperTo(this.deviceNum, position, callback);
  }

  /**
   * Rotates the joint by a specified number of degrees relative to its current position.
   * @param degrees - The number of degrees to rotate.
   */
  public async rotateBy(degrees: number) {
    if (degrees === 0) {
      return new Promise<boolean>((resolve) => {
        this.step(0, () => {
          resolve(true);
        });
      });
    }

    this.ensureHomed();
    const expectedDegrees = degrees + (await this.reportDegrees());
    this.ensureInRange(expectedDegrees);
    const steps = this.convertDegreesToSteps(degrees);
    this.logger.info(`Rotating by ${degrees} degrees, ${steps} steps`);

    return new Promise<boolean>((resolve) => {
      this.step(steps, (currentAbsSteps) => {
        this.degrees = this.convertStepsToDegrees(currentAbsSteps);
        resolve(expectedDegrees === this.degrees);
      });
    });
  }

  /**
   * Rotates the joint to an absolute position specified in degrees.
   * @param degrees - The target position in degrees.
   */
  public async rotateTo(degrees: number) {
    this.ensureHomed();
    this.ensureInRange(degrees);
    const steps = this.convertDegreesToSteps(degrees);
    this.logger.info(`Rotating to ${degrees} degrees, ${steps} steps`);
    return new Promise<boolean>((resolve) => {
      this.stepTo(steps, (currentAbsSteps) => {
        this.degrees = this.convertStepsToDegrees(currentAbsSteps);
        resolve(degrees === this.degrees);
      });
    });
  }

  /**
   * Homes the joint by moving it to its home position.
   */
  public async home(): Promise<boolean> {
    this.logger.info("Homing joint");
    this.isHoming = true;

    if (this.homeSwitchActivate) {
      this.logger.info(
        "Home switch is activate, rotate by 15 degrees and home again"
      );
      await this.rotateBy(15);
      const success = await this.home();
      return success;
    }

    // Set the speed to the joint-specific homing speed
    this.logger.info(
      `Setting homing speed to ${this.HOMING_SPEED} degrees per second and acceleration to 0`
    );

    this.setSpeed(this.HOMING_SPEED);
    this.setAcceleration(0);

    // Move to home position
    // It might be interrupted by the home switch
    this.logger.info("Moving to home position");
    const maxRange = this.RANGE[1] + 5;
    await this.rotateBy(-maxRange);
    await this.stop();

    this.logger.info("Reset speed and acceleration");
    await this.resetSpeedAndAcceleration();
    this.setPositionZero();

    let success = false;
    if (this.homeSwitchActivate) {
      this.logger.info("Homing success");
      this.homed = true;
      await wait(500);
      await this.rotateTo(this.READY_POSITION);
      success = true;
    } else {
      success = false;
      this.homed = false;
      this.logger.error(
        "Have traveled too far, and home switch is not activated"
      );
      throw new Error(
        "Homing failed. Have traveled too far, and home switch is not activated"
      );
    }

    this.isHoming = false;
    return success;
  }

  /**
   * Stops the stepper motor immediately.
   */
  public async stop() {
    this.logger.info("Stopping joint");
    io.accelStepperStop(this.deviceNum);
    // need to cancel the previous movement's acceleration
    this.logger.info("[START: Canceling previous acceleration]");
    const previousAcceleration = this.currentAcceleration;
    this.setAcceleration(0);
    await this.rotateBy(0);
    this.setAcceleration(previousAcceleration);
    this.logger.info("[END: Finish canceling previous acceleration]");
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
          const degrees = (position / this.STEPS_PER_REV) * 360;
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
    this.logger.info("Setting position to zero");
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
    return `Name: ${this.Name}, Homed: ${this.homed}, Degrees: ${this.degrees}. Speed: ${this.currentSpeedInDegrees}, Acceleration: ${this.currentAcceleration}`;
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

  public gotToReadyPosition() {
    return this.rotateTo(this.READY_POSITION);
  }

  public static homeAll() {
    return Promise.all(
      Joint.Instances.map((joint) => {
        return joint.home();
      })
    );
  }

  public static stopAll() {
    return Promise.all(
      Joint.Instances.map((joint) => {
        return joint.stop();
      })
    );
  }
}

async function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
