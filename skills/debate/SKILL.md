---
name: debate
description: >
  Adversarial multi-agent debate on genuine trade-offs. Spawn N agents
  (default 3) with distinct roles into a shared conversation where they debate,
  disagree, and converge via a shared transcript. Use when there's a real
  trade-off to explore — not when options can be ranked (use `poll` for that).
  Triggers on "debate", "argue this", "steelman", "have agents debate", or
  /debate. Also triggers on "let them fight it out", "adversarial review",
  "show me the trade-off", or when a research memo surfaces a genuine
  two-sided tension.
allowed-tools: Read, Grep, Glob, Bash, Task, Write, Edit
---

# Debate

Spawn N agents (default 3) into a simulated shared conversation where each
reads the full chat history before responding, building on, challenging, or
refining previous contributions. You (the orchestrator) are the PM — moderating
rounds, reading the debate, extracting the synthesis.

**Why this works:** Sequential handoffs lose context — the second model
doesn't know *why* the first made its decisions. A shared transcript preserves
reasoning chains and enables genuine debate. When the Architect says "this
needs a queue" and the Pragmatist says "a simple loop is fine," the
disagreement is more valuable than either agent's solo answer. Agents
challenge assumptions, catch errors, and surface reasoning paths a single
agent would miss.

Distinct from `poll`: `poll` is statistical (many identical samples, aggregate
by mode). `debate` is adversarial (few distinct roles, iterate, converge or
deadlock). Use `poll` for "which of these options"; use `debate` for "is this
approach right at all."

## Execution

### 1. Parse the request

Extract:
- **Problem/question** to debate — must be genuinely two-sided. If it's just
  "rank these options," redirect to `poll`.
