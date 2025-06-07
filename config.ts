export type MotorConfig = {
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

  RANGE: [number, number]; // range in degrees
  HOMING_SPEED: number; // Add homing speed in degrees per second
  HOMING_DIRECTION: "positive" | "negative"; // Add homing direction
};

export const JOINT_CONFIGS: Record<string, MotorConfig> = {
  J1: {
    NAME: "J1",
    STEP_PIN: 25,
    DIR_PIN: 24,
    HOME_SWITCH_PIN: 23,
    STEPS_PER_REV: 800 * 10 * 4,
    MAX_ACCELERATION: 20, // in degrees per second squared
    MAX_SPEED: 20, // in degrees per second
    RANGE: [-170, 115],
    HOMING_SPEED: 10, // Add homing speed,
    HOMING_DIRECTION: "positive",
  },
  J2: {
    NAME: "J2",
    STEP_PIN: 21,
    DIR_PIN: 20,
    HOME_SWITCH_PIN: 19,
    STEPS_PER_REV: 800 * 50,
    MAX_ACCELERATION: 5, // in degrees per second squared
    MAX_SPEED: 30, // in degrees per second
    RANGE: [-20, 108],
    HOMING_SPEED: 4, // Add homing speed
    HOMING_DIRECTION: "negative",
  },
  J3: {
    NAME: "J3",
    STEP_PIN: 18,
    DIR_PIN: 17,
    HOME_SWITCH_PIN: 16,
    STEPS_PER_REV: 800 * 50,
    MAX_ACCELERATION: 20, // in degrees per second squared
    MAX_SPEED: 30, // in degrees per second
    RANGE: [-102, 38],
    HOMING_SPEED: 4, // Add homing speed
    HOMING_DIRECTION: "positive",
  },
  J4: {
    NAME: "J4",
    STEP_PIN: 15,
    DIR_PIN: 14,
    HOME_SWITCH_PIN: 2,
    STEPS_PER_REV: 800 * 10 * 2,
    MAX_ACCELERATION: 30,
    MAX_SPEED: 60,
    RANGE: [-209, 145],
    HOMING_SPEED: 20, // Add homing speed
    HOMING_DIRECTION: "negative",
  },
  J5: {
    NAME: "J5",
    STEP_PIN: 47,
    DIR_PIN: 46,
    HOME_SWITCH_PIN: 45,
    STEPS_PER_REV: 15240,
    MAX_ACCELERATION: 50,
    MAX_SPEED: 60,
    RANGE: [-100.9, 106],
    HOMING_SPEED: 10, // Add homing speed
    HOMING_DIRECTION: "negative",
  },
  J6: {
    NAME: "J6",
    STEP_PIN: 44,
    DIR_PIN: 43,
    HOME_SWITCH_PIN: 42,
    STEPS_PER_REV: 1600,
    MAX_ACCELERATION: 100,
    MAX_SPEED: 100,
    RANGE: [-173, 157],
    HOMING_SPEED: 10, // Add homing speed
    HOMING_DIRECTION: "negative",
  },
};
