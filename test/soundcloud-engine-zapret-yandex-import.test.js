import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

test('SoundCloud Engine, Zapret DPI Bypass, and Yandex Music Import across PC and Mobile', async (t) => {
  const utilsJs = fs.readFileSync(path.join(rootDir, 'routes/utils.js'), 'utf-8');
  const musicJs = fs.readFileSync(path.join(rootDir, 'routes/music.js'), 'utf-8');
  const indexHtml = fs.readFileSync(path.join(rootDir, 'src/index.html'), 'utf-8');
  const appJs = fs.readFileSync(path.join(rootDir, 'src/app.js'), 'utf-8');
  const customPrefsKt = fs.readFileSync(path.join(rootDir, 'android/app/src/main/java/app/votify/mobile/data/CustomPrefs.kt'), 'utf-8');
  const embeddedSourceKt = fs.readFileSync(path.join(rootDir, 'android/app/src/main/java/app/votify/mobile/data/EmbeddedMusicSource.kt'), 'utf-8');
  const audioSettingsKt = fs.readFileSync(path.join(rootDir, 'android/app/src/main/java/app/votify/mobile/ui/settings/AudioSettingsScreen.kt'), 'utf-8');
  const proxySettingsKt = fs.readFileSync(path.join(rootDir, 'android/app/src/main/java/app/votify/mobile/ui/settings/ProxySettingsScreen.kt'), 'utf-8');

  await t.test('1. Backend SoundCloud Engine Selection & ALT Bypass (DRM / Preview replacement)', () => {
    // Backend config and methods
    assert.match(utilsJs, /soundcloudEngine:\s*['"]alt['"]/);
    assert.match(utilsJs, /function getSoundcloudEngine/);
    assert.match(utilsJs, /function setSoundcloudEngine/);
    assert.match(utilsJs, /scFindAltStream/);
    assert.match(utilsJs, /scGetTrackMeta/);
    assert.match(utilsJs, /scGetStreamUrlDirect/);

    // Endpoint in music.js
    assert.match(musicJs, /\/api\/settings\/soundcloud-engine/);
  });

  await t.test('2. Backend Zapret DPI Bypass Mode and Routing', () => {
    // Zapret configuration and methods
    assert.match(utilsJs, /zapretEnabled:\s*false/);
    assert.match(utilsJs, /zapretPort:\s*1080/);
    assert.match(utilsJs, /function getZapretConfig/);
    assert.match(utilsJs, /function setZapretConfig/);

    // Endpoint in music.js
    assert.match(musicJs, /\/api\/settings\/zapret/);
  });

  await t.test('3. Yandex Music Playlist, Album and Track Import in Backend', () => {
    assert.match(musicJs, /extractYandexMusicTracks/);
    assert.match(musicJs, /music\.yandex\./);
    assert.match(musicJs, /handlers\/playlist\.jsx/);
    assert.match(musicJs, /handlers\/album\.jsx/);
    assert.match(musicJs, /handlers\/track\.jsx/);
  });

  await t.test('4. PC Frontend UI: SoundCloud Engine, Zapret switch, and Yandex Music Import card', () => {
    // SoundCloud engine dropdown
    assert.match(indexHtml, /id="select-sc-engine"/);
    assert.match(indexHtml, /ALT \(Умный обход DRM и превью\)/);
    assert.match(indexHtml, /Прямой API \(SoundCloud API v2\)/);

    // Zapret toggle & port
    assert.match(indexHtml, /id="toggle-zapret-main"/);
    assert.match(indexHtml, /id="input-zapret-port"/);

    // Yandex Music integration card & modal badge
    assert.match(indexHtml, /id="card-ym-import"/);
    assert.match(indexHtml, /id="btn-open-ym-import"/);
    assert.match(indexHtml, /<span class="import-badge"><i class="material-icons">album<\/i> Яндекс Музыка<\/span>/);

    // App.js handlers
    assert.match(appJs, /initSoundcloudEngineUI/);
    assert.match(appJs, /initZapretUI/);
    assert.match(appJs, /platform === 'yandex'/);
  });

  await t.test('5. Android Mobile Settings & Engine Parity', () => {
    // CustomPrefs fields
    assert.match(customPrefsKt, /val soundcloudEngine: String = "alt"/);
    assert.match(customPrefsKt, /val zapretEnabled: Boolean = false/);
    assert.match(customPrefsKt, /val zapretHost: String = "127\.0\.0\.1"/);
    assert.match(customPrefsKt, /val zapretPort: String = "1080"/);

    // EmbeddedMusicSource Yandex import & Zapret/SoundCloud handling
    assert.match(embeddedSourceKt, /importYandexMusic/);
    assert.match(embeddedSourceKt, /music\.yandex\./);
    assert.match(embeddedSourceKt, /scEngine/);
    assert.match(embeddedSourceKt, /getEffectiveHttpClient/);

    // CustomPrefs & ProxySettingsScreen UI
    assert.match(proxySettingsKt, /Режим Zapret/);
  });
});
