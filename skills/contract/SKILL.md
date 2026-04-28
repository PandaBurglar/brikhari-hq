---
name: contract
description: >
  The bridge between research and build. Defines a 4-part spec — GOAL,
  CONSTRAINTS, FORMAT, FAILURE — that turns fuzzy understanding into something
  gstack can implement against. Three modes: convert from a research memo,
  build interactively with the user, or validate a contract the user wrote.
  Treats the contract as a hard spec, not a suggestion. Triggers on "contract",
  "draft a contract", "spec this out", "define success", "what does done look
  like", or /contract. Also triggers on phrases like "let's build" (after
  research), "turn the memo into a spec", or "I'm ready to build".
allowed-tools: Read, Grep, Glob, Bash, Task, Write, Edit, AskUserQuestion
---

# Contract

The bridge from research to build. A contract is a 4-part spec: **GOAL**
(quantifiable success), **CONSTRAINTS** (hard limits), **FORMAT** (exact output
shape), **FAILURE** (explicit conditions that mean "not done"). Once a contract
is approved, gstack takes over — the contract becomes the input to
`/office-hours`, `/plan-ceo-review`, and downstream build skills.

**Why this works:** Research produces understanding; understanding doesn't
ship. Code ships. A contract is the minimum translation of "I understand the
problem" into "here's exactly what I'm building, and here's what 'done' means."
The FAILURE clause is the key part — it prevents gstack (or Claude, or a
subagent) from taking shortcuts that "technically work" but miss the point.

This skill is the seam. Everything upstream is exploratory. Everything
downstream is execution. The contract is the artifact that crosses the line.

## Execution

### 1. Detect mode

Three modes. Pick based on inputs:

- **Convert mode** — a research memo exists and the user said "let's build" or
  "draft a contract" or similar. Read the memo and pre-fill. Most common mode.
- **Interactive mode** — no memo, user wants to build something they already
  understand. Build the contract by asking questions.
- **Validate mode** — the user provided a contract (in the message, in a
  linked file, or paste). Check completeness and hand off.

If ambiguous — e.g., memo exists but user says "I want to build X which isn't
quite what the memo covered" — ask: "Use the memo as the starting point, or
start fresh?"

### 2a. Convert mode — from research memo

Read the memo. Extract the raw material:

- **GOAL** draft from the memo's TL;DR + Recommended next steps. Must be
  measurable. If the memo says "make robotics papers approachable," draft
  something like "A beginner with no RL background can read a robotics paper's
  abstract + TL;DR layer on learnrobotics.ai and describe the paper's
  contribution in their own words in under 5 minutes."
- **CONSTRAINTS** draft from the memo's Context and Scope. Tech choices
  mentioned, scope boundaries, anything the user said "not doing X" about.
- **FORMAT** draft from Recommended next steps and Trade-offs that surfaced.
  What artifacts need to exist? One file? A service? A site?
- **FAILURE** draft from Open questions and Trade-offs. Each unresolved
  tension is a potential failure condition. Also add the standard ones
  appropriate to the artifact type (see Failure templates below).

Present the draft to the user. Don't claim it's final:

```
I've drafted a contract from docs/research/{slug}.md. Review and tell me
what to adjust.

## Contract — v0 draft

GOAL: {drafted goal}

CONSTRAINTS:
- {drafted constraint 1}
- {drafted constraint 2}
...

FORMAT:
- {drafted format}

FAILURE (any of these = not done):
- {drafted failure 1}
- {drafted failure 2}
...

What's wrong with this?
```

Explicit invitation to critique. Not "looks good?" — that biases toward
agreement.

### 2b. Interactive mode — no memo

Build the contract by asking. Don't ask all four at once — go section by
section so the user can think.

**First, GOAL:**
> "What does success look like? Give me a measurable metric — not 'fast' but
> 'responds in under 200ms p95'. What's the user-visible outcome?"

