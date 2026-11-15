/**
 * Playbar Component (Preact + HTM)
 * Lightweight (~3 KB) reactive replacement for the bottom playback bar.
 * Maintains 100% of Dotify / Material You design tokens, IDs, and styling classes.
 */
(function() {
  const preact = window.htmPreact;
  if (!preact) {
    console.error('[Playbar] Preact HTM vendor bundle not found on window.htmPreact');
    return;
  }

  const { html, render, useState, useEffect, useRef, useCallback } = preact;

  function formatTime(seconds) {
    if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  function sanitizeStr(str) {
    if (!str || typeof str !== 'string') return '';
    const s = str.trim();
    if (s.length >= 4 && s.length % 2 === 0) {
      const half = s.length / 2;
      if (s.slice(0, half) === s.slice(half)) return s.slice(0, half).trim();
    }
    return s;
  }

  function Playbar(props) {
    const [track, setTrack] = useState(props.initialTrack || {
      title: 'No track playing',
      artist: 'Select a track to listen',
      thumb: '',
      engineBadge: 'OPUS 160K',
      isFav: false,
      duration: 0
    });

    const [playback, setPlayback] = useState(props.initialPlayback || {
      isPlaying: false,
      isBuffering: false,
      currentTime: 0,
      duration: 0
    });

    const [modes, setModes] = useState(props.initialModes || {
      isShuffle: false,
      isRepeat: false,
      lyricsOpen: false,
      hasCustomSettings: false
    });

    const [volumeState, setVolumeState] = useState(props.initialVolume || {
      volume: 0.85,
      isMuted: false
    });

    const [imageError, setImageError] = useState(false);
    const scrubberRef = useRef(null);
    const titleRef = useRef(null);
    const artistRef = useRef(null);

    useEffect(() => {
      const cleanT = sanitizeStr(track.title) || 'No track playing';
      if (titleRef.current) {
        titleRef.current.innerText = '';
        titleRef.current.textContent = cleanT;
      }
    }, [track.title]);

    useEffect(() => {
      const cleanA = sanitizeStr(track.artist) || 'Select a track to listen';
      if (artistRef.current) {
        artistRef.current.innerText = '';
        artistRef.current.textContent = cleanA;
      }
    }, [track.artist]);

    // Register updater hooks to window for bi-directional reactivity
    useEffect(() => {
      window.__playbarUpdateTrack = (t) => {
        setImageError(false);
        const title = sanitizeStr(t.title);
        const artist = sanitizeStr(t.artist);
        setTrack(prev => ({
          ...prev,
          ...t,
          ...(title ? { title } : {}),
          ...(artist ? { artist } : {})
        }));
      };
      window.__playbarUpdatePlayback = (p) => setPlayback(prev => ({ ...prev, ...p }));
      window.__playbarUpdateModes = (m) => setModes(prev => ({ ...prev, ...m }));
      window.__playbarUpdateVolume = (v) => setVolumeState(prev => ({ ...prev, ...v }));

      return () => {
        delete window.__playbarUpdateTrack;
        delete window.__playbarUpdatePlayback;
        delete window.__playbarUpdateModes;
        delete window.__playbarUpdateVolume;
      };
    }, []);

    const hasArtwork = Boolean(track.thumb && !imageError);
    const displayVolume = volumeState.isMuted ? 0 : volumeState.volume;
    const volumePct = Math.round(displayVolume * 100);

    const handleImgError = useCallback(() => {
      setImageError(true);
      if (typeof props.onArtworkError === 'function') {
        props.onArtworkError();
      }
    }, [props]);

    const handlePlayPause = useCallback((e) => {
      e?.preventDefault();
      e?.stopPropagation();
      if (typeof props.onPlayPause === 'function') {
        props.onPlayPause();
      } else if (typeof window.togglePlayPause === 'function') {
        window.togglePlayPause();
      }
    }, [props]);

    const handlePrev = useCallback((e) => {
      e?.stopPropagation();
      if (typeof props.onPrev === 'function') props.onPrev();
    }, [props]);

    const handleNext = useCallback((e) => {
      e?.stopPropagation();
      if (typeof props.onNext === 'function') props.onNext();
    }, [props]);

    const handleShuffle = useCallback((e) => {
      e?.stopPropagation();
      if (typeof props.onToggleShuffle === 'function') props.onToggleShuffle();
    }, [props]);

    const handleRepeat = useCallback((e) => {
      e?.stopPropagation();
      if (typeof props.onToggleRepeat === 'function') props.onToggleRepeat();
    }, [props]);

    const handleFav = useCallback((e) => {
      e?.stopPropagation();
      if (typeof props.onToggleFav === 'function') props.onToggleFav();
    }, [props]);

    const handleAddToPlaylist = useCallback((e) => {
      e?.stopPropagation();
      if (typeof props.onAddToPlaylist === 'function') props.onAddToPlaylist();
    }, [props]);

    const handleEditTrack = useCallback((e) => {
      e?.stopPropagation();
      if (typeof props.onEditTrack === 'function') props.onEditTrack();
    }, [props]);

    const handleDownload = useCallback((e) => {
      e?.stopPropagation();
      if (typeof props.onDownloadTrack === 'function') props.onDownloadTrack();
    }, [props]);

    const handleToggleLyrics = useCallback((e) => {
      e?.stopPropagation();
      if (typeof props.onToggleLyrics === 'function') props.onToggleLyrics();
    }, [props]);

    const handleOpenSettings = useCallback((e) => {
      e?.stopPropagation();
      if (typeof props.onOpenSettings === 'function') props.onOpenSettings();
    }, [props]);

    const handleMute = useCallback((e) => {
      e?.stopPropagation();
      if (typeof props.onToggleMute === 'function') props.onToggleMute();
    }, [props]);

    const handleVolumeInput = useCallback((e) => {
      const val = parseFloat(e.target.value);
      setVolumeState(prev => ({ ...prev, volume: val, isMuted: false }));
      if (typeof props.onVolumeChange === 'function') props.onVolumeChange(val);
    }, [props]);

    const handleArtistClick = useCallback((e) => {
      e?.stopPropagation();
      if (typeof props.onArtistClick === 'function') props.onArtistClick(track.artist);
    }, [props, track.artist]);

    const handleArtworkClick = useCallback((e) => {
      e?.stopPropagation();
      if (typeof props.onArtworkClick === 'function') props.onArtworkClick();
    }, [props]);

    return html`
      <div class="playbar-left">
        <div class="artwork-wrapper" id="playbar-artwork-wrapper" onClick=${handleArtworkClick}>
          <div class="m3c-wrap" id="m3c-wrap">
            <img
              src=${hasArtwork ? track.thumb : ''}
              alt=""
              class="track-artwork"
              id="playbar-artwork"
              onError=${handleImgError}
            />
            <canvas class="m3c-canvas" id="m3c-canvas"></canvas>
          </div>
          <div
            class="artwork-fallback"
            id="artwork-fallback"
            style=${hasArtwork ? 'display: none;' : 'display: flex;'}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"></circle>
              <polygon points="10 8 16 12 10 16 10 8"></polygon>
            </svg>
          </div>
        </div>

        <div class="track-meta">
          <div class="track-title-marquee">
            <span class="track-title" id="playbar-title" ref=${titleRef} data-orig-title=${sanitizeStr(track.title) || ''}>
              ${sanitizeStr(track.title) || 'No track playing'}
            </span>
          </div>
          <div style="display: flex; align-items: center; gap: 6px;">
            <span class="track-artist" id="playbar-artist" ref=${artistRef} onClick=${handleArtistClick}>
              ${sanitizeStr(track.artist) || 'Select a track to listen'}
            </span>
            <span class="track-engine-badge" id="playbar-engine-badge" title="Аудио-движок">
              ${track.engineBadge || 'OPUS 160K'}
            </span>
          </div>
        </div>

        <button class="btn-icon-pill" id="btn-toggle-fav" title="Favorite" onClick=${handleFav}>
          <svg id="fav-icon" width="18" height="18" viewBox="0 0 24 24"
               fill=${track.isFav ? 'currentColor' : 'none'}
               stroke="currentColor" stroke-width="2">
            <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"></path>
          </svg>
        </button>

        <button class="btn-icon-pill" id="btn-add-to-playlist" title="Добавить в плейлист" aria-label="Добавить в плейлист" onClick=${handleAddToPlaylist}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M14 10H3m11-4H3m6 8H3m15 0v6m3-3h-6"/>
          </svg>
        </button>

        <button class="btn-icon-pill" id="btn-edit-current-track" title="Edit track title and artist" onClick=${handleEditTrack}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 20h9"/>
            <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
          </svg>
        </button>

        <button class="btn-icon-pill" id="btn-playbar-more" title="Download track" onClick=${handleDownload}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <path d="M5 20h14v-2H5v2zM19 9h-4V3H9v6H5l7 7 7-7z"/>
          </svg>
        </button>
      </div>

      <div class="playbar-center">
        <div class="playback-controls">
          <button
            class=${'control-btn' + (modes.isShuffle ? ' active' : '')}
            id="btn-shuffle"
            title="Shuffle"
            onClick=${handleShuffle}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="16 3 21 3 21 8"></polyline>
              <line x1="4" y1="20" x2="21" y2="3"></line>
              <polyline points="21 16 21 21 16 21"></polyline>
              <line x1="15" y1="15" x2="21" y2="21"></line>
              <line x1="4" y1="4" x2="9" y2="9"></line>
            </svg>
          </button>

          <button class="control-btn" id="btn-prev" title="Previous" onClick=${handlePrev}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <polygon points="19 20 9 12 19 4 19 20"></polygon>
              <line x1="5" y1="19" x2="5" y2="5" stroke="currentColor" stroke-width="2.5"></line>
            </svg>
          </button>

          <div class="play-pause-wrapper">
            <button
              class=${'btn-play-pause' + (playback.isPlaying ? ' playing' : '') + (playback.isBuffering ? ' buffering' : '')}
              id="btn-play-pause"
              title="Play or pause"
              onClick=${handlePlayPause}
            >
              <svg
                id="play-icon"
                class=${playback.isPlaying || playback.isBuffering ? 'hidden' : ''}
                width="22" height="22" viewBox="0 0 24 24" fill="currentColor"
              >
                <polygon points="7 5 18 12 7 19"></polygon>
              </svg>

              <svg
                id="pause-icon"
                class=${!playback.isPlaying || playback.isBuffering ? 'hidden' : ''}
                width="22" height="22" viewBox="0 0 24 24" fill="currentColor"
              >
                <rect x="6" y="5" width="4" height="14" rx="1"></rect>
                <rect x="14" y="5" width="4" height="14" rx="1"></rect>
              </svg>

              <svg
                id="playbar-spinner"
                class=${'m3-circular-progress' + (playback.isBuffering ? '' : ' hidden')}
                viewBox="0 0 48 48"
                style="width: 24px; height: 24px; position: absolute; margin: auto; inset: 0;"
              >
                <circle class="m3-spinner-track" cx="24" cy="24" r="18" fill="none" stroke-width="4"></circle>
                <circle class="m3-spinner-head" cx="24" cy="24" r="18" fill="none" stroke-width="4"></circle>
              </svg>
            </button>
          </div>

          <button class="control-btn" id="btn-next" title="Next" onClick=${handleNext}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <polygon points="5 4 15 12 5 20 5 4"></polygon>
              <line x1="19" y1="5" x2="19" y2="19" stroke="currentColor" stroke-width="2.5"></line>
            </svg>
          </button>

          <button
            class=${'control-btn' + (modes.isRepeat ? ' active' : '')}
            id="btn-repeat"
            title="Repeat"
            onClick=${handleRepeat}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="17 1 21 5 17 9"></polyline>
              <path d="M3 11V9a4 4 0 0 1 4-4h14"></path>
              <polyline points="7 23 3 19 7 15"></polyline>
              <path d="M21 13v2a4 4 0 0 1-4 4H3"></path>
            </svg>
          </button>
        </div>

        <div class="scrubber-bar-wrapper">
          <span class="time-label" id="time-current">${formatTime(playback.currentTime)}</span>
          <div class="scrubber-track-container" id="scrubber-track" ref=${scrubberRef}></div>
          <span class="time-label" id="time-duration">${formatTime(playback.duration)}</span>
        </div>
      </div>

      <div class="playbar-right">
        <div class="visualizer-container" id="visualizer-container" title="Visualizer">
          <canvas id="visualizer-canvas" width="60" height="24"></canvas>
        </div>

        <button
          class=${'btn-icon-pill' + (modes.lyricsOpen ? ' active' : '')}
          id="btn-toggle-lyrics-panel"
          title="Toggle lyrics"
          data-i18n-title="panel.toggleLyrics"
          onClick=${handleToggleLyrics}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M9 18V5l12-2v13"></path>
            <circle cx="6" cy="18" r="3"></circle>
            <circle cx="18" cy="16" r="3"></circle>
          </svg>
        </button>

        <button class="btn-icon-pill" id="btn-open-settings" title="Audio" onClick=${handleOpenSettings}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="4" y1="21" x2="4" y2="14"></line>
            <line x1="4" y1="10" x2="4" y2="3"></line>
            <line x1="12" y1="21" x2="12" y2="12"></line>
            <line x1="12" y1="8" x2="12" y2="3"></line>
            <line x1="20" y1="21" x2="20" y2="16"></line>
            <line x1="20" y1="12" x2="20" y2="3"></line>
            <line x1="1" y1="14" x2="7" y2="14"></line>
            <line x1="9" y1="8" x2="15" y2="8"></line>
            <line x1="17" y1="16" x2="23" y2="16"></line>
          </svg>
          <span class=${'settings-dot' + (modes.hasCustomSettings ? '' : ' hidden')} id="settings-modified-dot"></span>
        </button>

        <div class="volume-control-group">
          <button class="btn-icon-pill" id="btn-volume-mute" title="Mute or unmute" onClick=${handleMute}>
            <svg
              id="volume-icon"
              class=${volumeState.isMuted || volumeState.volume === 0 ? 'hidden' : ''}
              width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
            >
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
              <path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path>
              <path d="M19.07 4.93a10 10 0 0 1 0 14.14"></path>
            </svg>
            <svg
              id="volume-muted-icon"
              class=${volumeState.isMuted || volumeState.volume === 0 ? '' : 'hidden'}
              width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
            >
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
              <line x1="23" y1="9" x2="17" y2="15"></line>
              <line x1="17" y1="9" x2="23" y2="15"></line>
            </svg>
          </button>
          <div class="volume-slider-wrapper">
            <input
              type="range"
              class="volume-range"
              id="volume-slider"
              min="0"
              max="1"
              step="0.01"
              value=${displayVolume}
              style="--volume-pct: ${volumePct}%; --p: ${volumePct}%;"
              onInput=${handleVolumeInput}
            />
          </div>
        </div>
      </div>
    `;
  }

  // Mount function for container
  window.mountPreactPlaybar = function(container, options = {}) {
    if (!container) return null;
    container.innerHTML = '';
    render(html`<${Playbar} ...${options} />`, container);
    return {
      updateTrack: (t) => window.__playbarUpdateTrack && window.__playbarUpdateTrack(t),
      updatePlayback: (p) => window.__playbarUpdatePlayback && window.__playbarUpdatePlayback(p),
      updateModes: (m) => window.__playbarUpdateModes && window.__playbarUpdateModes(m),
      updateVolume: (v) => window.__playbarUpdateVolume && window.__playbarUpdateVolume(v)
    };
  };

  window.PlaybarComponent = Playbar;
})();
