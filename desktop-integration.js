const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

/**
 * Generates the .desktop file content for RIZE.
 * @param {Object} params Parameters for the desktop entry.
 * @param {string} params.appImagePath Path to the AppImage executable.
 * @param {string} params.iconPath Path to the application icon.
 * @param {string} [params.appName='RIZE'] Application name.
 * @param {string} [params.comment='Material You Music Player (RIZE)'] Comment/description.
 * @returns {string} Formatted desktop entry file content.
 */
function generateDesktopFileContent({
  appImagePath,
  iconPath,
  appName = 'RIZE',
  comment = 'Material You Music Player (RIZE)',
}) {
  const quotedExec = appImagePath.includes(' ') ? `"${appImagePath}"` : appImagePath;
  return [
    '[Desktop Entry]',
    'Type=Application',
    `Name=${appName}`,
    'GenericName=Music Player',
    `Comment=${comment}`,
    `Exec=${quotedExec} %U`,
    `Icon=${iconPath}`,
    'Terminal=false',
    'Categories=AudioVideo;Audio;Player;',
    'StartupWMClass=RIZE',
    'Keywords=rize;votify;music;player;плеер;музыка;',
    'MimeType=x-scheme-handler/rize;x-scheme-handler/votify;',
    '',
  ].join('\n');
}

/**
 * Automatically integrates the running AppImage into the Linux application menu
 * by creating or updating ~/.local/share/applications/rize.desktop and ~/.local/share/applications/votify.desktop,
 * deploying the high-resolution app icon, and triggering desktop database updates.
 *
 * @param {Object} [options={}] Options for customization and testing.
 * @param {string} [options.platform] Platform override (defaults to process.platform).
 * @param {string} [options.appImagePath] Executable path override (defaults to process.env.APPIMAGE).
 * @param {string} [options.homeDir] Home directory override.
 * @param {string} [options.appsDir] Applications directory override.
 * @param {string} [options.iconsDir] Icons directory override.
 * @param {string} [options.pixmapsDir] Pixmaps directory override.
 * @param {string} [options.binDir] Local bin directory override.
 * @param {string[]} [options.iconCandidates] Candidate paths to find the source icon.
 * @param {boolean} [options.runCommands=true] Whether to run update-desktop-database / gtk-update-icon-cache.
 * @param {Object} [options.app] Electron app object if available.
 * @returns {boolean} True if integration was performed or already up to date; false if skipped or failed.
 */
function integrateLinuxAppImage(options = {}) {
  const platform = options.platform || process.platform;
  if (platform !== 'linux') {
    return false;
  }

  const appImagePath = options.appImagePath || process.env.APPIMAGE;
  if (!appImagePath) {
    return false;
  }

  try {
    let homeDir = options.homeDir;
    if (!homeDir && options.app && typeof options.app.getPath === 'function') {
      try {
        homeDir = options.app.getPath('home');
      } catch (e) {
        // Fall back below
      }
    }
    if (!homeDir) {
      homeDir = process.env.HOME || require('os').homedir();
    }

    const appsDir = options.appsDir || path.join(homeDir, '.local', 'share', 'applications');
    const iconsDir =
      options.iconsDir ||
      path.join(homeDir, '.local', 'share', 'icons', 'hicolor', '512x512', 'apps');
    const pixmapsDir = options.pixmapsDir || path.join(homeDir, '.local', 'share', 'pixmaps');
    const binDir = options.binDir || path.join(homeDir, '.local', 'bin');

    fs.mkdirSync(appsDir, { recursive: true });
    fs.mkdirSync(iconsDir, { recursive: true });
    fs.mkdirSync(pixmapsDir, { recursive: true });

    const targetIconFile = path.join(iconsDir, 'rize.png');
    const pixmapIconFile = path.join(pixmapsDir, 'rize.png');

    const iconCandidates =
      options.iconCandidates ||
      [
        options.iconSrc,
        path.join(__dirname, 'src', 'icon.png'),
        process.env.APPDIR ? path.join(process.env.APPDIR, 'rize.png') : null,
        process.env.APPDIR
          ? path.join(
              process.env.APPDIR,
              'usr',
              'share',
              'icons',
              'hicolor',
              '512x512',
              'apps',
              'rize.png'
            )
          : null,
      ].filter(Boolean);

    let iconCopied = false;
    for (const src of iconCandidates) {
      try {
        if (fs.existsSync(src)) {
          const buf = fs.readFileSync(src);
          if (buf && buf.length > 0) {
            fs.writeFileSync(targetIconFile, buf);
            fs.writeFileSync(pixmapIconFile, buf);
            iconCopied = true;
            break;
          }
        }
      } catch (e) {
        // Try next candidate
      }
    }

    const iconRef = fs.existsSync(targetIconFile) ? targetIconFile : 'rize';

    // 1. rize.desktop
    const rizeDesktopPath = path.join(appsDir, 'rize.desktop');
    const rizeContent = generateDesktopFileContent({
      appImagePath,
      iconPath: iconRef,
      appName: 'RIZE',
      comment: 'Material You Music Player (RIZE)',
    });

    let wroteRize = false;
    if (
      !fs.existsSync(rizeDesktopPath) ||
      fs.readFileSync(rizeDesktopPath, 'utf8').trim() !== rizeContent.trim()
    ) {
      fs.writeFileSync(rizeDesktopPath, rizeContent, { mode: 0o644 });
      wroteRize = true;
    }

    // 2. votify.desktop (for users searching 'Votify')
    const votifyDesktopPath = path.join(appsDir, 'votify.desktop');
    const votifyContent = generateDesktopFileContent({
      appImagePath,
      iconPath: iconRef,
      appName: 'Votify',
      comment: 'Material You Music Player (Votify / RIZE)',
    });

    let wroteVotify = false;
    if (
      !fs.existsSync(votifyDesktopPath) ||
      fs.readFileSync(votifyDesktopPath, 'utf8').trim() !== votifyContent.trim()
    ) {
      fs.writeFileSync(votifyDesktopPath, votifyContent, { mode: 0o644 });
      wroteVotify = true;
    }

    // 3. ~/.local/bin/rize CLI link
    try {
      fs.mkdirSync(binDir, { recursive: true });
      const binLink = path.join(binDir, 'rize');
      if (fs.existsSync(binLink)) {
        try {
          fs.unlinkSync(binLink);
        } catch (e) {
          /* ignore */
        }
      }
      fs.symlinkSync(appImagePath, binLink);
    } catch (e) {
      // Non-critical
    }

    // 4. Inotify & database caches refresh
    if (wroteRize || wroteVotify || iconCopied) {
      try {
        const now = new Date();
        fs.utimesSync(rizeDesktopPath, now, now);
        fs.utimesSync(votifyDesktopPath, now, now);
      } catch (e) {
        /* ignore */
      }

      if (options.runCommands !== false) {
        exec(`update-desktop-database "${appsDir}"`, () => {});
        exec(
          `gtk-update-icon-cache -f -t "${path.join(homeDir, '.local', 'share', 'icons', 'hicolor')}"`,
          () => {}
        );
      }
    }

    return true;
  } catch (err) {
    console.warn('[appimage-integration] Error integrating desktop entry:', err.message);
    return false;
  }
}

module.exports = {
  generateDesktopFileContent,
  integrateLinuxAppImage,
};
