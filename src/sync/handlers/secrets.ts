import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createCfClient } from "../api/client";
import type { CfWorkerSecret } from "../api/types";
import type { SyncResult } from "../types";
import type { ReconcileResult, ResourceHandler } from "./types";

type SecretEntry = { name: string; value: string };

function readDevVars(configPath: string): Record<string, string> {
  const devVarsPath = resolve(configPath, "../.dev.vars");
  if (!existsSync(devVarsPath)) return {};

  const content = readFileSync(devVarsPath, "utf-8");
  const vars: Record<string, string> = {};
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
    if (key) vars[key] = val;
  }
  return vars;
}

export function createSecretsHandler(configPath = "."): ResourceHandler<SecretEntry> {
  return {
    type: "secrets",
    displayName: "Secrets",

    extract(_config) {
      const devVars = readDevVars(configPath);
      return Object.entries(devVars).map(([name, value]) => ({ name, value }));
    },

    async reconcile(entries, ctx): Promise<ReconcileResult<SecretEntry>> {
      if (entries.length === 0) return { entries, results: [] };

      const client = createCfClient(ctx.auth, ctx.fetch);
      const listResult = await client.get<CfWorkerSecret[]>(
        `/accounts/${ctx.auth.accountId}/workers/scripts/${ctx.scriptName}/secrets`,
      );

      const results: SyncResult[] = [];

      if (!listResult.ok) {
        for (const entry of entries) {
          results.push({ resourceType: "secrets", binding: entry.name, remoteName: entry.name, action: "error", detail: listResult.error.message });
        }
        return { entries, results };
      }

      const remoteNames = new Set(listResult.data.map((s) => s.name));

      for (const entry of entries) {
        if (remoteNames.has(entry.name)) {
          results.push({ resourceType: "secrets", binding: entry.name, remoteName: entry.name, action: "exists" });
          continue;
        }

        if (ctx.dryRun) {
          results.push({ resourceType: "secrets", binding: entry.name, remoteName: entry.name, action: "skipped", detail: "dry-run" });
          continue;
        }

        const putResult = await client.put<unknown>(
          `/accounts/${ctx.auth.accountId}/workers/scripts/${ctx.scriptName}/secrets`,
          { name: entry.name, text: entry.value, type: "secret_text" },
        );

        if (!putResult.ok) {
          results.push({ resourceType: "secrets", binding: entry.name, remoteName: entry.name, action: "error", detail: putResult.error.message });
        } else {
          results.push({ resourceType: "secrets", binding: entry.name, remoteName: entry.name, action: "created" });
        }
      }

      return { entries, results };
    },
  };
}

export const secretsHandler = createSecretsHandler();
