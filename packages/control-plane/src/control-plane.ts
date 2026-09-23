/**
 * @mosaix/control-plane — Admin Server, DLQ Inspector & Circuit Breaker Metrics
 */

import { Controller, Router, type HttpRequest, type HttpResponse } from "@mosaix/http";
import { Guard, Policy, type UserContext } from "@mosaix/security";

export interface AppTopologyEntry {
  id: string;
  name: string;
  status: "ACTIVE" | "DEGRADED" | "STOPPED";
}

export class ControlPlaneController extends Controller {
  private topology: AppTopologyEntry[] = [];
  private dlqEvents: Array<{ id: string; eventType: string; reason: string }> = [];
  private circuitBreakers = new Map<string, "CLOSED" | "OPEN" | "HALF_OPEN">();
  private guard: Guard;

  constructor() {
    super();
    const policy = new Policy();
    policy.define("read-admin", (user: UserContext) => user.roles.includes("admin"));
    this.guard = new Guard(policy);
  }

  registerApp(entry: AppTopologyEntry): void {
    this.topology.push(entry);
  }

  registerDLQEvent(id: string, eventType: string, reason: string): void {
    this.dlqEvents.push({ id, eventType, reason });
  }

  setCircuitState(name: string, state: "CLOSED" | "OPEN" | "HALF_OPEN"): void {
    this.circuitBreakers.set(name, state);
  }

  private principalFrom(req: HttpRequest): UserContext | null {
    const p = req.principal;
    if (!p) return null;
    return { id: p.sub, roles: p.roles ?? [] };
  }

  async getTopology(req: HttpRequest): Promise<HttpResponse> {
    const user = this.principalFrom(req);
    if (!user) return { statusCode: 401, body: { error: "Unauthorized" } };
    await this.guard.authorize(user, "read-admin");
    return this.json({ applications: this.topology });
  }

  async getDLQEvents(req: HttpRequest): Promise<HttpResponse> {
    const user = this.principalFrom(req);
    if (!user) return { statusCode: 401, body: { error: "Unauthorized" } };
    await this.guard.authorize(user, "read-admin");
    return this.json({ dlqEvents: this.dlqEvents });
  }

  async replayDLQEvent(req: HttpRequest): Promise<HttpResponse> {
    const user = this.principalFrom(req);
    if (!user) return { statusCode: 401, body: { error: "Unauthorized" } };
    await this.guard.authorize(user, "read-admin");
    const body = req.body as { id?: string };
    if (!body?.id) {
      return this.badRequest("Missing DLQ event id");
    }
    this.dlqEvents = this.dlqEvents.filter((e) => e.id !== body.id);
    return this.json({ message: `DLQ Event [${body.id}] replayed successfully`, remainingDlqCount: this.dlqEvents.length });
  }

  async getCircuitBreakers(req: HttpRequest): Promise<HttpResponse> {
    const user = this.principalFrom(req);
    if (!user) return { statusCode: 401, body: { error: "Unauthorized" } };
    await this.guard.authorize(user, "read-admin");
    return this.json({ circuitBreakers: Object.fromEntries(this.circuitBreakers) });
  }
}

export class ControlPlaneServer {
  readonly router = new Router();
  readonly controller = new ControlPlaneController();

  constructor() {
    this.router.get("/admin/topology", (req) => this.controller.getTopology(req));
    this.router.get("/admin/dlq", (req) => this.controller.getDLQEvents(req));
    this.router.post("/admin/dlq/replay", (req) => this.controller.replayDLQEvent(req));
    this.router.get("/admin/circuit-breaker", (req) => this.controller.getCircuitBreakers(req));
  }
}
