import { createCfClient } from "../api/client";
import type { CfD1Database } from "../api/types";
import type { D1DatabaseConfig, SyncResult } from "../types";
import type { ReconcileResult, ResourceHandler } from "./types";

export const d1Handler: ResourceHandler<D1DatabaseConfig> = {
  type: "d1_databases",
  displayName: "D1 Databases",

  extract(config) {
    return config.d1_databases ?? [];
  },

  async reconcile(entries, ctx): Promise<ReconcileResult<D1DatabaseConfig>> {
    if (entries.length === 0) return { entries: [], results: [] };

    const client = createCfClient(ctx.auth, ctx.fetch);
    const [existing, listErr] = await client.get<CfD1Database[]>(
      `/accounts/${ctx.auth.accountId}/d1/database?per_page=100`,
    );

    const updated: D1DatabaseConfig[] = [];
    const results: SyncResult[] = [];

    if (listErr) {
      for (const entry of entries) {
        results.push({ resourceType: "d1_databases", binding: entry.binding, action: "error", detail: listErr.message });
        updated.push(entry);
      }
      return { entries: updated, results };
    }

    const remoteByName = new Map((existing ?? []).map((db) => [db.name, db]));

    for (const entry of entries) {
      const remoteName = ctx.prefix ? `${ctx.prefix}_${entry.binding}` : (entry.database_name ?? entry.binding);

      const existing_ = remoteByName.get(remoteName);
      if (existing_ || entry.database_id) {
        const id = existing_ ? existing_.uuid : (entry.database_id as string);
        results.push({ resourceType: "d1_databases", binding: entry.binding, action: "exists", remoteId: id });
        updated.push({ ...entry, database_id: id, database_name: remoteName });
        continue;
      }

      if (ctx.dryRun) {
        results.push({ resourceType: "d1_databases", binding: entry.binding, action: "skipped", detail: "dry-run" });
        updated.push(entry);
        continue;
      }

      const [created, createErr] = await client.post<CfD1Database>(
        `/accounts/${ctx.auth.accountId}/d1/database`,
        { name: remoteName },
      );

      if (createErr) {
        results.push({ resourceType: "d1_databases", binding: entry.binding, action: "error", detail: createErr.message });
        updated.push(entry);
      } else if (created) {
        results.push({ resourceType: "d1_databases", binding: entry.binding, action: "created", remoteId: created.uuid });
        updated.push({ ...entry, database_id: created.uuid, database_name: remoteName });
      }
    }

    return { entries: updated, results };
  },
};
