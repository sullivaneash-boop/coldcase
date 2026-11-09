import { NextRequest, NextResponse } from 'next/server';
import { validSession } from './lib/workspace-auth';
export async function middleware(request: NextRequest) {
  // The guide uses original <img> files; never optimize private archive images into a shared cache.
  if (request.nextUrl.pathname === '/_next/image') return new NextResponse('Not found', { status: 404 });
  const local = process.env.NODE_ENV === 'development' && !process.env.VERCEL && process.env.CASE_LOCAL_WORKSPACE === '1';
  const permitted = local || await validSession(request.cookies.get('levi_workspace')?.value, process.env.CASE_WORKSPACE_SECRET);
  if (!permitted) {
    if (request.nextUrl.pathname.startsWith('/workspace')) {
      const url = new URL('/access', request.url);
      url.searchParams.set('next', request.nextUrl.pathname + request.nextUrl.search);
      return NextResponse.redirect(url);
    }
    return new NextResponse('Protected investigator archive. Sign in at /access.', { status: 401, headers: { 'Cache-Control': 'private, no-store', 'X-Robots-Tag': 'noindex' } });
  }
  const response = NextResponse.next();
  response.headers.set('Cache-Control', 'private, no-store');
  response.headers.set('X-Robots-Tag', 'noindex, nofollow');
  return response;
}
export const config = { matcher: ['/_next/image', '/workspace/:path*', '/data/:path*', '/archive/:path*', '/api/inbox/:path*', '/api/links/:path*', '/api/review/:path*'] };
