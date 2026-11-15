#!/usr/bin/env bash
set -euo pipefail

# Path definitions
REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APPS_DIR="${HOME}/.local/share/applications"
ICONS_DIR="${HOME}/.local/share/icons/hicolor/512x512/apps"
BIN_DIR="${HOME}/.local/bin"

mkdir -p "$APPS_DIR" "$ICONS_DIR" "$BIN_DIR"

# 1. Ensure latest app icon is deployed
if [ -f "$REPO_DIR/src/icon.png" ]; then
  cp "$REPO_DIR/src/icon.png" "$ICONS_DIR/rize.png"
  cp "$REPO_DIR/src/icon.png" "$ICONS_DIR/votify.png"
fi

# 2. Deploy executable runner in ~/.local/bin/rize and ~/.local/bin/votify
cat > "$BIN_DIR/rize" << 'EOF'
#!/usr/bin/env bash
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="/home/exieeez/123123123123/Votify"

cd "$REPO_DIR" || exit 1

if [ -x "$REPO_DIR/src-tauri/target/release/app" ]; then
  exec "$REPO_DIR/src-tauri/target/release/app" "$@"
elif [ -x "$REPO_DIR/src-tauri/target/debug/app" ]; then
  exec "$REPO_DIR/src-tauri/target/debug/app" "$@"
elif command -v cargo >/dev/null 2>&1; then
  exec cargo run --manifest-path "$REPO_DIR/src-tauri/Cargo.toml" -- "$@"
elif [ -x "$REPO_DIR/node_modules/.bin/electron" ]; then
  exec "$REPO_DIR/node_modules/.bin/electron" "$REPO_DIR" "$@"
else
  exec npx electron "$REPO_DIR" "$@"
fi
EOF
chmod +x "$BIN_DIR/rize"

# Link ~/.local/bin/votify to the runner as well so both commands work
ln -sf "$BIN_DIR/rize" "$BIN_DIR/votify"

# 3. Create/update rize.desktop entry
cat > "$APPS_DIR/rize.desktop" << EOF
[Desktop Entry]
Type=Application
Name=RIZE
GenericName=Music Player
Comment=Material You Music Player (RIZE)
Exec=$BIN_DIR/rize %U
Path=$REPO_DIR
Icon=$ICONS_DIR/rize.png
Terminal=false
Categories=AudioVideo;Audio;Player;
StartupWMClass=RIZE
MimeType=x-scheme-handler/rize;x-scheme-handler/votify;
EOF

# 4. Create/update votify.desktop entry (pointing to the same current codebase)
cat > "$APPS_DIR/votify.desktop" << EOF
[Desktop Entry]
Type=Application
Name=Votify
GenericName=Music Player
Comment=Material You Music Player (Votify / RIZE)
Exec=$BIN_DIR/rize %U
Path=$REPO_DIR
Icon=$ICONS_DIR/votify.png
Terminal=false
Categories=AudioVideo;Audio;Player;
StartupWMClass=RIZE
MimeType=x-scheme-handler/votify;x-scheme-handler/rize;
EOF

chmod 644 "$APPS_DIR/rize.desktop" "$APPS_DIR/votify.desktop"

# 5. Update desktop database & icon cache if tools are available
if command -v update-desktop-database >/dev/null 2>&1; then
  update-desktop-database "$APPS_DIR" >/dev/null 2>&1 || true
fi

if command -v gtk-update-icon-cache >/dev/null 2>&1; then
  gtk-update-icon-cache -f -t "${HOME}/.local/share/icons/hicolor" >/dev/null 2>&1 || true
fi

# Touch desktop files to ensure launchers reload immediately
touch "$APPS_DIR/rize.desktop" "$APPS_DIR/votify.desktop"

echo "✅ App menu shortcuts successfully updated for RIZE and Votify."
