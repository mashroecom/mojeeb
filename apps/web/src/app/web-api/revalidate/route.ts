import { revalidateTag } from 'next/cache';
import { NextResponse, type NextRequest } from 'next/server';
import { PUBLIC_CONTENT_TAG } from '@/lib/publicContent';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

/**
 * POST /web-api/revalidate
 *
 * Drops the server-side cache of CMS-managed public content. Called by the admin
 * panel after a save. Only super admins may do this: the caller's access token is
 * checked against the API before anything is invalidated.
 */
export async function POST(request: NextRequest) {
  const authorization = request.headers.get('authorization');
  if (!authorization?.startsWith('Bearer ')) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  let isSuperAdmin = false;
  try {
    const res = await fetch(`${API_BASE}/auth/me`, {
      headers: { Authorization: authorization },
      cache: 'no-store',
    });
    if (res.ok) {
      const json = (await res.json()) as { data?: { isSuperAdmin?: boolean } };
      isSuperAdmin = json.data?.isSuperAdmin === true;
    } else if (res.status === 401) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
  } catch {
    return NextResponse.json({ success: false, error: 'API unreachable' }, { status: 502 });
  }

  if (!isSuperAdmin) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
  }

  revalidateTag(PUBLIC_CONTENT_TAG);
  return NextResponse.json({ success: true });
}