- **Agent count N** — default 3. User can override ("5 agents", "just 2").
- **Round count R** — default 3. User can override.
- **Agent roles** (optional) — user may specify ("architect, security
  engineer, frontend dev"). If not specified, auto-assign based on domain.
- **Source material** — if a research memo exists on the topic, pass it as
  shared context to all agents. Link via filepath.

If the problem is vague, sharpen it before spawning. N agents on a fuzzy
question burns tokens for noise.

### 2. Assign agent roles

Each agent gets a distinct perspective that creates productive disagreement.
If the user didn't specify roles, choose from these defaults based on domain:

**Software engineering (default):**
1. **Architect** — thinks in systems, interfaces, scalability, long-term
   maintainability
2. **Pragmatist** — optimizes for shipping fast, minimal complexity, "good
   enough"
3. **Critic** — finds edge cases, failure modes, security holes, unstated
   assumptions

**Product / UX:**
1. **User advocate** — optimizes for UX simplicity and user delight
2. **Business strategist** — optimizes for revenue, growth, competitive
   advantage
3. **Engineer** — grounds discussion in technical feasibility and cost

**Strategy / decision:**
1. **Optimist** — sees upside, opportunity, reasons to act
2. **Skeptic** — sees risk, downside, reasons to wait
3. **Synthesizer** — finds the middle path, integrates both perspectives

**Research / technical:**
1. **Proponent** — steelmans the approach the user is considering
2. **Skeptic** — steelmans the opposing approach
3. **Field expert** — grounds both sides in what the research literature
   actually says

For N > 3, add more roles that create new tension, don't just duplicate
existing ones.

### 3. Initialize the transcript

Create `active/debate/{slug}.json`:

```json
{
  "problem": "{problem statement}",
  "context": "{research memo contents if available, plus any constraints or
  background the user provided}",
  "agents": [
    {"name": "Agent A", "role": "{role}", "framing": "{role description}"},
    {"name": "Agent B", "role": "{role}", "framing": "{role description}"},
    {"name": "Agent C", "role": "{role}", "framing": "{role description}"}
  ],
  "rounds": [],
  "synthesis": null
}
```

### 4. Run debate rounds

For each round (1 through R), spawn all N agents in parallel. Each reads the
full chat history and contributes.

**CMUX integration:** when available, spawn each agent in a visible pane:
- `cmux split` to create N panes
- Name them `debate-{agent-letter}-{slug}` so the user can track them in the
  sidebar
- The user can watch the debate unfold live and interrupt if an agent goes
  off the rails

**Spawn config per agent:**
- `subagent_type: "general-purpose"`
- `model: "sonnet"` (default — `opus` for high-stakes technical debates)
- `mode: "bypassPermissions"`

#### Round 1 — Opening positions

Each agent states their initial stance. No prior discussion to read yet.

Agent prompt:
```
You are {role}: {role description}.

PROBLEM:
{problem}

CONTEXT:
{context, including any research memo contents}

This is Round 1 of a multi-agent debate. State your initial position. Be
concrete — propose actual solutions, not vague principles. Take a clear
stance.

Other agents will challenge your position in later rounds, so make your
reasoning explicit.

Respond in this format:
POSITION: [Your one-sentence stance]
REASONING: [3-5 key points that support your stance]
PROPOSAL: [Your concrete recommendation]
CONCERNS: [What could go wrong with your own approach — be honest]

Write your response directly. Do not write to files.
```

#### Rounds 2+ — Debate

Each agent reads all prior responses and engages.

Agent prompt:
```
You are {role}: {role description}.

PROBLEM:
{problem}

PREVIOUS DISCUSSION:
{all prior round entries, formatted as "Agent X ({role}): {response}"}

This is Round {N} of {R}. Read the prior discussion carefully.

Your job:
1. Respond to the strongest counterargument against your position
2. Identify where you AGREE with other agents (concede real points)
3. Identify where you still DISAGREE and why
4. Refine your proposal based on what's been said

Do NOT just repeat your previous position. Engage with what others said.
Change your mind if they made a better argument — that's a sign the debate is
working, not a sign of weakness.

Respond in this format:
AGREEMENTS: [What other agents got right — be specific about whose argument]
DISAGREEMENTS: [Where you still differ and why, addressing their reasoning]
REFINED PROPOSAL: [Your updated recommendation]
CONFIDENCE: [1-10, how confident you are in your refined position]

Write your response directly. Do not write to files.
```

#### After each round

1. Collect all agent responses.
2. Append to the `rounds` array in the transcript:
   ```json
   {
     "round": 2,
     "entries": [
       {"agent": "Agent A", "role": "Architect", "response": "..."},
       {"agent": "Agent B", "role": "Pragmatist", "response": "..."},
       {"agent": "Agent C", "role": "Critic", "response": "..."}
     ]
   }
   ```
3. **Check for convergence** — if all agents report confidence 8+ and their
   proposals align, stop early. More rounds won't produce new information.
4. **Check for deadlock** — if positions haven't moved in two consecutive
   rounds, stop. More rounds won't resolve it; deadlock IS the finding.

### 5. Synthesize

After the last round, **you (the orchestrator) produce the synthesis**
directly. Don't spawn another agent for this — the synthesis is your judgment
call as the PM.

Analyze:
- **Where did agents converge?** High-confidence conclusions the user can
  act on.
- **Where did they remain split?** Genuine trade-offs the user must decide.
- **What concerns were raised but unresolved?** Risks to monitor even after
  a decision is made.
- **Did any agent change their mind?** Mind-changes are strong signals — the
  original position was weaker than it seemed.

### 6. Write the report

Update `active/debate/{slug}.json` with the synthesis. Also write a
human-readable report at `active/debate/{slug}.md`:

```markdown
# Debate report: {problem}

**Agents:** {N} | **Rounds:** {R} | **Date:** {date}
**Source context:** {link to research memo if any}

## Participants

| Agent | Role | Final confidence | Changed mind? |
|-------|------|------------------|---------------|
| Agent A | {role} | {n}/10 | {yes/no, on what} |
| Agent B | {role} | {n}/10 | {yes/no, on what} |
| Agent C | {role} | {n}/10 | {yes/no, on what} |

## Consensus

{What agents agreed on by the final round. Order by confidence. These are
safe to act on.}

## Key disagreements

{Where agents remained split. Present both sides fairly. These are genuine
trade-offs requiring human judgment.}

## Recommended action

{Your synthesis as orchestrator. Not a vote count — your best read considering
all perspectives. Be willing to pick a side. "It depends" is a failure mode.}

## Unresolved risks

{Concerns raised during the debate that weren't fully addressed. Flag for
ongoing monitoring.}

## Debate highlights

{The 2-3 most interesting exchanges. Where minds changed, where a strong
counterargument landed. These are the parts worth re-reading.}

## Full transcript

Available at `active/debate/{slug}.json`. Key exchanges inline below for
reference:

{Quote 2-3 of the sharpest exchanges with agent attribution.}
```

### 7. Deliver (suggest, then confirm)

Present to the user:

- **One-paragraph synthesis** of the debate outcome
- **The recommended action** (your call, informed by the debate)
- **The sharpest disagreement** (where the user's judgment is still needed)
- **File paths** to the report and transcript

Then suggest next steps based on the debate outcome:

- **Debate converged, user has a decision** → suggest `contract` to turn the
  decision into a build spec, or `docs/decisions/{slug}.md` to record it as
  an ADR if no build follows.
- **Debate deadlocked** → suggest reopening the question with more context,
  or running `poll` if the disagreement is actually about enumerated options
  in disguise.
- **Debate surfaced new unknowns** → suggest `research` on the narrower
  question.

Wait for the user's pick. Don't silently invoke.

## When to use

- Research memo surfaced a genuine two-sided trade-off
- User explicitly wants to see a position challenged ("steelman the opposing
  view", "argue the case against")
- Architectural decisions where both options are legitimate
- Strategic choices where the axes of the trade-off matter more than the
  specific options
- Anything where you want to surface reasoning chains, not just a conclusion

## When NOT to use

- User has enumerated options and wants a ranked pick — use `poll` instead
- Trivial decisions where one option is obviously right
- Urgent calls where speed matters more than depth
- Questions with a clear factual answer
- Situations where the user has already decided and is looking for
  validation — be honest about this, don't run a theatrical debate

## Configuration

| Parameter | Default | Description |
|-----------|---------|-------------|
| N | 3 | Number of agents |
| R | 3 | Number of rounds |
| model | sonnet | `opus` for high-stakes technical debates |
| roles | auto | Auto-assign based on domain, or user-specified |
| early_stop | true | Stop early on convergence or deadlock |

User overrides: "5 opus agents for 4 rounds," "debate with an architect vs a
junior dev," "just 2 agents, 2 rounds."

## Cost considerations

- 3 sonnet × 3 rounds = 9 calls, ~$0.30-0.50
- 3 opus × 3 rounds = 9 calls, ~$3-5
- 5 × 5 = 25 calls — gets expensive on opus
- Default to sonnet. Use opus only when the user explicitly asks or the
  problem genuinely requires deep technical reasoning (e.g., crypto protocol
  design, distributed systems invariants).
- Early convergence saves real money — respect the early-stop check.

## Edge cases

- **N < 2** — a debate needs at least 2 agents. Warn user; minimum 2.
- **All agents agree immediately (round 1)** — stop after round 1. Report
  unanimous consensus. This is a valid and cheap outcome.
- **Agents deadlock for R rounds** — report the deadlock honestly. Deadlock
  IS the finding: this is a genuine judgment call with no dominant answer,
  and the user must decide.
- **Agent goes off-topic** — exclude that response from synthesis. Note the
  effective agent count was reduced.
- **User specifies custom roles** — use exactly what they specify. Don't add
  extra roles unless asked.
- **Agents all pick the same side user already favored** — be suspicious.
  The framing might have biased them. Consider rerunning with a specifically
  contrarian agent added.
- **Existing debate report on this topic** — overwrite without asking.
  These are ephemeral.

## Output files

| File | Description |
|------|-------------|
| `active/debate/{slug}.json` | Full structured transcript |
| `active/debate/{slug}.md` | Human-readable synthesis report |

Overwritten on re-invocation. Debates are ephemeral analysis artifacts; if a
debate's conclusion is important enough to preserve, write it to
`docs/decisions/{slug}.md` as a durable ADR.
