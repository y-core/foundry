import { describe, expect, it } from "bun:test";
import type { WranglerConfig } from "../types";
import { createSecretsHandler } from "./secrets";
import type { HandlerContext } from "./types";

const AUTH = { apiToken: "tok", accountId: "acc" };

function makeCtx(overrides: Partial<HandlerContext> = {}): HandlerContext {
  return { auth: AUTH, scriptName: "worker", prefix: "", dryRun: false, fetch: globalThis.fetch, ...overrides };
}

function makeFetch(secrets: unknown[], putOk = true): typeof globalThis.fetch {
  return async (_url, init) => {
    const method = (init?.method ?? "GET").toUpperCase();
    if (method === "PUT") {
      if (!putOk) return new Response(JSON.stringify({ success: false, errors: [{ code: 1, message: "put failed" }], messages: [], result: null }), { status: 400 });
      return new Response(JSON.stringify({ success: true, errors: [], messages: [], result: { name: "secret", type: "secret_text" } }));
    }
    return new Response(JSON.stringify({ success: true, errors: [], messages: [], result: secrets }));
  };
}

describe("createSecretsHandler()", () => {
  it("extract returns empty when no .dev.vars", () => {
    const handler = createSecretsHandler("/tmp/no-such-dir");
    expect(handler.extract({} as WranglerConfig)).toEqual([]);
  });
});

describe("secretsHandler.reconcile()", () => {
  const handler = createSecretsHandler("/tmp");

  it("reports exists when secret already remote", async () => {
    const fetchFn = makeFetch([{ name: "SECRET_KEY", type: "secret_text" }]);
    const res = await handler.reconcile([{ name: "SECRET_KEY", value: "val" }], makeCtx({ fetch: fetchFn }));
    expect(res.results[0].action).toBe("exists");
  });

  it("creates secret when not found", async () => {
    const fetchFn = makeFetch([]);
    const res = await handler.reconcile([{ name: "NEW_SECRET", value: "val" }], makeCtx({ fetch: fetchFn }));
    expect(res.results[0].action).toBe("created");
  });

  it("skips in dry-run", async () => {
    const res = await handler.reconcile([{ name: "SECRET", value: "v" }], makeCtx({ fetch: makeFetch([]), dryRun: true }));
    expect(res.results[0].action).toBe("skipped");
  });

  it("reports error when PUT fails", async () => {
    const res = await handler.reconcile([{ name: "BAD_SECRET", value: "v" }], makeCtx({ fetch: makeFetch([], false) }));
    expect(res.results[0].action).toBe("error");
  });

  it("returns empty for empty entries", async () => {
    const res = await handler.reconcile([], makeCtx());
    expect(res.results).toHaveLength(0);
  });
});
