import { acos, atan2, inv, multiply, transpose, unit } from "mathjs";
import { JOINT_CONFIGS } from "../config.ts";

type TheFourDHParameters = {
  theta: (angleInRadians: number) => number;
  alpha: number;
  d: number;
  a: number;
};

export class Kinematics {
  private DHParameters: Record<string, TheFourDHParameters>;
  private toolFrame: number[][] = Kinematics.createHomogeneousMatrix(
    0,
    0,
    0,
    0,
    0,
    0
  );

  constructor(params: Record<string, TheFourDHParameters>) {
    this.DHParameters = params;
  }

  /**
   * Set the tool frame transformation matrix.
   * @param x Position along the x-axis.
   * @param y Position along the y-axis.
   * @param z Position along the z-axis.
   * @param rx Rotation around the x-axis (roll) in radians.
   * @param ry Rotation around the y-axis (pitch) in radians.
   * @param rz Rotation around the z-axis (yaw) in radians.
   */
  setToolFrame(
    x: number,
    y: number,
    z: number,
    rx: number,
    ry: number,
    rz: number
  ): void {
    this.toolFrame = Kinematics.createHomogeneousMatrix(x, y, z, rx, ry, rz);
  }

  /**
   * Compute the transformation matrix from the base frame to the tool frame using forward kinematics.
   * @param jointAngles Array of joint angles in degrees (J1 to J6).
   * @returns The final transformation matrix from base to tool frame.
   */
  forwardKinematics(jointAngles: number[]): number[][] {
    const angles = jointAngles.map((angle) => unit(angle, "deg").value); // Convert angles to radians
    const matrices = Object.keys(this.DHParameters)
      .slice(0, jointAngles.length)
      .map((joint, index) => {
        const params = this.DHParameters[joint];
        return this.createDHMatrix(
          params.theta(angles[index]),
          params.alpha,
          params.d,
          params.a
        );
      });

    return multiply(...matrices, this.toolFrame); // Multiply all matrices to get the final transformation
  }

  /**
   * Normalizes values close to zero in a 2D array.
   * @param matrix A 2D array of numbers.
   * @returns A 2D array with values close to zero replaced by 0.
   */
  normalize(matrix: number[][]): number[][] {
    const threshold = 1e-10; // Define the threshold for normalization
    return matrix.map((row) =>
      row.map((value) => (Math.abs(value) < threshold ? 0 : value))
    );
  }

