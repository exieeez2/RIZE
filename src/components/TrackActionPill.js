/**
 * TrackActionPill Component (Preact + HTM)
 * Floating Glass Action Capsule for playlist and library track rows.
 * Maintains 100% of Material You tokens, IDs, and styling classes.
 */
(function() {
  const preact = window.htmPreact;
  if (!preact) {
    return;
  }

  const { html, render, useState, useEffect, useCallback } = preact;

  function TrackActionPill(props) {
    const { track, context, isFav: initialFav, onFav, onArt, onPlaylist, onMore, onClose } = props;
    const [isFav, setIsFav] = useState(Boolean(initialFav));
    const [isOpen, setIsOpen] = useState(false);

    useEffect(() => {
      const raf = requestAnimationFrame(() => setIsOpen(true));
      return () => cancelAnimationFrame(raf);
    }, []);

    const isLocal = track && track.platform === 'local';
    const isPlaylist = context === 'playlist';
    const isFavList = context === 'favorites';

    const handleFavClick = useCallback((e) => {
      e.stopPropagation();
      const nextFav = !isFav;
      setIsFav(nextFav);
      if (typeof onFav === 'function') onFav(track, nextFav);
    }, [isFav, onFav, track]);

    const handleArtClick = useCallback((e) => {
      e.stopPropagation();
      if (typeof onArt === 'function') onArt(track);
    }, [onArt, track]);

    const handlePlaylistClick = useCallback((e) => {
      e.stopPropagation();
      if (typeof onPlaylist === 'function') onPlaylist(track);
    }, [onPlaylist, track]);

    const handleMoreClick = useCallback((e) => {
      e.stopPropagation();
      if (typeof onMore === 'function') onMore(track);
    }, [onMore, track]);

    const handleCloseClick = useCallback((e) => {
      e.stopPropagation();
      if (typeof onClose === 'function') onClose(track);
    }, [onClose, track]);

    const closeTitle = isPlaylist ? 'Удалить из плейлиста' : (isLocal ? 'Удалить из медиатеки' : (isFavList ? 'Удалить из избранного' : 'Закрыть'));
    const isDanger = isPlaylist || isLocal || isFavList;

    return html`
      <div class=${'track-action-pill' + (isOpen ? ' open' : '') + ' row-docked'} id="active-track-action-pill">
        <button
          class=${'pill-action-btn btn-pill-fav' + (isFav ? ' is-fav' : '')}
          id="pill-item-fav"
          title=${isFav ? 'Удалить из избранного' : 'В избранное'}
          aria-label="В избранное"
          onClick=${handleFavClick}
          type="button"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill=${isFav ? 'currentColor' : 'none'} stroke="currentColor" stroke-width="2">
            <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"></path>
          </svg>
        </button>

        <button
          class="pill-action-btn btn-pill-art"
          id="pill-item-art"
          title="Настроить обложку и баннер"
          aria-label="Настроить обложку и баннер"
          onClick=${handleArtClick}
          type="button"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
            <circle cx="8.5" cy="8.5" r="1.5"></circle>
            <polyline points="21 15 16 10 5 21"></polyline>
          </svg>
        </button>

        <button
          class="pill-action-btn btn-pill-add-pl"
          id="pill-item-playlist"
          title="Добавить в плейлист"
          aria-label="Добавить в плейлист"
          onClick=${handlePlaylistClick}
          type="button"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
        </button>

        <button
          class="pill-action-btn btn-pill-more"
          id="pill-item-more"
          title="Скачать трек / Опции"
          aria-label="Скачать трек / Опции"
          onClick=${handleMoreClick}
          type="button"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <circle cx="12" cy="12" r="2"></circle>
            <circle cx="19" cy="12" r="2"></circle>
            <circle cx="5" cy="12" r="2"></circle>
          </svg>
        </button>

        <button
          class=${'pill-action-btn btn-pill-close' + (isDanger ? ' danger' : '')}
          id="pill-item-close"
          title=${closeTitle}
          aria-label="Закрыть"
          onClick=${handleCloseClick}
          type="button"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
    `;
  }

  window.mountTrackActionPill = function(targetContainer, options = {}) {
    if (!targetContainer) return null;
    const mountPoint = document.createElement('div');
    mountPoint.className = 'track-action-pill-mount';
    targetContainer.appendChild(mountPoint);
    render(html`<${TrackActionPill} ...${options} />`, mountPoint);
    return {
      destroy: () => {
        try {
          render(null, mountPoint);
          mountPoint.remove();
        } catch (_) {}
      }
    };
  };

  window.TrackActionPillComponent = TrackActionPill;
})();
