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

## D-04 — Extraction prompt receives just user messages

**Status**: Decided

**Context**. The extraction prompt could be handed the entire conversation (user + assistant turns) or only the user messages. Both are defensible. The question is whether assistant text contaminates the label output.

**Decision**. Don't pass the full transcript.

**Why**. Contamination risk is real and token costs double. Only evaluate what user says. 

**Rejected alternatives**.

- _Both side transcript._ More expensive in tokens, albeit with better context of messages provided by both sides. 

**What this costs us**. Some content might be lost due to processing a single side of the conversation.

---

## D-05 — `evidenceQuote` validated against any user message, not against `sourceMessageId` specifically

**Status**: Decided

**Context**. The extraction result includes both `evidenceQuote` and `sourceMessageId`. I could validate that the quote is a substring of the message with that specific id, or that it is a substring of *any* user message.

**Decision**. Validate against any user message (`lib/llm/extract.ts:69`). Drop findings that fail this check; accept findings where the quote appears in a different user message than the one the model cited.

**Why**. The stricter check (`sourceMessageId`-specific) catches a real but rare failure mode — the model citing the right quote but tagging the wrong message id. In practice, the model more often gets the quote right and the id wrong than it invents a quote wholesale. Failing on id mismatch would silently discard valid findings. The looser check preserves the finding; the `sourceMessageId` field is advisory context for the UI, not a hard contract.

**Rejected alternatives**.

- _Check quote against the specific `sourceMessageId` message only._ Catches false attribution but also throws away good findings due to id errors. Acceptable if the model was reliable on ids; it isn't.

**What this costs us**. A finding might display under the wrong message in a per-message annotation UI (if one were built). We don't have that UI; the result page shows a flat list of findings. Cost is negligible right now.

**Revisit when**. Not really a "when", but if a per-message annotation view is added to the result page. Most likely won't happen. 

---

## D-06 — On extraction validation failure, drop bad findings and return the rest

**Status**: Decided

**Context**. When a finding's `evidenceQuote` doesn't appear in any user message, the system has three options: throw a hard error, retry with a corrective message, or silently drop the finding and return the remaining valid ones.

**Decision**. Drop and continue. Return whatever valid findings remain, including an empty array if none survive.

**Why**. A partial result is more useful to the user than an error page. A retry-with-correction is tempting but masks a brittle prompt rather than fixing it — if the prompt is producing ungrounded quotes consistently, the eval harness will surface that and force a real fix. The silent drop + eval loop is the feedback mechanism.

**Rejected alternatives**.

- _Hard error on any invalid finding._ Turns a prompt quality issue into a user-visible failure. Worse experience for no diagnostic benefit.
- _Retry once with a corrective system message._ Could recover from a transient model error. Also hides prompt quality regressions. With the eval harness in place, hiding them is the worse tradeoff.

**What this costs us**. A user could see a result with fewer findings than the true count, with no indication that any were dropped. Accepted at prototype scale where the eval harness is the quality gate.

---

## D-07 — "No negative emotions detected" framed as a neutral non-finding

**Status**: Decided

**Context**. When the extraction returns an empty `emotions` array, the result page needs to say something. The options are: positive framing ("sounds like a good day"), neutral framing ("nothing strong enough to flag"), or inconclusive framing ("not enough signal to say").

**Decision**. Neutral: "Nothing strong enough to flag from this conversation." Shown in the result page when `emotions.length === 0`.

**Why**. Positive framing makes a claim the system can't support — the conversation might have been superficial or the user might have withheld. Inconclusive framing undersells the system — it implies the conversation was too short or the model too uncertain, even when the signal is genuinely absent. Neutral framing makes only the claim the system actually made: it looked, and it found nothing above threshold.

**Rejected alternatives**.

- _"Sounds like a good day!"_ Would be wrong any time the user was brief or closed off. The system can't distinguish "good day" from "didn't share."
- _"Not enough signal to draw conclusions."_ Makes the system sound unreliable even when it worked correctly.

**What this costs us**. The result feels anticlimactic after an emotional conversation where the user was very private. Acceptable — honesty about detection limits is more important than a satisfying result screen.

---

## D-08 — Per-cookie rate limit kept but not presented as a security control

**Status**: Decided

**Context**. The rate limit (10 conversations per anonymous cookie per hour) relies on a cookie value any hostile user can clear. Its defensive value is therefore limited.

**Decision**. Keep the rate limit as-is. Describe it as a security control in the walkthrough or documentation.

**Why**. It provides real value against accidental abuse: a curious user hitting reload, a script that doesn't clear cookies, an automated scan that respects cookies. It adds no operational burden. It just shouldn't be cited as a meaningful defence against a determined attacker.

**Rejected alternatives**.

- _Remove it entirely._ No upside; it does stop accidental overconsumption and is already implemented.
- _Replace with IP-based rate limiting only._ The existing `@upstash/ratelimit` setup already does 200/IP/day as a secondary layer. Cookie limiting is additive, not redundant.

**What this costs us**. Nothing. A real attacker clears the cookie; an accidental one doesn't.

---

## Open questions

None at this point.

## Pending decisions

None at this point.

## Future tasks

- Add HTA in prod to drastically limit token overconsumption by attackers.
- Add pnpm arch script to verify CI on every push
- Add architectural rules to dependency-cruiser.cjs
- Run a proper code review