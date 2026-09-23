import { describe, expect, it } from "vitest";
import { CommandBus, type Command, type CommandHandler } from "./commands";

describe("CommandBus", () => {
  interface CreateUserCommand extends Command<{ name: string }> {
    commandName: "CreateUser";
  }

  class CreateUserHandler implements CommandHandler<CreateUserCommand, { id: string; name: string }> {
    async handle(command: CreateUserCommand) {
      return { id: "usr-1", name: command.payload.name };
    }
  }

  it("registers and executes command handlers", async () => {
    const bus = new CommandBus();
    bus.register("CreateUser", new CreateUserHandler());

    const result = await bus.execute<CreateUserCommand, { id: string; name: string }>({
      commandName: "CreateUser",
      payload: { name: "John" },
    });

    expect(result).toEqual({ id: "usr-1", name: "John" });
  });

  it("throws when executing an unregistered command", async () => {
    const bus = new CommandBus();
    await expect(
      bus.execute({ commandName: "Unknown", payload: {} })
    ).rejects.toThrow("No handler registered for command [Unknown].");
  });
});
