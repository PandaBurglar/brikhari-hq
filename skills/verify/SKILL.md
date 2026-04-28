---
name: verify
description: >
  Reviewer + resolver loop for critical-path code. Spawns a fresh-context
  reviewer agent after implementation, then a resolver agent to fix any
  issues found. Use for auth, payments, migrations, crypto, access control,
  and anything the contract flagged as critical-path. For normal code,
  gstack's /review is the right tool. Triggers on "verify", "review loop",
  "critical-path review", "security review", "double-check this", or /verify.
  Also triggers automatically when a contract's classification is
  "critical-path".
allowed-tools: Read, Grep, Glob, Bash, Task, Write, Edit
---

# Verify

Reviewer + resolver loop for critical-path code. After an implementation, spawn
a reviewer agent with fresh context to audit it. If issues are found, spawn a
resolver agent to produce a corrected version. Optionally loop for a second
pass on the resolver's output. **Implement → Review → Resolve**, repeat until
clean or max iterations reached.

**Why this works:** gstack's `/review` is a single-pass "paranoid staff
engineer" prompt. That's enough for most code. It's not enough for auth,
payments, migrations, or anything where a bug means real harm. Critical-path
code needs (a) fresh eyes with no sunk-cost bias toward the implementation and
(b) a second pass to catch issues introduced by the fix itself. This skill is
the upgrade path for those cases.

gstack's `/review` handles the 90% case fast. `verify` handles the 10% case
thoroughly. The contract classification step determines which runs.

## Execution

### 1. Identify what to verify

Determine the artifact and gather context:

- **Most common case** — the agent just finished implementing against a
  contract, and the contract is classified critical-path. Auto-invoke.
- **User-triggered** — user says "verify this" or "double-check the auth code."
  Read the target file or code block.
- **Plan verification** — user wants architecture reviewed before
  implementation. Less common but valid — review the plan artifact as the
  "output."

Gather:
- The artifact itself (file contents, code block, or plan doc)
- The contract it was built against, if one exists (`docs/contracts/{slug}.md`)
- Surrounding files the reviewer needs for context — types, adjacent code,
  existing patterns in the codebase

If no contract exists and no clear specification is available, pause and ask
what the code was supposed to do. A reviewer with no spec produces noise.

### 2. Spawn the Reviewer

Single reviewer agent, fresh context, no access to the implementation
reasoning. Just the artifact and the requirements.

Config:
- `subagent_type: "general-purpose"`
- `model: "sonnet"` default — `opus` for crypto or especially high-stakes code
- `mode: "bypassPermissions"`

When in CMUX, spawn the reviewer in a visible pane via `cmux split` so the
user can watch the audit happen in real time. Name the pane
`verify-reviewer-{slug}`.

#### Reviewer prompt:

```
You are a senior code reviewer with fresh eyes. You did NOT write this code.
Your job is to find problems.

CONTRACT (if exists):
{contents of docs/contracts/{slug}.md, especially GOAL, CONSTRAINTS, and
FAILURE sections}

ARTIFACT TO REVIEW:
{full code or doc}

SURROUNDING CONTEXT:
{relevant types, adjacent files, patterns in the codebase}

CLASSIFICATION: critical-path

Review for:

1. Correctness — does it do what the contract's GOAL says? Are there logic
   errors? Does it satisfy every FAILURE condition the contract specified?

2. Security — for auth/crypto/access: authn vs authz confusion, IDOR, session
   fixation, user enumeration, rate-limiting gaps, secrets in logs or errors,
   TOCTOU, insufficient entropy, algorithm downgrades. For payments: idempotency
   on money-moving operations, race conditions in balance updates, webhook
   verification. For migrations: rollback path, idempotency, production lock
   duration, data loss risks.

3. Edge cases — empty input, null, concurrent access, partial failure, network
   timeout, invalid state, expired tokens, replay, duplicate requests.

4. Observability — can a human diagnose this in production? Is failure
   logged? Can the operator tell what happened?

5. Contract fidelity — go through every FAILURE condition and verify it's
   addressed. Missing a FAILURE condition is itself a critical issue.

Respond in this exact format:

VERDICT: PASS | ISSUES_FOUND | CRITICAL

ISSUES (if any):
For each:
  SEVERITY: critical | major | minor | nit
  LOCATION: {file:line or section}
  PROBLEM: {what's wrong, concretely}
  FIX: {show the corrected code — not "fix this", actual code}

SIMPLIFICATIONS (if any):
  Only flag if the simpler version is strictly safer or clearer. Critical-path
  code isn't where we optimize for brevity.

CONTRACT FIDELITY:
  For each FAILURE condition in the contract:
  - CONDITION: {text}
  - STATUS: addressed | missing | unverifiable
  - EVIDENCE: {where in the code, or why unverifiable}

SUMMARY: one paragraph, overall assessment.

Be ruthless. Better to flag a false positive than miss a real bug. Don't
invent problems, but don't give benefit of the doubt on critical-path code —
if it could be wrong, say so.

Write your response directly. Do not write to files.
```

