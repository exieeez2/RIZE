import re

with open('/home/exieeez/Загрузки/rize(2).html', 'r', encoding='utf-8') as f:
    orig = f.read()

# 1. Edge-to-edge styles, touch ergonomics, and status bar padding
css_old = """    body {
      min-height: 100dvh;
      background: #121212;
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      color: #f2f2f2;
      padding: 16px;
    }

    .phone-frame {
      position: relative;
      width: 100%;
      max-width: 390px;
      height: 844px;
      max-height: calc(100dvh - 32px);
      background: #0a0a0a;
      border-radius: 40px;
      overflow: hidden;
      box-shadow: 0 24px 60px rgba(0, 0, 0, 0.65), 0 0 0 1px rgba(255, 255, 255, 0.08);
      display: flex;
      flex-direction: column;
    }"""

css_new = """    body {
      margin: 0;
      padding: 0;
      width: 100vw;
      height: 100vh;
      height: 100dvh;
      background: #000000;
      display: flex;
      align-items: stretch;
      justify-content: stretch;
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      color: #f2f2f2;
      overflow: hidden;
      user-select: none;
      -webkit-user-select: none;
    }

    .phone-frame {
      position: relative;
      width: 100%;
      max-width: 100%;
      height: 100%;
      max-height: 100%;
      background: #000000;
      border-radius: 0;
      overflow: hidden;
      box-shadow: none;
      display: flex;
      flex-direction: column;
    }

    /* Never shrink artwork on pause */
    .full-player.is-paused .fp-art {
      transform: none !important;
    }

    /* Hide popup toasts per user request */
    .fp-toast {
      display: none !important;
    }"""

html = orig.replace(css_old, css_new)

# Eliminate default purple gradient and replace with neutral dark gradient
html = html.replace("background: linear-gradient(180deg, #3c2772 0%, #2b1d54 52%, #171033 100%);",
                    "background: linear-gradient(180deg, #181920 0%, #101116 52%, #0a0a0c 100%);")
html = html.replace("themeBg: 'linear-gradient(180deg, #3c2772 0%, #2b1d54 52%, #171033 100%)'",
                    "themeBg: 'linear-gradient(180deg, #181920 0%, #101116 52%, #0a0a0c 100%)'")

# Eliminate any pause scale in original CSS
html = re.sub(
    r'\.full-player\.is-paused\s+\.fp-art\s*\{\s*transform:\s*scale\([^)]+\);\s*\}',
    '.full-player.is-paused .fp-art {\n      transform: none !important;\n    }',
    html
)

# Top drag handle and close chevron with safe status bar insets
drag_old = """    .fp-drag-area {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 52px;
      z-index: 28;
      cursor: pointer;
      display: flex;
      align-items: flex-start;
      justify-content: center;
      padding-top: 12px;
      background: linear-gradient(180deg, rgba(0, 0, 0, 0.1) 0%, rgba(0, 0, 0, 0) 100%);
    }"""

drag_new = """    .fp-drag-area {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: calc(64px + env(safe-area-inset-top, 0px));
      z-index: 28;
      cursor: pointer;
      display: flex;
      align-items: flex-start;
      justify-content: center;
      padding-top: max(16px, env(safe-area-inset-top, 16px));
      background: linear-gradient(180deg, rgba(0, 0, 0, 0.35) 0%, rgba(0, 0, 0, 0) 100%);
    }

    .fp-chevron-close {
      display: none !important;
    }"""

html = html.replace(drag_old, drag_new)

# Safe area for header and body
header_old = """    .full-player[data-mode="lyrics"] .fp-compact-header,
    .full-player[data-mode="queue"] .fp-compact-header {
      max-height: 110px;
      padding: 40px 20px 10px;
      opacity: 1;
      transform: translateX(0);
      pointer-events: auto;
    }"""

header_new = """    .full-player[data-mode="lyrics"] .fp-compact-header,
    .full-player[data-mode="queue"] .fp-compact-header {
      max-height: 125px;
      padding: max(44px, env(safe-area-inset-top, 44px)) 20px 10px;
      opacity: 1;
      transform: translateX(0);
      pointer-events: auto;
    }"""

html = html.replace(header_old, header_new)

body_old = """    .fp-body {
      flex: 1;
      display: flex;
      flex-direction: column;
      padding: 0 20px 16px;
      min-height: 0;
      position: relative;
    }"""

