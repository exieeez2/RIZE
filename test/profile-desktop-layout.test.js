const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

test('Profile desktop and responsive layout sizing and constraints', () => {
  const root = path.join(__dirname, '..');
  const stylesCss = fs.readFileSync(path.join(root, 'src/styles.css'), 'utf8');
  const indexHtml = fs.readFileSync(path.join(root, 'src/index.html'), 'utf8');
  const clientJs = fs.readFileSync(path.join(root, 'src/firebase-client.js'), 'utf8');

  // 1. Profile container has max-width and clean centering
  assert.match(
    stylesCss,
    /#profile-overlay\s+\.pv-container\s*\{[\s\S]*?max-width:\s*1200px\s*!important/
  );

  // 2. Profile topbar aligned inside container
  assert.match(
    stylesCss,
    /#profile-overlay\s+\.top\s*\{[\s\S]*?display:\s*flex\s*!important;/
  );

  // 3. Settings buttons are removed from profile topbars
  assert.ok(!indexHtml.includes('id="profile-settings-btn"'), 'profile-settings-btn should not be present in profile-v1');
  assert.ok(!indexHtml.includes('id="profile-edit-settings-btn"'), 'profile-edit-settings-btn should not be present in profile-v2');

  // 4. Pinned track play action closes profile and opens fullscreen player
  assert.match(
    clientJs,
    /closeProfile\(\);[\s\S]*?openTvKaraoke\(true\);/
  );

  // 5. Integrations section exists in HTML
  assert.ok(indexHtml.includes('id="profile-v1-integrations-section"'), 'profile-v1-integrations-section must exist');
  assert.ok(indexHtml.includes('id="profile-v1-integrations-list"'), 'profile-v1-integrations-list must exist');

  // 6. Integrations cards and chips styled cleanly in styles.css
  assert.match(
    stylesCss,
    /#profile-overlay\s+\.pv1-integrations-row\s*\{/
  );
  assert.match(
    stylesCss,
    /#profile-overlay\s+\.pv1-int-card\s*\{/
  );
  assert.match(
    stylesCss,
    /#profile-overlay\s+\.chip-tg\s+svg/
  );
  assert.match(
    stylesCss,
    /#profile-overlay\s+\.chip-ds\s+svg/
  );

  // 7. Client JS preserves and renders tg, ds, site integrations
  assert.match(clientJs, /profile-v1-integrations-list/);
  assert.match(clientJs, /pv1-int-tg/);
  assert.match(clientJs, /pv1-int-ds/);
  assert.match(clientJs, /pv1-int-site/);
});
