import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test('Fullscreen Player theme tokens and heavily blurred cover background verification', async (t) => {
  const root = path.join(__dirname, '..');
  const stylesCss = fs.readFileSync(path.join(root, 'src/styles.css'), 'utf8');
  const indexHtml = fs.readFileSync(path.join(root, 'src/index.html'), 'utf8');
  const appJs = fs.readFileSync(path.join(root, 'src/app.js'), 'utf8');

  await t.test('1. Fullscreen player uses application Material 3 system tokens for colors', () => {
    // Check .tv-karaoke variables resolve to app tokens
    assert.match(stylesCss, /--pri:\s*var\(--md-sys-color-primary/);
    assert.match(stylesCss, /--on-pri:\s*var\(--md-sys-color-on-primary/);
    assert.match(stylesCss, /--sec-c:\s*var\(--md-sys-color-secondary-container/);
    assert.match(stylesCss, /--on-sec-c:\s*var\(--md-sys-color-on-secondary-container/);
  });

  await t.test('2. Heavily blurred and darkened album cover background with cross-fade', () => {
    // Backdrop is displayed with 90px blur, brightness(0.6), and darkened opacity over app background
    assert.match(stylesCss, /#tv-bg\s*\{[^}]*display:\s*block\s*!important/);
    assert.match(stylesCss, /\.tv-bg-layer\s*\{[^}]*filter:\s*blur\(90px\)\s*brightness\(0\.6\)\s*saturate\(1\.25\)/);
    assert.match(stylesCss, /\.tv-bg-layer\.active\s*\{[^}]*opacity:\s*calc\(var\(--cover-bg-brightness,\s*0\.45\)\s*\*\s*0\.75\)\s*!important/);
    assert.match(stylesCss, /\.tv-bg::after\s*\{[^}]*display:\s*none\s*!important/);
    // Ambient gradient mesh orbs are hidden
    assert.match(stylesCss, /#tvk-ambient-bg\s*\{[^}]*display:\s*none\s*!important/);
    // syncTvBanner and applyTvKaraokeCoverTheme are exported and wired
    assert.match(appJs, /function syncTvBanner\(forcedCoverUrl\)/);
    assert.match(appJs, /function applyTvKaraokeCoverTheme\(coverUrl\)/);
    assert.match(appJs, /window\.applyTvKaraokeCoverTheme = applyTvKaraokeCoverTheme;/);
  });

  await t.test('3. Controls, seek bar, and volume slider use standard primary color', () => {
    // Play button uses --pri / --md-sys-color-primary
    assert.match(stylesCss, /\.tvk-controls \.play\s*\{[^}]*background:\s*var\(--pri,/);
    assert.match(stylesCss, /\.tvk-controls \.btn-play-pause\s*\{[^}]*background:\s*var\(--pri,/);
    // Prev / Next tonal buttons use --sec-c
    assert.match(stylesCss, /\.tvk-controls \.tonal\s*\{[^}]*background:\s*var\(--sec-c,/);
    // Seek bar track fill and thumb use --pri
    assert.match(stylesCss, /\.tv-karaoke input\[type=range\]::-webkit-slider-runnable-track\s*\{[^}]*var\(--pri,/);
    assert.match(stylesCss, /\.tv-karaoke input\[type=range\]::-webkit-slider-thumb\s*\{[^}]*background:\s*var\(--pri,/);
    // Volume slider track fill and thumb use --pri
    assert.match(stylesCss, /\.tv-karaoke \.slim::-webkit-slider-runnable-track\s*\{[^}]*var\(--pri,/);
    assert.match(stylesCss, /\.tv-karaoke \.slim::-webkit-slider-thumb\s*\{[^}]*background:\s*var\(--pri,/);
  });

  await t.test('4. Timeline bar and volume bar have centered margins, volume bar is shorter (200px)', () => {
    // Timeline bar styling
    assert.match(stylesCss, /\.tvk-timeline-bar\s*\{[^}]*max-width:\s*320px\s*!important/);
    assert.match(stylesCss, /\.tvk-timeline-bar\s*\{[^}]*margin:\s*4px auto 0 auto\s*!important/);
    assert.match(stylesCss, /\.tvk-timeline-bar\s*\{[^}]*display:\s*flex\s*!important/);
    assert.match(stylesCss, /\.tvk-timeline-bar\s*\{[^}]*flex-direction:\s*column\s*!important/);

    // Volume bar styling - shorter width
    assert.match(stylesCss, /\.tvk-volume-bar\s*\{[^}]*max-width:\s*200px\s*!important/);
    assert.match(stylesCss, /\.tvk-volume-bar\s*\{[^}]*margin:\s*2px auto 0 auto\s*!important/);
    assert.match(stylesCss, /\.tvk-volume-bar\s*\{[^}]*justify-content:\s*center\s*!important/);

    // Centered / no-lyrics mode
    assert.match(stylesCss, /\.tv-karaoke\.tv-player-centered \.tvk-timeline-bar,[^}]*max-width:\s*320px\s*!important/);
    assert.match(stylesCss, /\.tv-karaoke\.tv-player-centered \.tvk-volume-bar,[^}]*max-width:\s*200px\s*!important/);

    // No leftover clamp duplicate that broke 50% width windows
    assert.doesNotMatch(stylesCss, /\.tvk-timeline-bar\s*\{[^}]*max-width:\s*clamp\(260px,\s*24vw/);
  });

  await t.test('5. Symmetrical volume icons ensure volume slider track is centered with seek bar', () => {
    // Both left mute button and right speaker icon have 32px footprint
    assert.match(stylesCss, /\.tvk-volume-bar \.tvk-icon-btn\s*\{[^}]*width:\s*32px\s*!important/);
    assert.match(stylesCss, /\.tvk-volume-bar > svg:last-child\s*\{[^}]*width:\s*32px\s*!important/);
  });

  await t.test('6. Mini-player volume slider matches fullscreen slim style (8px track, 4x20px vertical thumb)', () => {
    assert.match(stylesCss, /#volume-slider::-webkit-slider-runnable-track\s*\{[^}]*height:\s*8px\s*!important/);
    assert.match(stylesCss, /#volume-slider::-webkit-slider-thumb\s*\{[^}]*width:\s*4px\s*!important/);
    assert.match(stylesCss, /#volume-slider::-webkit-slider-thumb\s*\{[^}]*height:\s*20px\s*!important/);
    assert.match(stylesCss, /#volume-slider::-webkit-slider-thumb\s*\{[^}]*margin-top:\s*-6px\s*!important/);
    assert.match(stylesCss, /#volume-slider::-webkit-slider-thumb\s*\{[^}]*border-radius:\s*2px\s*!important/);
  });

  await t.test('7. Cover artwork shadow is unclipped (.tv-side overflow: visible, smooth dual shadow)', () => {
    assert.match(stylesCss, /\.tv-side\s*\{[^}]*overflow:\s*visible\s*!important/);
    assert.match(stylesCss, /\.tv-side \.head\s*\{[^}]*overflow:\s*visible\s*!important/);
    assert.match(stylesCss, /\.tv-cover-container\s*\{[^}]*box-shadow:\s*0 16px 36px/);
  });

  await t.test('8. UI transparency persistence across restart and custom backgrounds', () => {
    // onBackgroundChanged must not clobber user opacity
    assert.match(appJs, /function onBackgroundChanged\(kind, enabled\)\s*\{[^}]*return;/);
    // sliderUiAlpha initializes from saved localStorage
    assert.match(appJs, /const savedUiAlpha = localStorage\.getItem\('riff_ui_alpha'\)/);
    // enhanceSliders preserves range input value during DOM moves
    assert.match(appJs, /const currentVal = input\.value;/);
    // Profile overlay honors --ui-alpha
    assert.match(stylesCss, /\.pc-profile-overlay\s*\{[^}]*color-mix\(in srgb, var\(--sl, #121316\) var\(--ui-alpha, 100%\), transparent\)/);
    assert.match(stylesCss, /#profile-overlay\s*\{[^}]*color-mix\(in srgb, var\(--bg\) var\(--ui-alpha, 100%\), transparent\)/);
  });

  await t.test('9. Fullscreen player is 100% opaque to prevent main window from showing through', () => {
    // Both .tv-karaoke and #tv-bg must have solid opaque background
    assert.match(stylesCss, /\.tv-karaoke\s*\{[^}]*background:\s*#080a0e\s*!important/);
    assert.match(stylesCss, /#tv-bg\s*\{[^}]*background:\s*#080a0e\s*!important/);
    // Underlying main window elements are hidden while player is open
    assert.match(stylesCss, /body\.tv-karaoke-open\s+\.app-layout,[^}]*visibility:\s*hidden\s*!important/);
    assert.match(appJs, /document\.body\.classList\.add\('tv-karaoke-open'\)/);
    assert.match(appJs, /document\.body\.classList\.remove\('tv-karaoke-open'\)/);
  });

  await t.test('10. Fullscreen lyrics visualization appearance matches side player', () => {
    // Distance blur and opacity falloff
    assert.match(stylesCss, /\.tv-karaoke-content \.lyric-line\s*\{[^}]*opacity:\s*max\(\.25,\s*calc\(1\s*-\s*var\(--dist,\s*0\)\s*\*\s*\.2\)\)\s*!important/);
    assert.match(stylesCss, /\.tv-karaoke-content \.lyric-line\s*\{[^}]*filter:\s*blur\(calc\(min\(var\(--dist,\s*0\),\s*4\)\s*\*\s*\.8px\)\)\s*!important/);
    // Active line scale and highlight
    assert.match(stylesCss, /\.tv-karaoke-content \.lyric-line\.active,\s*\n\.tv-karaoke-content \.lyric-line\.on\s*\{[^}]*transform:\s*scale\(1\.04\)\s*!important/);
    // Word-by-word karaoke active word highlight
    assert.match(stylesCss, /\.tv-karaoke-content \.lyric-line \.lyric-word\.active-word\s*\{[^}]*color:\s*var\(--pri,/);
    // Gradient line fill support
    assert.match(stylesCss, /\.tv-karaoke-content \.lyric-line\.gradient-line \.lyric-fill\s*\{[^}]*-webkit-background-clip:\s*text\s*!important/);
    // Smooth distance bokeh animation override
    assert.match(stylesCss, /\.tv-karaoke\[data-tvk-anim="smooth"\] \.lyric-line\s*\{[^}]*opacity:\s*max\(\.25,\s*calc\(1\s*-\s*var\(--dist,\s*0\)\s*\*\s*\.2\)\)\s*!important/);
  });
});