body_new = """    .fp-body {
      flex: 1;
      display: flex;
      flex-direction: column;
      padding: 0 20px max(14px, env(safe-area-inset-bottom, 14px));
      min-height: 0;
      position: relative;
    }"""

html = html.replace(body_old, body_new)

# Enlarge progress bar hit zone for smooth touch scrubbing
prog_css_old = """    .fp-progress-wrap {
      margin-top: 18px;
      flex-shrink: 0;
    }

    .fp-progress-bar {
      width: 100%;
      height: 6px;
      border-radius: 3px;
      background: rgba(255, 255, 255, 0.22);
      cursor: pointer;
      position: relative;
    }"""

prog_css_new = """    .fp-progress-wrap {
      margin-top: 14px;
      padding: 10px 0;
      flex-shrink: 0;
      cursor: pointer;
      touch-action: none;
    }

    .fp-progress-bar {
      width: 100%;
      height: 6px;
      border-radius: 3px;
      background: rgba(255, 255, 255, 0.22);
      cursor: pointer;
      position: relative;
    }
    .fp-progress-bar::before {
      content: '';
      position: absolute;
      top: -16px;
      bottom: -16px;
      left: 0;
      right: 0;
    }"""

html = html.replace(prog_css_old, prog_css_new)

# Add close chevron button to DOM inside fp-drag-area
drag_dom_old = """      <div class="fp-drag-area" id="closePlayerBtn" title="Вернуться к обложке">
        <div class="fp-drag-handle"></div>
      </div>"""

drag_dom_new = """      <div class="fp-drag-area" id="closePlayerBtn" title="Свернуть плеер">
        <div class="fp-drag-handle"></div>
      </div>"""

html = html.replace(drag_dom_old, drag_dom_new)

# Replace FLAC badge with real OPUS badge
flac_badge_old = """<span class="fp-flac-badge">FLAC · 768,0 KHz</span>"""
flac_badge_new = """<span class="fp-flac-badge" id="fpFormatBadge">OPUS · 160 kbps</span>"""
html = html.replace(flac_badge_old, flac_badge_new)

# Suppress annoying toast notifications per user request
toast_func_old = """    function showToast(msg) {
      const toast = $('fpToast');
      toast.textContent = msg;
      toast.classList.add('show');
      setTimeout(() => toast.classList.remove('show'), 2200);
    }"""
toast_func_new = """    function showToast(msg) {
      /* Toasts suppressed per user request */
    }"""
html = html.replace(toast_func_old, toast_func_new)

# 2. Dynamic Image Loading & Artwork & Color Extractor
makeArtImg_old = """    function makeArtImg(track) {
      const src = realCovers[track.id % realCovers.length];
      return `<img src="${src}" alt="${track.title}" style="width:100%;height:100%;object-fit:cover;display:block;border-radius:inherit;">`;
    }"""

