/**
 * HTTP integration tests for the global BAC access policy (guest boundary).
 *
 * Boots the REAL server (`tsx src/start.ts`) on ephemeral ports with an
 * isolated sqlite copy — no mocks. Proves the guard is actually wired:
 * unit tests of the resolver cannot catch a guard that is never called.
 *
 * Suite A (MOSAIX_DEMO_USERS=false): anonymous matrix + forged cookies.
 * Suite B (MOSAIX_DEMO_USERS=true): demo personas keep working + imperia 403.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { spawn, execFileSync, spawnSync, type ChildProcess } from "node:child_process";

const ROOT = process.cwd();
const BOOT_TIMEOUT_MS = 150_000;
const TEST_TIMEOUT_MS = 180_000;

interface BootedServer {
  baseUrl: string;
  kill: () => Promise<void>;
}

/**
 * Kills any leftover listener on `port` (orphans from killed runs would
 * otherwise serve STALE code to the readiness probe and the tests).
 * Best effort: never fails the suite.
 */
async function freePort(port: number): Promise<void> {
  try {
    if (process.platform === "win32") {
      const out = execFileSync(
        `netstat -ano | findstr :${port} | findstr LISTENING`,
        { encoding: "utf8", timeout: 15_000, shell: true },
      );
      const pids = new Set<string>();
      for (const line of out.split("\n")) {
        const m = line.trim().match(/(\d+)\s*$/);
        if (m) pids.add(m[1]);
      }
      for (const pid of pids) {
        try {
          execFileSync(`taskkill /PID ${pid} /T /F`, { stdio: "ignore", timeout: 15_000, shell: true });
        } catch {
          /* already gone */
        }
      }
    } else {
      try {
        execFileSync(`fuser -k ${port}/tcp`, { stdio: "ignore", timeout: 15_000, shell: true });
      } catch {
        /* free already */
      }
    }
  } catch {
    /* nothing listening */
  }
  await new Promise((r) => setTimeout(r, 1000));
}

async function waitForReady(baseUrl: string): Promise<void> {

  const deadline = Date.now() + BOOT_TIMEOUT_MS;
  for (;;) {
    try {
      const res = await fetch(`${baseUrl}/healthz`, { redirect: "manual" });
      if (res.status < 500) return;
    } catch {
      // not listening yet
    }
    if (Date.now() > deadline) {
      throw new Error(`server at ${baseUrl} never became ready`);
    }
    await new Promise((r) => setTimeout(r, 500));
  }
}

async function ensurePostgresDb(dbName: string): Promise<string> {
  // Clone the migrated dev database (structure + data). A fresh `migrate`
  // is currently broken repo-wide (booking.slots collision on empty DB),
  // so cloning is the only honest isolated baseline. Source DB defaults to
  // the local dev database; override with MOSAIX_HTTP_SOURCE_DB.
  const source = process.env.MOSAIX_HTTP_SOURCE_DB ?? "mosaix_dev";
  // NOTE: `docker` is a real executable → shell:false (shell:true mangles
  // the pipe through cmd concatenation).
  const dockerOpts = { stdio: "ignore" as const, timeout: 180_000, shell: false };
  try {
    execFileSync("docker", ["exec", "mosaix-db-1", "dropdb", "-U", "mosaix", dbName], dockerOpts);
  } catch {
    /* absent — nothing to drop */
  }
  execFileSync("docker", ["exec", "mosaix-db-1", "createdb", "-U", "mosaix", dbName], dockerOpts);
  execFileSync(
    "docker",
    ["exec", "mosaix-db-1", "sh", "-c", `pg_dump -U mosaix ${source} | psql -U mosaix -q ${dbName}`],
    dockerOpts,
  );
  return `postgresql://mosaix:mosaix@localhost:5432/${dbName}`;
}

async function bootServer(port: number, demoUsers: boolean): Promise<BootedServer> {
  // Never test against a stale orphan server: free the port first so the
  // readiness probe below can only succeed on the process we just spawned.
  await freePort(port);
  const dbName = `mosaix_http_test_${port}`;
  // Isolated database cloned from the migrated dev DB (see
  // ensurePostgresDb), then booted with the same env.
  const databaseUrl = await ensurePostgresDb(dbName);

  const serverEnv = {
    ...process.env,
    MOSAIX_PORT: String(port),
    MOSAIX_DATABASE_URL: databaseUrl,
    DATABASE_URL: databaseUrl,
    MOSAIX_DEMO_USERS: demoUsers ? "true" : "false",
  };

  const child: ChildProcess = spawn("npx", ["tsx", "src/start.ts"], {
    cwd: ROOT,
    shell: true,
    env: serverEnv,
    stdio: "ignore",
  });

  const baseUrl = `http://127.0.0.1:${port}`;
  try {
    await waitForReady(baseUrl);
  } catch (err) {
    try {
      child.kill();
    } catch {
      /* already gone */
    }
    throw err;
  }

  return {
    baseUrl,
    kill: async () => {
      // `shell: true` wraps tsx in cmd.exe: plain kill() only ends the
      // wrapper, leaving the server listening. Kill the whole tree.
      try {
        if (child.pid !== undefined) {
          if (process.platform === "win32") {
            spawnSync("taskkill", ["/pid", String(child.pid), "/T", "/F"], {
              stdio: "ignore",
            });
          } else {
            child.kill("SIGKILL");
          }
        } else {
          child.kill();
        }
      } catch {
        /* already gone */
      }
      await new Promise((r) => setTimeout(r, 1500));
    },
  };
}

