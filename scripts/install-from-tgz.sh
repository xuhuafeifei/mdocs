#!/usr/bin/env bash
# Install mdocs globally from local tgz + local lobe-editor tgz (no registry for lobe).
set -euo pipefail

MDOCS_TGZ=${1:-$HOME/fgbg-mdocs-0.8.19.tgz}
LOBE_TGZ=${2:-$HOME/fgbg-lobe-editor-1.0.0-fork.19.tgz}

MDOCS_TGZ=$(cd "$(dirname "$MDOCS_TGZ")" && pwd)/$(basename "$MDOCS_TGZ")
LOBE_TGZ=$(cd "$(dirname "$LOBE_TGZ")" && pwd)/$(basename "$LOBE_TGZ")
[[ -f "$MDOCS_TGZ" ]] || { echo "missing $MDOCS_TGZ" >&2; exit 1; }
[[ -f "$LOBE_TGZ" ]] || { echo "missing $LOBE_TGZ" >&2; exit 1; }

ROOT=$(npm root -g)
BIN=$(npm bin -g 2>/dev/null || echo /usr/local/bin)
DEST="$ROOT/@fgbg/mdocs"

echo "global root: $ROOT"
echo "global bin:  $BIN"

rm -rf "$ROOT/@fgbg"
WORKDIR=$(mktemp -d)
trap 'rm -rf "$WORKDIR"' EXIT

mkdir -p "$WORKDIR/mdocs"
tar -xzf "$MDOCS_TGZ" -C "$WORKDIR/mdocs"
PKG="$WORKDIR/mdocs/package"

node -e '
const fs = require("fs");
const path = require("path");
const p = path.join(process.argv[1], "package.json");
const lobe = process.argv[2];
const pkg = JSON.parse(fs.readFileSync(p, "utf8"));
pkg.dependencies = pkg.dependencies || {};
pkg.dependencies["@lobehub/editor"] = "file:" + lobe;
fs.writeFileSync(p, JSON.stringify(pkg, null, 2) + "\n");
' "$PKG" "$LOBE_TGZ"

# Install deps into the extracted package (copies lobe from file: tgz)
(cd "$PKG" && npm install --omit=dev --legacy-peer-deps \
  --registry=https://registry.npmjs.org/ \
  --@fgbg:registry=https://registry.npmjs.org/ \
  --no-audit --no-fund)

# Copy into global node_modules (do not npm -g a folder — that can link to /tmp)
mkdir -p "$ROOT/@fgbg"
rm -rf "$DEST"
cp -a "$PKG" "$DEST"

MDOCS_BIN="$DEST/bin/mdocs.js"
chmod +x "$MDOCS_BIN"
mkdir -p "$BIN"
ln -sfn "$MDOCS_BIN" "$BIN/mdocs"

echo "OK: $DEST"
"$BIN/mdocs" --help | head -5
