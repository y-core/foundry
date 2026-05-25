import { describe, expect, it } from "bun:test";
import type { WranglerConfig } from "../types";
import type { HandlerContext } from "./types";
import { varsHandler } from "./vars";

const AUTH = { apiToken: "tok", accountId: "acc" };

function makeCtx(overrides: Partial<HandlerContext> = {}): HandlerContext {
  return { auth: AUTH, scriptName: "worker", prefix: "", dryRun: false, fetch: globalThis.fetch, ...overrides };
}

function makeFetch(remoteBindings: unknown[], patchOk = true): typeof globalThis.fetch {
  return async (_url, init) => {
    const method = (init?.method ?? "GET").toUpperCase();
    if (method === "PATCH") {
      if (!(init?.body instanceof FormData)) throw new Error("PATCH must use FormData body");
      if (!patchOk) return new Response(JSON.stringify({ success: false, errors: [{ code: 1, message: "patch failed" }], messages: [], result: null }), { status: 400 });
      return new Response(JSON.stringify({ success: true, errors: [], messages: [], result: {} }));
    }
    return new Response(JSON.stringify({ success: true, errors: [], messages: [], result: { bindings: remoteBindings } }));
  };
}

describe("varsHandler.extract()", () => {
  it("returns empty when no vars", () => {
    expect(varsHandler.extract({ name: "t" } as WranglerConfig)).toEqual([]);
  });

  it("converts vars object to entries", () => {
    const config: WranglerConfig = { name: "t", vars: { EMAIL: "x@y.com", DEBUG: "true" } };
    const entries = varsHandler.extract(config);
    expect(entries).toHaveLength(2);
    expect(entries.find((e) => e.name === "EMAIL")?.value).toBe("x@y.com");
  });
});

describe("varsHandler.reconcile()", () => {
  it("reports exists when var already remote", async () => {
    const fetchFn = makeFetch([{ type: "plain_text", name: "EMAIL", text: "x@y.com" }]);
    const res = await varsHandler.reconcile([{ name: "EMAIL", value: "x@y.com" }], makeCtx({ fetch: fetchFn }));
    expect(res.results[0].action).toBe("exists");
    expect(res.results[0].remoteName).toBe("EMAIL");
  });

  it("updates vars not in remote", async () => {
    const res = await varsHandler.reconcile([{ name: "NEW_VAR", value: "val" }], makeCtx({ fetch: makeFetch([]) }));
    expect(res.results[0].action).toBe("updated");
  });

  it("skips in dry-run", async () => {
    const res = await varsHandler.reconcile([{ name: "VAR", value: "v" }], makeCtx({ fetch: makeFetch([]), dryRun: true }));
    expect(res.results[0].action).toBe("skipped");
  });

  it("reports error when PATCH fails", async () => {
    const res = await varsHandler.reconcile([{ name: "VAR", value: "v" }], makeCtx({ fetch: makeFetch([], false) }));
    expect(res.results[0].action).toBe("error");
  });
});
