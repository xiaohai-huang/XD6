import Joint from "./Joint.ts";
import { JOINT_CONFIGS } from "../config.ts";
import { createKinematics, Kinematics } from "./kinematics.ts";

type TPose = [number, number, number, number, number, number]; // [x, y, z, rx, ry, rz]

// Linear interpolation between two values
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

// Interpolate between two poses
function interpolatePose(p1: TPose, p2: TPose, t: number): TPose {
  return p1.map((val, i) => lerp(val, p2[i], t)) as TPose;
}

export class Robot {
  private instances: Joint[] = [];
  private kinematics: Kinematics;
  private readonly CONTROL_LOOP_FREQUENCY_HZ = 50; // Example
  private readonly TIME_STEP_MS = 1000 / this.CONTROL_LOOP_FREQUENCY_HZ;
  private moveLIntervalId: NodeJS.Timeout;
  get J1(): Joint {
    return this.instances[0];
  }
  get J2(): Joint {
    return this.instances[1];
  }
  get J3(): Joint {
    return this.instances[2];
  }
  get J4(): Joint {
    return this.instances[3];
  }
  get J5(): Joint {
    return this.instances[4];
  }
  get J6(): Joint {
    return this.instances[5];
  }

  get Homed(): boolean {
    return this.instances.every((joint) => joint.Homed);
  }

  get Pose(): TPose {
    const { x, y, z, rx, ry, rz } = Kinematics.extractHomogeneousMatrix(
      this.kinematics.forwardKinematics(
        this.instances.map((joint) => joint.Degrees)
      )
    );
    return [x, y, z, rx, ry, rz];
  }

  constructor() {
    this.instances = Joint.createAllJoints();
    this.kinematics = createKinematics();
  }

