import type { Result } from "@y-core/forge/result";
import type { CfAuth } from "../types";
import { CfApiClientError, type CfApiResponse } from "./types";

const BASE_URL = "https://api.cloudflare.com/client/v4";

export interface CfClient {
  get<T>(path: string): Promise<Result<T, CfApiClientError>>;
  post<T>(path: string, body: unknown): Promise<Result<T, CfApiClientError>>;
  put<T>(path: string, body: unknown): Promise<Result<T, CfApiClientError>>;
  patch<T>(path: string, body: unknown): Promise<Result<T, CfApiClientError>>;
  delete<T>(path: string): Promise<Result<T, CfApiClientError>>;
}

export function createCfClient(auth: CfAuth, fetchFn: typeof globalThis.fetch = globalThis.fetch): CfClient {
  async function request<T>(method: string, path: string, body?: unknown): Promise<Result<T, CfApiClientError>> {
    let res: Response;
    try {
      res = await fetchFn(`${BASE_URL}${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${auth.apiToken}`,
          "Content-Type": "application/json",
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
    } catch (err) {
      return [null, new CfApiClientError("network", `Network error: ${(err as Error).message}`)];
    }

    let data: CfApiResponse<T>;
    try {
      data = (await res.json()) as CfApiResponse<T>;
    } catch {
      return [null, new CfApiClientError("parse", `Failed to parse response (HTTP ${res.status})`, { statusCode: res.status })];
    }

    if (!data.success) {
      const msg = data.errors?.[0]?.message ?? `API error (HTTP ${res.status})`;
      return [null, new CfApiClientError("api", msg, { statusCode: res.status, cfErrors: data.errors })];
    }

    return [data.result, null];
  }

  return {
    get: <T>(path: string) => request<T>("GET", path),
    post: <T>(path: string, body: unknown) => request<T>("POST", path, body),
    put: <T>(path: string, body: unknown) => request<T>("PUT", path, body),
    patch: <T>(path: string, body: unknown) => request<T>("PATCH", path, body),
    delete: <T>(path: string) => request<T>("DELETE", path),
  };
}