makeArtImg_new = """    let currentNativeTrack = null;
    let currentNextTrack = null;
    let nativeLyrics = null;
    let nativeQueue = null;
    let isNativeControlled = false;
    let isScrubbing = false;
    let lastExtractedCover = '';
    let extractedCoverBg = '';

    function extractCoverGradient(src, callback) {
      if (!src) return;
      if (extractedCoverBg && src === lastExtractedCover) {
        callback(extractedCoverBg);
        return;
      }
      lastExtractedCover = src;
      const img = new Image();
      img.crossOrigin = 'Anonymous';
      img.onload = function() {
        try {
          const cvs = document.createElement('canvas');
          cvs.width = 16; cvs.height = 16;
          const ctx = cvs.getContext('2d');
          ctx.drawImage(img, 0, 0, 16, 16);
          const d = ctx.getImageData(0, 0, 16, 16).data;
          let r = 0, g = 0, b = 0, c = 0;
          for (let i = 0; i < d.length; i += 4) {
            const cr = d[i], cg = d[i+1], cb = d[i+2];
            const br = (cr * 299 + cg * 587 + cb * 114) / 1000;
            if (br > 22 && br < 235) { r += cr; g += cg; b += cb; c++; }
          }
          if (c > 0) {
            r = Math.round(r / c); g = Math.round(g / c); b = Math.round(b / c);
          } else {
            r = 45; g = 50; b = 60;
          }
          const top = `rgb(${r}, ${g}, ${b})`;
          const mid = `rgb(${Math.round(r * 0.48)}, ${Math.round(g * 0.48)}, ${Math.round(b * 0.48)})`;
          const bot = `rgb(12, 13, 16)`;
          extractedCoverBg = `linear-gradient(180deg, ${top} 0%, ${mid} 50%, ${bot} 100%)`;
          if (currentNativeTrack) currentNativeTrack.themeBg = extractedCoverBg;
          callback(extractedCoverBg);
        } catch (err) {
          generateFallback();
        }
      };
      img.onerror = generateFallback;
      function generateFallback() {
        let hash = 0;
        const s = (currentNativeTrack && currentNativeTrack.title) || 'RIZE';
        for (let i = 0; i < s.length; i++) hash = s.charCodeAt(i) + ((hash << 5) - hash);
        const palettes = [
          'linear-gradient(180deg, #1f4239 0%, #112520 52%, #08110f 100%)',
          'linear-gradient(180deg, #442a22 0%, #291813 52%, #120a08 100%)',
          'linear-gradient(180deg, #1c354d 0%, #0f1f2e 52%, #060d14 100%)',
          'linear-gradient(180deg, #421f2f 0%, #26111a 52%, #12080c 100%)',
          'linear-gradient(180deg, #2b2447 0%, #19142b 52%, #0b0914 100%)',
          'linear-gradient(180deg, #252834 0%, #15171f 52%, #090a0d 100%)'
        ];
        extractedCoverBg = palettes[Math.abs(hash) % palettes.length];
        if (currentNativeTrack) currentNativeTrack.themeBg = extractedCoverBg;
        callback(extractedCoverBg);
      }
      img.src = src;
    }

    function makeArtImg(track) {
      if (track && track.cover && (track.cover.startsWith('http') || track.cover.startsWith('data:') || track.cover.startsWith('file:') || track.cover.startsWith('content:'))) {
        return `<img src="${track.cover}" alt="${(track && track.title) || ''}" style="width:100%;height:100%;object-fit:cover;display:block;border-radius:inherit;" onerror="this.onerror=null;this.src='${realCovers[0]}';">`;
      }
      const src = (track && track.id !== undefined && realCovers[track.id % realCovers.length]) || realCovers[0];
      return `<img src="${src}" alt="${(track && track.title) || ''}" style="width:100%;height:100%;object-fit:cover;display:block;border-radius:inherit;">`;
    }"""

html = html.replace(makeArtImg_old, makeArtImg_new)

# 3. Dynamic Render Binding & Persistent Adaptive Background
render_old = """    function render() {
      const track = tracks[state.currentIndex];
      const nextTrack = tracks[(state.currentIndex + 1) % tracks.length];
      const isLiked = !!state.liked[track.id];
      const activeLyricIdx = getActiveLyricIndex(track);
      const activeLyric = track.lyrics[activeLyricIdx] || { text: track.title };

      const fp = $('fullPlayer');
      fp.style.background = track.themeBg;"""

render_new = """    function render() {
      const track = (isNativeControlled && currentNativeTrack) ? currentNativeTrack : tracks[state.currentIndex];
      const nextTrack = (isNativeControlled && currentNextTrack) ? currentNextTrack : tracks[(state.currentIndex + 1) % tracks.length];
      const isLiked = isNativeControlled ? !!state.isFavorite : !!state.liked[track.id];
      const activeLyricIdx = getActiveLyricIndex(track);
      const activeLyric = (track.lyrics && track.lyrics[activeLyricIdx]) || { text: track.title, sub: '' };

      const formatBadge = $('fpFormatBadge');
      if (formatBadge) {
        formatBadge.textContent = (track && track.format) ? track.format : 'OPUS · 160 kbps';
      }

      const fp = $('fullPlayer');
      if (extractedCoverBg) {
        fp.style.background = extractedCoverBg;
      } else if (track.themeBg && !track.themeBg.includes('#3c2772') && !track.themeBg.includes('#2b1d54')) {
        fp.style.background = track.themeBg;
      }

      if (track && track.cover && (!extractedCoverBg || track.cover !== lastExtractedCover)) {
        extractCoverGradient(track.cover, (bg) => {
          const fpEl = $('fullPlayer');
          if (fpEl) fpEl.style.background = bg;
        });
      }"""

