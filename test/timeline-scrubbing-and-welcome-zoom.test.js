import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';

const ROOT_DIR = path.resolve('.');

describe('Timeline Scrubbing & Welcome Screen Zoom Compensation Integrity', () => {

  test('1. Main scrubber uses PointerEvents with pointer capture and instant scrubProgress follow', () => {
    const appJs = fs.readFileSync(path.join(ROOT_DIR, 'src/app.js'), 'utf-8');

    // Must have pointerdown, pointermove, pointerup, pointercancel
    assert.ok(appJs.includes("el.scrubberTrack.addEventListener('pointerdown', handleScrubPointerDown);"), 'Must attach pointerdown on el.scrubberTrack');
    assert.ok(appJs.includes("el.scrubberTrack.addEventListener('pointermove', handleScrubPointerMove);"), 'Must attach pointermove on el.scrubberTrack');
    assert.ok(appJs.includes("el.scrubberTrack.addEventListener('pointerup', handleScrubPointerUp);"), 'Must attach pointerup on el.scrubberTrack');
    assert.ok(appJs.includes("el.scrubberTrack.addEventListener('pointercancel', handleScrubPointerUp);"), 'Must attach pointercancel on el.scrubberTrack');

    // Must use setPointerCapture and releasePointerCapture
    assert.ok(appJs.includes("el.scrubberTrack.setPointerCapture(e.pointerId)"), 'Must capture pointer for smooth drag tracking');
    assert.ok(appJs.includes("el.scrubberTrack.releasePointerCapture(e.pointerId)"), 'Must release pointer capture on up/cancel');

    // Instant scrubProgress follow during drag (no visual lag/freeze)
    assert.ok(appJs.includes('if (isDraggingScrubber) {') && appJs.includes('scrubProgress = targetProgress;'), 'scrubProgress must stick 1:1 to targetProgress when isDraggingScrubber is true');

    // Safety guard against hover seek: if (e.buttons & 1) === 0, stop dragging immediately
    assert.ok(appJs.includes('(e.buttons & 1) === 0'), 'Must abort drag if primary mouse button is released (e.buttons & 1 === 0)');
  });

  test('2. TV Karaoke scrubber updates visual line during active drag and blocks hover seeking', () => {
    const appJs = fs.readFileSync(path.join(ROOT_DIR, 'src/app.js'), 'utf-8');

    // updateTvkScrubberUI must accept force parameter and update --p during drag
    assert.ok(appJs.includes('function updateTvkScrubberUI(curTime, durTime, force = false)'), 'updateTvkScrubberUI must support force parameter');
    assert.ok(appJs.includes('!isDraggingTvkScrubber || force'), 'Must allow updating seekInput and --p during force updates while dragging');

    // handleTvkScrubFromEvent must call updateTvkScrubberUI with force=true
    assert.ok(appJs.includes('updateTvkScrubberUI(target, dur, true);'), 'Must force update UI during scrub move so line moves in real-time');

    // pointermove on tvkTrack must guard against button release and hover
    assert.ok(appJs.includes('if (!isDraggingTvkScrubber) return;') && appJs.includes('if ((e.buttons & 1) === 0)'), 'tvkTrack pointermove must verify isDraggingTvkScrubber and e.buttons & 1');
  });

  test('3. Welcome onboarding modal compensates for body zoom and covers 100vw/100vh with #121214', () => {
    const stylesCss = fs.readFileSync(path.join(ROOT_DIR, 'src/styles.css'), 'utf-8');
    const indexHtml = fs.readFileSync(path.join(ROOT_DIR, 'src/index.html'), 'utf-8');

    // styles.css must define calc(100vw / var(--app-scale, 0.9))
    assert.ok(stylesCss.includes('calc(100vw / var(--app-scale, 0.9))'), 'Welcome modal must compensate body zoom with 100vw / --app-scale');
    assert.ok(stylesCss.includes('calc(100vh / var(--app-scale, 0.9))'), 'Welcome modal must compensate body zoom with 100vh / --app-scale');

    // html must be styled with #121214 background
    assert.ok(indexHtml.includes('style="background: #121214 !important; background-color: #121214 !important;"'), 'html tag must have dark #121214 background in index.html');
    assert.ok(stylesCss.includes('background-color: #121214 !important;'), 'styles.css must have background-color: #121214 on root');
  });

  test('4. Firebase source map 404s are eliminated in server.js', async () => {
    const serverJs = fs.readFileSync(path.join(ROOT_DIR, 'server.js'), 'utf-8');
    assert.ok(serverJs.includes("'/vendor/firebase-app-compat.js.map'"), 'server.js must map firebase-app-compat.js.map');
    assert.ok(serverJs.includes("'/vendor/firebase-auth-compat.js.map'"), 'server.js must map firebase-auth-compat.js.map');
    assert.ok(serverJs.includes("'/vendor/firebase-firestore-compat.js.map'"), 'server.js must map firebase-firestore-compat.js.map');
  });
});