async function getRaw(baseUrl: string, p: string, cookie?: string) {
  return fetch(`${baseUrl}${p}`, {
    redirect: "manual",
    headers: cookie ? { cookie } : {},
  });
}

describe("HTTP BAC access — anonymous (demo off)", () => {
  let server: BootedServer;

  beforeAll(async () => {
    server = await bootServer(3217, false);
  }, BOOT_TIMEOUT_MS);

  afterAll(async () => {
    await server.kill();
  });

  it("GET / redirects to the public vitrine", async () => {
    const res = await getRaw(server.baseUrl, "/");
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("/commerce");
  });

  it("GET /commerce renders the vitrine with auth buttons, no user menu", async () => {
    const res = await getRaw(server.baseUrl, "/commerce");
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('id="auth-buttons"');
    expect(html).not.toContain('id="user-menu-dropdown"');
    expect(html).not.toContain("Utilisateur local");
    // Guest sidebar: marketplace + spaces only (policy-derived).
    expect(html).toContain('href="/commerce"');
    expect(html).toContain('href="/spaces"');
    expect(html).not.toContain('href="/solara"');
    expect(html).not.toContain('href="/beam"');
    expect(html).not.toContain('href="/imperia"');
    expect(html).not.toContain('href="/subscription"');
  });

  it("GET /commerce?view=cart redirects to login with next", async () => {
    const res = await getRaw(server.baseUrl, "/commerce?view=cart");
    expect(res.status).toBe(302);
    const location = res.headers.get("location") ?? "";
    expect(location.startsWith("/login?next=")).toBe(true);
    expect(decodeURIComponent(location)).toContain("/commerce?view=cart");
  });

  it("GET /solara redirects to login (no anonymous feed)", async () => {
    for (const p of ["/solara", "/solara?view=feed", "/solara?view=profile"]) {
      const res = await getRaw(server.baseUrl, p);
      expect(res.status).toBe(302);
      expect((res.headers.get("location") ?? "").startsWith("/login?next=")).toBe(true);
    }
  });

  it("GET /beam, /portfolio and /imperia redirect anonymous visitors to login", async () => {
    for (const p of ["/beam", "/portfolio", "/portfolio?view=search", "/booking", "/imperia"]) {
      const res = await getRaw(server.baseUrl, p);
      expect(res.status).toBe(302);
      expect((res.headers.get("location") ?? "").startsWith("/login?next=")).toBe(true);
    }
  });

  it("GET /spaces renders the public directory without the member area", async () => {
    const res = await getRaw(server.baseUrl, "/spaces");
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("Espaces de Travail");
    expect(html).not.toContain("Annuaire des Membres");
    expect(html).not.toContain("Gérer l'Espace");
    expect(html).not.toContain("Inviter membre");
  });

  it("GET /spaces?view=profile hides members from guests, ?view=new redirects", async () => {
    const profile = await getRaw(server.baseUrl, "/spaces?view=profile");
    expect(profile.status).toBe(200);
    const html = await profile.text();
    expect(html).not.toContain("Annuaire des Membres");
    const creation = await getRaw(server.baseUrl, "/spaces?view=new");
    expect(creation.status).toBe(302);
    expect((creation.headers.get("location") ?? "").startsWith("/login?next=")).toBe(true);
  });

  it("GET /commerce renders an honest empty vitrine (no mocks)", async () => {
    const res = await getRaw(server.baseUrl, "/commerce");
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("Aucune offre publiée");
    expect(html).not.toContain("Xiaomi");
  });

  it("forged role cookie grants nothing in demo-off mode", async () => {
    const res = await getRaw(server.baseUrl, "/solara", "mosaix_role=admin");
    expect(res.status).toBe(302);
    const html = await (await getRaw(server.baseUrl, "/commerce", "mosaix_role=admin")).text();
    expect(html).not.toContain('id="user-menu-dropdown"');
  });

  it("GET /login renders a functional form", async () => {
    const res = await getRaw(server.baseUrl, "/login?next=/solara");
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('id="login-form"');
    expect(html).toContain("/api/auth/login");
  });

  it("POST /api/auth/login without a wired AuthManager is an honest 503", async () => {
    const res = await fetch(`${server.baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "nobody@example.com", password: "wrong" }),
    });
    // No providers/stores in the shared Shell composition (Citadelle owns
    // login): 503, never a fabricated 401 — credentials are not even read.
    expect(res.status).toBe(503);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.error).toBeDefined();
    expect(JSON.stringify(body)).not.toContain("nobody@example.com");
  });

  it("POST /api/auth/register is an explicit 501 (no fake signup)", async () => {
    const res = await fetch(`${server.baseUrl}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "a@b.c", password: "x" }),
    });
    expect(res.status).toBe(501);
    expect(((await res.json()) as Record<string, unknown>).error).toBe(
      "registration_not_enabled",
    );
  });
}, TEST_TIMEOUT_MS);

describe("HTTP BAC access — demo personas (demo on)", () => {
  let server: BootedServer;

  beforeAll(async () => {
    server = await bootServer(3218, true);
  }, BOOT_TIMEOUT_MS);

  afterAll(async () => {
    await server.kill();
  });

  it("demo admin opens solara and imperia", async () => {
    const solara = await getRaw(server.baseUrl, "/solara?role=admin");
    expect(solara.status).toBe(200);
    const imperia = await getRaw(server.baseUrl, "/imperia?role=admin");
    expect(imperia.status).toBe(200);
  });

  it("demo member gets 403 on imperia", async () => {
    const res = await getRaw(server.baseUrl, "/imperia?role=member");
    expect(res.status).toBe(403);
  });
}, TEST_TIMEOUT_MS);
