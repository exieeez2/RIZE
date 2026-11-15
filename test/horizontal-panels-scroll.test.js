const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('Horizontal panels and carousel scrolling integrity', async (t) => {
  const stylesPath = path.join(__dirname, '..', 'src', 'styles.css');
  const appJsPath = path.join(__dirname, '..', 'src', 'app.js');

  const styles = fs.readFileSync(stylesPath, 'utf8');
  const appJs = fs.readFileSync(appJsPath, 'utf8');

  await t.test('1. home-hero-track and home-pane are laid out horizontally with translateX animation', () => {
    // Check .home-hero-track has flex-direction: row
    assert.match(styles, /\.home-hero-track\s*\{[^}]*flex-direction:\s*row;/);

    // Check .home-out uses translateX
    assert.match(styles, /\.home-out\s*\{[^}]*transform:\s*translateX\(/);

    // Check @keyframes homeInAnim uses translateX
    assert.match(styles, /@keyframes\s+homeInAnim\s*\{[^}]*translateX\(/);

    // Check .home-hero-dots are positioned horizontally (bottom + translateX)
    assert.match(styles, /\.home-hero-dots\s*\{[^}]*flex-direction:\s*row;/);
    assert.match(styles, /\.home-hero-dots\s*\{[^}]*bottom:\s*12px;/);
  });

  await t.test('2. Settings panels animate horizontally with translateX (settingsInX)', () => {
    // Check .settings-section animation uses settingsInX
    assert.match(styles, /\.settings-section:not\(\.cat-hidden\)\s*\{[^}]*animation:\s*settingsInX/);
    assert.match(styles, /@keyframes\s+settingsInX\s*\{[^}]*translateX\(/);
  });

  await t.test('3. app.js binds horizontal wheel and supports horizontal category switching', () => {
    // Check bindHorizontalWheel handles scrollBy left
    assert.match(appJs, /bindHorizontalWheel/);
    assert.match(appJs, /scrollBy\(\{\s*left:\s*delta/);

    // Check initAllHorizontalScrollContainers binds to #settings-nav
    assert.match(appJs, /initAllHorizontalScrollContainers/);
    assert.match(appJs, /#settings-nav/);

    // Check switchSettingsCategory exists and showSettingsCategory computes direction
    assert.match(appJs, /switchSettingsCategory/);
    assert.match(appJs, /--settings-shift-x/);
  });
});
