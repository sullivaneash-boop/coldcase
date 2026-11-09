import { NextRequest, NextResponse } from 'next/server';
export function middleware(request: NextRequest) {
  if (request.nextUrl.pathname === '/_next/image') return new NextResponse('Not found', { status: 404 });
  // Public browsing never grants permission to alter the canonical evidence archive.
  return NextResponse.json({ error: 'The public workspace is read-only. Save or export personal notes in the guided case.' }, { status: 403 });
}
export const config = { matcher: ['/_next/image', '/api/inbox/:path*', '/api/links/:path*', '/api/review/:path*'] };
