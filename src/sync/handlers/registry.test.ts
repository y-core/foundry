import { describe, expect, it } from "bun:test";
import type { ResourceType } from "../types";
import { defaultHandlers, findHandler } from "./registry";

describe("defaultHandlers", () => {
  it("contains at least one handler per resource-creating type", () => {
    const types = defaultHandlers.map((h) => h.type);
    const requiredTypes: ResourceType[] = ["kv_namespaces", "d1_databases", "r2_buckets", "queues", "vars", "secrets"];
    for (const t of requiredTypes) {
      expect(types).toContain(t);
    }
  });

  it("contains declarative handlers", () => {
    const types = defaultHandlers.map((h) => h.type);
    const declarativeTypes: ResourceType[] = ["ratelimits", "durable_objects", "hyperdrive", "vectorize", "ai"];
    for (const t of declarativeTypes) {
      expect(types).toContain(t);
    }
  });

  it("has no duplicate types", () => {
    const types = defaultHandlers.map((h) => h.type);
    expect(new Set(types).size).toBe(types.length);
  });
});

describe("findHandler()", () => {
  it("finds kv handler", () => {
    const h = findHandler("kv_namespaces");
    expect(h?.type).toBe("kv_namespaces");
  });

  it("returns undefined for unknown type", () => {
    expect(findHandler("unknown_type" as ResourceType)).toBeUndefined();
  });
});
