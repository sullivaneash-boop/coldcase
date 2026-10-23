import "server-only";
import * as s from "@/db/schema";
import { getDb } from "@/lib/db";
import { splitIds } from "@/lib/csv";
import type { CaseBundle, CaseEdge, Entity, EntityType } from "@/lib/types";

export function loadBundle(): CaseBundle | null {
  const db = getDb();
  if (!db) return null;
  const meta = Object.fromEntries(db.select().from(s.meta).all().map((m) => [m.key, m.value]));
  if (!meta.synced_at) return null;

  const entities: Entity[] = db.select().from(s.entities).all().map((e) => ({
    id: e.id,
    type: e.type as EntityType,
    subtype: e.subtype,
    label: e.label,
    subtitle: e.subtitle,
    status: e.status,
    confidence: e.confidence,
    sortKey: e.sortKey,
    register: e.register,
    row: JSON.parse(e.rowJson),
    searchText: "",
  }));
  const edges: CaseEdge[] = db.select().from(s.edges).all().map((e) => ({
    id: e.id, from: e.fromId, to: e.toId, rel: e.relType, category: e.category as CaseEdge["category"],
    sourceId: e.sourceId, locator: e.locator, notes: e.notes, origin: e.origin,
  }));

  return {
    entities,
    edges,
    claimSources: db.select().from(s.claimSources).all(),
    eventTimes: db.select().from(s.eventTimes).all(),
    contradictionVersions: db.select().from(s.contradictionVersions).all(),
    sourceFiles: db.select().from(s.sourceFiles).all(),
    assets: db.select().from(s.assets).all().map((a) => ({ ...a, relatedEntityIds: splitIds(a.relatedEntityIds) })),
    inbox: db.select().from(s.inboxItems).all().map((i) => ({
      ...i, entityIds: splitIds(i.entityIds), sourceIds: splitIds(i.sourceIds),
    })),
    researcherLinks: db.select().from(s.researcherLinks).all(),
    sourceChain: db.select().from(s.sourceChain).all(),
    wanted: db.select().from(s.wantedSources).all(),
    meta: {
      syncedAt: meta.synced_at ?? null,
      archiveRoot: meta.archive_root ?? null,
      warnings: JSON.parse(meta.warnings ?? "[]"),
      openQuestionFiles: Number(meta.open_questions_files ?? 0),
    },
  };
}
