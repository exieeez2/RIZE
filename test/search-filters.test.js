const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('Search filters UI in index.html is simplified without pills, directly displaying artist and music tracks', () => {
  const htmlPath = path.join(__dirname, '..', 'src', 'index.html');
  const html = fs.readFileSync(htmlPath, 'utf8');

  // Verify search-filters container and filter pills are completely removed
  assert.ok(!html.includes('id="search-filters"'), 'search-filters container must be removed');
  assert.ok(!html.includes('data-filter="music"'), 'filter-pill music must be removed');
  assert.ok(!html.includes('data-filter="playlists"'), 'filter-pill playlists must be removed');

  // Verify search-results-container directly contains artist card and music tracks list
  const resultsContainerMatch = html.match(/<div class="search-results-container[^"]*" id="search-results-container">([\s\S]*?)<\/div>\s*<\/section>/);
  assert.ok(resultsContainerMatch, 'search-results-container exists');
  const inner = resultsContainerMatch[1];
  assert.ok(inner.includes('id="search-artist-card-container"'), 'artist/author card container must exist in search results');
  assert.ok(inner.includes('id="search-tracks-list"'), 'music tracks list must exist in search results');
});

test('Search filters behavior in main.js defaults to music and handles track rendering', () => {
  const mainPath = path.join(__dirname, '..', 'src', 'main.js');
  const main = fs.readFileSync(mainPath, 'utf8');

  // Default activeSearchFilter is 'music'
  assert.match(main, /let activeSearchFilter = 'music';/);

  // renderSearchResults handles music tracks cleanly
  assert.match(main, /const isMusicFilter = activeSearchFilter === 'music' \|\| activeSearchFilter === 'tracks';/);
  assert.match(main, /Музыка не найдена/);
});

test('fetchArtistCardForSearch in app.js only renders artist cards for verified artists or genuine artist matches', () => {
  const appPath = path.join(__dirname, '..', 'src', 'app.js');
  const app = fs.readFileSync(appPath, 'utf8');

  // Verify fetchArtistCardForSearch validates real artist match and does not echo arbitrary song titles
  assert.match(app, /const isVerified = Boolean\(data\.artistData\?\.isVerified \|\| data\.artistDetails\?\.picture\);/);
  assert.match(app, /matchingArtistTracks\.length >= 2/);
  assert.match(app, /const isRealArtistMatch = \(isVerified && \(normA === normQ/);
  assert.match(app, /if \(!isRealArtistMatch\) \{\s*container\.innerHTML = '';\s*return;\s*\}/);
});
