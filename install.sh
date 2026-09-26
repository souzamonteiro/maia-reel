#!/usr/bin/env bash
set -euo pipefail
SOURCE=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
WEB_DIR=${WEB_DIR:-/srv/maia/apps}
PORTAL_DIR=${PORTAL_DIR:-"$SOURCE/../maia-edge-apps-deployment/portal"}
[[ -f "$PORTAL_DIR/index.html" && -f "$PORTAL_DIR/sitemap.xml" ]] || { echo "Missing portal: $PORTAL_DIR" >&2; exit 1; }
[[ "$WEB_DIR" == /* && "$WEB_DIR" != / ]] || exit 1
if [[ $EUID -eq 0 ]]; then
  BUILD_USER=${SUDO_USER:-$(stat -c %U "$SOURCE")}
  [[ "$BUILD_USER" != root ]] || { echo 'Use a checkout owned by a non-root user'; exit 1; }
  runuser -u "$BUILD_USER" -- bash -c 'cd "$1"; npm ci && npm run build' bash "$SOURCE"
else
  (cd "$SOURCE" && npm ci && npm run build)
fi
[[ -s "$SOURCE/dist/index.html" && -s "$SOURCE/dist/ffmpeg/ffmpeg-core.wasm" ]] || exit 1
PUBLISH=$(mktemp)
trap 'rm -f "$PUBLISH"' EXIT
cat > "$PUBLISH" <<'PUBLISH_SH'
set -euo pipefail
SOURCE=$1 WEB_DIR=$2 PORTAL_DIR=$3
command -v rsync >/dev/null
install -d -m 0755 "$WEB_DIR" "$WEB_DIR/maia-reel" "$WEB_DIR/assets"
BACKUP=$(mktemp -d /var/tmp/maia-reel-portal-backup-XXXXXX)
for name in index.html sitemap.xml; do
  if [[ -f "$WEB_DIR/$name" ]]; then cp -p "$WEB_DIR/$name" "$BACKUP/$name"; fi
done
# Assets first; keep old hashed assets usable by open tabs.
rsync -a --exclude=index.html --chown=root:root --chmod=D755,F644 "$SOURCE/dist/" "$WEB_DIR/maia-reel/"
install -m 0644 "$SOURCE/dist/index.html" "$WEB_DIR/maia-reel/index.html.new"
mv -f "$WEB_DIR/maia-reel/index.html.new" "$WEB_DIR/maia-reel/index.html"
rsync -a --chown=root:root --chmod=D755,F644 "$PORTAL_DIR/assets/" "$WEB_DIR/assets/"
install -m 0644 "$PORTAL_DIR/index.html" "$WEB_DIR/index.html.new"
mv -f "$WEB_DIR/index.html.new" "$WEB_DIR/index.html"
install -m 0644 "$PORTAL_DIR/sitemap.xml" "$WEB_DIR/sitemap.xml"
echo "Installed: $WEB_DIR/maia-reel"
echo "Portal backup: $BACKUP"
echo 'URL: https://apps.maiaplatform.org/maia-reel/'
PUBLISH_SH
if [[ $EUID -eq 0 ]]; then bash "$PUBLISH" "$SOURCE" "$WEB_DIR" "$PORTAL_DIR"; else sudo bash "$PUBLISH" "$SOURCE" "$WEB_DIR" "$PORTAL_DIR"; fi
