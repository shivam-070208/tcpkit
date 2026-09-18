#!/usr/bin/env bash
set -euo pipefail

# tcpkit Publish Script — Local publish to npm
# Repo: https://github.com/shivam-070208/tcpkit
# Usage:
#   npm run publish              # interactive: build + version + publish (nx release)
#   npm run publish -- patch     # bump patch (0.0.1 -> 0.0.2) + publish
#   npm run publish -- minor     # bump minor
#   npm run publish -- major     # bump major
#   npm run publish -- 0.1.0     # exact version
#   npm run publish:dry          # dry-run (no git push, no npm publish)
#   ./scripts/publish.sh --dry-run
#   ./scripts/publish.sh --first-release   # first ever publish (skip exists check)
#   ./scripts/publish.sh --tag next        # publish with dist-tag

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

DRY_RUN=""
TAG="latest"
FIRST_RELEASE=""
SPECIFIER=""
SKIP_PUBLISH=""
OTP=""

for arg in "$@"; do
  case "$arg" in
    --dry-run|--dry) DRY_RUN="--dry-run" ;;
    --first-release) FIRST_RELEASE="--first-release" ;;
    --tag) echo "Usage: --tag <tag>"; exit 1 ;;
    --tag=*) TAG="${arg#--tag=}" ;;
    --tag-next) TAG="next" ;;
    --otp=*) OTP="${arg#--otp=}" ;;
    next|latest|beta|alpha|canary) TAG="$arg" ;;
    patch|minor|major|premajor|preminor|prepatch|prerelease|0.*|[0-9]*.[0-9]*.[0-9]*) SPECIFIER="$arg" ;;
    --skip-publish) SKIP_PUBLISH="--skip-publish" ;;
    -h|--help) 
      echo "Usage: ./scripts/publish.sh [patch|minor|major|<version>] [--dry-run] [--first-release] [--tag <tag>] [--otp <code>]"
      echo ""
      echo "Examples:"
      echo "  ./scripts/publish.sh --dry-run        # preview without publishing"
      echo "  ./scripts/publish.sh patch            # bump patch + publish"
      echo "  ./scripts/publish.sh 0.1.0             # set exact version + publish"
      echo "  ./scripts/publish.sh --tag next       # publish under 'next' tag"
      echo "  ./scripts/publish.sh --otp 123456     # 2FA code if token requires OTP"
      echo "  npm run publish                       # same via npm"
      echo "  npm run publish:dry                   # dry-run via npm"
      exit 0
      ;;
  esac
done