**Then CONSTRAINTS:**
> "What are the hard limits? Technology you must use or can't use, scope
> boundaries, compatibility requirements?"

**Then FORMAT:**
> "What does the output actually look like? Single file or many? New service
> or extending existing? What has to be included — tests, docs, types?"

**Then FAILURE (this is the most important):**
> "How could this task technically work but still be wrong? I'll suggest a
> few based on what you've told me; you add the ones I'd miss."

For FAILURE, always propose 3-5 candidates based on what the user has said,
then ask what else to add. Users under-specify failure conditions when asked
cold.

### 2c. Validate mode — user-provided contract

Parse the user's text into the 4 sections. Check:

- **Completeness** — are all 4 sections present and non-empty?
- **Consistency** — do CONSTRAINTS contradict GOAL? (e.g., "handle 100K
  req/sec" + "no caching allowed" is suspicious.)
- **Testability** — can every FAILURE condition be mechanically verified?
  Flag any that can't.
- **Scope** — is GOAL achievable within CONSTRAINTS? If GOAL requires an
  external service but CONSTRAINTS say "no new dependencies," flag it.

Report back:

```
Contract review: {PASS | NEEDS WORK}

{If PASS}: Looks handoff-ready. Proceeding to classification.
{If NEEDS WORK}: Here's what I'd tighten:
  - {specific issue 1}
  - {specific issue 2}
Want me to draft the fixes, or do you want to revise?
```

### 3. Classify the contract

Before handoff, determine what *kind* of build this is. Affects which skill
takes over:

- **Standard build** — feature work, UI, non-critical backend, content. Hand
  off to gstack's full chain: `/office-hours` → `/plan-ceo-review` →
  `/plan-eng-review` → build → `/review` → `/qa` → `/ship`.
- **Critical-path build** — auth, payments, access control, crypto,
  migrations, anything touching sensitive data. Same chain, but replace
  `/review` with `verify`. Add a note in the contract's FAILURE section
  flagging the critical-path concern.
- **Content build** — blog post, documentation, marketing page. Skip
  `/plan-eng-review` and `/qa`. Hand off to `/office-hours` for framing, then
  to write, then `/review`.
- **Research-adjacent build** — a prototype meant to answer a question, not
  to ship. Skip `/ship`. Consider whether it should've been research instead.

Ask the user to confirm the classification:

```
Classification: {detected type}

That means the build path is:
  {ordered list of skills to invoke}

Sound right?
```

Let the user correct it. They know things about the project you don't.

### 4. Lock the contract

Once approved:

1. Write the contract to `docs/contracts/{slug}.md` with the research memo
   linked at the top if one exists.
2. Append the classification and the planned build path.
3. Append a "Contract verification" section with empty checkboxes for every
   FAILURE condition — this is what gets filled in during the build phase.

File format:

```markdown
# Contract: {slug}

**Date:** {date}
**Research memo:** [{slug}](../research/{slug}.md) *(if exists)*
**Classification:** {type}
**Build path:** {ordered skill list}

## GOAL
{locked goal}

## CONSTRAINTS
- {locked constraint 1}
- ...

## FORMAT
- {locked format}

## FAILURE (any of these = not done)
- {locked failure 1}
- ...

## Contract verification
*To be completed during build. Every FAILURE condition must be verified
before delivery.*

- [ ] FAILURE 1: {condition} → *verification method:*
- [ ] FAILURE 2: {condition} → *verification method:*
- [ ] FAILURE 3: {condition} → *verification method:*
- [ ] GOAL metric met → *evidence:*
- [ ] All CONSTRAINTS respected → *confirmation:*
- [ ] FORMAT matches spec → *confirmation:*
```

### 5. Hand off (suggest, then confirm)

Same pattern as `research` — propose the next skill, wait for the user to
confirm. Don't silently invoke.

```
Contract locked at docs/contracts/{slug}.md.

Next step: {first skill in build path}.
{One-sentence description of what that skill does.}

Want me to invoke it now?
```

On confirm, invoke. The receiving skill reads the contract from the filepath.
On "wait" or "let me look at it first" — stop, let the user read, wait for
explicit go.

## Failure templates

When drafting FAILURE conditions, reach for these as starting points. Users
miss them consistently.

**For APIs and services:**
- No input validation — accepts malformed input without 400
- No pagination — returns unbounded result sets
- Silent error swallowing — catches exceptions without logging
- No test for empty input / null input / invalid input
- Rate limiting absent on user-facing endpoints

**For UI components:**
- No empty state
- No loading state
- No error state (user can't tell when something failed)
- Not keyboard-navigable
- Breaks on narrow viewports
- Scroll/interaction lag on realistic data size

**For auth / critical-path:**
- No rate limiting on login/reset endpoints
- User enumeration possible via error messages
- Session fixation or improper session regen
- IDOR in any endpoint that takes a user-owned resource ID
- Secrets logged or sent in error responses

**For content / writing:**
- Buries the main point below the fold
- Assumes knowledge the target audience doesn't have
- No concrete examples
- Closes without a clear call to action (if marketing)

**For data / migrations:**
- No rollback path
- Not idempotent (running twice breaks things)
- No dry-run mode
- No verification step after the migration completes
- Long-running lock on a production table

Don't paste all of these into every contract. Pick the 2-4 most relevant to
the current artifact and ask the user to add the ones you missed.

## When to use

- After `research` produced a memo and you're ready to build.
- Before any infrastructure or security-critical code.
- Before a build that will be expensive to redo (DB schema, API contracts,
  public interfaces).
- When the stakes are "technically works but misses the point" — that's
  exactly the failure mode this prevents.

## When NOT to use

- Trivial changes (typo, config tweak, adding a log line).
- Exploratory prototypes meant to be thrown away.
- When the task is obvious and a contract would be longer than the code.
- Hot-path fixes where you already know the fix.

For these cases, skip straight to coding or to gstack's `/office-hours`.

## Configuration

| Parameter | Default | Description |
|-----------|---------|-------------|
| mode | auto | `convert`, `interactive`, `validate`, or `auto` (detect) |
| strict | true | Block handoff if any section is incomplete |
| auto_handoff | suggest | `suggest`, `false`, or `true` |
| template | standard | `standard`, `minimal` (GOAL + FAILURE only), `detailed` |

Minimal template is useful for quick tasks that still need a failure clause
but don't warrant a full spec. Detailed template adds sections for
dependencies, rollout plan, and observability — worth it for critical builds.

## Edge cases

- **Contract is overkill for the task** — if the user accepts a minimal
  template but the agent thinks even that's too much, push back: "Honestly,
  this is a 10-line change. Want to skip the contract and just fix it?"
- **FAILURE contradicts GOAL** — flag it, ask which takes priority. Sometimes
  the user genuinely wants an impossible spec (it reveals something about
  their actual priorities).
- **User wants to handoff without locking** — refuse. The whole point is that
  the contract is binding once locked. Offer to keep it in draft at
  `active/contracts/{slug}-draft.md` instead.
- **Multiple contracts needed for one project** — fine. Each contract is
  scoped to one build. A project like learnrobotics.ai might have contracts
  for "paper page v0", "search feature", "auth", and "content pipeline" as
  separate artifacts.
- **Contract needs to reference another contract** — link it explicitly in
  the header ("Depends on: docs/contracts/auth.md"). gstack's `/plan-eng-review`
  will read linked contracts for context.

## Output files

| File | Description |
|------|-------------|
| `docs/contracts/{slug}.md` | The locked contract — persistent |
| `active/contracts/{slug}-draft.md` | In-progress contracts, if used |

Contracts persist. They're the record of what was promised at build time, and
they're what `/retro` reads at the end of a sprint to check what was actually
delivered vs what was specified.
