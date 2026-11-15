/**
 * Tauri Compatibility Bridge for Votify (Riff-based Frontend)
 * Implements window.electronAPI so that Riff frontend runs seamlessly
 * inside Tauri Webview or standard desktop browser environments.
 */
(function () {
  if (window.electronAPI) return;

  function getTauriWindow() {
    try {
      if (window.__TAURI__) {
        if (window.__TAURI__.webviewWindow && typeof window.__TAURI__.webviewWindow.getCurrentWebviewWindow === 'function') {
          return window.__TAURI__.webviewWindow.getCurrentWebviewWindow();
        }
        if (window.__TAURI__.window && typeof window.__TAURI__.window.getCurrentWindow === 'function') {
          return window.__TAURI__.window.getCurrentWindow();
        }
      }
    } catch (e) {
      console.warn('[tauri-bridge] getTauriWindow error:', e);
    }
    return null;
  }

  const bridge = {
    serverToken: '',

    minimizeWindow: () => {
      const win = getTauriWindow();
      if (win && typeof win.minimize === 'function') {
        win.minimize();
      }
    },

    maximizeWindow: () => {
      const win = getTauriWindow();
      if (win && typeof win.toggleMaximize === 'function') {
        win.toggleMaximize();
      }
    },

    closeWindow: () => {
      const win = getTauriWindow();
      if (win && typeof win.close === 'function') {
        win.close();
      }
    },

    getServerPort: async () => {
      const curPort = parseInt(location.port, 10);
      return curPort || 17217;
    },

    getGpuCompositing: () => Promise.resolve(true),
    pickMedia: () => Promise.resolve(null),
    importAudioFiles: () => Promise.resolve(null),

    onWindowVisibility: (callback) => {
      window.addEventListener('focus', () => callback(true));
      window.addEventListener('blur', () => callback(false));
      document.addEventListener('visibilitychange', () => {
        callback(!document.hidden);
      });
    },

    setZoomFactor: (factor) => {
      try {
        if (typeof factor === 'number' && Number.isFinite(factor) && Math.abs(factor - 1.0) > 0.01) {
          document.documentElement.style.zoom = factor;
        } else {
          document.documentElement.style.zoom = '';
        }
      } catch (e) {}
    },

    getZoomFactor: () => {
      try {
        return parseFloat(document.documentElement.style.zoom) || 1.0;
      } catch (e) {
        return 1.0;
      }
    },

    discordRpcUpdate: (trackInfo) => {
      fetch('/api/discord-presence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playback: trackInfo })
      }).catch(() => {});
    },

    discordRpcClear: () => {
      fetch('/api/discord-presence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'clear' })
      }).catch(() => {});
    },

    discordRpcSetEnabled: (enabled) => {},
    discordRpcGetEnabled: () => Promise.resolve(true),
    discordRpcGetConnected: () => Promise.resolve(true),

    getCacheSize: () => Promise.resolve('0 MB'),
    clearCache: () => Promise.resolve(true),
    getDataDir: () => Promise.resolve(''),
    pickDataDir: () => Promise.resolve(null),
    setDataDir: (dir, move) => Promise.resolve(true),
    getDownloadDir: async () => {
      try {
        const res = await fetch('/api/dialog/get-default-folder');
        const data = await res.json();
        return data && data.dir ? { dir: data.dir } : { dir: '' };
      } catch (_) {
        return { dir: '' };
      }
    },
    pickDownloadDir: async () => {
      try {
        const res = await fetch('/api/dialog/pick-folder');
        const data = await res.json();
        return data && data.dir ? data.dir : null;
      } catch (_) {
        return null;
      }
    },
    showSaveDialog: (options) => Promise.resolve(null),
    setDownloadDir: (dir) => Promise.resolve(true),
    resetDownloadDir: () => Promise.resolve(true),

    restartApp: () => {
      location.reload();
    },

    getAppVersion: () => Promise.resolve('1.0.0'),
    checkForUpdates: () => Promise.resolve(null),
    updateAction: (action) => {},
    onUpdateAvailable: (cb) => {},
    onUpdateProgress: (cb) => {},
    onUpdateReady: (cb) => {},
    onUpdateError: (cb) => {},
    onUpdateNotAvailable: (cb) => {},
    setTrayOnClose: (enabled) => {},
    getMultiInstance: () => Promise.resolve(false),
    setMultiInstance: (v) => {},
    onPlayerAction: (cb) => {
      window._tauriPlayerActionCallbacks = window._tauriPlayerActionCallbacks || [];
      window._tauriPlayerActionCallbacks.push(cb);
    },
    onMediaCommand: (cb) => {
      window._tauriPlayerActionCallbacks = window._tauriPlayerActionCallbacks || [];
      window._tauriPlayerActionCallbacks.push(cb);
    },
    toggleMiniWindow: () => {},
    isWindows: navigator.userAgent.indexOf('Windows') !== -1,
    setMediaKeys: (v) => {},
    mediaKeysActive: () => {},

    welcomeFinish: (detail) => {
      try {
        localStorage.setItem('riff_tutorial_done', 'true');
        const modal = document.getElementById('welcome-onboarding-modal');
        if (modal) {
          modal.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
          modal.style.opacity = '0';
          modal.style.transform = 'scale(0.98)';
          setTimeout(() => { modal.style.display = 'none'; }, 300);
        }
      } catch (e) {
        console.error('welcomeFinish error:', e);
      }
    },

    onWelcomeResult: (cb) => {},
    getLauncherInfo: () => Promise.resolve(null),
    listThemes: () => Promise.resolve([]),
    importThemes: () => Promise.resolve([]),
    setThemeEnabled: (id, on) => {},
    disableAllThemes: () => {},
    removeTheme: (id) => {},
    listPlugins: () => Promise.resolve([]),
    setPluginEnabled: (file, on) => {},
    disableAllPlugins: () => {},
    openPluginsFolder: () => {},
    removePlugin: (file) => {},
    importPlugins: () => Promise.resolve([]),
    getAppCss: () => Promise.resolve(''),
    openExternal: (u) => window.open(u, '_blank'),
    logError: (level, message, stack) => console.error(level, message, stack),
    openLogsFolder: () => {},
    getDiagnostics: () => Promise.resolve({}),
    getAudioOutputInfo: () => Promise.resolve({ devices: [] }),
    signInWithGoogle: async () => {
      try {
        const port = (window.state && window.state.serverPort) || 17217;
        const apiBase = (location.protocol === 'http:' || location.protocol === 'https:') && location.port == port
          ? ''
          : `http://127.0.0.1:${port}`;
        const resp = await fetch(`${apiBase}/api/auth/google`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        });
        const data = await resp.json().catch(() => ({}));
        if (!resp.ok) {
          return { error: data.error || `Ошибка сервера авторизации (${resp.status})` };
        }
        return data;
      } catch (e) {
        return { error: e.message || 'Ошибка подключения к серверу авторизации' };
      }
    },
  };

  window.electronAPI = bridge;
  window.isTauriEnvironment = true;
  window.isDesktop = true;

  window.handlePlayerAction = function (action) {
    try {
      if ((action === 'play-pause' || action === 'toggle') && typeof window.togglePlayPause === 'function') {
        window.togglePlayPause();
      } else if (action === 'next' && typeof window.playNext === 'function') {
        window.playNext();
      } else if (action === 'prev' && typeof window.playPrev === 'function') {
        window.playPrev();
      }
    } catch (e) {
      console.warn('[tauri-bridge] handlePlayerAction error:', e);
    }
    if (window._tauriPlayerActionCallbacks) {
      window._tauriPlayerActionCallbacks.forEach(cb => {
        try { cb(action); } catch (_) {}
      });
    }
  };

  // Listen for message from iframe (welcome onboarding modal)
  window.addEventListener('message', (event) => {
    if (event.data && (event.data.type === 'welcome-finish' || event.data.type === 'votify:welcome-done')) {
      bridge.welcomeFinish(event.data.detail);
    }
  });

  function setupWindowControls() {
    const btnMin = document.getElementById('btn-minimize');
    const btnMax = document.getElementById('btn-maximize');
    const btnClose = document.getElementById('btn-close');

    if (btnMin && !btnMin._hasTauriListener) {
      btnMin._hasTauriListener = true;
      btnMin.addEventListener('click', () => bridge.minimizeWindow());
    }
    if (btnMax && !btnMax._hasTauriListener) {
      btnMax._hasTauriListener = true;
      btnMax.addEventListener('click', () => bridge.maximizeWindow());
    }
    if (btnClose && !btnClose._hasTauriListener) {
      btnClose._hasTauriListener = true;
      btnClose.addEventListener('click', () => bridge.closeWindow());
    }

    // Window dragging on top panel and header elements
    document.addEventListener('mousedown', async (e) => {
      if (e.button !== 0) return;
      if (e.target.closest('button, input, textarea, select, a, .titlebar-controls, .search-box, .track-row, .btn-icon-pill, .interactive, [data-no-drag]')) {
        return;
      }
      const dragTarget = e.target.closest('#titlebar, .titlebar, .titlebar-drag, .top-nav, [data-tauri-drag-region]');
      if (dragTarget) {
        const win = getTauriWindow();
        if (win && typeof win.startDragging === 'function') {
          try {
            await win.startDragging();
          } catch (_) {}
        }
      }
    });

    // Double-click on top titlebar to toggle maximize
    document.addEventListener('dblclick', async (e) => {
      if (e.target.closest('button, input, textarea, select, a, .titlebar-controls, .search-box')) return;
      if (e.target.closest('#titlebar, .titlebar-drag, .app-logo')) {
        bridge.maximizeWindow();
      }
    });

    // Check if welcome onboarding is already done or needs to be shown
    const isDone = localStorage.getItem('votify_welcome_done') === '1';
    const welcomeModal = document.getElementById('welcome-onboarding-modal');
    if (welcomeModal) {
      if (!isDone) {
        welcomeModal.classList.remove('hidden');
        welcomeModal.style.display = 'block';
      } else {
        welcomeModal.classList.add('hidden');
        welcomeModal.style.display = 'none';
      }
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupWindowControls);
  } else {
    setupWindowControls();
  }
})();
