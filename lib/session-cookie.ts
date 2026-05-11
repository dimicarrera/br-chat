import type { NextRequest } from 'next/server';
import { v4 as uuidv4 } from 'uuid';

const COOKIE_NAME = 'br_sid';
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function getCookieId(req: NextRequest): string | null {
  const value = req.cookies.get(COOKIE_NAME)?.value;
  return value && UUID_RE.test(value) ? value : null;
}

export function newCookieId(): string {
  return uuidv4();
}

export function buildSetCookieHeader(id: string): string {
  const secure = process.env.NODE_ENV === 'production';
  const base = `${COOKIE_NAME}=${id}; Path=/; HttpOnly; SameSite=Lax; Max-Age=3600`;
  return secure ? `${base}; Secure` : base;
}
