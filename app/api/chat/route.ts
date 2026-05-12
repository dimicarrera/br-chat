import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { getSession, saveSession } from '@/lib/storage/sessions';
import { streamChat } from '@/lib/llm/chat';
import { ratelimit } from '@/lib/ratelimit';
import {
  getCookieId,
  newCookieId,
  buildSetCookieHeader,
} from '@/lib/session-cookie';
import type { Session, Message } from '@/lib/types';

const schema = z.object({
  sessionId: z.string().uuid().optional(),
  message: z.string().min(1).max(2000),
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
  const { sessionId: clientSessionId, message } = parsed.data;

  const existingCookieId = getCookieId(req);
  const cookieId = existingCookieId ?? newCookieId();

  const rawMax = parseInt(process.env.MAX_ASSISTANT_TURNS ?? '8', 10);
  const maxTurns = Number.isFinite(rawMax) && rawMax > 0 ? rawMax : 8;
  let session: Session;

  if (clientSessionId) {
    const existing = await getSession(clientSessionId);
    if (!existing) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }
    if (existing.endedAt) {
      return NextResponse.json({ error: 'Session already ended' }, { status: 403 });
    }
    if (existing.assistantTurns >= existing.maxAssistantTurns) {
      return NextResponse.json({ error: 'Turn limit reached' }, { status: 403 });
    }
    session = existing;
  } else {
    const { success: allowed } = await ratelimit.limit(cookieId);
    if (!allowed) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
    }
    session = {
      id: uuidv4(),
      createdAt: Date.now(),
      endedAt: null,
      messages: [],
      assistantTurns: 0,
      maxAssistantTurns: maxTurns,
    };
  }

  const userMessage: Message = {
    id: uuidv4(),
    role: 'user',
    content: message,
    createdAt: Date.now(),
  };
  session.messages.push(userMessage);

  const sdkStream = streamChat(
    session.messages,
    session.assistantTurns,
    session.maxAssistantTurns,
  );

  const encoder = new TextEncoder();
  let assistantContent = '';
  const sessionSnapshot = session;

  const readable = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of sdkStream) {
          if (
            chunk.type === 'content_block_delta' &&
            chunk.delta.type === 'text_delta'
          ) {
            assistantContent += chunk.delta.text;
            controller.enqueue(encoder.encode(chunk.delta.text));
          }
        }
        sessionSnapshot.messages.push({
          id: uuidv4(),
          role: 'assistant',
          content: assistantContent,
          createdAt: Date.now(),
        });
        sessionSnapshot.assistantTurns += 1;
        await saveSession(sessionSnapshot);
      } finally {
        controller.close();
      }
    },
  });

  const headers = new Headers({
    'Content-Type': 'text/plain; charset=utf-8',
    'X-Session-Id': session.id,
    'X-Max-Turns': String(session.maxAssistantTurns),
  });

  if (!existingCookieId) {
    headers.append('Set-Cookie', buildSetCookieHeader(cookieId));
  }

  return new Response(readable, { headers });
}
