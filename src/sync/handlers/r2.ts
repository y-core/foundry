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
    const [existing, listErr] = await client.get<{ buckets: CfR2Bucket[] }>(
      `/accounts/${ctx.auth.accountId}/r2/buckets`,
    );

    const updated: R2BucketConfig[] = [];
    const results: SyncResult[] = [];

    if (listErr) {
      for (const entry of entries) {
        results.push({ resourceType: "r2_buckets", binding: entry.binding, action: "error", detail: listErr.message });
        updated.push(entry);
      }
      return { entries: updated, results };
    }

    const remoteNames = new Set((existing?.buckets ?? []).map((b) => b.name));

    for (const entry of entries) {
      const remoteName = ctx.prefix
        ? `${ctx.prefix}-${entry.binding.toLowerCase().replace(/_/g, "-")}`
        : (entry.bucket_name ?? entry.binding.toLowerCase().replace(/_/g, "-"));

      if (remoteNames.has(remoteName)) {
        results.push({ resourceType: "r2_buckets", binding: entry.binding, action: "exists", remoteId: remoteName });
        updated.push({ ...entry, bucket_name: remoteName });
        continue;
      }

      if (ctx.dryRun) {
        results.push({ resourceType: "r2_buckets", binding: entry.binding, action: "skipped", detail: "dry-run" });
        updated.push(entry);
        continue;
      }

      const [, createErr] = await client.put<null>(
        `/accounts/${ctx.auth.accountId}/r2/buckets/${remoteName}`,
        {},
      );

      if (createErr) {
        results.push({ resourceType: "r2_buckets", binding: entry.binding, action: "error", detail: createErr.message });
        updated.push(entry);
      } else {
        results.push({ resourceType: "r2_buckets", binding: entry.binding, action: "created", remoteId: remoteName });
        updated.push({ ...entry, bucket_name: remoteName });
      }
    }

    return { entries: updated, results };
  },
};
