import { describe, expect, it } from "bun:test";
import type { WranglerConfig } from "../types";
import { d1Handler } from "./d1";
import type { HandlerContext } from "./types";

const AUTH = { apiToken: "tok", accountId: "acc" };

function makeCtx(overrides: Partial<HandlerContext> = {}): HandlerContext {
  return { auth: AUTH, scriptName: "worker", prefix: "", dryRun: false, fetch: globalThis.fetch, ...overrides };
}

function makeFetch(dbs: unknown[], createResult?: unknown): typeof globalThis.fetch {
  let count = 0;
  return async (_url, init) => {
    if ((init?.method ?? "GET") === "POST") {
      count++;
      return new Response(JSON.stringify({ success: true, errors: [], messages: [], result: createResult ?? { uuid: `db-${count}`, name: "created" } }));
    }
    return new Response(JSON.stringify({ success: true, errors: [], messages: [], result: dbs }));
  };
}

describe("d1Handler.extract()", () => {
  it("returns empty when no d1_databases", () => {
    expect(d1Handler.extract({ name: "t" } as WranglerConfig)).toEqual([]);
  });

  it("returns d1_databases array", () => {
    const config: WranglerConfig = { name: "t", d1_databases: [{ binding: "DB", database_id: "x" }] };
    expect(d1Handler.extract(config)).toHaveLength(1);
  });
});

describe("d1Handler.reconcile()", () => {
  it("reports exists when remote db found by name", async () => {
    const fetchFn = makeFetch([{ uuid: "db-uuid", name: "MY_DB" }]);
    const res = await d1Handler.reconcile([{ binding: "MY_DB" }], makeCtx({ fetch: fetchFn }));
    expect(res.results[0].action).toBe("exists");
    expect(res.results[0].remoteId).toBe("db-uuid");
    expect(res.results[0].remoteName).toBe("MY_DB");
  });

  it("creates db when not found", async () => {
    const fetchFn = makeFetch([], { uuid: "new-uuid", name: "MY_DB" });
    const res = await d1Handler.reconcile([{ binding: "MY_DB" }], makeCtx({ fetch: fetchFn }));
    expect(res.results[0].action).toBe("created");
    expect(res.entries[0].database_id).toBe("new-uuid");
  });

  it("skips in dry-run", async () => {
    const res = await d1Handler.reconcile([{ binding: "DB" }], makeCtx({ fetch: makeFetch([]), dryRun: true }));
    expect(res.results[0].action).toBe("unavailable");
    expect(res.results[0].remoteName).toBe("DB");
  });
});