  /**
   * Moves the robot linearly to the target pose in Cartesian space.
   * The robot will follow a smooth trajectory by streaming joint commands.
   * @param target The target pose [x, y, z, rx, ry, rz].
   */
  async moveToLinearly(target: TPose): Promise<void> {
    const currentPose = this.Pose;

    // 1. Calculate start and end joint angles using inverse kinematics
    const startJointAngles = this.kinematics.inverseKinematics(...currentPose);
    const endJointAngles = this.kinematics.inverseKinematics(...target);

    if (
      !startJointAngles ||
      !endJointAngles ||
      startJointAngles.length !== this.instances.length
    ) {
      console.error(
        "Inverse kinematics failed to find valid joint configurations."
      );
      throw new Error("Invalid IK solution or mismatch in joint count.");
    }

    // 2. Determine the minimum total time required based on joint velocity limits
    let maxRequiredTime = 0; // The time required for the slowest joint to complete its travel
    for (let j = 0; j < this.instances.length; j++) {
      const angleDiff = Math.abs(endJointAngles[j] - startJointAngles[j]);
      const maxVelocity = JOINT_CONFIGS[`J${j + 1}`].MAX_SPEED;

      if (maxVelocity === 0 && angleDiff > 0) {
        console.warn(
          `Joint ${j} needs to move (${angleDiff.toFixed(
            2
          )} rad) but has 0 max velocity.`
        );
        throw new Error(
          `Joint ${j} cannot move to target due to zero max velocity.`
        );
      }

      if (maxVelocity > 0) {
        const timeForJoint = angleDiff / maxVelocity;
        if (timeForJoint > maxRequiredTime) {
          maxRequiredTime = timeForJoint;
        }
      }
    }

    // Ensure a minimum time for the move, even if angles are tiny
    // This prevents dividing by zero for numSteps if move is zero-length,
    // and provides a reasonable duration for very small moves.
    const totalMoveTimeSeconds = Math.max(maxRequiredTime, 0.5); // Minimum 0.5 seconds for any move
    console.log(
      `Calculated total move time: ${totalMoveTimeSeconds.toFixed(2)} seconds.`
    );

    // 3. Calculate the total number of control loop steps
    const numSteps = Math.ceil(
      totalMoveTimeSeconds * this.CONTROL_LOOP_FREQUENCY_HZ
    );
    if (numSteps === 0) {
      console.log(
        "No significant movement required (zero steps calculated), robot likely at target or very close."
      );
      return;
    }
    console.log(
      `Generating ${numSteps} trajectory steps for a ${totalMoveTimeSeconds.toFixed(
        2
      )}s move.`
    );

    // 4. Generate the complete joint trajectories (angles for each joint at each time step)
    const jointTrajectories: number[][] = Array(this.instances.length)
      .fill(null)
      .map(() => []);

    for (let i = 0; i <= numSteps; i++) {
      const t = i / numSteps; // Normalized time (0.0 to 1.0)
      const interpolatedPose = interpolatePose(currentPose, target, t);
      const currentStepJointAngles = this.kinematics.inverseKinematics(
        ...interpolatedPose
      );

      // Basic check to ensure IK returns valid angles for all joints
      if (
        !currentStepJointAngles ||
        currentStepJointAngles.length !== this.instances.length
      ) {
        console.error(
          `IK failed for interpolated pose at t=${t}. Aborting move.`
        );
        throw new Error("IK solution invalid during trajectory generation.");
      }

      this.instances.forEach((_, jointIndex) => {
        jointTrajectories[jointIndex].push(currentStepJointAngles[jointIndex]);
      });
    }

    // 5. Execute the trajectory by streaming commands using setInterval
    let currentStep = 0;
    const movePromise = new Promise<void>((resolve) => {
      this.moveLIntervalId = setInterval(() => {
        // If all steps have been processed, clear interval and resolve
        if (currentStep > numSteps) {
          clearInterval(this.moveLIntervalId);
          resolve();
          return;
        }

        // Send commands for the current step to each joint
        this.instances.forEach((joint, jointIndex) => {
          const targetAngle = jointTrajectories[jointIndex][currentStep];
          if (targetAngle !== undefined) {
            // Crucial: Fire and forget. Send the command but do NOT await the promise.
            // AccelStepper on the Arduino handles the actual movement asynchronously.
            // The promise resolves when the command is sent to Firmata.js.
            joint.rotateTo(targetAngle).catch((error) => {
              console.error(
                `Error sending command to Joint ${joint.Name} at step ${currentStep}:`,
                error
              );
              // You might want to reject the main movePromise here or handle error differently
              // For robust systems, this would trigger an emergency stop or error state
            });
          }
        });

        currentStep++;
        // Optional: Log progress to see commands being sent
        // if (currentStep % (this.CONTROL_LOOP_FREQUENCY_HZ * 1) === 0 || currentStep === numSteps + 1) {
        //     console.log(`> Sent commands for step ${currentStep - 1}/${numSteps}`);
        // }
      }, this.TIME_STEP_MS);
    });

    // Wait for all trajectory commands to be *sent* from the laptop to the Arduino.
    // This does NOT guarantee the robot has physically stopped or settled.
    await movePromise;
    console.log("All trajectory commands have been sent to Arduino.");

    // Optional: Add a buffer delay to allow the robot to physically complete its last moves
    // and settle. This is important before starting a new motion or relying on robot being static.
    await new Promise((resolve) =>
      setTimeout(resolve, totalMoveTimeSeconds * 1000 + 500)
    ); // Add 500ms buffer after commands sent
    console.log(
      "Robot move operation completed (commands sent and buffer time elapsed)."
    );
  }

  async moveByLinearly(delta: TPose): Promise<void> {
    const currentPose = this.Pose;
    const targetPose: TPose = currentPose.map(
      (val, index) => val + delta[index]
    ) as TPose;

    // Move to the target pose linearly
    await this.moveToLinearly(targetPose);
  }

  async moveByLinearlyXYZ(deltaX = 0, deltaY = 0, deltaZ = 0) {
    const currentPose = this.Pose;
    const targetPose: TPose = [
      currentPose[0] + deltaX,
      currentPose[1] + deltaY,
      currentPose[2] + deltaZ,
      currentPose[3],
      currentPose[4],
      currentPose[5],
    ];

    // Move to the target pose linearly
    await this.moveToLinearly(targetPose);
  }

  public async home() {
    const first = this.instances.slice(0, 3);
    const last = this.instances.slice(3);

    await Promise.all(first.map((joint) => joint.home()));
    await Promise.all(last.map((joint) => joint.home()));
  }

  public async halt() {
    if (this.moveLIntervalId !== undefined) {
      clearInterval(this.moveLIntervalId);
    }
    return Joint.stopAll();
  }
}