html = html.replace(render_old, render_new)

# Handle empty lyrics gracefully in syncLyricsState
lyrics_render_old = """      if (panel.dataset.trackId !== String(track.id)) {
        panel.dataset.trackId = String(track.id);
        lastRenderedLyricIdx = -1;
        panel.innerHTML = track.lyrics.map((l) => `
          <div class="lyric-line" data-seek="${l.time}">
            <div class="lyric-main">${l.text}</div>
            <div class="lyric-sub">${l.sub}</div>
          </div>
        `).join('');
      }"""

lyrics_render_new = """      if (panel.dataset.trackId !== String(track.id)) {
        panel.dataset.trackId = String(track.id);
        lastRenderedLyricIdx = -1;
        if (!track.lyrics || track.lyrics.length === 0) {
          panel.innerHTML = `
            <div class="lyric-line active" style="margin-top:64px;text-align:center;">
              <div class="lyric-main" style="opacity:0.65;font-size:18px;font-weight:500;">Текст песни загружается...</div>
            </div>
          `;
        } else {
          panel.innerHTML = track.lyrics.map((l) => `
            <div class="lyric-line" data-seek="${l.time}">
              <div class="lyric-main">${l.text}</div>
              <div class="lyric-sub">${l.sub || ''}</div>
            </div>
          `).join('');
        }
      }"""

html = html.replace(lyrics_render_old, lyrics_render_new)

# 4. Likes & Heart Burst Bridge
toggleLike_old = """    function toggleLike(fromDoubleTap = false) {
      const id = tracks[state.currentIndex].id;
      state.liked[id] = fromDoubleTap ? true : !state.liked[id];
      if (state.liked[id]) showToast('Added to Library and Liked Songs');
      render();
    }"""

toggleLike_new = """    function toggleLike(fromDoubleTap = false) {
      if (isNativeControlled) {
        state.isFavorite = fromDoubleTap ? true : !state.isFavorite;
        render();
        if (window.RizePlayerBridge && window.RizePlayerBridge.toggleFavorite) {
          window.RizePlayerBridge.toggleFavorite();
        }
        return;
      }
      const id = tracks[state.currentIndex].id;
      state.liked[id] = fromDoubleTap ? true : !state.liked[id];
      render();
    }"""

html = html.replace(toggleLike_old, toggleLike_new)

# 5. Play/Pause Bridge (preserves adaptive cover background on pause)
play_old = """    $('fpMainPlayBtn').addEventListener('click', () => {
      state.isPlaying = !state.isPlaying;
      render();
    });"""

play_new = """    $('fpMainPlayBtn').addEventListener('click', () => {
      state.isPlaying = !state.isPlaying;
      render();
      if (window.RizePlayerBridge && window.RizePlayerBridge.togglePlay) {
        window.RizePlayerBridge.togglePlay();
      }
    });"""

html = html.replace(play_old, play_new)

# 6. Prev / Next Bridge
prev_old = """    $('fpPrevBtn').addEventListener('click', () => {
      state.currentIndex = (state.currentIndex - 1 + tracks.length) % tracks.length;
      state.progress = 0; state.isPlaying = true; render();
    });"""

prev_new = """    $('fpPrevBtn').addEventListener('click', () => {
      if (window.RizePlayerBridge && window.RizePlayerBridge.previous) {
        window.RizePlayerBridge.previous();
      } else {
        state.currentIndex = (state.currentIndex - 1 + tracks.length) % tracks.length;
        state.progress = 0; state.isPlaying = true; render();
      }
    });"""

html = html.replace(prev_old, prev_new)

next_old = """    $('fpNextBtn').addEventListener('click', () => {
      state.currentIndex = state.shuffle ? Math.floor(Math.random() * tracks.length) : (state.currentIndex + 1) % tracks.length;
      state.progress = 0; state.isPlaying = true; render();
    });"""

next_new = """    $('fpNextBtn').addEventListener('click', () => {
      if (window.RizePlayerBridge && window.RizePlayerBridge.next) {
        window.RizePlayerBridge.next();
      } else {
        state.currentIndex = state.shuffle ? Math.floor(Math.random() * tracks.length) : (state.currentIndex + 1) % tracks.length;
        state.progress = 0; state.isPlaying = true; render();
      }
    });"""

