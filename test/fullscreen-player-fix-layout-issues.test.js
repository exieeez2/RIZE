import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test('Fullscreen player layout bugfixes and lyrics matching verification', async (t) => {
  const stylesCss = fs.readFileSync(path.join(__dirname, '../src/styles.css'), 'utf8');
  const indexHtml = fs.readFileSync(path.join(__dirname, '../src/index.html'), 'utf8');
  const appJs = fs.readFileSync(path.join(__dirname, '../src/app.js'), 'utf8');
  const routesMusicJs = fs.readFileSync(path.join(__dirname, '../routes/music.js'), 'utf8');

  await t.test('1. Overlapping controls resolved: 104x72 play button inside dedicated wrapper with 16px gap', () => {
    // Play button and wrapper have 104x72 dimensions
    assert.match(stylesCss, /\.tvk-controls \.play-pause-wrapper\s*\{[^}]*width:\s*104px\s*!important/);
    assert.match(stylesCss, /\.tvk-controls \.play-pause-wrapper\s*\{[^}]*height:\s*72px\s*!important/);
    assert.match(stylesCss, /\.tvk-controls \.play\s*\{[^}]*width:\s*104px\s*!important/);
    assert.match(stylesCss, /\.tvk-controls \.play\s*\{[^}]*height:\s*72px\s*!important/);
    assert.match(stylesCss, /\.tvk-controls \.tonal\s*\{[^}]*width:\s*64px\s*!important/);
    assert.match(stylesCss, /\.tvk-controls \.tonal\s*\{[^}]*height:\s*56px\s*!important/);
    assert.match(stylesCss, /\.tvk-controls\s*\{[^}]*gap:\s*16px\s*!important/);

    // app.js does not shrink tvkBtn width via JS animation
    assert.doesNotMatch(appJs, /const pausedW = H;\s*\n\s*const pausedR = H \/ 2;\s*\n\s*const playingW = Math\.round\(H \* 1\.39\);/);
  });

  await t.test('2. Very blurred and darkened cover background enabled, gradient mesh hidden', () => {
    // #tv-bg is displayed with heavily blurred cover layer matching application
    assert.match(stylesCss, /#tv-bg\s*\{[^}]*display:\s*block\s*!important/);
    assert.match(stylesCss, /\.tv-bg-layer\s*\{[^}]*filter:\s*blur\(90px\)\s*brightness\(0\.6\)\s*saturate\(1\.25\)/);
    // Gradient mesh is hidden per user request
    assert.match(stylesCss, /#tvk-ambient-bg\s*\{[^}]*display:\s*none\s*!important/);
  });

  await t.test('3. Volume bar centered with max-width: 200px and clean slim slider', () => {
    assert.match(stylesCss, /\.tvk-volume-bar\s*\{[^}]*max-width:\s*200px\s*!important/);
    assert.match(stylesCss, /\.tvk-volume-bar\s*\{[^}]*justify-content:\s*center\s*!important/);
    assert.match(stylesCss, /\.tv-karaoke \.slim::-webkit-slider-thumb\s*\{[^}]*width:\s*4px\s*!important/);
  });

  await t.test('4. Top right button overlap removed: #btn-tvk-lyrics is hidden, settings and fs cleanly positioned', () => {
    assert.match(stylesCss, /#btn-tvk-lyrics\s*\{[^}]*display:\s*none\s*!important/);
    assert.match(stylesCss, /#btn-tvk-settings\s*\{[^}]*right:\s*152px\s*!important/);
    assert.match(stylesCss, /#btn-tvk-fs\s*\{[^}]*right:\s*92px\s*!important/);
    assert.match(stylesCss, /\.tv-karaoke-close\s*\{[^}]*right:\s*32px\s*!important/);
  });

  await t.test('5. Lyrics: stale lyrics cleared immediately on load and titles verified during LRCLIB search', () => {
    // loadSyncedLyrics clears innerHTML
    assert.match(appJs, /async function loadSyncedLyrics\(title, artist, token\) \{\s*if \(el\.lyricsContainer\) \{\s*el\.lyricsContainer\.innerHTML = '';/);
    // renderLyricsView clears innerHTML
    assert.match(appJs, /function renderLyricsView\(\) \{\s*if \(!el\.lyricsContainer\) return;\s*el\.lyricsContainer\.innerHTML = '';/);
    // updateSyncedLyricsHighlight toggles .on class matching prototype
    assert.match(appJs, /lineEl\.classList\.toggle\('on', isCur\);/);
    // routes/music.js has matchTitle logic
    assert.match(routesMusicJs, /const matchTitle = \(r, target\) =>/);
  });
});
