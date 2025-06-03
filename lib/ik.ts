import { multiply, unit } from "mathjs";

// theta is a variable that represents the joint angle in radians
// theta's input is is radians
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

// Function to create a homogeneous transformation matrix from position and orientation
// x, y, z are the position coordinates
// rx, ry, rz are the Euler angles in radians representing orientation
// The matrix is a 4x4 matrix that represents the transformation in 3D space

/**
 * Function to create a homogeneous transformation matrix from position and orientation
 * @param x
 * @param y
 * @param z
 * @param rx the Euler angles in radians representing orientation
 * @param ry the Euler angles in radians representing orientation
 * @param rz the Euler angles in radians representing orientation
 * @returns A 4x4 matrix that represents the transformation in 3D space
 */
function createHomogeneousMatrix(
  x: number,
  y: number,
  z: number,
  rx: number,
  ry: number,
  rz: number
) {
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

function createDHMatrix(theta: number, alpha: number, d: number, a: number) {
  // prettier-ignore
  return [
        [Math.cos(theta), -Math.sin(theta) * Math.cos(alpha), Math.sin(theta) * Math.sin(alpha), a * Math.cos(theta)],
        [Math.sin(theta), Math.cos(theta) * Math.cos(alpha), -Math.cos(theta) * Math.sin(alpha), a * Math.sin(theta)],
        [0, Math.sin(alpha), Math.cos(alpha), d],
        [0, 0, 0, 1],
    ];
}

const toolFrame = createHomogeneousMatrix(0, 0, 0, 0, 0, 0);

/**
 * Get the transformation matrix from the base frame to the tool frame using forward kinematics.
 * @param jointAngles - An array of joint angles in radians, where each index corresponds to a joint (J1 to J6).
 * @param toolFrame - A 4x4 matrix representing the tool frame in the base frame.
 * @returns
 */
function forwardKinematics(jointAngles: number[], toolFrame: number[][]) {
  const T01 = createDHMatrix(
    DH_Parameters.J1.theta(jointAngles[0]),
    DH_Parameters.J1.alpha,
    DH_Parameters.J1.d,
    DH_Parameters.J1.a
  );
  const T12 = createDHMatrix(
    DH_Parameters.J2.theta(jointAngles[1]),
    DH_Parameters.J2.alpha,
    DH_Parameters.J2.d,
    DH_Parameters.J2.a
  );
  const T23 = createDHMatrix(
    DH_Parameters.J3.theta(jointAngles[2]),
    DH_Parameters.J3.alpha,
    DH_Parameters.J3.d,
    DH_Parameters.J3.a
  );
  const T34 = createDHMatrix(
    DH_Parameters.J4.theta(jointAngles[3]),
    DH_Parameters.J4.alpha,
    DH_Parameters.J4.d,
    DH_Parameters.J4.a
  );
  const T45 = createDHMatrix(
    DH_Parameters.J5.theta(jointAngles[4]),
    DH_Parameters.J5.alpha,
    DH_Parameters.J5.d,
    DH_Parameters.J5.a
  );
  const T56 = createDHMatrix(
    DH_Parameters.J6.theta(jointAngles[5]),
    DH_Parameters.J6.alpha,
    DH_Parameters.J6.d,
    DH_Parameters.J6.a
  );
  const T0_Tool = multiply(T01, T12, T23, T34, T45, T56, toolFrame); // Multiply all transformation matrices to get the final transformation matrix

  return T0_Tool; // Return the final transformation matrix from base to tool frame
}

console.log("Forward Kinematics Example:");
const jointAngles = [0, 20, -89, 0, 45, 0]; // Example joint angles in degrees
const R_Base_to_Tool = forwardKinematics(
  jointAngles.map((angle) => unit(angle, "deg").value), // Convert angles to radians
  toolFrame
); // Convert angles to radians

console.log("Tool Frame (Transformation Matrix):", R_Base_to_Tool);
const values = extractHomogeneousMatrix(R_Base_to_Tool);

// convert radians to degrees for output
values.rx = unit(values.rx, "rad").toNumber("deg");
values.ry = unit(values.ry, "rad").toNumber("deg");
values.rz = unit(values.rz, "rad").toNumber("deg");
console.log("Extracted Values:", values);
