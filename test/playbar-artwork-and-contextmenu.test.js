import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

describe('Playbar Pause, Artwork Clipping & Track Context Menu Verification', () => {
  const rootDir = process.cwd();
  const playbarPath = path.join(rootDir, 'src/components/Playbar.js');
  const appPath = path.join(rootDir, 'src/app.js');
  const cssPath = path.join(rootDir, 'src/styles.css');

  it('1. Playbar.js toggles .playing class and delegates onPlayPause reliably', () => {
    const compCode = fs.readFileSync(playbarPath, 'utf8');
    assert.ok(
      compCode.includes("playback.isPlaying ? ' playing' : ''"),
      'Playbar button must include .playing class when playback.isPlaying is true'
    );
    assert.ok(
      compCode.includes('handlePlayPause'),
      'Playbar button must bind handlePlayPause callback'
    );
  });

  it('2. app.js updatePlayPauseButton computes actuallyPlaying correctly and toggles .playing', () => {
    const appCode = fs.readFileSync(appPath, 'utf8');
    assert.ok(
      appCode.includes('isPlaying !== undefined'),
      'updatePlayPauseButton must respect explicit isPlaying boolean parameter'
    );
    assert.ok(
      appCode.includes("classList.toggle('playing', actuallyPlaying)"),
      'updatePlayPauseButton must toggle .playing class on the play/pause button'
    );
    assert.ok(
      appCode.includes('_playPauseDelegated'),
      'mountPreactPlaybar must ensure delegated play/pause listener on #playbar'
    );
  });

  it('3. styles.css ensures .playbar-left has overflow: visible to eliminate album art clipping', () => {
    const cssCode = fs.readFileSync(cssPath, 'utf8');
    // Ensure .playbar-left doesn't have overflow: hidden
    assert.ok(
      cssCode.includes('.playbar-left {\n  display: flex;\n  align-items: center;\n  gap: 4px;\n  min-width: 0;\n  max-width: 100%;\n  padding-left: 14px;\n  overflow: visible !important;\n}'),
      '.playbar-left must have overflow: visible !important to prevent canvas clipping'
    );
  });

  it('4. app.js m3c cover animation runs with delta-time and optimized steps to prevent lagging', () => {
    const appCode = fs.readFileSync(appPath, 'utf8');
    assert.ok(
      appCode.includes('const STEPS = 120;'),
      'm3c cover should use 120 steps for optimal smoothness without CPU lag'
    );
    assert.ok(
      !appCode.includes('now - m3c.last >= 24'),
      'm3cLoop should avoid artificial frame drops (now - m3c.last >= 24) that cause stutter'
    );
  });

  it('5. Track 3-dots context menu renders floating action pill with all actions for compact/50% window access', () => {
    const appCode = fs.readFileSync(appPath, 'utf8');
    assert.ok(
      appCode.includes('function openTrackContextMenu'),
      'openTrackContextMenu must be defined'
    );
    assert.ok(
      appCode.includes('track-action-pill'),
      'Action pill must use track-action-pill class matching user specification'
    );
    assert.ok(
      appCode.includes('targetRow.appendChild(pill)'),
      'Action pill must append directly into targetRow to guarantee row-anchored placement'
    );
    assert.ok(
      appCode.includes("pill.classList.add('row-docked')"),
      'Action pill must mark itself as row-docked for absolute row positioning'
    );
    assert.ok(
      appCode.includes('Добавить в плейлист'),
      'Context menu must include Add to Playlist option'
    );
    assert.ok(
      appCode.includes('Настроить обложку и баннер'),
      'Context menu must include Customize cover & banner option'
    );
    assert.ok(
      appCode.includes('openDownloadChoice'),
      'Context menu must include download track option'
    );
    assert.ok(
      appCode.includes('Ссылка скопирована'),
      'Context menu must include copy link option'
    );
  });

  it('6. styles.css includes .track-action-pill styling with Material You tokens and row docking', () => {
    const cssCode = fs.readFileSync(cssPath, 'utf8');
    assert.ok(
      cssCode.includes('.track-action-pill'),
      'styles.css must include .track-action-pill styling'
    );
    assert.ok(
      cssCode.includes('.track-action-pill.open'),
      'styles.css must include .track-action-pill.open transition'
    );
    assert.ok(
      cssCode.includes('.track-action-pill.row-docked') || cssCode.includes('.track-row .track-action-pill'),
      'styles.css must include row-docked styles to anchor pill to track-row'
    );
    assert.ok(
      cssCode.includes('.pill-action-btn'),
      'styles.css must include .pill-action-btn button styling'
    );
  });

  it('7. Playbar mount clears container.innerHTML to prevent duplicated track text', () => {
    const compCode = fs.readFileSync(playbarPath, 'utf8');
    assert.ok(
      compCode.includes("container.innerHTML = '';"),
      'mountPreactPlaybar must clear container.innerHTML to prevent duplicating static and reactive playbars'
    );
  });

  it('8. M3 Cover canvas is 96px and raw img is hidden with !important to prevent bleed & cutoff', () => {
    const cssCode = fs.readFileSync(cssPath, 'utf8');
    const appCode = fs.readFileSync(appPath, 'utf8');
    assert.ok(
      cssCode.includes('width: 96px; height: 96px;'),
      'styles.css must set .m3c-canvas to 96px x 96px so it never collides with window bottom'
    );
    assert.ok(
      cssCode.includes('body.m3-cover-on .m3c-wrap > img { visibility: hidden !important; opacity: 0 !important; display: none !important; }'),
      'styles.css must strictly hide square thumbnail when M3 cover is active'
    );
    assert.ok(
      appCode.includes('const CANVAS_PX = 96;'),
      'app.js must define CANVAS_PX = 96 to fit within playbar boundaries'
    );
  });

  it('9. Modular Preact components (LeftSidebar, TopSearchBar, RightPanel, HomeBlocks) exist and are registered', () => {
    const indexHtml = fs.readFileSync(path.join(rootDir, 'src/index.html'), 'utf8');
    assert.ok(fs.existsSync(path.join(rootDir, 'src/components/LeftSidebar.js')), 'LeftSidebar.js must exist');
    assert.ok(fs.existsSync(path.join(rootDir, 'src/components/TopSearchBar.js')), 'TopSearchBar.js must exist');
    assert.ok(fs.existsSync(path.join(rootDir, 'src/components/RightPanel.js')), 'RightPanel.js must exist');
    assert.ok(fs.existsSync(path.join(rootDir, 'src/components/HomeBlocks.js')), 'HomeBlocks.js must exist');

    assert.ok(indexHtml.includes('components/LeftSidebar.js'), 'index.html must load LeftSidebar.js');
    assert.ok(indexHtml.includes('components/TopSearchBar.js'), 'index.html must load TopSearchBar.js');
    assert.ok(indexHtml.includes('components/RightPanel.js'), 'index.html must load RightPanel.js');
    assert.ok(indexHtml.includes('components/HomeBlocks.js'), 'index.html must load HomeBlocks.js');
  });
});
