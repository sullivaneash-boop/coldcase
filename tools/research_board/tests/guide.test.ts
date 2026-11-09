import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { writeGuide, GUIDE_FILE } from '../pipeline/guide';

test('guide projection rejects unresolved citations and unsafe portrait paths', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'levi-guide-test-'));
  try {
    const file = path.join(root, GUIDE_FILE);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify({ refs: [{ sourceId:'SRC-missing' }], portrait:{ file:'bad' } }));
    assert.throws(() => writeGuide(root, root, new Set()), /unresolved source/);
    fs.writeFileSync(file, JSON.stringify({ portrait:{ file:'../../private.jpg' } }));
    assert.throws(() => writeGuide(root, root, new Set()), /Unexpected guide portrait/);
    fs.writeFileSync(file, JSON.stringify({ sources:[{url:'https://unreviewed.example'}], portrait:{file:'bad'} }));
    assert.throws(() => writeGuide(root, root, new Set()), /not approved/);
  } finally { fs.rmSync(root, { recursive:true, force:true }); }
});
