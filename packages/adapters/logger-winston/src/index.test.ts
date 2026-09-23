import { describe, expect, it } from "vitest";
import winston from "winston";
import { WinstonLoggerAdapter } from "./index";

class MemoryTransport extends winston.transports.Console {
  public logs: Record<string, unknown>[] = [];

  constructor() {
    super();
  }

  log(info: Record<string, unknown>, callback: () => void) {
    this.logs.push(info);
    if (callback) callback();
  }
}

describe("WinstonLoggerAdapter", () => {
  it("can log messages and metadata", () => {
    const transport = new MemoryTransport();
    const logger = new WinstonLoggerAdapter({
      level: "debug",
      transports: [transport],
    });

    logger.debug("Debug msg");
    logger.info("Info msg", { val: 42 });
    logger.warn("Warn msg");
    logger.error("Error msg", new Error("test_err"), { detail: "test" });

    expect(transport.logs).toHaveLength(4);
    expect(transport.logs[0]!.message).toBe("Debug msg");
    expect(transport.logs[0]!.level).toBe("debug");
    expect(transport.logs[1]!.message).toBe("Info msg");
    expect(transport.logs[1]!.val).toBe(42);
    expect(transport.logs[2]!.message).toBe("Warn msg");
    expect(transport.logs[3]!.message).toBe("Error msg");
    const err = transport.logs[3]!.err as { message: string };
    expect(err.message).toBe("test_err");
  });
});
