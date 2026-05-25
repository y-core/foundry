import { describe, expect, it } from "bun:test";
import type { WranglerConfig } from "../types";
import { kvHandler } from "./kv";
import type { HandlerContext } from "./types";

const AUTH = { apiToken: "tok", accountId: "acc" };

function makeCtx(overrides: Partial<HandlerContext> = {}): HandlerContext {
  return {
    auth: AUTH,
    scriptName: "my-worker",
    prefix: "",
    dryRun: false,
    fetch: globalThis.fetch,
    ...overrides,
  };
}

function makeFetch(namespaces: unknown[], createResult?: unknown): typeof globalThis.fetch {
  let callCount = 0;
  return async (_url: string | URL | Request, init?: RequestInit) => {
    const method = (init?.method ?? "GET").toUpperCase();
    if (method === "GET") {
      return new Response(JSON.stringify({ success: true, errors: [], messages: [], result: namespaces }));
    }
    callCount++;
    return new Response(JSON.stringify({ success: true, errors: [], messages: [], result: createResult ?? { id: `new-id-${callCount}`, title: "created" } }));
  };
}

describe("kvHandler.extract()", () => {
  it("returns empty array when kv_namespaces absent", () => {
    const config = { name: "test" } as WranglerConfig;
    expect(kvHandler.extract(config)).toEqual([]);
  });

  it("returns kv_namespaces array", () => {
    const config: WranglerConfig = { name: "test", kv_namespaces: [{ binding: "MY_KV" }] };
    expect(kvHandler.extract(config)).toEqual([{ binding: "MY_KV" }]);
  });
});

describe("kvHandler.reconcile()", () => {
  it("returns empty results for empty entries", async () => {
    const ctx = makeCtx();
    const res = await kvHandler.reconcile([], ctx);
    expect(res.results).toHaveLength(0);
  });

  it("reports exists when remote namespace found", async () => {
    const fetchFn = makeFetch([{ id: "ns-1", title: "MY_KV" }]);
    const ctx = makeCtx({ fetch: fetchFn });
    const res = await kvHandler.reconcile([{ binding: "MY_KV" }], ctx);
    expect(res.results[0].action).toBe("exists");
    expect(res.results[0].remoteId).toBe("ns-1");
    expect(res.results[0].remoteName).toBe("MY_KV");
  });

  it("creates namespace when not found", async () => {
    const fetchFn = makeFetch([], { id: "new-ns", title: "MY_KV" });
    const ctx = makeCtx({ fetch: fetchFn });
    const res = await kvHandler.reconcile([{ binding: "MY_KV" }], ctx);
    expect(res.results[0].action).toBe("created");
    expect(res.results[0].remoteId).toBe("new-ns");
    expect(res.entries[0].id).toBe("new-ns");
  });

  it("skips creation in dry-run mode", async () => {
    const fetchFn = makeFetch([]);
    const ctx = makeCtx({ fetch: fetchFn, dryRun: true });
    const res = await kvHandler.reconcile([{ binding: "MY_KV" }], ctx);
    expect(res.results[0].action).toBe("unavailable");
    expect(res.results[0].remoteName).toBe("MY_KV");
  });

  it("applies prefix to remote name", async () => {
    let capturedBody: string | null = null;
    const fetchFn: typeof globalThis.fetch = async (_url, init) => {
      if ((init?.method ?? "GET") === "POST") {
        capturedBody = init?.body as string;
        return new Response(JSON.stringify({ success: true, errors: [], messages: [], result: { id: "x", title: "PROJ_MY_KV" } }));
      }
      return new Response(JSON.stringify({ success: true, errors: [], messages: [], result: [] }));
    };
    const ctx = makeCtx({ fetch: fetchFn, prefix: "PROJ" });
    const res = await kvHandler.reconcile([{ binding: "MY_KV" }], ctx);
    expect(JSON.parse(capturedBody!).title).toBe("PROJ_MY_KV");
    expect(res.results[0].remoteName).toBe("PROJ_MY_KV");
  });

  it("reports error when list API fails", async () => {
    const _fetchFn = makeFetch([]);
    const errFetch: typeof globalThis.fetch = async () => {
      return new Response(JSON.stringify({ success: false, errors: [{ code: 1, message: "auth failed" }], messages: [], result: null }), { status: 403 });
    };
    const ctx = makeCtx({ fetch: errFetch });
    const res = await kvHandler.reconcile([{ binding: "MY_KV" }], ctx);
    expect(res.results[0].action).toBe("error");
    expect(res.results[0].detail).toContain("auth failed");
  });
});
