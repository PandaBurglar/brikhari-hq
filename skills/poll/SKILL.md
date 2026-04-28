---
name: poll
description: >
  Stochastic multi-agent consensus. Spawn N agents (default 10) with the same
  prompt and light framing variations to independently analyze a problem, then
  aggregate by consensus. Use for ranking options, scoring trade-offs, or
  filtering single-agent hallucination on well-defined questions. Triggers on
  "poll", "get consensus", "rank these", "score these", "poll N agents",
  "which of these", or /poll. Also triggers on "multi-agent vote", "statistical
  confidence on", or "what do 10 agents think".
allowed-tools: Read, Grep, Glob, Bash, Task, Write, Edit
---

# Poll

Spawn N agents (default 10) with identical context and near-identical prompts.
Each independently analyzes the problem and produces a structured response.
Aggregate by finding consensus (mode), divergences (splits), and outliers
(unique ideas).

**Why this works:** Exploits stochastic variation in LLM outputs. Like polling
10 experts instead of asking one. The mode filters out hallucinations and
individual biases. Divergences reveal genuine judgment calls. Outliers surface
creative ideas a single run would miss.

Distinct from `debate`: `debate` is adversarial (few distinct roles, iterative,
convergence via argument). `poll` is statistical (many independent samples,
light framing variation, aggregate by mode). Use `debate` for "is this
approach right at all"; use `poll` for "which of these options wins."

## Execution

### 1. Parse the request

Extract:
- **Problem/question** to analyze — must be well-defined. If it's genuinely
  two-sided ("should I X or Y"), redirect to `debate`.
- **Agent count N** — default 10. User can override ("5 agents", "20 agents").
- **Output format** — what each agent should produce (ranking, recommendation,
  yes/no, score). Affects aggregation math.
- **Options list** — predefined options to rank/evaluate, or let agents
  generate their own.
- **Source material** — if a research memo exists, pass as shared context.

If the question is vague, sharpen it. N agents on a fuzzy prompt wastes
tokens.

### 2. Design the structured output schema

Before spawning, define what each agent must return. Must be structured enough
to aggregate mechanically.

Common schemas:

- **Ranking** — "Rank these 5 options from best to worst. Output as a numbered
  list 1-5 with one-line rationale each."
- **Open recommendation** — "Propose your top 3 recommendations. For each:
  name, one-sentence rationale, confidence score 1-10."
- **Binary decision** — "Should we do X? Answer YES or NO, then your top 3
  reasons."
- **Scoring** — "Score each option 1-10 on {criteria}. Output as `Option:
  Score // rationale`."

The schema must produce outputs comparable across agents. If you can't imagine
how to aggregate the outputs, the schema is too loose.

### 3. Generate framing variations

Create N slightly different prompts. Core problem and output schema stay
identical — only the framing/priming varies. This produces stochastic
diversity without changing the actual task.

Cycle through these variations:

1. **Neutral baseline** — "Analyze objectively."
2. **Risk-averse** — "You weigh downside risks heavily."
3. **Growth-oriented** — "You optimize for upside potential."
4. **Contrarian** — "Challenge conventional wisdom. What does everyone miss?"
5. **First-principles** — "Reason from first principles. Ignore what's
   popular."
6. **User-empathy** — "Think from the end-user's perspective."
7. **Resource-constrained** — "Assume limited time and budget. Highest-leverage
   move?"
8. **Long-term** — "Optimize for the 5-year outcome, not the 90-day outcome."
9. **Data-driven** — "Focus on what's measurable. Ignore intuition."
10. **Systems thinker** — "Map second and third-order effects. What cascades?"

For N > 10, cycle back through. For N < 10, pick the first N.

For domain-specific polls, substitute domain-appropriate framings. E.g., for a
research paper choice: "ML researcher", "industry practitioner", "theorist",
"empiricist", "contrarian reviewer", etc.

### 4. Spawn agents in parallel

Spawn all N agents simultaneously via the Task tool.

**CMUX integration:** for N ≥ 5, distribute agents across panes for
visibility:
- N = 3: one pane per agent
- N = 5-7: two panes, 2-3 agents each
- N = 10+: three panes, agents distributed evenly
- Name panes `poll-{group}-{slug}`

Config per agent:
- `subagent_type: "general-purpose"`
- `model: "sonnet"` (cost-efficient; each agent does focused analysis)
- `mode: "bypassPermissions"`

Agent prompt template:
```
{framing_variation}

PROBLEM:
{problem}

CONTEXT:
{context — research memo contents if available, constraints, any prior
findings}

{output_schema}

Be specific and concrete. Give real recommendations, not vague advice. If
you're uncertain about something, say so explicitly with a confidence level.

Write your response directly. Do not write to files.
```

Agents return outputs directly — not via files. Keeps aggregation simple.

### 5. Aggregate results

Once all N agents return, perform mechanical aggregation.

#### For ranking tasks

Assign points: 1st place = N points, 2nd = N-1, ... N-th = 1. Sum across all
agents per option. Report final ranking by total points.

Example: 10 agents ranking 5 options. Option A gets five 1st-place votes (5 ×
5 = 25), two 2nd (2 × 4 = 8), three 3rd (3 × 3 = 9). Total: 42. Compute for
all 5, sort descending.

#### For recommendation tasks

