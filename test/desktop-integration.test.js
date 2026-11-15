const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { generateDesktopFileContent, integrateLinuxAppImage } = require('../desktop-integration.js');

describe('Linux AppImage Desktop Integration', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rize-test-desktop-'));
  });

  afterEach(() => {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch (e) {
      /* ignore */
    }
  });

  test('generateDesktopFileContent creates valid Desktop Entry format', () => {
    const content = generateDesktopFileContent({
      appImagePath: '/opt/RIZE.AppImage',
      iconPath: '/opt/rize.png',
      appName: 'RIZE',
      comment: 'Material You Music Player',
    });

    assert.ok(content.includes('[Desktop Entry]'));
    assert.ok(content.includes('Name=RIZE'));
    assert.ok(content.includes('Exec=/opt/RIZE.AppImage %U'));
    assert.ok(content.includes('Icon=/opt/rize.png'));
    assert.ok(content.includes('StartupWMClass=RIZE'));
    assert.ok(content.includes('Categories=AudioVideo;Audio;Player;'));
  });

  test('generateDesktopFileContent quotes Exec path with spaces', () => {
    const content = generateDesktopFileContent({
      appImagePath: '/home/user/My Apps/RIZE.AppImage',
      iconPath: '/home/user/rize.png',
    });

    assert.ok(content.includes('Exec="/home/user/My Apps/RIZE.AppImage" %U'));
  });

  test('integrateLinuxAppImage skips on non-linux platforms', () => {
    const result = integrateLinuxAppImage({
      platform: 'win32',
      appImagePath: '/some/path/RIZE.AppImage',
    });
    assert.strictEqual(result, false);
  });

  test('integrateLinuxAppImage skips if appImagePath is not provided and process.env.APPIMAGE is unset', () => {
    const oldEnv = process.env.APPIMAGE;
    delete process.env.APPIMAGE;
    try {
      const result = integrateLinuxAppImage({
        platform: 'linux',
      });
      assert.strictEqual(result, false);
    } finally {
      if (oldEnv) process.env.APPIMAGE = oldEnv;
    }
  });

  test('integrateLinuxAppImage creates .desktop files, icons and symlink', () => {
    const appsDir = path.join(tmpDir, 'applications');
    const iconsDir = path.join(tmpDir, 'icons');
    const pixmapsDir = path.join(tmpDir, 'pixmaps');
    const binDir = path.join(tmpDir, 'bin');
    const fakeIconSrc = path.join(tmpDir, 'fake-source-icon.png');
    fs.writeFileSync(fakeIconSrc, 'fake-png-binary-data');

    const fakeAppImagePath = path.join(tmpDir, 'RIZE.AppImage');
    fs.writeFileSync(fakeAppImagePath, '#!/bin/sh\nexit 0');
    fs.chmodSync(fakeAppImagePath, 0o755);

    const success = integrateLinuxAppImage({
      platform: 'linux',
      appImagePath: fakeAppImagePath,
      homeDir: tmpDir,
      appsDir,
      iconsDir,
      pixmapsDir,
      binDir,
      iconCandidates: [fakeIconSrc],
      runCommands: false,
    });

    assert.strictEqual(success, true);

    // Verify icons were copied
    const targetIcon = path.join(iconsDir, 'rize.png');
    const pixmapIcon = path.join(pixmapsDir, 'rize.png');
    assert.ok(fs.existsSync(targetIcon), 'hicolor icon must exist');
    assert.ok(fs.existsSync(pixmapIcon), 'pixmap icon must exist');
    assert.strictEqual(fs.readFileSync(targetIcon, 'utf8'), 'fake-png-binary-data');

    // Verify rize.desktop was created
    const rizeDesktop = path.join(appsDir, 'rize.desktop');
    assert.ok(fs.existsSync(rizeDesktop), 'rize.desktop must exist');
    const rizeContent = fs.readFileSync(rizeDesktop, 'utf8');
    assert.ok(rizeContent.includes(`Exec=${fakeAppImagePath} %U`));
    assert.ok(rizeContent.includes(`Icon=${targetIcon}`));
    assert.ok(rizeContent.includes('StartupWMClass=RIZE'));

    // Verify votify.desktop was created
    const votifyDesktop = path.join(appsDir, 'votify.desktop');
    assert.ok(fs.existsSync(votifyDesktop), 'votify.desktop must exist');
    const votifyContent = fs.readFileSync(votifyDesktop, 'utf8');
    assert.ok(votifyContent.includes('Name=Votify'));

    // Verify ~/.local/bin/rize symlink was created
    const binLink = path.join(binDir, 'rize');
    assert.ok(fs.existsSync(binLink), 'bin symlink must exist');
    assert.strictEqual(fs.realpathSync(binLink), fakeAppImagePath);
  });
});
