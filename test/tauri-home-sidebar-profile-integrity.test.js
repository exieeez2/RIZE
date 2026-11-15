const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

describe('Tauri Desktop Home Carousel, Sidebar Pins & Profile Data Integrity', () => {
  const root = path.join(__dirname, '..');
  const appJs = fs.readFileSync(path.join(root, 'src/app.js'), 'utf8');
  const firebaseJs = fs.readFileSync(path.join(root, 'src/firebase-client.js'), 'utf8');
  const stylesCss = fs.readFileSync(path.join(root, 'src/styles.css'), 'utf8');

  it('1. loadHomePage hydrates from cache & fallback instantly so center wave card is never empty', () => {
    // Verifies cache hydration
    assert.match(appJs, /riff_cached_wave/, 'app.js must use riff_cached_wave for instant cache hydration');
    assert.match(appJs, /localStorage\.getItem\(['"]riff_cached_wave['"]\)/, 'app.js must read cached wave tracks on startup');
    assert.match(appJs, /localStorage\.setItem\(['"]riff_cached_wave['"]/, 'app.js must persist recommendations to riff_cached_wave');

    // Verifies fallback catalog presence when cache is empty
    assert.match(appJs, /fallbackTracks\s*=\s*\[[\s\S]*?id:\s*['"]demo-01['"][\s\S]*?title:\s*['"]Неоновый дождь['"]/, 'app.js must have fallback tracks catalog');

    // Verifies apiBaseUrl avoids tauri.localhost custom scheme
    assert.match(appJs, /!orig\.includes\(['"]tauri\.localhost['"]\)/, 'apiBaseUrl must ignore tauri.localhost origin to target local server');
  });

  it('2. Sidebar playlist pins are fully clickable and openPlaylistDetail handles unpopulated tracks safely', () => {
    // openPlaylistDetail handles null/undefined pl.tracks
    assert.match(appJs, /if\s*\(!Array\.isArray\(pl\.tracks\)\)\s*pl\.tracks\s*=\s*\[\];/, 'openPlaylistDetail must guard pl.tracks against undefined');

    // Pointer events on sidebar-pin children are disabled so events trigger on the pin container
    assert.match(stylesCss, /\.sidebar-pin\s*\*\s*\{[\s\S]*?pointer-events:\s*none\s*!important;/, 'styles.css must set pointer-events: none on sidebar-pin children');

    // Event handlers for both click and pointerup with debounce
    assert.match(appJs, /pin\.addEventListener\(['"]click['"],\s*onSelect\);/, 'renderSidebarPins must listen to click event');
    assert.match(appJs, /pin\.addEventListener\(['"]pointerup['"],\s*onSelect\);/, 'renderSidebarPins must listen to pointerup event');
    assert.match(appJs, /lastTrigger\s*=\s*now;/, 'onSelect must debounce rapid multi-event triggers');
  });

  it('3. Firebase Profile preserves exieeez / @god and does not fall back to email prefix', () => {
    // ensureProfile prioritizes authentic name & handle for vovan232012s
    assert.match(firebaseJs, /if\s*\(emailPrefix === 'vovan232012s'\)\s*\{[\s\S]*?effectiveDisplayName = 'exieeez';/, 'ensureProfile must guarantee exieeez for vovan232012s');
    assert.match(firebaseJs, /if\s*\(emailPrefix === 'vovan232012s'\)\s*\{[\s\S]*?effectiveHandle = 'god';/, 'ensureProfile must guarantee god for vovan232012s');

    // loginWithGoogleCredential does not overwrite custom display name with email prefix
    assert.match(firebaseJs, /displayName = 'exieeez';[\s\S]*?updatePayload\.handle = 'god';/, 'loginWithGoogleCredential must safeguard exieeez and god');

    // getProfile guarantees authentic name and handle
    assert.match(firebaseJs, /if\s*\(emailPrefix === 'vovan232012s'\)\s*\{[\s\S]*?base\.displayName = 'exieeez';[\s\S]*?base\.handle = 'god';/, 'getProfile must return exieeez and god');
  });

  it('4. Topbar avatar button opens login dialog for unauthenticated users instead of empty profile modal', () => {
    // tbAvatarBtn checks getCurrentUser before opening profile
    assert.match(appJs, /const tbAvatarBtn = document\.getElementById\('tb-avatar-btn'\);[\s\S]*?window\.VotifyCloud\.getCurrentUser[\s\S]*?openAuth\('auth-login'\)/, 'tbAvatarBtn must guide unauthenticated user to openAuth');
  });

  it('5. Mutual exclusivity between Library (#nav-favorites) and Liked Tracks (.sidebar-pin.pin-liked) on sidebar', () => {
    // state contains activeSidebarItem
    assert.match(appJs, /activeSidebarItem:\s*['"]discover['"]/, 'app.js state must track activeSidebarItem');

    // Clicking liked pin activates ONLY pin-liked and deactivates nav-favorites
    assert.match(appJs, /state\.activeSidebarItem\s*=\s*['"]pin-liked['"];[\s\S]*?switchView\(['"]favorites['"]\);/, 'liked pin must set activeSidebarItem to pin-liked');

    // updateActiveSidebarPin activates likedPin ONLY when activeSidebarItem === pin-liked
    assert.match(appJs, /const isLikedActive = state\.currentView === ['"]favorites['"] && state\.activeSidebarItem === ['"]pin-liked['"];/, 'liked pin must only be active when activeSidebarItem is pin-liked');

    // switchView removes active from navFavorites when activeSidebarItem is pin-liked
    assert.match(appJs, /if\s*\(state\.activeSidebarItem === ['"]pin-liked['"]\)\s*\{[\s\S]*?el\.navFavorites\.classList\.remove\(['"]active['"]\);[\s\S]*?likedPin\.classList\.add\(['"]active['"]\);/, 'switchView must not activate navFavorites if pin-liked is active');

    // switchView deactivates likedPin when navigating to general library
    assert.match(appJs, /state\.activeSidebarItem = ['"]library['"];[\s\S]*?el\.navFavorites\.classList\.add\(['"]active['"]\);[\s\S]*?likedPin\.classList\.remove\(['"]active['"]\);/, 'switchView must activate navFavorites and deactivate likedPin for general library');

    // updateNavIndicator hides indicator for pin-liked so it does not highlight navFavorites
    assert.match(appJs, /if\s*\(state\.activeSidebarItem === ['"]pin-liked['"]/, 'updateNavIndicator must hide active indicator when pin-liked is active');
  });

  it('6. Audio streaming engine and download format i18n localization integrity', () => {
    const mainJs = fs.readFileSync(path.join(root, 'src/main.js'), 'utf8');
    const i18nJs = fs.readFileSync(path.join(root, 'src/i18n.js'), 'utf8');
    const indexHtml = fs.readFileSync(path.join(root, 'src/index.html'), 'utf8');

    // index.html has complete labels and select options
    assert.match(indexHtml, /data-i18n="audio\.downloadFormat">Формат скачивания<\/span>/, 'index.html must have clean fallback text for download format');
    assert.match(indexHtml, /data-i18n="audio\.downloadFormatHint">Формат файлов при экспорте/, 'index.html must have clean fallback hint for download format');
    assert.match(indexHtml, /<option value="opus"[^>]*>Opus \(\.opus \/ \.ogg\)<\/option>/, 'index.html must have Opus option');
    assert.match(indexHtml, /<option value="mp3"[^>]*>MP3 \(\.mp3, 320 kbps\)<\/option>/, 'index.html must have MP3 320 kbps option');

    // i18n.js defines translations
    assert.match(i18nJs, /'audio\.downloadFormat': 'Формат скачивания'/, 'i18n.js must have audio.downloadFormat in RU dictionary');
    assert.match(i18nJs, /'audio\.downloadFormatHint': 'Формат файлов при экспорте/, 'i18n.js must have audio.downloadFormatHint in RU dictionary');

    // main.js defines translations
    assert.match(mainJs, /'audio\.downloadFormat': 'Формат скачивания'/, 'main.js must have audio.downloadFormat in RU dictionary');
    assert.match(mainJs, /'audio\.downloadFormatHint': 'Формат файлов при экспорте/, 'main.js must have audio.downloadFormatHint in RU dictionary');
  });

  it('7. Profile avatar generation and Google OAuth photoURL fallback', () => {
    // getAvatarUrl generates modern gradient initial monogram instead of plain grey silhouette
    assert.match(firebaseJs, /function getAvatarUrl\(name,\s*customAvatar\)\s*\{[\s\S]*?linearGradient[\s\S]*?initial/, 'getAvatarUrl must generate a vibrant monogram avatar');

    // ensureProfile and onDocUpdate include user.photoURL
    assert.match(firebaseJs, /user\.photoURL\s*\|\|\s*user\.photoUrl/, 'ensureProfile must include user.photoURL as avatar candidate');

    // updateAccountUi applies effectiveAvatarSrc
    assert.match(firebaseJs, /const effectiveAvatarSrc = profile\.avatar\s*\|\|\s*\(?user\?\.photoURL[\s\S]*?getAvatarUrl/, 'updateAccountUi must fallback to monogram avatar if profile.avatar is empty');
  });

  it('8. Profile playlists accurately reflect real track counts without 0 tracks bug', () => {
    // getAppPlaylists merges state.favorites / devsize_favorites with actual track list
    assert.match(firebaseJs, /id:\s*['"]favorites['"],\s*name:\s*['"]Избранное['"],\s*tracks:\s*favs,\s*count:\s*favs\.length/, 'getAppPlaylists must include true track count for favorites');

    // getAppPlaylists reconciles counts from window.state.playlists
    assert.match(firebaseJs, /livePl\.tracks\.length > 0[\s\S]*?pl\.count = livePl\.tracks\.length/, 'getAppPlaylists must update count from live state tracks');

    // renderPlCards falls back to pl.count or pl.trackCount if tracks array is not populated
    assert.match(firebaseJs, /(?:let|const)\s+count = tracks\.length > 0 \? tracks\.length : \(typeof pl\.count === 'number' && pl\.count > 0 \? pl\.count/, 'renderPlCards must use pl.count if tracks array is empty');
  });

  it('9. Audio engine stream resolution, active stream reload, and player badge', () => {
    const utilsJs = fs.readFileSync(path.join(root, 'routes/utils.js'), 'utf8');

    // resolveAudiusStreamUrl searches by query when ID is not numeric
    assert.match(utilsJs, /searchAudiusTracks\(raw,\s*1\)/, 'resolveAudiusStreamUrl must search Audius for track metadata');

    // setAudioEngineUI updates stream live if playing
    assert.match(appJs, /setAudioEngineUI[\s\S]*?updateEngineBadge[\s\S]*?el\.nativeAudio\.currentTime/, 'setAudioEngineUI must reload live audio stream when engine switches');

    // playTrack passes currentEngine to /api/stream
    assert.match(appJs, /api\/stream\?id=\$\{encodeURIComponent\(cleanId\)\}&engine=\$\{currentEngine\}/, 'playTrack must send active engine to stream endpoint');

    // index.html has playbar engine badge
    const indexHtml = fs.readFileSync(path.join(root, 'src/index.html'), 'utf8');
    assert.match(indexHtml, /id="playbar-engine-badge"/, 'index.html must have playbar-engine-badge');
  });
});
