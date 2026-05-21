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
    const [existing, listErr] = await client.get<CfQueue[]>(
      `/accounts/${ctx.auth.accountId}/queues?per_page=100`,
    );

    const updated: QueueProducerConfig[] = [];
    const results: SyncResult[] = [];

    if (listErr) {
      for (const entry of entries) {
        results.push({ resourceType: "queues", binding: entry.binding, action: "error", detail: listErr.message });
        updated.push(entry);
      }
      return { entries: updated, results };
    }

    const remoteByName = new Map((existing ?? []).map((q) => [q.queue_name, q]));

    for (const entry of entries) {
      const remoteName = ctx.prefix
        ? `${ctx.prefix}-${entry.binding.toLowerCase().replace(/_/g, "-")}`
        : (entry.queue ?? entry.binding.toLowerCase().replace(/_/g, "-"));

      const existing_ = remoteByName.get(remoteName);
      if (existing_ || entry.queue_id) {
        const id = existing_ ? existing_.queue_id : (entry.queue_id as string);
        results.push({ resourceType: "queues", binding: entry.binding, action: "exists", remoteId: id });
        updated.push({ ...entry, queue: remoteName, queue_id: id });
        continue;
      }

      if (ctx.dryRun) {
        results.push({ resourceType: "queues", binding: entry.binding, action: "skipped", detail: "dry-run" });
        updated.push(entry);
        continue;
      }

      const [created, createErr] = await client.post<CfQueue>(
        `/accounts/${ctx.auth.accountId}/queues`,
        { queue_name: remoteName },
      );

      if (createErr) {
        results.push({ resourceType: "queues", binding: entry.binding, action: "error", detail: createErr.message });
        updated.push(entry);
      } else if (created) {
        results.push({ resourceType: "queues", binding: entry.binding, action: "created", remoteId: created.queue_id });
        updated.push({ ...entry, queue: remoteName, queue_id: created.queue_id });
      }
    }

    return { entries: updated, results };
  },
};
