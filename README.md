# Brikhari-HQ

My personal agent setup for general-purpose power-coding. Built on top of
[gstack](https://github.com/garrytan/gstack) by Garry Tan.

gstack owns the build lifecycle. Brikhari-HQ adds the layer before that —
research, decision-making, and the bridge from fuzzy understanding to
concrete build specs — plus one skill that hardens gstack's review pass for
critical-path code.

## What's added on top of gstack

Five skills:

| Skill | Purpose |
|-------|---------|
| `research` | Pre-product research from fuzzy questions to sharp memos |
| `debate` | Adversarial multi-agent reasoning for genuine trade-offs |
| `poll` | Stochastic multi-agent consensus for ranked picks |
| `contract` | 4-part spec bridging research into build |
| `verify` | Reviewer + resolver loop for critical-path code |

gstack's own skills (`/office-hours`, `/plan-ceo-review`, `/plan-eng-review`,
`/review`, `/browse`, `/qa`, `/ship`, `/learn`, `/retro`) remain available
unchanged.

## Typical workflow

```
Fuzzy question
    ↓  research
Memo at docs/research/{slug}.md
    ↓  (suggest: contract / debate / poll)
    ↓
Locked contract at docs/contracts/{slug}.md
    ↓  (classification: standard | critical-path | content)
    ↓
gstack build chain
    ↓  (for critical-path code: verify replaces /review)
    ↓
Shipped PR
```

Full routing logic in [CLAUDE.md](./CLAUDE.md).

## Installation

```bash
# Fork this repo on GitHub first, then:
git clone https://github.com/<you>/brikhari-hq.git
cd brikhari-hq

# Install gstack skills (follow gstack's instructions)
./install.sh

# Install Brikhari skills alongside
./install-brikhari.sh
```

Both install scripts drop skill files into Claude Code's skills directory
(usually `~/.claude/skills/`). Brikhari skills live in the same directory as
gstack's — they don't conflict because they have distinct names.

## CMUX conventions

This HQ is designed to work well with [CMUX](https://cmux.com) for visibility
into multi-agent workflows. When running inside CMUX:

- `debate` spawns one pane per agent so you can watch the debate unfold
- `poll` distributes agents across 2-3 panes for readability
- `verify` keeps a test-watch pane running during the review loop
- `research` can spawn a browser pane for live paper/site reading

See [docs/cmux-setup.md](./docs/cmux-setup.md) for details.

## Staying current with gstack

```bash
git remote add upstream https://github.com/garrytan/gstack.git
git fetch upstream
git merge upstream/main
git push origin main
```

Brikhari skills don't conflict with gstack skills on merge because the
filenames are distinct. If a gstack skill updates in a way that overlaps with
a Brikhari skill, resolve manually — usually by updating the Brikhari skill's
"When NOT to use" section.

## Attribution

Based on [gstack](https://github.com/garrytan/gstack) by Garry Tan. gstack's
build-lifecycle skills do the heavy lifting here. Brikhari-HQ is the thin
layer on top that matches how I actually work — research first, build second,
verify critical-path.

## License

Inherits gstack's license. Additions in `skills/` (research, debate, poll,
contract, verify) and `CLAUDE.md` are released under the same terms.
