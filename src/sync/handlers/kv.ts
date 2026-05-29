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
    const listResult = await client.list<CfKvNamespace>(
      `/accounts/${encodeURIComponent(ctx.auth.accountId)}/storage/kv/namespaces`,
    );

    const updated: KvNamespaceConfig[] = [];
    const results: SyncResult[] = [];

    if (!listResult.ok) {
      for (const entry of entries) {
        results.push({ resourceType: "kv_namespaces", binding: entry.binding, action: "error", detail: listResult.error.message });
        updated.push(entry);
      }
      return { entries: updated, results };
    }

    const remoteByTitle = new Map(listResult.data.map((ns) => [ns.title, ns]));

    for (const entry of entries) {
      const remoteName = ctx.prefix ? `${ctx.prefix}_${entry.binding}` : entry.binding;

      if (entry.id && remoteByTitle.has(remoteName)) {
        results.push({ resourceType: "kv_namespaces", binding: entry.binding, remoteName, action: "exists", remoteId: entry.id });
        updated.push(entry);
        continue;
      }

      const existing_ = remoteByTitle.get(remoteName);
      if (existing_) {
        results.push({ resourceType: "kv_namespaces", binding: entry.binding, remoteName, action: "exists", remoteId: existing_.id });
        updated.push({ ...entry, id: existing_.id });
        continue;
      }

      if (ctx.dryRun) {
        results.push({ resourceType: "kv_namespaces", binding: entry.binding, remoteName, action: "unavailable" });
        updated.push(entry);
        continue;
      }

      const createResult = await client.post<CfKvNamespace>(
        `/accounts/${encodeURIComponent(ctx.auth.accountId)}/storage/kv/namespaces`,
        { title: remoteName },
      );

      if (!createResult.ok) {
        results.push({ resourceType: "kv_namespaces", binding: entry.binding, remoteName, action: "error", detail: createResult.error.message });
        updated.push(entry);
      } else {
        results.push({ resourceType: "kv_namespaces", binding: entry.binding, remoteName, action: "created", remoteId: createResult.data.id });
        updated.push({ ...entry, id: createResult.data.id });
      }
    }

    return { entries: updated, results };
  },
};
