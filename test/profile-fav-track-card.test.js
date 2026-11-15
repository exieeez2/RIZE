import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test('Profile favorite track card: gradient background and white play button', async (t) => {
  const root = path.join(__dirname, '..');
  const stylesCss = fs.readFileSync(path.join(root, 'src/styles.css'), 'utf8');
  const firebaseClientJs = fs.readFileSync(path.join(root, 'src/firebase-client.js'), 'utf8');
  const indexHtml = fs.readFileSync(path.join(root, 'src/index.html'), 'utf8');

  await t.test('1. Favorite track card has gradient background and refined rounded styling', () => {
    // Both user profile card and other user card have linear-gradient and var(--pin-bg)
    assert.match(
      stylesCss,
      /#profile-fav-track-content[\s\S]*?background:\s*var\(--pin-bg,\s*linear-gradient\(135deg,/,
      'profile-fav-track-content must use linear-gradient via --pin-bg fallback'
    );
    assert.match(
      stylesCss,
      /\.pc-fav-track-row\s*\{[\s\S]*?background:\s*var\(--pin-bg,\s*linear-gradient\(135deg,/,
      'pc-fav-track-row must use linear-gradient via --pin-bg fallback'
    );
    assert.match(stylesCss, /#profile-fav-track-content[\s\S]*?border-radius:\s*28px/);
  });

  await t.test('2. Play button is circular, brilliant white with filled black play icon', () => {
    // Buttons must have background #ffffff and 50% border radius
    assert.match(
      stylesCss,
      /#profile-fav-track-play-btn[\s\S]*?background:\s*#ffffff\s*!important/,
      'Play button must have white background'
    );
    assert.match(
      stylesCss,
      /#profile-fav-track-play-btn[\s\S]*?border-radius:\s*50%\s*!important/,
      'Play button must have 50% circular border radius'
    );

    // SVG polygon inside play button must be filled black with no outline
    assert.match(
      stylesCss,
      /#profile-fav-track-play-btn svg polygon[\s\S]*?fill:\s*#000000\s*!important/,
      'SVG play triangle must be solid black'
    );
    assert.match(
      stylesCss,
      /#profile-fav-track-play-btn svg polygon[\s\S]*?stroke:\s*none\s*!important/,
      'SVG play triangle must not have stroke outline'
    );
  });

  await t.test('3. applyFavTrackCoverBackground applies gradient and supports presets', () => {
    assert.match(
      firebaseClientJs,
      /const PRESET_TRACK_GRADIENTS = \{[\s\S]*?'sleep mode':\s*'linear-gradient/,
      'Must define preset gradient for sleep mode'
    );
    assert.match(
      firebaseClientJs,
      /function applyFavTrackCoverBackground\(rowEl,\s*coverUrl,\s*track\)/,
      'applyFavTrackCoverBackground must accept rowEl, coverUrl, and track'
    );
    assert.match(
      firebaseClientJs,
      /rowEl\.style\.setProperty\('--pin-bg',\s*gradient\)/,
      'Must set --pin-bg CSS property on target element'
    );
  });

  await t.test('4. renderFavTrack correctly binds profile-fav-track-content element', () => {
    assert.match(
      firebaseClientJs,
      /const cardTarget = contentEl \|\| sec\.querySelector\('\.pin'\) \|\| sec\.querySelector\('\.pc-fav-track-row'\);/,
      'renderFavTrack must find contentEl or .pin or .pc-fav-track-row'
    );
    assert.match(
      firebaseClientJs,
      /applyFavTrackCoverBackground\(cardTarget,\s*track\.cover,\s*track\);/,
      'renderFavTrack must invoke applyFavTrackCoverBackground with cardTarget and track'
    );
  });

  await t.test('5. HTML markup contains the pinned favorite track section and play button', () => {
    assert.match(indexHtml, /id="profile-fav-track-section"/);
    assert.match(indexHtml, /id="profile-fav-track-content"/);
    assert.match(indexHtml, /id="profile-fav-track-play-btn"/);
  });
});