html = html.replace(next_old, next_new)

# 7. Progress Bar Touch Scrubbing Bridge (no pause flicker)
prog_old = """    $('fpProgressBar').addEventListener('click', (e) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      state.progress = Math.floor(ratio * tracks[state.currentIndex].duration);
      render();
    });"""

prog_new = """    function updateScrubPos(clientX) {
      const bar = $('fpProgressBar');
      const rect = bar.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      const dur = (isNativeControlled && currentNativeTrack && currentNativeTrack.duration) ? currentNativeTrack.duration : tracks[state.currentIndex].duration;
      state.progress = Math.floor(ratio * dur);
      $('fpCurrentTime').textContent = formatTime(state.progress);
      $('fpProgressFill').style.width = `${ratio * 100}%`;
    }

    const progWrap = document.querySelector('.fp-progress-wrap');
    if (progWrap) {
      progWrap.addEventListener('pointerdown', (e) => {
        isScrubbing = true;
        progWrap.setPointerCapture(e.pointerId);
        updateScrubPos(e.clientX);
      });
      progWrap.addEventListener('pointermove', (e) => {
        if (!isScrubbing) return;
        updateScrubPos(e.clientX);
      });
      const endScrub = (e) => {
        if (!isScrubbing) return;
        isScrubbing = false;
        if (window.RizePlayerBridge && window.RizePlayerBridge.seekTo) {
          window.RizePlayerBridge.seekTo(state.progress);
        }
      };
      progWrap.addEventListener('pointerup', endScrub);
      progWrap.addEventListener('pointercancel', endScrub);
    }"""

html = html.replace(prog_old, prog_new)

# 8. Drag down to collapse & Chevron button
drag_listener_old = """    $('closePlayerBtn').addEventListener('click', () => {
      state.playerMode = 'artwork';
      render();
    });"""

drag_listener_new = """    let touchStartY = 0;
    let touchStartX = 0;
    let touchStartTime = 0;
    $('closePlayerBtn').addEventListener('touchstart', (e) => {
      touchStartY = e.touches[0].clientY;
      touchStartX = e.touches[0].clientX;
      touchStartTime = Date.now();
    }, { passive: true });
    $('closePlayerBtn').addEventListener('touchend', (e) => {
      const deltaY = e.changedTouches[0].clientY - touchStartY;
      const deltaX = Math.abs(e.changedTouches[0].clientX - touchStartX);
      if (deltaY > 28 && deltaX < 90) {
        if (window.RizePlayerBridge && window.RizePlayerBridge.collapse) {
          window.RizePlayerBridge.collapse();
        }
      }
    }, { passive: true });

    $('closePlayerBtn').addEventListener('click', (e) => {
      if (e.target.closest('#fpChevronCloseBtn')) {
        if (window.RizePlayerBridge && window.RizePlayerBridge.collapse) {
          window.RizePlayerBridge.collapse();
        }
        return;
      }
      if (state.playerMode !== 'artwork') {
        state.playerMode = 'artwork';
        render();
      } else {
        if (window.RizePlayerBridge && window.RizePlayerBridge.collapse) {
          window.RizePlayerBridge.collapse();
        }
      }
    });

    const chevronBtn = $('fpChevronCloseBtn');
    if (chevronBtn) {
      chevronBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (window.RizePlayerBridge && window.RizePlayerBridge.collapse) {
          window.RizePlayerBridge.collapse();
        }
      });
    }"""

html = html.replace(drag_listener_old, drag_listener_new)

# 9. Lyrics seek bridge
lyrics_seek_old = """    $('fpLyricsPanel').addEventListener('click', (e) => {
      const line = e.target.closest('[data-seek]');
      if (line) { state.progress = Number(line.dataset.seek); state.isPlaying = true; render(); }
    });"""

lyrics_seek_new = """    $('fpLyricsPanel').addEventListener('click', (e) => {
      const line = e.target.closest('[data-seek]');
      if (line) {
        state.progress = Number(line.dataset.seek);
        state.isPlaying = true;
        render();
        if (window.RizePlayerBridge && window.RizePlayerBridge.seekTo) {
          window.RizePlayerBridge.seekTo(state.progress);
        }
      }
    });"""

html = html.replace(lyrics_seek_old, lyrics_seek_new)

