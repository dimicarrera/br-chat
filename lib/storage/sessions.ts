import { kv } from './kv';
import type { Session, SessionId, ExtractionResult } from '../types';
import { SessionSchema, ExtractionResultSchema } from '../schemas';

const rawTTL = parseInt(process.env.SESSION_TTL_SECONDS ?? '604800', 10);
const TTL = Number.isFinite(rawTTL) && rawTTL > 0 ? rawTTL : 604800;

export async function getSession(id: SessionId): Promise<Session | null> {
  const raw = await kv.get(`session:${id}`);
  if (raw == null) return null;
  const result = SessionSchema.safeParse(raw);
  if (!result.success) return null;
  return result.data;
}

export async function saveSession(session: Session): Promise<void> {
  await kv.set(`session:${session.id}`, session, { ex: TTL });
}

export async function getExtraction(
  sessionId: SessionId,
): Promise<ExtractionResult | null> {
  const raw = await kv.get(`extraction:${sessionId}`);
  if (raw == null) return null;
  const result = ExtractionResultSchema.safeParse(raw);
  if (!result.success) return null;
  return result.data;
}

export async function saveExtraction(result: ExtractionResult): Promise<void> {
  await kv.set(`extraction:${result.sessionId}`, result, { ex: TTL });
}
