const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

describe('Cloud & Local Playlists Sync into Library and Sidebar Pins', () => {
  it('src/app.js resolves TDZ declarations in ingestCloudPlaylists and ingestCloudSyncBlob', () => {
    const appPath = path.join(__dirname, '..', 'src/app.js');
    const code = fs.readFileSync(appPath, 'utf8');

    // Ensure plTracks is declared before delSet check in Array loop
    const arrayLoopMatch = code.match(/function\s+ingestCloudPlaylists\s*\([\s\S]*?if\s*\(Array\.isArray\(rawPlaylists\)\)\s*\{([\s\S]*?)\}\s*else\s*\{/);
    assert.ok(arrayLoopMatch, 'Array branch of ingestCloudPlaylists must exist');
    const arrayLoopCode = arrayLoopMatch[1];
    const plTracksDeclIdx = arrayLoopCode.indexOf('const plTracks = Array.isArray(pl.tracks)');
    const plDelCheckIdx = arrayLoopCode.indexOf('if (delSet.has(plName))');
    assert.ok(plTracksDeclIdx !== -1, 'const plTracks must be declared in Array branch');
    assert.ok(plDelCheckIdx !== -1, 'delSet check must exist');
    assert.ok(plTracksDeclIdx < plDelCheckIdx, 'const plTracks must be declared BEFORE delSet.has(plName) check to prevent TDZ ReferenceError');

    // Ensure rawTracks is declared before delSet check in Object loop
    const objLoopMatch = code.match(/function\s+ingestCloudPlaylists\s*\([\s\S]*?\}\s*else\s*\{([\s\S]*?)\}\s*if\s*\(modified\)/);
    assert.ok(objLoopMatch, 'Object branch of ingestCloudPlaylists must exist');
    const objLoopCode = objLoopMatch[1];
    const rawTracksDeclIdx = objLoopCode.indexOf('const rawTracks = Array.isArray(val)');
    const rawDelCheckIdx = objLoopCode.indexOf('if (delSet.has(key))');
    assert.ok(rawTracksDeclIdx !== -1, 'const rawTracks must be declared in Object branch');
    assert.ok(rawDelCheckIdx !== -1, 'delSet check in object branch must exist');
    assert.ok(rawTracksDeclIdx < rawDelCheckIdx, 'const rawTracks must be declared BEFORE delSet.has(key) check to prevent TDZ ReferenceError');

    // Ensure ingestCloudPlaylists always calls updatePlaylistsUI()
    assert.ok(code.includes('updatePlaylistsUI();'), 'ingestCloudPlaylists must call updatePlaylistsUI');
  });

  it('src/app.js defines mergeLocalLegacyPlaylists and imports votify-playlists on startup and auth change', () => {
    const appPath = path.join(__dirname, '..', 'src/app.js');
    const code = fs.readFileSync(appPath, 'utf8');

    assert.ok(code.includes('function mergeLocalLegacyPlaylists()'), 'mergeLocalLegacyPlaylists must be defined');
    assert.ok(code.includes('localStorage.getItem(\'votify-playlists\')'), 'must read votify-playlists from localStorage');
    assert.ok(code.includes('mergeLocalLegacyPlaylists();'), 'mergeLocalLegacyPlaylists must be invoked on startup');

    // Ensure votify:auth-changed triggers mergeLocalLegacyPlaylists and updatePlaylistsUI
    const authChangedMatch = code.match(/window\.addEventListener\('votify:auth-changed'[\s\S]*?\}\);/);
    assert.ok(authChangedMatch, 'votify:auth-changed listener must exist');
    assert.ok(authChangedMatch[0].includes('mergeLocalLegacyPlaylists()'), 'votify:auth-changed must call mergeLocalLegacyPlaylists');
    assert.ok(authChangedMatch[0].includes('updatePlaylistsUI()'), 'votify:auth-changed must call updatePlaylistsUI');
  });

  it('src/app.js updatePlaylistsUI unconditionally invokes renderSidebarPins and renderLibraryPlaylists', () => {
    const appPath = path.join(__dirname, '..', 'src/app.js');
    const code = fs.readFileSync(appPath, 'utf8');

    // updatePlaylistsUI must explicitly call renderSidebarPins and renderLibraryPlaylists
    const updateUiMatch = code.match(/function\s+updatePlaylistsUI\s*\(\)\s*\{([\s\S]*?)\}/);
    assert.ok(updateUiMatch, 'updatePlaylistsUI function must exist');
    assert.ok(updateUiMatch[1].includes('renderPlaylistsList();'), 'must call renderPlaylistsList');
    assert.ok(updateUiMatch[1].includes('renderSidebarPins();'), 'must call renderSidebarPins');
    assert.ok(updateUiMatch[1].includes('renderLibraryPlaylists();'), 'must call renderLibraryPlaylists');

    // renderPlaylistsList must not early-return before calling renderSidebarPins and renderLibraryPlaylists
    const renderPlListMatch = code.match(/function\s+renderPlaylistsList\s*\(\)\s*\{([\s\S]*?)\n\s*function\s+promptDeletePlaylist/);
    assert.ok(renderPlListMatch, 'renderPlaylistsList must exist');
    assert.ok(renderPlListMatch[1].includes('renderSidebarPins();'), 'renderPlaylistsList must call renderSidebarPins');
    assert.ok(renderPlListMatch[1].includes('renderLibraryPlaylists();'), 'renderPlaylistsList must call renderLibraryPlaylists');
  });

  it('src/firebase-client.js pulls playlists from userDoc and profDoc and keeps window.state.playlists synced', () => {
    const fbPath = path.join(__dirname, '..', 'src/firebase-client.js');
    const code = fs.readFileSync(fbPath, 'utf8');

    // pullState checks userDoc.data().playlists and profDoc.data().playlists
    const pullMatch = code.match(/async\s+function\s+pullState\s*\(\)\s*\{([\s\S]*?)\n\s*return\s*\{/);
    assert.ok(pullMatch, 'pullState must exist');
    const pullCode = pullMatch[1];
    assert.ok(pullCode.includes('firestoreProfileRef(user.uid).get()'), 'pullState must fetch firestoreProfileRef doc');
    assert.ok(pullCode.includes('userDoc.data()?.playlists'), 'pullState must inspect userDoc.data().playlists');
    assert.ok(pullCode.includes('profDoc.data()?.playlists'), 'pullState must inspect profDoc.data().playlists');

    // getAppPlaylists syncs realPlaylists into window.state.playlists and devsize_playlists
    const getAppPlMatch = code.match(/const\s+getAppPlaylists\s*=\s*\(\)\s*=>\s*\{([\s\S]*?)\n\s*const\s+renderPlCards/);
    assert.ok(getAppPlMatch, 'getAppPlaylists must exist');
    const getAppPlCode = getAppPlMatch[1];
    assert.ok(getAppPlCode.includes('profile.playlists'), 'getAppPlaylists must inspect profile.playlists');
    assert.ok(getAppPlCode.includes('window.state.playlists.push'), 'getAppPlaylists must sync to window.state.playlists');
    assert.ok(getAppPlCode.includes('devsize_playlists'), 'getAppPlaylists must save to devsize_playlists');
    assert.ok(getAppPlCode.includes('updatePlaylistsUI'), 'getAppPlaylists must trigger updatePlaylistsUI');
  });

  it('functional test: simulated cloud ingestion and local legacy import populate state.playlists without TDZ error', () => {
    // Set up mock DOM and localStorage
    const storage = new Map();
    global.localStorage = {
      getItem: (k) => (storage.has(k) ? storage.get(k) : null),
      setItem: (k, v) => storage.set(k, String(v)),
      removeItem: (k) => storage.delete(k),
      clear: () => storage.clear()
    };

    const state = {
      playlists: [],
      favorites: [],
      currentView: 'discover',
      currentPlaylistId: null
    };

    // Prepopulate devsize_deleted_playlists to test TDZ revival resilience
    storage.set('devsize_deleted_playlists', JSON.stringify(['Synthwave Hits']));

    // Prepopulate legacy votify-playlists
    storage.set('votify-playlists', JSON.stringify({
      'Classic Rock': [
        { id: 't1', title: 'Bohemian Rhapsody', artist: 'Queen', cover: 'https://example.com/queen.jpg' }
      ]
    }));

    function safeArray(key) {
      try {
        const val = JSON.parse(global.localStorage.getItem(key) || '[]');
        return Array.isArray(val) ? val : [];
      } catch (_) { return []; }
    }

    function mergeLocalLegacyPlaylists() {
      let modified = false;
      const rawAlt = global.localStorage.getItem('votify-playlists');
      if (rawAlt) {
        const alt = JSON.parse(rawAlt);
        if (alt && typeof alt === 'object' && !Array.isArray(alt)) {
          Object.keys(alt).forEach(key => {
            const val = alt[key];
            const trks = Array.isArray(val) ? val : (val && Array.isArray(val.tracks) ? val.tracks : []);
            let found = state.playlists.find(p => p.name === key);
            if (!found) {
              state.playlists.push({
                id: 'pl_' + key,
                name: key,
                tracks: trks,
                cover: (val && val.cover) || (trks[0] && trks[0].cover) || ''
              });
              modified = true;
            }
          });
        }
      }
      return modified;
    }

    function ingestCloudPlaylists(rawPlaylists) {
      if (!rawPlaylists || typeof rawPlaylists !== 'object') return false;
      let modified = false;
      const delSet = new Set(safeArray('devsize_deleted_playlists'));

      if (Array.isArray(rawPlaylists)) {
        rawPlaylists.forEach(pl => {
          if (!pl || !pl.name) return;
          const plName = pl.name.trim();
          const plTracks = Array.isArray(pl.tracks) ? pl.tracks : [];
          if (delSet.has(plName)) {
            if (plTracks.length > 0) {
              delSet.delete(plName);
              global.localStorage.setItem('devsize_deleted_playlists', JSON.stringify([...delSet]));
            } else {
              return;
            }
          }
          let found = state.playlists.find(p => p.name === plName);
          if (!found) {
            found = { id: pl.id || 'pl_' + plName, name: plName, tracks: [], cover: pl.cover || '' };
            state.playlists.push(found);
            modified = true;
          }
          plTracks.forEach(t => {
            found.tracks.push(t);
            modified = true;
          });
        });
      }
      return modified;
    }

    // 1. Run mergeLocalLegacyPlaylists
    const legacyMerged = mergeLocalLegacyPlaylists();
    assert.equal(legacyMerged, true);
    assert.equal(state.playlists.length, 1);
    assert.equal(state.playlists[0].name, 'Classic Rock');
    assert.equal(state.playlists[0].tracks.length, 1);

    // 2. Ingest cloud playlists with a revived previously-deleted playlist without TDZ error
    assert.doesNotThrow(() => {
      const cloudPayload = [
        {
          name: 'Synthwave Hits',
          tracks: [{ id: 'sw1', title: 'Resonance', artist: 'HOME' }]
        },
        {
          name: 'Chill Vibes',
          tracks: [{ id: 'cv1', title: 'Night Owl', artist: 'Galimatias' }]
        }
      ];
      ingestCloudPlaylists(cloudPayload);
    }, 'ingestCloudPlaylists must not throw TDZ ReferenceError');

    assert.equal(state.playlists.length, 3);
    const names = state.playlists.map(p => p.name);
    assert.ok(names.includes('Classic Rock'), 'Should include legacy playlist');
    assert.ok(names.includes('Synthwave Hits'), 'Should include revived cloud playlist');
    assert.ok(names.includes('Chill Vibes'), 'Should include new cloud playlist');

    // Verify deleted set was cleaned up for revived playlist
    const updatedDelSet = new Set(safeArray('devsize_deleted_playlists'));
    assert.equal(updatedDelSet.has('Synthwave Hits'), false, 'Revived playlist should be deleted from devsize_deleted_playlists');
  });
});
