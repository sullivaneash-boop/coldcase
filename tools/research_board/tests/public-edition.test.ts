import test from 'node:test';
import assert from 'node:assert/strict';
import { digest, publicEdition, publicEntity, type Publication } from '../pipeline/public-edition';
import type { BuildResult } from '../pipeline/build';
import type { Entity } from '../src/lib/types';
function fixture() {
  const source: Entity = { id: 'SRC-public', type: 'SOURCE', subtype: null, label: 'Reviewed public report', subtitle: null, status: null, confidence: null, sortKey: null, register: 'sources', searchText: 'PRIVATE_SEARCH', row: { source_id: 'SRC-public', title: 'Reviewed public report', notes: 'PRIVATE_NOTE', profile_file: '/private/path', author: 'Published author' } };
  const content = '# Report\n\n<!-- P001 -->\nPublic observation.\n\n<!-- P002 -->\nUNREVIEWED_PERSONAL_ALLEGATION\n\n<!-- P003 -->\nAnother observation.\n';
  const result = { bundle: { entities: [source, { ...source, id: 'SRC-private', label: 'PRIVATE_SOURCE' }], edges: [{ from: 'SRC-public', to: 'SRC-private' }], claimSources: [], eventTimes: [], sourceFiles: [], assets: [], inbox: [{ title: 'PRIVATE_QUEUE' }], review: { note: 'PRIVATE_ANALYSIS' }, reviewNotes: [{ note: 'PRIVATE_REVIEW' }], sourceChain: [], wanted: [], researcherLinks: [], contradictionVersions: [], meta: { dataVersion: 'full', syncedAt: 'date', readOnly: false, config: { title: 'Full archive', timelineWindows: [] }, warnings: ['PRIVATE_WARNING'], validation: { errors: 0, warnings: 0 }, openQuestionFiles: 10 } }, sourceDocs: new Map([['SRC-public', { renditions: [{ key: 'reading', label: 'Reading', path: 'reading.md', kind: 'markdown', role: 'DERIVATIVE', published: false }], contents: { reading: content }, truncated: {} }], ['SRC-private', { contents: { text: 'PRIVATE_SOURCE_BODY' } }]]), publish: new Set(['private.pdf']), issues: [], rowHashes: {}, newAssetRows: [], stats: {} } as unknown as BuildResult;
  const manifest: Publication = { records: { 'SRC-public': digest(JSON.stringify(publicEntity(source))) }, sources: { 'SRC-public': { key: 'reading', sha256: digest(content), omitParagraphs: ['P002'] } }, files: {} };
  return { result, manifest };
}
test('public edition removes private data at generation time and keeps source locators', () => {
  const { result, manifest } = fixture();
  const output = publicEdition(result, '/unused', manifest);
  const serialized = JSON.stringify([output.bundle, [...output.sourceDocs]]);
  assert.doesNotMatch(serialized, /PRIVATE_|UNREVIEWED_PERSONAL_ALLEGATION/);
  assert.match(serialized, /Passage omitted/);
  assert.match(serialized, /P002/);
  assert.match(serialized, /Another observation/);
  assert.equal(output.publish.size, 0);
  assert.equal(output.bundle.review, null);
  assert.equal(output.bundle.meta.readOnly, true);
  assert.equal(output.bundle.edges.length, 0);
  assert.equal(result.bundle.entities[0].row.notes, 'PRIVATE_NOTE');
  assert.match(result.sourceDocs.get('SRC-public')!.contents.reading, /UNREVIEWED_PERSONAL_ALLEGATION/);
});
test('publication fails closed when reviewed text or a displayed record changes', () => {
  const { result, manifest } = fixture();
  result.sourceDocs.get('SRC-public')!.contents.reading += 'new unreviewed material';
  assert.throws(() => publicEdition(result, '/unused', manifest), /source changed/);
  const fresh = fixture();
  fresh.result.bundle.entities[0].label = 'New unreviewed claim';
  assert.throws(() => publicEdition(fresh.result, '/unused', fresh.manifest), /record changed/);
});
test('non-public notes cannot change the public data version', () => {
  const { result, manifest } = fixture();
  const before = publicEdition(result, '/unused', manifest).bundle.meta.dataVersion;
  result.bundle.entities[0].row.notes = 'ANOTHER_PRIVATE_NOTE';
  assert.equal(publicEdition(result, '/unused', manifest).bundle.meta.dataVersion, before);
});
