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
}
