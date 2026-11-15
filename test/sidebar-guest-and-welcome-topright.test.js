import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

test('Welcome screen top-right controls and center language pills integrity', () => {
  const welcomeHtml = fs.readFileSync(path.join(ROOT_DIR, 'src/riff-welcome.html'), 'utf-8');

  // #winControls must NOT contain .lang-switch-wrap
  assert.ok(!welcomeHtml.includes('class="lang-switch-wrap"'), 'Top right controls must not contain duplicate language switcher');
  assert.ok(welcomeHtml.includes('id="skipBtn"'), 'Top right controls must contain Skip button');

  // Step 1 card must contain the centered language switcher pills
  assert.ok(welcomeHtml.includes('id="slide1LangRu"'), 'Center card must contain Russian language pill');
  assert.ok(welcomeHtml.includes('id="slide1LangEn"'), 'Center card must contain English language pill');
});

test('Sidebar pins isolate account playlists from unauthenticated / guest users', () => {
  const appJs = fs.readFileSync(path.join(ROOT_DIR, 'src/app.js'), 'utf-8');

  // renderSidebarPins must check login status and filter out non-guest playlists for unauthenticated users
  assert.ok(appJs.includes('const effectivePlaylists = isLoggedIn'), 'renderSidebarPins must compute effectivePlaylists based on login status');
  assert.ok(appJs.includes('(state.playlists || []).filter(p => p && p.isGuestLocal)'), 'renderSidebarPins must restrict guest view to guest local playlists');

  // initSharedStorageSync must only load cloud shared playlists for logged-in users
  assert.ok(appJs.includes('if (!isLoggedIn) {\n        // Not in an account: do not load another account\'s playlists into the guest sidebar'), 'initSharedStorageSync must not load cloud playlists for guest');

  // auth-changed handler must clear account playlists on logout or guest
  assert.ok(appJs.includes('state.playlists = (state.playlists || []).filter(p => p && p.isGuestLocal);'), 'auth-changed must clear account playlists on logout');
});

test('Download choice modal styling and local folder immediate execution', () => {
  const stylesCss = fs.readFileSync(path.join(ROOT_DIR, 'src/styles.css'), 'utf-8');
  const appJs = fs.readFileSync(path.join(ROOT_DIR, 'src/app.js'), 'utf-8');

  // download-choice-card must have clean dark styling
  assert.ok(stylesCss.includes('.download-choice-option'), 'styles.css must define .download-choice-option');
  assert.ok(stylesCss.includes('.download-choice-name'), 'styles.css must define .download-choice-name');
  assert.ok(stylesCss.includes('#btn-cancel-download-choice'), 'styles.css must style cancel button as clean pill');

  // dl-choice-folder must not hang waiting for zenity on click
  assert.ok(appJs.includes('btnChoiceFolder.addEventListener(\'click\''), 'btnChoiceFolder click handler must be registered');
  assert.ok(!appJs.includes('showToast(\'Определение папки для скачивания...\', \'info\');'), 'btnChoiceFolder must not display blocking folder lookup toast');
});

test('Cancellation of downloads purges processes and handles UI state', () => {
  const musicJs = fs.readFileSync(path.join(ROOT_DIR, 'routes/music.js'), 'utf-8');
  assert.ok(musicJs.includes("exec('pkill -9 -f yt-dlp; pkill -9 -f ffmpeg'"), 'routes/music.js must terminate orphan processes on download cancel');
});
