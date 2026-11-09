import { NextRequest, NextResponse } from 'next/server';
import { signSession } from '@/lib/workspace-auth';
import { timingSafeEqual, createHash } from 'node:crypto';
export async function POST(req: NextRequest) {
  // Reject cross-origin login attempts; never put the passphrase in a URL or client bundle.
  if (req.headers.get('origin') !== req.nextUrl.origin) return new Response('Invalid origin', { status: 403 });
  const form = await req.formData();
  const secret = process.env.CASE_WORKSPACE_SECRET;
  const password = String(form.get('password') ?? '');
  const hash = (s: string) => createHash('sha256').update(s).digest();
  if (!secret || secret.length < 32) return NextResponse.redirect(new URL('/access?error=unconfigured', req.url), 303);
  if (!timingSafeEqual(hash(password), hash(secret))) return NextResponse.redirect(new URL('/access?error=invalid', req.url), 303);
  const requested = String(form.get('next') ?? '/workspace');
  const next = /^\/workspace(?:\?|\/|$)/.test(requested) ? requested : '/workspace';
  const expiry = String(Date.now() + 8 * 60 * 60 * 1000);
  const res = NextResponse.redirect(new URL(next, req.url), 303);
  res.cookies.set('levi_workspace', `${expiry}.${await signSession(expiry, secret)}`, { httpOnly: true, secure: process.env.NODE_ENV !== 'development', sameSite: 'strict', path: '/', maxAge: 8 * 60 * 60 });
  res.headers.set('Cache-Control', 'private, no-store');
  return res;
}
export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set('levi_workspace', '', { path: '/', maxAge: 0 });
  res.headers.set('Cache-Control', 'private, no-store');
  return res;
}
