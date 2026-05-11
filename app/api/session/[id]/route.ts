import { NextRequest, NextResponse } from 'next/server';
import { getSession, getExtraction } from '@/lib/storage/sessions';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: 'Invalid session ID' }, { status: 400 });
  }

  const [session, extraction] = await Promise.all([
    getSession(id),
    getExtraction(id),
  ]);

  if (!session) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  }

  return NextResponse.json({ session, extraction: extraction ?? null });
}
