---
name: research
description: >
  Pre-product research for fuzzy questions. Use when the user walks in with a
  domain question they can't answer yet — "understand X before I build", "what's
  the right approach for Y", "help me think through Z". Asks 5 clarifying
  questions to sharpen scope, builds a research plan, executes it (web search,
  paper reading, Gemini video passthrough if relevant), and produces a memo that
  bridges into the `contract` skill for building. Triggers on "research",
  "understand", "explore", "help me think through", "what's the landscape of",
  "before I build", or /research. Also triggers on phrases like "I don't know
  what this should be yet", "figure this out first", or "dig into".
allowed-tools: Read, Grep, Glob, Bash, Task, Write, Edit, WebSearch, WebFetch, AskUserQuestion
---

# Research

Pre-product research. The user walks in with a fuzzy question — something they
don't know the answer to yet, where jumping to code would be premature. You
sharpen scope with 5 questions, build a research plan, execute it, and produce
a memo sharp enough for `contract` to turn into a build spec.

**Why this works:** The most expensive failures in agentic coding happen
*before* the code is written — when the agent confidently builds the wrong
thing because the user's question was never disambiguated. gstack's
`/office-hours` handles product-level reframing but assumes you already know
what you're building. This skill handles the layer before that: the
domain-level understanding, prior art, and trade-off landscape. It's the
difference between "help me build a semantic search feature" and "I don't know
if semantic search is even the right shape for this problem."

This skill replaces three separate patterns — clarifying questions before work,
video-to-action extraction, and synthesis — because in practice they are one
workflow. Separating them forces the user to decide the order. Merging them
means the skill decides.

## Execution

### 1. Parse the request

Read the user's question. Determine:

- **Is this actually a research question?** If the user already has a concrete
  spec ("build a REST API with these endpoints"), this is not research — hand
  off to `contract` directly or let them go to gstack's `/office-hours`.
- **What's the domain?** Technical research (papers, algorithms, architectures)
  vs product research (prior art, competitor landscape, user patterns) vs
  mixed. Affects which sources matter.
- **Is there existing research?** Check `docs/research/` for prior memos on
  related questions. If one exists, this task may be a follow-up, not a new
  research cycle.

