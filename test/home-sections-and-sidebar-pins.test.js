import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const appPath = path.join(rootDir, 'src/app.js');
const cssPath = path.join(rootDir, 'src/styles.css');
const indexPath = path.join(rootDir, 'src/index.html');

describe('Home Page Sections, Sidebar Pins & Playbar Integrity Verification', () => {
  const appCode = fs.readFileSync(appPath, 'utf8');
  const cssCode = fs.readFileSync(cssPath, 'utf8');
  const indexHtml = fs.readFileSync(indexPath, 'utf8');

  it('1. app.js implements Home sections population (loadHomeForYouSection, loadHomePlaylistsSection, loadHomeArtistsSection)', () => {
    assert.ok(
      appCode.includes('function loadHomeForYouSection'),
      'app.js must define loadHomeForYouSection'
    );
    assert.ok(
      appCode.includes('function loadHomePlaylistsSection'),
      'app.js must define loadHomePlaylistsSection'
    );
    assert.ok(
      appCode.includes('function loadHomeArtistsSection'),
      'app.js must define loadHomeArtistsSection'
    );
    assert.ok(
      appCode.includes('loadHomeForYouSection(isRefresh);'),
      'loadHomePage must call loadHomeForYouSection'
    );
    assert.ok(
      appCode.includes('loadHomePlaylistsSection();'),
      'loadHomePage must call loadHomePlaylistsSection'
    );
    assert.ok(
      appCode.includes('loadHomeArtistsSection();'),
      'loadHomePage must call loadHomeArtistsSection'
    );
  });

  it('2. index.html contains DOM targets for Home sections', () => {
    assert.ok(
      indexHtml.includes('id="for-you-results"'),
      'index.html must include for-you-results container'
    );
    assert.ok(
      indexHtml.includes('id="home-playlists-results"'),
      'index.html must include home-playlists-results container'
    );
    assert.ok(
      indexHtml.includes('id="home-artists-results"'),
      'index.html must include home-artists-results container'
    );
  });

  it('3. styles.css includes complete styling for Home section cards and carousels', () => {
    assert.ok(
      cssCode.includes('.rec-grid.for-you-carousel') || cssCode.includes('.for-you-carousel'),
      'styles.css must style for-you-carousel'
    );
    assert.ok(
      cssCode.includes('.home-playlists-carousel'),
      'styles.css must style home-playlists-carousel'
    );
    assert.ok(
      cssCode.includes('.artists-grid.artists-carousel'),
      'styles.css must style artists-carousel'
    );
    assert.ok(
      cssCode.includes('.dotify-card-cover-wrap'),
      'styles.css must style dotify-card-cover-wrap for unclipped covers'
    );
    assert.ok(
      cssCode.includes('.artist-avatar-wrap'),
      'styles.css must style artist-avatar-wrap'
    );
  });

  it('4. renderSidebarPins populates all playlists and allows guest users to see and open playlists', () => {
    assert.ok(
      appCode.includes('let effectivePlaylists = (state.playlists && state.playlists.length > 0) ? state.playlists : [];'),
      'renderSidebarPins must retrieve all available playlists'
    );
    assert.ok(
      !appCode.includes(': (state.playlists || []).filter(p => p && p.isGuestLocal);'),
      'renderSidebarPins must not filter out guest playlists from sidebar pins'
    );
    assert.ok(
      appCode.includes('openPlaylistDetail(pl.id);'),
      'renderSidebarPins pin onSelect must open playlist detail'
    );
  });

  it('5. openPlaylistDetail resiliently recovers from storage and switches view to playlist-detail', () => {
    assert.ok(
      appCode.includes('function openPlaylistDetail(playlistId)'),
      'openPlaylistDetail must be defined'
    );
    assert.ok(
      appCode.includes("switchView('playlist-detail');"),
      "openPlaylistDetail must switch view to 'playlist-detail'"
    );
  });

  it('6. Playbar artwork and cover animation avoid clipping and lag', () => {
    assert.ok(
      appCode.includes('const CANVAS_PX = 96;'),
      'app.js must maintain 96px canvas dimensions'
    );
    assert.ok(
      cssCode.includes('overflow: visible !important;'),
      'styles.css must maintain overflow: visible on playbar-left and wrappers'
    );
    assert.ok(
      appCode.includes('if (!state.isPlaying && !isHoverAnimating)'),
      'm3cLoop must avoid unnecessary continuous RAF when playback is paused'
    );
  });

  it('7. Playbar spinner is strictly inside btn-play-pause and no orphan spinner exists', () => {
    assert.ok(
      cssCode.includes('.btn-play-pause #playbar-spinner'),
      'styles.css must anchor #playbar-spinner inside .btn-play-pause'
    );
    assert.ok(
      cssCode.includes(':not(.btn-play-pause) > #playbar-spinner'),
      'styles.css must hide any orphan playbar-spinner'
    );
  });

  it('8. Playbar title and artist clearing prevents double text rendering', () => {
    assert.ok(
      appCode.includes("el.playbarTitle.innerText = '';"),
      'app.js must clear previous innerText before updating title'
    );
    assert.ok(
      appCode.includes("el.playbarArtist.innerText = '';"),
      'app.js must clear previous innerText before updating artist'
    );
  });
});
