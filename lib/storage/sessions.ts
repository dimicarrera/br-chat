import { kv } from './kv';
import type { Session, SessionId, ExtractionResult } from '../types';

const TTL = Number(process.env.SESSION_TTL_SECONDS ?? 604800);

export async function getSession(id: SessionId): Promise<Session | null> {
  return kv.get<Session>(`session:${id}`);
}

export async function saveSession(session: Session): Promise<void> {
  await kv.set(`session:${session.id}`, session, { ex: TTL });
}

export async function getExtraction(
  sessionId: SessionId,
): Promise<ExtractionResult | null> {
  return kv.get<ExtractionResult>(`extraction:${sessionId}`);
}

export async function saveExtraction(result: ExtractionResult): Promise<void> {
  await kv.set(`extraction:${result.sessionId}`, result, { ex: TTL });
}
