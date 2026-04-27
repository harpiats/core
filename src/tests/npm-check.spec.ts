import { describe, expect, test, spyOn, afterEach } from "bun:test";
import { checkNpmVersion } from "../utils/npm-check";

describe("NPM Check", () => {
  afterEach(() => {
  });

  test("should spawn bun process to check npm version", async () => {
    const spawnSpy = spyOn(Bun, "spawn").mockImplementation(() => {
      return {} as any;
    });

    await checkNpmVersion();

    expect(spawnSpy).toHaveBeenCalled();
    const args = spawnSpy.mock.calls[0][0] as string[];
    expect(args[0]).toBe("bun");
    expect(args[1]).toBe("-e");
    
    spawnSpy.mockRestore();
  });
});
