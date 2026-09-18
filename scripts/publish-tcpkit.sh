#!/usr/bin/env bash
set -euo pipefail

# Simple single-package publish — only apps/cli (tcpkit)
# Use this if you want to publish JUST the CLI without nx release versioning.
# Recommended: use ./scripts/publish.sh (nx release) to publish all @tcpkit/* + tcpkit in order.
#
# Usage:
#   ./scripts/publish-tcpkit.sh              # build + npm publish
#   ./scripts/publish-tcpkit.sh --dry-run    # preview tarball, no publish
#   ./scripts/publish-tcpkit.sh --tag next   # publish with dist-tag
#   npm run publish:tcpkit

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

DRY_RUN=""
TAG="latest"

for arg in "$@"; do
  case "$arg" in
    --dry-run|--dry) DRY_RUN="1" ;;
    --tag=*) TAG="${arg#--tag=}" ;;
    --tag) shift_arg_found=""; for i in "$@"; do :; done ;; # placeholder
    -h|--help) echo "Usage: $0 [--dry-run] [--tag <tag>]"; exit 0 ;;
  esac
done

# parse --tag <value>
ARGS=("$@")
for i in "${!ARGS[@]}"; do
  if [[ "${ARGS[$i]}" == "--tag" && $((i+1)) -lt ${#ARGS[@]} ]]; then
    TAG="${ARGS[$((i+1))]}"
  fi
done

echo "› tcpkit single-package publish (apps/cli only)"
echo "  tag=$TAG dry_run=${DRY_RUN:-no}"

if [[ -z "$DRY_RUN" ]] && ! npm whoami >/dev/null 2>&1; then
  echo "✖ Not logged in. Run: npm login"
  exit 1
fi

echo "› Building..."
npx nx build tcpkit
chmod +x apps/cli/dist/main.js 2>/dev/null || true

echo "› Pack preview:"
(cd apps/cli && npm pack --dry-run 2>&1 | tail -n 40)

if [[ -n "$DRY_RUN" ]]; then
  echo "✓ Dry-run done. No publish."
  exit 0
fi

echo "› Publishing tcpkit@$TAG ..."
if [[ "$TAG" == "latest" ]]; then
  (cd apps/cli && npm publish --access public --provenance)
else
  (cd apps/cli && npm publish --access public --provenance --tag "$TAG")
fi

echo "✓ Published tcpkit"
echo "  npm view tcpkit version"
echo "  npx tcpkit --help"
