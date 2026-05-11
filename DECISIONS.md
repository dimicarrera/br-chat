# Decisions

Running log of decisions made while building this project.
Every entry is dated and immutable once marked `Decided` — if I reverse a decision, I add a new entry that supersedes the old one rather than rewriting history.

## Conventions

- **Statuses**: `Decided` (final until superseded), `Open` (under consideration), `Superseded` (replaced by a later entry — references the replacement).
- **Order of sections in an entry**: Context → Decision → Why → Rejected alternatives → What this costs us → (optional) Revisit when. This mirrors the order of questions I expect on the walkthrough.
- **"Why" vs "Context"**: context is the situation that forced the decision; why is what makes this answer right given that situation.
- **Granularity**: one decision per entry. If a topic has more than one defensible choice inside it, split.

---

## D-01 — Working definition of "negative emotion"

**Status**: Decided

**Context**. The case study brief doesn't define "negative emotion" and says outright there's no correct answer. The emotion extractor needs one. If I don't pin a definition down, the model picks one for me, and when asked I won't be able to explain why I shipped what I shipped.

**Decision**. I need to define a list of labels that show up in conversation recaps: `sadness`, `anxiety`, `frustration`, `shame`, `resentment`, `disappointment`, `anger`, `burnout`, `envy`, `loneliness`, `jealousy`. Each gets a one-line operational definition. The list lives in `lib/prompts/emotions.ts` and is reused verbatim in the extraction prompt and in the result UI as a single source of truth.

**Why**. Academic definitions are way too complicated to study and implement in the context of this app and the time constraints force me to look for a simpler solution. I need a label system with clean coverage for things like "I'm tired of pretending I'm fine" or "my boss still hasn't replied" which is what a day-recap actually sounds like. A short list is also small enough to drop into a tool-use enum and also small enough for the model to use without drift. Reusing the same definitions in the UI means the user, the prompt, and I as a developer are all looking at the same words.

**Rejected alternatives**.

- _Ekman six minus joy and surprise._ No room for shame or burnout, both extremely common in this kind of conversation.
- _Full Plutchik wheel._ Too many labels, too much overlap, every label becomes a separate argument to win on the call.
- _Let the model emit free-form labels._ Hands the definition problem back to the model. That's exactly what the brief is testing against.

**What this costs us**. Anything outside the list becomes invisible.

**Revisit when**. The eval set surfaces something real that doesn't fit any current label.

---

## D-02 — Extraction runs once, at the end of the conversation

**Status**: Decided

**Context**. Three options were on the table: extract on every user message, OR extract only at the end, OR run a hybrid. They have different costs, latency, and quality profiles, and the choice defines the rest of the system.

**Decision**. One extraction pass over the full chat transcript, triggered when the user clicks "End conversation" or hits the turn cap.

**Why**. Per-message emotion extraction multiplies the model bill by the number of turns and adds latency to every reply. The brief explicitly warns again burning credits, so that path is hard to justify.

More importantly, negative emotions in a recap usually only become visible across several messages. A single turn rarely carries enough context, for example when someone says "fine" three times before they say what's actually wrong. An end-of-session pass hands the model the full thing at once, which is the shape this problem actually wants.

**Rejected alternatives**.

- _Per-turn classification._ Expensive, noisy, and an inline emotion sidebar steals attention from the conversation. The chat goes worse, the extraction goes worse.
- _Hybrid — cheap per-turn detection plus a richer end-of-session pass._ Defensible, but it's two prompts and two failure modes to maintain inside a two-day budget, and I don't think the quality gain pays for that.

**What this costs us**. No live feedback during the chat — the user sees results only after ending. And the whole thing is one inference: if it fails, there's no partial result. Mitigated by a retry and by storing the result idempotently against the session id.

---

## D-03 — Next.js full-stack on Vercel with no separate backend

**Status**: Decided

**Context**. Stack was a free choice. My general preferences are React/TypeScript and Python/FastAPI. The non-negotiables are the two-day ceiling and a zero-setup deploy URL.

**Decision**. One Next.js App Router app on Vercel. API routes for chat streaming and extraction. Upstash Redis (REST) for state.

**Why**. One repo, one deploy, one secrets store, no CORS, no second hostname. `git push` ships it. Token streaming works out of the box. By my count, going FastAPI + a separate frontend would have eaten roughly half a day on incidental glue — two deploy targets, secrets split across providers, CORS, separate logs — and the brief is explicit that none of that is what's being scored.

**Rejected alternatives**.

- _Vite + React + FastAPI on Fly.io or Railway._ Would have used more of my Python background and would probably be the right call on a longer project. On two days it's the wrong call.
- _SPA + serverless Python functions._ Same language split, same operational tax, no real upside.

**What this costs us**. This approach would showcase less direct coding experience than Brainapptica might want to see. Since I'm not being evaluated as a coder per se, I don't think this is relevant anyway. 

---

## Pending decisions

To be filled in as implementation progresses.

## D-04 —

**Status**:  
**Context**.
**Decision**.
**Why**.
**Rejected alternatives**.
**What this costs us**.

---

## Open questions

Things I don't have an answer to yet and want to track explicitly rather than forget.

- Whether the extraction prompt should see assistant messages or only user messages. Current default: full transcript, because the assistant's questions give user replies their meaning. But the assistant text is also a possible source of label contamination if it ever mirrors emotional vocabulary back at the user.
- How to frame "no negative emotions detected" in the UI. Three real options: positive ("sounds like it was a good day"), neutral ("nothing strong enough to flag"), or inconclusive ("not enough signal"). Each carries a different implicit promise about what the system can detect.
- What to do on extraction validation failure (e.g. a quote that isn't a substring of any user message). Retry once with a corrective system message, or report and stop. Retry can mask a brittle prompt; stopping forces me to actually fix it.
- Whether evidenceQuote should be checked against sourceMessageId specifically, or against any user message in the transcript. The stricter check catches a real failure mode (model attributes a quote to the wrong message) but is more brittle to minor paraphrasing.
- Whether rate limiting on an anonymous cookie has any real defensive value given that anyone hostile can clear it. Probably worth keeping for accidental abuse and as a defence-in-depth layer, but I shouldn't present it on the revision call as a real security control. 
