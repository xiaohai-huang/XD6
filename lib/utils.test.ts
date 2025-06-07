import { describe, it, expect, vi } from "vitest";
import { getCoordinatedSpeeds } from "./utils";

describe("getCoordinatedSpeeds", () => {
  vi.mock("../config", () => ({
    JOINT_CONFIGS: {
      J1: { MAX_SPEED: 10 },
      J2: { MAX_SPEED: 20 },
      J3: { MAX_SPEED: 15 },
      J4: { MAX_SPEED: 25 },
      J5: { MAX_SPEED: 30 },
      J6: { MAX_SPEED: 40 },
    },
  }));
  it("should calculate coordinated speeds for given delta angles", () => {
    const deltaAngles = [10, 20, 15, 25, 30, 40];
    const result = getCoordinatedSpeeds(deltaAngles);

    expect(result).toEqual([10, 20, 15, 25, 30, 40]);
  });

  it("should handle zero delta angles", () => {
    const deltaAngles = [0, 0, 0, 0, 0, 0];
    const result = getCoordinatedSpeeds(deltaAngles);

    expect(result).toEqual([0, 0, 0, 0, 0, 0]);
  });

  it("should handle negative delta angles", () => {
    const deltaAngles = [-10, -20, -15, -25, -30, -40];
    const result = getCoordinatedSpeeds(deltaAngles);

    expect(result).toEqual([10, 20, 15, 25, 30, 40]);
  });

  it("should handle mixed positive and negative delta angles", () => {
    const deltaAngles = [10, -20, 15, -25, 30, -40];
    const result = getCoordinatedSpeeds(deltaAngles);

    expect(result).toEqual([10, 20, 15, 25, 30, 40]);
  });
});
