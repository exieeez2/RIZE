import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

describe('Modular Preact Components Verification (LeftSidebar, TopSearchBar, RightPanel, HomeBlocks)', () => {
  const rootDir = process.cwd();
  const vendorPath = path.join(rootDir, 'src/vendor/preact-htm.umd.js');
  const sidebarPath = path.join(rootDir, 'src/components/LeftSidebar.js');
  const searchPath = path.join(rootDir, 'src/components/TopSearchBar.js');
  const rightPanelPath = path.join(rootDir, 'src/components/RightPanel.js');
  const homeBlocksPath = path.join(rootDir, 'src/components/HomeBlocks.js');
  const trackActionPillPath = path.join(rootDir, 'src/components/TrackActionPill.js');

  const vendorCode = fs.readFileSync(vendorPath, 'utf8');
  const sidebarCode = fs.readFileSync(sidebarPath, 'utf8');
  const searchCode = fs.readFileSync(searchPath, 'utf8');
  const rightPanelCode = fs.readFileSync(rightPanelPath, 'utf8');
  const homeBlocksCode = fs.readFileSync(homeBlocksPath, 'utf8');
  const trackActionPillCode = fs.readFileSync(trackActionPillPath, 'utf8');

  function createEnv() {
    const sandbox = {
      window: {},
      console: { log: () => {}, error: () => {}, warn: () => {} },
      document: {
        getElementById: () => null,
        querySelector: () => null
      }
    };
    sandbox.window = sandbox;
    vm.createContext(sandbox);
    vm.runInContext(vendorCode, sandbox);
    return sandbox;
  }

  it('1. LeftSidebar.js defines component and mounting function with clean nav rail without unwanted header', () => {
    const env = createEnv();
    vm.runInContext(sidebarCode, env);

    assert.equal(typeof env.window.LeftSidebarComponent, 'function');
    assert.equal(typeof env.window.mountPreactLeftSidebar, 'function');

    assert.ok(sidebarCode.includes('nav-discover'), 'LeftSidebar must include discover/search nav item');
    assert.ok(sidebarCode.includes('nav-favorites'), 'LeftSidebar must include favorites nav item');
    assert.ok(sidebarCode.includes('nav-settings'), 'LeftSidebar must include settings nav item');
  });

  it('2. TopSearchBar.js defines component and mounting function with debounced search', () => {
    const env = createEnv();
    vm.runInContext(searchCode, env);

    assert.equal(typeof env.window.TopSearchBarComponent, 'function');
    assert.equal(typeof env.window.mountPreactTopSearchBar, 'function');

    assert.ok(searchCode.includes('Search songs, artists, albums...'), 'TopSearchBar must use standard placeholder');
    assert.ok(searchCode.includes('search-icon-btn'), 'TopSearchBar must retain search icon button ID');
    assert.ok(searchCode.includes('search-clear-btn'), 'TopSearchBar must retain search clear button ID');
  });

  it('3. RightPanel.js defines component and mounting function with speed and lyrics controls', () => {
    const env = createEnv();
    vm.runInContext(rightPanelCode, env);

    assert.equal(typeof env.window.RightPanelComponent, 'function');
    assert.equal(typeof env.window.mountPreactRightPanel, 'function');

    assert.ok(rightPanelCode.includes('right-panel-cover'), 'RightPanel must retain cover image ID');
    assert.ok(rightPanelCode.includes('lyrics-container'), 'RightPanel must retain lyrics container ID');
    assert.ok(rightPanelCode.includes('lyrics-speed-pills'), 'RightPanel must retain speed pills container ID');
  });

  it('4. HomeBlocks.js defines component and mounting function with Top Charts table', () => {
    const env = createEnv();
    vm.runInContext(homeBlocksCode, env);

    assert.equal(typeof env.window.HomeBlocksComponent, 'function');
    assert.equal(typeof env.window.mountPreactHomeBlocks, 'function');

    assert.ok(homeBlocksCode.includes('Top Charts'), 'HomeBlocks must render Top Charts heading');
    assert.ok(homeBlocksCode.includes('track-row-thumb-wrap'), 'HomeBlocks must render track artwork wraps');
    assert.ok(homeBlocksCode.includes('openTrackContextMenu'), 'HomeBlocks must bind 3-dots context/action pill');
  });

  it('5. TrackActionPill.js defines component and mounting function with all 5 action buttons', () => {
    const env = createEnv();
    vm.runInContext(trackActionPillCode, env);

    assert.equal(typeof env.window.TrackActionPillComponent, 'function');
    assert.equal(typeof env.window.mountTrackActionPill, 'function');

    assert.ok(trackActionPillCode.includes('btn-pill-fav'), 'TrackActionPill must have fav action');
    assert.ok(trackActionPillCode.includes('btn-pill-art'), 'TrackActionPill must have art action');
    assert.ok(trackActionPillCode.includes('btn-pill-add-pl'), 'TrackActionPill must have add to playlist action');
    assert.ok(trackActionPillCode.includes('btn-pill-more'), 'TrackActionPill must have more/download action');
    assert.ok(trackActionPillCode.includes('btn-pill-close'), 'TrackActionPill must have close/remove action');
    assert.ok(trackActionPillCode.includes('row-docked'), 'TrackActionPill must use row-docked class');
  });
});