  /**
   * Compute the inverse kinematics to find joint angles for a given tool pose.
   * @param x Position along the x-axis.
   * @param y Position along the y-axis.
   * @param z Position along the z-axis.
   * @param rx Rotation around the x-axis (roll) in degrees.
   * @param ry Rotation around the y-axis (pitch) in degrees.
   * @param rz Rotation around the z-axis (yaw) in degrees.
   * @returns An array of joint angles in degrees.
   */
  inverseKinematics(
    x: number,
    y: number,
    z: number,
    rx: number,
    ry: number,
    rz: number,
    wristConfig: "F" | "NF" = "F"
  ): number[] {
    // Convert angles to radians
    const angles = [rx, ry, rz].map((angle) => unit(angle, "deg").value);
    // Joint 1,2,3 determines the position of the tool
    // Joint 4,5,6 determines the orientation of the tool

    // Find the center of the spherical wrist
    // Turn the tool pose into a transformation matrix
    const tipOfTheTool = Kinematics.createHomogeneousMatrix(
      x,
      y,
      z,
      angles[0],
      angles[1],
      angles[2]
    );
    // Inverse of the tool frame
    const inverseToolFrame = inv(this.toolFrame);

    const R_0_6 = multiply(tipOfTheTool, inverseToolFrame);
    const J6_D = this.DHParameters.J6.d;
    const offset = Kinematics.createHomogeneousMatrix(0, 0, -J6_D, 0, 0, 0);
    const centerOfSphericalWrist = multiply(R_0_6, offset);

    // Calculate J1 angle in degrees with edge case handling
    const wristCenterX = centerOfSphericalWrist[0][3];
    const wristCenterY = centerOfSphericalWrist[1][3];
    const wristCenterZ = centerOfSphericalWrist[2][3];

    let J1AngleDeg = Kinematics.getJ1Angle(wristCenterX, wristCenterY);

    // rotate J1 to zero degree
    const wristCenterXRotated =
      wristCenterX * Math.cos(unit(-J1AngleDeg, "deg").value) -
      wristCenterY * Math.sin(unit(-J1AngleDeg, "deg").value);
    const wristCenterYRotated =
      wristCenterY * Math.cos(unit(-J1AngleDeg, "deg").value) +
      wristCenterX * Math.sin(unit(-J1AngleDeg, "deg").value);

    const L1 = wristCenterXRotated - this.DHParameters.J1.a;
    const L4 = wristCenterZ - this.DHParameters.J1.d;
    const L2 = Math.sqrt(L1 ** 2 + L4 ** 2);
    const L3 = Math.sqrt(
      this.DHParameters.J3.a ** 2 + this.DHParameters.J4.d ** 2
    );
    const thetaB = unit(atan2(L1, L4), "rad").toNumber("deg");
    const thetaC = unit(
      acos(
        (this.DHParameters.J2.a ** 2 + L2 ** 2 - L3 ** 2) /
          (2 * this.DHParameters.J2.a * L2)
      ),
      "rad"
    ).toNumber("deg");
    const thetaD = unit(
      acos(
        (L3 ** 2 + this.DHParameters.J2.a ** 2 - L2 ** 2) /
          (2 * L3 * this.DHParameters.J2.a)
      ),
      "rad"
    ).toNumber("deg");
    const thetaE = unit(
      atan2(this.DHParameters.J3.a, this.DHParameters.J4.d),
      "rad"
    ).toNumber("deg");

    const getJ2Angle = () => {
      if (wristCenterXRotated > this.DHParameters.J1.a) {
        if (L4 > 0) {
          return thetaB - thetaC;
        } else {
          return thetaB - thetaC + 180;
        }
      } else {
        return -(thetaB + thetaC);
      }
    };
    const J2AngleDeg = getJ2Angle();
    const J3AngleDeg = -(thetaD + thetaE) + 90;
    const R_0_3 = this.forwardKinematics([J1AngleDeg, J2AngleDeg, J3AngleDeg]);
    const R_0_3_Transposed = transpose(R_0_3);
    // spherical wrist orientation
    const R_3_6 = multiply(R_0_3_Transposed, R_0_6);
    // Calculate J4, J5, J6 angles based on the wrist configuration
    const get456Angles = () => {
      const r13 = R_3_6[0][2];
      const r23 = R_3_6[1][2];
      const r31 = R_3_6[2][0];
      const r32 = R_3_6[2][1];
      const r33 = R_3_6[2][2];
      if (wristConfig === "F") {
        return [
          atan2(r23, r13),
          atan2(Math.sqrt(1 - r33 ** 2), r33),
          atan2(r32, -r31),
        ];
      } else {
        return [
          atan2(-r23, -r13),
          atan2(-Math.sqrt(1 - r33 ** 2), r33),
          atan2(-r32, r31),
        ];
      }
    };
    let [J4AngleDeg, J5AngleDeg, J6AngleDeg] = get456Angles().map((radians) =>
      unit(radians, "rad").toNumber("deg")
    );
    const wristAngles = [0, 0, 0, J4AngleDeg, J5AngleDeg, J6AngleDeg];
    if (Kinematics.ensureInRange(wristAngles) === false) {
      wristConfig = wristConfig === "F" ? "NF" : "F"; // toggle wrist configuration
      [J4AngleDeg, J5AngleDeg, J6AngleDeg] = get456Angles().map((radians) =>
        unit(radians, "rad").toNumber("deg")
      );
    }

    // make sure the degrees are within the range of each joint
    const degrees = [
      J1AngleDeg,
      J2AngleDeg,
      J3AngleDeg,
      J4AngleDeg,
      J5AngleDeg,
      J6AngleDeg,
    ];
    if (Kinematics.ensureInRange(degrees) === false) {
      throw new Error("Joint angles out of range");
    }
    return degrees;
  }

  private static ensureInRange(jointAngles: number[]): boolean {
    return jointAngles.every((angle, index) => {
      const name = `J${index + 1}`;
      const [min, max] = JOINT_CONFIGS[name].RANGE;
      const inRange = angle >= min && angle <= max;
      if (!inRange) {
        console.error(
          `Joint ${name} angle ${angle} is out of range [${min}, ${max}]`
        );
      }
      return inRange;
    });
  }

  /**
   * Create a Denavit-Hartenberg transformation matrix.
   * @param theta Joint angle in radians.
   * @param alpha Twist angle in radians.
   * @param d Offset along the previous z-axis.
   * @param a Offset along the previous x-axis.
   * @returns A 4x4 transformation matrix.
   */
  private createDHMatrix(
    theta: number,
    alpha: number,
    d: number,
    a: number
  ): number[][] {
    return [
      [
        Math.cos(theta),
        -Math.sin(theta) * Math.cos(alpha),
        Math.sin(theta) * Math.sin(alpha),
        a * Math.cos(theta),
      ],
      [
        Math.sin(theta),
        Math.cos(theta) * Math.cos(alpha),
        -Math.cos(theta) * Math.sin(alpha),
        a * Math.sin(theta),
      ],
      [0, Math.sin(alpha), Math.cos(alpha), d],
      [0, 0, 0, 1],
    ];
  }

