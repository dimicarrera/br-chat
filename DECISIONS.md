# Decisions

Running log of decisions made while building this project. Every entry is immutable once marked `Decided` — if I reverse a decision, I add a new entry that supersedes the old one rather than rewriting history.

## Conventions

- **Statuses**: `Decided` (final until superseded), `Open` (under consideration), `Superseded` (replaced by a later entry — references the replacement).
- **Order of sections in an entry**: Context → Decision → Why → Rejected alternatives → What this costs us → (optional) Revisit when. This mirrors the order of questions I expect on the walkthrough.
- **"Why" vs "Context"**: context is the situation that forced the decision; why is what makes this answer right given that situation.
- **Granularity**: one decision per entry. If a topic has more than one defensible choice inside it, split.

---

## D-01 — Working definition of "negative emotion"

**Status**: Decided

**Context**. The case study brief doesn't define "negative emotion" and says outright there's no correct answer. The emotion extractor needs one. If I don't pin a definition down, the model picks one for me, and when asked I won't be able to explain why I shipped what I shipped.

**Decision**. The system uses a fixed list of 11 labels that show up in conversation recaps: `sadness`, `anxiety`, `frustration`, `shame`, `resentment`, `disappointment`, `anger`, `burnout`, `envy`, `loneliness`, `jealousy`. Each has a one-line operational definition. The list lives in `lib/prompts/emotions.ts` and is reused verbatim in the extraction prompt and in the result UI as a single source of truth.

**Why**. Academic taxonomies didn't fit this conversation shape. Ekman is calibrated to facial recognition, Plutchik to evolutionary categories. Neither has clean coverage for things like "I'm tired of pretending I'm fine" or "my boss still hasn't replied" — which is what a day-recap actually sounds like. A short prose-defined list is also small enough to drop into a tool-use enum and small enough for the model to use without drift. Reusing the same definitions in the UI means the user, the prompt, and I as a developer are all looking at the same words.

**Rejected alternatives**.

- _Ekman six minus joy and surprise._ No room for shame or burnout, both extremely common in this kind of conversation.
- _Full Plutchik wheel._ Too many labels, too much overlap, every label becomes a separate argument to win on the call.
- _Let the model emit free-form labels._ Hands the definition problem back to the model. That's exactly what the brief is testing against.

**What this costs us**. The list leans Western and work/relationships-shaped. Some affective states are still missing — guilt, regret, grief, and mixed or ambivalent feelings — and would surface as either the wrong label or an empty result. A non-English or cross-cultural version would need a rewrite of both the list and the definitions.

**Revisit when**. The eval set surfaces something real that doesn't fit any current label.

---

## D-02 — Extraction runs once, at the end of the conversation

**Status**: Decided

**Context**. Three options were on the table: extract on every user message, OR extract only at the end, OR run a hybrid. They have different costs, latency, and quality profiles, and the choice defines the rest of the system.

**Decision**. One extraction pass over the full chat transcript, triggered when the user clicks "End conversation" or hits the turn cap.

**Why**. Per-message emotion extraction multiplies the model bill by the number of turns and adds latency to every reply. The brief explicitly warns against burning credits, so that path is hard to justify.

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

---

## D-04 — Extraction prompt receives only user messages, not the full transcript

**Status**: Decided

**Context**. The extraction prompt could be handed the entire conversation (user + assistant turns) or only the user messages. Both are defensible. The question is whether assistant text adds useful context or contaminates the label output.

**Decision**. Pass only the user-side messages to the extractor.

**Why**. Three reasons stacked.

First, the `evidenceQuote` schema only accepts substrings of user messages (validated in `lib/llm/extract.ts`). Assistant text can never become evidence under the system's own contract, so feeding it in serves no extraction purpose — only framing context.

Second, the assistant's text is generated under _my_ system prompt. Feeding it back into the extractor creates a closed loop where the model is, in effect, partly analyzing its own framing. If the chat prompt is ever changed (different tone, different question style), the extractor's input changes for reasons unrelated to the user's emotional state.

Third, context that mattered from the assistant side is already reflected in user replies — people answer in terms shaped by the question asked. The signal is captured upstream.

**Rejected alternatives**.

- _Full transcript (user + assistant)._ More expensive in tokens and creates the prompt-coupling loop above. The "better context" argument is largely absorbed by the third reason.
- _User messages plus the system prompt._ Worst of both worlds: still couples extractor to chat prompt, adds no new content.

**What this costs us**. Edge cases where the assistant directly named an emotion ("it sounds like that was really frustrating?") and the user responded with confirmation only ("yeah, exactly") become harder to label. In practice this is rare — bare confirmations without elaboration would be low-intensity signals anyway, on the edge of being worth flagging.

---

## D-05 — `evidenceQuote` validated against any user message, not against `sourceMessageId` specifically

**Status**: Decided

