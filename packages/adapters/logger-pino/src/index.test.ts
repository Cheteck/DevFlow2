import { describe, expect, it } from "vitest";
import { PinoLoggerAdapter } from "./index";

describe("PinoLoggerAdapter", () => {
  it("can log messages and metadata", () => {
    // Standard mock of a destination stream to capture logs in memory
    const logs: string[] = [];
    const stream = {
      write(str: string) {
        logs.push(str.trim());
      },
    };

    const logger = new PinoLoggerAdapter({ level: "debug" }, stream);

    logger.debug("Debug msg");
    logger.info("Info msg", { val: 42 });
    logger.warn("Warn msg");
    logger.error("Error msg", new Error("test_err"), { detail: "test" });

    expect(logs).toHaveLength(4);
    expect(logs[0]).toContain("Debug msg");
    expect(logs[1]).toContain("Info msg");
    expect(logs[1]).toContain('"val":42');
    expect(logs[2]).toContain("Warn msg");
    expect(logs[3]).toContain("Error msg");
    expect(logs[3]).toContain("test_err");
  });
});
