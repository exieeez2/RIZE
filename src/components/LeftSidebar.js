/**
 * LeftSidebar Component (Preact + HTM)
 * Lightweight reactive replacement for the left navigation rail.
 * Maintains 100% of Dotify / Material You tokens, IDs, and styling classes.
 */
(function() {
  const preact = window.htmPreact;
  if (!preact) {
    console.error('[LeftSidebar] Preact HTM vendor bundle not found on window.htmPreact');
    return;
  }

  const { html, render, useState, useEffect, useCallback } = preact;

  function LeftSidebar(props) {
    const [currentView, setCurrentView] = useState(props.initialView || 'discover');
    const [favCount, setFavCount] = useState(props.initialFavCount || 0);
    const [pins, setPins] = useState(props.initialPins || []);

    useEffect(() => {
      window.__leftSidebarUpdateView = (view) => setCurrentView(view);
      window.__leftSidebarUpdateCount = (count) => setFavCount(count);
      window.__leftSidebarUpdatePins = (newPins) => setPins(newPins || []);

      return () => {
        delete window.__leftSidebarUpdateView;
        delete window.__leftSidebarUpdateCount;
        delete window.__leftSidebarUpdatePins;
      };
    }, []);

    const handleNav = useCallback((view, e) => {
      e?.preventDefault();
      e?.stopPropagation();
      setCurrentView(view);
      if (typeof props.onNavigate === 'function') {
        props.onNavigate(view);
      } else if (typeof window.switchView === 'function') {
        window.switchView(view);
      }
    }, [props]);

    return html`
      <nav class="sidebar-nav">
        <div class="nav-active-indicator" id="nav-active-indicator"></div>

        <button
          class=${`nav-item ${currentView === 'discover' ? 'active' : ''}`}
          data-view="discover"
          id="nav-discover"
          title="Поиск"
          data-i18n-title="nav.home"
          onClick=${(e) => handleNav('discover', e)}
        >
          <div class="nav-indicator">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 3.5L3.5 10v9.5a1 1 0 0 0 1 1h15a1 1 0 0 0 1-1V10L12 3.5z"/>
              <circle cx="12" cy="14" r="1.5" fill="currentColor" stroke="none"/>
            </svg>
          </div>
        </button>

        <button
          class=${`nav-item ${currentView === 'favorites' ? 'active' : ''}`}
          data-view="favorites"
          id="nav-favorites"
          title="Моя медиатека"
          data-i18n-title="nav.library"
          onClick=${(e) => handleNav('favorites', e)}
        >
          <div class="nav-indicator">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
            </svg>
            <span class="nav-badge" id="favorites-count">${favCount}</span>
          </div>
        </button>

        <button
          class=${`nav-item ${currentView === 'settings' ? 'active' : ''}`}
          data-view="settings"
          id="nav-settings"
          title="Настройки"
          data-i18n-title="nav.settings"
          onClick=${(e) => handleNav('settings', e)}
        >
          <div class="nav-indicator">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="3"></circle>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
            </svg>
          </div>
        </button>
      </nav>

      <div class="sidebar-divider" style="width: 32px; height: 1px; background: rgba(255, 255, 255, 0.12); margin: 12px auto; flex-shrink: 0;"></div>
      <div class="sidebar-pins" id="sidebar-pins" aria-label="Закреплённые плейлисты" data-i18n-aria="nav.pins"></div>
    `;
  }

  window.mountPreactLeftSidebar = function(container, options = {}) {
    if (!container) return null;
    container.innerHTML = '';
    render(html`<${LeftSidebar} ...${options} />`, container);
    return {
      updateView: (v) => window.__leftSidebarUpdateView && window.__leftSidebarUpdateView(v),
      updateCount: (c) => window.__leftSidebarUpdateCount && window.__leftSidebarUpdateCount(c),
      updatePins: (p) => window.__leftSidebarUpdatePins && window.__leftSidebarUpdatePins(p)
    };
  };

  window.LeftSidebarComponent = LeftSidebar;
})();
