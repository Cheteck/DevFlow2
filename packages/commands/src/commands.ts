/**
 * @mosaix/commands — CQRS Command Bus
 */

export interface Command<TPayload = unknown> {
  readonly commandName: string;
  readonly payload: TPayload;
  readonly timestamp?: string;
}

export interface CommandHandler<TCommand extends Command = Command, TResult = unknown> {
  handle(command: TCommand): Promise<TResult> | TResult;
}

export class CommandBus {
  private handlers = new Map<string, CommandHandler<never, unknown>>();

  register<TCommand extends Command, TResult>(
    commandName: string,
    handler: CommandHandler<TCommand, TResult>,
  ): void {
    if (this.handlers.has(commandName)) {
      throw new Error(`Handler for command [${commandName}] is already registered.`);
    }
    this.handlers.set(commandName, handler as unknown as CommandHandler<never, unknown>);
  }

  async execute<TCommand extends Command, TResult>(command: TCommand): Promise<TResult> {
    const handler = this.handlers.get(command.commandName);
    if (!handler) {
      throw new Error(`No handler registered for command [${command.commandName}].`);
    }
    return (handler as unknown as CommandHandler<TCommand, TResult>).handle(command);
  }
}
