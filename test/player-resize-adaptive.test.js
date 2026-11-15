const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.join(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

test('Right panel has container-type inline-size configured', () => {
  const css = read('src/styles.css');
  assert.match(css, /\.right-panel\s*\{[^}]*container-type:\s*inline-size/);
  assert.match(css, /\.right-panel\s*\{[^}]*container-name:\s*rightpanel/);
});

test('Right panel top buttons adapt across compact, normal, and wide modes', () => {
  const css = read('src/styles.css');

  // Compact mode (< 320px): buttons scale down to 21px, pill 25px, label hidden
  assert.match(css, /\.right-panel\.panel-compact \.right-panel-tool-pill/);
  assert.match(css, /@container rightpanel \(max-width:\s*319px\)/);
  assert.match(css, /\.right-panel\.panel-compact[^{]*\.lyrics-action-btn\s*\{[^}]*width:\s*21px/);
  assert.match(css, /\.right-panel\.panel-compact #btn-close-right-panel\s*\{[^}]*width:\s*24px/);

  // Wide mode (>= 450px): buttons scale up to 27-30px, pill 32px, label visible
  assert.match(css, /\.right-panel\.panel-wide \.right-panel-label/);
  assert.match(css, /@container rightpanel \(min-width:\s*450px\)/);
  assert.match(css, /\.right-panel\.panel-wide[^{]*\.lyrics-action-btn\s*\{[^}]*width:\s*27px/);
  assert.match(css, /\.right-panel\.panel-wide #btn-close-right-panel\s*\{[^}]*width:\s*30px/);

  // No invalid selector comma container queries
  assert.doesNotMatch(css, /,\s*@container/);
});

test('app.js initializes panel resize and handles adaptive classes on drag and window resize', () => {
  const js = read('src/app.js');

  assert.match(js, /function initPanelResize\(\)/);
  assert.match(js, /panel\.classList\.toggle\('panel-compact',\s*numW < 320\)/);
  assert.match(js, /panel\.classList\.toggle\('panel-normal',\s*numW >= 320 && numW < 450\)/);
  assert.match(js, /panel\.classList\.toggle\('panel-wide',\s*numW >= 450\)/);
  assert.match(js, /window\.addEventListener\('resize',\s*\(\)\s*=>/);
});

test('Responsive styles adapt top navigation and fullscreen player top buttons', () => {
  const css = read('src/styles.css');

  assert.match(css, /@media \(max-width:\s*860px\)[\s\S]*\.top-nav-settings-btn/);
  assert.match(css, /@media \(max-width:\s*640px\)[\s\S]*\.tv-karaoke-close/);
});

test('Cover and artwork box are horizontally centered when player is widened', () => {
  const css = read('src/styles.css');

  assert.match(css, /\.right-panel-artwork-box\s*\{[\s\S]*margin:\s*0\s*auto[\s\S]*width:\s*100%/);
  assert.match(css, /\.cover-container\s*\{[\s\S]*margin:\s*0\s*auto/);
  assert.match(css, /\.right-panel\.lyrics-empty \.right-panel-artwork-box\s*\{[\s\S]*margin:\s*auto\s*auto\s*!important/);
  assert.match(css, /\.right-panel\.panel-wide \.right-panel-artwork-box[\s\S]*margin:\s*0\s*auto\s*!important/);
  assert.match(css, /\.right-panel\.panel-wide \.cover-container[\s\S]*margin:\s*0\s*auto\s*!important/);
});


test('Fullscreen player has centered cover and playback controls in player mode and half-window', () => {
  const css = read('src/styles.css');
  const html = read('src/index.html');
  const js = read('src/app.js');

  // Fullscreen player has lyrics toggle button in index.html
  assert.match(html, /id="btn-tvk-lyrics"/);

  // app.js handles setTvLyricsVisible and opens player on cover click
  assert.match(js, /function setTvLyricsVisible/);
  assert.match(js, /tv\.classList\.toggle\('tv-player-centered'/);
  assert.match(js, /openTvKaraoke\(true\)/);

  // tv-player-centered centers layout and hides lyrics
  assert.match(css, /\.tv-karaoke\.tv-player-centered \.tv-karaoke-content/);
  assert.match(css, /\.tv-karaoke\.tv-player-centered \.tv-karaoke-layout[\s\S]*flex-direction:\s*column !important/);
  assert.match(css, /\.tv-karaoke\.tv-player-centered \.tv-karaoke-layout[\s\S]*align-items:\s*center !important/);
  assert.match(css, /\.tv-karaoke\.tv-player-centered \.tv-side[\s\S]*margin:\s*0 auto !important/);
  assert.match(css, /\.tv-karaoke\.tv-player-centered \.tvk-controls[\s\S]*justify-content:\s*center !important/);

  // Responsive half-window mode (up to 1024px) centers layout
  assert.match(css, /@media \(max-width:\s*1024px\)[\s\S]*\.tv-karaoke-layout[\s\S]*flex-direction:\s*column !important/);
  assert.match(css, /@media \(max-width:\s*1024px\)[\s\S]*\.tv-side[\s\S]*margin:\s*0 auto !important/);
});
