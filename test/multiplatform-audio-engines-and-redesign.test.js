import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

test('Multi-platform Audio Engines, Streaming, Offline Export, and Redesign Parity', async (t) => {
  await t.test('1. Audio Engines & Opus Streaming Priority (yt-dlp Opus + Audius API 320 kbps)', () => {
    const utilsJs = fs.readFileSync(path.join(rootDir, 'routes/utils.js'), 'utf-8');
    const musicJs = fs.readFileSync(path.join(rootDir, 'routes/music.js'), 'utf-8');
    const resolverDaemonPy = fs.readFileSync(path.join(rootDir, 'routes/resolver_daemon.py'), 'utf-8');
    const embeddedSourceKt = fs.readFileSync(path.join(rootDir, 'android/app/src/main/java/app/votify/mobile/data/EmbeddedMusicSource.kt'), 'utf-8');
    const customPrefsKt = fs.readFileSync(path.join(rootDir, 'android/app/src/main/java/app/votify/mobile/data/CustomPrefs.kt'), 'utf-8');
    const audioSettingsKt = fs.readFileSync(path.join(rootDir, 'android/app/src/main/java/app/votify/mobile/ui/settings/AudioSettingsScreen.kt'), 'utf-8');
    const indexHtml = fs.readFileSync(path.join(rootDir, 'src/index.html'), 'utf-8');

    // Opus format priority in backend yt-dlp & daemon
    assert.match(utilsJs, /bestaudio\[acodec=opus\]\/bestaudio\[ext=webm\]/);
    assert.match(resolverDaemonPy, /opus_fmts/);

    // Audius REST API integration in backend
    assert.match(utilsJs, /api\.audius\.co/);
    assert.match(utilsJs, /searchAudiusTracks/);
    assert.match(utilsJs, /resolveAudiusStreamUrl/);
    assert.match(musicJs, /\/api\/settings\/audio-engine/);

    // PC HTML settings for audio engine
    assert.match(indexHtml, /id="engine-btn-ytdlp"/);
    assert.match(indexHtml, /id="engine-btn-audius"/);

    // Android audio engine settings & Opus stream priority
    assert.match(customPrefsKt, /val audioEngine: String = "ytdlp"/);
    assert.match(embeddedSourceKt, /isOpusStream/);
    assert.match(embeddedSourceKt, /searchAudius/);
    assert.match(embeddedSourceKt, /resolveAudiusStreamUrl/);
  });

  await t.test('2. Offline Mode & Direct File Export with Vorbis/ID3 Tags and Scoped Storage', () => {
    const musicJs = fs.readFileSync(path.join(rootDir, 'routes/music.js'), 'utf-8');
    const appJs = fs.readFileSync(path.join(rootDir, 'src/app.js'), 'utf-8');
    const indexHtml = fs.readFileSync(path.join(rootDir, 'src/index.html'), 'utf-8');
    const embeddedSourceKt = fs.readFileSync(path.join(rootDir, 'android/app/src/main/java/app/votify/mobile/data/EmbeddedMusicSource.kt'), 'utf-8');
    const libraryVmKt = fs.readFileSync(path.join(rootDir, 'android/app/src/main/java/app/votify/mobile/ui/library/LibraryViewModel.kt'), 'utf-8');
    const musicRepoKt = fs.readFileSync(path.join(rootDir, 'android/app/src/main/java/app/votify/mobile/data/MusicRepository.kt'), 'utf-8');

    // Backend metadata tags and formats
    assert.match(musicJs, /--add-metadata/);
    assert.match(musicJs, /--embed-thumbnail/);
    assert.match(musicJs, /audio\/opus/);
    assert.match(musicJs, /audio\/ogg/);

    // PC format selector & download sync
    assert.match(indexHtml, /id="select-download-format"/);
    assert.match(appJs, /select-download-format/);
    assert.match(appJs, /setDownloadFormat/);

    // Android public downloads export (Scoped Storage / MediaStore)
    assert.match(embeddedSourceKt, /exportTrackToPublicDownloads/);
    assert.match(embeddedSourceKt, /MediaStore\.Downloads/);
    assert.match(musicRepoKt, /exportTrack/);
    assert.match(libraryVmKt, /exportTrack/);
  });

  await t.test('3. Mobile Player Customization (New player Design 1 vs Old player Design 2)', () => {
    const customPrefsKt = fs.readFileSync(path.join(rootDir, 'android/app/src/main/java/app/votify/mobile/data/CustomPrefs.kt'), 'utf-8');
    const playerSettingsKt = fs.readFileSync(path.join(rootDir, 'android/app/src/main/java/app/votify/mobile/ui/settings/PlayerSettingsScreen.kt'), 'utf-8');
    const playerScreenKt = fs.readFileSync(path.join(rootDir, 'android/app/src/main/java/app/votify/mobile/ui/player/PlayerScreen.kt'), 'utf-8');

    // Preference definition & default is "new"
    assert.match(customPrefsKt, /val playerDesign: String = "new"/);

    // Settings screen options: New player and Old player (no copyrighted name mentions)
    assert.match(playerSettingsKt, /New player/);
    assert.match(playerSettingsKt, /Old player/);
    assert.ok(!playerSettingsKt.includes('BitChord'), 'No copyrighted names allowed in player settings');
    assert.ok(!playerScreenKt.includes('BitChord'), 'No copyrighted names allowed in player screen');

    // Player screen rendering both layouts with enlarged controls
    assert.match(playerScreenKt, /val isNewPlayer = visuals\.playerDesign != "old"/);
    assert.match(playerScreenKt, /76\.dp/); // Enlarged 76dp play button
    assert.match(playerScreenKt, /60\.dp/); // Enlarged unified actions capsule
  });

  await t.test('4. Mobile Home & Library Redesigns (Giant Continue Hero Artwork, Clean Tabs & System Collections)', () => {
    const homeScreenKt = fs.readFileSync(path.join(rootDir, 'android/app/src/main/java/app/votify/mobile/ui/home/HomeScreen.kt'), 'utf-8');
    const libraryScreenKt = fs.readFileSync(path.join(rootDir, 'android/app/src/main/java/app/votify/mobile/ui/library/LibraryScreen.kt'), 'utf-8');

    // Mobile Giant Continue Hero with full cover artwork and quick play/favorite actions
    assert.match(homeScreenKt, /HeroContinueSection/);
    assert.match(homeScreenKt, /HomeHeader/);
    assert.match(homeScreenKt, /statusBarsPadding/);

    // Mobile Library Screen with Clean Tabs (Все, Плейлисты, Авторы) and System Collections
    assert.match(libraryScreenKt, /LibraryTab/);
    assert.match(libraryScreenKt, /CircleIconBtn/);
    assert.match(libraryScreenKt, /LibraryCard/);
    assert.match(libraryScreenKt, /Любимые/);
    assert.match(libraryScreenKt, /Скачанные/);
  });

  await t.test('5. PC Desktop Design Integrity (Liquid Glass removed from PC, Clean Scrollbars & i18n)', () => {
    const indexHtml = fs.readFileSync(path.join(rootDir, 'src/index.html'), 'utf-8');
    const stylesCss = fs.readFileSync(path.join(rootDir, 'src/styles.css'), 'utf-8');
    const appJs = fs.readFileSync(path.join(rootDir, 'src/app.js'), 'utf-8');
    const i18nJs = fs.readFileSync(path.join(rootDir, 'src/i18n.js'), 'utf-8');

    // Liquid Glass removed from PC per user instruction
    assert.ok(!indexHtml.includes('id="liquid-glass-amb"'), 'PC index.html should not have liquid glass ambient layer');
    assert.ok(!indexHtml.includes('id="setting-liquid-glass-row"'), 'PC index.html should not have liquid glass setting toggle');
    assert.ok(!stylesCss.includes('body.liquid-glass-active'), 'PC styles should not have liquid-glass-active rules');
    assert.ok(!appJs.includes('toggleLiquidGlass'), 'PC app.js should not have toggleLiquidGlass handler');

    // Clean dark scrollbars without white gutters
    assert.match(stylesCss, /::-webkit-scrollbar-track\s*\{\s*background:\s*transparent\s*!important;/);
    assert.ok(!stylesCss.includes('scrollbar-gutter: stable;'), 'scrollbar-gutter should not be stable to prevent light gutter stripe');

    // i18n translations for download formats exist
    assert.match(i18nJs, /'audio\.downloadFormat':/);
    assert.match(i18nJs, /'audio\.downloadFormatHint':/);
    assert.match(i18nJs, /'Формат скачивания'/);

    // Desktop interface preservation (no mobile-only bottom nav or stage breaking desktop grid)
    assert.ok(!indexHtml.includes('<section class="stage">'), 'Desktop HTML should not have mobile stage injected directly');
    assert.match(indexHtml, /id="nav-discover"/);
    assert.match(indexHtml, /id="nav-favorites"/);
  });
});
