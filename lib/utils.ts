import { JOINT_CONFIGS } from "../config.ts";

/**
 * The required joint speeds to reach the target angles in a coordinated manner.
 * @param deltaAngles [J1 Angle, J2 Angle, ... J6 Angle]
 */
export function getCoordinatedSpeeds(deltaAngles: number[]) {
  // Calculate the theoretical time for each joint to reach its target angle at max speed
  const theoreticalTimes = deltaAngles.map((delta, index) => {
    const maxSpeed = JOINT_CONFIGS[`J${index + 1}`].MAX_SPEED;
    return Math.abs(delta) / maxSpeed;
  });

  // Determine the max travel time across all joints
  const maxTravelTime = Math.max(...theoreticalTimes);

  if (maxTravelTime === 0) {
    return deltaAngles.map(() => 0); // All speeds are 0
  }

  // Calculate the coordinated speed for each joint
  const coordinatedSpeeds = deltaAngles.map((delta, index) => {
    return delta / maxTravelTime;
  });

  return coordinatedSpeeds;
}
