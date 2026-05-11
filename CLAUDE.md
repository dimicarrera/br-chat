# CLAUDE.md — br-chat

Conversational emotion-extraction app. Users chat with an AI about their day; on request the system analyzes the transcript and surfaces negative emotions with verbatim evidence quotes.

Stack: Next.js 15 App Router · Anthropic Claude · Upstash Redis · Zod · Tailwind · TypeScript.

---

## Commands

```bash
pnpm dev          # start dev server (localhost:3000)
pnpm build        # production build
pnpm lint         # eslint
pnpm eval         # run evals/run.ts against the extraction pipeline
```

Copy `.env.example` to `.env.local` and fill in the four secrets before running anything.

---

## Project layout

```
app/
  page.tsx                        # chat UI
  result/[sessionId]/page.tsx     # emotion results view
  api/
    chat/route.ts                 # streaming chat, enforces turn limit + rate limit
    end/route.ts                  # triggers extraction, idempotent
    session/[id]/route.ts         # read-only session fetch
components/
  Chat.tsx  MessageList.tsx  Composer.tsx  EndButton.tsx  EmotionCard.tsx
lib/
  llm/      client.ts · chat.ts · extract.ts
  prompts/  system.ts · extraction.ts · emotions.ts   ← treat as production artifacts
  storage/  kv.ts · sessions.ts
  types.ts  ratelimit.ts  cost.ts  session-cookie.ts
evals/
  cases.json  run.ts  last-run.json
```

---

## Architecture rules

- **Single model provider**: Anthropic only. `MODEL_CHAT` and `MODEL_EXTRACT` env vars select the model; default is `claude-haiku-4-5-20251001` for both.
- **No per-turn classification**: emotion analysis happens once, at `/api/end`, via a forced `report_emotions` tool call.
- **Turn cap**: `MAX_ASSISTANT_TURNS` (default 8). `/api/chat` must reject turns beyond the cap with `403`.
- **Idempotent end**: if `extraction:{sessionId}` already exists in Redis, `/api/end` returns the cached result without calling the LLM again.
- **Prompts are versioned code**: changes to `lib/prompts/` go through the same review as logic changes.
- **Storage keys**: `session:{id}` · `extraction:{id}` · `ratelimit:{cookieId}`. TTL = 7 days. No relational queries.

---

## Security (OWASP Top 10)

### A01 — Broken Access Control
- Session IDs are opaque UUIDs. `/api/session/:id` is read-only and returns no write surface.
- Never expose another user's session. If auth is added later, enforce ownership checks before any Redis read/write.

### A02 — Cryptographic Failures
- API keys (`ANTHROPIC_API_KEY`, `UPSTASH_REDIS_REST_TOKEN`) live in server-side env vars only. They must never appear in client bundles, logs, or error responses.
- The anonymous session cookie must be set with `HttpOnly; SameSite=Lax; Secure` (Secure enforced in production).

### A03 — Injection
- All API request bodies are validated with Zod before use. Never skip or bypass schema validation.
- User input is treated as message content only. It must never be concatenated into system prompts or tool definitions — there is no user-controlled prompt pathway.
- Redis keys are constructed from validated UUIDs only; no interpolation of raw user input into key names.

### A04 — Insecure Design
- The only executable tool is `report_emotions` (read-only output). No tool may execute code, query external systems, or write state.
- Crisis hand-off is a fixed static string, not model-generated, so it cannot be manipulated by prompt injection.
- Keep the extraction tool schema narrow: `{ emotions: EmotionFinding[], summary: string }`. Do not add fields that accept arbitrary strings as instructions.

### A05 — Security Misconfiguration
- `.env.local` is in `.gitignore`. Never commit real secrets. The repo ships `.env.example` with blank values.
- In production, set `NEXTAUTH_URL` / `NEXTJS_PUBLIC_*` only for values that are genuinely public.
- Vercel preview deployments should use separate, non-production API keys.

### A06 — Vulnerable and Outdated Components
- Run `pnpm audit` before each release. Address high/critical advisories before shipping.
- Pin exact versions in `package.json` for `@anthropic-ai/sdk`, `@upstash/redis`, and `@upstash/ratelimit`.

### A07 — Identification and Authentication Failures
- The session cookie carries an opaque UUID — not a user identity. It is the sole rate-limit handle.
- Rate limit: 10 conversations per cookie per hour; 200 per IP per day (enforced in `/api/chat` via `lib/ratelimit.ts`).
- If the cookie is absent or malformed, generate a new one server-side; never trust a client-supplied ID as an identity claim.

### A08 — Software and Data Integrity Failures
- Validate every `evidenceQuote` in the extraction result is a verbatim substring of a user message before persisting. Drop findings that fail this check — do not trust LLM output blindly.
- Use `zod.parse` (throws) rather than `zod.safeParse` (silent) at API boundaries so invalid payloads never reach storage.

### A09 — Security Logging and Monitoring Failures
- Log one structured line per request: `{ route, sessionId, latencyMs, inputTokens, outputTokens, usdEstimate }`. Do not log message content.
- Never log API keys, cookie values, or raw user messages.
- Set a hard monthly spend cap on the Anthropic API key in the console to bound runaway cost from abuse.

### A10 — Server-Side Request Forgery (SSRF)
- The only outbound HTTP calls are to `api.anthropic.com` and the Upstash REST endpoint. Both are hardcoded in `lib/llm/client.ts` and `lib/storage/kv.ts`.
- Do not accept URLs from user input or allow redirects to arbitrary hosts.

---

## Evaluation

`pnpm eval` runs `evals/run.ts` against `evals/cases.json` (10–15 hand-written transcripts). It reports label-set precision/recall/F1, quote-substring accuracy, and mean USD cost. Results land in `evals/last-run.json`; headline numbers are kept by hand in `EVALS.md`.

Run evals before and after any change to `lib/prompts/` or `lib/llm/extract.ts`.

---

## Cost targets

| Scope | Budget |
|---|---|
| Per conversation (end-to-end) | < $0.01 |

Switch `MODEL_EXTRACT` to `claude-sonnet-4-6` via env; no code change required.
