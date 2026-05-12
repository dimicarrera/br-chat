import { NextRequest, NextResponse } from 'next/server';
import { getSession, getExtraction } from '@/lib/storage/sessions';
import { UUID_RE } from '@/lib/utils';

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
