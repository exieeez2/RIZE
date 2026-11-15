const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('Fullscreen / TV Karaoke Player Material 3 Layout Verification', async (t) => {
  const stylesPath = path.join(__dirname, '..', 'src', 'styles.css');
  const styles = fs.readFileSync(stylesPath, 'utf8');

  await t.test('1. Two-column grid layout for fullscreen player (340px min card, 1.5fr lyrics)', () => {
    assert.match(
      styles,
      /\.tv-karaoke-layout\s*\{[^}]*grid-template-columns:\s*minmax\(340px,\s*1fr\)\s*1\.5fr/
    );
  });

  await t.test('2. Left player card .tv-side is proportional and centered (max-width: 420px)', () => {
    assert.match(
      styles,
      /\.tv-side\s*\{[^}]*max-width:\s*420px/
    );
  });

  await t.test('2b. Cover artwork is prominent and unconstrained (max-width: 340px, aspect-ratio 1)', () => {
    assert.match(
      styles,
      /\.tv-cover-container\s*\{[^}]*max-width:\s*340px/
    );
    assert.match(
      styles,
      /\.tv-cover-container\s*\{[^}]*aspect-ratio:\s*1/
    );
  });

  await t.test('3. When lyrics are active, .tv-karaoke-content gets vertical fade mask', () => {
    assert.match(
      styles,
      /\.tv-karaoke-content\s*\{[^}]*-webkit-mask-image:\s*linear-gradient\(transparent,\s*#000\s*16%,\s*#000\s*84%,\s*transparent\)/
    );
  });

  await t.test('4. Player-centered mode (lyrics hidden) remains properly centered in column mode', () => {
    assert.match(
      styles,
      /\.tv-karaoke\.tv-player-centered\s+\.tv-karaoke-layout[^}]*\{[^}]*flex-direction:\s*column\s*!important/
    );
  });

  await t.test('5. Opening fullscreen player from cover defaults to showing lyrics', () => {
    const appPath = path.join(__dirname, '..', 'src', 'app.js');
    const app = fs.readFileSync(appPath, 'utf8');
    assert.match(app, /coverContainerEl\.addEventListener\('click'[\s\S]*?openTvKaraoke\(true\)/);
    assert.match(app, /if \(forceShowLyrics === true \|\| forceShowLyrics === undefined\)/);
  });
});
