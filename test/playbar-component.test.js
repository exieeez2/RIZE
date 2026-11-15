import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

describe('Preact Playbar Component & Vendor Bundle Verification', () => {
  const rootDir = process.cwd();
  const vendorPath = path.join(rootDir, 'src/vendor/preact-htm.umd.js');
  const componentPath = path.join(rootDir, 'src/components/Playbar.js');

  it('1. Preact HTM vendor bundle exists and initializes window.htmPreact', () => {
    assert.ok(fs.existsSync(vendorPath), 'preact-htm.umd.js should exist in src/vendor');
    const code = fs.readFileSync(vendorPath, 'utf8');

    const mockWindow = {};
    const runner = new Function('window', 'exports', 'module', 'define', code);
    runner.call(mockWindow, mockWindow, undefined, undefined, undefined);

    assert.ok(mockWindow.htmPreact, 'window.htmPreact should be defined');
    assert.strictEqual(typeof mockWindow.htmPreact.html, 'function');
    assert.strictEqual(typeof mockWindow.htmPreact.render, 'function');
    assert.strictEqual(typeof mockWindow.htmPreact.useState, 'function');
    assert.strictEqual(typeof mockWindow.htmPreact.useEffect, 'function');
    assert.strictEqual(typeof mockWindow.htmPreact.useRef, 'function');
    assert.strictEqual(typeof mockWindow.htmPreact.useCallback, 'function');
  });

  it('2. Playbar.js component initializes and creates complete VNode tree with all required IDs', () => {
    assert.ok(fs.existsSync(componentPath), 'Playbar.js should exist in src/components');
    const vendorCode = fs.readFileSync(vendorPath, 'utf8');
    const compCode = fs.readFileSync(componentPath, 'utf8');

    const mockWindow = {};
    const vendorRunner = new Function('window', 'exports', 'module', 'define', vendorCode);
    vendorRunner.call(mockWindow, mockWindow, undefined, undefined, undefined);

    const compRunner = new Function('window', compCode);
    compRunner(mockWindow);

    assert.ok(mockWindow.PlaybarComponent, 'window.PlaybarComponent should be defined');
    assert.strictEqual(typeof mockWindow.mountPreactPlaybar, 'function');

    // Test rendering the VNode
    const { html, h } = mockWindow.htmPreact;
    const vnode = html`<${mockWindow.PlaybarComponent}
      initialTrack=${{ title: 'Loser', artist: 'Tame Impala', thumb: 'https://example.com/art.jpg', engineBadge: 'FLAC 24-bit', isFav: true }}
      initialPlayback=${{ isPlaying: true, isBuffering: false, currentTime: 45, duration: 223 }}
      initialVolume=${{ volume: 0.7, isMuted: false }}
      initialModes=${{ isShuffle: true, isRepeat: false, lyricsOpen: false }}
    />`;

    assert.ok(vnode, 'VNode should be created');
    assert.strictEqual(vnode.type, mockWindow.PlaybarComponent);
    assert.strictEqual(vnode.props.initialTrack.title, 'Loser');
    assert.strictEqual(vnode.props.initialTrack.artist, 'Tame Impala');
    assert.strictEqual(vnode.props.initialPlayback.isPlaying, true);
    assert.strictEqual(vnode.props.initialVolume.volume, 0.7);
  });

  it('3. Index.html properly imports preact-htm.umd.js and Playbar.js before app.js', () => {
    const indexPath = path.join(rootDir, 'src/index.html');
    const htmlContent = fs.readFileSync(indexPath, 'utf8');

    assert.ok(htmlContent.includes('<script src="vendor/preact-htm.umd.js"></script>'), 'index.html must load preact-htm.umd.js');
    assert.ok(htmlContent.includes('<script src="components/Playbar.js"></script>'), 'index.html must load Playbar.js');

    const preactIdx = htmlContent.indexOf('vendor/preact-htm.umd.js');
    const playbarIdx = htmlContent.indexOf('components/Playbar.js');
    const appIdx = htmlContent.indexOf('src="app.js"');

    assert.ok(preactIdx < playbarIdx, 'preact-htm must load before Playbar.js');
    assert.ok(playbarIdx < appIdx, 'Playbar.js must load before app.js');
  });

  it('4. Playbar component source contains all critical Material You tokens and element IDs', () => {
    const compCode = fs.readFileSync(componentPath, 'utf8');

    const requiredIds = [
      'playbar-artwork-wrapper',
      'playbar-artwork',
      'm3c-wrap',
      'm3c-canvas',
      'artwork-fallback',
      'playbar-title',
      'playbar-artist',
      'playbar-engine-badge',
      'btn-toggle-fav',
      'btn-add-to-playlist',
      'btn-edit-current-track',
      'btn-playbar-more',
      'btn-shuffle',
      'btn-prev',
      'btn-play-pause',
      'play-icon',
      'pause-icon',
      'playbar-spinner',
      'btn-next',
      'btn-repeat',
      'time-current',
      'scrubber-track',
      'time-duration',
      'visualizer-container',
      'visualizer-canvas',
      'btn-toggle-lyrics-panel',
      'btn-open-settings',
      'settings-modified-dot',
      'btn-volume-mute',
      'volume-icon',
      'volume-muted-icon',
      'volume-slider'
    ];

    for (const id of requiredIds) {
      assert.ok(compCode.includes(`id="${id}"`), `Playbar must render element with id="${id}"`);
    }

    const requiredClasses = [
      'playbar-left',
      'artwork-wrapper',
      'track-meta',
      'track-title-marquee',
      'track-title',
      'track-artist',
      'btn-icon-pill',
      'playbar-center',
      'playback-controls',
      'control-btn',
      'play-pause-wrapper',
      'btn-play-pause',
      'scrubber-bar-wrapper',
      'time-label',
      'scrubber-track-container',
      'playbar-right',
      'visualizer-container',
      'volume-control-group',
      'volume-slider-wrapper',
      'volume-range'
    ];

    for (const cls of requiredClasses) {
      assert.ok(compCode.includes(cls), `Playbar must render class="${cls}"`);
    }
  });
});