If the request is truly trivial ("what's the syntax for a Python dict
comprehension"), don't invoke this skill. Answer directly.

### 2. Ask 5 clarifying questions

Before doing any research, ask exactly 5 questions that would most change the
shape of the research. Use AskUserQuestion for mobile-friendly interaction.
Prioritize by impact — ask the things where a different answer means a
completely different memo.

Categories to consider:

- **Audience/user** — who is this for? ("When you say 'beginner,' do you mean
  undergrad CS, hobbyist, or adjacent-field researcher?")
- **Scope** — what's in vs out? ("Are you curating papers or ingesting arxiv
  automatically?")
- **Shape of output** — what does the final product look like? ("Static site,
  interactive app, CLI tool, or something else?")
- **Constraints you care about** — cost, latency, accuracy, UX. ("Is
  pre-generated content acceptable or does this need to respond to user
  queries in real time?")
- **Prior art** — what's already been done? ("Are there reference products you
  want to feel like, or are you explicitly trying to be different?")
- **Depth** — how deep should this go? ("Are we scoping a weekend project or a
  6-month build?")

For each question:
1. State the default assumption you'd make if not asked.
2. Ask the question.
3. Note why the answer matters for the research direction.

Wait for answers before proceeding. If the user says "just do it," use your
defaults and note them in the memo.

### 3. Build and confirm the research plan

Before running searches, produce a plan:

```markdown
## Research plan

Given your answers, I'll investigate:

1. **[Topic 1]** — [web search | paper reading | video analysis]
   - Sources: [specific sites, papers, or channels]
   - Why: [what this answers]

2. **[Topic 2]** — [method]
   - Sources: [...]
   - Why: [...]

...

Estimated: ~{N} web searches, ~{M} papers, ~{V} videos. About {time estimate}.

Proceed or adjust?
```

This gives the user a chance to redirect before you burn tokens on the wrong
research. It also surfaces if the scope is bigger than expected — sometimes the
right response is to narrow the question, not execute the plan.

### 4. Execute the plan

Work through the plan systematically. Use CMUX panes when in CMUX:
- Main Claude pane does the reasoning and synthesis.
- A browser pane (if available) for live paper/site reading.
- Parallel Task calls for independent sub-searches — e.g., simultaneously
  search for "prior art in X" and "technical approaches to Y."

#### Web research
- Use WebSearch for current state, recent work, prior art.
- Use WebFetch for specific URLs the user references or that search surfaces.
- Prefer primary sources — paper PDFs, project pages, canonical documentation —
  over aggregator summaries.
- Keep queries short (3-6 words). Don't paste the user's full question.

#### Paper reading
- When a paper is central, read the abstract, intro, and conclusions first.
  Then the sections relevant to the user's question.
- Extract: the problem the paper addresses, its core contribution, its
  limitations (the paper's own "limitations" section is usually honest), and
  how it relates to adjacent work.
- Never quote verbatim — paraphrase. One-line quotes are fine for a paper's
  central claim.

#### Video analysis (Gemini passthrough)
- If the research plan includes a talk or tutorial, use the Gemini MCP server
  or equivalent video-analysis tool to extract structured content.
- Query for: the speaker's central thesis, the 3-5 most important claims with
  timestamps, any specific examples or demos, and "what would the speaker say
  is the most common mistake."
- Don't try to summarize the whole video — extract the parts that address your
  research question.

#### As you go
- Keep a running "open questions" list. If research surfaces something you
  don't know the answer to, add it to the list rather than pretending to.
- Notice genuine disagreements across sources. These become flags for `debate`
  or `poll` later.

### 5. Produce the memo

Write to `docs/research/{topic-slug}.md`. Structured:

```markdown
# {Topic}

**Date:** {date}
**Question:** {one-sentence distillation of what the user actually wanted}
**Scope:** {what your 5 questions pinned down}

## TL;DR
{3-5 sentences. If the user reads only this, they should walk away with the
core finding and the main decision they now face. No hedging.}

## Context
{Why this question matters now. What the user is trying to accomplish.}

## Key findings
{3-7 findings, each a paragraph or two. Paraphrased, not quoted. Each finding
should be something the user didn't obviously know before the research, or a
crisp confirmation of something they suspected.}

## The landscape
{Prior art, competitive references, adjacent work. What's already been done.
What the current best-in-class looks like.}

## Trade-offs that surfaced
{Places where legitimate approaches disagree. Each one is a candidate for
`debate` or `poll` in the next step. Frame each as "A vs B" with the strongest
case for each.}

## Open questions
{Things the research didn't fully answer. Honest about what you don't know.}

## Recommended next steps
{2-4 concrete moves. One of these is usually "draft a contract for X" or
"debate Y before deciding". Makes the handoff explicit.}

## Sources
{Numbered list. Paper titles + authors + year + link. Video titles + speaker +
length + link. Website names + URL. Enough that the user can check your work.}
```

The memo is the artifact. Everything downstream — `contract`, `debate`,
`poll`, eventually gstack's `/office-hours` — reads this memo as context. Write
it accordingly.

### 6. Flag the decisions that now need making

After writing the memo, surface the specific decisions the user now faces.
These are usually lifted from "Trade-offs that surfaced" but made concrete:

```
Research is done. Memo at docs/research/{slug}.md.

Decisions you now need to make:

1. {Decision 1} — candidates: A, B, C. I'd suggest `poll` if you want a ranked
   pick, or `debate` if you want to see the trade-off argued out.

2. {Decision 2} — this is a product-shape question. Consider running
   `/office-hours` on it before committing.

3. {Decision 3} — looks like you already have strong intuition here. Want to
   just decide, or still want a second opinion?

Ready for the next step? I can:
- Run `debate` or `poll` on any of these.
- Draft a `contract` if you're ready to build.
- Stay in research mode if more questions came up.
```

### 7. Hand off (suggest, then confirm)

After flagging decisions, suggest the specific next skill — but don't invoke
it. Wait for the user to confirm. This keeps the user in control of when the
research phase actually ends.

Based on what the memo surfaced, suggest one of:

- **"Want me to draft a contract for {scope}?"** — when the user has enough
  clarity to build. Wait for yes/no. On yes, invoke `contract` and pass the
  memo path as context so `contract` can pre-fill from it.
- **"Want me to debate {decision}?"** — when there's a genuine trade-off
  surfaced in the memo. On yes, invoke `debate` with the decision and the memo
  as context.
- **"Want me to poll on {decision}?"** — when the user needs to pick between
  enumerated options. On yes, invoke `poll` with the options.
- **"Want more research on {narrower question}?"** — when the memo surfaced a
  sub-question worth its own cycle. On yes, loop back to step 2 with the
  narrower framing.

If the user says "let's build" without picking a suggestion, default to
proposing `contract`. If they push back on the memo itself, don't hand off —
ask what's wrong and iterate.

The skill never invokes the next step silently. The user always says yes first.

## Memo quality bar

A memo passes if a reader who knows nothing about the project can, after
reading the TL;DR and Key findings, describe the user's problem, the 2-3 most
important trade-offs, and what to build first. If a reader needs to ask "but
what does the user actually want," the memo failed at step 2 (the clarifying
questions were too shallow).

A memo fails if:
- It reads like a Wikipedia article on the topic rather than a focused answer
  to the user's specific question.
- It quotes sources verbatim instead of paraphrasing.
- It hedges on every finding ("it depends" without specifying what it depends
  on).
- It doesn't flag any decisions to make next — research that doesn't produce
  decisions is reading, not research.

## When to use

- User walks in with a fuzzy domain question.
- User says "before I build" or "understand this first."
- Starting a new project where the shape isn't obvious.
- Picking a technical approach where the user doesn't know the landscape.
- Evaluating whether a paper or technique is worth building on.

## When NOT to use

- User already has a concrete spec — go to `contract` or `/office-hours`.
- Trivial factual questions — just answer.
- Questions where the answer is clearly in existing docs — read the docs, don't
  research.
- Urgent hotfixes — speed matters more than thoroughness.
- The user has already done the research and just wants to act on it.

## Configuration

| Parameter | Default | Description |
|-----------|---------|-------------|
| question_count | 5 | Clarifying questions (range 3-7) |
| memo_location | docs/research/ | Where memos land |
| depth | standard | `quick` (no videos), `standard`, `deep` (exhaustive) |
| auto_handoff | suggest | `suggest` (propose next skill, wait for confirm), `false` (stop after memo), `true` (invoke immediately) |

User can override: "research this but skip the questions, you have enough
context" or "deep research, take your time."

## Edge cases

- **User refuses clarifying questions.** Use defaults, note them explicitly in
  the memo's Scope section so the user can see what you assumed.
- **Research scope explodes.** If the plan balloons past ~10 sub-topics, stop
  and ask the user which 3-5 matter most. Don't burn tokens on a survey when
  the user wanted a focused answer.
- **Existing memo on the topic.** Read it first. Either the task is a
  follow-up (append a new section) or a rewrite (save the old one with a
  date suffix, write fresh).
- **Conflicting sources.** Don't paper over it. Flag the conflict in "Trade-offs
  that surfaced" — this is exactly the signal that a `debate` or `poll` is
  warranted.
- **Video unavailable or paywalled.** Note it in the memo. Don't pretend to have
  watched it. If the video was central to the plan, ask the user for a
  transcript or an alternate source.
- **User pushes back on the memo.** That's useful signal. Ask what's wrong —
  wrong framing, missed source, wrong depth — and iterate. Don't defend the
  first draft.

## Output files

| File | Description |
|------|-------------|
| `docs/research/{slug}.md` | The memo — persistent, not ephemeral |
| `active/research/plan.md` | The research plan, kept for traceability |

Unlike `debate` or `poll` outputs, memos are **not** overwritten across
invocations. Each memo is its own artifact. If the same topic is researched
twice, the older memo gets a date suffix and the new one takes the canonical
filename.
