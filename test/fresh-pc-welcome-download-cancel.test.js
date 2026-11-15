const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

describe('Fresh PC Simulation, 2-Step Welcome Wizard, Language Contrast & Download Cancel', () => {
  const root = path.join(__dirname, '..');
  const welcomeHtml = fs.readFileSync(path.join(root, 'src/riff-welcome.html'), 'utf8');
  const appJs = fs.readFileSync(path.join(root, 'src/app.js'), 'utf8');
  const musicRoutesJs = fs.readFileSync(path.join(root, 'routes/music.js'), 'utf8');
  const stylesCss = fs.readFileSync(path.join(root, 'src/styles.css'), 'utf8');
  const indexHtml = fs.readFileSync(path.join(root, 'src/index.html'), 'utf8');
  const serverJs = fs.readFileSync(path.join(root, 'server.js'), 'utf8');

  it('1. Welcome onboarding is trimmed to exactly 2 slides: Welcome and Launcher', () => {
    assert.match(welcomeHtml, /const\s+TOTAL_STEPS\s*=\s*2;/, 'TOTAL_STEPS must be 2');
    assert.ok(welcomeHtml.includes('id="step1"'), 'Must have step1');
    assert.ok(welcomeHtml.includes('id="step2"'), 'Must have step2');
    assert.ok(!welcomeHtml.includes('id="step3"'), 'Must not have step3');
    assert.ok(!welcomeHtml.includes('id="step4"'), 'Must not have step4');
    assert.ok(!welcomeHtml.includes('id="step5"'), 'Must not have step5');
  });

  it('2. Slide 1 features prominent high-contrast language pills (RU / EN) with instant sync', () => {
    assert.ok(welcomeHtml.includes('id="slide1LangSeg"'), 'Slide 1 must have #slide1LangSeg');
    assert.ok(welcomeHtml.includes('id="slide1LangRu"'), 'Slide 1 must have #slide1LangRu');
    assert.ok(welcomeHtml.includes('id="slide1LangEn"'), 'Slide 1 must have #slide1LangEn');
    assert.match(welcomeHtml, /document\.getElementById\('slide1LangRu'\)\?\.addEventListener\('click'/, 'Must attach click listener to slide1LangRu');
    assert.match(welcomeHtml, /document\.getElementById\('slide1LangEn'\)\?\.addEventListener\('click'/, 'Must attach click listener to slide1LangEn');
  });

  it('3. Slide 2 Add to launcher invokes /api/launcher/install to deploy .desktop entry', () => {
    assert.ok(welcomeHtml.includes('id="launcherSwitch"'), 'Slide 2 must have launcherSwitch');
    assert.ok(welcomeHtml.includes('id="finishBtn"'), 'Slide 2 must have finishBtn');
    assert.match(welcomeHtml, /fetch\('\/api\/launcher\/install',\s*\{\s*method:\s*'POST'\s*\}\)/, 'finishBtn must call /api/launcher/install');
    assert.ok(serverJs.includes('/api/launcher/install'), 'server.js must expose /api/launcher/install');
  });

  it('4. Welcome modal, iframe and body have solid #121214 background with no white borders', () => {
    assert.match(stylesCss, /#welcome-onboarding-modal[\s\S]*?background:\s*#121214\s*!important;/, 'Modal must have #121214 background');
    assert.match(stylesCss, /#welcome-frame[\s\S]*?background:\s*#121214\s*!important;/, 'Iframe must have #121214 background');
    assert.match(welcomeHtml, /background:\s*#121214\s*!important;/, 'riff-welcome.html body must have #121214 background');
    assert.ok(!welcomeHtml.includes('position: fixed; inset: 0;') || !welcomeHtml.match(/html[\s\S]*?position:\s*fixed/), 'html must not be position: fixed to allow root canvas painting');
  });

  it('5. RIZE logo icon in welcome hero is rendered cleanly without color-flattening tint filter', () => {
    assert.ok(!welcomeHtml.includes('filter: url(#iconTint)'), 'Must not have iconTint filter in welcome CSS');
    assert.ok(!welcomeHtml.includes('<filter id="iconTint"'), 'Must not have iconTint filter in SVG');
    assert.match(welcomeHtml, /src="assets\/icon\.png"/, 'Must render assets/icon.png directly');
  });

  it('6. Download cancellation button stops active background download and suppresses notifications', () => {
    // In routes/music.js:
    assert.ok(musicRoutesJs.includes('/api/download/cancel'), 'music.js must have /api/download/cancel');
    assert.match(musicRoutesJs, /process\.kill\(-this\.proc\.pid,\s*'SIGKILL'\)/, 'Must kill child process group on cancel');

    // In src/app.js:
    assert.match(appJs, /bulkDownloadAbortController\.abort\(\)/, 'app.js must abort bulkDownloadAbortController on banner close');
    assert.match(appJs, /fetch\(`\$\{apiBaseUrl\(\)\}\/api\/download\/cancel`,\s*\{\s*method:\s*'POST'\s*\}\)/, 'app.js must POST to /api/download/cancel on close');
    assert.match(appJs, /showToast\('Скачивание отменено'/, 'app.js must show toast that download was cancelled');
  });

  it('7. Default profile template uses guest placeholders for clean new-PC experience', () => {
    assert.match(indexHtml, /<h1 id="profile-display-name-text">Гость<\/h1>/, 'Default profile name must be Гость for fresh installs');
    assert.match(indexHtml, /<div class="handle" id="profile-handle-text">@guest<\/div>/, 'Default handle must be @guest for fresh installs');
  });
});
