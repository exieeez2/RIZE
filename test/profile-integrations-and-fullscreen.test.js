const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

test('Profile: Settings button removal, fullscreen player on pinned track, and integrations display', () => {
  const root = path.join(__dirname, '..');
  const indexHtml = fs.readFileSync(path.join(root, 'src/index.html'), 'utf8');
  const clientJs = fs.readFileSync(path.join(root, 'src/firebase-client.js'), 'utf8');
  const stylesCss = fs.readFileSync(path.join(root, 'src/styles.css'), 'utf8');

  // 1. Settings buttons removed from profile
  assert.equal(indexHtml.includes('id="profile-settings-btn"'), false, 'profile-settings-btn must be removed');
  assert.equal(indexHtml.includes('id="profile-edit-settings-btn"'), false, 'profile-edit-settings-btn must be removed');

  // 2. Pinned track play action closes profile and triggers fullscreen player
  assert.match(
    clientJs,
    /const playAction = \(e\) => \{[\s\S]*?window\.playTrack\(track\);[\s\S]*?closeProfile\(\);[\s\S]*?window\.openTvKaraoke\(true\);/
  );
  // Pinned track content card is clickable with cursor pointer
  assert.match(
    clientJs,
    /contentEl\.onclick = playAction;/
  );
  assert.match(
    clientJs,
    /contentEl\.style\.cursor = 'pointer';/
  );

  // 3. Other user pinned track also transitions to fullscreen player
  assert.match(
    clientJs,
    /window\.playTrack\(user\.favTrack\);[\s\S]*?closeUserProfile\(\);[\s\S]*?window\.openTvKaraoke\(true\);/
  );

  // 4. Integrations preservation in state and Firestore
  assert.match(clientJs, /effTg = d\.tg !== undefined \? d\.tg : \(cur\.tg \|\| ''\);/);
  assert.match(clientJs, /effDs = d\.ds !== undefined \? d\.ds : \(cur\.ds \|\| ''\);/);
  assert.match(clientJs, /effSite = d\.site !== undefined \? d\.site : \(cur\.site \|\| ''\);/);

  // 5. Integrations display in profile: HTML containers exist
  assert.ok(indexHtml.includes('id="profile-chips"'), 'profile-chips container must exist in hero');
  assert.ok(indexHtml.includes('id="profile-v1-integrations-section"'), 'profile-v1-integrations-section must exist in body');
  assert.ok(indexHtml.includes('id="profile-v1-integrations-list"'), 'profile-v1-integrations-list must exist');

  // 6. Integrations UI rendering logic exists for TG, DS, SITE
  assert.match(clientJs, /https:\/\/t\.me\/\$\{encodeURIComponent\(tgClean\)\}/);
  assert.match(clientJs, /pv1-int-tg/);
  assert.match(clientJs, /pv1-int-ds/);
  assert.match(clientJs, /pv1-int-site/);
  assert.match(clientJs, /Discord скопирован/);

  // 7. Styles exist for integrations row, cards, chips, and SVG color
  assert.match(stylesCss, /#profile-overlay \.m3p-chips/);
  assert.match(stylesCss, /#profile-overlay \.chip/);
  assert.match(stylesCss, /#profile-overlay \.pv1-integrations-row/);
  assert.match(stylesCss, /#profile-overlay \.pv1-int-card/);
  assert.match(stylesCss, /#profile-overlay \.pv1-int-tg/);
  assert.match(stylesCss, /#profile-overlay \.pv1-int-ds/);
  assert.match(stylesCss, /#profile-overlay \.pv1-int-site/);
  assert.match(stylesCss, /#profile-overlay \.chip-tg svg/);
  assert.match(stylesCss, /#profile-overlay \.chip-ds svg/);
});
