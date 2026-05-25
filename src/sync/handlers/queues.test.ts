import { describe, expect, it } from "bun:test";
import type { WranglerConfig } from "../types";
import { queuesHandler } from "./queues";
import type { HandlerContext } from "./types";

const AUTH = { apiToken: "tok", accountId: "acc" };

function makeCtx(overrides: Partial<HandlerContext> = {}): HandlerContext {
  return { auth: AUTH, scriptName: "worker", prefix: "", dryRun: false, fetch: globalThis.fetch, ...overrides };
}

function makeFetch(queues: unknown[], createResult?: unknown): typeof globalThis.fetch {
  let count = 0;
  return async (_url, init) => {
    if ((init?.method ?? "GET") === "POST") {
      count++;
      return new Response(JSON.stringify({ success: true, errors: [], messages: [], result: createResult ?? { queue_id: `q-${count}`, queue_name: "created" } }));
    }
    return new Response(JSON.stringify({ success: true, errors: [], messages: [], result: queues }));
  };
}

describe("queuesHandler.extract()", () => {
  it("returns empty when no queues", () => {
    expect(queuesHandler.extract({ name: "t" } as WranglerConfig)).toEqual([]);
  });

  it("returns producers from queues.producers", () => {
    const config: WranglerConfig = { name: "t", queues: { producers: [{ binding: "Q", queue: "my-q" }] } };
    expect(queuesHandler.extract(config)).toHaveLength(1);
  });
});

describe("queuesHandler.reconcile()", () => {
  it("reports exists when queue found", async () => {
    const fetchFn = makeFetch([{ queue_id: "q-1", queue_name: "my-queue" }]);
    const res = await queuesHandler.reconcile([{ binding: "MY_QUEUE", queue: "my-queue" }], makeCtx({ fetch: fetchFn }));
    expect(res.results[0].action).toBe("exists");
    expect(res.results[0].remoteId).toBe("q-1");
    expect(res.results[0].remoteName).toBe("my-queue");
  });

  it("creates queue when not found", async () => {
    const fetchFn = makeFetch([], { queue_id: "new-q", queue_name: "my-queue" });
    const res = await queuesHandler.reconcile([{ binding: "MY_QUEUE" }], makeCtx({ fetch: fetchFn }));
    expect(res.results[0].action).toBe("created");
    expect(res.entries[0].queue_id).toBe("new-q");
  });

  it("skips in dry-run", async () => {
    const res = await queuesHandler.reconcile([{ binding: "Q" }], makeCtx({ fetch: makeFetch([]), dryRun: true }));
    expect(res.results[0].action).toBe("unavailable");
    expect(res.results[0].remoteName).toBe("q");
  });
});
