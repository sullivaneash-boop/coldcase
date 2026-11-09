import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

export const GUIDE_FILE = '11_ANALYSIS/independent_review_2026-11-09/guided_case.json';

/** Explicit editorial allowlist. No register rows, notes, source bodies or review queues leak into this projection. */
export function writeGuide(root: string, appRoot: string, sourceIds: Set<string>) {
  const file = path.join(root, GUIDE_FILE);
  if (!fs.existsSync(file)) return;
  const raw = fs.readFileSync(file, 'utf8');
  const guide = JSON.parse(raw);
  const check = (value: unknown): void => {
    if (Array.isArray(value)) { value.forEach(check); return; }
    if (!value || typeof value !== 'object') return;
    for (const [key, v] of Object.entries(value)) {
      if ((key === 'sourceId' || (key === 'id' && typeof v === 'string' && v.startsWith('SRC-'))) && !sourceIds.has(String(v))) throw new Error(`Guide contains unresolved source: ${v}`);
      if (key === 'url' && v && !/^https:\/\/gbi\.georgia\.gov\//.test(String(v))) throw new Error('Guide external URL is not approved');
      check(v);
    }
  };
  check(guide);
  const portrait = guide.portrait.file as string;
  if (!portrait.startsWith('09_SOURCE_LIBRARY/originals/') || portrait.includes('..') || !portrait.endsWith('__portrait__original.jpg')) throw new Error('Unexpected guide portrait path');
  const dir = path.join(appRoot, 'public', 'guide');
  fs.mkdirSync(dir, { recursive: true });
  fs.copyFileSync(path.join(root, portrait), path.join(dir, 'levi.jpg'));
  guide.portrait.file = '/guide/levi.jpg';
  guide.dataVersion = createHash('sha256').update(raw).digest('hex').slice(0,16);
  fs.writeFileSync(path.join(dir, 'case.json'), JSON.stringify(guide));
  const priorFile = '11_ANALYSIS/independent_review/case_review.json';
  const prior = JSON.parse(fs.readFileSync(path.join(root, priorFile), 'utf8'));
  const audit = { sourceFile: priorFile, author: prior.meta.author, version: prior.meta.version,
    stale: prior.projectCritique.understated.slice(0, 2),
    revisions: prior.observations.filter((o: { id: string }) => ['OBS-01', 'OBS-02'].includes(o.id)).map((o: { id: string; title: string; detail: string }) => ({ id: o.id, title: o.title, detail: o.detail })),
  };
  const approval = JSON.parse(fs.readFileSync(path.join(root, '11_ANALYSIS/independent_review_2026-11-09/publication.json'), 'utf8'));
  if (createHash('sha256').update(JSON.stringify(audit)).digest('hex') !== approval.auditSha256) throw new Error('Prior-review excerpts changed; publication review required');
  fs.writeFileSync(path.join(dir, 'prior-review-audit.json'), JSON.stringify(audit));
}
