import { multiply, unit } from "mathjs";

// Define DH parameters for each joint
// Note: The value passed to theta functions must be in radians.
const DH_Parameters = {
  J1: {
    theta: (angleInRadians: number) => angleInRadians,
    alpha: unit(-90, "deg").value,
    d: 169.77,
    a: 64.2,
  },
  J2: {
    theta: (angleInRadians: number) => angleInRadians - unit(90, "deg").value,
    alpha: unit(0, "deg").value,
    d: 0,
    a: 305,
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
    d: 222.63,
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
    d: 36.25,
    a: 0,
  },
};

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
function createHomogeneousMatrix(
  x: number,
  y: number,
  z: number,
  rx: number,
  ry: number,
  rz: number
) {
  // Compute rotation matrix components
  return [
    [
      Math.cos(rz) * Math.cos(ry),
      Math.cos(rz) * Math.sin(ry) * Math.sin(rx) - Math.sin(rz) * Math.cos(rx),
      Math.cos(rz) * Math.sin(ry) * Math.cos(rx) + Math.sin(rz) * Math.sin(rx),
      x,
    ],
    [
      Math.sin(rz) * Math.cos(ry),
      Math.sin(rz) * Math.sin(ry) * Math.sin(rx) + Math.cos(rz) * Math.cos(rx),
      Math.sin(rz) * Math.sin(ry) * Math.cos(rx) - Math.cos(rz) * Math.sin(rx),
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

/**
 *  Extracts position and orientation from a 4x4 homogeneous transformation matrix.
 * @param matrix A 4x4 homogeneous transformation matrix
 * @returns An object containing position (x, y, z) and orientation (rx, ry, rz) in radians.
 */
function extractHomogeneousMatrix(matrix: number[][]) {
  const x = matrix[0][3];
  const y = matrix[1][3];
  const z = matrix[2][3];
  const rx = Math.atan2(matrix[2][1], matrix[2][2]); // Roll
  const ry = Math.asin(-matrix[2][0]); // Pitch
  const rz = Math.atan2(matrix[1][0], matrix[0][0]); // Yaw
  return { x, y, z, rx, ry, rz };
}

/**
 * Create a Denavit-Hartenberg transformation matrix.
 * @param theta Joint angle in radians.
 * @param alpha Twist angle in radians.
 * @param d Offset along the previous z-axis.
 * @param a Offset along the previous x-axis.
 * @returns A 4x4 transformation matrix.
 */
function createDHMatrix(theta: number, alpha: number, d: number, a: number) {
  // prettier-ignore
  return [
    [Math.cos(theta), -Math.sin(theta) * Math.cos(alpha), Math.sin(theta) * Math.sin(alpha), a * Math.cos(theta)],
    [Math.sin(theta), Math.cos(theta) * Math.cos(alpha), -Math.cos(theta) * Math.sin(alpha), a * Math.sin(theta)],
    [0, Math.sin(alpha), Math.cos(alpha), d],
    [0, 0, 0, 1],
  ];
}

/**
 * Compute the transformation matrix from the base frame to the tool frame using forward kinematics.
 * @param jointAngles Array of joint angles in radians (J1 to J6).
 * @param toolFrame A 4x4 matrix representing the tool frame in the base frame.
 * @returns The final transformation matrix from base to tool frame.
 */
function forwardKinematics(jointAngles: number[], toolFrame: number[][]) {
  const matrices = Object.keys(DH_Parameters).map((joint, index) => {
    const params = DH_Parameters[joint as keyof typeof DH_Parameters];
    return createDHMatrix(
      params.theta(jointAngles[index]),
      params.alpha,
      params.d,
      params.a
    );
  });
  return multiply(...matrices, toolFrame); // Multiply all matrices to get the final transformation
}

// Example usage
console.log("Forward Kinematics Example:");
const jointAngles = [0, 20, -89, 0, 45, 0]; // Example joint angles in degrees
const R_Base_to_Tool = forwardKinematics(
  jointAngles.map((angle) => unit(angle, "deg").value), // Convert angles to radians
  createHomogeneousMatrix(0, 0, 0, 0, 0, 0)
);

console.log("Tool Frame (Transformation Matrix):", R_Base_to_Tool);
const values = extractHomogeneousMatrix(R_Base_to_Tool);

// Convert radians to degrees for output
values.rx = unit(values.rx, "rad").toNumber("deg");
values.ry = unit(values.ry, "rad").toNumber("deg");
values.rz = unit(values.rz, "rad").toNumber("deg");
console.log("Extracted Values:", values);
