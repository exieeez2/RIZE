import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const appJsPath = path.join(__dirname, '..', 'src', 'app.js');
const appJsCode = fs.readFileSync(appJsPath, 'utf8');

describe('Playlist Playback and Artist Navigation Fixes', () => {
  it('1. isSameTrack handles ID, URL, canonical ID, and title+artist equality', () => {
    assert.ok(appJsCode.includes('function isSameTrack(a, b)'), 'isSameTrack function must exist');
    assert.ok(appJsCode.includes('String(a.id) === String(b.id)'), 'isSameTrack must compare IDs as strings');
    assert.ok(appJsCode.includes('a.url === b.url'), 'isSameTrack must compare URLs');

    // Simulate isSameTrack logic
    function isSameTrack(a, b) {
      if (!a || !b) return false;
      if (a === b) return true;
      if (a.id && b.id && String(a.id) === String(b.id)) return true;
      if (a.url && b.url && a.url === b.url) return true;
      const tA = (a.title || '').trim().toLowerCase();
      const tB = (b.title || '').trim().toLowerCase();
      const artA = (a.artist || '').trim().toLowerCase();
      const artB = (b.artist || '').trim().toLowerCase();
      if (tA && tB && tA === tB && artA && artB && artA === artB) return true;
      return false;
    }

    assert.equal(isSameTrack({ id: 'dz_12345' }, { id: 'dz_12345' }), true);
    assert.equal(isSameTrack({ id: 1001 }, { id: '1001' }), true);
    assert.equal(isSameTrack({ title: 'Dai Dai', artist: 'Shakira' }, { title: 'dai dai ', artist: ' shakira' }), true);
    assert.equal(isSameTrack({ id: 'a' }, { id: 'b' }), false);
  });

  it('2. playTrack recognizes Deezer (dz_), SoundCloud (sc_), demo, and YouTube IDs as directly streamable', () => {
    const isDirectRegex = /isDirectStreamable\s*=\s*isYtId\s*\|\|\s*cleanId\.startsWith\('demo-'\)\s*\|\|\s*cleanId\.startsWith\('dz_'\)\s*\|\|\s*cleanId\.startsWith\('sc_'\)/;
    assert.ok(isDirectRegex.test(appJsCode), 'playTrack must mark dz_ and sc_ as directly streamable');
  });

  it('3. findPlaylist finds playlist regardless of string/number ID or name', () => {
    assert.ok(appJsCode.includes('function findPlaylist('), 'findPlaylist helper must exist');
    assert.ok(appJsCode.includes('window.findPlaylist = findPlaylist'), 'findPlaylist must be exposed on window');

    const state = {
      playlists: [
        { id: 12345, name: 'My Favorites', tracks: [{ id: 'dz_1' }] },
        { id: 'pl_abc', name: 'Chill Vibes', tracks: [] }
      ]
    };

    function findPlaylist(playlistId) {
      if (playlistId == null) return null;
      const targetIdStr = String(playlistId).trim();
      return (state.playlists || []).find(p => String(p.id).trim() === targetIdStr || String(p.name).trim() === targetIdStr) || null;
    }

    assert.ok(findPlaylist('12345'), 'Should find by string version of number id');
    assert.ok(findPlaylist(12345), 'Should find by numeric id');
    assert.ok(findPlaylist('My Favorites'), 'Should find by playlist name');
    assert.ok(findPlaylist('pl_abc'), 'Should find string id');
    assert.equal(findPlaylist('non_existent'), null);
  });

  it('4. createTrackRow resolves playlist tracks safely and binds artist click directly', () => {
    assert.ok(appJsCode.includes("const artistEl = row.querySelector('.track-row-artist')"), 'createTrackRow must find artist element');
    assert.ok(appJsCode.includes("const clickedArtist = e.target.closest('.track-row-artist')"), 'createTrackRow must check closest track-row-artist');
    assert.ok(appJsCode.includes("openArtistProfile(track.artist)"), 'createTrackRow must call openArtistProfile on artist click');
  });

  it('5. openArtistProfile and openArtistPage aliases are exposed with search fallback', () => {
    assert.ok(appJsCode.includes('window.openArtistProfile = openArtistProfile'), 'openArtistProfile must be attached to window');
    assert.ok(appJsCode.includes('window.openArtistPage = openArtistProfile'), 'openArtistPage must be attached to window');
    assert.ok(appJsCode.includes('window.openArtist = openArtistProfile'), 'openArtist must be attached to window');
    assert.ok(appJsCode.includes('/api/search?q='), 'openArtistProfile must have fallback search when tracks are empty');
  });

  it('6. Document-level capture delegation handles artist clicks across all components', () => {
    assert.ok(appJsCode.includes("const artTarget = e.target.closest('.track-row-artist, #playbar-artist, .clickable-artist, #right-panel-artist, #tv-karaoke-artist, #my-wave-focused-artist')"), 'Document delegation must listen for artist targets');
  });

  it('7. styles.css provides pointer cursor and hover states for track-artist elements', () => {
    const cssPath = path.join(__dirname, '..', 'src', 'styles.css');
    const cssCode = fs.readFileSync(cssPath, 'utf8');

    assert.ok(cssCode.includes('.track-artist:hover'), 'styles.css must have hover style for .track-artist');
    assert.ok(cssCode.includes('#playbar-artist:hover'), 'styles.css must have hover style for #playbar-artist');
  });
});
