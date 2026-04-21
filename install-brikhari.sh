#!/usr/bin/env bash
# install-brikhari.sh
# Install Brikhari-HQ skills into Claude Code's skills directory.
# Run this after gstack's own install.sh (or standalone if you don't want gstack).

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CLAUDE_SKILLS_DIR="${CLAUDE_SKILLS_DIR:-$HOME/.claude/skills}"

INSTALL_GLOBAL_MD=0
for arg in "$@"; do
  case "$arg" in
    --global-claude-md) INSTALL_GLOBAL_MD=1 ;;
    -h|--help)
      cat <<EOF
Usage: install-brikhari.sh [--global-claude-md]

Symlinks the 5 Brikhari-HQ skills into \$CLAUDE_SKILLS_DIR
(default: ~/.claude/skills) and creates artifact directories in the
current working directory.

Options:
  --global-claude-md   Also install CLAUDE.md to ~/.claude/CLAUDE.md.
                       Applies Brikhari routing to ALL Claude Code
                       sessions on this machine. Off by default.
EOF
      exit 0
      ;;
    *) echo "Unknown argument: $arg" >&2; exit 2 ;;
  esac
done

BRIKHARI_SKILLS=(
  "research.md"
  "debate.md"
  "poll.md"
  "contract.md"
  "verify.md"
)

echo "Installing Brikhari-HQ skills to $CLAUDE_SKILLS_DIR..."
mkdir -p "$CLAUDE_SKILLS_DIR"

for skill in "${BRIKHARI_SKILLS[@]}"; do
  src="$SCRIPT_DIR/skills/$skill"
  dst="$CLAUDE_SKILLS_DIR/$skill"

  if [[ ! -f "$src" ]]; then
    echo "  skip: $skill (not found at $src)"
    continue
  fi

  # Symlink so edits to the repo propagate without reinstalling
  ln -sf "$src" "$dst"
  echo "  installed: $skill"
done

# Global CLAUDE.md install is opt-in. Without the flag, Brikhari routing
# applies only in projects that copy/symlink brikhari-hq's CLAUDE.md into
# their own repo. With --global-claude-md, it applies to every Claude Code
# session on this machine.
GLOBAL_CLAUDE_MD="$HOME/.claude/CLAUDE.md"
if [[ "$INSTALL_GLOBAL_MD" -eq 1 ]]; then
  if [[ ! -f "$GLOBAL_CLAUDE_MD" ]]; then
    echo "Installing CLAUDE.md to $GLOBAL_CLAUDE_MD..."
    cp "$SCRIPT_DIR/CLAUDE.md" "$GLOBAL_CLAUDE_MD"
  else
    echo ""
    echo "NOTE: $GLOBAL_CLAUDE_MD already exists. Not overwriting."
    echo "Merge in the routing section from $SCRIPT_DIR/CLAUDE.md manually."
  fi
else
  echo ""
  echo "NOTE: Global CLAUDE.md not installed. To install it (applies Brikhari"
  echo "routing to ALL Claude Code sessions on this machine, not just"
  echo "brikhari-hq projects), re-run with --global-claude-md."
fi

echo ""
echo "Done. Brikhari-HQ skills installed."
echo ""
echo "Next steps:"
echo "  1. Install CMUX if you haven't: brew tap manaflow-ai/cmux && brew install --cask cmux"
echo "  2. Open Claude Code in a project and try: 'help me understand X before I build'"
echo "  3. Read CLAUDE.md for the full routing logic"
