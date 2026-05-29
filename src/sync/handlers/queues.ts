import { createCfClient } from "../api/client";
import type { CfQueue } from "../api/types";
import type { QueueProducerConfig, SyncResult } from "../types";
import type { ReconcileResult, ResourceHandler } from "./types";

export const queuesHandler: ResourceHandler<QueueProducerConfig> = {
  type: "queues",
  displayName: "Queues",

  extract(config) {
    return config.queues?.producers ?? [];
  },

  async reconcile(entries, ctx): Promise<ReconcileResult<QueueProducerConfig>> {
    if (entries.length === 0) return { entries: [], results: [] };

    const client = createCfClient(ctx.auth, ctx.fetch);
    const listResult = await client.list<CfQueue>(
      `/accounts/${encodeURIComponent(ctx.auth.accountId)}/queues`,
    );

    const updated: QueueProducerConfig[] = [];
    const results: SyncResult[] = [];

    if (!listResult.ok) {
      for (const entry of entries) {
        results.push({ resourceType: "queues", binding: entry.binding, action: "error", detail: listResult.error.message });
        updated.push(entry);
      }
      return { entries: updated, results };
    }

    const remoteByName = new Map(listResult.data.map((q) => [q.queue_name, q]));

    for (const entry of entries) {
      const remoteName = ctx.prefix
        ? `${ctx.prefix}-${entry.binding.toLowerCase().replace(/_/g, "-")}`
        : (entry.queue ?? entry.binding.toLowerCase().replace(/_/g, "-"));

      const existing_ = remoteByName.get(remoteName);
      if (existing_ || entry.queue_id) {
        const id = existing_ ? existing_.queue_id : (entry.queue_id as string);
        results.push({ resourceType: "queues", binding: entry.binding, remoteName, action: "exists", remoteId: id });
        updated.push({ ...entry, queue: remoteName, queue_id: id });
        continue;
      }

      if (ctx.dryRun) {
        results.push({ resourceType: "queues", binding: entry.binding, remoteName, action: "unavailable" });
        updated.push(entry);
        continue;
      }

      const createResult = await client.post<CfQueue>(
        `/accounts/${encodeURIComponent(ctx.auth.accountId)}/queues`,
        { queue_name: remoteName },
      );

      if (!createResult.ok) {
        results.push({ resourceType: "queues", binding: entry.binding, remoteName, action: "error", detail: createResult.error.message });
        updated.push(entry);
      } else {
        results.push({ resourceType: "queues", binding: entry.binding, remoteName, action: "created", remoteId: createResult.data.queue_id });
        updated.push({ ...entry, queue: remoteName, queue_id: createResult.data.queue_id });
      }
    }

    return { entries: updated, results };
  },
};
