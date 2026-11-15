/**
 * HomeBlocks Component (Preact + HTM)
 * Lightweight reactive replacement for the Discover / Home screen blocks.
 * Delivers exact classic Dotify "Top Charts" and sections layout.
 */
(function() {
  const preact = window.htmPreact;
  if (!preact) {
    console.error('[HomeBlocks] Preact HTM vendor bundle not found on window.htmPreact');
    return;
  }

  const { html, render, useState, useEffect, useCallback } = preact;

  const DEFAULT_CHARTS = [
    { id: '1', title: 'Loser', artist: 'Tame Impala', duration: 223, cover: 'https://e-cdns-images.dzcdn.net/images/cover/500x500-000000-80-0-0.jpg' },
    { id: '2', title: 'Dracula (with JENNIE)', artist: 'Tame Impala', duration: 209, cover: 'https://e-cdns-images.dzcdn.net/images/cover/500x500-000000-80-0-0.jpg' },
    { id: '3', title: "Movin' To The Sun", artist: 'HUGEL', duration: 142, cover: 'https://e-cdns-images.dzcdn.net/images/cover/500x500-000000-80-0-0.jpg' },
    { id: '4', title: 'Self Aware', artist: 'Temper City', duration: 181, cover: 'https://e-cdns-images.dzcdn.net/images/cover/500x500-000000-80-0-0.jpg' },
    { id: '5', title: 'Dai Dai', artist: 'Shakira', duration: 223, cover: 'https://e-cdns-images.dzcdn.net/images/cover/500x500-000000-80-0-0.jpg' },
    { id: '6', title: 'Get Lucky (Radio Edit - feat. Pharrell Williams)', artist: 'Daft Punk', duration: 248, cover: 'https://e-cdns-images.dzcdn.net/images/cover/500x500-000000-80-0-0.jpg' },
    { id: '7', title: 'Billie Jean', artist: 'Michael Jackson', duration: 293, cover: 'https://e-cdns-images.dzcdn.net/images/cover/500x500-000000-80-0-0.jpg' },
    { id: '8', title: 'Skyfall', artist: 'Adele', duration: 286, cover: 'https://e-cdns-images.dzcdn.net/images/cover/500x500-000000-80-0-0.jpg' },
    { id: '9', title: 'Highway to Hell', artist: 'AC/DC', duration: 206, cover: 'https://e-cdns-images.dzcdn.net/images/cover/500x500-000000-80-0-0.jpg' },
    { id: '10', title: 'Unstoppable', artist: 'Sia', duration: 218, cover: 'https://e-cdns-images.dzcdn.net/images/cover/500x500-000000-80-0-0.jpg' },
    { id: '11', title: 'Leave a Light On', artist: 'Tom Walker', duration: 184, cover: 'https://e-cdns-images.dzcdn.net/images/cover/500x500-000000-80-0-0.jpg' },
    { id: '12', title: 'Something Just Like This', artist: 'Coldplay', duration: 247, cover: 'https://e-cdns-images.dzcdn.net/images/cover/500x500-000000-80-0-0.jpg' }
  ];

  function formatDuration(sec) {
    if (!Number.isFinite(sec) || sec <= 0) return '3:30';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  function HomeBlocks(props) {
    const [chartTracks, setChartTracks] = useState(props.initialCharts || DEFAULT_CHARTS);
    const [favorites, setFavorites] = useState(props.initialFavorites || []);

    useEffect(() => {
      window.__homeBlocksUpdateCharts = (tracks) => {
        if (Array.isArray(tracks) && tracks.length > 0) {
          setChartTracks(tracks);
        }
      };
      window.__homeBlocksUpdateFavorites = (favs) => setFavorites(favs || []);

      // Load charts from Rust backend
      const port = (window.appState && window.appState.serverPort) || (window.RIZE_PORT) || 17217;
      fetch(`http://127.0.0.1:${port}/api/charts?limit=25`)
        .then(r => r.json())
        .then(data => {
          const list = Array.isArray(data) ? data : (data.tracks || data.data || []);
          if (list.length > 0) {
            setChartTracks(list.map((t, idx) => ({
              id: t.id || String(idx + 1),
              title: t.title || 'Untitled',
              artist: t.artist || t.artist_name || 'Unknown',
              duration: Number(t.duration) || 210,
              cover: t.cover || t.cover_medium || t.cover_big || t.thumbnail || '',
              url: t.url || ''
            })));
          }
        })
        .catch(() => {});

      return () => {
        delete window.__homeBlocksUpdateCharts;
        delete window.__homeBlocksUpdateFavorites;
      };
    }, []);

    const isFav = useCallback((track) => {
      if (typeof window.isTrackFavorite === 'function') {
        return window.isTrackFavorite(track);
      }
      return favorites.some(f => (f.id && f.id === track.id) || (f.title === track.title && f.artist === track.artist));
    }, [favorites]);

    const handlePlay = useCallback((track, idx, e) => {
      e?.preventDefault();
      if (typeof props.onPlayTrack === 'function') {
        props.onPlayTrack(track, chartTracks, idx);
      } else if (typeof window.playTrack === 'function') {
        window.playTrack(track, chartTracks, idx, 'home');
      }
    }, [chartTracks, props]);

    const handleFav = useCallback((track, e) => {
      e?.preventDefault();
      e?.stopPropagation();
      if (typeof props.onToggleFav === 'function') {
        props.onToggleFav(track);
      } else if (typeof window.toggleFavoriteTrack === 'function') {
        window.toggleFavoriteTrack(track);
        setFavorites([...(window.appState?.favorites || [])]);
      }
    }, [props]);

    const handleMore = useCallback((track, e) => {
      e?.preventDefault();
      e?.stopPropagation();
      const anchor = e.currentTarget;
      if (typeof window.openTrackContextMenu === 'function') {
        window.openTrackContextMenu(track, anchor, 'home', null, chartTracks);
      }
    }, [chartTracks]);

    return html`
      <div class="home-top-charts-container" style="padding: 10px 18px 24px;">
        <h2 class="home-heading" style="font-size: 22px; font-weight: 700; margin-bottom: 16px; color: var(--md-sys-color-on-surface, #ffffff);">
          Top Charts
        </h2>

        <div class="home-top-charts-list" style="display: flex; flex-direction: column; gap: 4px;">
          ${chartTracks.slice(0, 15).map((track, idx) => {
            const favorited = isFav(track);
            const thumbUrl = track.cover || (typeof window.getTrackThumbUrl === 'function' ? window.getTrackThumbUrl(track) : '');
            return html`
              <div
                class="track-row"
                style="display: flex; align-items: center; gap: 14px; padding: 6px 12px; border-radius: 12px; cursor: pointer; transition: background 0.15s;"
                onClick=${(e) => handlePlay(track, idx, e)}
              >
                <span class="track-row-index" style="width: 24px; text-align: center; font-size: 13px; font-weight: 600; color: rgba(255,255,255,0.45); flex-shrink: 0;">
                  ${idx + 1}
                </span>

                <div class="track-row-thumb-wrap" style="width: 44px; height: 44px; border-radius: 8px; overflow: hidden; background: rgba(255,255,255,0.06); flex-shrink: 0; display: flex; align-items: center; justify-content: center;">
                  ${thumbUrl ? html`
                    <img src=${thumbUrl} alt="" style="width: 100%; height: 100%; object-fit: cover;" onError=${(e) => { e.target.style.display = 'none'; }} />
                  ` : html`
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="opacity: 0.4;">
                      <circle cx="12" cy="12" r="10"></circle>
                      <polygon points="10 8 16 12 10 16 10 8"></polygon>
                    </svg>
                  `}
                </div>

                <div class="track-row-info" style="flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px;">
                  <span class="track-row-title" style="font-size: 14px; font-weight: 600; color: #f2f2f5; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                    ${track.title}
                  </span>
                  <span class="track-row-artist" style="font-size: 12px; color: #948f99; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                    ${track.artist}
                  </span>
                </div>

                <div class="track-row-actions" style="display: flex; align-items: center; gap: 4px; flex-shrink: 0;">
                  <button
                    class=${`btn-icon-pill btn-row-fav ${favorited ? 'is-fav' : ''}`}
                    title="Favorite"
                    onClick=${(e) => handleFav(track, e)}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill=${favorited ? 'currentColor' : 'none'} stroke="currentColor" stroke-width="2">
                      <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"></path>
                    </svg>
                  </button>

                  <button
                    class="btn-icon-pill btn-row-more"
                    title="Options"
                    onClick=${(e) => handleMore(track, e)}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                      <circle cx="12" cy="12" r="2"></circle>
                      <circle cx="19" cy="12" r="2"></circle>
                      <circle cx="5" cy="12" r="2"></circle>
                    </svg>
                  </button>
                </div>

                <span class="track-row-duration" style="font-size: 13px; color: rgba(255,255,255,0.5); min-width: 38px; text-align: right; flex-shrink: 0;">
                  ${formatDuration(track.duration)}
                </span>
              </div>
            `;
          })}
        </div>
      </div>
    `;
  }

  window.mountPreactHomeBlocks = function(container, options = {}) {
    if (!container) return null;
    container.innerHTML = '';
    render(html`<${HomeBlocks} ...${options} />`, container);
    return {
      updateCharts: (c) => window.__homeBlocksUpdateCharts && window.__homeBlocksUpdateCharts(c),
      updateFavorites: (f) => window.__homeBlocksUpdateFavorites && window.__homeBlocksUpdateFavorites(f)
    };
  };

  window.HomeBlocksComponent = HomeBlocks;
})();
