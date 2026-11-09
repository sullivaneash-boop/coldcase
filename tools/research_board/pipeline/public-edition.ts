import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import type { BuildResult } from './build';
import type { CaseBundle, Entity, SourceDoc } from '../src/lib/types';

export const PUBLIC_MANIFEST = '11_ANALYSIS/independent_review_2026-11-09/publication.json';
export type Publication = {
  records: Record<string, string>;
  sources: Record<string, { key: string; sha256: string; omitParagraphs?: string[] }>;
  files: Record<string, string>;
};
export const digest = (value: string) => createHash('sha256').update(value).digest('hex');
const fields = new Set(('source_id title author publisher publication_date publication_date_precision source_type original_url archive_url reliability_class primary_or_secondary knowledge_basis rights_notes language mime_type claim_id claim status confidence assessment_rationale source_ids contradicting_source_ids people_ids event_ids location_ids evidence_ids event_id neutral_description time_status start_at end_at timezone time_precision date_precision local_start_time local_end_time original_time_text organization_ids evidence_id evidence_type description custody_status person_id display_name identity_status aliases location_id name location_type').split(' '));

/** Only these reviewed display fields can leave the archive. Never copy arbitrary notes or metadata. */
export function publicEntity(entity: Entity): Entity {
  const row = Object.fromEntries(Object.entries(entity.row).filter(([key, value]) => fields.has(key) && typeof value === 'string')) as Entity['row'];
  return { id: entity.id, type: entity.type, subtype: entity.subtype, label: entity.label, subtitle: entity.subtitle, status: entity.status, confidence: entity.confidence, sortKey: entity.sortKey, register: entity.register, row, searchText: '' };
}

/** Reviewed IDs and content hashes, not a status label, determine what is published. */
export function publicEdition(result: BuildResult, root: string, manifest: Publication): BuildResult {
  const entities = Object.entries(manifest.records).map(([id, hash]) => {
    const original = result.bundle.entities.find(e => e.id === id);
    if (!original) throw new Error(`Public record missing: ${id}`);
    const entity = publicEntity(original);
    if (digest(JSON.stringify(entity)) !== hash) throw new Error(`Public record changed; publication review required: ${id}`);
    if (['ALLEGED', 'RUMOR'].includes(entity.status ?? '')) throw new Error(`Unreviewed allegation cannot be published: ${id}`);
    return entity;
  });
  const ids = new Set(entities.map(e => e.id));
  const sourceIds = new Set(Object.keys(manifest.sources));
  for (const e of entities) {
    for (const [key, value] of Object.entries(e.row)) {
      if (key.endsWith('_ids') && typeof value === 'string') e.row[key] = value.split(';').filter(id => ids.has(id)).join(';');
    }
  }
  const sourceDocs = new Map<string, SourceDoc>();
  for (const [id, approval] of Object.entries(manifest.sources)) {
    if (!ids.has(id)) throw new Error(`Public source record missing: ${id}`);
    const doc = result.sourceDocs.get(id);
    const rendition = doc?.renditions.find(r => r.key === approval.key);
    if (!doc || !rendition) throw new Error(`Public rendition missing: ${id}`);
    if (rendition.kind === 'image') {
      if (!manifest.files[rendition.path]) throw new Error(`Public image not approved: ${id}`);
      sourceDocs.set(id, { renditions: [{ ...rendition, published: true }], contents: {}, truncated: {} });
      continue;
    }
    const content = doc.contents[approval.key];
    if (typeof content !== 'string' || digest(content) !== approval.sha256) throw new Error(`Public source changed; publication review required: ${id}`);
    const omit = new Set(approval.omitParagraphs ?? []);
    const text = content.replace(/(<!--\s*(P\d{3,})\s*-->)([\s\S]*?)(?=<!--\s*P\d{3,}\s*-->|\n## |$)/g,
      (block, marker, id) => omit.has(id) ? `${marker}\n[Passage omitted from this public reading edition. The original is preserved unchanged in the local archive.]\n\n` : block);
    sourceDocs.set(id, { renditions: [{ ...rendition, label: rendition.label.includes('note') ? rendition.label : 'Public reading edition', published: false }], contents: { [approval.key]: `> PUBLIC READING EDITION. Selected source rendition; omitted passages are marked. Original files, unreviewed material and private notes remain in the local archive.\n\n${text}` }, truncated: { [approval.key]: !!doc.truncated[approval.key] } });
  }
  const publish = new Set(Object.keys(manifest.files));
  for (const [file, hash] of Object.entries(manifest.files)) {
    if (!result.publish.has(file) || digest(fs.readFileSync(path.join(root, file)).toString('base64')) !== hash) throw new Error(`Public asset changed or unavailable: ${file}`);
  }
  const b = result.bundle;
  const bundle: CaseBundle = {
    entities,
    edges: b.edges.filter(e => ids.has(e.from) && ids.has(e.to) && (!e.sourceId || sourceIds.has(e.sourceId)) && !['LEAD', 'RESEARCHER'].includes(e.category)).map(e => ({ ...e, notes: null })),
    claimSources: b.claimSources.filter(c => ids.has(c.claimId) && sourceIds.has(c.sourceId)).map(c => ({ ...c, excerpt: null, notes: null, speakerPersonId: c.speakerPersonId && ids.has(c.speakerPersonId) ? c.speakerPersonId : null })),
    eventTimes: b.eventTimes.filter(t => ids.has(t.eventId) && !!t.sourceId && sourceIds.has(t.sourceId)).map(t => ({ ...t, notes: null })),
    contradictionVersions: [], sourceFiles: b.sourceFiles.filter(f => !!f.localFile && publish.has(f.localFile)).map(f => ({ ...f, transformation: null })),
    assets: b.assets.filter(a => !!a.localPath && publish.has(a.localPath)).map(a => ({ ...a, notes: null, discoveredIn: null, relatedEntityIds: a.relatedEntityIds.filter(id => ids.has(id)) })),
    inbox: [], researcherLinks: [], sourceChain: [], wanted: [], review: null, reviewNotes: [],
    meta: { ...b.meta, readOnly: true, warnings: [], openQuestionFiles: 0, config: { ...b.meta.config, title: 'PROJECT LEVI · Public source workspace' }, research: { lastRun: null, registersChangedAt: null, latestSource: null, latestFinding: null } },
  };
  bundle.meta.dataVersion = digest(JSON.stringify({ ...bundle, meta: { ...bundle.meta, syncedAt: null, dataVersion: '' } })).slice(0, 16);
  return { ...result, bundle, sourceDocs, publish };
}

export function publicationFor(result: BuildResult, root: string) {
  // Full archival work remains available on an explicitly requested local development server only.
  if (!process.env.VERCEL && process.env.NODE_ENV !== 'production' && process.env.CASE_LOCAL_WORKSPACE === '1') return result;
  return publicEdition(result, root, JSON.parse(fs.readFileSync(path.join(root, PUBLIC_MANIFEST), 'utf8')));
}
