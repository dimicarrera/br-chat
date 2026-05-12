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

## D-09 — UI Rework using UI UX Pro Max Design Intelligence for Claude Code

**Status**: Decided

**Context**. Out of the box the app looks quite bad. I know the brief mentions not to focus on the UI, but I still feel the need to make the app look presentable and visually coherent. 

**Decision**. Use UI UX Pro Max Design Intelligence skill provided by https://github.com/nextlevelbuilder/ui-ux-pro-max-skill. After the restyle, run a11y and frontend security checks, review the code manually. 

**Why**. It looks way better when presented as a product, not as a sum of components. 

**Rejected alternatives**. 
- _Styling by myself._ No time, no point doing that.
- _Using UI libraries (MUI, themeUI etc)._ Going with Tailwind and allowing Claude to stylize the app using the guidelines and several short prompts massively reduces the need to implement 3rd party libraries that would possible require to restyle anyway. 

**What this costs us**. Nothing. Installing the skill globally and using it in this project takes several minutes and saves hours if not days. 

--- 

## D-10 — Model choice. Claude Haiku 4.5 for both stages by default. Cost target per conversation. 

**Status**: Decided

**Context**. Brief suggests managing costs and actively thinking about LLM implementation. Using more expensive models doesn't even remotely make sense — I don't run a top-of-the-line HR psychology software, the project doesn't need elaborate analysis engine.

**Decision**. Use Claude Haiku 4.5. 

**Why**. It's cheap, does the job reliably and I can limit my API budget that won't refill unless I want it to. 

**Rejected alternatives**. 
- _Google Gemini free tier._ 100 requests per day might not be enough considering backtests and live demo. 

**What this costs us**. $5 in API budget. Backtests show running all 15 test cases once costs ~$0.04 per run — my budget limit handles the development and demo needs. I won't run a lot of backtests anyway since the system runs well as it is, so this is a better approach than going with Gemini — I have more volume at my disposal.

---

## D-11 — Structured output via forced tool call, not JSON mode or prompt-and-parse

**Status**: Decided

**Context**. The extraction step needs structured output: a typed list of emotion findings plus a summary string. Three mechanisms were available: free-text generation followed by regex/JSON parsing, JSON mode (forces the model to emit valid JSON), or tool use with a declared schema.

**Decision**. Tool use with `tool_choice: { type: 'tool', name: 'report_emotions' }`. The tool schema is declared in `lib/llm/extract.ts`; the model is forced to invoke it, so the response always contains a `tool_use` block with exactly the shape we specified.

**Why**. Free-text parsing fails silently and requires defensive regex that becomes its own maintenance surface. JSON mode forces syntactically valid JSON but still lets the model hallucinate field names, skip required fields, or emit a label string that isn't in our enum — all of which reach downstream code and corrupt storage.

Tool use with a schema gives us something the other two don't: the `label` field is constrained to an enum at the API level. If the model tries to emit `"overwhelm"` instead of `"sadness"`, the response either fails schema validation on Anthropic's side or the SDK surfaces a type error on ours — it never reaches Redis. The `required` field list also makes missing-field bugs impossible rather than caught-at-runtime. Combined with `tool_choice` forcing the call, there is no free-text fallback path to guard against.

**Rejected alternatives**.

- _JSON mode._ Valid JSON is necessary but not sufficient. Schema enforcement is still our problem. We'd be writing the same Zod parsing layer we wrote for the tool input schema, except without enum enforcement at source.
- _Prompt-and-parse._ Adds a parsing and error-recovery layer, makes retries our responsibility, and gives the model a way to say "here is my analysis" in prose before the JSON block, which breaks naive parsers.

**What this costs us**. Tool use is slightly more verbose to declare than a JSON schema in a system prompt. The tradeoff is worth it: the model's output is structurally correct before our code ever touches it.

---

## D-12 — Evaluation via hand-written cases and CLI harness; no eval UI on the result page

**Status**: Decided

**Context**. The brief explicitly calls out "how you'd know the system is working" as a scored dimension. There were two sub-questions: what to measure and where to show it.

