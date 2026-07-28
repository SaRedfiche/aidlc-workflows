#!/usr/bin/env bash
# try-ai-plc.sh - one-command preview setup for the ai-plc plugin.
#
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/awslabs/aidlc-workflows/spike/ai-plc-combined/scripts/try-ai-plc.sh | bash
#   curl -fsSL ...same URL... | bash -s -- kiro          # Kiro CLI instead of Claude Code
#   ... | bash -s -- claude my-preview-dir               # optional custom target dir
#
# What it does (nothing outside the target dir is touched):
#   1. downloads the spike/ai-plc-combined branch as a tarball (no git needed)
#   2. copies the AIDLC base install for your harness into TARGET_DIR
#   3. runs the plugin's compose hook (the same hook a real plugin install runs)
#   4. drops in a sample PROTOTYPE spec so entry point 3 works immediately
#
# This preview bundles engine changes still in review (PR #664) - do NOT
# compose the plugin into an existing AIDLC project; use the install this
# script creates.
set -euo pipefail

HARNESS="${1:-claude}"
TARGET_DIR="${2:-ai-plc-preview}"
BRANCH="spike/ai-plc-combined"
TARBALL_URL="https://github.com/awslabs/aidlc-workflows/archive/refs/heads/${BRANCH}.tar.gz"

case "$HARNESS" in
  claude|kiro) ;;
  *) echo "error: unknown harness '$HARNESS' (expected: claude or kiro)" >&2; exit 1 ;;
esac

if ! command -v bun >/dev/null 2>&1; then
  echo "error: bun is required (the AIDLC engine runs on it)." >&2
  echo "install it with:  curl -fsSL https://bun.sh/install | bash" >&2
  exit 1
fi

if [ -e "$TARGET_DIR" ]; then
  echo "error: $TARGET_DIR already exists - remove it or pass a different dir" >&2
  exit 1
fi

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

echo "==> downloading $BRANCH ..."
curl -fsSL "$TARBALL_URL" | tar -xz -C "$WORK"
SRC="$(find "$WORK" -maxdepth 1 -type d -name 'aidlc-workflows-*' | head -1)"
[ -n "$SRC" ] || { echo "error: unexpected tarball layout" >&2; exit 1; }

echo "==> creating $TARGET_DIR with the $HARNESS base install ..."
mkdir -p "$TARGET_DIR"
if [ "$HARNESS" = "claude" ]; then
  cp -R "$SRC/dist/claude/.claude" "$TARGET_DIR/.claude"
  HARNESS_LEAF=".claude"
else
  cp -R "$SRC/dist/kiro/.kiro" "$TARGET_DIR/.kiro"
  cp "$SRC/dist/kiro/AGENTS.md" "$TARGET_DIR/AGENTS.md"
  HARNESS_LEAF=".kiro"
fi

echo "==> composing the ai-plc plugin ..."
PLUGIN_ROOT="$SRC/dist/plugins/ai-plc/$HARNESS"
TARGET_ABS="$(cd "$TARGET_DIR" && pwd)"
AIDLC_PLUGIN_ROOT="$PLUGIN_ROOT" \
CLAUDE_PLUGIN_ROOT="$PLUGIN_ROOT" \
AIDLC_PROJECT_DIR="$TARGET_ABS" \
CLAUDE_PROJECT_DIR="$TARGET_ABS" \
AIDLC_HARNESS_DIR="$HARNESS_LEAF" \
  bun "$PLUGIN_ROOT/hooks/compose.ts"

echo "==> adding the sample prototype spec (entry point 3) ..."
mkdir -p "$TARGET_ABS/aiplc-docs/discovery/prototypes/team-lunch-picker"
cp "$SRC/plugins/ai-plc/examples/PROTOTYPE-team-lunch-picker.md" \
  "$TARGET_ABS/aiplc-docs/discovery/prototypes/team-lunch-picker/"

# The compose hook verifies its own work (drops file on any problem), but
# fail loud here too so a tester never starts from a half-built preview.
GRAPH="$TARGET_ABS/$HARNESS_LEAF/tools/data/stage-graph.json"
if ! grep -q '"ai-plc-envision"' "$GRAPH"; then
  echo "error: compose did not land the plugin stages - see the drops file under $TARGET_DIR/aidlc/" >&2
  exit 1
fi

LAUNCH="claude"
[ "$HARNESS" = "kiro" ] && LAUNCH="kiro-cli chat"
cat <<DONE

Ready. Next:

  cd $TARGET_DIR && $LAUNCH

Then try one of:
  /ai-plc I want to start discovery from customer pain points for YOUR-IDEA
  /ai-plc I have 5 use cases to prioritize
  /ai-plc build my prototypes        (a sample spec is already in place)

Sanity check inside the session: /aidlc --doctor
Full guide: plugins/ai-plc/TRYING.md on the $BRANCH branch.
DONE