**Context**. The extraction result includes both `evidenceQuote` and `sourceMessageId`. I could validate that the quote is a substring of the message with that specific id, or that it is a substring of _any_ user message.

**Decision**. Validate against any user message (`lib/llm/extract.ts:69`). Drop findings that fail this check; accept findings where the quote appears in a different user message than the one the model cited.

**Why**. The stricter check (`sourceMessageId`-specific) catches a real but rare failure mode — the model citing the right quote but tagging the wrong message id. In practice, the model more often gets the quote right and the id wrong than it invents a quote wholesale. Failing on id mismatch would silently discard valid findings. The looser check preserves the finding; the `sourceMessageId` field is advisory context for the UI, not a hard contract.

**Rejected alternatives**.

- _Check quote against the specific `sourceMessageId` message only._ Catches false attribution but also throws away good findings due to id errors. Acceptable if the model were reliable on ids; it isn't.

**What this costs us**. A finding might display under the wrong message in a per-message annotation UI (if one were built). We don't have that UI; the result page shows a flat list of findings. Cost is negligible right now.

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

## D-08 — Per-cookie rate limit kept, but explicitly not described as a security control

**Status**: Decided

**Context**. The rate limit (10 conversations per anonymous cookie per hour) relies on a cookie value any hostile user can clear. Its defensive value is therefore limited.

**Decision**. Keep the rate limit as-is. **Do not** describe it as a security control in the walkthrough or in any documentation. It is presented for what it actually is: an accidental-abuse limiter.

**Why**. It provides real value against accidental abuse: a curious user hitting reload, a script that doesn't clear cookies, an automated scan that respects cookies. It adds no operational burden. It just shouldn't be cited as a meaningful defence against a determined attacker — that would overstate what's there, and would be the wrong claim to defend.

**Rejected alternatives**.

- _Remove it entirely._ No upside; it does stop accidental overconsumption and is already implemented.
- _Replace with IP-based rate limiting only._ The existing `@upstash/ratelimit` setup already does 200/IP/day as a secondary layer. Cookie limiting is additive, not redundant.

**What this costs us**. Nothing. A real attacker clears the cookie; an accidental one doesn't.

---

## D-09 — Visual polish capped at a non-distracting baseline

**Status**: Decided

**Context**. The default unstyled Next.js + Tailwind output was below my personal floor for shipping anything I'd demo on a call. The brief explicitly does not score visual polish, but a visibly raw UI distracts the reviewer from what _is_ being scored.

