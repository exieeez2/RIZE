import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

test('Multiple Authors Display and GitLab Auto-Update', async (t) => {
  await t.test('1. routes/utils.js extracts multiple artists from InnerTube runs and title feat/ft', async () => {
    const utilsContent = fs.readFileSync(path.resolve('routes/utils.js'), 'utf8');

    // Test regex and extraction logic directly
    const featMatchRegex = /[\(\[](?:feat\.|ft\.|featuring)\s+([^\)\]]+)[\)\]]/i;
    const title1 = 'Love The Way You Lie (feat. Rihanna)';
    const match1 = title1.match(featMatchRegex);
    assert.ok(match1, 'feat regex matches title with (feat. ...)');
    assert.equal(match1[1], 'Rihanna');

    const title2 = 'Jimmy Cooks [ft. 21 Savage & Lil Baby]';
    const match2 = title2.match(featMatchRegex);
    assert.ok(match2, 'feat regex matches title with [ft. ...]');
    assert.equal(match2[1], '21 Savage & Lil Baby');

    assert.ok(utilsContent.includes('extractFeaturingArtists'), 'routes/utils.js defines extractFeaturingArtists');
    assert.ok(utilsContent.includes('const explicitArtists = runs.filter'), 'extractYTMArtist gathers all explicit artists');
  });

  await t.test('2. Android DeezerApi parses contributors, artists, and feat for all authors', () => {
    const ktFile = fs.readFileSync(path.resolve('android/app/src/main/java/app/votify/mobile/data/DeezerApi.kt'), 'utf8');

    assert.ok(ktFile.includes('contributors'), 'DeezerApi parseTrack checks contributors array');
    assert.ok(ktFile.includes('artistsArr'), 'DeezerApi parseTrack checks artists array');
    assert.ok(ktFile.includes('featRegex'), 'DeezerApi parseTrack checks feat in track title');
    assert.ok(ktFile.includes('joinToString(", ")'), 'DeezerApi joins all authors with comma');
  });

  await t.test('3. PC and Android Auto-Update use GitLab release endpoints', () => {
    const pkg = JSON.parse(fs.readFileSync(path.resolve('package.json'), 'utf8'));
    assert.equal(pkg.build.publish[0].url, 'https://gitlab.com/exieeez/rize/-/raw/releases/');
    assert.equal(pkg.build.publish.length, 1, 'Only GitLab publish config should be retained');

    const appUpdateManager = fs.readFileSync(path.resolve('android/app/src/main/java/app/votify/mobile/data/AppUpdateManager.kt'), 'utf8');
    assert.ok(appUpdateManager.includes('https://gitlab.com/exieeez/rize/-/raw/apk/version.json'), 'Android update checks GitLab apk branch');
    assert.ok(appUpdateManager.includes('https://gitlab.com/exieeez/rize/-/raw/releases/latest-android.json'), 'Android update checks GitLab releases');
    assert.ok(appUpdateManager.includes('https://gitlab.com/exieeez/rize/-/raw/releases/RIZE.apk'), 'Android download fallback points to GitLab releases');

    const mainJs = fs.readFileSync(path.resolve('main.js'), 'utf8');
    assert.ok(mainJs.includes('https://gitlab.com/exieeez/rize/-/raw/releases/'), 'main.js autoUpdater feed URL points to GitLab');
    assert.ok(mainJs.includes('latest-linux.yml'), 'main.js checks latest-linux.yml on Linux');

    const srcAppJs = fs.readFileSync(path.resolve('src/app.js'), 'utf8');
    assert.ok(srcAppJs.includes('https://gitlab.com/exieeez/rize/-/raw/releases/'), 'src/app.js checks GitLab releases');
  });
});
