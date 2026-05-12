import type { NextRequest } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { UUID_RE } from './utils';

const COOKIE_NAME = 'br_sid';
// Match session TTL so the rate-limit cookie ID survives the full session lifetime
const rawTTL = parseInt(process.env.SESSION_TTL_SECONDS ?? '604800', 10);
const COOKIE_MAX_AGE = Number.isFinite(rawTTL) && rawTTL > 0 ? rawTTL : 604800;

export function getCookieId(req: NextRequest): string | null {
  const value = req.cookies.get(COOKIE_NAME)?.value;
  return value && UUID_RE.test(value) ? value : null;
}

export function newCookieId(): string {
  return uuidv4();
}

export function buildSetCookieHeader(id: string): string {
  const secure = process.env.NODE_ENV === 'production';
  const base = `${COOKIE_NAME}=${id}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${COOKIE_MAX_AGE}`;
  return secure ? `${base}; Secure` : base;
}
