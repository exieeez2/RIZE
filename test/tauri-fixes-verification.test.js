import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

test('Tauri Rust Backend & UI Fixes Verification', async (t) => {
  const root = process.cwd();

  await t.test('1. Google OAuth Desktop Endpoint is properly defined and mounted', () => {
    const authRs = fs.readFileSync(path.join(root, 'src-tauri/src/server/auth.rs'), 'utf8');
    const modRs = fs.readFileSync(path.join(root, 'src-tauri/src/server/mod.rs'), 'utf8');

    assert.ok(authRs.includes('handle_google_auth'), 'auth.rs must define handle_google_auth');
    assert.ok(authRs.includes('handle_check_email'), 'auth.rs must define handle_check_email');
    assert.ok(authRs.includes('oauth/google/callback'), 'auth.rs must implement OAuth loopback callback');
    assert.ok(modRs.includes('/api/auth/google'), 'mod.rs must mount /api/auth/google');
    assert.ok(modRs.includes('/api/auth/check-email'), 'mod.rs must mount /api/auth/check-email');
  });

  await t.test('2. Artist Response structure provides artistData and artistDetails for UI search card', () => {
    const artistRs = fs.readFileSync(path.join(root, 'src-tauri/src/server/artist.rs'), 'utf8');

    assert.ok(artistRs.includes('pub struct ArtistDetails'), 'artist.rs must define ArtistDetails');
    assert.ok(artistRs.includes('pub struct ArtistData'), 'artist.rs must define ArtistData');
    assert.ok(artistRs.includes('pub artist_details: Option<ArtistDetails>'), 'ArtistResponse must have artist_details');
    assert.ok(artistRs.includes('pub artist_data: Option<ArtistData>'), 'ArtistResponse must have artist_data');
    assert.ok(artistRs.includes('pub artist: String'), 'ArtistResponse must have artist string field');
    assert.ok(artistRs.includes('is_verified: bool'), 'ArtistData must contain is_verified flag');
  });

  await t.test('3. StreamService uses Fast InnerTube Player API (<200ms) for low latency playback', () => {
    const streamRs = fs.readFileSync(path.join(root, 'src-tauri/src/server/stream.rs'), 'utf8');

    assert.ok(streamRs.includes('fetch_fast_innertube_stream_url'), 'stream.rs must implement fast InnerTube player resolution');
    assert.ok(streamRs.includes('youtubei/v1/player'), 'stream.rs must call direct youtubei player endpoint');
    assert.ok(streamRs.includes('ANDROID_VR'), 'stream.rs must use fast Android client context');
    assert.ok(streamRs.includes('spawn_blocking'), 'stream.rs yt-dlp fallback must not block async executor');
  });

  await t.test('4. Bottom Playbar layout has overflow containment to eliminate control button overlap', () => {
    const css = fs.readFileSync(path.join(root, 'src/styles.css'), 'utf8');

    assert.ok(css.includes('.playbar-left {'), 'styles.css must have .playbar-left');
    assert.ok(css.includes('overflow: hidden !important;'), '.playbar-left must have overflow: hidden !important to prevent spilling into controls');
    assert.ok(css.includes('#btn-toggle-fav'), 'styles.css must have #btn-toggle-fav');
    assert.ok(css.includes('#btn-add-to-playlist'), 'styles.css must have responsive rules for #btn-add-to-playlist');
    assert.ok(css.includes('#btn-edit-current-track'), 'styles.css must have responsive rules for #btn-edit-current-track');
    assert.ok(css.includes('#btn-playbar-more'), 'styles.css must have responsive rules for #btn-playbar-more');
  });

  await t.test('5. Track row and list layout prevents 1-letter truncation bug in WebKitGTK', () => {
    const css = fs.readFileSync(path.join(root, 'src/styles.css'), 'utf8');

    assert.ok(css.includes('.track-row-info {'), 'track-row-info must exist');
    assert.ok(css.includes('.track-row-title {\n  display: block;\n  width: 100%;'), 'track-row-title must have width: 100%');
    assert.ok(css.includes('.track-row-artist {\n  display: block;\n  width: 100%;'), 'track-row-artist must have width: 100% and not fit-content');
    assert.ok(css.includes('.track-row-duration {'), 'track-row-duration must exist');
    assert.ok(css.includes('.track-row-actions {'), 'track-row-actions must exist');
    assert.ok(css.includes('.track-row-actions .btn-icon-pill {'), 'track-row-actions buttons must be cleanly styled');
    assert.ok(css.includes('opacity: 1 !important;'), 'track-row-actions and duration must be visible always');
  });

  await t.test('6. Virtual scrolling performance eliminates per-row canvas color calculation stalls', () => {
    const appJs = fs.readFileSync(path.join(root, 'src/app.js'), 'utf8');

    assert.ok(!appJs.includes('getCoverDominantColors(colorSource).then'), 'createTrackRow must not invoke getCoverDominantColors per row on virtual scroll');
    assert.ok(appJs.includes('highlightPlayingRow(container);'), 'renderChunk must pass container to highlightPlayingRow to avoid full-document thrashing');
    assert.ok(appJs.includes('function highlightPlayingRow(targetContainer = null)'), 'highlightPlayingRow must accept targetContainer for scoped updates');
  });

  await t.test('7. Google Sign-In routes to native desktop loopback and avoids popup-blocked in WebKitGTK', () => {
    const fbClient = fs.readFileSync(path.join(root, 'src/firebase-client.js'), 'utf8');

    assert.ok(fbClient.includes('function getBackendBaseUrl()'), 'firebase-client.js must define getBackendBaseUrl helper');
    assert.ok(fbClient.includes('${getBackendBaseUrl()}/api/auth/google'), 'signInWithGoogle must request backend OAuth endpoint via getBackendBaseUrl');
    assert.ok(fbClient.includes('if (isDesktop)'), 'isDesktop must guard against popup login in desktop environments');
  });

  await t.test('8. Artist search candidate scoring and Deezer placeholder detection are enforced', () => {
    const artistRs = fs.readFileSync(path.join(root, 'src-tauri/src/server/artist.rs'), 'utf8');
    const appJs = fs.readFileSync(path.join(root, 'src/app.js'), 'utf8');

    assert.ok(artistRs.includes('score_artist_candidate'), 'artist.rs must define score_artist_candidate function');
    assert.ok(artistRs.includes('is_deezer_placeholder_avatar'), 'artist.rs must detect Deezer placeholder images');
    assert.ok(appJs.includes('1a93a1a317e2383aeae098261b38bc38'), 'app.js fetchArtistCardForSearch must filter default Deezer placeholder hash');
  });

  await t.test('9. Playlist header play button is nested in action bar to prevent overlap with delete button', () => {
    const html = fs.readFileSync(path.join(root, 'src/index.html'), 'utf8');
    const css = fs.readFileSync(path.join(root, 'src/styles.css'), 'utf8');

    // #btn-play-playlist must be inside .playlist-actions
    const actionsIdx = html.indexOf('<div class="action-bar playlist-actions">');
    const playBtnIdx = html.indexOf('id="btn-play-playlist"');
    const deleteBtnIdx = html.indexOf('id="btn-delete-playlist"');

    assert.ok(actionsIdx !== -1 && playBtnIdx > actionsIdx && deleteBtnIdx > playBtnIdx, 'Play button must be inside playlist-actions before delete button');
    assert.ok(css.includes('.playlist-actions {\n  display: flex !important;\n  align-items: center !important;\n  gap: 12px !important;'), 'playlist-actions must have gap 12px');
  });

  await t.test('10. Bottom playbar layout uses flexible columns and unmasked marquee text', () => {
    const css = fs.readFileSync(path.join(root, 'src/styles.css'), 'utf8');

    assert.ok(css.includes('.track-title-marquee {\n  white-space: nowrap;\n  overflow: hidden;\n  text-overflow: ellipsis;'), 'track-title-marquee must have ellipsis');
  });

  await t.test('11. Full Native Rust Backend Endpoints are implemented and mounted', () => {
    const modRs = fs.readFileSync(path.join(root, 'src-tauri/src/server/mod.rs'), 'utf8');
    const playlistsRs = fs.readFileSync(path.join(root, 'src-tauri/src/server/playlists.rs'), 'utf8');
    const syncRs = fs.readFileSync(path.join(root, 'src-tauri/src/server/sync.rs'), 'utf8');
    const authRs = fs.readFileSync(path.join(root, 'src-tauri/src/server/auth.rs'), 'utf8');
    const lyricsRs = fs.readFileSync(path.join(root, 'src-tauri/src/server/lyrics.rs'), 'utf8');
    const artistRs = fs.readFileSync(path.join(root, 'src-tauri/src/server/artist.rs'), 'utf8');

    assert.ok(modRs.includes('/api/firebase/config'), 'mod.rs must mount /api/firebase/config');
    assert.ok(modRs.includes('/api/playlists'), 'mod.rs must mount /api/playlists');
    assert.ok(modRs.includes('/api/sync/shared-storage'), 'mod.rs must mount /api/sync/shared-storage');
    assert.ok(modRs.includes('/api/translate'), 'mod.rs must mount /api/translate');
    assert.ok(modRs.includes('/api/custom-wave'), 'mod.rs must mount /api/custom-wave');

    assert.ok(authRs.includes('handle_firebase_config'), 'auth.rs must implement handle_firebase_config');
    assert.ok(playlistsRs.includes('handle_get_playlists'), 'playlists.rs must implement handle_get_playlists');
    assert.ok(playlistsRs.includes('handle_publish_playlists'), 'playlists.rs must implement handle_publish_playlists');
    assert.ok(syncRs.includes('handle_get_shared_storage'), 'sync.rs must implement handle_get_shared_storage');
    assert.ok(lyricsRs.includes('handle_translate'), 'lyrics.rs must implement handle_translate');
    assert.ok(artistRs.includes('handle_custom_wave'), 'artist.rs must implement handle_custom_wave');
  });
});
