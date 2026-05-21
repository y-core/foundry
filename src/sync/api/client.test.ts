import { describe, expect, it } from "bun:test";
import { createCfClient } from "./client";
import { CfApiClientError } from "./types";

const AUTH = { apiToken: "test-token", accountId: "acc-123" };

function makeFetch(status: number, body: unknown): typeof globalThis.fetch {
  return async (_url, _init) => new Response(JSON.stringify(body), { status });
}

function makeNetworkError(): typeof globalThis.fetch {
  return async () => { throw new Error("connection refused"); };
}

function makeBadJson(): typeof globalThis.fetch {
  return async () => new Response("not json", { status: 200 });
}

describe("createCfClient()", () => {
  it("returns data on success", async () => {
    const fetchFn = makeFetch(200, { success: true, errors: [], messages: [], result: { id: "abc" } });
    const client = createCfClient(AUTH, fetchFn);
    const [data, err] = await client.get<{ id: string }>("/accounts/acc/kv");
    expect(err).toBeNull();
    expect(data?.id).toBe("abc");
  });

  it("sends Authorization header", async () => {
    let capturedHeaders: HeadersInit | undefined;
    const fetchFn: typeof globalThis.fetch = async (_url, init) => {
      capturedHeaders = init?.headers;
      return new Response(JSON.stringify({ success: true, errors: [], messages: [], result: null }), { status: 200 });
    };
    const client = createCfClient(AUTH, fetchFn);
    await client.get("/path");
    const headers = new Headers(capturedHeaders as HeadersInit);
    expect(headers.get("Authorization")).toBe("Bearer test-token");
  });

  it("returns network error on fetch throw", async () => {
    const client = createCfClient(AUTH, makeNetworkError());
    const [data, err] = await client.get("/path");
    expect(data).toBeNull();
    expect(err).toBeInstanceOf(CfApiClientError);
    expect(err?.kind).toBe("network");
  });

  it("returns parse error on bad JSON", async () => {
    const client = createCfClient(AUTH, makeBadJson());
    const [data, err] = await client.get("/path");
    expect(data).toBeNull();
    expect(err?.kind).toBe("parse");
  });

  it("returns api error when success=false", async () => {
    const fetchFn = makeFetch(400, {
      success: false,
      errors: [{ code: 10000, message: "Authentication error" }],
      messages: [],
      result: null,
    });
    const client = createCfClient(AUTH, fetchFn);
    const [data, err] = await client.get("/path");
    expect(data).toBeNull();
    expect(err?.kind).toBe("api");
    expect(err?.message).toContain("Authentication error");
    expect(err?.cfErrors?.[0]?.code).toBe(10000);
  });

  it("sends body for POST requests", async () => {
    let capturedBody: string | null = null;
    const fetchFn: typeof globalThis.fetch = async (_url, init) => {
      capturedBody = init?.body as string;
      return new Response(JSON.stringify({ success: true, errors: [], messages: [], result: { id: "new" } }), { status: 200 });
    };
    const client = createCfClient(AUTH, fetchFn);
    await client.post("/path", { name: "my-kv" });
    expect(JSON.parse(capturedBody!)).toEqual({ name: "my-kv" });
  });
});
