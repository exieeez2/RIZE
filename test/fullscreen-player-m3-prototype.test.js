const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('Material 3 Fullscreen Player Prototype Match Verification', async (t) => {
  const root = path.join(__dirname, '..');
  const indexHtml = fs.readFileSync(path.join(root, 'src/index.html'), 'utf8');
  const stylesCss = fs.readFileSync(path.join(root, 'src/styles.css'), 'utf8');
  const appJs = fs.readFileSync(path.join(root, 'src/app.js'), 'utf8');

  await t.test('1. Floating ambient mesh background exists with blur and floating animation', () => {
    assert.match(indexHtml, /<div class="bg" id="tvk-ambient-bg"><i><\/i><i><\/i><i><\/i><\/div>/);
    assert.match(stylesCss, /\.tv-karaoke \.bg i\s*\{[^}]*filter:\s*blur\(110px\)/);
    assert.match(stylesCss, /@keyframes tvk-float/);
  });

  await t.test('2. Top right action buttons have .fs frosted glass squircle style', () => {
    assert.match(indexHtml, /id="btn-tvk-fs"/);
    assert.match(indexHtml, /id="btn-tvk-settings"/);
    assert.match(indexHtml, /id="btn-close-tv-karaoke"/);
    assert.match(stylesCss, /\.tv-karaoke \.fs,\s*\n\.tv-karaoke \.tv-karaoke-close\s*\{[^}]*width:\s*48px\s*!important/);
    assert.match(stylesCss, /\.tv-karaoke \.fs,\s*\n\.tv-karaoke \.tv-karaoke-close\s*\{[^}]*border-radius:\s*16px\s*!important/);
  });

  await t.test('3. Large prominent album cover with aspect-ratio 1 and 24px radius', () => {
    assert.match(stylesCss, /\.tv-cover-container\s*\{[^}]*border-radius:\s*24px\s*!important/);
    assert.match(stylesCss, /\.tv-cover-container\s*\{[^}]*aspect-ratio:\s*1\s*!important/);
    assert.match(stylesCss, /\.tv-cover-container\s*\{[^}]*max-width:\s*340px\s*!important/);
  });

  await t.test('4. Material 3 Seek Bar with 16px high rounded track and tabular timestamps', () => {
    assert.match(indexHtml, /id="tvk-seek"/);
    assert.match(stylesCss, /\.tv-karaoke input\[type=range\]::-webkit-slider-runnable-track\s*\{[^}]*height:\s*16px\s*!important/);
    assert.match(stylesCss, /\.tv-karaoke input\[type=range\]::-webkit-slider-thumb\s*\{[^}]*height:\s*28px\s*!important/);
    assert.match(stylesCss, /\.tv-karaoke \.t\s*\{[^}]*font-variant-numeric:\s*tabular-nums\s*!important/);
  });

  await t.test('5. Material 3 Playback Controls: 64x56 tonal buttons and 104x72 morphing play button', () => {
    assert.match(stylesCss, /\.tvk-controls \.tonal\s*\{[^}]*width:\s*64px\s*!important/);
    assert.match(stylesCss, /\.tvk-controls \.tonal\s*\{[^}]*height:\s*56px\s*!important/);
    assert.match(stylesCss, /\.tvk-controls \.play\s*\{[^}]*width:\s*104px\s*!important/);
    assert.match(stylesCss, /\.tvk-controls \.play\s*\{[^}]*height:\s*72px\s*!important/);
    assert.match(stylesCss, /\.tvk-controls \.play\.on,\s*\n\.tvk-controls \.play\.playing\s*\{[^}]*border-radius:\s*22px\s*!important/);
  });

  await t.test('6. Material 3 Volume bar with slim range track and mute control', () => {
    assert.match(indexHtml, /id="tvk-volume-slider"/);
    assert.match(stylesCss, /\.tv-karaoke \.slim::-webkit-slider-runnable-track\s*\{[^}]*height:\s*8px\s*!important/);
  });

  await t.test('7. Settings panel has font, alignment, size, weight, line spacing, animation, speed, toggles, and reset', () => {
    assert.match(indexHtml, /id="tvk-panel"/);
    assert.match(indexHtml, /id="tvk-font"/);
    assert.match(indexHtml, /id="tvk-sa"/);
    assert.match(indexHtml, /id="tvk-size"/);
    assert.match(indexHtml, /id="tvk-weight"/);
    assert.match(indexHtml, /id="tvk-gap"/);
    assert.match(indexHtml, /id="tvk-sn"/);
    assert.match(indexHtml, /id="tvk-speed"/);
    assert.match(indexHtml, /id="tvk-v1"/);
    assert.match(indexHtml, /id="tvk-v2"/);
    assert.match(indexHtml, /id="btn-tvk-reset"/);
  });

  await t.test('8. Fullscreen button and settings toggles are wired in app.js', () => {
    assert.match(appJs, /btnTvkFs\.addEventListener\('click'/);
    assert.match(appJs, /requestFullscreen/);
    assert.match(appJs, /tvkSeekInput\.addEventListener\('input'/);
  });
});
