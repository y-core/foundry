import { createCfClient } from "../api/client";
import type { CfWorkerSettings } from "../api/types";
import type { SyncResult } from "../types";
import type { ReconcileResult, ResourceHandler } from "./types";

type VarEntry = { name: string; value: string };

export const varsHandler: ResourceHandler<VarEntry> = {
  type: "vars",
  displayName: "Environment Variables",

  extract(config) {
    const vars = config.vars ?? {};
    return Object.entries(vars).map(([name, value]) => ({ name, value: String(value) }));
  },

  async reconcile(entries, ctx): Promise<ReconcileResult<VarEntry>> {
    if (entries.length === 0) return { entries: [], results: [] };

    const client = createCfClient(ctx.auth, ctx.fetch);
    const [settings, getErr] = await client.get<CfWorkerSettings>(
      `/accounts/${ctx.auth.accountId}/workers/scripts/${ctx.scriptName}/settings`,
    );

    const results: SyncResult[] = [];

    if (getErr) {
      for (const entry of entries) {
        results.push({ resourceType: "vars", binding: entry.name, action: "error", detail: getErr.message });
      }
      return { entries, results };
    }

    const remoteVars = new Map(
      (settings?.bindings ?? [])
        .filter((b) => b.type === "plain_text")
        .map((b) => [b.name, b.text ?? ""]),
    );

    const toUpdate: VarEntry[] = [];
    for (const entry of entries) {
      if (remoteVars.has(entry.name)) {
        results.push({ resourceType: "vars", binding: entry.name, action: "exists" });
      } else {
        toUpdate.push(entry);
      }
    }

    if (toUpdate.length === 0 || ctx.dryRun) {
      for (const entry of toUpdate) {
        results.push({ resourceType: "vars", binding: entry.name, action: "skipped", detail: "dry-run" });
      }
      return { entries, results };
    }

    // Merge with existing bindings and PATCH all at once
    const existingBindings = (settings?.bindings ?? []).filter((b) => b.type !== "plain_text");
    const newBindings = [
      ...existingBindings,
      ...entries.map((e) => ({ type: "plain_text", name: e.name, text: e.value })),
    ];

    const [, patchErr] = await client.patch<unknown>(
      `/accounts/${ctx.auth.accountId}/workers/scripts/${ctx.scriptName}/settings`,
      { bindings: newBindings },
    );

    for (const entry of toUpdate) {
      if (patchErr) {
        results.push({ resourceType: "vars", binding: entry.name, action: "error", detail: patchErr.message });
      } else {
        results.push({ resourceType: "vars", binding: entry.name, action: "updated" });
      }
    }

    return { entries, results };
  },
};