Group similar recommendations via fuzzy match on name/concept. Count how many
agents proposed each.

Categorize:
- **Consensus** (7+/N agree) — high-confidence recommendations, safe bets
- **Divergence** (4-6/N) — genuine judgment calls, flag for user decision
- **Outlier** (1-3/N) — high-variance ideas, potentially creative or noise.
  Flag which framing variation produced them — contrarian-framed agents often
  produce the most interesting outliers.

#### For scoring tasks

Calculate mean, median, and standard deviation per option. Flag options with
high variance (std dev > 2) — this is where agents disagree, and the variance
itself is a finding.

#### For binary decisions

Count YES vs NO. Report the split. Summarize the strongest arguments from
each side.

### 6. Write the aggregation report

Write to `active/poll/{slug}.md`:

```markdown
# Poll report: {problem}

**Agents:** {N} | **Date:** {date}
**Source context:** {link to research memo if any}

## Headline

{One-sentence consensus finding. If split, say so. "10 agents polled; 7
picked A, 3 picked B. A is the pick, but the dissent flagged
{specific-concern}."}

## Consensus (agreed by {X}+/{N})

{Items most agents converged on. These are safe to act on.}

## Divergences (split {X}/{Y})

{Items where agents disagreed roughly evenly. Present both sides. These are
genuine judgment calls needing human decision.}

## Outliers (proposed by 1-{Z} agents)

{Unique ideas from individual agents. High variance, potentially high value.
Note which framing produced each — contrarian and first-principles framings
often produce the most interesting outliers.}

## Raw aggregation

{Full ranking/scoring table.}

## Framing notes

{Any patterns in which framings produced which answers. E.g., "risk-averse
and long-term framings picked A; growth-oriented and contrarian picked B."
This reveals the axes of the real trade-off.}

## Individual responses summary

{One-line per agent: framing used + their top pick. For audit.}
```

### 7. Deliver (suggest, then confirm)

Present to the user:

- **One-paragraph summary** of the consensus finding
- **Top 3 consensus items** (what most agreed on)
- **Top divergence** (the most interesting split)
- **Most interesting outlier** (creative idea worth considering)
- **File path** to the full report

Suggest next steps:

- **Consensus is clear** → suggest `contract` if action is indicated, or
  record in `docs/decisions/{slug}.md` as an ADR.
- **Divergence is real and important** → suggest `debate` on the top 2-3
  divergent options to resolve via argument.
- **Outlier is compelling** → suggest `research` on the outlier if it's a
  path not yet explored.

Wait for user pick. Don't silently invoke.

## The poll-then-debate pattern

One of the highest-leverage compositions: poll 10 agents to narrow to top 2
options, then debate the finalists.

- Poll efficiently filters the option space (10 agents × 5 options → ranked
  top 2)
- Debate deeply explores the trade-off between the finalists (3 agents × 3
  rounds on the top 2)
- Total cost ~$0.80-1.20 on sonnet, produces a much better decision than
  either alone

Suggest this pattern when a poll surfaces a close top-2 with meaningful
disagreement.

## When to use

- Multiple enumerated options needing a ranked pick
- Scoring across a list of candidates
- Decisions where you want to filter single-agent hallucination
- Binary decisions where you want statistical confidence, not just one
  agent's opinion
- Surfacing creative outliers from a well-defined problem space

## When NOT to use

- Genuinely two-sided trade-offs — use `debate` instead
- Ambiguous questions that would burn N × tokens on vagueness — sharpen first
- Factual questions with clear answers — just answer
- When the user has already decided and wants validation — be honest about
  this, polling to manufacture justification is worse than useless

## Configuration

| Parameter | Default | Description |
|-----------|---------|-------------|
| N | 10 | Number of agents |
| model | sonnet | `opus` for deep reasoning (expensive) |
| output | auto | ranking, recommendation, score, binary — auto-detect if not
specified |

User overrides: "poll 5 agents," "use 15 opus agents," "binary yes/no with
confidence."

## Cost considerations

- 10 sonnet: ~$0.30-0.50
- 10 opus: ~$3-5 — only use if explicitly requested or problem requires deep
  reasoning
- For binary decisions, 5 agents is usually enough
- For ranking 5+ options, 10 is right — you need the statistical power

Default to sonnet unless told otherwise.

## Edge cases

- **N < 3** — consensus needs at least 3 agents. Warn user; minimum 3.
- **Ambiguous problem** — ask user to sharpen before burning tokens.
- **All agents agree** — great, high confidence. Report unanimous consensus.
  Note it as a cheap, reliable finding.
- **No consensus (even split)** — report the split honestly. This IS the
  finding: no dominant answer exists, and the real work is in the debate
  between the split factions. Consider auto-suggesting `debate` on the split.
- **Agent returns garbage or fails** — exclude from aggregation. Note the
  effective N.
- **Existing report on the topic** — overwrite without asking. Ephemeral.
- **All framings produce the same answer** — either the question is easy (fine)
  or the framings are too similar (reduce N and pick more distinct framings).

## Output files

| File | Description |
|------|-------------|
| `active/poll/{slug}.md` | Full aggregation report |

Overwritten on re-invocation. If a poll's result is important enough to
preserve long-term, write the decision to `docs/decisions/{slug}.md` as an
ADR.
