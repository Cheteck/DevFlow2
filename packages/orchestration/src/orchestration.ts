/**
 * @mosaix/orchestration — Saga / Workflow Orchestration Engine
 */

export interface WorkflowStep<TContext = Record<string, unknown>> {
  name: string;
  execute: (context: TContext) => Promise<void> | void;
  compensate?: (context: TContext) => Promise<void> | void;
}

export class WorkflowEngine<TContext extends object = Record<string, unknown>> {
  private steps: WorkflowStep<TContext>[] = [];

  addStep(step: WorkflowStep<TContext>): this {
    this.steps.push(step);
    return this;
  }

  async execute(initialContext: TContext): Promise<{ success: boolean; context: TContext; error?: Error }> {
    const executedSteps: WorkflowStep<TContext>[] = [];
    const context = { ...initialContext };

    for (const step of this.steps) {
      try {
        await step.execute(context);
        executedSteps.push(step);
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        // Trigger compensation in reverse order
        for (const executedStep of executedSteps.reverse()) {
          if (executedStep.compensate) {
            try {
              await executedStep.compensate(context);
            } catch {
              // Ignore compensation errors
            }
          }
        }
        return { success: false, context, error };
      }
    }

    return { success: true, context };
  }
}
