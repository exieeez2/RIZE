const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('Home Pane Header Adaptive Layout & Zero Overlap Verification', async (t) => {
  const stylesPath = path.join(__dirname, '..', 'src', 'styles.css');
  const indexPath = path.join(__dirname, '..', 'src', 'index.html');
  const i18nPath = path.join(__dirname, '..', 'src', 'i18n.js');
  const appPath = path.join(__dirname, '..', 'src', 'app.js');

  const styles = fs.readFileSync(stylesPath, 'utf8');
  const indexHtml = fs.readFileSync(indexPath, 'utf8');
  const i18n = fs.readFileSync(i18nPath, 'utf8');
  const app = fs.readFileSync(appPath, 'utf8');

  await t.test('1. .home-hero container-type inline-size is configured for responsive query containment', () => {
    assert.match(styles, /\.home-hero\s*\{[^}]*container-type:\s*inline-size/);
  });

  await t.test('2. .home-pane-header positions elements to the sides (space-between) to eliminate overlap bug', () => {
    assert.match(styles, /\.home-pane-header\s*\{[^}]*justify-content:\s*space-between/);
    assert.match(styles, /\.home-pane-header\s*\{[^}]*display:\s*flex/);
  });

  await t.test('3. .home-pane-header .my-wave-actions is on the right side', () => {
    assert.match(styles, /\.home-pane-header\s+\.my-wave-actions\s*\{[^}]*margin:\s*0\s+0\s+0\s+auto/);
    assert.match(styles, /\.home-pane-header\s+\.my-wave-actions\s*\{[^}]*position:\s*static/);
  });

  await t.test('4. .home-pane-label is aligned to the left and protected against text overflow', () => {
    assert.match(styles, /\.home-pane-label\s*\{[^}]*margin-right:\s*auto/);
    assert.match(styles, /\.home-pane-label\s*\{[^}]*text-overflow:\s*ellipsis/);
    assert.match(styles, /\.home-pane-label\s*\{[^}]*white-space:\s*nowrap/);
  });

  await t.test('5. Play button retains its text without being hidden by display: none', () => {
    assert.doesNotMatch(styles, /@container\s+home-hero\s*\(max-width:\s*680px\)[\s\S]*?\.my-wave-actions\s+#btn-play-my-wave\s+span\s*\{[^}]*display:\s*none/);
    assert.doesNotMatch(styles, /@media\s*\(max-width:\s*768px\)[\s\S]*?\.my-wave-actions\s+#btn-play-my-wave\s+span\s*\{[^}]*display:\s*none/);
  });

  await t.test('6. #btn-play-my-wave has full accessibility and tooltip attributes', () => {
    assert.match(indexHtml, /id="btn-play-my-wave"[^>]*title="Play wave"/);
    assert.match(indexHtml, /id="btn-play-my-wave"[^>]*data-i18n-title="home\.playWave"/);
    assert.match(indexHtml, /id="btn-play-my-wave"[^>]*aria-label="Play wave"/);
    assert.match(indexHtml, /id="btn-play-my-wave"[^>]*data-i18n-aria="home\.playWave"/);
  });

  await t.test('7. i18n dictionary supports home.recommendations in English and Russian', () => {
    assert.match(i18n, /'home\.recommendations':\s*'Recommendations'/);
    assert.match(i18n, /'home\.recommendations':\s*'Рекомендации'/);
  });

  await t.test('8. app.js dynamically sets localized titles and listens for language change events', () => {
    assert.match(app, /t\('home\.recommendations'\)/);
    assert.match(app, /t\('home\.jumpBack'\)/);
    assert.match(app, /t\('home\.myWave'\)/);
    assert.match(app, /rize:langchange/);
  });
});
