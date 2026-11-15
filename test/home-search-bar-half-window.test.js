const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('Home Screen Search Bar Length & Half-Window Responsiveness', async (t) => {
  const stylesPath = path.join(__dirname, '..', 'src', 'styles.css');
  const appPath = path.join(__dirname, '..', 'src', 'app.js');

  const styles = fs.readFileSync(stylesPath, 'utf8');
  const app = fs.readFileSync(appPath, 'utf8');

  await t.test('1. Default --engine-w in :root and @property is 0px so no ghost space shrinks search bar', () => {
    assert.match(styles, /@property\s+--engine-w\s*\{[^}]*initial-value:\s*0px;/);
    assert.match(styles, /:root\s*\{[^}]*--engine-w:\s*0px;/);
  });

  await t.test('2. .search-box-wrapper expands up to 640px without artificial 200px clamp', () => {
    assert.match(styles, /\.search-box-wrapper\s*\{[^}]*width:\s*min\(640px/);
    assert.match(styles, /\.search-box-wrapper\s*\{[^}]*max-width:\s*640px/);
  });

  await t.test('3. In half-window (< 860px) search bar remains long (up to 580px, not capped at 380px)', () => {
    assert.match(styles, /@media\s*\(max-width:\s*860px\)[\s\S]*?\.search-box-wrapper\s*\{[^}]*width:\s*min\(580px/);
    assert.match(styles, /@media\s*\(max-width:\s*860px\)[\s\S]*?\.search-box-wrapper\s*\{[^}]*max-width:\s*580px/);
  });

  await t.test('4. updateEngineWidthVar resets --engine-w to 0px if engine container is absent', () => {
    assert.match(app, /function updateEngineWidthVar\(\)\s*\{[\s\S]*?if \(!container\)\s*\{[\s\S]*?--engine-w',\s*'0px'/);
  });
});
