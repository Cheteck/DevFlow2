import { describe, expect, it } from "vitest";
import { Controller, HttpRequest, Router } from "./http";

class UserController extends Controller {
  getUser(req: HttpRequest) {
    return this.json({ id: req.params?.id ?? "1", name: "Alice" });
  }

  createUser(req: HttpRequest<{ name: string }>) {
    return this.created({ id: "2", name: req.body?.name });
  }
}

describe("HTTP & Controller SDK", () => {
  it("handles HTTP routes via Router and Controller", async () => {
    const controller = new UserController();
    const router = new Router();

    router.get("/users/1", (req) => controller.getUser(req));
    router.post("/users", (req) => controller.createUser(req));

    const res1 = await router.handle({ method: "GET", path: "/users/1", headers: {} });
    expect(res1.statusCode).toBe(200);
    expect(res1.body).toEqual({ id: "1", name: "Alice" });

    const res2 = await router.handle({
      method: "POST",
      path: "/users",
      headers: {},
      body: { name: "Bob" },
    });
    expect(res2.statusCode).toBe(201);
    expect(res2.body).toEqual({ id: "2", name: "Bob" });
  });
});
