const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

test('Search track duration parsing, makeTrack normalization, and formatDuration formatting', () => {
  const root = path.join(__dirname, '..');
  const utilsCode = fs.readFileSync(path.join(root, 'routes/utils.js'), 'utf8');
  const appJsCode = fs.readFileSync(path.join(root, 'src/app.js'), 'utf8');
  const mainJsCode = fs.readFileSync(path.join(root, 'src/main.js'), 'utf8');
  const indexHtml = fs.readFileSync(path.join(root, 'src/index.html'), 'utf8');

  // 1. Verify parseDurationToSeconds helper exists in routes/utils.js
  assert.match(utilsCode, /function parseDurationToSeconds\(val\)/);

  // Eval parseDurationToSeconds, extractFeaturingArtists and makeTrack in isolated scope for testing logic
  const parseMatch = utilsCode.match(/function parseDurationToSeconds\([\s\S]*?\n\}/);
  assert.ok(parseMatch, 'parseDurationToSeconds function found');
  const featMatch = utilsCode.match(/function extractFeaturingArtists\([\s\S]*?\n\}/);
  const makeTrackMatch = utilsCode.match(/function makeTrack\([\s\S]*?\n\}/);
  assert.ok(makeTrackMatch, 'makeTrack function found');

  const fn = new Function(`${parseMatch[0]}; ${featMatch ? featMatch[0] : ''}; ${makeTrackMatch[0]}; return { parseDurationToSeconds, makeTrack };`);
  const { parseDurationToSeconds, makeTrack } = fn();

  // Test parseDurationToSeconds
  assert.equal(parseDurationToSeconds('3:45'), 225);
  assert.equal(parseDurationToSeconds('03:45'), 225);
  assert.equal(parseDurationToSeconds('0:30'), 30);
  assert.equal(parseDurationToSeconds('1:02:03'), 3723);
  assert.equal(parseDurationToSeconds(180), 180);
  assert.equal(parseDurationToSeconds('180'), 180);
  assert.equal(parseDurationToSeconds(null), 0);
  assert.equal(parseDurationToSeconds(undefined), 0);
  assert.equal(parseDurationToSeconds('invalid'), 0);

  // Test makeTrack creates duration properly
  const t1 = makeTrack('vid123', 'My Song', 'My Artist', 'cover.jpg', '4:15');
  assert.equal(t1.duration, 255);
  assert.equal(t1.title, 'My Song');
  assert.equal(t1.artist, 'My Artist');

  const t2 = makeTrack('vid456', 'Short Clip', 'Artist B', '', 45);
  assert.equal(t2.duration, 45);

  // 2. Verify formatDuration in src/app.js handles numbers, string times, and optional fallback
  const formatDurMatch = appJsCode.match(/function formatDuration\(sec[\s\S]*?\n  \}/);
  assert.ok(formatDurMatch, 'formatDuration function found in app.js');
  const appFormatFn = new Function(`${formatDurMatch[0]}; return formatDuration;`)();

  assert.equal(appFormatFn(225), '3:45');
  assert.equal(appFormatFn('3:45'), '3:45');
  assert.equal(appFormatFn(45), '0:45');
  assert.equal(appFormatFn(0), '0:00');
  assert.equal(appFormatFn(0, ''), '');
  assert.equal(appFormatFn(null, ''), '');
  assert.equal(appFormatFn(undefined, ''), '');

  // 3. Verify formatTime in src/main.js
  const formatTimeMatch = mainJsCode.match(/function formatTime\(secs\) \{[\s\S]*?\n\}/);
  assert.ok(formatTimeMatch, 'formatTime function found in main.js');
  const mainFormatFn = new Function(`${formatTimeMatch[0]}; return formatTime;`)();

  assert.equal(mainFormatFn(225), '3:45');
  assert.equal(mainFormatFn('3:45'), '3:45');
  assert.equal(mainFormatFn(45), '0:45');
  assert.equal(mainFormatFn(0), '0:00');

  // 4. Verify duplicate settings button removal
  assert.ok(!indexHtml.includes('id="tb-settings-btn"'), 'Top duplicate tb-settings-btn must be removed');
  assert.ok(indexHtml.includes('id="nav-settings"'), 'Sidebar nav-settings must remain as sole settings button');

  // 5. Verify settings navigation categories exist in index.html and app.js
  const expectedCats = ['interface', 'theme', 'background', 'tracks', 'integrations', 'about'];
  for (const cat of expectedCats) {
    assert.ok(
      indexHtml.includes(`data-cat="${cat}"`),
      `Category ${cat} must be present in settings navigation / sections`
    );
  }
  const removedCats = ['banners', 'storage', 'advanced', 'custom-themes', 'plugins'];
  for (const cat of removedCats) {
    assert.ok(
      !indexHtml.includes(`data-cat="${cat}"`),
      `Category ${cat} must be removed from settings navigation / sections`
    );
  }
});
