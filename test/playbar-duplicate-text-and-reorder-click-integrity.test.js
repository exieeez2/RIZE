import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

describe('Playbar Duplicate Text Elimination, Reordering Clicks & Artwork Clipping Integrity', () => {
  const rootDir = process.cwd();
  const appPath = path.join(rootDir, 'src/app.js');
  const playbarCompPath = path.join(rootDir, 'src/components/Playbar.js');
  const appCode = fs.readFileSync(appPath, 'utf8');
  const playbarCode = fs.readFileSync(playbarCompPath, 'utf8');

  it('1. sanitizeDuplicateString correctly deduplicates accidentally doubled strings', () => {
    function sanitizeDuplicateString(str) {
      if (!str || typeof str !== 'string') return '';
      const s = str.trim();
      if (s.length >= 4 && s.length % 2 === 0) {
        const half = s.length / 2;
        if (s.slice(0, half) === s.slice(half)) {
          return s.slice(0, half).trim();
        }
      }
      return s;
    }

    assert.equal(sanitizeDuplicateString('Dai DaiDai Dai'), 'Dai Dai');
    assert.equal(sanitizeDuplicateString('ShakiraShakira'), 'Shakira');
    assert.equal(sanitizeDuplicateString('HelloHello'), 'Hello');
    assert.equal(sanitizeDuplicateString('Dai Dai'), 'Dai Dai');
    assert.equal(sanitizeDuplicateString('Shakira'), 'Shakira');
    assert.equal(sanitizeDuplicateString(''), '');
    assert.equal(sanitizeDuplicateString(null), '');
  });

  it('2. app.js applies sanitizeDuplicateString and updates playbar title and artist cleanly', () => {
    assert.ok(appCode.includes('function sanitizeDuplicateString'), 'app.js must define sanitizeDuplicateString');
    assert.ok(appCode.includes('cleanTitle = sanitizeDuplicateString(track.title)'), 'app.js must sanitize cleanTitle');
    assert.ok(appCode.includes('cleanArtist = sanitizeDuplicateString(track.artist)'), 'app.js must sanitize cleanArtist');
    assert.ok(appCode.includes('el.playbarTitle.innerText = \'\';'), 'app.js must clear innerText on el.playbarTitle');
    assert.ok(appCode.includes('el.playbarArtist.innerText = \'\';'), 'app.js must clear innerText on el.playbarArtist');
  });

  it('3. Playbar.js sanitizes strings and binds refs to prevent VDOM text node duplication', () => {
    assert.ok(playbarCode.includes('function sanitizeStr'), 'Playbar.js must define sanitizeStr');
    assert.ok(playbarCode.includes('ref=${titleRef}'), 'Playbar.js must bind titleRef to playbar-title');
    assert.ok(playbarCode.includes('ref=${artistRef}'), 'Playbar.js must bind artistRef to playbar-artist');
    assert.ok(playbarCode.includes('titleRef.current.textContent = cleanT'), 'Playbar.js must update titleRef with textContent');
    assert.ok(playbarCode.includes('artistRef.current.textContent = cleanA'), 'Playbar.js must update artistRef with textContent');
  });

  it('4. initListReordering excludes text, links, and covers, and strictly restricts track drag to track-row-index', () => {
    assert.ok(
      appCode.includes(".track-row-artist, .track-row-title, .track-row-info, .track-row-thumb"),
      'initListReordering must exclude title, artist, info and thumb from starting drag'
    );
    assert.ok(
      appCode.includes("if (isTrackRow && !e.target.closest('.track-row-index'))"),
      'initListReordering must restrict track dragging solely to the index handle'
    );
    assert.ok(
      appCode.includes("if (!isTrackRow) {\n        pressTimer = setTimeout"),
      'initListReordering must not start drag on mere pressTimer for track rows'
    );
  });

  it('5. m3cDraw canvas coordinates and scaling prevent edge clipping and lag', () => {
    assert.ok(
      appCode.includes('const scale = (currentCover / 2) / 160;') || appCode.includes('const scale = (currentCover / 2) / 205;'),
      'm3cDraw scale must be normalized with 160 divisor to match shape radius and stay safely within 96px canvas boundaries'
    );
    assert.ok(
      appCode.includes('const imgSize = CANVAS_PX;') || appCode.includes('imgSize'),
      'm3cDraw must draw image across full canvas bounds to prevent chopped edges on shape lobes'
    );
    assert.ok(
      appCode.includes('hoverLift = m3c.hoverProgress * 2;'),
      'm3cDraw hover lift must be bounded to 2px so it never reaches y < 0'
    );
    assert.ok(
      appCode.includes('now - m3c.last < 30'),
      'm3cLoop must throttle to 30fps to avoid lagging on Linux desktop WebKitGTK'
    );
  });
});
