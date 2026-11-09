import test from 'node:test';
import assert from 'node:assert/strict';
import { signSession, validSession } from '../src/lib/workspace-auth';
const secret = 'a-test-only-secret-with-at-least-32-characters';
test('workspace sessions fail closed and expire', async () => {
  const now = Date.now();
  const expiry = String(now + 60000);
  const token = `${expiry}.${await signSession(expiry, secret)}`;
  assert.equal(await validSession(token, secret, now), true);
  assert.equal(await validSession(token, secret, now + 60001), false);
  assert.equal(await validSession(token, 'different-secret-with-at-least-32-chars', now), false);
  assert.equal(await validSession(token, undefined, now), false);
  assert.equal(await validSession(token + '.extra', secret, now), false);
  assert.equal(await validSession(undefined, secret, now), false);
  assert.equal(await validSession('Infinity.abc', secret, now), false);
});
