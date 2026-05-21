import { describe, expect, it } from "bun:test";
import type { WranglerConfig } from "../types";
import { createDeclarativeHandler, rateLimitsHandler } from "./declarative";
import type { HandlerContext } from "./types";

const AUTH = { apiToken: "tok", accountId: "acc" };

function makeCtx(overrides: Partial<HandlerContext> = {}): HandlerContext {
  return { auth: AUTH, scriptName: "worker", prefix: "", dryRun: false, fetch: globalThis.fetch, ...overrides };
}

describe("createDeclarativeHandler()", () => {
  it("reconcile always returns exists action", async () => {
    const handler = createDeclarativeHandler(
      "hyperdrive",
      "Hyperdrive",
      (c) => (c.hyperdrive ?? []) as unknown as { binding?: string; name?: string; [key: string]: unknown }[],
    );
    const entries = [{ binding: "MY_HD", id: "hd-1" }];
    const res = await handler.reconcile(entries, makeCtx());
    expect(res.results[0].action).toBe("exists");
    expect(res.results[0].binding).toBe("MY_HD");
  });

  it("reconcile returns empty for empty entries", async () => {
    const handler = createDeclarativeHandler("ai", "AI", () => []);
    const res = await handler.reconcile([], makeCtx());
    expect(res.results).toHaveLength(0);
  });

  it("reconcile works even in dry-run mode (no API calls)", async () => {
    const handler = createDeclarativeHandler("vectorize", "Vectorize", () => [{ binding: "VEC" }] as { binding?: string; name?: string; [key: string]: unknown }[]);
    const res = await handler.reconcile([{ binding: "VEC" }], makeCtx({ dryRun: true }));
    expect(res.results[0].action).toBe("exists");
  });
});

describe("rateLimitsHandler", () => {
  it("extracts ratelimits from config", () => {
    const config: WranglerConfig = {
      name: "t",
      ratelimits: [{ name: "RATE_LIMITER", namespace_id: "rl-ns", simple: { limit: 5, period: 60 } }],
    };
    const entries = rateLimitsHandler.extract(config);
    expect(entries).toHaveLength(1);
  });

  it("returns exists for each ratelimit", async () => {
    const entries = [{ name: "RATE_LIMITER", namespace_id: "ns" }] as { binding?: string; name?: string; [key: string]: unknown }[];
    const res = await rateLimitsHandler.reconcile(entries, makeCtx());
    expect(res.results[0].action).toBe("exists");
    expect(res.results[0].binding).toBe("RATE_LIMITER");
  });
});