# Handle --tag <value> and --otp <value> forms
if [[ " $* " == *" --tag "* ]]; then
  ARGS=("$@")
  for i in "${!ARGS[@]}"; do
    if [[ "${ARGS[$i]}" == "--tag" && $((i+1)) -lt ${#ARGS[@]} ]]; then
      TAG="${ARGS[$((i+1))]}"
    fi
  done
fi
if [[ " $* " == *" --otp "* ]]; then
  ARGS=("$@")
  for i in "${!ARGS[@]}"; do
    if [[ "${ARGS[$i]}" == "--otp" && $((i+1)) -lt ${#ARGS[@]} ]]; then
      OTP="${ARGS[$((i+1))]}"
    fi
  done
fi

echo "──────────────────────────────────────────"
echo " tcpkit — npm publish"
echo " Repo: https://github.com/shivam-070208/tcpkit"
echo "──────────────────────────────────────────"
echo " Options: specifier='${SPECIFIER:-<prompt>}' tag='$TAG' dry_run='${DRY_RUN:-no}' otp='${OTP:-no}'"

# 1) Pre-flight checks
echo ""
echo "› Checking prerequisites..."

if ! command -v node >/dev/null 2>&1; then echo "✖ node not found"; exit 1; fi
if ! command -v npm >/dev/null 2>&1; then echo "✖ npm not found"; exit 1; fi
if ! command -v npx >/dev/null 2>&1; then echo "✖ npx not found"; exit 1; fi
if ! command -v git >/dev/null 2>&1; then echo "✖ git not found"; exit 1; fi

echo "  node $(node -v)  npm $(npm -v)  git $(git --version | awk '{print $3}')"

# npm auth check (allow dry-run without auth)
if [[ -z "$DRY_RUN" ]]; then
  if ! npm whoami >/dev/null 2>&1; then
    echo ""
    echo "✖ Not logged in to npm. Run:"
    echo "  npm login"
    echo "  # or with token:"
    echo "  npm config set //registry.npmjs.org/:_authToken <NPM_TOKEN>"
    echo "  # then re-run: npm run publish"
    exit 1
  else
    echo "  npm user: $(npm whoami)  registry: $(npm config get registry)"
  fi
else
  echo "  (dry-run — skipping npm auth check)"
fi

# git clean check
if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "⚠ Working tree not clean — uncommitted changes:"
  git status --porcelain | head -n 20
  echo ""
  if [[ -n "$DRY_RUN" ]]; then
    echo "  (dry-run — continuing anyway)"
  else
    read -rp "Continue anyway? [y/N] " ans
    if [[ ! "$ans" =~ ^[Yy]$ ]]; then echo "Aborted."; exit 1; fi
  fi
fi

# Ensure on main/master for real publish
BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "")
if [[ -z "$DRY_RUN" && "$BRANCH" != "main" && "$BRANCH" != "master" ]]; then
  echo "⚠ Current branch is '$BRANCH' (expected main/master for publish)"
  read -rp "Continue on '$BRANCH'? [y/N] " ans
  if [[ ! "$ans" =~ ^[Yy]$ ]]; then echo "Aborted."; exit 1; fi
fi

# 2) Install & sync
echo ""
echo "› Syncing workspace..."
npx nx sync 2>&1 | tail -n 20 || true

echo ""
echo "› Building all publishable projects..."
npx nx run-many -t build --parallel=3
echo "✓ Build done"

# Verify CLI artifact
if [[ ! -f "apps/cli/dist/main.js" ]]; then
  echo "✖ Build failed: apps/cli/dist/main.js missing"
  exit 1
fi
# Ensure bin is executable
chmod +x apps/cli/dist/main.js 2>/dev/null || true
echo "  ✓ apps/cli/dist/main.js exists ($(wc -c < apps/cli/dist/main.js) bytes)"

# Check dist for libs
for lib in protocol tcp-client core tui; do
  if [[ ! -f "libs/$lib/dist/index.js" ]]; then
    echo "  ⚠ libs/$lib/dist/index.js missing (did build fail?)"
  fi
done

# 3) Show what will be published (dry-pack)
echo ""
echo "› Pack preview (tcpkit):"
(cd apps/cli && npm pack --dry-run 2>&1 | tail -n 30) || true

# 4) Run nx release (handles version bump, changelog, git tag, npm publish)
echo ""
echo "› Running nx release..."

# Build nx release command
# By default nx release will prompt for version if SPECIFIER is empty (interactive)
# For CI/non-interactive use: pass patch/minor/major/version

# Auto-detect first release (no git tags yet) — nx release needs --first-release then
if [[ -z "$FIRST_RELEASE" && -z "$(git tag --list 2>/dev/null | head -n 1)" ]]; then
  echo "  (no git tags found — auto-adding --first-release)"
  FIRST_RELEASE="--first-release"
fi

NX_ARGS=("--verbose")
if [[ -n "$DRY_RUN" ]]; then NX_ARGS+=("$DRY_RUN"); fi
if [[ -n "$FIRST_RELEASE" ]]; then NX_ARGS+=("$FIRST_RELEASE"); fi
if [[ -n "$SPECIFIER" ]]; then NX_ARGS+=("$SPECIFIER"); fi
if [[ -n "$OTP" ]]; then NX_ARGS+=("--otp=$OTP"); fi
# provenance is handled via env NPM_CONFIG_PROVENANCE=true in release.yml (GitHub Actions with id-token).
# For local publish, provenance is optional — uncomment to enable sigstore provenance:
# export NPM_CONFIG_PROVENANCE=true

# Tag handling: nx release publish uses npm publish internally; tag can be passed via --tag? 
# nx release doesn't expose --tag directly, but we can set via env or post-step.
# We use npm config tag if requested.
if [[ "$TAG" != "latest" ]]; then
  echo "  Publishing with tag: $TAG"
  # nx release respects NPM_CONFIG_TAG env var
  export NPM_CONFIG_TAG="$TAG"
fi

# If interactive (no specifier, no dry-run), just call nx release and let it prompt
if [[ -z "$SPECIFIER" && -z "$DRY_RUN" ]]; then
  echo "  → npx nx release ${NX_ARGS[*]}"
  echo "  (you will be prompted to pick a version bump)"
  npx nx release "${NX_ARGS[@]}"
else
  echo "  → npx nx release ${NX_ARGS[*]}"
  npx nx release "${NX_ARGS[@]}"
fi

echo ""
echo "──────────────────────────────────────────"
if [[ -n "$DRY_RUN" ]]; then
  echo "✓ Dry-run complete — no files published."
  echo "  To publish for real:"
  echo "    npm run publish -- patch   # or minor/major/0.1.0"
  echo "    # or: ./scripts/publish.sh patch"
else
  echo "✓ Published!"
  echo "  Verify:"
  echo "    npm view tcpkit version"
  echo "    npx tcpkit --help"
  echo "    npm view @tcpkit/protocol version"
fi
echo "──────────────────────────────────────────"
