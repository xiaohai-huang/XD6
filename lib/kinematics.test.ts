import { describe, it, expect } from "vitest";
import { createKinematics, Kinematics } from "./kinematics.ts";

function matrixEqual(a: number[][], b: number[][]): boolean {
  if (a.length !== b.length || a[0].length !== b[0].length) {
    return false;
  }
  for (let i = 0; i < a.length; i++) {
    for (let j = 0; j < a[i].length; j++) {
      const roundedA = Math.round(a[i][j] * 1000) / 1000;
      const roundedB = Math.round(b[i][j] * 1000) / 1000;
      if (roundedA !== roundedB) {
        console.error(
          `Matrix mismatch at (${i}, ${j}): ${roundedA} != ${roundedB}`
        );
        return false;
      }
    }
  }
  return true;
}

describe("Forward Kinematics", () => {
  const kinematics = createKinematics();

  it("should compute forward kinematics for zero angles", () => {
    const angles = [0, 0, 0, 0, 0, 0];
    const result = kinematics.forwardKinematics(angles);
    const R_0_T = [
      [0, 0, 1, 335.328],
      [0, 1, 0, 0],
      [-1, 0, 0, 484],
      [0, 0, 0, 1],
    ];

    expect(matrixEqual(result, R_0_T)).toBe(true);

    const extracted = Kinematics.extractHomogeneousMatrix(result);
    expect(extracted.x).toBeCloseTo(335.328, 3);
    expect(extracted.y).toBeCloseTo(0, 3);
    expect(extracted.z).toBeCloseTo(484, 3);
    expect(extracted.ry).toBeCloseTo(90, 3);
    expect(extracted.rx).toBeCloseTo(45, 3);
    expect(extracted.rz).toBeCloseTo(45, 3);
  });

  it("should compute forward kinematics for J1-J6 [5,10,3,5,6,1]", () => {
    const angles = [5, 10, 3, 5, 6, 1];
    const result = kinematics.forwardKinematics(angles);
    const R_0_T = [
      [-0.332, -0.062, 0.941, 377.78],
      [0.075, 0.993, 0.091, 33.445],
      [-0.94, 0.101, -0.325, 414.322],
      [0.0, 0.0, 0.0, 1.0],
    ];

    expect(matrixEqual(result, R_0_T)).toBe(true);

    const extracted = Kinematics.extractHomogeneousMatrix(result);
    expect(extracted.x).toBeCloseTo(377.78, 3);
    expect(extracted.y).toBeCloseTo(33.445, 3);
    expect(extracted.z).toBeCloseTo(414.322, 3);
    expect(extracted.rz).toBeCloseTo(167.213, 3);
    expect(extracted.ry).toBeCloseTo(70.086, 3);
    expect(extracted.rx).toBeCloseTo(162.69, 3);
  });

  it("should compute forward kinematics for J1-J6  [-150.0, 45.0, 20.0, 31.0, 22.0, 100.0]", () => {
    const angles = [-150.0, 45.0, 20.0, 31.0, 22.0, 100.0];
    const result = kinematics.forwardKinematics(angles);
    const R_0_T = [
      [-0.15, -0.989, 0.009, -322.812],
      [-0.965, 0.144, -0.218, -195.955],
      [0.214, -0.041, -0.976, 148.134],
      [0.0, 0.0, 0.0, 1.0],
    ];

    expect(matrixEqual(result, R_0_T)).toBe(true);

    const extracted = Kinematics.extractHomogeneousMatrix(result);
    expect(extracted.x).toBeCloseTo(-322.812, 3);
    expect(extracted.y).toBeCloseTo(-195.955, 3);
    expect(extracted.z).toBeCloseTo(148.134, 3);
    expect(extracted.rz).toBeCloseTo(-98.81, 3);
    expect(extracted.ry).toBeCloseTo(-12.341, 3);
    expect(extracted.rx).toBeCloseTo(-177.573, 3);
  });
});

describe("Inverse Kinematics", () => {
  const kinematics = createKinematics();
  it("should compute inverse kinematics for J5 90 pose", () => {
    const pose = [292.328, 0.0, 441.0, 180.0, 0.0, 180.0] as const;
    const angles = kinematics.inverseKinematics(...pose, "F");
    expect(angles).toBeDefined();
    expect(angles.length).toBe(6);
    const expected = [0, 0, 0, 0, 90, 0];
    angles.forEach((angle, index) => {
      expect(angle).toBeCloseTo(expected[index], 3);
    });
  });

  it("should compute inverse kinematics for [297.448, 48.897, 435.504, 149.105, -9.278, 174.709]", () => {
    const pose = [297.448, 48.897, 435.504, 149.105, -9.278, 174.709] as const;
    const angles = kinematics.inverseKinematics(...pose, "F");
    expect(angles).toBeDefined();
    expect(angles.length).toBe(6);
    const expected = [5.0, 2.0, 1.0, 32.0, 90.0, 12.0];
    angles.forEach((angle, index) => {
      expect(angle).toBeCloseTo(expected[index]);
    });
  });

  it("should compute inverse kinematics for [-91.962, 187.053, 370.499, 151.842, -34.635, -76.021]", () => {
    const pose = [
      -91.962, 187.053, 370.499, 151.842, -34.635, -76.021,
    ] as const;
    const angles = kinematics.inverseKinematics(...pose, "F");
    expect(angles).toBeDefined();
    expect(angles.length).toBe(6);
    const expected = [110.0, -10.0, 30.0, 32.0, 100.0, 12.0];
    angles.forEach((angle, index) => {
      expect(angle).toBeCloseTo(expected[index]);
    });
  });
});

describe("Inverse Kinematics J1 Angle", () => {
  it("J5 90 degrees", () => {
    const x = 292.328;
    const y = -4.44987660938182e-15;
    expect(Kinematics.getJ1Angle(x, y)).toBeCloseTo(0, 3);
  });

  it("x=-113.262, y=196.176", () => {
    const x = -113.262;
    const y = 196.176;
    expect(Kinematics.getJ1Angle(x, y)).toBeCloseTo(120, 3);
  });

  it("x=-113.262, y=196.176", () => {
    const x = -113.262;
    const y = 196.176;
    expect(Kinematics.getJ1Angle(x, y)).toBeCloseTo(120, 3);
  });

  it("x=-77.476, y=212.863", () => {
    const x = -77.476;
    const y = 212.863;
    expect(Kinematics.getJ1Angle(x, y)).toBeCloseTo(110, 3);
  });

  it("x=-39.335, y=-223.083", () => {
    const x = -39.335;
    const y = -223.083;
    expect(Kinematics.getJ1Angle(x, y)).toBeCloseTo(-100, 3);
  });

  it("x=-3.953, y=-226.489", () => {
    const x = -3.953;
    const y = -226.489;
    expect(Kinematics.getJ1Angle(x, y)).toBeCloseTo(-91, 3);
  });
});
