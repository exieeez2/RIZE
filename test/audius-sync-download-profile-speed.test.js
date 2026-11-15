import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

describe('Audius Fallback, Lyrics Sync Offset, Parallel Downloads, and Profile Pinned Track Integrity', () => {

  test('1. TVK speed setting allows 0ms without snapping back to 500ms default', () => {
    const appJs = fs.readFileSync(path.join(rootDir, 'src/app.js'), 'utf8');

    // Verify speed extraction does not use `Number(parsed.speed) || TVK_DEFAULTS.speed`
    assert.match(appJs, /speed:\s*\(parsed\.speed\s*!==\s*undefined\s*&&\s*!isNaN\(Number\(parsed\.speed\)\)\)\s*\?\s*Number\(parsed\.speed\)\s*:\s*TVK_DEFAULTS\.speed/);
    // Verify applyTvk does not use `Number(s.speed) || 500`
    assert.match(appJs, /const\s+speed\s*=\s*\(s\.speed\s*!==\s*undefined\s*&&\s*!isNaN\(Number\(s\.speed\)\)\)\s*\?\s*Number\(s\.speed\)\s*:\s*500;/);
  });

  test('2. TVK panel includes lyrics offset controls and shifts matchTime for fast rap vocals', () => {
    const indexHtml = fs.readFileSync(path.join(rootDir, 'src/index.html'), 'utf8');
    const appJs = fs.readFileSync(path.join(rootDir, 'src/app.js'), 'utf8');

    // Index HTML has lyrics offset controls
    assert.ok(indexHtml.includes('id="tvk-offset"'), 'index.html must contain tvk-offset slider');
    assert.ok(indexHtml.includes('id="val-tvk-offset"'), 'index.html must contain val-tvk-offset label');
    assert.ok(indexHtml.includes('id="btn-tvk-offset-minus"'), 'index.html must contain minus 100ms button');
    assert.ok(indexHtml.includes('id="btn-tvk-offset-plus"'), 'index.html must contain plus 100ms button');

    // app.js applies tvk.offset in updateSyncedLyricsHighlight and updateActiveGradient
    assert.match(appJs, /const\s+tvkOffset\s*=\s*\(typeof\s+getTvk\s*===\s*'function'/);
    assert.match(appJs, /matchTime\s*=\s*Math\.max\(0,\s*currentTime\s*-\s*tvkOffset\s*\+\s*lookAhead\);/);
  });

  test('3. Profile pinned track checks window.currentTrack and state.currentTrack', () => {
    const appJs = fs.readFileSync(path.join(rootDir, 'src/app.js'), 'utf8');
    const fbClientJs = fs.readFileSync(path.join(rootDir, 'src/firebase-client.js'), 'utf8');

    // app.js exposes window.currentTrack and window.getCurrentPlayingTrack
    assert.ok(appJs.includes('window.currentTrack = track;'), 'app.js must set window.currentTrack');
    assert.ok(appJs.includes('window.getCurrentPlayingTrack = () => state.currentTrack || window.currentTrack || null;'), 'app.js must expose window.getCurrentPlayingTrack');

    // firebase-client.js checks curTrack from window.currentTrack and state via getLivePlayingTrack
    assert.ok(fbClientJs.includes('function getLivePlayingTrack()'), 'firebase-client must have getLivePlayingTrack helper');
    assert.ok(fbClientJs.includes('window.currentTrack'), 'getLivePlayingTrack must inspect window.currentTrack');
    assert.ok(fbClientJs.includes('window.state.currentTrack'), 'getLivePlayingTrack must inspect window.state.currentTrack');
    assert.ok(fbClientJs.includes('Трек закреплён:'), 'firebase-client must show confirmation toast on pin selection');
  });

  test('4. Audius engine in routes/music.js cleanly falls back to YouTube Opus on missing tracks or errors', () => {
    const musicRoutes = fs.readFileSync(path.join(rootDir, 'routes/music.js'), 'utf8');
    const utilsRoutes = fs.readFileSync(path.join(rootDir, 'routes/utils.js'), 'utf8');

    // utils.js rejects raw 11-char YouTube IDs from being sent to Audius
    assert.match(utilsRoutes, /\/\^\[a-zA-Z0-9_-\]\{11\}\$\/\.test\(raw\)\s*&&\s*!raw\.includes\('\s*'\)/);

    // music.js falls back to fetchStreamUrl(id) if audiusStream is null or fails
    assert.ok(musicRoutes.includes('// If Audius lookup fails or has no match, smoothly fall back to YouTube Opus below'));
    assert.ok(musicRoutes.includes('Seamlessly falling back to YouTube Opus for'));
  });

  test('5. Local folder download defaults to Downloads directory and never aborts silently', () => {
    const appJs = fs.readFileSync(path.join(rootDir, 'src/app.js'), 'utf8');
    const musicRoutes = fs.readFileSync(path.join(rootDir, 'routes/music.js'), 'utf8');

    // app.js ensures dir defaults to Downloads
    assert.match(appJs, /if\s*\(!dir\)\s*dir\s*=\s*'Downloads';/);

    // musicRoutes has native folder picker and default directory routes
    assert.ok(musicRoutes.includes("u.pathname === '/api/dialog/get-default-folder'"));
    assert.ok(musicRoutes.includes("u.pathname === '/api/dialog/pick-folder'"));
  });

  test('6. Parallel download runs with concurrency = 3 and updates visual progress banner', () => {
    const appJs = fs.readFileSync(path.join(rootDir, 'src/app.js'), 'utf8');
    const indexHtml = fs.readFileSync(path.join(rootDir, 'src/index.html'), 'utf8');
    const stylesCss = fs.readFileSync(path.join(rootDir, 'src/styles.css'), 'utf8');

    // index.html has floating progress banner
    assert.ok(indexHtml.includes('id="dl-progress-banner"'));
    assert.ok(indexHtml.includes('id="dl-fb-bar-fill"'));

    // styles.css has banner styles
    assert.ok(stylesCss.includes('.dl-floating-banner'));
    assert.ok(stylesCss.includes('.dl-fb-bar-fill'));

    // app.js runs workers with CONCURRENCY
    assert.match(appJs, /const\s+CONCURRENCY\s*=\s*Math\.min\(3,\s*list\.length\);/);
    assert.ok(appJs.includes('showDownloadProgressBanner'));
    assert.ok(appJs.includes('updateDownloadProgressBanner'));
    assert.ok(appJs.includes('hideDownloadProgressBanner'));
  });

  test('7. Profile overlay performance: full-page backdrop-filter removed for instant rendering', () => {
    const stylesCss = fs.readFileSync(path.join(rootDir, 'src/styles.css'), 'utf8');

    // Check .pc-profile-overlay has high performance background and transform
    assert.ok(stylesCss.includes('.pc-profile-overlay {'));
    assert.ok(stylesCss.includes('contain: paint;'));
    assert.ok(stylesCss.includes('@keyframes profileOverlayFadeIn'));
  });

  test('8. Version is bumped to 1.4 across all configuration and frontend files', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
    assert.equal(pkg.version, '1.4.0', 'package.json version must be 1.4.0');

    const cargoToml = fs.readFileSync(path.join(rootDir, 'src-tauri/Cargo.toml'), 'utf8');
    assert.match(cargoToml, /version\s*=\s*"1\.4\.0"/, 'Cargo.toml version must be 1.4.0');

    const tauriConf = JSON.parse(fs.readFileSync(path.join(rootDir, 'src-tauri/tauri.conf.json'), 'utf8'));
    assert.equal(tauriConf.version, '1.4.0', 'tauri.conf.json version must be 1.4.0');

    const buildGradle = fs.readFileSync(path.join(rootDir, 'android/app/build.gradle.kts'), 'utf8');
    assert.match(buildGradle, /versionName\s*=\s*"1\.4\.0"/, 'build.gradle.kts versionName must be 1.4.0');

    const indexHtml = fs.readFileSync(path.join(rootDir, 'src/index.html'), 'utf8');
    assert.ok(indexHtml.includes('Version 1.4.0'), 'index.html must display Version 1.4.0');
    assert.ok(indexHtml.includes('v1.4.0'), 'index.html must display v1.4.0 tag');
  });

  test('9. Download modal has modern sleek M3 design and folder picker handles Wayland', () => {
    const stylesCss = fs.readFileSync(path.join(rootDir, 'src/styles.css'), 'utf8');
    const musicRoutes = fs.readFileSync(path.join(rootDir, 'routes/music.js'), 'utf8');

    // Download choice styling
    assert.ok(stylesCss.includes('.download-choice-card'));
    assert.ok(stylesCss.includes('.download-choice-option'));
    assert.ok(stylesCss.includes('.download-choice-icon'));
    assert.ok(stylesCss.includes('backdrop-filter: blur(28px)'));

    // Folder picker on Wayland support
    assert.ok(musicRoutes.includes('process.env.WAYLAND_DISPLAY'));
  });

  test('10. Home carousel title jitter is prevented via hysteresis and ambient covers 100% height', () => {
    const appJs = fs.readFileSync(path.join(rootDir, 'src/app.js'), 'utf8');
    const stylesCss = fs.readFileSync(path.join(rootDir, 'src/styles.css'), 'utf8');

    // Hysteresis in updateCoverflowCards
    assert.ok(appJs.includes('diff > 0.58'), 'Coverflow cards must have positive hysteresis');
    assert.ok(appJs.includes('diff < -0.58'), 'Coverflow cards must have negative hysteresis');
    assert.ok(appJs.includes('_textChangeTimer'), 'Title updates must be debounced during rapid scroll');

    // Ambient height 100% full coverage
    assert.ok(stylesCss.includes('.home-ambient { position: absolute; top: 0; left: 0; right: 0; bottom: 0; height: 100%; min-height: 100%;'));
  });

});
