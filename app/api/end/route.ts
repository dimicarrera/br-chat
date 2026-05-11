import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  getSession,
  saveSession,
  getExtraction,
  saveExtraction,
} from '@/lib/storage/sessions';
import { extractEmotions } from '@/lib/llm/extract';

const schema = z.object({
  sessionId: z.string().uuid(),
});

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
  const { sessionId } = parsed.data;

  // Idempotent: return cached extraction if it exists
  const cached = await getExtraction(sessionId);
  if (cached) {
    return NextResponse.json({ extraction: cached });
  }

  const session = await getSession(sessionId);
  if (!session) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  }

  const extraction = await extractEmotions(sessionId, session.messages);
  session.endedAt = Date.now();

  await Promise.all([saveExtraction(extraction), saveSession(session)]);

  return NextResponse.json({ extraction });
}