**Decision**. Spent ~30 minutes running a single design pass via the UI UX Pro Max Design Intelligence skill (https://github.com/nextlevelbuilder/ui-ux-pro-max-skill) to reach a professional baseline. Reviewed the resulting code manually, ran a11y and frontend security checks. No further visual investment.

**Why**. "Visual polish is not scored" sets a ceiling, not a floor. A clearly amateur-looking UI signals carelessness about everything else, even when that's not what's being graded. A single AI-assisted styling pass over a Tailwind app is cheap enough that not doing it spends more credibility than doing it costs.

**Rejected alternatives**.

- _Style by hand._ Half a day of work I don't have, on something explicitly not scored.
- _Install a UI component library (MUI, theme-ui, shadcn)._ More setup, more dependencies, more visual choices I'd have to defend stylistically. Tailwind + a single styling pass is lighter and uses less third-party surface.
- _No styling pass at all._ The default look is below the bar I'd ship anything against, even on a 2-day prototype.

**What this costs us**. Some of the visual choices came from the skill rather than from explicit design intent. If asked "why this layout or that colour", the honest answer is: that's the skill's baseline, not a deliberate design decision. 

---

## D-10 — Single model for both stages: Claude Haiku 4.5

**Status**: Decided

**Context**. Two model decisions were nested in one: which provider, and whether to use the same model for chat and extraction or split them. The brief calls out cost management explicitly.

**Decision**. Use Claude Haiku 4.5 for both the chat loop and the extraction call. Hard spend cap set on the Anthropic API key.

**Why**. Haiku is the cheapest production-grade model in the Anthropic line, reliable at the level of dialog and structured extraction this app needs. Empirically: an 8-message conversation plus the extraction call costs roughly **$0.003** end to end; one full pass of the 15-case eval set costs ~$0.04. The hard $5 spend cap on the key covers all development and demo needs by an order of magnitude.

Splitting models (Haiku for chat, Sonnet for extraction) would gain marginal quality on the extraction step, but I'd be committing to a cost increase blind. The eval harness is the right gate for that decision — if Haiku's extraction plateaus below acceptable, the upgrade has evidence behind it.

**Rejected alternatives**.

- _Split models (Haiku chat + Sonnet extract)._ Better quality ceiling but not justified before the eval harness shows Haiku failing. Revisit if eval plateaus.
- _GPT-4o-mini._ Equivalent cost/capability profile. No technical reason to prefer one over Haiku; one fewer provider for credentials and SDK is the tiebreaker.
- _Gemini free tier (100 req/day)._ Cap on volume conflicts with running the eval harness multiple times during development.

**What this costs us**. Single-model architecture means any future quality gain from model splitting requires re-running the eval and reorganizing the LLM client layer. Cheap to undo.

**Revisit when**. Eval stays below an acceptable threshold despite prompt iteration.

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

**Why — no LLM-as-judge**. LLM-as-judge introduces a circular dependency: I'd be using one Anthropic model to evaluate another Anthropic model on the same class of subjective task, with no ground truth to anchor either. It also burns additional credits and tells me only that the judge agreed or disagreed, not _what_ the extractor got wrong. A reference set I wrote myself is slightly slower to build but tells me exactly which cases fail and why.

**Why — no eval UI in the app**. The brief doesn't ask for a monitoring dashboard; it asks for a working system I can defend. Serving eval results to the frontend would require storing them server-side, routing them through an API, and keeping them in sync with the case set — a non-trivial engineering surface for a prototype.

The two audiences are also different. The user audits a single conversation via the `rationale` and `evidenceQuote` already shown on the result page. I audit the system's aggregate accuracy via the CLI. Mixing them adds UI complexity and confuses the story on the walkthrough.

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
- **Flashy UI, animations, fluid layout.** The brief explicitly says visual polish is not scored. The app works on desktop and is responsive enough. Non-visual quality is in place: a11y principles applied, reasonable security posture for the use case, Lighthouse 100/100/96/100 across Performance, Accessibility, Best Practices, and SEO.
- **Persistent accounts and full auth.** Anonymous session cookie is sufficient for the prototype. Full auth requires a user store, password flows, and session management — a week of work on its own that adds no demonstrable value here. An HTTP Basic Auth prompt is added on every visit to act as a lightweight access gate for the demo URL.
- **Per-turn live emotion sidebar.** Already addressed in D-02. Worse product experience, worse extraction quality, higher cost.
- **Export or result sharing.** The result page is a URL the user already has. Adding export adds a format decision (PDF? JSON?) and another surface to maintain.
- **Conversation branching or message editing.** Messages are append-only. Editing past turns would invalidate `sourceMessageId` references and make the `evidenceQuote` validation non-deterministic.

**Why this entry exists**. On the walkthrough, "why didn't you build X" is a predictable question. Having written answers to the obvious X's means I'm defending a position, not scrambling for one.

---

# What I would do with another week

Not decisions — a separate forward-looking list. The closing minutes of the walkthrough draw from here. Ordered by leverage.

## 1. Pair a user feedback loop with eval-set expansion

The eval harness is bottlenecked on the 15 cases I wrote, and those cases reflect my own assumptions about what's hard for the system. With another week, I'd add a simple feedback affordance to the result page — a "this is wrong" / "you missed something" pair of buttons per finding — that pushes flagged findings into a moderation queue. From the queue, real failure modes become candidate eval cases.

This is the highest-leverage item on the list. Every other improvement only compounds if the eval set keeps growing past my own biases. Without it, model and prompt work asymptote against a fixed and incomplete benchmark.

## 2. Two-stage extraction with a separate verifier

The current pipeline does four things in a single tool call: identify the emotion, find the quote, judge intensity, write the rationale. The fragile step is the quote — D-06 already silently drops findings whose quotes don't validate.

With more time I'd split this into two passes — a candidate-then-verify pipeline. The first pass runs on the cheap model and generates candidate `(label, quote)` pairs. The second pass on a more capable model (Sonnet, not Opus — Opus is overkill for this) takes each candidate plus the full transcript and independently confirms: is the quote really present, what intensity does it actually carry, what's the supporting reasoning. Both passes get stored, so systematic model errors become visible across the eval set rather than only on individual conversations.

## 3. Intensity calibration via reference anchors

The low/mid/high scale works because it's coarse. LLMs are known to be poor at fine numeric calibration without reference points. With another week, I'd add 2–3 worked examples per intensity level to the extraction prompt — each one a short user excerpt with a fixed intensity label, used as an anchor. This is the same technique psychometric scales use, and it would let me reasonably move to a 5-point scale without losing reliability.

Listed third because I haven't yet seen evidence that the 3-point scale is the bottleneck. Worth doing only after the feedback loop has surfaced concrete miscalibration cases.

## 4. Production-grade UI

The current look is a non-distracting baseline (see D-09), not a finished product. A real version would have proper branding, considered micro-interactions, a mobile-responsive layout, explicit empty-state and loading-state for every async boundary, and an actual designer's input on the result-page hierarchy.

Listed last because the brief explicitly does not score visual polish, and at the prototype stage every hour spent on UI is an hour not spent on the items above. In a real product with real users and a real team, this becomes a real line item.
