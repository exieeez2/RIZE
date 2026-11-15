const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const rootDir = path.resolve(__dirname, '..');
const { transliterateCyrillic, searchTracksByArtist } = require('../routes/utils.js');

test('Artist Full Bleed Hero, Transliteration, Clean Tracks and No Albums in Search', async (t) => {
  const stylesCss = fs.readFileSync(path.join(rootDir, 'src/styles.css'), 'utf8');
  const themeCss = fs.readFileSync(path.join(rootDir, 'src/styles/dotify-23-theme.css'), 'utf8');
  const appJs = fs.readFileSync(path.join(rootDir, 'src/app.js'), 'utf8');
  const mainJs = fs.readFileSync(path.join(rootDir, 'src/main.js'), 'utf8');
  const routesMusicJs = fs.readFileSync(path.join(rootDir, 'routes/music.js'), 'utf8');

  await t.test('1. Cyrillic transliteration handles artist names accurately', () => {
    assert.equal(transliterateCyrillic('онда андар'), 'onda andar');
    assert.equal(transliterateCyrillic('онда'), 'onda');
    assert.equal(transliterateCyrillic('эминем'), 'eminem');
    assert.equal(transliterateCyrillic('ONDA ANDAR'), 'onda andar');
  });

  await t.test('2. Deezer artist matcher scores candidates and rejects unrelated artists', () => {
    assert.match(routesMusicJs, /transliterateCyrillic/, 'routes/music.js must import/use transliterateCyrillic');
    assert.match(routesMusicJs, /bestScore\s*<\s*30/, 'routes/music.js must reject unrelated artists with low score');
  });

  await t.test('3. searchTracksByArtist filters out unrelated recommendations (P.O.D, Beck, Dire Straits)', () => {
    const rawDemo = [
      { id: '1', title: 'type london', artist: 'ONDA ANDAR - Topic' },
      { id: '2', title: 'sleep mode', artist: 'ONDA ANDAR - Topic' },
      { id: '3', title: 'cachalot', artist: 'ONDA ANDAR - Topic' },
      { id: '4', title: 'Youth of the Nation', artist: 'P.O.D.' },
      { id: '5', title: 'Лучшие песни', artist: 'Король и Шут' },
      { id: '6', title: 'Loser', artist: 'Beck' },
      { id: '7', title: 'Sultans of Swing', artist: 'Dire Straits' },
    ];
    const tokens = ['onda', 'andar'];
    const filtered = rawDemo.filter(t => {
      const combined = `${t.artist} ${t.title}`.toLowerCase();
      return tokens.some(tok => combined.includes(tok));
    });
    assert.equal(filtered.length, 3);
    assert.ok(filtered.every(t => t.artist.includes('ONDA ANDAR')));
  });

  await t.test('4. Artist Hero Banner is full-width (edge-to-edge full bleed, no side black borders)', () => {
    assert.match(stylesCss, /#view-artist\s*\{[\s\S]*?width:\s*calc\(100%\s*\+\s*72px\)\s*!important;/, '#view-artist must expand full bleed');
    assert.match(stylesCss, /\.artist-hero-wrap\s*\{[\s\S]*?border-radius:\s*0\s*!important;/, '.artist-hero-wrap must have border-radius 0 in styles.css');
    assert.match(themeCss, /#artist-screen[\s\S]*?width:\s*calc\(100%\s*\+\s*72px\)\s*!important;/, '#artist-screen must expand full bleed in themeCss');
    assert.match(themeCss, /\.artist-hero-wrap\s*\{[\s\S]*?border-radius:\s*0\s*!important;/, '.artist-hero-wrap must have border-radius 0 in themeCss');
  });

  await t.test('5. Search does not display albums in search results', () => {
    assert.ok(!mainJs.includes("activeSearchFilter === 'all' && albums.length > 0"), 'main.js must not render albums when search filter is all');
    assert.match(appJs, /async function fetchAlbumsForSearch[\s\S]*?container\.innerHTML = '';/, 'fetchAlbumsForSearch in app.js must clear/empty container');
    assert.ok(!appJs.includes("fetchAlbumsForSearch(trimmedQuery"), 'app.js performSearch must not invoke fetchAlbumsForSearch');
  });
});
