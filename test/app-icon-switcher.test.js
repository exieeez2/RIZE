const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

test('App Icon: Assets and Fixed Crimson Default Integrity', () => {
  const root = path.join(__dirname, '..');
  const indexHtml = fs.readFileSync(path.join(root, 'src/index.html'), 'utf8');
  const stylesCss = fs.readFileSync(path.join(root, 'src/styles.css'), 'utf8');
  const appJs = fs.readFileSync(path.join(root, 'src/app.js'), 'utf8');
  const mainJs = fs.readFileSync(path.join(root, 'main.js'), 'utf8');
  const preloadJs = fs.readFileSync(path.join(root, 'preload.js'), 'utf8');

  // 1. Verify all 5 variants + default exist on disk
  const iconVariants = ['crimson', 'mono', 'mint', 'lime', 'violet', 'default'];
  for (const variant of iconVariants) {
    const iconFile = path.join(root, 'src/assets/icons', `icon-${variant}.png`);
    assert.ok(fs.existsSync(iconFile), `Icon file icon-${variant}.png must exist`);
    const stat = fs.statSync(iconFile);
    assert.ok(stat.size > 1000, `Icon file icon-${variant}.png must have valid non-empty size`);
  }

  // 2. Icon picker was removed from settings; the icon is fixed to Crimson
  assert.doesNotMatch(
    indexHtml,
    /id="setting-app-icon-row"/,
    'Settings must not contain the icon picker row'
  );
  assert.doesNotMatch(indexHtml, /id="app-icon-grid"/, 'Settings must not contain the icon grid');
  assert.match(stylesCss, /\.app-icon-card/, 'Icon card styles stay available');

  // 3. Verify JS switching logic and the fixed Crimson default
  assert.match(appJs, /const APP_ICONS\s*=/);
  assert.match(appJs, /function applyAppIcon/);
  assert.match(appJs, /votify_app_icon/);
  assert.match(appJs, /window\.applyAppIcon\s*=\s*applyAppIcon/);
  assert.match(appJs, /applyAppIcon\('crimson'\)/, 'App must apply the Crimson icon by default');

  // 4. Verify IPC bindings in electron
  assert.match(mainJs, /ipcMain\.handle\('set-app-icon'/);
  assert.match(preloadJs, /setAppIcon:\s*iconName/);
});