# 10. Shuffle & Repeat Bridge
shuffle_old = """    $('qShuffleBtn').addEventListener('click', () => {
      state.shuffle = !state.shuffle;
      showToast(state.shuffle ? 'Перемешивание включено' : 'Перемешивание выключено');
      render();
    });"""

shuffle_new = """    $('qShuffleBtn').addEventListener('click', () => {
      state.shuffle = !state.shuffle;
      render();
      if (window.RizePlayerBridge && window.RizePlayerBridge.toggleShuffle) {
        window.RizePlayerBridge.toggleShuffle();
      }
    });"""

html = html.replace(shuffle_old, shuffle_new)

repeat_old = """    $('menuRepeatBtn').addEventListener('click', () => {
      state.repeat = !state.repeat;
      render();
    });"""

repeat_new = """    $('menuRepeatBtn').addEventListener('click', () => {
      state.repeat = !state.repeat;
      render();
      if (window.RizePlayerBridge && window.RizePlayerBridge.cycleRepeat) {
        window.RizePlayerBridge.cycleRepeat();
      }
    });"""

html = html.replace(repeat_old, repeat_new)

# 11. Audio Effects Bridge
audio_notify = """
    function notifyAudioEffects() {
      if (window.RizePlayerBridge && window.RizePlayerBridge.setAudioEffects) {
        window.RizePlayerBridge.setAudioEffects(
          state.tempo,
          state.bassBoost,
          state.reverb,
          JSON.stringify(state.eqBands),
          state.eqPreset
        );
      }
    }
"""

html = html.replace("    function applyEqPreset(key) {", audio_notify + "\n    function applyEqPreset(key) {")

html = html.replace("      renderEqSheet();\n      showToast(`Звук: ${cfg.label}`);",
                    "      renderEqSheet();\n      notifyAudioEffects();")

html = html.replace("      state.eqPreset = 'custom';\n      renderEqSheet();\n    });\n    $('eqBassSlider')",
                    "      state.eqPreset = 'custom';\n      renderEqSheet();\n      notifyAudioEffects();\n    });\n    $('eqBassSlider')")

html = html.replace("      state.eqPreset = 'custom';\n      renderEqSheet();\n    });\n    $('eqReverbSlider')",
                    "      state.eqPreset = 'custom';\n      renderEqSheet();\n      notifyAudioEffects();\n    });\n    $('eqReverbSlider')")

html = html.replace("window.addEventListener('pointerup', () => { activeEqBand = null; });",
                    "window.addEventListener('pointerup', () => { if (activeEqBand) { activeEqBand = null; notifyAudioEffects(); } });")

# 12. Disable mock interval when isNativeControlled is active
mock_interval_old = """    setInterval(() => {
      if (!state.isPlaying) return;"""

mock_interval_new = """    setInterval(() => {
      if (!state.isPlaying || isNativeControlled) return;"""

html = html.replace(mock_interval_old, mock_interval_new)

# 12.1. Vocal latency & IPC lead compensation for synchronized lyrics
lyrics_sync_old = """    function getActiveLyricIndex(track) {
      let idx = 0;
      for (let i = 0; i < track.lyrics.length; i++) {
        if (state.progress >= track.lyrics[i].time) idx = i;
      }
      return idx;
    }"""

lyrics_sync_new = """    function getActiveLyricIndex(track) {
      let idx = 0;
      const leadTime = 0.38; /* 380ms lead compensation eliminates vocal lag */
      for (let i = 0; i < track.lyrics.length; i++) {
        if ((state.progress + leadTime) >= track.lyrics[i].time) idx = i;
      }
      return idx;
    }"""

html = html.replace(lyrics_sync_old, lyrics_sync_new)

