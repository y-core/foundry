import { createCfClient } from "../api/client";
import type { CfR2Bucket } from "../api/types";
import type { R2BucketConfig, SyncResult } from "../types";
import type { ReconcileResult, ResourceHandler } from "./types";

export const r2Handler: ResourceHandler<R2BucketConfig> = {
  type: "r2_buckets",
  displayName: "R2 Buckets",

  extract(config) {
    return config.r2_buckets ?? [];
  },

  async reconcile(entries, ctx): Promise<ReconcileResult<R2BucketConfig>> {
    if (entries.length === 0) return { entries: [], results: [] };

    const client = createCfClient(ctx.auth, ctx.fetch);
    const listResult = await client.get<{ buckets: CfR2Bucket[] }>(
      `/accounts/${encodeURIComponent(ctx.auth.accountId)}/r2/buckets`,
    );

    const updated: R2BucketConfig[] = [];
    const results: SyncResult[] = [];

    if (!listResult.ok) {
      for (const entry of entries) {
        results.push({ resourceType: "r2_buckets", binding: entry.binding, action: "error", detail: listResult.error.message });
        updated.push(entry);
      }
      return { entries: updated, results };
    }

    const remoteNames = new Set(listResult.data.buckets.map((b) => b.name));

    for (const entry of entries) {
      const remoteName = ctx.prefix
        ? `${ctx.prefix}-${entry.binding.toLowerCase().replace(/_/g, "-")}`
        : (entry.bucket_name ?? entry.binding.toLowerCase().replace(/_/g, "-"));

      if (remoteNames.has(remoteName)) {
        results.push({ resourceType: "r2_buckets", binding: entry.binding, remoteName, action: "exists", remoteId: remoteName });
        updated.push({ ...entry, bucket_name: remoteName });
        continue;
      }

      if (ctx.dryRun) {
        results.push({ resourceType: "r2_buckets", binding: entry.binding, remoteName, action: "unavailable" });
        updated.push(entry);
        continue;
      }

      const createResult = await client.put<null>(
        `/accounts/${encodeURIComponent(ctx.auth.accountId)}/r2/buckets/${encodeURIComponent(remoteName)}`,
        {},
      );

      if (!createResult.ok) {
        results.push({ resourceType: "r2_buckets", binding: entry.binding, remoteName, action: "error", detail: createResult.error.message });
        updated.push(entry);
      } else {
        results.push({ resourceType: "r2_buckets", binding: entry.binding, remoteName, action: "created", remoteId: remoteName });
        updated.push({ ...entry, bucket_name: remoteName });
      }
    }

    return { entries: updated, results };
  },
};
