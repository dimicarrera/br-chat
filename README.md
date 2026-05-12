# br-chat

A conversational app that talks to a user about their day in English and extracts negative emotions from the transcript. The assistant listens, asks one open question per turn, and — when the conversation ends — runs a single structured analysis pass that surfaces which negative emotions appeared, at what intensity, with verbatim quotes as evidence.

## Prerequisites

- Node.js 20+
- pnpm (`npm i -g pnpm`)

## Local setup

```bash
git clone https://github.com/dimicarrera/br-chat.git
cd br-chat
pnpm install
cp .env.example .env.local
```

You'd need my .env.local contents in order to run the app locally without the need to configure your own keys.

Then, run the app:

```bash
pnpm dev        # starts at http://localhost:3000
```

## Running the evaluation harness

```bash
pnpm eval
```

Feeds 15 hand-written transcripts through the same extraction pipeline used in production and reports label-set precision, recall, macro F1, quote-substring accuracy, and mean USD cost per case. Results land in `evals/last-run.json`.

Run this before and after any change to `lib/prompts/` or `lib/llm/extract.ts`.

## Architecture

One Next.js App Router app. API routes handle chat streaming (`/api/chat`), emotion extraction (`/api/end`), and result fetching (`/api/session/:id`). State is stored in Upstash Redis with a 7-day TTL — no database schema, no migrations.

See [SA.md](SA.md) for the full architecture and [DECISIONS.md](DECISIONS.md) for the reasoning behind key choices.

## Deployed app

It's locked behind basic auth.

https://br-chat.vercel.app/
