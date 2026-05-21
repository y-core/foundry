import { createCfClient } from "../api/client";
import type { CfKvNamespace } from "../api/types";
import type { KvNamespaceConfig, SyncResult } from "../types";
import type { ReconcileResult, ResourceHandler } from "./types";

export const kvHandler: ResourceHandler<KvNamespaceConfig> = {
  type: "kv_namespaces",
  displayName: "KV Namespaces",

  extract(config) {
    return config.kv_namespaces ?? [];
  },

  async reconcile(entries, ctx): Promise<ReconcileResult<KvNamespaceConfig>> {
    if (entries.length === 0) return { entries: [], results: [] };

    const client = createCfClient(ctx.auth, ctx.fetch);
    const [existing, listErr] = await client.get<CfKvNamespace[]>(
      `/accounts/${ctx.auth.accountId}/storage/kv/namespaces?per_page=100`,
    );

    const updated: KvNamespaceConfig[] = [];
    const results: SyncResult[] = [];

    if (listErr) {
      for (const entry of entries) {
        results.push({ resourceType: "kv_namespaces", binding: entry.binding, action: "error", detail: listErr.message });
        updated.push(entry);
      }
      return { entries: updated, results };
    }

    const remoteByTitle = new Map((existing ?? []).map((ns) => [ns.title, ns]));

    for (const entry of entries) {
      const remoteName = ctx.prefix ? `${ctx.prefix}_${entry.binding}` : entry.binding;

      // If already has an ID that exists remotely, treat as exists
      if (entry.id && remoteByTitle.has(remoteName)) {
        results.push({ resourceType: "kv_namespaces", binding: entry.binding, action: "exists", remoteId: entry.id });
        updated.push(entry);
        continue;
      }

      const existing_ = remoteByTitle.get(remoteName);
      if (existing_) {
        results.push({ resourceType: "kv_namespaces", binding: entry.binding, action: "exists", remoteId: existing_.id });
        updated.push({ ...entry, id: existing_.id });
        continue;
      }

      if (ctx.dryRun) {
        results.push({ resourceType: "kv_namespaces", binding: entry.binding, action: "skipped", detail: "dry-run" });
        updated.push(entry);
        continue;
      }

      const [created, createErr] = await client.post<CfKvNamespace>(
        `/accounts/${ctx.auth.accountId}/storage/kv/namespaces`,
        { title: remoteName },
      );

      if (createErr) {
        results.push({ resourceType: "kv_namespaces", binding: entry.binding, action: "error", detail: createErr.message });
        updated.push(entry);
      } else if (created) {
        results.push({ resourceType: "kv_namespaces", binding: entry.binding, action: "created", remoteId: created.id });
        updated.push({ ...entry, id: created.id });
      }
    }

    return { entries: updated, results };
  },
};
