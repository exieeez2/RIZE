/**
 * RightPanel Component (Preact + HTM)
 * Lightweight reactive replacement for the side player & lyrics panel.
 * Maintains 100% of Dotify / Material You tokens, IDs, and styling classes.
 */
(function() {
  const preact = window.htmPreact;
  if (!preact) {
    console.error('[RightPanel] Preact HTM vendor bundle not found on window.htmPreact');
    return;
  }

  const { html, render, useState, useEffect, useCallback } = preact;

  function RightPanel(props) {
    const [track, setTrack] = useState(props.initialTrack || {
      title: 'No track playing',
      artist: 'Select a track to listen',
      thumb: ''
    });

    const [speed, setSpeed] = useState(props.initialSpeed || 1.0);
    const [mode, setMode] = useState(props.initialMode || 'Word');
    const [imgFailed, setImgFailed] = useState(false);

    useEffect(() => {
      window.__rightPanelUpdateTrack = (t) => {
        setImgFailed(false);
        setTrack(prev => ({ ...prev, ...t }));
      };
      window.__rightPanelUpdateSpeed = (s) => setSpeed(s);
      window.__rightPanelUpdateMode = (m) => setMode(m);

      return () => {
        delete window.__rightPanelUpdateTrack;
        delete window.__rightPanelUpdateSpeed;
        delete window.__rightPanelUpdateMode;
      };
    }, []);

    const handleSpeedChange = useCallback((newSpeed, e) => {
      e?.preventDefault();
      e?.stopPropagation();
      setSpeed(newSpeed);
      if (typeof props.onSpeedChange === 'function') {
        props.onSpeedChange(newSpeed);
      } else {
        const audio = document.getElementById('native-audio');
        if (audio) audio.playbackRate = newSpeed;
      }
    }, [props]);

    const handleClose = useCallback((e) => {
      e?.preventDefault();
      e?.stopPropagation();
      if (typeof props.onClose === 'function') {
        props.onClose();
      } else {
        const panel = document.getElementById('right-panel');
        if (panel) panel.classList.remove('open');
        document.body.classList.remove('right-panel-open');
      }
    }, [props]);

    const handleArtClick = useCallback((e) => {
      e?.preventDefault();
      e?.stopPropagation();
      if (typeof props.onEditArt === 'function') {
        props.onEditArt();
      } else if (typeof window.openTrackArtModal === 'function') {
        window.openTrackArtModal(track, e.currentTarget);
      }
    }, [props, track]);

    const handleKaraoke = useCallback((e) => {
      e?.preventDefault();
      e?.stopPropagation();
      if (typeof props.onKaraoke === 'function') {
        props.onKaraoke();
      } else if (typeof window.openTvKaraoke === 'function') {
        window.openTvKaraoke(true);
      }
    }, [props]);

    const handleModeToggle = useCallback((e) => {
      e?.preventDefault();
      e?.stopPropagation();
      const nextMode = mode === 'Word' ? 'Line' : 'Word';
      setMode(nextMode);
      if (typeof props.onModeToggle === 'function') props.onModeToggle(nextMode);
    }, [mode, props]);

    const hasThumb = Boolean(track.thumb && !imgFailed);

    return html`
      <div class="right-panel-header">
        <div class="right-panel-actions">
          <div class="lyrics-toolbar-speed" id="lyrics-speed-pills">
            ${[1, 1.15, 1.25, 1.5].map((s) => html`
              <button
                class=${`speed-pill-btn ${speed === s ? 'active' : ''}`}
                data-speed=${s}
                onClick=${(e) => handleSpeedChange(s, e)}
              >
                ${s.toFixed(s === 1 ? 1 : (s === 1.5 ? 1 : 2))}x
              </button>
            `)}
          </div>
          <button
            class="lyrics-action-btn"
            id="right-download-btn"
            title="Скачать трек"
            data-i18n-title="panel.download"
            style="display:none;"
            onClick=${props.onDownload}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="7 10 12 15 17 10"></polyline>
              <line x1="12" y1="15" x2="12" y2="3"></line>
            </svg>
          </button>
          <button id="fi-download" style="display:none;" aria-hidden="true"></button>
          <button
            class="lyrics-action-btn"
            id="btn-add-custom-lyrics"
            title="Редактировать текст"
            aria-label="Редактировать текст"
            data-i18n-title="panel.editLyrics"
            data-i18n-aria="panel.editLyrics"
            onClick=${props.onEditLyrics}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 20h9"></path>
              <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
            </svg>
          </button>
          <button
            class="lyrics-action-btn"
            id="btn-sync-lyrics"
            title="Синхронизировать текст"
            aria-label="Синхронизировать текст"
            data-i18n-title="panel.syncLyrics"
            data-i18n-aria="panel.syncLyrics"
            onClick=${props.onSyncLyrics}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"></circle>
              <polyline points="12 6 12 12 16 14"></polyline>
            </svg>
          </button>
          <button
            class="lyrics-action-btn hidden"
            id="btn-translate-lyrics"
            title="Перевести текст"
            aria-label="Перевести текст"
            data-i18n-title="panel.translateLyrics"
            data-i18n-aria="panel.translateLyrics"
            onClick=${props.onTranslateLyrics}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12.87 15.07l-2.54-2.51.03-.03c1.74-1.94 2.98-4.17 3.71-6.53H17V4h-7V2H8v2H1v1.99h11.17C11.5 7.92 10.44 9.75 9 11.35 8.07 10.32 7.3 9.19 6.69 8h-2c.73 1.63 1.73 3.17 2.98 4.56l-5.11 5.02L4 19l5-5 3.11 3.11.76-2.04zM18.5 10h-2L12 22h2l1.12-3h4.75L21 22h2l-4.5-12zm-2.62 7l1.62-4.33L19.12 17h-3.24z"/>
            </svg>
          </button>
          <button
            class="lyrics-action-btn"
            id="btn-tv-karaoke"
            title="Караоке во весь экран"
            aria-label="Караоке во весь экран"
            data-i18n-title="panel.karaoke"
            data-i18n-aria="panel.karaoke"
            onClick=${handleKaraoke}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/>
            </svg>
          </button>
        </div>
        <button class="lyrics-mode-btn" id="btn-lyrics-mode" title="Toggle line mode" onClick=${handleModeToggle}>
          <span>${mode}</span>
        </button>
        <button class="btn-icon-pill" id="btn-close-right-panel" title="Close panel" data-i18n-title="panel.close" onClick=${handleClose}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>

      <div class="right-panel-artwork-box" id="right-panel-artwork-box">
        <div class="cover-container" id="cover-container">
          <img
            src=${hasThumb ? track.thumb : ''}
            alt=""
            class=${`right-panel-cover ${hasThumb ? '' : 'hidden'}`}
            id="right-panel-cover"
            onError=${() => setImgFailed(true)}
          />
          <div class=${`right-panel-cover-fallback ${hasThumb ? 'hidden' : ''}`} id="right-panel-fallback">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"></circle>
              <polygon points="10 8 16 12 10 16 10 8"></polygon>
            </svg>
          </div>
          <div class="vinyl-overlay hidden" id="vinyl-overlay"></div>
          <button id="btn-right-panel-art" title="Change cover/banner for this track" aria-label="Change cover/banner for this track" onClick=${handleArtClick}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
              <circle cx="8.5" cy="8.5" r="1.5"></circle>
              <polyline points="21 15 16 10 5 21"></polyline>
            </svg>
          </button>
        </div>
        <div class="right-panel-meta">
          <div class="right-panel-title-row" style="display: flex; align-items: center; justify-content: space-between; gap: 6px; min-width: 0;">
            <h3 class="right-panel-title" id="right-panel-title" style="flex: 1; min-width: 0;">${track.title || 'No track playing'}</h3>
          </div>
          <span class="right-panel-artist" id="right-panel-artist">${track.artist || 'Select a track to listen'}</span>
        </div>
      </div>

      <div class="lyrics-section">
        <div class="lyrics-container" id="lyrics-container"></div>
      </div>
    `;
  }

  window.mountPreactRightPanel = function(container, options = {}) {
    if (!container) return null;
    container.innerHTML = '';
    render(html`<${RightPanel} ...${options} />`, container);
    return {
      updateTrack: (t) => window.__rightPanelUpdateTrack && window.__rightPanelUpdateTrack(t),
      updateSpeed: (s) => window.__rightPanelUpdateSpeed && window.__rightPanelUpdateSpeed(s),
      updateMode: (m) => window.__rightPanelUpdateMode && window.__rightPanelUpdateMode(m)
    };
  };

  window.RightPanelComponent = RightPanel;
})();
