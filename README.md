# br-chat

A conversational app that talks to a user about their day in English and extracts negative emotions from the transcript. The assistant listens, asks one open question per turn, and — when the conversation ends — runs a single structured analysis pass that surfaces which negative emotions appeared, at what intensity, with verbatim quotes as evidence.

## Prerequisites

- Node.js 20+
- pnpm (`npm i -g pnpm`)
- [Anthropic API key](https://console.anthropic.com/)
- [Upstash Redis](https://console.upstash.com/) database (free tier is enough — create one, copy the REST URL and token)

## Local setup

```bash
git clone <repo-url>
cd br-chat
pnpm install
cp .env.example .env.local
```

Open `.env.local` and fill in the four required secrets:

```
ANTHROPIC_API_KEY=sk-ant-...
KV_REST_API_URL=https://...upstash.io
KV_REST_API_TOKEN=...
```

The remaining variables have sensible defaults (`MODEL_CHAT`, `MODEL_EXTRACT`, `MAX_ASSISTANT_TURNS`, etc.) and don't need to be changed to run locally.

```bash
pnpm dev        # starts at http://localhost:3000
```

## Running the evaluation harness

```bash
pnpm eval
```

Feeds 20+ hand-written transcripts through the same extraction pipeline used in production and reports label-set precision, recall, macro F1, quote-substring accuracy, and mean USD cost per case. Results land in `evals/last-run.json`; headline numbers are kept in `EVALS.md`.

Run this before and after any change to `lib/prompts/` or `lib/llm/extract.ts`.

## Architecture

One Next.js App Router app. API routes handle chat streaming (`/api/chat`), emotion extraction (`/api/end`), and result fetching (`/api/session/:id`). State is stored in Upstash Redis with a 7-day TTL — no database schema, no migrations.

See [SA.md](SA.md) for the full architecture and [DECISIONS.md](DECISIONS.md) for the reasoning behind key choices.

## Deployed app

[TODO: add Vercel URL after deployment]
