/**
 * TopSearchBar Component (Preact + HTM)
 * Lightweight reactive replacement for the top header search bar.
 * Maintains 100% of Dotify / Material You tokens, IDs, and styling classes.
 */
(function() {
  const preact = window.htmPreact;
  if (!preact) {
    console.error('[TopSearchBar] Preact HTM vendor bundle not found on window.htmPreact');
    return;
  }

  const { html, render, useState, useEffect, useCallback, useRef } = preact;

  function TopSearchBar(props) {
    const [query, setQuery] = useState(props.initialQuery || '');
    const debounceTimerRef = useRef(null);

    useEffect(() => {
      window.__topSearchBarUpdateQuery = (q) => setQuery(q || '');

      return () => {
        delete window.__topSearchBarUpdateQuery;
      };
    }, []);

    const triggerSearch = useCallback((val) => {
      if (typeof props.onSearch === 'function') {
        props.onSearch(val);
      } else if (typeof window.executeSearch === 'function') {
        window.executeSearch(val);
      }
    }, [props]);

    const handleInput = useCallback((e) => {
      const val = e.target.value;
      setQuery(val);
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = setTimeout(() => {
        triggerSearch(val);
      }, 300);
    }, [triggerSearch]);

    const handleKeyDown = useCallback((e) => {
      if (e.key === 'Enter') {
        if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
        triggerSearch(query);
      } else if (e.key === 'Escape') {
        setQuery('');
        triggerSearch('');
      }
    }, [query, triggerSearch]);

    const handleClear = useCallback((e) => {
      e?.preventDefault();
      e?.stopPropagation();
      setQuery('');
      triggerSearch('');
      const input = document.getElementById('search-input');
      if (input) {
        input.value = '';
        input.focus();
      }
    }, [triggerSearch]);

    const handleSearchClick = useCallback(() => {
      triggerSearch(query);
    }, [query, triggerSearch]);

    return html`
      <div class="search-box">
        <button
          id="search-icon-btn"
          class="search-icon-btn"
          title="Search"
          type="button"
          onClick=${handleSearchClick}
        >
          <svg class="search-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="11" cy="11" r="7"></circle>
            <line x1="21" y1="21" x2="16.5" y2="16.5"></line>
          </svg>
        </button>
        <input
          type="text"
          id="search-input"
          placeholder="Search songs, artists, albums..."
          autocomplete="off"
          value=${query}
          onInput=${handleInput}
          onKeyDown=${handleKeyDown}
        />
        <button
          id="search-clear-btn"
          class=${`search-clear-btn ${query ? '' : 'hidden'}`}
          title="Clear"
          type="button"
          onClick=${handleClear}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
    `;
  }

  window.mountPreactTopSearchBar = function(container, options = {}) {
    if (!container) return null;
    container.innerHTML = '';
    render(html`<${TopSearchBar} ...${options} />`, container);
    return {
      updateQuery: (q) => window.__topSearchBarUpdateQuery && window.__topSearchBarUpdateQuery(q)
    };
  };

  window.TopSearchBarComponent = TopSearchBar;
})();