On measurement, the options were LLM-as-judge (a second model grades the extraction), human-written reference cases with deterministic scoring, or no formal eval at all.

On display, the options were: a developer-only CLI harness, surfacing eval metrics inside the app's result page, or showing per-finding auditability signals (rationale, verbatim quote) without any aggregate metric.

**Decision**. Hand-written reference cases in `evals/cases.json` scored by `pnpm eval`. Metrics: label-set precision, recall, macro F1; share of findings whose `evidenceQuote` is a verbatim substring of the transcript; mean USD cost. No eval UI in the app. The result page already surfaces `rationale` and `evidenceQuote` per finding, which is the user-facing auditability layer.

**Why — no LLM-as-judge**. LLM-as-judge introduces circular dependency: I'd be using one Anthropic model to evaluate another Anthropic model on the same class of subjective task, with no ground truth to anchor either. It also burns additional credits and tells me only that the judge agreed or disagreed, not *what* the extractor got wrong. A reference set I wrote myself is a tiny bit slower to build but tells me exactly which cases fail and why.

**Why — no eval UI in the app**. The brief doesn't ask for a monitoring dashboard, it asks for a working system I can defend. Serving eval results to the frontend would require storing them server-side, routing them through an API, and keeping them in sync with the case set — a non-trivial engineering surface for a prototype. More importantly, the two audiences are different: the user audits a single conversation's findings via rationale and evidenceQuote, already shown on the result page while I audit the system's aggregate accuracy via the CLI. Mixing them adds UI complexity and confuses the story on the walkthrough.

**What this costs us**. The eval harness is only as good as the cases I wrote. Gaps in the case set are gaps in my visibility. Accepted: the brief is explicit that I'm being scored on judgment, not on having a perfect eval pipeline.

**Revisit when**. If this were a real product, a developer-facing accuracy dashboard backed by stored eval runs would be the right next investment. Not for this prototype.

---

## D-13 — Explicit non-features

**Status**: Decided

**Context**. The brief says a small system I can defend beats a large one I can't. Every feature not on this list was a thing I considered and ruled out, not a thing I didn't think of.

**Decision**. The following are explicitly out of scope and will not be built:

- **Conversation history UI.** Sessions are anonymous throwaway UUIDs. There's no identity to list history against, and the result page is reachable from the session cookie for 7 days if needed.
- **Multi-language support.** The brief says English-only. This isn't a decision I need to make; it's a constraint I implemented by not doing anything special.
- **Voice input.** Requires a speech-to-text pipeline and edge-case handling that would eat a day by itself with no benefit to extraction quality, which is what's being scored.
- **Flashy UI, animations, fluid layout.** The brief explicitly says visual polish is not scored. The app works on desktop, it's responsive enough. It has a11y principles set in place and is secure as far as its use case goes and even beyond that. Lighthouse score 100/100/96/100.
- **Persistent accounts and auth.** Anonymous session cookie is sufficient for the prototype. Auth requires a user store, password flows, and session management — a week of work on its own that adds no demonstrable value here. I'm planning on adding HTA prompt on every visit so this acts as an auth gate of its own. 
- **Per-turn live emotion sidebar.** Already addressed in D-02. It's a worse product experience and a worse extraction quality, at higher cost.
- **Export or result sharing.** The result page is a URL the user already has. Adding export adds a format decision (PDF? JSON?) and another surface to maintain.
- **Conversation branching or message editing.** Messages are append-only. Editing past turns would invalidate `sourceMessageId` references and make the evidenceQuote validation non-deterministic.

**Why this entry exists**. On the walkthrough, "why didn't you build X" is a predictable question. Having written answers to the obvious X's means I'm defending a position, not scrambling for one.

---

## Pending decisions

D-14 — What I would do with another week. Ordered list with rationale. Drives the closing minutes of the walkthrough.

## Open questions

None currently.

## Future tasks

- Add HTA in prod to drastically limit token overconsumption by attackers.
- Run a proper code review