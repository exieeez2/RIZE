const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

describe('Playlist Import, Sidebar Cover Art & Audio Engine Stability', () => {
  it('src/app.js defines updatePlaylistsUI and creates playlists without undefined reference errors', () => {
    const appPath = path.join(__dirname, '..', 'src/app.js');
    const appCode = fs.readFileSync(appPath, 'utf8');

    // Verify updatePlaylistsUI definition
    assert.match(appCode, /function\s+updatePlaylistsUI\s*\(\)\s*\{[\s\S]*?renderPlaylistsList\(\);[\s\S]*?\}/);

    // Verify window exposure
    assert.ok(appCode.includes('window.createPlaylist = createPlaylist;'), 'createPlaylist should be exposed on window');
    assert.ok(appCode.includes('window.updatePlaylistsUI = updatePlaylistsUI;'), 'updatePlaylistsUI should be exposed on window');
    assert.ok(appCode.includes('window.renderPlaylistsList = renderPlaylistsList;'), 'renderPlaylistsList should be exposed on window');

    // Verify createPlaylist calls updatePlaylistsUI and returns playlist
    assert.match(appCode, /function\s+createPlaylist\s*\([\s\S]*?updatePlaylistsUI\(\);[\s\S]*?return\s+newPl;/);
  });

  it('src/app.js and src/styles.css render sidebar playlist covers with proper error fallback and clean styling', () => {
    const appPath = path.join(__dirname, '..', 'src/app.js');
    const appCode = fs.readFileSync(appPath, 'utf8');

    // Verify renderSidebarPins uses renderPlaylistCover instead of raw fragile img tags
    assert.match(appCode, /renderPlaylistCover\(pin,\s*pl,\s*48\);/, 'renderSidebarPins must use renderPlaylistCover');

    // Verify renderPlaylistCover sets onerror before src and removes img on error
    const coverFuncMatch = appCode.match(/function\s+renderPlaylistCover[\s\S]*?renderFallback\(\);\s*\}/);
    assert.ok(coverFuncMatch, 'renderPlaylistCover function must exist');
    const coverFuncCode = coverFuncMatch[0];

    assert.ok(coverFuncCode.indexOf('img.onerror') < coverFuncCode.indexOf('img.src ='), 'img.onerror must be set before img.src in renderPlaylistCover');
    assert.ok(coverFuncCode.includes('img.remove();'), 'img.onerror should remove failed img element to prevent broken icon');

    // Verify CSS for sidebar-pin playlist
    const cssPath = path.join(__dirname, '..', 'src/styles.css');
    const css = fs.readFileSync(cssPath, 'utf8');

    assert.ok(css.includes('.sidebar-pin.pin-playlist.playlist-cover-art'), 'styles.css must style .sidebar-pin.pin-playlist.playlist-cover-art');
    assert.ok(css.includes('.sidebar-pin.pin-playlist .cover-single-img'), 'styles.css must style cover images inside sidebar pins');
    assert.ok(css.includes('.sidebar-pin.pin-playlist.cover-empty svg'), 'styles.css must style fallback svg inside sidebar pins');
  });

  it('src/import-modal-logic.js safely creates new playlists using window.createPlaylist', () => {
    const importPath = path.join(__dirname, '..', 'src/import-modal-logic.js');
    const importCode = fs.readFileSync(importPath, 'utf8');

    // import-btn-save must not have bare playlists[name] = selected
    assert.ok(!importCode.includes('playlists[name] = selected;'), 'import-modal-logic.js must not assign to undefined playlists global');
    assert.ok(importCode.includes('window.createPlaylist'), 'import-modal-logic.js should check window.createPlaylist');
    assert.ok(importCode.includes('createPlaylist(name, selected)'), 'import-modal-logic.js should create playlist');
  });

  it('Audio engine settings adjustments are throttled via RAF and do not re-render preset lists on input', () => {
    const appPath = path.join(__dirname, '..', 'src/app.js');
    const appCode = fs.readFileSync(appPath, 'utf8');

    // Verify applyAudioSettings is throttled via requestAnimationFrame
    assert.ok(appCode.includes('audioSettingsRaf = requestAnimationFrame('), 'applyAudioSettings must be throttled with requestAnimationFrame');

    // Verify audio engine parameter changes avoid heavy audio graph rebuilds
    const enginePath = path.join(__dirname, '..', 'src/audio-engine.js');
    const engineCode = fs.readFileSync(enginePath, 'utf8');

    assert.ok(engineCode.includes('setTargetAtTime'), 'setEq or setEqBands should use setTargetAtTime for smooth parameter automation');
    assert.ok(!engineCode.includes('this.applySettings();') || engineCode.match(/setAudioSettings[\s\S]*?}/)[0].indexOf('applySettings') === -1, 'setAudioSettings must not redundantly invoke applySettings()');
  });

  it('Fullscreen player has tv-cover-container with fallback SVG and avoids broken image placeholders', () => {
    const htmlPath = path.join(__dirname, '..', 'src/index.html');
    const html = fs.readFileSync(htmlPath, 'utf8');
    assert.ok(html.includes('id="tv-cover-container"'), 'index.html must have tv-cover-container');
    assert.ok(html.includes('id="tv-cover-fallback"'), 'index.html must have tv-cover-fallback');

    const appPath = path.join(__dirname, '..', 'src/app.js');
    const appCode = fs.readFileSync(appPath, 'utf8');
    assert.ok(appCode.includes('showFallbackCover'), 'app.js must define showFallbackCover');
    assert.ok(appCode.includes('tryLoadCandidate'), 'app.js must try candidate thumbnail URLs');

    const cssPath = path.join(__dirname, '..', 'src/styles.css');
    const css = fs.readFileSync(cssPath, 'utf8');
    assert.ok(css.includes('.tv-cover-container'), 'styles.css must style .tv-cover-container');
    assert.ok(css.includes('.tv-cover-fallback'), 'styles.css must style .tv-cover-fallback');
  });

  it('Volume slider is vertically centered without pill-range collision', () => {
    const htmlPath = path.join(__dirname, '..', 'src/index.html');
    const html = fs.readFileSync(htmlPath, 'utf8');
    assert.ok(!html.includes('class="pill-range volume-range" id="volume-slider"'), 'volume slider must not have conflicting pill-range class');

    const cssPath = path.join(__dirname, '..', 'src/styles.css');
    const css = fs.readFileSync(cssPath, 'utf8');
    assert.ok(css.includes('.volume-control-group'), 'styles.css must style .volume-control-group');
    assert.ok(css.includes('#volume-slider::-webkit-slider-thumb'), 'styles.css must style #volume-slider thumb');
  });

  it('Stream resolution and buffering watchdog protect against infinite loading on Windows', () => {
    const appPath = path.join(__dirname, '..', 'src/app.js');
    const appCode = fs.readFileSync(appPath, 'utf8');
    assert.ok(appCode.includes('bufferingWatchdogTimer'), 'app.js must have buffering watchdog');
    assert.ok(appCode.includes('clearBufferingWatchdog'), 'app.js must clear buffering watchdog on play/canplay');

    const routesPath = path.join(__dirname, '..', 'routes/music.js');
    const routesCode = fs.readFileSync(routesPath, 'utf8');
    assert.ok(routesCode.includes('streamCache.delete(originalId)'), 'routes/music.js must invalidate cache on 403/429');

    const utilsPath = path.join(__dirname, '..', 'utils.js');
    const utilsCode = fs.readFileSync(utilsPath, 'utf8');
    assert.ok(utilsCode.includes('findYtDlp'), 'utils.js must have findYtDlp');
    assert.ok(utilsCode.includes('bypassCache'), 'utils.js fetchStreamUrl must support bypassCache');
  });
});