# 13. Native Bridges (Progress, PlayState, Metadata, AndroidBack, Theme)
native_bridges = """
    window.onNativeThemeUpdate = function(bg) {
      if (!bg) return;
      extractedCoverBg = bg;
      if (currentNativeTrack) {
        currentNativeTrack.themeBg = bg;
        if (currentNativeTrack.cover) {
          lastExtractedCover = currentNativeTrack.cover;
        }
      }
      const fp = $('fullPlayer');
      if (fp) {
        fp.style.background = bg;
      }
    };

    window.onNativePlayStateChange = function(isPlaying) {
      if (isScrubbing) return;
      state.isPlaying = isPlaying;
      const fp = $('fullPlayer');
      if (fp) {
        fp.classList.toggle('is-paused', !state.isPlaying);
        if (extractedCoverBg) {
          fp.style.background = extractedCoverBg;
        } else if (currentNativeTrack && currentNativeTrack.themeBg) {
          fp.style.background = currentNativeTrack.themeBg;
        }
      }
      const playBtn = $('fpMainPlayBtn');
      if (playBtn) {
        playBtn.innerHTML = state.isPlaying
          ? '<svg width="42" height="42" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1.5"/><rect x="14" y="4" width="4" height="16" rx="1.5"/></svg>'
          : '<svg width="42" height="42" viewBox="0 0 24 24" fill="currentColor"><path d="M7 4l13 8-13 8z"></path></svg>';
      }
    };

    window.onNativeProgressUpdate = function(posSec, durSec) {
      if (isScrubbing) return;
      state.progress = posSec;
      if (durSec && durSec > 0 && currentNativeTrack) {
        currentNativeTrack.duration = durSec;
      }
      const dur = (currentNativeTrack && currentNativeTrack.duration) || 180;
      $('fpCurrentTime').textContent = formatTime(state.progress);
      $('fpTotalTime').textContent = formatTime(dur);
      $('fpProgressFill').style.width = `${Math.min(100, (state.progress / dur) * 100)}%`;
      const curTrack = currentNativeTrack || tracks[state.currentIndex];
      syncLyricsState(curTrack, getActiveLyricIndex(curTrack));
    };

    window.onNativeMetadataUpdate = function(payload) {
      if (!payload) return;
      if (typeof payload === 'string') {
        try { payload = JSON.parse(payload); } catch(e) { return; }
      }
      isNativeControlled = true;
      if (payload.track) {
        const coverChanged = !currentNativeTrack || currentNativeTrack.cover !== payload.track.cover;
        if (coverChanged) {
          extractedCoverBg = payload.track.themeBg || '';
          lastExtractedCover = payload.track.cover || '';
        } else if (payload.track.themeBg) {
          extractedCoverBg = payload.track.themeBg;
        }
        currentNativeTrack = {
          id: payload.track.id || 'curr',
          title: payload.track.title || 'RIZE',
          artist: payload.track.artist || 'RIZE',
          cover: payload.track.cover || '',
          duration: payload.track.duration || 180,
          format: payload.track.format || 'OPUS · 160 kbps',
          themeBg: payload.track.themeBg || extractedCoverBg || 'linear-gradient(180deg, #181920 0%, #101116 52%, #0a0a0c 100%)',
          lyrics: payload.lyrics || []
        };
      }
      if (payload.nextTrack) {
        currentNextTrack = payload.nextTrack;
      }
      if (payload.lyrics && Array.isArray(payload.lyrics) && payload.lyrics.length > 0) {
        nativeLyrics = payload.lyrics;
        if (currentNativeTrack) currentNativeTrack.lyrics = nativeLyrics;
      }
      if (payload.queue && Array.isArray(payload.queue)) {
        nativeQueue = payload.queue;
      }
      if (typeof payload.isFavorite === 'boolean') {
        state.isFavorite = payload.isFavorite;
      }
      if (typeof payload.shuffle === 'boolean') {
        state.shuffle = payload.shuffle;
      }
      if (typeof payload.repeat === 'boolean') {
        state.repeat = payload.repeat;
      }
      render();
    };

    window.handleAndroidBack = function() {
      const eq = $('eqSheet');
      if (eq && eq.classList.contains('open')) {
        eq.classList.remove('open');
        return 'handled';
      }
      if (state.playerMode !== 'artwork') {
        state.playerMode = 'artwork';
        render();
        return 'handled';
      }
      if (window.RizePlayerBridge && window.RizePlayerBridge.collapse) {
        window.RizePlayerBridge.collapse();
        return 'handled';
      }
      return 'unhandled';
    };
"""

html = html.replace("    render();\n    renderEqSheet();", native_bridges + "\n    render();\n    renderEqSheet();")

with open('android/app/src/main/assets/rize-web/player.html', 'w', encoding='utf-8') as f:
    f.write(html)

print('Updated android/app/src/main/assets/rize-web/player.html with all fixes successfully!')
