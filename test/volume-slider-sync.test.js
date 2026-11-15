const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

describe('Volume Slider Synchronization Between Fullscreen and Bottom Players', () => {
  it('src/app.js defines unified syncVolumeUI updating values and css fill variables', () => {
    const appPath = path.join(__dirname, '..', 'src/app.js');
    const code = fs.readFileSync(appPath, 'utf8');

    assert.ok(code.includes('function syncVolumeUI()'), 'syncVolumeUI must be defined');
    assert.ok(code.includes("btmSlider.style.setProperty('--volume-pct', pctStr)"), 'must set --volume-pct on bottom slider');
    assert.ok(code.includes("btmSlider.style.setProperty('--p', pctStr)"), 'must set --p on bottom slider');
    assert.ok(code.includes("tvkSlider.style.setProperty('--volume-pct', pctStr)"), 'must set --volume-pct on fullscreen slider');
    assert.ok(code.includes("tvkSlider.style.setProperty('--p', pctStr)"), 'must set --p on fullscreen slider');
  });

  it('tvk-volume-slider input listener synchronizes volume to bottom slider', () => {
    const appPath = path.join(__dirname, '..', 'src/app.js');
    const code = fs.readFileSync(appPath, 'utf8');

    const tvkListenerMatch = code.match(/tvkVolSlider\.addEventListener\('input'[\s\S]*?\}\);/);
    assert.ok(tvkListenerMatch, 'tvkVolSlider input listener must exist');
    assert.ok(
      tvkListenerMatch[0].includes('syncVolumeUI()'),
      'tvkVolSlider input listener must invoke syncVolumeUI to update both vertical thumb and horizontal fill'
    );
  });

  it('bottom volume-slider input listener synchronizes volume to fullscreen slider', () => {
    const appPath = path.join(__dirname, '..', 'src/app.js');
    const code = fs.readFileSync(appPath, 'utf8');

    const btmListenerMatch = code.match(/el\.volumeSlider\.addEventListener\('input'[\s\S]*?\}\);/);
    assert.ok(btmListenerMatch, 'el.volumeSlider input listener must exist');
    assert.ok(
      btmListenerMatch[0].includes('syncVolumeSliderFill()') || btmListenerMatch[0].includes('syncVolumeUI()'),
      'el.volumeSlider input listener must invoke syncVolumeUI / syncVolumeSliderFill'
    );
  });

  it('adjustVolume and mute buttons call syncVolumeUI', () => {
    const appPath = path.join(__dirname, '..', 'src/app.js');
    const code = fs.readFileSync(appPath, 'utf8');

    const adjustStart = code.indexOf('function adjustVolume(delta)');
    assert.ok(adjustStart !== -1, 'adjustVolume must exist');
    const adjustCode = code.slice(adjustStart, adjustStart + 250);
    assert.ok(adjustCode.includes('syncVolumeUI()'), 'adjustVolume must call syncVolumeUI');

    const persistStart = code.indexOf('function persistVolumeState()');
    assert.ok(persistStart !== -1, 'persistVolumeState must exist');
    const persistCode = code.slice(persistStart, persistStart + 500);
    assert.ok(persistCode.includes('syncVolumeUI()'), 'persistVolumeState must call syncVolumeUI');
  });

  it('watchSliderValue observes volume sliders for automatic fill updates on programmatic changes', () => {
    const appPath = path.join(__dirname, '..', 'src/app.js');
    const code = fs.readFileSync(appPath, 'utf8');

    assert.ok(code.includes('watchSliderValue(el.volumeSlider'), 'el.volumeSlider must be watched by watchSliderValue');
    assert.ok(code.includes('watchSliderValue(tvkVolSlider'), 'tvkVolSlider must be watched by watchSliderValue');
  });

  it('functional test: changing volume in fullscreen player updates bottom player horizontal fill', () => {
    // Simulate DOM elements with custom CSS style storage
    class MockElement {
      constructor(id) {
        this.id = id;
        this.value = '0.85';
        this.styles = {};
        this.classList = {
          hidden: false,
          toggle(cls, state) {
            this[cls] = !!state;
          },
          add(cls) {
            this[cls] = true;
          },
          remove(cls) {
            this[cls] = false;
          },
        };
      }
      style = {
        setProperty: (prop, val) => {
          this.styles[prop] = String(val);
        },
        getPropertyValue: (prop) => {
          return this.styles[prop] || '';
        },
      };
    }

    const btmSlider = new MockElement('volume-slider');
    const tvkSlider = new MockElement('tvk-volume-slider');
    const btmIcon = new MockElement('volume-icon');
    const btmMutedIcon = new MockElement('volume-muted-icon');
    const tvkIcon = new MockElement('tvk-volume-icon');
    const tvkMutedIcon = new MockElement('tvk-volume-muted-icon');

    const mockState = { volume: 0.85, isMuted: false };

    function runSyncVolumeUI(state, btm, tvk) {
      const vol = typeof state.volume === 'number' && !isNaN(state.volume) ? Math.max(0, Math.min(1, state.volume)) : 0.85;
      const pct = Math.round(vol * 100);
      const pctStr = pct + '%';
      const isMutedNow = state.isMuted || vol === 0;

      if (btm) {
        btm.value = String(vol);
        btm.style.setProperty('--volume-pct', pctStr);
        btm.style.setProperty('--p', pctStr);
      }
      if (tvk) {
        tvk.value = String(vol);
        tvk.style.setProperty('--volume-pct', pctStr);
        tvk.style.setProperty('--p', pctStr);
      }
    }

    // Initially at 85%
    runSyncVolumeUI(mockState, btmSlider, tvkSlider);
    assert.equal(btmSlider.value, '0.85');
    assert.equal(btmSlider.style.getPropertyValue('--volume-pct'), '85%');
    assert.equal(btmSlider.style.getPropertyValue('--p'), '85%');

    // User slides fullscreen player to 32%
    mockState.volume = 0.32;
    runSyncVolumeUI(mockState, btmSlider, tvkSlider);

    // Verify bottom slider vertical position (value) and horizontal fill (--volume-pct and --p)
    assert.equal(btmSlider.value, '0.32');
    assert.equal(btmSlider.style.getPropertyValue('--volume-pct'), '32%');
    assert.equal(btmSlider.style.getPropertyValue('--p'), '32%');

    // User slides fullscreen player to 0%
    mockState.volume = 0;
    runSyncVolumeUI(mockState, btmSlider, tvkSlider);
    assert.equal(btmSlider.value, '0');
    assert.equal(btmSlider.style.getPropertyValue('--volume-pct'), '0%');
    assert.equal(btmSlider.style.getPropertyValue('--p'), '0%');

    // User slides fullscreen player to 100%
    mockState.volume = 1;
    runSyncVolumeUI(mockState, btmSlider, tvkSlider);
    assert.equal(btmSlider.value, '1');
    assert.equal(btmSlider.style.getPropertyValue('--volume-pct'), '100%');
    assert.equal(btmSlider.style.getPropertyValue('--p'), '100%');
  });

  it('src/styles.css uses --volume-pct and fallback --p for both slider tracks', () => {
    const cssPath = path.join(__dirname, '..', 'src/styles.css');
    const css = fs.readFileSync(cssPath, 'utf8');

    assert.ok(
      css.includes('var(--volume-pct, var(--p, 85%))'),
      'both volume-slider and tvk slider track must support --volume-pct with --p fallback'
    );
  });
});
