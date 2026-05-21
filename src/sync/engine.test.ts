import { describe, expect, it } from "bun:test";
import { syncBindings } from "./engine";
import type { ResourceHandler } from "./handlers/types";
import type { SyncConfig, WranglerConfig } from "./types";

const AUTH = { apiToken: "tok", accountId: "acc" };

type KvEntry = { binding: string; id?: string };

function makeKvHandler(action: "exists" | "created" | "error"): ResourceHandler {
  return {
    type: "kv_namespaces",
    displayName: "KV",
    extract: (c: WranglerConfig) => c.kv_namespaces ?? [],
    reconcile: async (entries) => ({
      entries: (entries as KvEntry[]).map((e) => ({ ...e, id: action === "created" ? "new-id" : e.id })),
      results: (entries as KvEntry[]).map((e) => ({ resourceType: "kv_namespaces" as const, binding: e.binding, action })),
    }),
  };
}

describe("syncBindings()", () => {
  const baseConfig: WranglerConfig = {
    name: "my-worker",
    kv_namespaces: [{ binding: "MY_KV" }],
  };

  it("returns results from handler", async () => {
    const syncConfig: SyncConfig = { auth: AUTH };
    const out = await syncBindings(baseConfig, syncConfig, [makeKvHandler("exists")]);
    expect(out.results).toHaveLength(1);
    expect(out.results[0].action).toBe("exists");
    expect(out.results[0].binding).toBe("MY_KV");
  });

  it("marks configChanged when IDs are written back", async () => {
    const syncConfig: SyncConfig = { auth: AUTH };
    const out = await syncBindings(baseConfig, syncConfig, [makeKvHandler("created")]);
    expect(out.configChanged).toBe(true);
    expect((out.updatedConfig.kv_namespaces?.[0] as KvEntry).id).toBe("new-id");
  });

  it("configChanged is false when nothing changed", async () => {
    const config: WranglerConfig = { name: "w", kv_namespaces: [{ binding: "KV", id: "existing" }] };
    const handler = makeKvHandler("exists");
    const out = await syncBindings(config, { auth: AUTH }, [handler]);
    expect(out.configChanged).toBe(false);
  });

  it("skips handlers for types not in resources filter", async () => {
    const syncConfig: SyncConfig = { auth: AUTH, resources: ["d1_databases"] };
    const out = await syncBindings(baseConfig, syncConfig, [makeKvHandler("created")]);
    expect(out.results).toHaveLength(0);
  });

  it("skips handlers with no entries", async () => {
    const config: WranglerConfig = { name: "w" };
    const out = await syncBindings(config, { auth: AUTH }, [makeKvHandler("exists")]);
    expect(out.results).toHaveLength(0);
  });

  it("resolves prefix from project name by default", async () => {
    let capturedPrefix = "";
    const handler: ResourceHandler = {
      type: "kv_namespaces",
      displayName: "KV",
      extract: (c: WranglerConfig) => c.kv_namespaces ?? [],
      reconcile: async (entries, ctx) => {
        capturedPrefix = ctx.prefix;
        return { entries, results: [] };
      },
    };
    await syncBindings({ name: "my-worker", kv_namespaces: [{ binding: "KV" }] }, { auth: AUTH }, [handler]);
    expect(capturedPrefix).toBe("MY_WORKER");
  });

  it("resolves custom prefix", async () => {
    let capturedPrefix = "";
    const handler: ResourceHandler = {
      type: "kv_namespaces",
      displayName: "KV",
      extract: (c: WranglerConfig) => c.kv_namespaces ?? [],
      reconcile: async (entries, ctx) => {
        capturedPrefix = ctx.prefix;
        return { entries, results: [] };
      },
    };
    await syncBindings(
      { name: "w", kv_namespaces: [{ binding: "KV" }] },
      { auth: AUTH, prefix: { kind: "custom", prefix: "MYPREFIX" } },
      [handler],
    );
    expect(capturedPrefix).toBe("MYPREFIX");
  });

  it("resolves no prefix with kind=none", async () => {
    let capturedPrefix = "NOT_EMPTY";
    const handler: ResourceHandler = {
      type: "kv_namespaces",
      displayName: "KV",
      extract: (c: WranglerConfig) => c.kv_namespaces ?? [],
      reconcile: async (entries, ctx) => {
        capturedPrefix = ctx.prefix;
        return { entries, results: [] };
      },
    };
    await syncBindings(
      { name: "w", kv_namespaces: [{ binding: "KV" }] },
      { auth: AUTH, prefix: { kind: "none" } },
      [handler],
    );
    expect(capturedPrefix).toBe("");
  });
});
