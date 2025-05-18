import EventEmitter from "events";

export type FirmataType = {
  [key: string]: any;
  accelStepperConfig: (options: {
    deviceNum: number;
    type: number;
    stepPin: number;
    directionPin: number;
  }) => void;
  accelStepperSpeed: (deviceNum: number, speed: number) => void;
  accelStepperAcceleration: (deviceNum: number, acceleration: number) => void;
  /**
   * Asks the arduino to move a stepper a number of steps
   * (and optionally with and acceleration and deceleration)
   * speed is in units of steps/sec
   * @param {number} deviceNum Device number for the stepper (range 0-5)
   * @param {number} steps Number of steps to make
   */
  accelStepperStep: (
    deviceNum: number,
    steps: number,
    /**
     * Optional callback function to be called when the stepper has completed
     * the input is the current position in steps
     */
    callback?: (currentAbsSteps: number) => void
  ) => void;
  accelStepperStop: (deviceNum: number) => void;
} & EventEmitter;