### 3. Evaluate the review

Read the reviewer's output. Four paths:

**Path A — PASS.** Reviewer found nothing. Mark the contract's verification
checkboxes complete with the reviewer's evidence. Done. Report to user:
> "Verified by independent reviewer. All FAILURE conditions addressed.
> Summary: {reviewer's summary}."

**Path B — ISSUES_FOUND, non-critical.** Real issues but nothing catastrophic.
Proceed to step 4 (resolver).

**Path C — CRITICAL.** Reviewer found a critical bug. **Stop and flag the
user before resolving.** A critical finding often means the approach itself is
wrong, not just the implementation:
> "Reviewer found a critical issue. Before I spawn a resolver, read this:
> {critical issue description}.
>
> Options:
> 1. Spawn resolver to fix it (risk: the fix might paper over a deeper issue)
> 2. Reopen `/plan-eng-review` (reconsider the approach)
> 3. Discuss the finding first
>
> What do you want to do?"

**Path D — Contract fidelity failures.** If the reviewer flagged missing
FAILURE conditions, treat this as at least major severity. These are
violations of what was promised at contract time, not just implementation
bugs.

### 4. Spawn the Resolver

Resolver sees the original implementation AND the review. Produces a corrected
version that addresses the feedback while preserving original intent.

Config: same model as reviewer.
CMUX pane: `verify-resolver-{slug}`.

#### Resolver prompt:

```
You are a senior engineer resolving review feedback on critical-path code.

ORIGINAL CODE:
{original implementation}

REVIEW:
{full reviewer output}

CONTRACT:
{contract contents, focus on FAILURE}

Your job:
- Fix every critical and major issue
- Fix minor issues unless the fix adds disproportionate complexity
- Address every missing FAILURE condition the reviewer flagged — these are
  non-negotiable on critical-path code
- Ignore nit-level feedback unless trivial
- Do NOT introduce new features or refactor beyond what the review requested

For each issue, respond with one of:
  FIXED: {show the fix}
  DECLINED: {why the reviewer's suggestion doesn't apply or would make things
  worse — but for critical-path code, the bar for declining is high. Explain
  thoroughly.}

Then output the COMPLETE corrected code. Not a diff — the full file(s). The
orchestrator uses this to replace the original.

Write your response directly. Do not write to files.
```

### 5. Apply the resolution

Read the resolver's output. Sanity-check before applying:

- Did it address every critical and major issue?
- Are any DECLINED decisions well-reasoned?
- Did it introduce anything the original got right?
- Is the code still coherent (not Frankenstein'd from fix patches)?

If the sanity-check passes, apply the corrected code to disk. Use `str_replace`
or file rewrite as appropriate.

If the sanity-check fails — resolver skipped a critical issue, or its code is
worse than the original — flag to the user and offer:
1. Re-spawn resolver with stronger instructions
2. Apply the original review manually
3. Escalate to opus for the resolver

### 6. Second pass (critical code, mandatory)

For critical-path code, **always** run a second verification on the resolver's
output. The resolver can introduce new bugs while fixing old ones — the second
pass catches this.

Spawn a fresh reviewer (not the same agent) with:
- The resolver's output as the artifact
- The original contract
- A note: "This code was just revised based on review feedback. Verify that
  the revisions didn't introduce new issues and that all original issues are
  resolved."

If round 2 is clean, done. If round 2 finds new issues, spawn another resolver.

**Max 2 rounds.** If the code isn't clean after 2 rounds, stop. The problem is
likely deeper than review can fix — reconsider the approach via
`/plan-eng-review` or reopen the contract.

### 7. Update contract verification

Once verified, fill in the contract's verification section:

```markdown
## Contract verification

- [x] FAILURE 1: {condition} — verified: reviewer confirmed, round 2 clean
- [x] FAILURE 2: {condition} — verified: {method}
- [x] GOAL metric met — evidence: {what/where}
- [x] All CONSTRAINTS respected — confirmed
- [x] FORMAT matches spec — confirmed

**Rounds:** 2
**Reviewer model:** sonnet
**Critical issues caught:** {count, summary}
**Final verdict:** PASS
```

This turns the contract from a promise into a receipt. `/retro` reads these at
sprint end to know what was actually delivered.

### 8. Write the verification report

Write to `active/verify/{slug}.md` a compact record:

```markdown
# Verification: {slug}

**Contract:** docs/contracts/{slug}.md
**Rounds:** {N}
**Date:** {date}

## Issues found and resolved

| # | Severity | Location | Problem | Resolution |
|---|----------|----------|---------|------------|
| 1 | critical | auth.ts:42 | IDOR on saved-list endpoint | Fixed |
| 2 | major | auth.ts:89 | Rate limit missing | Fixed |
| 3 | minor | auth.ts:115 | Log leaks email | Fixed |

## Declined suggestions
{Any DECLINED decisions with reasoning}

## Changes from original
{Summary of what moved between original and final}
```

Unlike the contract, the verification report is ephemeral. It's kept in
`active/verify/` for the current session and overwritten on re-verification.
The permanent record lives in the contract's verification checkboxes.

### 9. Deliver

Report to the user:

```
Verified: {PASS after N rounds | ESCALATED}

Issues caught: {count}
Most important fix: {one-line summary of the highest-severity catch}
Contract verification: {X}/{Y} conditions verified

Report: active/verify/{slug}.md
Contract: docs/contracts/{slug}.md (verification section updated)
```

If escalated (hit max rounds without convergence), include a recommendation:
reopen the contract, switch to opus for another round, or bring in a human
reviewer.

## When to auto-invoke

The skill runs without the user explicitly asking when:

- The contract classification is "critical-path"
- The file touched matches a critical-path pattern (auth/, middleware/auth,
  crypto, migrations/, payments/, billing/)
- The user has configured `verify.auto_trigger = true` for this repo

In all other cases, require explicit invocation. Don't turn every review into
a two-pass loop — gstack's `/review` is the default for good reason.

## When NOT to use

- Trivial changes (config, logging, typo fixes)
- Read-only operations
- Prototypes that will be thrown away
- Code the user explicitly said "just do it quick"
- Documentation and marketing content — use gstack's `/review` instead

## Configuration

| Parameter | Default | Description |
|-----------|---------|-------------|
| model | sonnet | Model for reviewer and resolver |
| max_rounds | 2 | Review cycles before escalation |
| auto_trigger | true for critical-path | Trigger without user ask |
| severity_threshold | minor | Lowest severity that triggers a resolve |

User overrides: "verify this with opus" or "one round only, I trust the
resolver."

## Cost considerations

- 1 round sonnet: ~$0.10-0.20
- 1 round opus: ~$0.50-1.00
- 2 rounds doubles cost

On critical-path code, 2 rounds is non-negotiable. The cost of missing a
security bug dwarfs the cost of an extra review pass. Don't optimize the
skill's cost below safety.

For truly high-stakes code (money-movement, production migrations, auth
infrastructure), use opus for both reviewer and resolver. The ~$1 cost is
rounding error against the blast radius.

## Edge cases

- **Reviewer hallucinates issues** — the resolver catches it via DECLINED.
  If both agents agree on a non-issue, catch it in the sanity-check. If
  something still slips through and applies a wrong fix, round 2 flags it.
- **Resolver introduces new bugs** — exactly why round 2 exists.
- **Reviewer and resolver disagree** — orchestrator (this skill) breaks the
  tie. Read both arguments, pick the better one. If genuinely uncertain, ask
  the user.
- **Code too large for one prompt** — split by logical boundary (per-file,
  per-function cluster) and verify each chunk. Don't try to cram 2000 lines
  into one review.
- **Verification keeps failing** — after max rounds with no convergence, the
  issue is architectural. Escalate: reopen the contract, call
  `/plan-eng-review`, or bring in human review. Don't loop indefinitely.
- **Contract doesn't exist** — ask the user for the spec before running.
  Reviewing without knowing what was supposed to happen produces noise.

## Output files

| File | Description |
|------|-------------|
| `active/verify/{slug}.md` | Verification report — ephemeral |
| `docs/contracts/{slug}.md` | Updated verification section — persistent |

The contract is the durable record. The active report is just the working
trace of this verification cycle.