  /**
   * Create a homogeneous transformation matrix from position and orientation.
   * @param x Position along the x-axis.
   * @param y Position along the y-axis.
   * @param z Position along the z-axis.
   * @param rx Rotation around the x-axis (roll) in radians.
   * @param ry Rotation around the y-axis (pitch) in radians.
   * @param rz Rotation around the z-axis (yaw) in radians.
   * @returns A 4x4 transformation matrix.
   */
  public static createHomogeneousMatrix(
    x: number,
    y: number,
    z: number,
    rx: number,
    ry: number,
    rz: number
  ): number[][] {
    return [
      [
        Math.cos(rz) * Math.cos(ry),
        Math.cos(rz) * Math.sin(ry) * Math.sin(rx) -
          Math.sin(rz) * Math.cos(rx),
        Math.cos(rz) * Math.sin(ry) * Math.cos(rx) +
          Math.sin(rz) * Math.sin(rx),
        x,
      ],
      [
        Math.sin(rz) * Math.cos(ry),
        Math.sin(rz) * Math.sin(ry) * Math.sin(rx) +
          Math.cos(rz) * Math.cos(rx),
        Math.sin(rz) * Math.sin(ry) * Math.cos(rx) -
          Math.cos(rz) * Math.sin(rx),
        y,
      ],
      [
        -Math.sin(ry),
        Math.cos(ry) * Math.sin(rx),
        Math.cos(ry) * Math.cos(rx),
        z,
      ],
      [0, 0, 0, 1],
    ];
  }

  /**Add commentMore actions
   *  Extracts position and orientation from a 4x4 homogeneous transformation matrix.
   * @param matrix A 4x4 homogeneous transformation matrix
   * @returns An object containing position (x, y, z) and orientation (rx, ry, rz) in degrees.
   */
  public static extractHomogeneousMatrix(matrix: number[][]) {
    const x = matrix[0][3];
    const y = matrix[1][3];
    const z = matrix[2][3];
    const ry = Math.atan2(
      -matrix[2][0],
      Math.sqrt(matrix[0][0] ** 2 + matrix[1][0] ** 2)
    );

    const rx = Math.atan2(
      matrix[2][1] / Math.cos(ry),
      matrix[2][2] / Math.cos(ry)
    );

    const rz = Math.atan2(
      matrix[1][0] / Math.cos(ry),
      matrix[0][0] / Math.cos(ry)
    );

    return {
      x,
      y,
      z,
      rx: unit(rx, "rad").toNumber("deg"),
      ry: unit(ry, "rad").toNumber("deg"),
      rz: unit(rz, "rad").toNumber("deg"),
    };
  }

  static getJ1Angle(x: number, y: number) {
    if (x === 0) {
      return -90; // Equivalent to RADIANS(-90) if the result is in degrees
    } else if (x >= 0 && y > 0) {
      return Math.atan(y / x) * (180 / Math.PI); // DEGREES(ATAN((y)/(x)))
    } else if (x >= 0 && y < 0) {
      return Math.atan(y / x) * (180 / Math.PI); // DEGREES(ATAN((y)/(x)))
    } else if (x < 0 && y <= 0) {
      return -180 + Math.atan(y / x) * (180 / Math.PI); // -180+DEGREES(ATAN((y)/(x)))
    } else if (x <= 0 && y > 0) {
      return 180 + Math.atan(y / x) * (180 / Math.PI); // 180+DEGREES(ATAN((y)/(x)))
    }
    return 0; // Default or error case, depending on expected input
  }
}

const DH_Parameters = {
  J1: {
    theta: (angleInRadians: number) => angleInRadians,
    alpha: unit(-90, "deg").value,
    d: 184,
    a: 65,
  },
  J2: {
    theta: (angleInRadians: number) => angleInRadians - unit(90, "deg").value,
    alpha: unit(0, "deg").value,
    d: 0,
    a: 300,
  },
  J3: {
    theta: (angleInRadians: number) => angleInRadians + unit(180, "deg").value,
    alpha: unit(90, "deg").value,
    d: 0,
    a: 0,
  },
  J4: {
    theta: (angleInRadians: number) => angleInRadians,
    alpha: unit(-90, "deg").value,
    d: 227.328,
    a: 0,
  },
  J5: {
    theta: (angleInRadians: number) => angleInRadians,
    alpha: unit(90, "deg").value,
    d: 0,
    a: 0,
  },
  J6: {
    theta: (angleInRadians: number) => angleInRadians,
    alpha: unit(0, "deg").value,
    d: 43,
    a: 0,
  },
};

export function createKinematics() {
  return new Kinematics(DH_Parameters);
}
