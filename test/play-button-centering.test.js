const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

test('Play button triangle optical centering and right shift', () => {
  const root = path.join(__dirname, '..');
  const stylesCss = fs.readFileSync(path.join(root, 'src/styles.css'), 'utf8');
  const indexHtml = fs.readFileSync(path.join(root, 'src/index.html'), 'utf8');

  // 1. Bottom playbar play button triangle has subtle optical right-shift of 1.2px
  assert.match(
    stylesCss,
    /\.btn-play-pause\s+#play-icon,\s*\n\.btn-play-pause\s+\.play-icon\s*\{[\s\S]*?transform:\s*translateX\(1\.2px\)\s*!important/
  );

  // 2. Fullscreen / TV Karaoke play button triangle has optical right-shift
  assert.match(
    stylesCss,
    /\.tvk-controls\s+\.btn-play-pause\s+svg\s*\{[\s\S]*?transform:\s*translateX\(1px\)\s*!important/
  );

  // 3. Profile overlay favorite track play button triangle has optical right-shift
  assert.match(
    stylesCss,
    /#profile-overlay\s+\.m3p-fav-play-btn\s+svg\s*\{[\s\S]*?transform:\s*translateX\(1px\)\s*!important/
  );

  // 4. Profile playlists desktop cards play button triangle has optical right-shift
  assert.match(
    stylesCss,
    /#profile-overlay\s+\.pc-pl-play-btn\s+svg\s*\{[\s\S]*?transform:\s*translateX\(1px\)\s*!important/
  );

  // 5. Profile overlay inline svg in index.html is synchronized
  assert.match(
    indexHtml,
    /<button class="m3p-fav-play-btn" id="profile-fav-track-play-btn" title="Слушать" type="button">\s*<svg[^>]*style="transform:\s*translateX\(1px\);"/
  );
});
