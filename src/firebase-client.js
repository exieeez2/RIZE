(() => {
  const DEFAULT_AVATAR = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='128' height='128' viewBox='0 0 128 128'><defs><linearGradient id='dag' x1='0%25' y1='0%25' x2='100%25' y2='100%25'><stop offset='0%25' stop-color='%237c4dff'/><stop offset='100%25' stop-color='%23b388ff'/></linearGradient></defs><rect width='128' height='128' rx='64' fill='url(%23dag)'/><text x='64' y='72' font-family='Roboto, system-ui, sans-serif' font-size='56' font-weight='700' fill='%23ffffff' text-anchor='middle' dominant-baseline='central'>E</text></svg>";

  const state = {
    initialized: false,
    available: false,
    error: null,
    auth: null,
    db: null,
    user: null,
    profile: null,
  };
  const authListeners = new Set();

  function getBackendBaseUrl() {
    if (typeof window !== 'undefined') {
      const port = (window.state && window.state.serverPort) || 17217;
      if ((window.location?.hostname === '127.0.0.1' || window.location?.hostname === 'localhost') && window.location?.port == port) {
        return '';
      }
      return `http://127.0.0.1:${port}`;
    }
    return 'http://127.0.0.1:17217';
  }

  if (typeof window !== 'undefined' && !window.electronAPI) {
    window.electronAPI = {
      _isMock: true,
      signInWithGoogle: async () => {
        try {
          const resp = await fetch(`${getBackendBaseUrl()}/api/auth/google`, {
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
      openExternal: url => {
        if (window.__TAURI__?.opener?.openUrl) {
          window.__TAURI__.opener.openUrl(url);
        } else {
          window.open(url, '_blank');
        }
      },
    };
  }

  const ready = initialize();

  function dispatchAuthState() {
    const detail = { user: publicUser(state.user), profile: state.profile };
    authListeners.forEach(listener => listener(detail));
    window.dispatchEvent(new CustomEvent('votify:auth-changed', { detail }));
    updateAccountUi();
  }

  function publicUser(user) {
    if (!user) return null;
    return {
      uid: user.uid,
      email: user.email || '',
      displayName: user.displayName || '',
      isAnonymous: !!user.isAnonymous,
      emailVerified: !!user.emailVerified,
    };
  }

  const PROFILE_FRAMES = ['none', 'cyberpunk', 'neon', 'sakura', 'fire', 'galaxy', 'pixel', 'magic', 'heart', 'rainbow', 'glow', 'double'];

  function cleanProfile(profile = {}) {
    const bannerRaw = String(profile.banner || '').trim();
    const cursorRaw = String(profile.cursor || '').trim();
    const showcaseImgRaw = String(profile.showcaseImage || '').trim();
    const handleRaw = profile.handle !== undefined
      ? String(profile.handle || '').trim().replace(/^@/, '').toLowerCase().slice(0, 30)
      : undefined;

    const favTrackRaw = profile.favTrack && typeof profile.favTrack === 'object' && profile.favTrack.title ? {
      id: String(profile.favTrack.id || '').slice(0, 100),
      title: String(profile.favTrack.title || '').slice(0, 120),
      artist: String(profile.favTrack.artist || '').slice(0, 120),
      cover: String(profile.favTrack.cover || '').slice(0, 150000),
      duration: Number(profile.favTrack.duration) || 0,
    } : (profile.favTrack === null ? null : undefined);

    return {
      displayName: String(profile.displayName || '')
        .trim()
        .slice(0, 40),
      ...(handleRaw !== undefined ? { handle: handleRaw } : {}),
      avatar: String(profile.avatar || '').startsWith('data:image/') || String(profile.avatar || '').startsWith('https://')
        ? String(profile.avatar).slice(0, 300000)
        : '',
      about: String(profile.about || '').trim().slice(0, 300),
      banner: bannerRaw.startsWith('data:image/')
        ? bannerRaw.slice(0, 500000)
        : (bannerRaw.startsWith('http://') || bannerRaw.startsWith('https://'))
          ? bannerRaw.slice(0, 1000)
          : oneOf(bannerRaw, ['grad-1','grad-2','grad-3','grad-4','grad-5','grad-6','grad-7','grad-8','grad-9',''], ''),
      frame: oneOf(profile.frame, PROFILE_FRAMES, 'none'),
      cursor: cursorRaw.startsWith('data:image/') ? cursorRaw.slice(0, 80000) : '',
      showcaseImage: showcaseImgRaw.startsWith('data:image/')
        ? showcaseImgRaw.slice(0, 200000)
        : (showcaseImgRaw.startsWith('http://') || showcaseImgRaw.startsWith('https://'))
          ? showcaseImgRaw.slice(0, 1000)
          : '',
      showcaseTitle: String(profile.showcaseTitle || '').trim().slice(0, 60),
      showcaseText: String(profile.showcaseText || '').trim().slice(0, 300),
      status: String(profile.status || '').trim().slice(0, 100),
      tg: String(profile.tg || '').trim().slice(0, 100),
      ds: String(profile.ds || '').trim().slice(0, 100),
      site: String(profile.site || '').trim().slice(0, 200),
      color: String(profile.color !== undefined ? profile.color : '').trim().slice(0, 30),
      ...(favTrackRaw !== undefined ? { favTrack: favTrackRaw } : {}),
    };
  }

  function oneOf(value, allowed, fallback) {
    return allowed.includes(value) ? value : fallback;
  }

  function color(value, fallback) {
    const normalized = String(value || '').trim();
    return /^#[0-9a-f]{6}$/i.test(normalized) ? normalized.toUpperCase() : fallback;
  }

  function integer(value, minimum, maximum, fallback) {
    const number = Number(value);
    return Number.isFinite(number)
      ? Math.max(minimum, Math.min(maximum, Math.round(number)))
      : fallback;
  }

  function httpsUrl(value) {
    const input = String(value || '').trim();
    if (!input || input.length > 2048) return '';
    try {
      const url = new URL(input);
      if (url.protocol !== 'https:' || url.username || url.password) return '';
      return url.toString().slice(0, 2048);
    } catch {
      return '';
    }
  }

  function cleanCoreWorkshopTheme(theme = {}) {
    return {
      primary: color(theme.primary, '#1DB954'),
      background: color(theme.background, '#121212'),
      text: color(theme.text, '#FFFFFF'),
      cards: color(theme.cards, '#181818'),
      borders: color(theme.borders, '#2A2A2A'),
      focus: color(theme.focus, '#1DB954'),
      mode: oneOf(theme.mode, ['dark', 'light', 'system', 'contrast', 'midnight'], 'dark'),
      backgroundPreset: oneOf(
        theme.backgroundPreset,
        [
          'default',
          'grad-1',
          'grad-2',
          'grad-3',
          'grad-4',
          'grad-5',
          'grad-6',
          'grad-7',
          'grad-8',
          'grad-9',
        ],
        'default'
      ),
      backgroundUrl: httpsUrl(theme.backgroundUrl),
      cornerRadius: integer(theme.cornerRadius, 0, 24, 8),
      uiTransparency: integer(theme.uiTransparency, 10, 100, 45),
      backgroundBlur: integer(theme.backgroundBlur, 0, 60, 0),
      particles: oneOf(
        theme.particles || theme.bgParticles,
        ['none', 'snow', 'rain', 'stars', 'dots', 'hearts', 'fireflies', 'sakura', 'network'],
        'none'
      ),
      fontFamily: oneOf(
        theme.fontFamily,
        [
          'system',
          'modern',
          'serif',
          'mono',
          'hand',
          'deco',
          'game',
          'inter',
          'roboto',
          'helvetica',
          'sf',
          'jakarta',
          'default',
        ],
        'inter'
      ),
    };
  }

  function cleanWorkshopTheme(theme = {}) {
    const boolean = (value, fallback = true) => (typeof value === 'boolean' ? value : (value !== undefined ? !!value : fallback));
    const str = (value, fallback = '') => (typeof value === 'string' && value.trim() ? value.trim() : fallback);

    return {
      primary: color(theme.primary, '#1DB954'),
      background: color(theme.background, '#121212'),
      text: color(theme.text, '#FFFFFF'),
      cards: color(theme.cards, '#181818'),
      borders: color(theme.borders, '#2A2A2A'),
      focus: color(theme.focus, '#1DB954'),
      mode: oneOf(theme.mode, ['dark', 'light', 'system', 'contrast', 'midnight'], 'dark'),
      backgroundPreset: oneOf(
        theme.backgroundPreset,
        [
          'default',
          'grad-1',
          'grad-2',
          'grad-3',
          'grad-4',
          'grad-5',
          'grad-6',
          'grad-7',
          'grad-8',
          'grad-9',
        ],
        'default'
      ),
      backgroundUrl: httpsUrl(theme.backgroundUrl),
      cornerRadius: integer(theme.cornerRadius, 0, 24, 8),
      uiTransparency: integer(theme.uiTransparency, 10, 100, 45),
      uiScale: integer(theme.uiScale, 50, 150, 100),
      backgroundBlur: integer(theme.backgroundBlur, 0, 60, 0),
      dynamicPlayerBg: boolean(theme.dynamicPlayerBg, true),
      accentGlow: boolean(theme.accentGlow, true),
      cursorGlow: boolean(theme.cursorGlow, false),
      animations: boolean(theme.animations, true),
      particles: oneOf(
        theme.particles || theme.bgParticles,
        ['none', 'snow', 'rain', 'stars', 'dots', 'hearts', 'fireflies', 'sakura', 'network'],
        'none'
      ),
      particleCount: integer(theme.particleCount, 10, 200, 50),
      particleSpeed: integer(theme.particleSpeed, 5, 50, 15),
      particleSize: integer(theme.particleSize, 1, 10, 3),
      particleParallax: boolean(theme.particleParallax, true),
      perfParticles: boolean(theme.perfParticles, true),
      fontFamily: oneOf(
        theme.fontFamily,
        [
          'system',
          'modern',
          'serif',
          'mono',
          'hand',
          'deco',
          'game',
          'inter',
          'roboto',
          'helvetica',
          'sf',
          'jakarta',
          'default',
        ],
        'inter'
      ),
      fontSize: str(theme.fontSize, '16px'),
      cursorPreset: oneOf(
        theme.cursorPreset,
        ['none', 'glow', 'trail', 'fire', 'matrix', 'rainbow', 'heart', 'star', 'cat', 'custom'],
        'none'
      ),
      playerStyle: oneOf(
        theme.playerStyle,
        ['standard', 'compact', 'vinyl', 'minimal', 'cards', 'full', 'modern', 'glass', 'large', 'neon'],
        'standard'
      ),
      playerTitleAlign: oneOf(theme.playerTitleAlign, ['left', 'center', 'right'], 'center'),
      playerSliderType: oneOf(theme.playerSliderType, ['normal', 'thin', 'wave', 'ios'], 'normal'),
      playerCoverShape: str(theme.playerCoverShape, 'Закруглённый квадрат'),
      coverAnimation: str(theme.coverAnimation, 'none'),
      coverEffects: str(theme.coverEffects, 'none'),
      dynamicAccentColor: boolean(theme.dynamicAccentColor, true),
      coverInPlayer: boolean(theme.coverInPlayer, true),
      miniBg: oneOf(theme.miniBg, ['theme', 'cover', 'transparent', 'accent', 'dark', 'cover-color'], 'theme'),
      miniProgress: oneOf(theme.miniProgress, ['line', 'circle', 'hidden', 'wave', 'dots', 'bg', 'cover'], 'line'),
      miniCover: oneOf(theme.miniCover, ['default', 'hidden', 'circle', 'rounded', 'round', 'square'], 'default'),
      miniBorder: oneOf(theme.miniBorder, ['default', 'none', 'accent', 'glow', 'capsule'], 'default'),
    };
  }

  async function initialize() {
    try {
      if (!window.firebase) throw new Error('Firebase SDK не загружен');
      let config = null;
      try {
        const response = await fetch(`${getBackendBaseUrl()}/api/firebase/config`, { cache: 'no-store' });
        if (response.ok) {
          const payload = await response.json().catch(() => ({}));
          config = payload.config;
        }
      } catch (e) {
        console.warn('[Firebase] fetch config error:', e);
      }

      if (!config) {
        config = {
          apiKey: 'AIzaSyBSRslJWfFlpgX3Sm3_RbXEILtj2PL0A-k',
          authDomain: 'votify-f461a.firebaseapp.com',
          projectId: 'votify-f461a',
          storageBucket: 'votify-f461a.firebasestorage.app',
          messagingSenderId: '283427548411',
          appId: '1:283427548411:web:dc7c5cfa55240448d6d45e',
        };
      }

      const app = window.firebase.apps.length
        ? window.firebase.app()
        : window.firebase.initializeApp(config);
      state.auth = window.firebase.auth(app);
      state.db = window.firebase.firestore(app);
      await state.auth.setPersistence(window.firebase.auth.Auth.Persistence.LOCAL);
      state.available = true;

      let profileUnsub = null;
      let usersUnsub = null;
      let libraryUnsub = null;
      let historyUnsub = null;
      let initialAuthStateHandled = false;

      state.auth.onAuthStateChanged(async user => {
        if (profileUnsub) { profileUnsub(); profileUnsub = null; }
        if (usersUnsub) { usersUnsub(); usersUnsub = null; }
        if (libraryUnsub) { libraryUnsub(); libraryUnsub = null; }
        if (historyUnsub) { historyUnsub(); historyUnsub = null; }

        state.user = user || null;
        state.profile = user ? await ensureProfile(user).catch(() => null) : null;
        dispatchAuthState();
        updateAccountUi();

        if (user && !user.isAnonymous) {
          const onDocUpdate = (snap) => {
            if (!snap || !snap.exists) return;
            const d = snap.data() || {};
            const cur = state.profile || {};
            let localProf = {};
            try { localProf = JSON.parse(localStorage.getItem('votifyLocalProfile') || '{}'); } catch (_) {}
            const emailPrefix = user.email ? user.email.split('@')[0].toLowerCase() : '';

            let effDisplayName = d.displayName || d.name;
            if (!effDisplayName || effDisplayName.toLowerCase() === emailPrefix) {
              effDisplayName = (cur.displayName && cur.displayName.toLowerCase() !== emailPrefix)
                ? cur.displayName
                : (localProf.displayName && localProf.displayName.toLowerCase() !== emailPrefix)
                  ? localProf.displayName
                  : (effDisplayName || user.displayName || 'Пользователь');
            }

            let effHandle = d.handle || d.username;
            if (!effHandle || effHandle.toLowerCase() === emailPrefix) {
              effHandle = (cur.handle && cur.handle.toLowerCase() !== emailPrefix)
                ? cur.handle
                : (localProf.handle && localProf.handle.toLowerCase() !== emailPrefix)
                  ? localProf.handle
                  : (effHandle || 'user');
            }

            const effAvatar = d.avatar || d.photoUrl || user.photoURL || user.photoUrl || cur.avatar || localProf.avatar || '';
            const effAbout = d.about || d.bio || cur.about || localProf.about || '';
            const effBanner = d.banner !== undefined ? d.banner : (cur.banner !== undefined ? cur.banner : (localProf.banner || ''));
            const effFavTrack = d.favTrack !== undefined ? d.favTrack : (cur.favTrack !== undefined ? cur.favTrack : (localProf.favTrack || null));
            const effTg = d.tg !== undefined ? d.tg : (cur.tg || '');
            const effDs = d.ds !== undefined ? d.ds : (cur.ds || '');
            const effSite = d.site !== undefined ? d.site : (cur.site || '');
            const effStatus = d.status !== undefined ? d.status : (cur.status !== undefined ? cur.status : (localProf.status || ''));
            const effColor = d.color !== undefined ? d.color : (cur.color !== undefined ? cur.color : (localProf.color || ''));

            state.profile = {
              ...cur,
              displayName: effDisplayName,
              name: effDisplayName,
              handle: String(effHandle).trim().replace(/^@/, '').toLowerCase(),
              avatar: effAvatar,
              photoUrl: effAvatar,
              about: effAbout,
              bio: effAbout,
              banner: effBanner,
              favTrack: effFavTrack,
              tg: effTg,
              ds: effDs,
              site: effSite,
              status: effStatus,
              color: effColor,
            };
            try {
              localStorage.setItem('votifyLocalProfile', JSON.stringify(state.profile));
            } catch (e) {}
            dispatchAuthState();
            updateAccountUi();

            // Real-time sync blob check from mobile
            if (d.sync) {
              try {
                const blob = JSON.parse(d.sync);
                window.dispatchEvent(new CustomEvent('votify:cloud-sync-blob-updated', {
                  detail: { blob, updatedAt: d.updatedAt }
                }));
              } catch (e) {}
            }

            // Real-time playlists check from profile/users doc
            if (d.playlists) {
              window.dispatchEvent(new CustomEvent('votify:cloud-library-updated', {
                detail: { playlists: d.playlists, updatedAt: d.updatedAt }
              }));
            }
          };

          try {
            profileUnsub = profileRef(user.uid).onSnapshot(onDocUpdate, () => {});
            usersUnsub = firestoreProfileRef(user.uid).onSnapshot(onDocUpdate, () => {});
            libraryUnsub = syncRef(user.uid, 'library').onSnapshot(snap => {
              if (!snap || !snap.exists) return;
              const d = snap.data() || {};
              window.dispatchEvent(new CustomEvent('votify:cloud-library-updated', {
                detail: { playlists: d.playlists, updatedAt: d.updatedAt }
              }));
            }, () => {});
            historyUnsub = syncRef(user.uid, 'history').onSnapshot(snap => {
              if (!snap || !snap.exists) return;
              const d = snap.data() || {};
              window.dispatchEvent(new CustomEvent('votify:cloud-history-updated', {
                detail: { history: d.history, updatedAt: d.updatedAt }
              }));
            }, () => {});
          } catch (e) {}
        }

        if (!initialAuthStateHandled) {
          initialAuthStateHandled = true;
          const isPreviewHost = /(^|\.)e2b\.app$/.test(location.hostname);
          if (!user && isPreviewHost) window.setTimeout(() => openAuth('auth-login'), 0);
        }
      });
    } catch (error) {
      state.error = error;
      console.warn('[Firebase]', error.message || error);
      updateAccountUi();
      // Браузерное превью (например, песочница Arena): firebase-конфига нет,
      // но окно входа всё равно показываем, чтобы UI первого запуска был виден.
      const isElectron = /electron/i.test(navigator.userAgent || '');
      const isPreviewHost = /(^|\.)e2b\.app$/.test(location.hostname);
      if (!isElectron && isPreviewHost) {
        window.setTimeout(() => openAuth('auth-login'), 200);
      }
    } finally {
      state.initialized = true;
    }
    return state.available;
  }

  async function requireCloud() {
    await ready;
    if (!state.available || !state.auth || !state.db) {
      throw new Error(state.error?.message || 'Облачная синхронизация не настроена');
    }
  }

  async function requireUser() {
    await requireCloud();
    const user = state.auth.currentUser;
    if (!user) throw new Error('Сначала войдите в аккаунт');
    return user;
  }

  async function requirePermanentUser() {
    const user = await requireUser();
    if (user.isAnonymous) throw new Error('Для публикации зарегистрируйте постоянный аккаунт');
    return user;
  }

  function profileRef(uid) {
    return state.db.collection('users').doc(uid);
  }

  function firestoreProfileRef(uid) {
    return state.db.collection('profiles').doc(uid);
  }

  function usernameRef(handleLower) {
    return state.db.collection('usernames').doc(handleLower);
  }

  function syncRef(uid, name) {
    return profileRef(uid).collection('sync').doc(name);
  }

  async function reserveUsername(handle, uid) {
    const handleLower = String(handle || '').toLowerCase().trim().replace(/^@/, '');
    if (!handleLower) return '';
    if (!/^[a-z0-9_]{3,20}$/.test(handleLower)) {
      throw new Error('Юзернейм должен состоять из 3-20 символов (латинские буквы, цифры, _)');
    }
    const ref = usernameRef(handleLower);
    try {
      const snap = await ref.get();
      if (snap && snap.exists) {
        const data = snap.data() || {};
        if (data.uid && data.uid !== uid) {
          const err = new Error('Этот юзернейм уже занят');
          err.code = 'ALREADY_EXISTS';
          throw err;
        }
      }
    } catch (err) {
      if (err?.code === 'ALREADY_EXISTS' || err?.message?.includes('уже занят')) {
        throw err;
      }
      console.warn('reserveUsername read check failed (skipping check):', err);
    }

    try {
      await ref.set({
        uid,
        createdAt: window.firebase.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });
    } catch (err) {
      console.warn('reserveUsername write failed (proceeding with local handle):', err);
    }
    return handleLower;
  }

  async function getUserProfile(uid) {
    if (!uid || !state.db) return null;
    try {
      const [profSnap, userSnap, libSnap] = await Promise.all([
        firestoreProfileRef(uid).get().catch(() => null),
        profileRef(uid).get().catch(() => null),
        syncRef(uid, 'library').get().catch(() => null),
      ]);
      let d = {};
      if (userSnap && userSnap.exists) d = { ...d, ...(userSnap.data() || {}) };
      if (profSnap && profSnap.exists) d = { ...d, ...(profSnap.data() || {}) };

      let playlists = d.playlists || [];
      if ((!playlists || playlists.length === 0) && libSnap && libSnap.exists) {
        const rawPl = libSnap.data()?.playlists;
        if (rawPl && typeof rawPl === 'object') {
          playlists = Object.keys(rawPl).map(k => {
            const tracks = Array.isArray(rawPl[k]) ? rawPl[k] : (rawPl[k]?.tracks || []);
            const cover = rawPl[k]?.cover || (tracks[0] && tracks[0].cover) || '';
            return {
              name: k,
              count: tracks.length,
              cover,
            };
          });
        }
      }

      const name = d.displayName || d.username || (d.email ? d.email.split('@')[0] : 'Пользователь');
      const rawHandle = d.handle || d.username || d.displayName || (d.email ? d.email.split('@')[0] : uid.slice(0, 8));
      const cleanHandle = String(rawHandle).trim().replace(/^@/, '').toLowerCase();
      const ava = (d.avatar && !d.avatar.includes('unsplash.com')) ? d.avatar : ((d.photoUrl && !d.photoUrl.includes('unsplash.com')) ? d.photoUrl : getAvatarUrl(name));

      return {
        uid,
        name,
        handle: '@' + (cleanHandle || uid.slice(0, 8)),
        avatar: ava,
        about: d.about || d.bio || '',
        banner: d.banner || '',
        frame: d.frame || 'none',
        showcaseImage: d.showcaseImage || '',
        showcaseTitle: d.showcaseTitle || '',
        showcaseText: d.showcaseText || '',
        favTrack: d.favTrack || null,
        tg: d.tg || '',
        ds: d.ds || '',
        site: d.site || '',
        status: d.status || '',
        color: d.color || '',
        playlists,
      };
    } catch {
      return null;
    }
  }

  async function ensureProfile(user) {
    if (!user) return null;
    const reference = profileRef(user.uid);
    const fsProfRef = firestoreProfileRef(user.uid);

    let localProfile = {};
    try {
      localProfile = JSON.parse(localStorage.getItem('votifyLocalProfile') || '{}');
    } catch (_) {}
    const savedLogin = getSavedLoginUser() || {};
    const emailPrefix = user.email ? user.email.split('@')[0].toLowerCase() : '';

    let data = {};
    let fetchSuccess = false;
    try {
      const [userSnap, profSnap] = await Promise.all([
        reference.get().catch(() => null),
        fsProfRef.get().catch(() => null),
      ]);

      if (userSnap) {
        fetchSuccess = true;
        if (userSnap.exists) data = { ...data, ...(userSnap.data() || {}) };
      }
      if (profSnap) {
        fetchSuccess = true;
        if (profSnap.exists) data = { ...data, ...(profSnap.data() || {}) };
      }
    } catch (e) {
      console.warn('[Firebase] ensureProfile fetch error:', e);
    }

    // Determine authentic display name (prefer real names over raw email prefix)
    let effectiveDisplayName = '';
    if (emailPrefix === 'vovan232012s') {
      if (data.displayName && data.displayName.toLowerCase() !== emailPrefix && data.displayName !== 'Пользователь') {
        effectiveDisplayName = data.displayName;
      } else if (localProfile.displayName && localProfile.displayName.toLowerCase() !== emailPrefix && localProfile.displayName !== 'Пользователь') {
        effectiveDisplayName = localProfile.displayName;
      } else {
        effectiveDisplayName = 'exieeez';
      }
    } else if (data.displayName && data.displayName.toLowerCase() !== emailPrefix) {
      effectiveDisplayName = data.displayName;
    } else if (data.name && data.name.toLowerCase() !== emailPrefix) {
      effectiveDisplayName = data.name;
    } else if (localProfile.displayName && localProfile.displayName.toLowerCase() !== emailPrefix) {
      effectiveDisplayName = localProfile.displayName;
    } else if (localProfile.name && localProfile.name.toLowerCase() !== emailPrefix) {
      effectiveDisplayName = localProfile.name;
    } else if (savedLogin.displayName && savedLogin.displayName.toLowerCase() !== emailPrefix) {
      effectiveDisplayName = savedLogin.displayName;
    } else if (user.displayName && user.displayName.toLowerCase() !== emailPrefix) {
      effectiveDisplayName = user.displayName;
    } else if (data.displayName || data.name) {
      effectiveDisplayName = data.displayName || data.name;
    } else if (localProfile.displayName || localProfile.name) {
      effectiveDisplayName = localProfile.displayName || localProfile.name;
    } else {
      effectiveDisplayName = emailPrefix || 'Пользователь';
    }

    // Determine authentic handle (prefer real handles like @god over raw email prefix)
    let effectiveHandle = '';
    if (emailPrefix === 'vovan232012s') {
      if (data.handle && data.handle.toLowerCase() !== emailPrefix && data.handle.toLowerCase() !== 'user') {
        effectiveHandle = data.handle;
      } else if (localProfile.handle && localProfile.handle.toLowerCase() !== emailPrefix && localProfile.handle.toLowerCase() !== 'user') {
        effectiveHandle = localProfile.handle;
      } else {
        effectiveHandle = 'god';
      }
    } else if (data.handle && data.handle.toLowerCase() !== emailPrefix) {
      effectiveHandle = data.handle;
    } else if (data.username && data.username.toLowerCase() !== emailPrefix) {
      effectiveHandle = data.username;
    } else if (localProfile.handle && localProfile.handle.toLowerCase() !== emailPrefix) {
      effectiveHandle = localProfile.handle;
    } else if (user.displayName && user.displayName.toLowerCase() !== emailPrefix) {
      effectiveHandle = user.displayName.toLowerCase().replace(/\s+/g, '');
    } else if (data.handle || data.username) {
      effectiveHandle = data.handle || data.username;
    } else if (localProfile.handle) {
      effectiveHandle = localProfile.handle;
    } else {
      effectiveHandle = emailPrefix || 'user';
    }

    const avatarCandidates = [
      data.avatar,
      data.photoUrl,
      user.photoURL,
      user.photoUrl,
      localProfile.avatar,
      localProfile.photoUrl,
      savedLogin.photoUrl
    ];
    let effectiveAvatar = avatarCandidates.find(c => c && !isPlaceholderAvatar(c)) || '';
    const effectiveAbout = data.about || data.bio || localProfile.about || localProfile.bio || '';
    const effectiveBanner = data.banner !== undefined ? data.banner : (localProfile.banner || '');
    const effectiveFavTrack = data.favTrack !== undefined ? data.favTrack : (localProfile.favTrack || null);
    const effectiveTg = data.tg !== undefined ? data.tg : (localProfile.tg || '');
    const effectiveDs = data.ds !== undefined ? data.ds : (localProfile.ds || '');
    const effectiveSite = data.site !== undefined ? data.site : (localProfile.site || '');
    const effectiveStatus = data.status !== undefined ? data.status : (localProfile.status || '');
    const effectiveColor = data.color !== undefined ? data.color : (localProfile.color || '');
    const effectiveFrame = data.frame || localProfile.frame || 'none';
    const effectivePlaylists = (Array.isArray(data.playlists) && data.playlists.length > 0) ? data.playlists : (localProfile.playlists || []);

    const profile = {
      displayName: effectiveDisplayName,
      name: effectiveDisplayName,
      handle: String(effectiveHandle).trim().replace(/^@/, '').toLowerCase(),
      email: user.email || '',
      isAnonymous: !!user.isAnonymous,
      avatar: effectiveAvatar,
      photoUrl: effectiveAvatar,
      about: effectiveAbout,
      bio: effectiveAbout,
      banner: effectiveBanner,
      frame: effectiveFrame,
      cursor: data.cursor || localProfile.cursor || '',
      showcaseImage: data.showcaseImage || localProfile.showcaseImage || '',
      showcaseTitle: data.showcaseTitle || localProfile.showcaseTitle || '',
      showcaseText: data.showcaseText || localProfile.showcaseText || '',
      favTrack: effectiveFavTrack,
      playlists: effectivePlaylists,
      tg: effectiveTg,
      ds: effectiveDs,
      site: effectiveSite,
      status: effectiveStatus,
      color: effectiveColor,
      createdAt: data.createdAt || window.firebase.firestore.FieldValue.serverTimestamp(),
      updatedAt: window.firebase.firestore.FieldValue.serverTimestamp(),
    };

    // If we have an authentic displayName / handle, sync to Firestore and Auth so they are permanently preserved
    if (fetchSuccess && user && !user.isAnonymous) {
      const syncPayload = {
        displayName: effectiveDisplayName,
        name: effectiveDisplayName,
        handle: profile.handle,
        email: user.email || '',
        updatedAt: window.firebase.firestore.FieldValue.serverTimestamp(),
      };
      if (effectiveAvatar) syncPayload.avatar = effectiveAvatar;
      if (effectiveAbout) syncPayload.about = effectiveAbout;
      Promise.all([
        reference.set(syncPayload, { merge: true }).catch(() => {}),
        fsProfRef.set(syncPayload, { merge: true }).catch(() => {}),
      ]).catch(() => {});
      if (effectiveDisplayName && effectiveDisplayName !== user.displayName) {
        user.updateProfile({ displayName: effectiveDisplayName }).catch(() => {});
      }
    }

    try {
      localStorage.setItem('votifyLocalProfile', JSON.stringify(profile));
    } catch (e) {}

    return profile;
  }

  async function register(email, password, displayName) {
    await requireCloud();
    const handleCandidate = String(displayName || email.split('@')[0]).trim();
    const handleLower = handleCandidate.toLowerCase().replace(/^@/, '');

    if (handleLower) {
      const checkSnap = await usernameRef(handleLower).get().catch(() => null);
      if (checkSnap && checkSnap.exists) {
        const err = new Error('Этот юзернейм уже занят');
        err.code = 'ALREADY_EXISTS';
        throw err;
      }
    }

    const current = state.auth.currentUser;
    let credential;
    if (current?.isAnonymous) {
      const emailCredential = window.firebase.auth.EmailAuthProvider.credential(email, password);
      credential = await current.linkWithCredential(emailCredential);
    } else {
      credential = await state.auth.createUserWithEmailAndPassword(email, password);
    }
    const name = String(displayName || email.split('@')[0])
      .trim()
      .slice(0, 40);
    await credential.user.updateProfile({ displayName: name });
    const uid = credential.user.uid;

    let reservedHandle = '';
    if (handleLower) {
      try {
        reservedHandle = await reserveUsername(handleLower, uid);
      } catch (e) {
        if (e.code === 'ALREADY_EXISTS') throw e;
      }
    }

    const profileData = {
      displayName: name,
      handle: reservedHandle || handleLower || uid.slice(0, 8),
      email: credential.user.email || email,
      isAnonymous: false,
      updatedAt: window.firebase.firestore.FieldValue.serverTimestamp(),
    };
    await profileRef(uid).set(profileData, { merge: true });
    await firestoreProfileRef(uid).set(profileData, { merge: true }).catch(() => {});
    state.profile = await ensureProfile(credential.user);
    dispatchAuthState();
    return publicUser(credential.user);
  }

  async function signIn(email, password) {
    await requireCloud();
    const credential = await state.auth.signInWithEmailAndPassword(email, password);
    return publicUser(credential.user);
  }

  async function signInWithGoogle() {
    await requireCloud();
    let oauthResult = null;
    const isDesktop = Boolean(
      window.isTauriEnvironment ||
      window.isDesktop ||
      window.__TAURI__ ||
      window.__TAURI_INTERNALS__ ||
      (window.electronAPI && !window.electronAPI._isMock) ||
      (typeof location !== 'undefined' && (location.port === '17217' || location.hostname === '127.0.0.1' || location.hostname === 'localhost' || location.hostname.endsWith('localhost') || location.protocol === 'tauri:' || location.protocol === 'asset:'))
    );

    try {
      const resp = await fetch(`${getBackendBaseUrl()}/api/auth/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok || data.error) {
        throw new Error(data.error || `Ошибка авторизации через Google (${resp.status})`);
      }
      oauthResult = data;
    } catch (err) {
      if (isDesktop) {
        throw new Error(err.message || 'Не удалось завершить вход Google. Проверьте окно браузера.');
      }
      // In web browser environments only, attempt standard popup login
      if (window.firebase?.auth?.GoogleAuthProvider) {
        try {
          const provider = new window.firebase.auth.GoogleAuthProvider();
          let credential;
          const current = state.auth.currentUser;
          if (current?.isAnonymous) {
            try {
              credential = await current.linkWithPopup(provider);
            } catch (linkErr) {
              const code = linkErr?.code || '';
              if (
                code === 'auth/credential-already-in-use' ||
                code === 'auth/email-already-in-use' ||
                code === 'auth/account-exists-with-different-credential'
              ) {
                credential = await state.auth.signInWithPopup(provider);
              } else {
                throw linkErr;
              }
            }
          } else {
            credential = await state.auth.signInWithPopup(provider);
          }
          state.profile = await ensureProfile(credential.user);
          dispatchAuthState();
          return publicUser(credential.user);
        } catch (popupErr) {
          if (popupErr?.code === 'auth/popup-blocked' || String(popupErr?.message).includes('popup-blocked')) {
            try {
              if (typeof state.auth.signInWithRedirect === 'function') {
                return await state.auth.signInWithRedirect(provider);
              }
            } catch (redirErr) {
              console.warn('[Firebase] redirect fallback error:', redirErr);
            }
            throw new Error('Окно входа заблокировано браузером. Разрешите всплывающие окна или войдите по почте.');
          }
          throw new Error(popupErr.message || err.message);
        }
      }
      throw err;
    }
    if (oauthResult?.error) throw new Error(oauthResult.error);
    if (!oauthResult?.tokens?.idToken) throw new Error('Google не вернул данные аккаунта');

    const googleCredential = window.firebase.auth.GoogleAuthProvider.credential(
      oauthResult.tokens.idToken,
      oauthResult.tokens.accessToken || null
    );
    const current = state.auth.currentUser;
    let credential;
    if (current?.isAnonymous) {
      try {
        credential = await current.linkWithCredential(googleCredential);
      } catch (linkErr) {
        const code = linkErr?.code || '';
        if (
          code === 'auth/credential-already-in-use' ||
          code === 'auth/email-already-in-use' ||
          code === 'auth/account-exists-with-different-credential'
        ) {
          credential = await state.auth.signInWithCredential(googleCredential);
        } else {
          throw linkErr;
        }
      }
    } else {
      credential = await state.auth.signInWithCredential(googleCredential);
    }
    const user = credential.user;
    const ePrefix = user.email ? user.email.split('@')[0].toLowerCase() : '';
    const existingSnap = await profileRef(user.uid).get().catch(() => null);
    const existingData = (existingSnap && existingSnap.exists) ? existingSnap.data() : {};
    let displayName = existingData.displayName || existingData.name;
    if (!displayName || displayName.toLowerCase() === ePrefix) {
      if (ePrefix === 'vovan232012s') {
        displayName = 'exieeez';
      } else {
        displayName = String(user.displayName || ePrefix || 'Пользователь').trim().slice(0, 40);
      }
    }
    const updatePayload = {
      displayName,
      email: user.email || '',
      isAnonymous: false,
      updatedAt: window.firebase.firestore.FieldValue.serverTimestamp(),
    };
    if (ePrefix === 'vovan232012s' && (!existingData.handle || existingData.handle.toLowerCase() === ePrefix)) {
      updatePayload.handle = 'god';
    }
    await profileRef(user.uid).set(updatePayload, { merge: true });
    state.user = user;
    state.profile = await ensureProfile(user);
    dispatchAuthState();
    return publicUser(user);
  }

  async function signInAsGuest() {
    await requireCloud();
    const current = state.auth.currentUser;
    if (current) return publicUser(current);
    const credential = await state.auth.signInAnonymously();
    return publicUser(credential.user);
  }

  async function sendPasswordReset(email) {
    await requireCloud();
    await state.auth.sendPasswordResetEmail(email);
  }

  async function signOut() {
    try {
      if (state.auth && typeof state.auth.signOut === 'function') {
        await state.auth.signOut();
      }
    } catch (err) {
      console.warn('signOut Firebase error (proceeding with local cleanup):', err);
    }
    state.user = null;
    state.profile = null;
    try {
      localStorage.removeItem('votify-user-profile');
      localStorage.removeItem('votifyLocalProfile');
      localStorage.removeItem('devsize_playlists');
      localStorage.removeItem('devsize_favorites');
      localStorage.removeItem('devsize_history');
      localStorage.removeItem('votify-playlists');
    } catch (e) {}
    if (window.state) {
      window.state.playlists = [];
      window.state.favorites = [];
      window.state.history = [];
      if (typeof window.updatePlaylistsUI === 'function') window.updatePlaylistsUI();
      if (typeof window.renderSidebarPins === 'function') window.renderSidebarPins(true);
      if (typeof window.renderLibraryPlaylists === 'function') window.renderLibraryPlaylists();
    }
    notifyAuth();
    updateAccountUi();
  }

  async function saveProfile(profile) {
    const existing = state.profile || {};
    const merged = {
      displayName: profile.displayName !== undefined ? profile.displayName : (existing.displayName || existing.name || ''),
      handle: profile.handle !== undefined ? profile.handle : existing.handle,
      avatar: profile.avatar !== undefined ? profile.avatar : (existing.avatar || existing.photoUrl || ''),
      about: profile.about !== undefined ? profile.about : (existing.about || existing.bio || ''),
      banner: profile.banner !== undefined ? profile.banner : (existing.banner || ''),
      frame: profile.frame !== undefined ? profile.frame : (existing.frame || 'none'),
      favTrack: profile.favTrack !== undefined ? profile.favTrack : (existing.favTrack || null),
      cursor: profile.cursor !== undefined ? profile.cursor : (existing.cursor || ''),
      showcaseImage: profile.showcaseImage !== undefined ? profile.showcaseImage : (existing.showcaseImage || ''),
      showcaseTitle: profile.showcaseTitle !== undefined ? profile.showcaseTitle : (existing.showcaseTitle || ''),
      showcaseText: profile.showcaseText !== undefined ? profile.showcaseText : (existing.showcaseText || ''),
      status: profile.status !== undefined ? profile.status : (existing.status || ''),
      tg: profile.tg !== undefined ? profile.tg : (existing.tg || ''),
      ds: profile.ds !== undefined ? profile.ds : (existing.ds || ''),
      site: profile.site !== undefined ? profile.site : (existing.site || ''),
      color: profile.color !== undefined ? profile.color : (existing.color !== undefined ? existing.color : ''),
    };
    const safe = cleanProfile(merged);
    const user = state.auth?.currentUser;
    if (user) {
      const uid = user.uid;
      const existingHandle = state.profile?.handle || '';
      let handleToSave = safe.handle !== undefined ? safe.handle : existingHandle;
      handleToSave = String(handleToSave).toLowerCase().trim().replace(/^@/, '');
      if (handleToSave && /^[a-z0-9_]{3,20}$/.test(handleToSave)) {
        if (handleToSave !== existingHandle) {
          await reserveUsername(handleToSave, uid);
          if (existingHandle) {
            try {
              const oldRef = usernameRef(existingHandle);
              const oldSnap = await oldRef.get();
              if (oldSnap.exists && oldSnap.data()?.uid === uid) {
                await oldRef.delete();
              }
            } catch (e) {}
          }
        }
        safe.handle = handleToSave;
      } else if (existingHandle) {
        safe.handle = String(existingHandle).toLowerCase().trim().replace(/^@/, '');
      }
      if (safe.displayName && safe.displayName !== user.displayName) {
        await user.updateProfile({ displayName: safe.displayName }).catch(() => {});
      }
      const payload = {
        ...safe,
        name: safe.displayName,
        displayName: safe.displayName,
        avatar: safe.avatar,
        photoUrl: safe.avatar,
        about: safe.about,
        bio: safe.about,
        email: user.email || '',
        isAnonymous: !!user.isAnonymous,
        updatedAt: window.firebase.firestore.FieldValue.serverTimestamp(),
      };
      await Promise.all([
        profileRef(uid).set(payload, { merge: true }).catch(() => {}),
        firestoreProfileRef(uid).set(payload, { merge: true }).catch(() => {}),
      ]).catch(() => {});
    }
    const currentLocal = JSON.parse(localStorage.getItem('votifyLocalProfile') || '{}');
    const updatedLocal = { ...currentLocal, ...safe, name: safe.displayName };
    try {
      localStorage.setItem('votifyLocalProfile', JSON.stringify(updatedLocal));
    } catch (e) {}
    state.profile = { ...(state.profile || {}), ...updatedLocal };
    dispatchAuthState();
    updateAccountUi();
    return state.profile;
  }

  async function searchUsers(query) {
    const q = String(query || '').trim().toLowerCase().replace(/^@/, '');
    if (!q) return [];

    const resultsMap = new Map();

    // 1. Search local friends
    try {
      const localFriends = JSON.parse(localStorage.getItem('votifyLocalFriends') || '[]');
      localFriends.forEach(f => {
        const name = String(f.name || '').toLowerCase();
        const handle = String(f.handle || '').toLowerCase();
        if (name.includes(q) || handle.includes(q)) {
          resultsMap.set(f.uid, f);
        }
      });
    } catch (e) {}

    // 2. Search Firebase if connected
    if (state.available && state.db) {
      try {
        // 2a. Search profiles collection
        const profSnap = await state.db.collection('profiles').limit(40).get().catch(() => null);
        if (profSnap) {
          profSnap.forEach(doc => {
            const d = doc.data() || {};
            const name = String(d.displayName || d.username || '').toLowerCase();
            const handle = String(d.handle || d.username || '').toLowerCase();
            if (name.includes(q) || handle.includes(q)) {
              const h = d.handle || d.username || d.displayName || (d.email ? d.email.split('@')[0] : doc.id.slice(0, 8));
              const dispName = d.displayName || d.username || h;
              const ava = (d.avatar && !d.avatar.includes('unsplash.com')) ? d.avatar : ((d.photoUrl && !d.photoUrl.includes('unsplash.com')) ? d.photoUrl : getAvatarUrl(dispName));
              resultsMap.set(doc.id, {
                uid: doc.id,
                name: dispName,
                handle: '@' + String(h).trim().replace(/^@/, '').toLowerCase(),
                avatar: ava,
                about: d.about || d.bio || '',
              });
            }
          });
        }

        // 2b. Search users collection
        const usersSnap = await state.db.collection('users').limit(40).get().catch(() => null);
        if (usersSnap) {
          usersSnap.forEach(doc => {
            if (resultsMap.has(doc.id)) return;
            const d = doc.data() || {};
            const name = String(d.displayName || d.username || '').toLowerCase();
            const email = String(d.email || '').toLowerCase();
            const handle = String(d.handle || d.username || '').toLowerCase();
            if (name.includes(q) || handle.includes(q) || email.includes(q)) {
              const h = d.handle || d.username || d.displayName || (d.email ? d.email.split('@')[0] : doc.id.slice(0, 8));
              const dispName = d.displayName || d.username || h;
              const ava = (d.avatar && !d.avatar.includes('unsplash.com')) ? d.avatar : ((d.photoUrl && !d.photoUrl.includes('unsplash.com')) ? d.photoUrl : getAvatarUrl(dispName));
              resultsMap.set(doc.id, {
                uid: doc.id,
                name: dispName,
                handle: '@' + String(h).trim().replace(/^@/, '').toLowerCase(),
                avatar: ava,
                about: d.about || d.bio || '',
              });
            }
          });
        }

        // 2c. Search usernames collection
        const uSnap = await usernameRef(q).get().catch(() => null);
        if (uSnap && uSnap.exists) {
          const uData = uSnap.data() || {};
          if (uData.uid && !resultsMap.has(uData.uid)) {
            const p = await getUserProfile(uData.uid);
            if (p) resultsMap.set(uData.uid, p);
          }
        }
      } catch (e) {
        console.warn('[searchUsers]', e);
      }
    }

    const currentUser = getCurrentUser();
    if (currentUser) {
      resultsMap.delete(currentUser.uid);
    }

    return Array.from(resultsMap.values());
  }

  const EXIEEEZ_SIGNATURE_AVATAR = 'https://yt3.googleusercontent.com/5govQTPlE6M7vIa3iXG-xxGDcrNoOPwZbmRAPu6nFVxYWiSaLegbFYoCAXFYO6Vi1zv8sxlYs87mwDc=w512-h512-l90-rj';

  function getAvatarUrl(name, customAvatar) {
    if (customAvatar && !customAvatar.includes('unsplash.com')) return customAvatar;
    const clean = String(name || 'U').trim();
    if (clean.toLowerCase() === 'exieeez' || clean.toLowerCase() === 'god') {
      return EXIEEEZ_SIGNATURE_AVATAR;
    }
    const initial = (clean[0] || 'U').toUpperCase();
    let hash = 0;
    for (let i = 0; i < clean.length; i++) {
      hash = (hash * 31 + clean.charCodeAt(i)) >>> 0;
    }
    const palettes = [
      ['#7c4dff', '#b388ff'],
      ['#651fff', '#8c9eff'],
      ['#a855f7', '#d8b4fe'],
      ['#6366f1', '#a5b4fc'],
      ['#8b5cf6', '#c4b5fd'],
      ['#3b82f6', '#93c5fd']
    ];
    const pair = palettes[hash % palettes.length];
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='128' height='128' viewBox='0 0 128 128'>` +
      `<defs><linearGradient id='ag' x1='0%' y1='0%' x2='100%' y2='100%'><stop offset='0%' stop-color='${pair[0]}'/><stop offset='100%' stop-color='${pair[1]}'/></linearGradient></defs>` +
      `<rect width='128' height='128' rx='64' fill='url(%23ag)'/>` +
      `<text x='64' y='72' font-family='Roboto, Google Sans, Segoe UI, system-ui, sans-serif' font-size='56' font-weight='700' fill='%23ffffff' text-anchor='middle' dominant-baseline='central'>${initial}</text>` +
      `</svg>`;
    return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
  }

  async function addFriend(targetUid, targetName, customAvatar) {
    if (!targetUid) return;
    
    // Save to local storage friends list
    const localFriends = JSON.parse(localStorage.getItem('votifyLocalFriends') || '[]');
    const avatarUrl = getAvatarUrl(targetName, customAvatar);
    if (!localFriends.find(f => f.uid === targetUid || f.name === targetName)) {
      localFriends.push({
        uid: targetUid || ('user_' + Date.now()),
        name: targetName || 'Пользователь',
        handle: '@' + String(targetName || 'user').toLowerCase().replace(/\s+/g, ''),
        avatar: avatarUrl,
        addedAt: Date.now()
      });
      localStorage.setItem('votifyLocalFriends', JSON.stringify(localFriends));
    }

    // Sync to Firestore if logged in
    if (state.available && state.db && state.auth?.currentUser && !state.auth.currentUser.isAnonymous) {
      try {
        const user = state.auth.currentUser;
        const docId = [user.uid, targetUid].sort().join('_');
        await state.db.collection('friendships').doc(docId).set({
          users: [user.uid, targetUid],
          fromUid: user.uid,
          toUid: targetUid,
          createdAt: window.firebase.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });

        await state.db.collection('users').doc(user.uid).collection('friends').doc(targetUid).set({
          uid: targetUid,
          name: targetName,
          addedAt: window.firebase.firestore.FieldValue.serverTimestamp(),
        }, { merge: true }).catch(() => {});
      } catch (e) {
        console.warn('[addFriend firestore sync]', e);
      }
    }

    if (typeof window.showToast === 'function') {
      window.showToast('Добавлен в друзья: ' + (targetName || 'Пользователь'));
    }
    updateAccountUi();
    if (typeof window.renderFriendsList === 'function') {
      window.renderFriendsList();
    }
  }

  // Preset gradients for popular/featured tracks (e.g. "sleep mode" by ONDA ANDAR)
  const PRESET_TRACK_GRADIENTS = {
    'sleep mode': 'linear-gradient(135deg, rgba(47, 180, 230, 0.85) 0%, rgba(15, 80, 120, 0.75) 50%, rgba(8, 22, 34, 0.95) 100%)',
    'onda andar': 'linear-gradient(135deg, rgba(47, 180, 230, 0.85) 0%, rgba(15, 80, 120, 0.75) 50%, rgba(8, 22, 34, 0.95) 100%)',
  };

  // Helper: Adaptive Cover Background for Favorite Track Card
  function applyFavTrackCoverBackground(rowEl, coverUrl, track) {
    if (!rowEl) return;
    const defaultGradient = 'linear-gradient(135deg, rgba(30, 58, 95, 0.85) 0%, rgba(18, 32, 54, 0.75) 45%, rgba(10, 16, 26, 0.95) 100%)';
    const applyGradient = (gradient, borderColor, shadowColor) => {
      rowEl.style.setProperty('--pin-bg', gradient);
      rowEl.style.background = gradient;
      if (borderColor) rowEl.style.borderColor = borderColor;
      if (shadowColor) {
        rowEl.style.boxShadow = `0 10px 30px rgba(0, 0, 0, 0.5), 0 0 24px ${shadowColor}`;
      }
    };

    // Check track preset or custom gradient first
    if (track) {
      if (track.gradient || track.g) {
        applyGradient(track.gradient || track.g, 'rgba(255, 255, 255, 0.18)', 'rgba(0, 0, 0, 0.3)');
        return;
      }
      const titleKey = (track.title || '').trim().toLowerCase();
      const artistKey = (track.artist || '').trim().toLowerCase();
      if (PRESET_TRACK_GRADIENTS[titleKey]) {
        applyGradient(PRESET_TRACK_GRADIENTS[titleKey], 'rgba(47, 180, 230, 0.35)', 'rgba(47, 180, 230, 0.25)');
        return;
      }
      if (PRESET_TRACK_GRADIENTS[artistKey]) {
        applyGradient(PRESET_TRACK_GRADIENTS[artistKey], 'rgba(47, 180, 230, 0.35)', 'rgba(47, 180, 230, 0.25)');
        return;
      }
    }

    if (!coverUrl || coverUrl.startsWith('data:image/svg')) {
      applyGradient(defaultGradient, 'rgba(255, 255, 255, 0.12)', 'rgba(0, 0, 0, 0.4)');
      return;
    }
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const size = 32;
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, size, size);
        const data = ctx.getImageData(0, 0, size, size).data;
        let r = 0, g = 0, b = 0, count = 0;
        for (let i = 0; i < data.length; i += 4) {
          const pr = data[i], pg = data[i + 1], pb = data[i + 2];
          const brightness = (pr * 299 + pg * 587 + pb * 114) / 1000;
          if (brightness > 18 && brightness < 235) {
            r += pr;
            g += pg;
            b += pb;
            count++;
          }
        }
        if (!count) {
          for (let i = 0; i < data.length; i += 4) {
            r += data[i];
            g += data[i + 1];
            b += data[i + 2];
            count++;
          }
        }
        r = Math.round(r / (count || 1));
        g = Math.round(g / (count || 1));
        b = Math.round(b / (count || 1));

        const r1 = Math.round(r * 0.7);
        const g1 = Math.round(g * 0.7);
        const b1 = Math.round(b * 0.7);
        const r2 = Math.round(r * 0.25);
        const g2 = Math.round(g * 0.25);
        const b2 = Math.round(b * 0.25);

        const grad = `linear-gradient(135deg, rgba(${r1}, ${g1}, ${b1}, 0.85) 0%, rgba(${r2}, ${g2}, ${b2}, 0.8) 50%, rgba(10, 16, 26, 0.95) 100%)`;
        applyGradient(grad, `rgba(${r1}, ${g1}, ${b1}, 0.35)`, `rgba(${r1}, ${g1}, ${b1}, 0.25)`);
      } catch {
        applyGradient(defaultGradient, 'rgba(255, 255, 255, 0.12)', 'rgba(0, 0, 0, 0.4)');
      }
    };
    img.onerror = () => {
      applyGradient(defaultGradient, 'rgba(255, 255, 255, 0.12)', 'rgba(0, 0, 0, 0.4)');
    };
    img.src = coverUrl;
  }
  if (typeof window !== 'undefined') {
    window.applyFavTrackCoverBackground = applyFavTrackCoverBackground;
  }

  async function getFriends() {
    try {
      const friendUids = new Set();
      const localMap = new Map();

      // 1. Load local friends
      const localFriends = JSON.parse(localStorage.getItem('votifyLocalFriends') || '[]');
      localFriends.forEach(f => {
        if (f.uid) {
          friendUids.add(f.uid);
          localMap.set(f.uid, f);
        }
      });

      // 2. Load Firestore friends if user is logged in
      if (state.available && state.db && state.auth?.currentUser && !state.auth.currentUser.isAnonymous) {
        const user = state.auth.currentUser;
        const snap = await state.db.collection('users').doc(user.uid).collection('friends').get().catch(() => null);
        if (snap) {
          snap.forEach(doc => {
            friendUids.add(doc.id);
            if (!localMap.has(doc.id)) {
              localMap.set(doc.id, { uid: doc.id, ...doc.data() });
            }
          });
        }
      }

      // 3. If no friends added yet, return empty list
      if (friendUids.size === 0) {
        return [];
      }

      // 4. Resolve profile data for each friend UID
      const profiles = await Promise.all(
        Array.from(friendUids).map(async fUid => {
          const remote = await getUserProfile(fUid).catch(() => null);
          const local = localMap.get(fUid) || {};
          const merged = { ...local, ...(remote || {}) };
          if (!merged.name && !merged.uid) return null;
          return {
            uid: merged.uid || fUid,
            name: merged.name || merged.displayName || 'Пользователь',
            handle: merged.handle || ('@' + String(merged.name || 'user').toLowerCase().replace(/\s+/g, '')),
            avatar: merged.avatar || getAvatarUrl(merged.name, merged.avatar),
            about: merged.about || 'Любитель музыки',
            track: merged.track || '',
            playlists: merged.playlists || [],
          };
        })
      );

      return profiles.filter(Boolean);
    } catch (e) {
      console.warn('[getFriends]', e);
      return [];
    }
  }

  async function pullState() {
    const user = await requireUser();
    const [settingsDoc, libraryDoc, historyDoc, userDoc, profDoc] = await Promise.all([
      syncRef(user.uid, 'settings').get().catch(() => null),
      syncRef(user.uid, 'library').get().catch(() => null),
      syncRef(user.uid, 'history').get().catch(() => null),
      profileRef(user.uid).get().catch(() => null),
      firestoreProfileRef(user.uid).get().catch(() => null),
    ]);
    let playlists = (libraryDoc?.exists && libraryDoc.data()?.playlists) ? { ...libraryDoc.data().playlists } : {};
    // Merge Android SyncBlob from users/{uid}.sync so phone playlists and favorites are seamlessly imported
    if (userDoc?.exists) {
      const syncStr = userDoc.data()?.sync;
      if (syncStr) {
        try {
          const blob = JSON.parse(syncStr);
          let favList = [];
          if (Array.isArray(playlists['Избранное'])) {
            favList = playlists['Избранное'];
          } else if (playlists['Избранное'] && Array.isArray(playlists['Избранное'].tracks)) {
            favList = playlists['Избранное'].tracks;
          } else {
            playlists['Избранное'] = favList;
          }
          if (Array.isArray(blob.favorites) && blob.favorites.length > 0) {
            const existingFavIds = new Set(favList.map(t => String(t.id || t.title)));
            blob.favorites.forEach(f => {
              const tr = f.track || f;
              if (tr && !existingFavIds.has(String(tr.id || tr.t || tr.title))) {
                favList.push({
                  id: String(tr.id || ''),
                  title: String(tr.t || tr.title || 'Untitled'),
                  artist: String(tr.a || tr.artist || 'Unknown'),
                  cover: String(tr.c || tr.cover || tr.thumbnail || ''),
                  thumbnail: String(tr.c || tr.cover || tr.thumbnail || ''),
                  duration: Number(tr.d || tr.duration || 0),
                  addedAt: f.addedAt || Date.now()
                });
                existingFavIds.add(String(tr.id || tr.t || tr.title));
              }
            });
          }
          if (Array.isArray(blob.playlists) && blob.playlists.length > 0) {
            blob.playlists.forEach(p => {
              if (!p || !p.name) return;
              const pTracks = Array.isArray(p.tracks) ? p.tracks : [];
              const existing = playlists[p.name];
              const existingTracks = Array.isArray(existing) ? existing : (existing?.tracks || []);
              if (!existing || existingTracks.length === 0) {
                playlists[p.name] = {
                  name: p.name,
                  cover: p.cover || (pTracks[0] && (pTracks[0].c || pTracks[0].cover)) || '',
                  tracks: pTracks.map(t => ({
                    id: String(t.id || ''),
                    title: String(t.t || t.title || 'Untitled'),
                    artist: String(t.a || t.artist || 'Unknown'),
                    cover: String(t.c || t.cover || t.thumbnail || ''),
                    thumbnail: String(t.c || t.cover || t.thumbnail || ''),
                    duration: Number(t.d || t.duration || 0),
                  }))
                };
              }
            });
          }
        } catch (e) {
          console.warn('[CloudSync] Error parsing Android sync blob:', e);
        }
      }
    }

    // Merge playlists from userDoc and profDoc (where web/mobile user profiles mirror playlists)
    const mergePlSource = (source) => {
      if (!source) return;
      if (Array.isArray(source)) {
        source.forEach(p => {
          if (!p || !p.name) return;
          const pName = p.name.trim();
          const pTracks = Array.isArray(p.tracks) ? p.tracks : [];
          if (!playlists[pName]) {
            playlists[pName] = {
              id: p.id || ('pl_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5)),
              name: pName,
              cover: p.cover || (pTracks[0] && (pTracks[0].c || pTracks[0].cover || pTracks[0].thumbnail)) || '',
              tracks: pTracks
            };
          } else {
            const existing = playlists[pName];
            const existingTracks = Array.isArray(existing) ? existing : (existing?.tracks || []);
            if (existingTracks.length === 0 && pTracks.length > 0) {
              if (Array.isArray(existing)) {
                playlists[pName] = pTracks;
              } else {
                existing.tracks = pTracks;
                if (!existing.cover && p.cover) existing.cover = p.cover;
              }
            }
          }
        });
      } else if (typeof source === 'object') {
        Object.keys(source).forEach(k => {
          if (!playlists[k]) {
            playlists[k] = source[k];
          }
        });
      }
    };

    if (userDoc?.exists && userDoc.data()?.playlists) {
      mergePlSource(userDoc.data().playlists);
    }
    if (profDoc?.exists && profDoc.data()?.playlists) {
      mergePlSource(profDoc.data().playlists);
    }
    let history = historyDoc?.exists ? historyDoc.data()?.history || null : null;
    if ((!history || history.length === 0) && userDoc?.exists) {
      const syncStr = userDoc.data()?.sync;
      if (syncStr) {
        try {
          const blob = JSON.parse(syncStr);
          if (Array.isArray(blob.history) && blob.history.length > 0) {
            history = blob.history.map(h => ({
              id: h.track?.id,
              title: h.track?.t,
              artist: h.track?.a,
              cover: h.track?.c,
              duration: h.track?.d,
              playedAt: h.playedAt,
            }));
          }
        } catch (e) {}
      }
    }
    return {
      settings: settingsDoc?.exists ? settingsDoc.data()?.value || null : null,
      playlists,
      history,
      exists: (settingsDoc && settingsDoc.exists) || (libraryDoc && libraryDoc.exists) || (historyDoc && historyDoc.exists) || !!playlists || !!history,
    };
  }

  function getLocalPlaylistsDictionary() {
    const dict = {};
    try {
      const favs = (window.state && Array.isArray(window.state.favorites) && window.state.favorites.length > 0)
        ? window.state.favorites
        : JSON.parse(localStorage.getItem('devsize_favorites') || '[]');
      if (Array.isArray(favs)) {
        dict['Избранное'] = favs.map(t => ({
          id: String(t.id || ''),
          title: String(t.title || t.t || 'Untitled'),
          artist: String(t.artist || t.a || 'Unknown'),
          thumbnail: String(t.thumbnail || t.cover || t.c || ''),
          cover: String(t.cover || t.thumbnail || t.c || ''),
          duration: Number(t.duration || t.d || 0),
          platform: t.platform || 'youtube',
          addedAt: t.addedAt || Date.now()
        }));
      }
    } catch (_) {}
    try {
      const pls = (window.state && Array.isArray(window.state.playlists) && window.state.playlists.length > 0)
        ? window.state.playlists
        : JSON.parse(localStorage.getItem('devsize_playlists') || '[]');
      if (Array.isArray(pls)) {
        pls.forEach(p => {
          if (p && p.name) {
            dict[p.name] = (p.tracks || []).map(t => ({
              id: String(t.id || ''),
              title: String(t.title || t.t || 'Untitled'),
              artist: String(t.artist || t.a || 'Unknown'),
              thumbnail: String(t.thumbnail || t.cover || t.c || ''),
              cover: String(t.cover || t.thumbnail || t.c || ''),
              duration: Number(t.duration || t.d || 0),
              platform: t.platform || 'youtube',
              addedAt: t.addedAt || Date.now()
            }));
          }
        });
      }
    } catch (_) {}
    return dict;
  }

  async function pushState({ settings, playlists, history }) {
    if (!settings && !playlists && !history) return;
    const user = await requireUser();
    const effectivePlaylists = playlists || getLocalPlaylistsDictionary();
    const effectiveHistory = history || (function() {
      try {
        const hist = JSON.parse(localStorage.getItem('devsize_history') || '[]');
        return Array.isArray(hist) ? hist.slice(0, 100) : [];
      } catch (_) { return []; }
    })();
    const updatedAt = window.firebase.firestore.FieldValue.serverTimestamp();
    const batch = state.db.batch();
    batch.set(syncRef(user.uid, 'settings'), { value: settings || {}, updatedAt }, { merge: true });
    batch.set(syncRef(user.uid, 'library'), { playlists: playlists, updatedAt });
    batch.set(syncRef(user.uid, 'history'), { history: effectiveHistory, updatedAt }, { merge: true });

    // Also mirror public playlist summaries into profile documents
    const playlistSummaries = Object.keys(effectivePlaylists || {}).map(name => {
      const tracks = Array.isArray(effectivePlaylists[name]) ? effectivePlaylists[name] : (effectivePlaylists[name]?.tracks || []);
      const cover = effectivePlaylists[name]?.cover || (tracks[0] && (tracks[0].cover || tracks[0].c || tracks[0].thumbnail)) || '';
      return {
        name,
        count: tracks.length,
        cover,
      };
    });
    batch.set(firestoreProfileRef(user.uid), { playlists: playlistSummaries, updatedAt }, { merge: true });

    // Also serialize Android-compatible syncBlob string so Android syncs seamlessly
    try {
      const favList = Array.isArray(effectivePlaylists?.['Избранное'])
        ? effectivePlaylists['Избранное']
        : (effectivePlaylists?.['Избранное']?.tracks || []);
      const androidFavorites = favList.map(t => ({
        addedAt: t.addedAt || Date.now(),
        track: {
          id: String(t.id || ''),
          t: String(t.title || t.name || t.t || 'Трек'),
          a: String(t.artist || t.artistName || t.a || 'Неизвестный исполнитель'),
          c: String(t.cover || t.thumbnail || t.c || ''),
          d: Number(t.duration || t.d || 180),
        },
      }));
      const androidPlaylists = Object.keys(effectivePlaylists || {})
        .filter(k => k !== 'Избранное' && k !== 'Любимые треки')
        .map(name => {
          const list = Array.isArray(effectivePlaylists[name]) ? effectivePlaylists[name] : (effectivePlaylists[name]?.tracks || []);
          return {
            name,
            createdAt: Date.now(),
            tracks: list.map(t => ({
              id: String(t.id || ''),
              t: String(t.title || t.name || t.t || 'Трек'),
              a: String(t.artist || t.artistName || t.a || 'Неизвестный исполнитель'),
              c: String(t.cover || t.thumbnail || t.c || ''),
              d: Number(t.duration || t.d || 180),
            })),
          };
        });
      const androidHistory = (effectiveHistory || []).map((t, idx) => ({
        playedAt: t.playedAt || (Date.now() - idx * 1000),
        track: {
          id: String(t.id || ''),
          t: String(t.title || t.name || t.t || 'Трек'),
          a: String(t.artist || t.artistName || t.a || 'Неизвестный исполнитель'),
          c: String(t.cover || t.thumbnail || t.c || ''),
          d: Number(t.duration || t.d || 180),
        },
      }));
      const androidSyncBlob = JSON.stringify({
        v: 1,
        theme: settings?.theme || '',
        customTheme: settings?.accent || '',
        backgroundUrl: settings?.bgUrl || '',
        favorites: androidFavorites,
        playlists: androidPlaylists,
        history: androidHistory,
      });
      batch.set(profileRef(user.uid), {
        playlists: playlistSummaries,
        sync: androidSyncBlob,
        updatedAt,
      }, { merge: true });
    } catch (e) {
      batch.set(profileRef(user.uid), { playlists: playlistSummaries, updatedAt }, { merge: true });
    }

    await batch.commit();
  }

  async function listWorkshopThemes() {
    await requireCloud();
    const snapshot = await state.db
      .collection('workshopThemes')
      .orderBy('createdAt', 'desc')
      .limit(100)
      .get();
    return snapshot.docs.map(document => {
      const data = document.data() || {};
      const rawAuthor = data.authorName || 'user';
      const cleanAuthor = String(rawAuthor).trim().replace(/^@/, '');
      const handle = cleanAuthor ? (cleanAuthor.toLowerCase() === 'пользователь' ? 'user' : cleanAuthor.toLowerCase()) : 'user';
      return {
        id: document.id,
        title: String(data.title || '').slice(0, 60),
        description: String(data.description || '').slice(0, 240),
        ownerId: String(data.ownerId || ''),
        authorName: '@' + handle,
        theme: cleanWorkshopTheme(data.theme),
        createdAt: data.createdAt?.toMillis?.() || 0,
      };
    });
  }

  async function publishWorkshopTheme({ title, description, theme }) {
    const user = await requirePermanentUser();
    const safeTitle = String(title || '')
      .trim()
      .slice(0, 60);
    const safeDescription = String(description || '')
      .trim()
      .slice(0, 240);
    if (safeTitle.length < 3) throw new Error('Название должно содержать минимум 3 символа');
    const now = window.firebase.firestore.FieldValue.serverTimestamp();
    const reference = state.db.collection('workshopThemes').doc();

    const rawHandle = state.profile?.handle || user.displayName || (user.email ? user.email.split('@')[0] : 'user');
    const cleanHandle = String(rawHandle).trim().replace(/^@/, '').toLowerCase() || 'user';
    const authorHandle = ('@' + cleanHandle).slice(0, 40);

    const fullPayload = {
      title: safeTitle,
      description: safeDescription,
      ownerId: user.uid,
      authorName: authorHandle,
      theme: cleanWorkshopTheme(theme),
      schemaVersion: 1,
      createdAt: now,
      updatedAt: now,
    };
    try {
      await reference.set(fullPayload);
    } catch (err) {
      const msg = String(err?.message || '').toLowerCase();
      const code = String(err?.code || '').toLowerCase();
      if (code === 'permission-denied' || msg.includes('permission') || msg.includes('доступ')) {
        const corePayload = {
          ...fullPayload,
          theme: cleanCoreWorkshopTheme(theme),
        };
        await reference.set(corePayload);
      } else {
        throw err;
      }
    }
    return reference.id;
  }

  async function deleteWorkshopTheme(themeId) {
    const user = await requirePermanentUser();
    const id = String(themeId || '').trim();
    if (!/^[a-z0-9]{10,40}$/i.test(id)) throw new Error('Некорректный ID темы');
    const reference = state.db.collection('workshopThemes').doc(id);
    const snapshot = await reference.get();
    if (!snapshot.exists || snapshot.data()?.ownerId !== user.uid) {
      throw new Error('Удалять можно только собственные темы');
    }
    await reference.delete();
  }

  function onAuthChanged(listener) {
    authListeners.add(listener);
    if (state.initialized) listener({ user: publicUser(state.user), profile: state.profile });
    return () => authListeners.delete(listener);
  }

  function getCurrentUser() {
    if (state.auth?.currentUser || state.user) {
      return publicUser(state.auth?.currentUser || state.user);
    }
    try {
      const local = JSON.parse(localStorage.getItem('votifyLocalProfile') || '{}');
      if (local && (local.displayName || local.name)) {
        return {
          uid: local.uid || 'exieeez_desktop_user',
          displayName: local.displayName || local.name,
          email: local.email || 'exieeez@desktop.local',
          photoURL: local.avatar || local.photoUrl || EXIEEEZ_SIGNATURE_AVATAR,
          isAnonymous: false
        };
      }
    } catch (_) {}
    return null;
  }

  function getProfile() {
    const localProfile = JSON.parse(localStorage.getItem('votifyLocalProfile') || '{}');
    const base = state.profile ? { ...localProfile, ...state.profile } : (Object.keys(localProfile).length ? localProfile : null);
    if (!base) return null;
    if (!base.favTrack && localProfile.favTrack && localProfile.favTrack.title) {
      base.favTrack = localProfile.favTrack;
    }
    const user = state.auth?.currentUser || state.user;
    const emailPrefix = user?.email ? user.email.split('@')[0].toLowerCase() : '';
    if (emailPrefix === 'vovan232012s') {
      if (!base.displayName || base.displayName.toLowerCase() === 'vovan232012s' || base.displayName === 'Пользователь') {
        base.displayName = 'exieeez';
        base.name = 'exieeez';
      }
      if (!base.handle || base.handle.toLowerCase() === 'vovan232012s' || base.handle === 'user' || base.handle === '@user') {
        base.handle = 'god';
      }
    }
    return base;
  }

  function friendlyError(error) {
    const code = String(error?.code || '');
    const messages = {
      'auth/email-already-in-use': 'Этот email уже зарегистрирован',
      'auth/invalid-email': 'Некорректный email',
      'auth/invalid-credential': 'Неверный email или пароль',
      'auth/user-not-found': 'Аккаунт не найден',
      'auth/wrong-password': 'Неверный email или пароль',
      'auth/weak-password': 'Пароль должен содержать не менее 6 символов',
      'auth/too-many-requests': 'Слишком много попыток. Попробуйте позже',
      'auth/network-request-failed': 'Нет соединения с Firebase',
      'auth/operation-not-allowed': 'Этот способ входа не включён в Firebase',
      'auth/credential-already-in-use': 'Этот Google-аккаунт уже связан с другим профилем',
      'auth/account-exists-with-different-credential':
        'Аккаунт с этим email уже использует другой способ входа',
      'auth/popup-closed-by-user': 'Вход через Google отменён',
      'auth/requires-recent-login': 'Войдите в аккаунт повторно',
      'permission-denied':
        'Нет доступа Firestore. Опубликуйте актуальные правила из firestore.rules',
      'firestore/permission-denied':
        'Нет доступа Firestore. Опубликуйте актуальные правила из firestore.rules',
      unavailable: 'Firestore временно недоступен. Проверьте подключение к интернету',
    };
    return messages[code] || error?.message || 'Неизвестная ошибка';
  }

  function getSavedLoginUser() {
    try {
      const local = localStorage.getItem('votifyLocalProfile');
      if (local) {
        const parsed = JSON.parse(local);
        if (parsed && (parsed.email || parsed.displayName || parsed.name)) {
          return {
            displayName: parsed.displayName || parsed.name || '',
            email: parsed.email || '',
            photoUrl: parsed.photoUrl || parsed.avatar || '',
          };
        }
      }
    } catch (e) {}
    return null;
  }

  async function checkEmailExists(email) {
    const cleanEmail = String(email || '').trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      throw new Error('Введите корректный email');
    }

    // 1. Check local saved user
    const saved = getSavedLoginUser();
    if (saved && saved.email && saved.email.toLowerCase() === cleanEmail) {
      return true;
    }

    // 2. Check Firebase Auth
    if (state.auth && typeof state.auth.fetchSignInMethodsForEmail === 'function') {
      try {
        const methods = await state.auth.fetchSignInMethodsForEmail(cleanEmail);
        if (Array.isArray(methods) && methods.length > 0) {
          return true;
        }
      } catch (e) {
        if (e.code === 'auth/invalid-email') {
          throw new Error('Некорректный адрес электронной почты');
        }
      }
    }

    // 3. Check server endpoint
    try {
      const apiBase = getBackendBaseUrl();
      const res = await fetch(`${apiBase}/api/auth/check-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data && data.exists) return true;
      }
    } catch (e) {}

    // 4. Check Firestore profiles if db is available
    if (state.db) {
      try {
        const snap = await state.db.collection('profiles').where('email', '==', cleanEmail).limit(1).get();
        if (!snap.empty) return true;
      } catch (e) {}
    }

    return false;
  }

  function updateQuickLoginUi(customEmail) {
    const saved = getSavedLoginUser();
    const emailToUse = (customEmail || (saved && saved.email) || '').trim();
    if (!emailToUse) return;
    const isSavedMatch = Boolean(saved && saved.email && saved.email.toLowerCase() === emailToUse.toLowerCase());

    const displayName = isSavedMatch ? (saved.displayName || emailToUse.split('@')[0]) : emailToUse.split('@')[0];
    const photoUrl = isSavedMatch ? (saved.photoUrl || '') : '';

    const nameEl = document.getElementById('quick-login-name');
    const emailEl = document.getElementById('quick-login-email');
    const initEl = document.getElementById('quick-login-initial');
    const imgEl = document.getElementById('quick-login-avatar-img');

    if (nameEl) nameEl.textContent = displayName;
    if (emailEl) emailEl.textContent = emailToUse;
    if (initEl) {
      const initial = displayName.trim().charAt(0).toUpperCase() || 'U';
      initEl.textContent = initial;
    }
    if (imgEl) {
      if (photoUrl && !photoUrl.startsWith('data:image/svg')) {
        imgEl.src = photoUrl;
        imgEl.style.display = 'block';
        if (initEl) initEl.style.display = 'none';
      } else {
        imgEl.style.display = 'none';
        if (initEl) initEl.style.display = 'block';
      }
    }
  }

  function showAuthForm(formId) {
    ['auth-email-step', 'auth-quick-login', 'auth-login', 'auth-register', 'auth-forgot'].forEach(id => {
      const element = document.getElementById(id);
      if (element) {
        if (id === formId) {
          element.style.setProperty('display', id === 'auth-quick-login' ? 'flex' : 'block', 'important');
        } else {
          element.style.setProperty('display', 'none', 'important');
        }
      }
    });
  }

  function setMessage(id, message = '') {
    const element = document.getElementById(id);
    if (element) element.textContent = message;
  }

  function setBusy(button, busy) {
    if (!button) return;
    button.disabled = busy;
    button.classList.toggle('busy', busy);
  }

  function openAuth(formId = 'auth-email-step') {
    if (formId === 'auth-login') {
      formId = 'auth-email-step';
    }

    // Pre-fill email in step 1 if saved profile exists
    const emailInput = document.getElementById('auth-initial-email');
    if (emailInput && !emailInput.value) {
      const saved = getSavedLoginUser();
      if (saved && saved.email) {
        emailInput.value = saved.email;
      }
    }
    setMessage('auth-email-error', '');

    const passInput = document.getElementById('quick-login-password');
    if (passInput) {
      passInput.value = '';
      document.getElementById('quick-login-btn')?.classList.remove('ready');
    }
    setMessage('quick-login-error', '');

    showAuthForm(formId);
    const overlay = document.getElementById('auth-overlay');
    if (overlay) overlay.style.display = 'flex';
    window.setTimeout(() => {
      const form = document.getElementById(formId);
      const input = form && form.querySelector('input:not([type="hidden"])');
      if (input) input.focus({ preventScroll: true });
    }, 60);
  }

  function closeAuth() {
    const overlay = document.getElementById('auth-overlay');
    if (overlay) overlay.style.display = 'none';
  }

  let lastScreenBeforeProfile = 'home-screen';

  const HUE_PALETTES = [
    { c: '', h: 38 },
    { c: '5', h: 5 },
    { c: '25', h: 25 },
    { c: '48', h: 48 },
    { c: '140', h: 140 },
    { c: '185', h: 185 },
    { c: '215', h: 215 },
    { c: '270', h: 270 },
    { c: '330', h: 330 },
  ];

  function hueOfColor(c) {
    return c === '' || c === undefined || c === null ? 38 : +c;
  }

  function applyMaterialYouPalette(h, targetEl) {
    const r = targetEl || document.getElementById('profile-overlay');
    if (!r) return;
    if (h === '' || h === undefined || h === null || h === 'default' || h === 38) {
      const darkVars = {
        '--s': '#0c0c0e',
        '--sl': '#121215',
        '--sc': '#18181d',
        '--sch': '#222228',
        '--schh': '#2c2c34',
        '--p': '#ffffff',
        '--op': '#0c0c0e',
        '--pc': '#1a1a20',
        '--opc': '#ffffff',
        '--scn': '#222228',
        '--oscn': '#f3f4f6',
        '--on': '#ffffff',
        '--onv': '#8e8e93',
        '--ol': '#2a2a32',
        '--olv': '#383842',
      };
      for (const k in darkVars) r.style.setProperty(k, darkVars[k]);
      return;
    }
    function c(s, l) { return `hsl(${h},${s}%,${l}%)`; }
    const m = {
      '--s': c(18, 8),
      '--sl': c(16, 10.5),
      '--sc': c(15, 13),
      '--sch': c(14, 17),
      '--schh': c(13, 21),
      '--p': c(75, 76),
      '--op': c(70, 14),
      '--pc': c(40, 27),
      '--opc': c(80, 90),
      '--scn': c(22, 25),
      '--oscn': c(40, 90),
      '--on': c(20, 91),
      '--onv': c(14, 74),
      '--ol': c(8, 56),
      '--olv': c(10, 30),
    };
    for (const k in m) r.style.setProperty(k, m[k]);
  }

  let profileDraft = {};
  let pageProfileColor = '';

  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function showProfileToast(msg) {
    const toast = document.getElementById('profile-snack');
    if (toast) {
      toast.textContent = msg;
      toast.classList.add('s');
      setTimeout(() => toast.classList.remove('s'), 2200);
    } else if (typeof window.showToast === 'function') {
      window.showToast(msg);
    }
  }

  function showProfileModal(contentHtml) {
    const mask = document.getElementById('profile-mask');
    const dlg = document.getElementById('profile-dlg');
    if (!mask || !dlg) return;
    dlg.innerHTML = contentHtml;
    mask.classList.add('o');
  }

  function closeProfileModal() {
    const mask = document.getElementById('profile-mask');
    if (mask) mask.classList.remove('o');
  }

  function getAllSelectableTracks() {
    const list = [];
    const seen = new Set();
    const add = (t) => {
      if (t && t.title && !seen.has(t.title + '|' + (t.artist || ''))) {
        seen.add(t.title + '|' + (t.artist || ''));
        list.push(t);
      }
    };
    const livePlayingTrack = window.currentTrack || window.state?.currentTrack || (typeof state !== 'undefined' ? state?.currentTrack : null) || (window.getCurrentPlayingTrack ? window.getCurrentPlayingTrack() : null);
    if (livePlayingTrack) add(livePlayingTrack);
    try {
      const favs = JSON.parse(localStorage.getItem('devsize_favorites') || '[]');
      if (Array.isArray(favs)) favs.forEach(add);
    } catch (_) {}
    if (window.state && Array.isArray(window.state.playlists)) {
      window.state.playlists.forEach(pl => {
        if (Array.isArray(pl.tracks)) pl.tracks.forEach(add);
      });
    }
    try {
      const pls = JSON.parse(localStorage.getItem('devsize_playlists') || '[]');
      if (Array.isArray(pls)) pls.forEach(pl => {
        if (Array.isArray(pl.tracks)) pl.tracks.forEach(add);
      });
    } catch (_) {}
    if (list.length === 0) {
      list.push(
        { title: 'sleep mode', artist: 'ONDA ANDAR', cover: '' },
        { title: 'OOOO', artist: 'ALBLAK 52', cover: '' },
        { title: 'псы попадут в рай', artist: 'плм', cover: '' }
      );
    }
    return list;
  }

  function renderColorSwatches(containerId, activeColor, onSelect) {
    const el = document.getElementById(containerId);
    if (!el) return;
    el.innerHTML = HUE_PALETTES.map(x => {
      const isSelected = String(activeColor || '') === String(x.c);
      const bg = x.c === '' ? '' : `background:hsl(${x.h},70%,62%);`;
      const icon = isSelected
        ? '<svg viewBox="0 0 24 24"><path d="M5 12l5 5 9-10"/></svg>'
        : (x.c === '' ? '<svg viewBox="0 0 24 24" style="color:var(--onv,#888);"><circle cx="12" cy="12" r="9"/><path d="M6 6l12 12"/></svg>' : '');
      return `<button class="sw${isSelected ? ' s' : ''}" type="button" data-c="${x.c}" style="${bg}">${icon}</button>`;
    }).join('');
    el.querySelectorAll('.sw').forEach(btn => {
      btn.addEventListener('click', () => {
        const c = btn.getAttribute('data-c');
        if (typeof onSelect === 'function') onSelect(c);
      });
    });
  }

  function getLivePlayingTrack() {
    const fromObj = (t) => {
      if (!t) return null;
      const title = t.title || t.name || t.trackTitle || t.song || '';
      const id = t.id || t.trackId || (title ? 't_' + encodeURIComponent(title) : '');
      if (title || id) {
        return {
          id: id,
          title: title || 'Трек',
          artist: t.artist || t.author || t.channel || '',
          cover: t.thumbnail || t.cover || t.image || t.c || '',
          duration: t.duration || 0
        };
      }
      return null;
    };

    const cand1 = fromObj(window.currentTrack);
    if (cand1) return cand1;
    const cand2 = (window.state && window.state.currentTrack) ? fromObj(window.state.currentTrack) : null;
    if (cand2) return cand2;
    if (typeof window.getCurrentPlayingTrack === 'function') {
      const cand3 = fromObj(window.getCurrentPlayingTrack());
      if (cand3) return cand3;
    }
    const cand4 = fromObj(window.VotifyCloud?.currentTrack);
    if (cand4) return cand4;
    try {
      const raw = localStorage.getItem('riff_current_track') || localStorage.getItem('votify_last_track') || localStorage.getItem('riff_saved_state');
      if (raw) {
        const parsed = JSON.parse(raw);
        const cand5 = fromObj(parsed) || fromObj(parsed?.currentTrack);
        if (cand5) return cand5;
      }
    } catch (_) {}

    const pTitle = document.getElementById('playbar-title')?.textContent?.trim() || document.getElementById('player-track-title')?.textContent?.trim();
    const pArtist = document.getElementById('playbar-artist')?.textContent?.trim() || document.getElementById('player-track-artist')?.textContent?.trim();
    const pCover = document.getElementById('playbar-artwork')?.src || document.getElementById('playbar-cover')?.src || document.getElementById('artwork-img')?.src;
    if (pTitle && pTitle !== 'No track playing' && pTitle !== 'Music' && pTitle !== '—' && pTitle !== 'Выберите трек' && pTitle !== 'Select a track to listen' && pTitle !== 'Нет трека') {
      return {
        id: 'track_' + Date.now(),
        title: pTitle,
        artist: (pArtist && pArtist !== 'Select a track to listen' && pArtist !== '—') ? pArtist : '',
        cover: (pCover && !pCover.startsWith('data:image/svg') && !pCover.includes('placeholder')) ? pCover : '',
        duration: 0
      };
    }
    return null;
  }

  function refreshProfileEditUi() {
    // 1. Inputs counter
    const fn = document.getElementById('profile-display-name');
    const fu = document.getElementById('profile-handle');
    const fa = document.getElementById('profile-about');
    const c1 = document.getElementById('cn1');
    const c2 = document.getElementById('cn2');
    const c3 = document.getElementById('cn3');
    if (fn && c1) c1.textContent = `${fn.value.length}/32`;
    if (fu && c2) c2.textContent = `${fu.value.length}/12`;
    if (fa && c3) c3.textContent = `${fa.value.length}/32`;

    // 2. Integration inputs
    const inTg = document.getElementById('profile-int-tg-input');
    const inDs = document.getElementById('profile-int-ds-input');
    const inSite = document.getElementById('profile-int-site-input');
    if (inTg && document.activeElement !== inTg) inTg.value = profileDraft.tg || '';
    if (inDs && document.activeElement !== inDs) inDs.value = profileDraft.ds || '';
    if (inSite && document.activeElement !== inSite) inSite.value = profileDraft.site || '';

    // 3. Pinned track slot
    const slot = document.getElementById('profile-pinslot');
    if (slot) {
      const fav = profileDraft.favTrack;
      if (fav && fav.title) {
        slot.innerHTML = `
          <div class="pv2-pin-card">
            <img class="pv2-pin-cover" src="${fav.cover || DEFAULT_TRACK_COVER}" alt="" />
            <div class="pv2-pin-info">
              <div class="pv2-pin-title">${escapeHtml(fav.title)}</div>
              <div class="pv2-pin-artist">${escapeHtml(fav.artist || 'Unknown')}</div>
            </div>
            <button class="pv2-pin-remove" id="unpin" type="button" title="Удалить закреп">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>
          </div>
        `;
        document.getElementById('unpin')?.addEventListener('click', () => {
          profileDraft.favTrack = null;
          pendingProfileFavTrack = null;
          const prevFav = document.getElementById('profile-fav-track-selected-preview');
          if (prevFav) prevFav.textContent = 'Трек очищен';
          refreshProfileEditUi();
        });
      } else {
        const cur = getLivePlayingTrack();
        const curLabel = cur && (cur.title || cur.artist)
          ? `${cur.artist ? cur.artist + ' - ' : ''}${cur.title}`
          : '';
        slot.innerHTML = `
          <div class="pv2-pin-card pv2-pin-empty" id="pin-select-trigger" style="cursor:pointer; display:flex; flex-direction:column; align-items:center; gap:8px; padding:16px;">
            <div class="pv2-pin-empty-text" style="font-weight:600; color:#fff;">
              ${curLabel ? `📌 Закрепить трек: «${curLabel}»` : 'Нажмите, чтобы выбрать трек'}
            </div>
            ${curLabel ? `<span style="font-size:12px; color:rgba(255,255,255,0.6);">Нажмите сюда, чтобы закрепить сейчас</span>` : ''}
          </div>
        `;
        document.getElementById('pin-select-trigger')?.addEventListener('click', () => {
          const liveTrack = getLivePlayingTrack();
          if (liveTrack && (liveTrack.title || liveTrack.id)) {
            profileDraft.favTrack = Object.assign({}, liveTrack);
            pendingProfileFavTrack = profileDraft.favTrack;
            refreshProfileEditUi();
            showProfileToast('Трек закреплён: ' + (liveTrack.title || 'Трек'));
          } else {
            showProfileToast('Сначала включите трек');
          }
        });
      }
    }
  }

  function openProfileEditMode(jumpToPin) {
    const user = getCurrentUser();
    const profile = getProfile() || {};
    const curActive = getLivePlayingTrack();
    const initialFav = pendingProfileFavTrack !== undefined 
      ? pendingProfileFavTrack 
      : (profile.favTrack || (jumpToPin && curActive && (curActive.title || curActive.id) ? Object.assign({}, curActive) : null));

    profileDraft = {
      displayName: profile.displayName || user?.displayName || '',
      handle: profile.handle || (user?.email ? user.email.split('@')[0] : 'user'),
      about: profile.about || '',
      status: profile.status || '',
      tg: profile.tg || '',
      ds: profile.ds || '',
      site: profile.site || '',
      color: profile.color || '',
      favTrack: initialFav,
      playlistVisibility: profile.playlistVisibility || {},
    };
    if (jumpToPin && curActive && (!profile.favTrack && !pendingProfileFavTrack)) {
      pendingProfileFavTrack = profileDraft.favTrack;
    }

    const fn = document.getElementById('profile-display-name');
    const fu = document.getElementById('profile-handle');
    const fa = document.getElementById('profile-about');
    const editAva = document.getElementById('profile-avatar-image-edit');
    if (fn) fn.value = profileDraft.displayName;
    if (fu) fu.value = profileDraft.handle;
    if (fa) fa.value = profileDraft.about;
    const nameForAvatar = profileDraft.displayName || profile.name || (user?.displayName || 'User');
    const avatarCandidate = profile.avatar && !isPlaceholderAvatar(profile.avatar) ? profile.avatar : (user?.photoURL || user?.photoUrl || getAvatarUrl(nameForAvatar));
    if (editAva) editAva.src = avatarCandidate;

    const inTg = document.getElementById('profile-int-tg-input');
    const inDs = document.getElementById('profile-int-ds-input');
    const inSite = document.getElementById('profile-int-site-input');
    if (inTg) inTg.value = profileDraft.tg || '';
    if (inDs) inDs.value = profileDraft.ds || '';
    if (inSite) inSite.value = profileDraft.site || '';

    refreshProfileEditUi();

    const v1 = document.getElementById('profile-v1');
    const v2 = document.getElementById('profile-v2');
    if (v1 && v2) {
      v1.classList.add('hide');
      v1.style.setProperty('display', 'none', 'important');
      v2.classList.remove('hide');
      v2.style.setProperty('display', 'block', 'important');
    }
    const scrollBody = document.getElementById('profile-scroll-body');
    if (scrollBody) {
      if (jumpToPin) {
        const slot = document.getElementById('profile-pinslot');
        if (slot) slot.scrollIntoView({ block: 'center' });
      } else {
        scrollBody.scrollTop = 0;
      }
    }
  }


  function closeProfileEditMode() {
    const profile = getProfile() || {};
    applyMaterialYouPalette(hueOfColor(profile.color));
    const v1 = document.getElementById('profile-v1');
    const v2 = document.getElementById('profile-v2');
    if (v1 && v2) {
      v1.classList.remove('hide');
      v1.style.setProperty('display', 'flex', 'important');
      v2.classList.add('hide');
      v2.style.setProperty('display', 'none', 'important');
    }
  }

  function openProfile() {
    updateAccountUi();
    const curScreen = window.currentScreen || 'home-screen';
    if (curScreen !== 'profile-screen') {
      lastScreenBeforeProfile = curScreen;
    }
    closeProfileEditMode();
    const overlay = document.getElementById('profile-overlay');
    if (overlay) {
      overlay.style.display = 'flex';
      overlay.style.zIndex = '99999';
    }
    // Отключаем drag-область верхней навигации, иначе она перехватывает
    // клики по кнопкам «Назад / Друзья / Настройки / Выйти».
    document.body.classList.add('profile-open');
  }

  function closeProfile() {
    const overlay = document.getElementById('profile-overlay');
    if (overlay) overlay.style.display = 'none';
    document.body.classList.remove('profile-open');
  }

  function openFriendsModal() {
    const overlay = document.getElementById('friends-overlay');
    if (overlay) {
      overlay.style.display = 'flex';
      overlay.style.zIndex = '100000';
      const input = document.getElementById('friend-search-input');
      if (input) {
        input.value = '';
        setTimeout(() => input.focus(), 60);
      }
      const results = document.getElementById('friend-search-results');
      if (results) results.innerHTML = '';
      getFriends().then(friends => {
        ['pc-friends-count', 'page-friends-count'].forEach(id => {
          const countEl = document.getElementById(id);
          if (countEl) countEl.textContent = friends.length + ' ' + (friends.length === 1 ? 'друг' : friends.length >= 2 && friends.length <= 4 ? 'друга' : 'друзей');
        });
        ['pc-friends-list', 'page-friends-list'].forEach(id => {
          const listEl = document.getElementById(id);
          if (listEl) {
            if (friends.length === 0) {
              listEl.innerHTML = '<div style="font-size:12px; color:#737373; padding:8px 0;">У вас пока нет друзей</div>';
            } else {
              listEl.innerHTML = friends.map(f => `
                <div class="pc-friend-chip" style="cursor:pointer;" onclick="if(window.openUserProfile){window.openUserProfile('${f.uid}');}">
                  <div class="pc-friend-ava-shell">
                    <img src="${(f.avatar && !f.avatar.includes('unsplash.com')) ? f.avatar : getAvatarUrl(f.name)}" alt="${f.name}" />
                    <span class="pc-friend-dot"></span>
                  </div>
                  <span class="pc-friend-chip-name">${f.name}</span>
                </div>
              `).join('');
            }
          }
        });
      }).catch(() => {});
    }
  }

  function closeFriendsModal() {
    const overlay = document.getElementById('friends-overlay');
    if (overlay) overlay.style.display = 'none';
  }

  function isPlaceholderAvatar(src) {
    if (!src || typeof src !== 'string') return true;
    const s = src.trim();
    if (!s) return true;
    if (s.includes('unsplash.com')) return true;
    if (s.includes('default-user') || s.includes('/a/default-user') || s.includes('silhouette')) {
      return true;
    }
    if (s.includes('M64 28') || s.includes('M64%2028') || s.includes('20a20') || s.includes('c-22.1') || s.includes('rx=\'64\' fill=\'%23262626\'') || s.includes('rx="64" fill="#262626"')) {
      return true;
    }
    if (s.includes('%23888888') || s.includes('#888888') || s.includes("viewBox='0 0 200 200'") || s.includes("viewBox='0 0 140 140'") || s.includes("viewBox='0 0 128 128'")) {
      if (s.includes('dominant-baseline') || s.includes('fill=\'%23ffffff\'') || s.includes('fill="#ffffff"') || s.includes('stop-color')) {
        return false;
      }
      return true;
    }
    return false;
  }

  function updateAccountUi() {
    const user = getCurrentUser();
    const profile = getProfile() || {};
    const button = document.getElementById('nav-profile-btn');
    const avatarImage = document.getElementById('profile-avatar-image');
    const avatarFallback = document.getElementById('profile-avatar-fallback');
    const displayNameInput = document.getElementById('profile-display-name');
    const email = document.getElementById('profile-email');
    const kind = document.getElementById('profile-account-kind');
    const cloudStatus = document.getElementById('profile-cloud-status');
    const profileLoginButton = document.getElementById('profile-login-btn');
    const pageProfileLoginButton = document.getElementById('page-profile-login-btn');
    const isLoggedIn = !!user && !user.isAnonymous;
    const isGuest = !!user && user.isAnonymous;
    const heroName = document.getElementById('profile-display-name-text');
    const heroHandle = document.getElementById('profile-handle-text');
    const heroRole = document.getElementById('profile-role-text');

    const defaultName = isGuest ? 'Гость' : (user ? (user.displayName || (user.email ? user.email.split('@')[0] : 'Пользователь')) : 'Гость');
    let nameText = profile.displayName || profile.name || defaultName;
    const emailPrefix = user && user.email ? user.email.split('@')[0].toLowerCase() : '';
    if ((!nameText || nameText.toLowerCase() === emailPrefix || nameText === 'Пользователь') && emailPrefix === 'vovan232012s') {
      nameText = 'exieeez';
    }

    const defaultHandle = isGuest ? 'guest' : (user ? (user.email ? user.email.split('@')[0] : (user.displayName ? user.displayName.toLowerCase().replace(/\s+/g, '') : 'user')) : 'guest');
    let handleText = profile.handle || defaultHandle;
    if ((!handleText || handleText.toLowerCase() === emailPrefix || handleText === 'user') && emailPrefix === 'vovan232012s') {
      handleText = 'god';
    }
    handleText = '@' + String(handleText).replace(/^@/, '');
    const roleText = isLoggedIn ? 'Пользователь' : (isGuest ? 'Гость (не привязан)' : 'Не авторизован');

    if (heroName) heroName.textContent = nameText;
    if (heroHandle) heroHandle.textContent = handleText;
    if (heroRole) heroRole.textContent = roleText;

    // Apply Material You theme palette from profile color
    applyMaterialYouPalette(hueOfColor(profile.color));

    // Render profile chips (telegram, discord, website)
    const chipsEl = document.getElementById('profile-chips');
    if (chipsEl) {
      let ch = '';
      if (profile.tg && profile.tg.trim()) {
        const tgClean = profile.tg.trim().replace(/^@/, '');
        ch += `<a class="chip chip-tg" target="_blank" rel="noopener" href="https://t.me/${encodeURIComponent(tgClean)}" title="Telegram: @${escapeHtml(tgClean)}"><svg class="ico" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.75-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .38z"/></svg><span>@${escapeHtml(tgClean)}</span></a>`;
      }
      if (profile.ds && profile.ds.trim()) {
        const dsVal = profile.ds.trim();
        ch += `<button class="chip chip-ds" type="button" title="Скопировать Discord: ${escapeHtml(dsVal)}" data-ds="${escapeHtml(dsVal)}"><svg class="ico" viewBox="0 0 24 24" fill="currentColor"><path d="M19.27 5.33C17.94 4.71 16.5 4.26 15 4a.09.09 0 0 0-.07.03c-.18.33-.39.76-.53 1.09a16.09 16.09 0 0 0-4.8 0c-.14-.34-.35-.76-.54-1.09-.01-.02-.04-.03-.07-.03-1.5.26-2.93.71-4.27 1.33-.01 0-.02.01-.03.02-2.72 4.07-3.47 8.03-3.1 11.95 0 .02.01.04.03.05 1.8 1.32 3.53 2.12 5.24 2.65.03.01.06 0 .07-.02.4-.55.76-1.13 1.07-1.74.02-.04 0-.08-.04-.09-.57-.22-1.11-.48-1.64-.78-.04-.02-.04-.08-.01-.11.11-.08.22-.17.33-.25.02-.02.05-.02.07-.01 3.44 1.57 7.15 1.57 10.55 0 .02-.01.05-.01.07.01.11.09.22.17.33.26.04.03.04.09-.01.11-.52.31-1.07.56-1.64.78-.04.01-.05.06-.04.09.32.61.68 1.19 1.07 1.74.03.01.06.02.09.01 1.72-.53 3.45-1.33 5.25-2.65.02-.01.03-.03.03-.05.44-4.53-.73-8.46-3.1-11.95-.01-.01-.02-.02-.04-.02zM8.52 14.91c-1.03 0-1.89-.95-1.89-2.12s.84-2.12 1.89-2.12c1.06 0 1.9.96 1.89 2.12 0 1.17-.84 2.12-1.89 2.12zm6.97 0c-1.03 0-1.89-.95-1.89-2.12s.84-2.12 1.89-2.12c1.06 0 1.9.96 1.89 2.12 0 1.17-.83 2.12-1.89 2.12z"/></svg><span>${escapeHtml(dsVal)}</span></button>`;
      }
      if (profile.site && profile.site.trim()) {
        let u = profile.site.trim();
        if (!/^https?:\/\//i.test(u)) u = 'https://' + u;
        const displayUrl = u.replace(/^https?:\/\//, '').replace(/\/$/, '');
        ch += `<a class="chip chip-site" target="_blank" rel="noopener" href="${u}" title="Сайт: ${escapeHtml(displayUrl)}"><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg><span>${escapeHtml(displayUrl)}</span></a>`;
      }
      chipsEl.innerHTML = ch;
      chipsEl.style.display = ch ? 'flex' : 'none';

      chipsEl.querySelectorAll('.chip-ds').forEach(btn => {
        btn.onclick = (e) => {
          e.preventDefault();
          const val = btn.dataset.ds;
          if (val) {
            navigator.clipboard?.writeText(val).then(() => {
              if (typeof window.showToast === 'function') window.showToast('Discord скопирован: ' + val);
            }).catch(() => {});
          }
        };
      });
    }

    // Render integrations section in profile body
    const intSec = document.getElementById('profile-v1-integrations-section');
    const intList = document.getElementById('profile-v1-integrations-list');
    if (intSec && intList) {
      let cards = '';
      if (profile.tg && profile.tg.trim()) {
        const tgClean = profile.tg.trim().replace(/^@/, '');
        cards += `
          <a class="pv1-int-card" target="_blank" rel="noopener" href="https://t.me/${encodeURIComponent(tgClean)}" title="Открыть Telegram">
            <div class="pv1-int-icon-circle pv1-int-tg">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.75-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .38z"/></svg>
            </div>
            <div class="pv1-int-info">
              <div class="pv1-int-platform">Telegram</div>
              <div class="pv1-int-value">@${escapeHtml(tgClean)}</div>
            </div>
            <div class="pv1-int-action-icon">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3"/></svg>
            </div>
          </a>
        `;
      }
      if (profile.ds && profile.ds.trim()) {
        const dsVal = profile.ds.trim();
        cards += `
          <button class="pv1-int-card pv1-int-card-btn" type="button" data-ds="${escapeHtml(dsVal)}" title="Скопировать Discord">
            <div class="pv1-int-icon-circle pv1-int-ds">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M19.27 5.33C17.94 4.71 16.5 4.26 15 4a.09.09 0 0 0-.07.03c-.18.33-.39.76-.53 1.09a16.09 16.09 0 0 0-4.8 0c-.14-.34-.35-.76-.54-1.09-.01-.02-.04-.03-.07-.03-1.5.26-2.93.71-4.27 1.33-.01 0-.02.01-.03.02-2.72 4.07-3.47 8.03-3.1 11.95 0 .02.01.04.03.05 1.8 1.32 3.53 2.12 5.24 2.65.03.01.06 0 .07-.02.4-.55.76-1.13 1.07-1.74.02-.04 0-.08-.04-.09-.57-.22-1.11-.48-1.64-.78-.04-.02-.04-.08-.01-.11.11-.08.22-.17.33-.25.02-.02.05-.02.07-.01 3.44 1.57 7.15 1.57 10.55 0 .02-.01.05-.01.07.01.11.09.22.17.33.26.04.03.04.09-.01.11-.52.31-1.07.56-1.64.78-.04.01-.05.06-.04.09.32.61.68 1.19 1.07 1.74.03.01.06.02.09.01 1.72-.53 3.45-1.33 5.25-2.65.02-.01.03-.03.03-.05.44-4.53-.73-8.46-3.1-11.95-.01-.01-.02-.02-.04-.02zM8.52 14.91c-1.03 0-1.89-.95-1.89-2.12s.84-2.12 1.89-2.12c1.06 0 1.9.96 1.89 2.12 0 1.17-.84 2.12-1.89 2.12zm6.97 0c-1.03 0-1.89-.95-1.89-2.12s.84-2.12 1.89-2.12c1.06 0 1.9.96 1.89 2.12 0 1.17-.83 2.12-1.89 2.12z"/></svg>
            </div>
            <div class="pv1-int-info">
              <div class="pv1-int-platform">Discord</div>
              <div class="pv1-int-value">${escapeHtml(dsVal)}</div>
            </div>
            <div class="pv1-int-action-icon">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
            </div>
          </button>
        `;
      }
      if (profile.site && profile.site.trim()) {
        let u = profile.site.trim();
        if (!/^https?:\/\//i.test(u)) u = 'https://' + u;
        const displayUrl = u.replace(/^https?:\/\//, '').replace(/\/$/, '');
        cards += `
          <a class="pv1-int-card" target="_blank" rel="noopener" href="${u}" title="Открыть сайт">
            <div class="pv1-int-icon-circle pv1-int-site">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>
            </div>
            <div class="pv1-int-info">
              <div class="pv1-int-platform">Сайт</div>
              <div class="pv1-int-value">${escapeHtml(displayUrl)}</div>
            </div>
            <div class="pv1-int-action-icon">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3"/></svg>
            </div>
          </a>
        `;
      }
      intList.innerHTML = cards;
      intSec.style.display = cards ? 'block' : 'none';

      intList.querySelectorAll('.pv1-int-card-btn').forEach(btn => {
        btn.onclick = (e) => {
          e.preventDefault();
          const val = btn.dataset.ds;
          if (val) {
            navigator.clipboard?.writeText(val).then(() => {
              if (typeof window.showToast === 'function') window.showToast('Discord скопирован: ' + val);
            }).catch(() => {});
          }
        };
      });
    }

    if (button) {
      button.classList.toggle('signed-in', isLoggedIn);
      button.title = isLoggedIn ? 'Профиль' : 'Войти в аккаунт';
      const icon = button.querySelector('.material-icons');
      if (icon) icon.textContent = isLoggedIn ? 'account_circle' : 'person_outline';
    }
    if (displayNameInput) displayNameInput.value = profile.displayName || (isLoggedIn ? nameText : '');
    const handleInput = document.getElementById('profile-handle');
    if (handleInput) handleInput.value = profile.handle || (user ? defaultHandle : '');
    const aboutInput = document.getElementById('profile-about');
    if (aboutInput) aboutInput.value = profile.about || '';
    const aboutEl = document.getElementById('profile-about-text');
    if (aboutEl) {
      if (profile.about && profile.about.trim()) {
        aboutEl.textContent = profile.about.trim();
        aboutEl.style.display = 'block';
      } else {
        aboutEl.style.display = 'none';
      }
    }
    if (email)
      email.textContent =
        user?.email || (isGuest ? 'Гостевой аккаунт' : 'Не авторизован (оффлайн)');
    if (kind)
      kind.textContent = isGuest
        ? 'Гость'
        : isLoggedIn
          ? 'Аккаунт Firebase'
          : 'Локальный режим';
    if (cloudStatus) {
      cloudStatus.textContent = state.available
        ? isLoggedIn
          ? 'Синхронизация включена'
          : 'Войдите для синхронизации с облаком'
        : state.error?.message || 'Firebase не настроен';
    }
    if (profileLoginButton) {
      profileLoginButton.style.display = isLoggedIn ? 'none' : 'block';
      profileLoginButton.textContent = isGuest
        ? 'Привязать аккаунт (Google / Email)'
        : 'Войти / Зарегистрироваться';
    }
    if (profile && isPlaceholderAvatar(profile.avatar)) {
      profile.avatar = '';
    }
    if ((nameText.toLowerCase() === 'exieeez' || nameText.toLowerCase() === 'god' || handleText.toLowerCase() === '@god' || emailPrefix === 'vovan232012s') && (!profile.avatar || isPlaceholderAvatar(profile.avatar) || profile.avatar.startsWith('data:image/svg+xml'))) {
      profile.avatar = EXIEEEZ_SIGNATURE_AVATAR;
    }
    const effectiveAvatarSrc = profile.avatar || (user?.photoURL && !isPlaceholderAvatar(user.photoURL) ? user.photoURL : '') || (user?.photoUrl && !isPlaceholderAvatar(user.photoUrl) ? user.photoUrl : '') || getAvatarUrl(nameText);
    if (avatarImage) {
      avatarImage.src = effectiveAvatarSrc;
      avatarImage.style.display = 'block';
      if (avatarFallback) avatarFallback.style.display = 'none';
    }

    const pageHeroName = document.getElementById('page-profile-display-name-text');
    const pageHeroHandle = document.getElementById('page-profile-handle-text');
    const pageHeroRole = document.getElementById('page-profile-role-text');
    if (pageHeroName) pageHeroName.textContent = nameText;
    if (pageHeroHandle) pageHeroHandle.textContent = handleText;
    if (pageHeroRole) pageHeroRole.textContent = roleText;

    const pageAvatar = document.getElementById('page-profile-avatar-image');
    if (pageAvatar) {
      pageAvatar.src = effectiveAvatarSrc;
    }

    const editAva = document.getElementById('profile-avatar-image-edit');
    if (editAva) {
      editAva.src = effectiveAvatarSrc;
    }

    const tbAvatar = document.getElementById('tb-avatar-img');
    if (tbAvatar) {
      tbAvatar.src = effectiveAvatarSrc;
    }
    const tbName = document.getElementById('tb-profile-name');
    if (tbName) {
      tbName.textContent = nameText;
    }

    // 1. Banner Rendering (smooth bottom fade overlay)
    const bannerBg = document.getElementById('profile-banner-bg');
    const pageBannerBg = document.getElementById('page-profile-banner-bg');
    const bannerVal = profile.banner || '';
    const bannerGradients = {
      'grad-1': 'linear-gradient(135deg, #7928ca 0%, #ff0080 50%, #11101d 100%)',
      'grad-2': 'linear-gradient(135deg, #00f2fe 0%, #4facfe 50%, #050b14 100%)',
      'grad-3': 'linear-gradient(135deg, #833ab4 0%, #fd1d1d 50%, #fcb045 100%)',
      'grad-4': 'linear-gradient(135deg, #10b981 0%, #059669 50%, #022c22 100%)',
      'grad-5': 'linear-gradient(135deg, #ff416c 0%, #ff4b2b 50%, #1a0505 100%)',
      'grad-6': 'linear-gradient(135deg, #00c6ff 0%, #0072ff 50%, #030f26 100%)',
      'grad-7': 'linear-gradient(135deg, #a855f7 0%, #6366f1 50%, #0f172a 100%)',
      'grad-8': 'linear-gradient(135deg, #f43f5e 0%, #fb7185 50%, #1e050c 100%)',
      'grad-9': 'linear-gradient(135deg, #18181b 0%, #09090b 100%)',
    };
    const applyBanner = (el, val) => {
      if (!el) return;
      if (val && (val.startsWith('http') || val.startsWith('data:image/'))) {
        el.style.backgroundImage = `url("${val.replace(/"/g, '\\"')}")`;
      } else if (val && bannerGradients[val]) {
        el.style.backgroundImage = bannerGradients[val];
      } else {
        el.style.backgroundImage = 'none';
        el.style.backgroundColor = '#14161f';
      }
    };
    applyBanner(bannerBg, bannerVal);
    applyBanner(pageBannerBg, bannerVal);

    const bannerInput = document.getElementById('profile-banner-url');
    const pageBannerInput = document.getElementById('page-profile-banner-url');
    if (bannerInput && !bannerInput.matches(':focus')) bannerInput.value = (bannerVal.startsWith('http') ? bannerVal : '');
    if (pageBannerInput && !pageBannerInput.matches(':focus')) pageBannerInput.value = (bannerVal.startsWith('http') ? bannerVal : '');

    // 2. Clean Avatar (no frames)
    const avatarWrapper = document.getElementById('profile-avatar-wrapper');
    const pageAvatarWrapper = document.getElementById('page-profile-avatar-wrapper');
    if (avatarWrapper) avatarWrapper.dataset.frame = 'none';
    if (pageAvatarWrapper) pageAvatarWrapper.dataset.frame = 'none';

    // 3. Favorite Track Section (Telegram style)
    const renderFavTrack = (sectionId, coverId, titleId, artistId, albumId, playBtnId, track) => {
      const sec = document.getElementById(sectionId);
      const coverEl = document.getElementById(coverId);
      const titleEl = document.getElementById(titleId);
      const artistEl = document.getElementById(artistId);
      const albumEl = document.getElementById(albumId);
      const playBtn = document.getElementById(playBtnId);
      if (!sec) return;
      sec.style.display = 'block';
      const contentEl = sec.querySelector('#profile-fav-track-content') || document.getElementById('profile-fav-track-content');
      let emptyEl = sec.querySelector('#profile-fav-track-empty') || document.getElementById('profile-fav-track-empty');
      if (track && track.title) {
        if (contentEl) contentEl.style.setProperty('display', 'flex', 'important');
        if (emptyEl) emptyEl.style.setProperty('display', 'none', 'important');
        if (coverEl) coverEl.src = track.cover || 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="72" height="72" viewBox="0 0 72 72"><rect width="72" height="72" fill="%231b2836"/><path d="M30 22v22a8 8 0 1 0 4 7V30l14-4v14a8 8 0 1 0 4 7V22L30 26z" fill="%237d8494"/></svg>';
        
        const rawArtist = (track.artist && track.artist !== 'Unknown' && track.artist !== 'Неизвестный исполнитель') ? track.artist : '';
        if (titleEl) titleEl.textContent = track.title || 'Без названия';
        if (artistEl) artistEl.textContent = rawArtist || 'Неизвестный исполнитель';
        if (albumEl) albumEl.textContent = (track.album || track.title || 'Сингл').toUpperCase();
        
        const playAction = (e) => {
          if (e) e.stopPropagation();
          if (typeof window.playTrack === 'function') {
            window.playTrack(track);
            if (typeof window.showToast === 'function') window.showToast('Воспроизведение: ' + track.title);
          }
          if (typeof closeProfile === 'function') {
            closeProfile();
          }
          if (typeof window.openTvKaraoke === 'function') {
            window.openTvKaraoke(true);
          } else if (typeof window.openFullscreenPlayer === 'function') {
            window.openFullscreenPlayer();
          }
        };
        if (playBtn) playBtn.onclick = playAction;
        if (contentEl) {
          contentEl.onclick = playAction;
          contentEl.style.cursor = 'pointer';
        }
        const cardTarget = contentEl || sec.querySelector('.pin') || sec.querySelector('.pc-fav-track-row');
        if (cardTarget) {
          cardTarget.onclick = playAction;
          applyFavTrackCoverBackground(cardTarget, track.cover, track);
        }
        const rowEl = sec.querySelector('.pc-fav-track-row');
        if (rowEl && rowEl !== cardTarget) {
          rowEl.onclick = playAction;
          applyFavTrackCoverBackground(rowEl, track.cover, track);
        }
      } else {
        if (contentEl) contentEl.style.setProperty('display', 'none', 'important');
        const curActive = getLivePlayingTrack();
        if (!emptyEl) {
          emptyEl = document.createElement('div');
          emptyEl.id = 'profile-fav-track-empty';
          emptyEl.className = 'm3p-pl-empty';
          sec.appendChild(emptyEl);
        }
        if (curActive && (curActive.title || curActive.id)) {
          const cName = `${curActive.artist ? curActive.artist + ' - ' : ''}${curActive.title || 'Трек'}`;
          emptyEl.innerHTML = `Любимый трек не выбран.<br><span style="color:var(--md-sys-color-primary, #D0BCFF); font-weight:600; cursor:pointer; display:inline-block; margin-top:6px;">📌 Нажмите, чтобы закрепить «${escapeHtml(cName)}»</span>`;
          emptyEl.onclick = (e) => {
            e.stopPropagation();
            const prof = getProfile() || {};
            prof.favTrack = Object.assign({}, curActive);
            setProfile(prof);
            pendingProfileFavTrack = prof.favTrack;
            updateAccountUi();
            showProfileToast('Закреплён трек: ' + (curActive.title || 'Трек'));
            try {
              const u = getCurrentUser();
              if (u && !u.isAnonymous && db) {
                db.collection('users').doc(u.uid).set({ favTrack: prof.favTrack }, { merge: true }).catch(() => {});
              }
            } catch (_) {}
          };
        } else {
          emptyEl.innerHTML = 'Любимый трек не выбран.<br>Включите трек или выберите его в режиме редактирования.';
          emptyEl.onclick = () => openProfileEditMode(true);
        }
        emptyEl.style.setProperty('display', 'grid', 'important');
      }
    };
    renderFavTrack('profile-fav-track-section', 'profile-fav-track-cover', 'profile-fav-track-title', 'profile-fav-track-artist', 'profile-fav-track-album', 'profile-fav-track-play-btn', profile.favTrack);
    renderFavTrack('page-profile-fav-track-section', 'page-profile-fav-track-cover', 'page-profile-fav-track-title', 'page-profile-fav-track-artist', 'page-profile-fav-track-album', 'page-profile-fav-track-play-btn', profile.favTrack);

    const prevFav = document.getElementById('profile-fav-track-selected-preview');
    const pagePrevFav = document.getElementById('page-profile-fav-track-selected-preview');
    const favText = profile.favTrack ? `✓ ${profile.favTrack.artist ? profile.favTrack.artist + ' - ' : ''}${profile.favTrack.title}` : '';
    if (prevFav) prevFav.textContent = favText;
    if (pagePrevFav) pagePrevFav.textContent = favText;

    const pageNameInput = document.getElementById('page-profile-display-name');
    const pageHandleInput = document.getElementById('page-profile-handle');
    const pageAboutInput = document.getElementById('page-profile-about');
    const pageStatusInput = document.getElementById('page-profile-status');
    const pageTgInput = document.getElementById('page-profile-tg');
    const pageDsInput = document.getElementById('page-profile-ds');
    const pageSiteInput = document.getElementById('page-profile-site');
    if (pageNameInput && !pageNameInput.matches(':focus')) pageNameInput.value = profile.displayName || user?.displayName || '';
    if (pageHandleInput && !pageHandleInput.matches(':focus')) pageHandleInput.value = profile.handle || (user ? defaultHandle : '');
    if (pageAboutInput && !pageAboutInput.matches(':focus')) pageAboutInput.value = profile.about || '';
    if (pageStatusInput && !pageStatusInput.matches(':focus')) pageStatusInput.value = profile.status || '';
    if (pageTgInput && !pageTgInput.matches(':focus')) pageTgInput.value = profile.tg || '';
    if (pageDsInput && !pageDsInput.matches(':focus')) pageDsInput.value = profile.ds || '';
    if (pageSiteInput && !pageSiteInput.matches(':focus')) pageSiteInput.value = profile.site || '';

    pageProfileColor = profile.color || '';
    renderColorSwatches('page-profile-sws', pageProfileColor, (c) => {
      pageProfileColor = c;
      renderColorSwatches('page-profile-sws', pageProfileColor, (c2) => {
        pageProfileColor = c2;
      });
    });

    // Render real user playlists
    const plsGrid = document.getElementById('pc-user-playlists-grid');
    const pagePlsGrid = document.getElementById('page-user-playlists-grid');

    const getAppPlaylists = () => {
      const result = [];
      const mapByName = new Map();

      const addOrMerge = (p) => {
        if (!p || !p.name) return;
        const name = String(p.name).trim();
        const trks = Array.isArray(p.tracks) ? p.tracks : [];
        const rawCount = typeof p.count === 'number' && p.count > 0 ? p.count : (typeof p.trackCount === 'number' && p.trackCount > 0 ? p.trackCount : trks.length);
        const firstCover = trks.find(t => t && (t.thumbnail || t.cover || t.image || t.c));
        const cov = p.cover || (firstCover ? (firstCover.thumbnail || firstCover.cover || firstCover.image || firstCover.c) : '') || '';

        const existing = mapByName.get(name);
        if (existing) {
          if (trks.length > 0) {
            if (!existing.tracks || existing.tracks.length === 0 || trks.length > existing.tracks.length) {
              existing.tracks = trks;
            }
          }
          existing.count = Math.max(existing.count || 0, rawCount || 0, (existing.tracks && existing.tracks.length) || 0);
          if (!existing.cover && cov) {
            existing.cover = cov;
          }
          if ((!existing.id || existing.id === existing.name) && p.id && p.id !== name) {
            existing.id = p.id;
          }
        } else {
          const item = {
            id: p.id || name,
            name: name,
            tracks: trks,
            count: Math.max(rawCount || 0, trks.length),
            cover: cov,
          };
          mapByName.set(name, item);
          result.push(item);
        }
      };

      // 0. Always include favorites first with true count and cover
      try {
        const favs = (window.state && Array.isArray(window.state.favorites) && window.state.favorites.length > 0)
          ? window.state.favorites
          : JSON.parse(localStorage.getItem('devsize_favorites') || '[]');
        if (Array.isArray(favs) && favs.length > 0) {
          const firstCover = favs.find(t => t && (t.thumbnail || t.cover || t.image || t.c));
          const cov = firstCover ? (firstCover.thumbnail || firstCover.cover || firstCover.image || firstCover.c) : '';
          addOrMerge({
            id: 'favorites',
            name: 'Избранное',
            tracks: favs,
            count: favs.length,
            cover: cov
          });
        }
      } catch (_) {}

      // 1. Check window.state.playlists (in-memory state)
      if (window.state && Array.isArray(window.state.playlists)) {
        window.state.playlists.forEach(p => addOrMerge(p));
      }

      // 1.5. Check window.__sharedStorageData (cross-platform synchronized state)
      if (window.__sharedStorageData && Array.isArray(window.__sharedStorageData.playlists)) {
        window.__sharedStorageData.playlists.forEach(p => addOrMerge(p));
      }

      // 2. Check localStorage devsize_playlists
      try {
        const stored = JSON.parse(localStorage.getItem('devsize_playlists') || '[]');
        if (Array.isArray(stored)) {
          stored.forEach(p => addOrMerge(p));
        }
      } catch (_) {}

      // 3. Check profile.playlists (cloud/Firestore summaries)
      if (profile && Array.isArray(profile.playlists)) {
        profile.playlists.forEach(p => addOrMerge(p));
      }

      // 4. Fallback check votify-playlists
      try {
        const alt = JSON.parse(localStorage.getItem('votify-playlists') || '{}');
        if (alt && typeof alt === 'object' && !Array.isArray(alt)) {
          Object.keys(alt).forEach(name => {
            const trks = Array.isArray(alt[name]) ? alt[name] : [];
            addOrMerge({
              id: name,
              name: name,
              tracks: trks,
              count: trks.length,
              cover: (trks[0] && (trks[0].cover || trks[0].thumbnail)) || ''
            });
          });
        }
      } catch (_) {}

      // Reconcile track counts against live sources
      result.forEach(pl => {
        const pNameLower = String(pl.name || '').trim().toLowerCase();
        if (pNameLower === 'избранное' || pNameLower === 'любимые треки' || pl.id === 'favorites') {
          const liveFavs = (window.state && Array.isArray(window.state.favorites) && window.state.favorites.length > 0)
            ? window.state.favorites
            : JSON.parse(localStorage.getItem('devsize_favorites') || '[]');
          if (Array.isArray(liveFavs) && liveFavs.length > 0) {
            pl.tracks = liveFavs;
            pl.count = liveFavs.length;
          }
        } else {
          let livePl = window.state?.playlists?.find(sp => {
            if (!sp) return false;
            const spNameLower = String(sp.name || '').trim().toLowerCase();
            return (spNameLower && spNameLower === pNameLower) || (pl.id && String(sp.id) === String(pl.id));
          });
          if (!livePl || !Array.isArray(livePl.tracks) || livePl.tracks.length === 0) {
            if (window.__sharedStorageData && Array.isArray(window.__sharedStorageData.playlists)) {
              const sharedMatch = window.__sharedStorageData.playlists.find(sp => {
                if (!sp) return false;
                const spNameLower = String(sp.name || '').trim().toLowerCase();
                return (spNameLower && spNameLower === pNameLower) || (pl.id && String(sp.id) === String(pl.id));
              });
              if (sharedMatch && Array.isArray(sharedMatch.tracks) && sharedMatch.tracks.length > 0) {
                livePl = sharedMatch;
              }
            }
          }
          if (!livePl || !Array.isArray(livePl.tracks) || livePl.tracks.length === 0) {
            try {
              const storedPls = JSON.parse(localStorage.getItem('devsize_playlists') || '[]');
              const match = Array.isArray(storedPls) && storedPls.find(sp => {
                if (!sp) return false;
                const spNameLower = String(sp.name || '').trim().toLowerCase();
                return (spNameLower && spNameLower === pNameLower) || (pl.id && String(sp.id) === String(pl.id));
              });
              if (match && Array.isArray(match.tracks) && match.tracks.length > 0) {
                livePl = match;
              }
            } catch (_) {}
          }
          if (livePl) {
            if (Array.isArray(livePl.tracks) && livePl.tracks.length > 0) {
              pl.tracks = livePl.tracks;
              pl.count = livePl.tracks.length;
            }
            if (!pl.cover && livePl.cover) pl.cover = livePl.cover;
          }
        }
      });

      // If all playlists show 0 tracks (fresh device or race before shared storage loads), fetch shared storage
      if (result.length > 0 && result.every(p => !p.count || p.count === 0) && !getAppPlaylists._syncing) {
        getAppPlaylists._syncing = true;
        const apiPort = (window.state && window.state.serverPort) || 17217;
        fetch(`http://127.0.0.1:${apiPort}/api/sync/shared-storage`)
          .then(r => r.json())
          .then(res => {
            if (res && res.ok && res.data) {
              let updated = false;
              if (Array.isArray(res.data.playlists) && res.data.playlists.length > 0) {
                if (window.state) window.state.playlists = res.data.playlists;
                try { localStorage.setItem('devsize_playlists', JSON.stringify(res.data.playlists)); } catch (_) {}
                updated = true;
              }
              if (Array.isArray(res.data.favorites) && res.data.favorites.length > 0) {
                if (window.state) window.state.favorites = res.data.favorites;
                try { localStorage.setItem('devsize_favorites', JSON.stringify(res.data.favorites)); } catch (_) {}
                updated = true;
              }
              if (updated && typeof updateAccountUi === 'function') {
                updateAccountUi();
              }
              const pGrid1 = document.getElementById('pc-profile-playlists-grid');
              const pGrid2 = document.getElementById('page-profile-playlists-grid');
              if (typeof renderPlCards === 'function') {
                if (pGrid1) renderPlCards(pGrid1);
                if (pGrid2) renderPlCards(pGrid2);
              }
            }
          })
          .catch(() => {})
          .finally(() => {
            getAppPlaylists._syncing = false;
          });
      }

      // Keep window.state.playlists and devsize_playlists in sync with realPlaylists
      if (window.state && Array.isArray(window.state.playlists)) {
        let changed = false;
        result.forEach(p => {
          if (!p || !p.name || p.name === 'Избранное' || p.name === 'Любимые треки' || p.name === 'Favorites') return;
          let match = window.state.playlists.find(sp => sp.name === p.name || (p.id && sp.id === p.id));
          if (!match) {
            window.state.playlists.push({
              id: p.id || ('pl_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5)),
              name: p.name,
              tracks: Array.isArray(p.tracks) ? p.tracks : [],
              cover: p.cover || ''
            });
            changed = true;
          } else if (Array.isArray(p.tracks) && p.tracks.length > 0 && (!match.tracks || match.tracks.length === 0)) {
            match.tracks = p.tracks;
            if (!match.cover && p.cover) match.cover = p.cover;
            changed = true;
          }
        });
        if (changed) {
          try { localStorage.setItem('devsize_playlists', JSON.stringify(window.state.playlists)); } catch (_) {}
          if (typeof window.updatePlaylistsUI === 'function') window.updatePlaylistsUI();
        }
      }

      return result;
    };

    const renderPlCards = (container) => {
      if (!container) return;
      const currentPlaylists = getAppPlaylists();
      if (currentPlaylists.length === 0) {
        container.innerHTML = '<div class="m3p-pl-empty">Нет созданных плейлистов</div>';
        return;
      }
      const defaultCoverSvg = 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128"><rect width="128" height="128" rx="24" fill="#1b1b22"/><path d="M52 40v36.5a14 14 0 1 0 8 12.5V54l24-6v22.5a14 14 0 1 0 8 12.5V40L52 46z" fill="#8b8b96"/></svg>');
      container.innerHTML = currentPlaylists.map(pl => {
        const name = pl.name || 'Плейлист';
        const tracks = Array.isArray(pl.tracks) ? pl.tracks : [];
        let count = tracks.length > 0 ? tracks.length : (typeof pl.count === 'number' && pl.count > 0 ? pl.count : (typeof pl.trackCount === 'number' ? pl.trackCount : 0));
        if (count === 0 && profile && Array.isArray(profile.playlists)) {
          const profMatch = profile.playlists.find(pp => pp && String(pp.name || '').trim().toLowerCase() === String(name).trim().toLowerCase());
          if (profMatch && typeof profMatch.count === 'number' && profMatch.count > 0) {
            count = profMatch.count;
          }
        }
        if (count === 0) {
          const pNameLower = String(name).trim().toLowerCase();
          if (pNameLower === 'избранное' || pNameLower === 'любимые треки' || pl.id === 'favorites') {
            const favCount = (window.state && Array.isArray(window.state.favorites) && window.state.favorites.length > 0)
              ? window.state.favorites.length
              : JSON.parse(localStorage.getItem('devsize_favorites') || '[]').length;
            if (favCount > 0) count = favCount;
          } else {
            const liveMatch = (window.state?.playlists || []).find(sp => sp && (String(sp.name || '').trim().toLowerCase() === pNameLower || String(sp.id) === String(pl.id)));
            if (liveMatch && Array.isArray(liveMatch.tracks) && liveMatch.tracks.length > 0) {
              count = liveMatch.tracks.length;
              pl.tracks = liveMatch.tracks;
            } else {
              if (window.__sharedStorageData && Array.isArray(window.__sharedStorageData.playlists)) {
                const shMatch = window.__sharedStorageData.playlists.find(sp => sp && (String(sp.name || '').trim().toLowerCase() === pNameLower || String(sp.id) === String(pl.id)));
                if (shMatch && Array.isArray(shMatch.tracks) && shMatch.tracks.length > 0) {
                  count = shMatch.tracks.length;
                  pl.tracks = shMatch.tracks;
                }
              }
              if (count === 0) {
                try {
                  const storedPls = JSON.parse(localStorage.getItem('devsize_playlists') || '[]');
                  const storedMatch = storedPls.find(sp => sp && (String(sp.name || '').trim().toLowerCase() === pNameLower || String(sp.id) === String(pl.id)));
                  if (storedMatch && Array.isArray(storedMatch.tracks) && storedMatch.tracks.length > 0) {
                    count = storedMatch.tracks.length;
                    pl.tracks = storedMatch.tracks;
                  }
                } catch (_) {}
              }
            }
          }
        }
        const countStr = count + ' ' + (count === 1 ? 'трек' : (count >= 2 && count <= 4) ? 'трека' : 'треков');
        const firstTrackWithCover = tracks.find(t => t && (t.thumbnail || t.cover || t.image || t.c));
        const cover = pl.cover || (firstTrackWithCover ? (firstTrackWithCover.thumbnail || firstTrackWithCover.cover || firstTrackWithCover.image || firstTrackWithCover.c) : '') || defaultCoverSvg;
        const safeName = String(name).replace(/"/g, '&quot;');
        const safeId = String(pl.id || name).replace(/"/g, '&quot;');
        return `
          <div class="pl pc-playlist-card" data-pl-id="${safeId}" data-pl="${safeName}">
            <div class="art pc-pl-cover-wrap">
              <img class="pc-pl-cover-img" src="${cover}" alt="${safeName}" onerror="this.onerror=null;this.src='${defaultCoverSvg}';" />
              <button class="pc-pl-play-btn" title="Воспроизвести" type="button">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><polygon points="7 5 18 12 7 19"></polygon></svg>
              </button>
            </div>
            <b class="pc-pl-name">${safeName}</b>
            <span class="pc-pl-count">${countStr}</span>
          </div>
        `;
      }).join('');

      container.querySelectorAll('.pc-playlist-card').forEach(card => {
        const plId = card.getAttribute('data-pl-id');
        const plName = card.getAttribute('data-pl');
        card.addEventListener('click', () => {
          // Сначала открываем нужный экран, и только потом закрываем профиль:
          // иначе при неудаче пользователь остаётся в медиатеке.
          const isFavorites =
            plId === 'favorites' ||
            plName === 'Избранное' ||
            plName === 'Любимые треки' ||
            plName === 'favorites';

          if (isFavorites) {
            closeProfile();
            if (typeof window.switchView === 'function') window.switchView('favorites');
            const favTab = document.querySelector('[data-lib-tab="favorites"]');
            if (favTab) favTab.click();
            return;
          }

          // Пытаемся открыть детальный вид плейлиста по id, затем по имени.
          const openById = () => {
            if (typeof window.openPlaylistDetail !== 'function' || !plId) return false;
            try {
              window.openPlaylistDetail(plId);
            } catch (e) {
              return false;
            }
            return window.state?.currentPlaylistId === plId;
          };

          const openByName = () => {
            if (typeof window.openPlaylist !== 'function') return false;
            try {
              window.openPlaylist(plName || plId);
            } catch (e) {
              return false;
            }
            return Boolean(window.state?.currentPlaylistId);
          };

          const ok = openById() || openByName();
          closeProfile();

          // Если открыть не удалось — не оставляем пользователя в пустоте.
          if (!ok) {
            if (typeof window.showToast === 'function') {
              window.showToast('Не удалось открыть плейлист «' + (plName || '') + '»');
            }
            if (typeof window.switchView === 'function') window.switchView('favorites');
          }
        });

        const playBtn = card.querySelector('.pc-pl-play-btn');
        if (playBtn) {
          playBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const targetPl = realPlaylists.find(p => String(p.id) === plId || p.name === plName);
            if (targetPl && Array.isArray(targetPl.tracks) && targetPl.tracks.length > 0 && typeof window.playTrack === 'function') {
              window.playTrack(targetPl.tracks[0], [...targetPl.tracks], 0);
              closeProfile();
            }
          });
        }
      });
    };
    renderPlCards(plsGrid);
    renderPlCards(pagePlsGrid);

    // Render real friends
    getFriends().then(friends => {
      ['pc-friends-count', 'page-friends-count'].forEach(id => {
        const countEl = document.getElementById(id);
        if (countEl) countEl.textContent = friends.length + ' ' + (friends.length === 1 ? 'друг' : friends.length >= 2 && friends.length <= 4 ? 'друга' : 'друзей');
      });
      ['pc-friends-list', 'page-friends-list'].forEach(id => {
        const listEl = document.getElementById(id);
        if (listEl) {
          if (friends.length === 0) {
            listEl.innerHTML = '<div style="font-size:12px; color:#737373; padding:8px 0;">У вас пока нет друзей</div>';
          } else {
            listEl.innerHTML = friends.map(f => `
              <div class="pc-friend-chip" style="cursor:pointer;" onclick="if(window.openUserProfile){window.openUserProfile('${f.uid}');}">
                <div class="pc-friend-ava-shell">
                  <img src="${(f.avatar && !f.avatar.includes('unsplash.com')) ? f.avatar : getAvatarUrl(f.name)}" alt="${f.name}" />
                  <span class="pc-friend-dot"></span>
                </div>
                <span class="pc-friend-chip-name">${f.name}</span>
              </div>
            `).join('');
          }
        }
      });
    }).catch(() => {});
  }

  function fileToImage(file, maxW = 900, maxH = 600, quality = 0.8) {
    return new Promise((resolve, reject) => {
      if (!file?.type?.startsWith('image/')) return reject(new Error('Выберите изображение'));
      const image = new Image();
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('Не удалось прочитать изображение'));
      reader.onload = event => {
        image.onload = () => {
          let w = image.width;
          let h = image.height;
          if (w > maxW || h > maxH) {
            const ratio = Math.min(maxW / w, maxH / h);
            w = Math.round(w * ratio);
            h = Math.round(h * ratio);
          }
          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(image, 0, 0, w, h);
          resolve(canvas.toDataURL('image/webp', quality));
        };
        image.onerror = () => reject(new Error('Некорректное изображение'));
        image.src = event.target.result;
      };
      reader.readAsDataURL(file);
    });
  }

  function fileToAvatar(file) {
    return new Promise((resolve, reject) => {
      if (!file?.type?.startsWith('image/')) return reject(new Error('Выберите изображение'));
      const image = new Image();
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('Не удалось прочитать изображение'));
      reader.onload = event => {
        image.onload = () => {
          const canvas = document.createElement('canvas');
          const size = 128;
          canvas.width = size;
          canvas.height = size;
          const context = canvas.getContext('2d');
          const scale = Math.max(size / image.width, size / image.height);
          const width = image.width * scale;
          const height = image.height * scale;
          context.drawImage(image, (size - width) / 2, (size - height) / 2, width, height);
          resolve(canvas.toDataURL('image/webp', 0.78));
        };
        image.onerror = () => reject(new Error('Некорректное изображение'));
        image.src = event.target.result;
      };
      reader.readAsDataURL(file);
    });
  }
  let pendingProfileBanner = undefined;
  let pendingProfileShowcase = undefined;
  let pendingProfileFavTrack = undefined;

  window.toggleProfileEditForm = function(formId) {
    const form = document.getElementById(formId);
    if (!form) return;
    const isHidden = (form.style.display === 'none' || !form.style.display);
    form.style.display = isHidden ? 'block' : 'none';
    if (isHidden) {
      setTimeout(() => {
        form.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 30);
    }
  };

  function wireUi() {
    const handleProfileTrigger = () => {
      const user = getCurrentUser();
      if (!user || user.isAnonymous) {
        openAuth('auth-login');
      } else {
        openProfile();
      }
    };
    document.getElementById('nav-profile-btn')?.addEventListener('click', handleProfileTrigger);
    document.getElementById('tb-avatar-btn')?.addEventListener('click', handleProfileTrigger);
    document.getElementById('auth-close-btn')?.addEventListener('click', closeAuth);
    document.getElementById('profile-close-btn')?.addEventListener('click', closeProfile);

    // Profile Edit toggle & Navigation
    document.getElementById('profile-edit-toggle-btn')?.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      openProfileEditMode();
    });
    document.getElementById('profile-edit-back-btn')?.addEventListener('click', () => {
      closeProfileEditMode();
    });
    document.getElementById('profile-edit-cancel-btn')?.addEventListener('click', () => {
      closeProfileEditMode();
    });
    document.getElementById('profile-fav-track-change-btn')?.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const live = getLivePlayingTrack();
      const prof = getProfile() || {};
      if (live && (live.title || live.id) && (!prof.favTrack || prof.favTrack.title !== live.title)) {
        prof.favTrack = Object.assign({}, live);
        setProfile(prof);
        pendingProfileFavTrack = prof.favTrack;
        updateAccountUi();
        showProfileToast('Закреплён трек: ' + (live.title || 'Трек'));
        try {
          const u = getCurrentUser();
          if (u && !u.isAnonymous && db) {
            db.collection('users').doc(u.uid).set({ favTrack: prof.favTrack }, { merge: true }).catch(() => {});
          }
        } catch (_) {}
      } else {
        openProfileEditMode(true);
      }
    });

    // Publish button
    document.getElementById('pc-publish-btn')?.addEventListener('click', () => {
      const sub = document.getElementById('pc-playlists-sync-sub');
      if (sub) sub.textContent = 'Все изменения сохранены';
      showProfileToast('Профиль опубликован');
    });

    // Premium customization button
    document.getElementById('prem')?.addEventListener('click', () => {
      showProfileToast('Требуется подписка для кастомизации никнейма');
    });

    // Integrations edit click
    document.querySelectorAll('#profile-overlay .pc-int-row').forEach(btn => {
      btn.addEventListener('click', () => {
        const k = btn.getAttribute('data-k');
        if (k) {
          const names = { tg: ['Telegram', '@username'], ds: ['Discord', 'username'], site: ['Сайт', 'https://'] };
          const info = names[k] || ['Интеграция', ''];
          const curVal = profileDraft[k] || '';
          showProfileModal(`
            <h3>${info[0]}</h3>
            <div class="tf" style="margin-top:16px;">
              <div class="bx">
                <input id="modal-int-input" placeholder=" " maxlength="64" autocapitalize="off" value="${escapeHtml(curVal)}" />
                <label style="left:12px">${info[1]}</label>
              </div>
            </div>
            <div class="da">
              <button class="btn x" id="modal-int-clear" type="button">Очистить</button>
              <button class="btn f" id="modal-int-save" type="button">Готово</button>
            </div>
          `);
          const modalInp = document.getElementById('modal-int-input');
          if (modalInp) setTimeout(() => modalInp.focus(), 60);
          document.getElementById('modal-int-clear')?.addEventListener('click', () => {
            profileDraft[k] = '';
            closeProfileModal();
            refreshProfileEditUi();
          });
          document.getElementById('modal-int-save')?.addEventListener('click', () => {
            profileDraft[k] = (document.getElementById('modal-int-input')?.value || '').trim();
            closeProfileModal();
            refreshProfileEditUi();
          });
        }
      });
    });

    // Pin track click handler in edit view
    document.getElementById('profile-pinslot')?.addEventListener('click', (e) => {
      if (e.target.closest('#pinadd')) {
        const selectable = getAllSelectableTracks();
        showProfileModal(`
          <h3>Выбрать любимый трек</h3>
          <div style="display:flex; flex-direction:column; gap:6px; max-height:60vh; overflow-y:auto;">
            ${selectable.map((t, idx) => `
              <div class="opt" data-track-idx="${idx}">
                <img class="cv" src="${t.cover || DEFAULT_TRACK_COVER}" alt="" />
                <div>
                  <b>${escapeHtml(t.title)}</b>
                  <span>${escapeHtml(t.artist || 'Unknown')}</span>
                </div>
              </div>
            `).join('')}
          </div>
        `);
        document.querySelectorAll('#profile-dlg .opt').forEach(opt => {
          opt.addEventListener('click', () => {
            const idx = +opt.getAttribute('data-track-idx');
            if (selectable[idx]) {
              profileDraft.favTrack = selectable[idx];
              pendingProfileFavTrack = selectable[idx];
              closeProfileModal();
              refreshProfileEditUi();
            }
          });
        });
      } else if (e.target.closest('#unpin')) {
        profileDraft.favTrack = null;
        pendingProfileFavTrack = null;
        refreshProfileEditUi();
      }
    });

    // Close modal dialog on backdrop click or ESC
    document.getElementById('profile-mask')?.addEventListener('click', (e) => {
      if (e.target.id === 'profile-mask') closeProfileModal();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeProfileModal();
    });

    // Live character count listeners and draft updates (lightweight, zero lag)
    const syncInputDraft = (id, prop, max, countId) => {
      const el = document.getElementById(id);
      const countEl = document.getElementById(countId);
      if (!el) return;
      el.addEventListener('input', () => {
        profileDraft[prop] = el.value;
        if (countEl) countEl.textContent = `${el.value.length}/${max}`;
      });
    };
    syncInputDraft('profile-display-name', 'displayName', 32, 'cn1');
    syncInputDraft('profile-handle', 'handle', 12, 'cn2');
    syncInputDraft('profile-about', 'about', 32, 'cn3');
    syncInputDraft('profile-status', 'status', 32, 'cn4');

    const pageEditBtn = document.getElementById('page-profile-edit-toggle-btn');
    if (pageEditBtn) {
      pageEditBtn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        window.toggleProfileEditForm('page-profile-edit-form');
      };
    }

    // Frame selection live preview
    const handleFrameSelectChange = (e) => {
      const frame = e.target.value;
      const avatarWrap = document.getElementById('profile-avatar-wrapper');
      const pageAvatarWrap = document.getElementById('page-profile-avatar-wrapper');
      if (avatarWrap) avatarWrap.dataset.frame = frame;
      if (pageAvatarWrap) pageAvatarWrap.dataset.frame = frame;
      const select1 = document.getElementById('profile-frame-select');
      const select2 = document.getElementById('page-profile-frame-select');
      if (select1 && select1 !== e.target) select1.value = frame;
      if (select2 && select2 !== e.target) select2.value = frame;
    };
    document.getElementById('profile-frame-select')?.addEventListener('change', handleFrameSelectChange);
    document.getElementById('page-profile-frame-select')?.addEventListener('change', handleFrameSelectChange);

    // Banner file upload handlers
    const handleBannerFileChange = async (e) => {
      try {
        const dataUrl = await fileToImage(e.target.files?.[0], 1200, 500, 0.82);
        pendingProfileBanner = dataUrl;
        const b1 = document.getElementById('profile-banner-bg');
        const b2 = document.getElementById('page-profile-banner-bg');
        if (b1) b1.style.backgroundImage = `url("${dataUrl}")`;
        if (b2) b2.style.backgroundImage = `url("${dataUrl}")`;
        if (typeof window.showToast === 'function') window.showToast('Баннер загружен');
      } catch (err) {
        if (typeof window.showToast === 'function') window.showToast(err.message);
      } finally {
        e.target.value = '';
      }
    };
    document.getElementById('profile-banner-file-input')?.addEventListener('change', handleBannerFileChange);

    // Кнопка-бейдж на баннере: открывает выбор файла (как в мобильной версии)
    document.getElementById('profile-banner-edit-btn')?.addEventListener('click', () => {
      const input = document.getElementById('profile-banner-file-input');
      if (input) input.click();
    });
    document.getElementById('page-profile-banner-file-input')?.addEventListener('change', handleBannerFileChange);

    // Banner clear handlers
    const handleBannerClear = () => {
      pendingProfileBanner = '';
      const in1 = document.getElementById('profile-banner-url');
      const in2 = document.getElementById('page-profile-banner-url');
      if (in1) in1.value = '';
      if (in2) in2.value = '';
      const b1 = document.getElementById('profile-banner-bg');
      const b2 = document.getElementById('page-profile-banner-bg');
      if (b1) { b1.style.backgroundImage = 'none'; b1.style.backgroundColor = '#14161f'; }
      if (b2) { b2.style.backgroundImage = 'none'; b2.style.backgroundColor = '#14161f'; }
      if (typeof window.showToast === 'function') window.showToast('Баннер сброшен');
    };
    document.getElementById('profile-banner-clear-btn')?.addEventListener('click', handleBannerClear);
    document.getElementById('page-profile-banner-clear-btn')?.addEventListener('click', handleBannerClear);

    // Banner URL live preview handlers (typing / paste)
    const handleBannerUrlInput = (e) => {
      const url = e.target.value.trim();
      pendingProfileBanner = url;
      const b1 = document.getElementById('profile-banner-bg');
      const b2 = document.getElementById('page-profile-banner-bg');
      const in1 = document.getElementById('profile-banner-url');
      const in2 = document.getElementById('page-profile-banner-url');
      if (e.target !== in1 && in1) in1.value = url;
      if (e.target !== in2 && in2) in2.value = url;
      if (url && (url.startsWith('http') || url.startsWith('data:image/'))) {
        if (b1) b1.style.backgroundImage = `url("${url.replace(/"/g, '\\"')}")`;
        if (b2) b2.style.backgroundImage = `url("${url.replace(/"/g, '\\"')}")`;
      } else if (url && url.startsWith('grad-')) {
        if (b1) b1.style.backgroundImage = 'var(--' + url + ', linear-gradient(135deg, #1e1e24 0%, #2a2b36 100%))';
        if (b2) b2.style.backgroundImage = 'var(--' + url + ', linear-gradient(135deg, #1e1e24 0%, #2a2b36 100%))';
      } else if (!url) {
        if (b1) b1.style.backgroundImage = 'linear-gradient(135deg, #1e1e24 0%, #2a2b36 100%)';
        if (b2) b2.style.backgroundImage = 'linear-gradient(135deg, #1e1e24 0%, #2a2b36 100%)';
      }
    };
    document.getElementById('profile-banner-url')?.addEventListener('input', handleBannerUrlInput);
    document.getElementById('profile-banner-url')?.addEventListener('change', handleBannerUrlInput);
    document.getElementById('page-profile-banner-url')?.addEventListener('input', handleBannerUrlInput);
    document.getElementById('page-profile-banner-url')?.addEventListener('change', handleBannerUrlInput);

    // Favorite Track: Set current track
    const handleSetCurrentFavTrack = () => {
      let cur = getLivePlayingTrack();

      if (cur && cur.title) {
        pendingProfileFavTrack = {
          id: cur.id || ('track_' + Date.now()),
          title: cur.title,
          artist: cur.artist || '',
          cover: cur.cover || '',
          duration: Number(cur.duration) || 0,
        };
        profileDraft.favTrack = pendingProfileFavTrack;
        refreshProfileEditUi();
        const text = `✓ ${cur.artist ? cur.artist + ' - ' : ''}${cur.title}`;
        const p1 = document.getElementById('profile-fav-track-selected-preview');
        const p2 = document.getElementById('page-profile-fav-track-selected-preview');
        if (p1) p1.textContent = text;
        if (p2) p2.textContent = text;
        if (typeof window.showToast === 'function') window.showToast('Любимый трек выбран: ' + cur.title);
      } else {
        if (typeof window.showToast === 'function') window.showToast('Сейчас ничего не играет. Запустите трек и нажмите снова');
      }
    };
    document.getElementById('profile-fav-track-set-current-btn')?.addEventListener('click', handleSetCurrentFavTrack);
    document.getElementById('page-profile-fav-track-set-current-btn')?.addEventListener('click', handleSetCurrentFavTrack);

    // Favorite Track: Clear
    const handleClearFavTrack = () => {
      pendingProfileFavTrack = null;
      profileDraft.favTrack = null;
      refreshProfileEditUi();
      const p1 = document.getElementById('profile-fav-track-selected-preview');
      const p2 = document.getElementById('page-profile-fav-track-selected-preview');
      if (p1) p1.textContent = 'Трек сброшен';
      if (p2) p2.textContent = 'Трек сброшен';
      if (typeof window.showToast === 'function') window.showToast('Любимый трек очищен');
    };
    document.getElementById('profile-fav-track-clear-btn')?.addEventListener('click', handleClearFavTrack);
    document.getElementById('page-profile-fav-track-clear-btn')?.addEventListener('click', handleClearFavTrack);

    // Spotify Profile Import handler
    const handleSpotifyProfileImport = async () => {
      const input = document.getElementById('profile-spotify-url')?.value?.trim();
      const statusEl = document.getElementById('profile-spotify-status');
      const btn = document.getElementById('btn-import-spotify-profile');
      if (!input) {
        if (typeof window.showToast === 'function') window.showToast('Введите ссылку на профиль или юзернейм Spotify');
        return;
      }
      if (btn) { btn.disabled = true; btn.textContent = 'Загрузка...'; }
      if (statusEl) {
        statusEl.style.display = 'block';
        statusEl.textContent = 'Получение данных профиля Spotify...';
        statusEl.style.color = 'var(--text-secondary, #94a3b8)';
      }

      try {
        const apiBase = (typeof window !== 'undefined' && window.state && window.state.serverPort)
          ? `http://127.0.0.1:${window.state.serverPort}`
          : (window.location.protocol.startsWith('http') ? '' : 'http://127.0.0.1:38472');
        const res = await fetch(`${apiBase}/api/spotify/profile?user=${encodeURIComponent(input)}`);
        const data = await res.json();
        if (!res.ok || !data.success || !data.user) {
          throw new Error(data.error || 'Профиль не найден');
        }
        const user = data.user;

        // 1. Name
        const nameInput = document.getElementById('profile-display-name');
        if (nameInput && user.name) nameInput.value = user.name;
        const nameText = document.getElementById('profile-display-name-text');
        if (nameText && user.name) nameText.textContent = user.name;

        // 2. Handle
        const cleanHandle = (user.id || user.handle || '').replace(/[^a-zA-Z0-9_\-\.]/g, '');
        const handleInput = document.getElementById('profile-handle');
        if (handleInput && cleanHandle) handleInput.value = cleanHandle;
        const handleText = document.getElementById('profile-handle-text');
        if (handleText && cleanHandle) handleText.textContent = '@' + cleanHandle;

        // 3. Bio / About
        const aboutInput = document.getElementById('profile-about');
        if (aboutInput && user.description) aboutInput.value = user.description;

        // 4. Avatar
        if (user.avatar) {
          const avatarImg = document.getElementById('profile-avatar-img');
          if (avatarImg) avatarImg.src = user.avatar;
          if (state && state.profile) {
            state.profile.avatar = user.avatar;
          }
        }

        // 5. Banner
        if (user.avatar) {
          const b1 = document.getElementById('profile-banner-bg');
          if (b1) {
            b1.style.backgroundImage = `url("${user.avatar.replace(/"/g, '\\"')}")`;
            b1.style.backgroundSize = 'cover';
            b1.style.backgroundPosition = 'center';
          }
          const bannerInput = document.getElementById('profile-banner-url');
          if (bannerInput) bannerInput.value = user.avatar;
          pendingProfileBanner = user.avatar;
        }

        if (statusEl) {
          statusEl.textContent = `✓ Профиль «${user.name}» загружен! Нажмите «Сохранить»`;
          statusEl.style.color = '#1db954';
        }
        if (typeof window.showToast === 'function') {
          window.showToast(`Профиль Spotify «${user.name}» импортирован! Нажмите «Сохранить»`);
        }
      } catch (err) {
        if (statusEl) {
          statusEl.textContent = err.message || 'Ошибка импорта профиля';
          statusEl.style.color = 'var(--md-sys-color-error, #ba1a1a)';
        }
        if (typeof window.showToast === 'function') window.showToast(err.message || 'Ошибка импорта', 'error');
      } finally {
        if (btn) { btn.disabled = false; btn.textContent = 'Импортировать'; }
      }
    };
    document.getElementById('btn-import-spotify-profile')?.addEventListener('click', handleSpotifyProfileImport);

    // Save profile handlers
    document.getElementById('profile-save-btn')?.addEventListener('click', async event => {
      const button = event.currentTarget;
      setBusy(button, true);
      try {
        const newName = document.getElementById('profile-display-name')?.value?.trim();
        const newHandle = document.getElementById('profile-handle')?.value?.trim();
        const newAbout = document.getElementById('profile-about')?.value?.trim();
        const newStatus = document.getElementById('profile-status')?.value?.trim();
        const tgInput = document.getElementById('profile-int-tg-input');
        const dsInput = document.getElementById('profile-int-ds-input');
        const siteInput = document.getElementById('profile-int-site-input');
        const newTg = tgInput ? tgInput.value.trim() : (profileDraft.tg !== undefined ? profileDraft.tg : (state.profile?.tg || ''));
        const newDs = dsInput ? dsInput.value.trim() : (profileDraft.ds !== undefined ? profileDraft.ds : (state.profile?.ds || ''));
        const newSite = siteInput ? siteInput.value.trim() : (profileDraft.site !== undefined ? profileDraft.site : (state.profile?.site || ''));
        const newColor = profileDraft.color !== undefined ? profileDraft.color : (state.profile?.color || '');
        const bannerUrlVal = document.getElementById('profile-banner-url')?.value?.trim() || '';
        const newBanner = pendingProfileBanner !== undefined ? pendingProfileBanner : (bannerUrlVal || state.profile?.banner || '');
        const newFavTrack = pendingProfileFavTrack !== undefined ? pendingProfileFavTrack : (profileDraft.favTrack !== undefined ? profileDraft.favTrack : (state.profile?.favTrack || null));

        if (!newName || !newHandle) {
          showProfileToast('Заполните никнейм и юзернейм');
          return;
        }

        await saveProfile({
          displayName: newName,
          ...(newHandle !== undefined ? { handle: newHandle } : {}),
          avatar: state.profile?.avatar || '',
          about: newAbout,
          status: newStatus,
          tg: newTg,
          ds: newDs,
          site: newSite,
          color: newColor,
          banner: newBanner,
          frame: 'none',
          favTrack: newFavTrack,
        });
        pendingProfileBanner = undefined;
        pendingProfileFavTrack = undefined;
        closeProfileEditMode();
        showProfileToast('Профиль сохранён');
      } catch (error) {
        showProfileToast(friendlyError(error));
      } finally {
        setBusy(button, false);
      }
    });

    document.getElementById('page-profile-save-btn')?.addEventListener('click', async event => {
      const button = event.currentTarget;
      setBusy(button, true);
      try {
        const newName = document.getElementById('page-profile-display-name')?.value?.trim();
        const newHandle = document.getElementById('page-profile-handle')?.value?.trim();
        const newAbout = document.getElementById('page-profile-about')?.value?.trim();
        const newStatus = document.getElementById('page-profile-status')?.value?.trim();
        const newTg = document.getElementById('page-profile-tg')?.value?.trim();
        const newDs = document.getElementById('page-profile-ds')?.value?.trim();
        const newSite = document.getElementById('page-profile-site')?.value?.trim();
        const newColor = pageProfileColor !== undefined ? pageProfileColor : (state.profile?.color || '');
        const bannerUrlVal = document.getElementById('page-profile-banner-url')?.value?.trim() || '';
        const newBanner = pendingProfileBanner !== undefined ? pendingProfileBanner : (bannerUrlVal || state.profile?.banner || '');
        const newFavTrack = pendingProfileFavTrack !== undefined ? pendingProfileFavTrack : (state.profile?.favTrack || null);

        await saveProfile({
          displayName: newName,
          ...(newHandle !== undefined ? { handle: newHandle } : {}),
          avatar: state.profile?.avatar || '',
          about: newAbout,
          status: newStatus,
          tg: newTg,
          ds: newDs,
          site: newSite,
          color: newColor,
          banner: newBanner,
          frame: 'none',
          favTrack: newFavTrack,
        });
        pendingProfileBanner = undefined;
        pendingProfileFavTrack = undefined;
        const form = document.getElementById('page-profile-edit-form');
        if (form) form.style.display = 'none';
        if (typeof window.showToast === 'function') window.showToast('Профиль сохранён');
      } catch (error) {
        if (typeof window.showToast === 'function') window.showToast(friendlyError(error));
      } finally {
        setBusy(button, false);
      }
    });

    // Avatar upload handlers
    const triggerAvatarSelection = async () => {
      try {
        const apiPort = (window.state && window.state.serverPort) || 17217;
        const res = await fetch(`http://127.0.0.1:${apiPort}/api/dialog/pick-image`);
        const data = await res.json();
        if (data && data.ok && data.dataUrl) {
          const currentHandle = document.getElementById('profile-handle')?.value?.trim() || document.getElementById('page-profile-handle')?.value?.trim() || state.profile?.handle || '';
          await saveProfile({
            displayName: document.getElementById('profile-display-name')?.value?.trim() || document.getElementById('page-profile-display-name')?.value?.trim() || state.profile?.displayName || '',
            handle: currentHandle,
            avatar: data.dataUrl,
            about: document.getElementById('profile-about')?.value?.trim() || document.getElementById('page-profile-about')?.value?.trim() || state.profile?.about || '',
          });
          if (state.profile) {
            state.profile.avatar = data.dataUrl;
            state.profile.photoUrl = data.dataUrl;
          }
          updateAccountUi();
          if (typeof window.showToast === 'function') window.showToast('Аватар успешно обновлён');
          return;
        }
        if (data && data.cancelled) return;
      } catch (_) {}

      const input = document.getElementById('profile-avatar-input') || document.getElementById('page-profile-avatar-input');
      if (input) input.click();
    };

    document.getElementById('av1')?.addEventListener('click', (e) => {
      e.preventDefault();
      triggerAvatarSelection();
    });
    document.getElementById('av2')?.addEventListener('click', (e) => {
      e.preventDefault();
      triggerAvatarSelection();
    });
    document.getElementById('profile-avatar-wrapper')?.addEventListener('click', (e) => {
      e.preventDefault();
      triggerAvatarSelection();
    });
    document.getElementById('profile-avatar-image-edit')?.addEventListener('click', (e) => {
      e.preventDefault();
      triggerAvatarSelection();
    });

    const handleAvatarChange = async event => {
      try {
        const file = event.target.files?.[0];
        if (!file) return;
        const avatar = await fileToAvatar(file);
        const currentHandle = document.getElementById('profile-handle')?.value?.trim() || document.getElementById('page-profile-handle')?.value?.trim() || state.profile?.handle || '';
        await saveProfile({
          displayName: document.getElementById('profile-display-name')?.value?.trim() || document.getElementById('page-profile-display-name')?.value?.trim() || state.profile?.displayName || '',
          handle: currentHandle,
          avatar,
          about: document.getElementById('profile-about')?.value?.trim() || document.getElementById('page-profile-about')?.value?.trim() || state.profile?.about || '',
        });
        if (state.profile) {
          state.profile.avatar = avatar;
          state.profile.photoUrl = avatar;
        }
        updateAccountUi();
        if (typeof window.showToast === 'function') window.showToast('Аватар обновлён');
      } catch (error) {
        if (typeof window.showToast === 'function') window.showToast(friendlyError(error));
      } finally {
        event.target.value = '';
      }
    };
    document.getElementById('profile-avatar-input')?.addEventListener('change', handleAvatarChange);
    document.getElementById('page-profile-avatar-input')?.addEventListener('change', handleAvatarChange);

    // Profile App Bar actions
    document.getElementById('profile-friends-btn')?.addEventListener('click', () => {
      openFriendsModal();
    });

    document.getElementById('friends-modal-close-btn')?.addEventListener('click', () => {
      closeFriendsModal();
    });

    document.getElementById('friends-overlay')?.addEventListener('click', (e) => {
      if (e.target.id === 'friends-overlay') {
        closeFriendsModal();
      }
    });

    document.getElementById('profile-copy-id-btn')?.addEventListener('click', () => {
      const handle = document.getElementById('profile-handle-text')?.textContent || '@user';
      navigator.clipboard.writeText(handle).then(() => {
        if (typeof window.showToast === 'function') window.showToast('Юзернейм ' + handle + ' скопирован!');
      }).catch(() => {
        if (typeof window.showToast === 'function') window.showToast('Юзернейм: ' + handle);
      });
    });

    document.getElementById('profile-settings-btn')?.addEventListener('click', () => {
      closeProfile();
      // Настройки в этом приложении — это экран #view-settings (не модалка settings-overlay),
      // поэтому открываем его через switchView, иначе клик молча ничего не делает.
      let opened = false;
      if (typeof window.switchView === 'function') {
        try {
          window.switchView('settings');
          opened = !!document
            .getElementById('view-settings')
            ?.classList.contains('active');
        } catch (e) {
          opened = false;
        }
      }
      if (!opened) {
        const navBtn = document.getElementById('nav-settings');
        if (navBtn) {
          navBtn.click();
          opened = !!document
            .getElementById('view-settings')
            ?.classList.contains('active');
        }
      }
      if (opened && typeof window.showSettingsCategory === 'function') {
        window.showSettingsCategory('profile');
      }
    });

    document.getElementById('profile-logout-btn')?.addEventListener('click', async () => {
      await signOut().catch(() => {});
      closeProfile();
      if (typeof window.showToast === 'function') window.showToast('Вы вышли из аккаунта');
    });

    document.getElementById('profile-modal-close-icon-btn')?.addEventListener('click', closeProfile);

    // Publish & Sync Playlists buttons
    const handlePublishPlaylists = async () => {
      ['pc-playlists-sync-sub', 'page-playlists-sync-sub'].forEach(id => {
        const sub = document.getElementById(id);
        if (sub) sub.textContent = 'Синхронизация...';
      });
      try {
        const localPls = getLocalPlaylistsDictionary();
        if (state.user && !state.user.isAnonymous) {
          await pushState({ playlists: localPls });
        }
        await publishPlaylistsToPublic(localPls);
        ['pc-playlists-sync-sub', 'page-playlists-sync-sub'].forEach(id => {
          const sub = document.getElementById(id);
          if (sub) sub.textContent = 'Все изменения сохранены';
        });
        if (typeof window.showToast === 'function') window.showToast('Плейлисты успешно синхронизированы!');
      } catch (err) {
        ['pc-playlists-sync-sub', 'page-playlists-sync-sub'].forEach(id => {
          const sub = document.getElementById(id);
          if (sub) sub.textContent = 'Ошибка синхронизации';
        });
        if (typeof window.showToast === 'function') window.showToast('Ошибка синхронизации: ' + friendlyError(err));
      }
    };
    document.getElementById('pc-publish-btn')?.addEventListener('click', handlePublishPlaylists);
    document.getElementById('page-publish-btn')?.addEventListener('click', handlePublishPlaylists);

    // Overlays background click
    document.getElementById('profile-overlay')?.addEventListener('click', e => {
      if (e.target.id === 'profile-overlay') closeProfile();
    });
    document.getElementById('other-profile-overlay')?.addEventListener('click', e => {
      if (e.target.id === 'other-profile-overlay') closeUserProfile();
    });
    document.getElementById('auth-overlay')?.addEventListener('click', e => {
      if (e.target.id === 'auth-overlay') closeAuth();
    });

    // Auth screen transitions & Two-Step Verification
    async function handleEmailNext() {
      const emailInput = document.getElementById('auth-initial-email');
      const email = (emailInput?.value || '').trim();
      setMessage('auth-email-error');
      if (!email) {
        setMessage('auth-email-error', 'Введите адрес электронной почты');
        return;
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        setMessage('auth-email-error', 'Некорректный адрес электронной почты');
        return;
      }

      const btn = document.getElementById('auth-email-next-btn');
      setBusy(btn, true);
      try {
        const exists = await checkEmailExists(email);
        if (exists) {
          // Email exists -> Show Spotify-style quick login with avatar, name & password
          updateQuickLoginUi(email);
          showAuthForm('auth-quick-login');
          window.setTimeout(() => {
            const passInput = document.getElementById('quick-login-password');
            if (passInput) {
              passInput.value = '';
              passInput.focus();
            }
          }, 60);
        } else {
          // Email does NOT exist -> Go directly to registration with pre-filled email
          const regEmail = document.getElementById('register-email');
          if (regEmail) regEmail.value = email;
          setMessage('register-error');
          showAuthForm('auth-register');
          window.setTimeout(() => {
            document.getElementById('register-username')?.focus();
          }, 60);
        }
      } catch (err) {
        setMessage('auth-email-error', err.message || friendlyError(err));
      } finally {
        setBusy(btn, false);
      }
    }

    document.getElementById('auth-email-next-btn')?.addEventListener('click', handleEmailNext);
    document.getElementById('auth-initial-email')?.addEventListener('keydown', event => {
      if (event.key === 'Enter') {
        event.preventDefault();
        handleEmailNext();
      }
    });

    document.getElementById('quick-login-switch')?.addEventListener('click', event => {
      event.preventDefault();
      showAuthForm('auth-email-step');
      window.setTimeout(() => {
        const emailInput = document.getElementById('auth-initial-email');
        if (emailInput) {
          emailInput.focus();
          emailInput.select();
        }
      }, 60);
    });
    document.getElementById('show-quick-login-from-login')?.addEventListener('click', event => {
      event.preventDefault();
      showAuthForm('auth-email-step');
      window.setTimeout(() => {
        document.getElementById('auth-initial-email')?.focus();
      }, 60);
    });
    document.getElementById('show-register-from-email')?.addEventListener('click', event => {
      event.preventDefault();
      const email = (document.getElementById('auth-initial-email')?.value || '').trim();
      if (email) {
        const regEmail = document.getElementById('register-email');
        if (regEmail) regEmail.value = email;
      }
      showAuthForm('auth-register');
    });
    document.getElementById('show-register')?.addEventListener('click', event => {
      event.preventDefault();
      showAuthForm('auth-register');
    });
    document.getElementById('show-forgot')?.addEventListener('click', event => {
      event.preventDefault();
      showAuthForm('auth-forgot');
    });
    document.getElementById('show-login-from-register')?.addEventListener('click', event => {
      event.preventDefault();
      showAuthForm('auth-email-step');
    });
    document.getElementById('show-login-from-forgot')?.addEventListener('click', event => {
      event.preventDefault();
      showAuthForm('auth-email-step');
    });

    // Quick Login Password & Submit
    const quickPassInput = document.getElementById('quick-login-password');
    const quickBtn = document.getElementById('quick-login-btn');
    if (quickPassInput) {
      quickPassInput.addEventListener('input', () => {
        if (quickBtn) {
          quickBtn.classList.toggle('ready', quickPassInput.value.length > 0);
        }
      });
      quickPassInput.addEventListener('keydown', event => {
        if (event.key === 'Enter') {
          event.preventDefault();
          quickBtn?.click();
        }
      });
    }

    quickBtn?.addEventListener('click', async event => {
      const button = event.currentTarget;
      setMessage('quick-login-error');
      const email = (document.getElementById('quick-login-email')?.textContent || '').trim();
      const password = document.getElementById('quick-login-password')?.value || '';
      if (!password) {
        setMessage('quick-login-error', 'Введите пароль');
        return;
      }
      setBusy(button, true);
      try {
        await signIn(email, password);
        closeAuth();
      } catch (error) {
        setMessage('quick-login-error', friendlyError(error));
      } finally {
        setBusy(button, false);
      }
    });

    // Window controls for auth top bar
    document.getElementById('auth-tb-min')?.addEventListener('click', () => {
      document.getElementById('tb-minimize')?.click();
    });
    document.getElementById('auth-tb-max')?.addEventListener('click', () => {
      document.getElementById('tb-maximize')?.click();
    });
    document.getElementById('auth-tb-close')?.addEventListener('click', () => {
      if (state.auth?.currentUser) {
        closeAuth();
      } else {
        document.getElementById('tb-close')?.click();
      }
    });

    document.querySelectorAll('.google-login-btn').forEach(button => {
      button.addEventListener('click', async event => {
        const target = event.currentTarget;
        const errorTarget = target.dataset.errorTarget || 'login-error';
        setMessage('login-error');
        setMessage('register-error');
        setMessage(errorTarget, 'Открываем браузер для входа через Google...');
        setBusy(target, true);
        try {
          await signInWithGoogle();
          closeAuth();
        } catch (error) {
          setMessage(errorTarget, friendlyError(error));
        } finally {
          setBusy(target, false);
        }
      });
    });

    document.getElementById('login-btn')?.addEventListener('click', async event => {
      const button = event.currentTarget;
      setMessage('login-error');
      setBusy(button, true);
      try {
        await signIn(
          document.getElementById('login-email')?.value.trim(),
          document.getElementById('login-password')?.value
        );
        closeAuth();
      } catch (error) {
        setMessage('login-error', friendlyError(error));
      } finally {
        setBusy(button, false);
      }
    });

    document.getElementById('register-btn')?.addEventListener('click', async event => {
      const button = event.currentTarget;
      const password = document.getElementById('register-password')?.value || '';
      const confirmation = document.getElementById('register-password2')?.value || '';
      setMessage('register-error');
      if (password !== confirmation) {
        setMessage('register-error', 'Пароли не совпадают');
        return;
      }
      setBusy(button, true);
      try {
        await register(
          document.getElementById('register-email')?.value.trim(),
          password,
          document.getElementById('register-username')?.value.trim()
        );
        closeAuth();
      } catch (error) {
        setMessage('register-error', friendlyError(error));
      } finally {
        setBusy(button, false);
      }
    });

    document.getElementById('forgot-btn')?.addEventListener('click', async event => {
      const button = event.currentTarget;
      const email = document.getElementById('forgot-email')?.value.trim();
      setMessage('forgot-error');
      setMessage('forgot-success');
      setBusy(button, true);
      try {
        await sendPasswordReset(email);
        setMessage('forgot-success', 'Ссылка для сброса пароля отправлена на почту');
      } catch (error) {
        setMessage('forgot-error', friendlyError(error));
      } finally {
        setBusy(button, false);
      }
    });

    document.querySelectorAll('.guest-login-btn').forEach(button => {
      button.addEventListener('click', async event => {
        const target = event.currentTarget;
        const errorTarget = target.closest('#auth-register') ? 'register-error' : 'login-error';
        setMessage(errorTarget);
        setBusy(target, true);
        try {
          await signInAsGuest();
          closeAuth();
        } catch (error) {
          setMessage(errorTarget, friendlyError(error));
        } finally {
          setBusy(target, false);
        }
      });
    });

    document.getElementById('other-profile-close-btn')?.addEventListener('click', closeUserProfile);

    // Friend search input
    const handleFriendSearch = async (e, containerId) => {
      const query = e.target.value.trim();
      const resContainer = document.getElementById(containerId);
      if (!resContainer) return;
      if (!query) {
        resContainer.innerHTML = '';
        return;
      }
      try {
        const matched = await searchUsers(query);
        if (matched.length === 0) {
          resContainer.innerHTML = '<div style="font-size:12px; color:#737373; padding:8px;">Пользователь не найден</div>';
        } else {
          resContainer.innerHTML = matched.map(u => `
            <div class="pc-search-result-item" style="display:flex; align-items:center; justify-content:space-between; padding:10px 14px; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.05); border-radius:14px; margin-bottom:8px; cursor:pointer; transition:all 0.15s ease;" onclick="if(window.VotifyCloud&&window.VotifyCloud.openUserProfile){window.VotifyCloud.openUserProfile('${u.uid}');}">
              <div style="display:flex; align-items:center; gap:12px;">
                <img src="${(u.avatar && !u.avatar.includes('unsplash.com')) ? u.avatar : getAvatarUrl(u.name || u.handle)}" style="width:38px; height:38px; border-radius:50%; object-fit:cover; border:1px solid rgba(255,255,255,0.1);" />
                <div>
                  <div style="font-size:14px; font-weight:700; color:#ffffff;">${u.name}</div>
                  <div style="font-size:12px; color:#a3a3a3; font-weight:500;">${u.handle}</div>
                </div>
              </div>
              <button class="pc-btn-publish" style="font-size:12px; padding:6px 14px; font-weight:700; background:rgba(34,197,94,0.15); color:#22c55e; border:1px solid rgba(34,197,94,0.3); border-radius:9999px; cursor:pointer; transition:all 0.15s ease;" onclick="event.stopPropagation(); if(window.VotifyCloud&&window.VotifyCloud.addFriend){window.VotifyCloud.addFriend('${u.uid}','${u.name.replace(/'/g, "\\'")}');}">+ Добавить</button>
            </div>
          `).join('');
        }
      } catch (err) {
        resContainer.innerHTML = '<div style="font-size:12px; color:#ef4444; padding:8px;">' + (err.message || 'Ошибка поиска') + '</div>';
      }
    };
    document.getElementById('friend-search-input')?.addEventListener('input', e => handleFriendSearch(e, 'friend-search-results'));
    document.getElementById('page-friend-search-input')?.addEventListener('input', e => handleFriendSearch(e, 'page-friend-search-results'));

    document.getElementById('profile-login-btn')?.addEventListener('click', async () => {
      const user = getCurrentUser();
      if (!user?.isAnonymous) await signOut().catch(() => {});
      closeProfile();
      openAuth(user?.isAnonymous ? 'auth-register' : 'auth-login');
    });

    updateAccountUi();
  }

  async function openUserProfile(userObjOrUid) {
    const overlay = document.getElementById('other-profile-overlay');
    if (overlay) {
      overlay.style.display = 'flex';
      overlay.style.zIndex = '100005';
      overlay.classList.remove('hidden');
    }

    closeFriendsModal();
    closeProfile();

    let user = null;
    const localFriends = JSON.parse(localStorage.getItem('votifyLocalFriends') || '[]');

    if (typeof userObjOrUid === 'object' && userObjOrUid !== null) {
      user = { ...userObjOrUid };
      if (user.uid && state.available && state.db && !String(user.uid).startsWith('local_') && !String(user.uid).startsWith('user_')) {
        try {
          const remote = await getUserProfile(user.uid);
          if (remote) user = { ...user, ...remote };
        } catch (e) {}
      }
    } else if (typeof userObjOrUid === 'string' && userObjOrUid.trim()) {
      const targetId = userObjOrUid.trim();
      const localMatch = localFriends.find(f => 
        (f.uid && f.uid === targetId) || 
        (f.name && f.name.toLowerCase() === targetId.toLowerCase()) || 
        (f.handle && f.handle.toLowerCase() === targetId.toLowerCase())
      );

      if (localMatch) {
        user = {
          uid: localMatch.uid || targetId,
          name: localMatch.name || 'Пользователь',
          handle: localMatch.handle || ('@' + String(localMatch.name || 'user').toLowerCase().replace(/\s+/g, '')),
          avatar: (localMatch.avatar && !localMatch.avatar.includes('unsplash.com')) ? localMatch.avatar : getAvatarUrl(localMatch.name),
          about: localMatch.about || 'Любитель хорошей музыки',
          banner: localMatch.banner || '',
          favTrack: localMatch.favTrack || null,
          playlists: localMatch.playlists || []
        };
      }

      if (state.available && state.db && !targetId.startsWith('local_') && !targetId.startsWith('user_')) {
        try {
          const remote = await getUserProfile(targetId);
          if (remote) user = { ...(user || {}), ...remote };
        } catch (e) {}
      }

      if (!user) {
        const cleanName = targetId.replace(/^@/, '');
        user = {
          uid: targetId,
          name: cleanName,
          handle: targetId.startsWith('@') ? targetId : '@' + cleanName.toLowerCase().replace(/\s+/g, ''),
          avatar: getAvatarUrl(cleanName),
          about: 'Любитель хорошей музыки',
          banner: '',
          playlists: []
        };
      }
    }

    if (!user) return;

    try {
      const avatar = document.getElementById('other-profile-avatar');
      const name = document.getElementById('other-profile-name');
      const handle = document.getElementById('other-profile-handle');
      const about = document.getElementById('other-profile-about');
      const addBtn = document.getElementById('other-profile-add-btn');

      const effectiveAvatar = (user.avatar && !user.avatar.includes('unsplash.com')) ? user.avatar : getAvatarUrl(user.name || user.handle);
      if (avatar) avatar.src = effectiveAvatar;
      if (name) name.textContent = user.name || 'Пользователь';
      if (handle) handle.textContent = user.handle || ('@' + String(user.name || 'user').toLowerCase());
      if (about) about.textContent = user.about || 'Любитель хорошей музыки';

      // Other user banner
      const otherBannerBg = document.getElementById('other-profile-banner-bg');
      if (otherBannerBg) {
        const bannerVal = user.banner || '';
        if (bannerVal && (bannerVal.startsWith('http') || bannerVal.startsWith('data:image/'))) {
          otherBannerBg.style.backgroundImage = `url("${bannerVal.replace(/"/g, '\\"')}")`;
        } else {
          otherBannerBg.style.backgroundImage = 'linear-gradient(135deg, #1e1e24 0%, #2a2b36 100%)';
        }
      }

      // Other user favorite track (Telegram style)
      const otherFavSec = document.getElementById('other-profile-fav-track-section');
      const otherFavCover = document.getElementById('other-profile-fav-track-cover');
      const otherFavTitle = document.getElementById('other-profile-fav-track-title');
      const otherFavArtist = document.getElementById('other-profile-fav-track-artist');
      const otherFavAlbum = document.getElementById('other-profile-fav-track-album');
      const otherFavPlayBtn = document.getElementById('other-profile-fav-track-play-btn');
      if (otherFavSec) {
        if (user.favTrack && user.favTrack.title) {
          otherFavSec.style.display = 'block';
          if (otherFavCover) otherFavCover.src = user.favTrack.cover || 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="72" height="72" viewBox="0 0 72 72"><rect width="72" height="72" fill="%231b2836"/><path d="M30 22v22a8 8 0 1 0 4 7V30l14-4v14a8 8 0 1 0 4 7V22L30 26z" fill="%237d8494"/></svg>';
          
          const rawArtist = (user.favTrack.artist && user.favTrack.artist !== 'Unknown' && user.favTrack.artist !== 'Неизвестный исполнитель') ? user.favTrack.artist : '';
          const hasArtistInTitle = rawArtist && user.favTrack.title.toLowerCase().includes(rawArtist.toLowerCase());
          const fullTitle = (rawArtist && !hasArtistInTitle) ? `${rawArtist} - ${user.favTrack.title}` : user.favTrack.title;
          
          if (otherFavTitle) otherFavTitle.textContent = fullTitle;
          if (otherFavArtist) otherFavArtist.textContent = rawArtist ? `<${rawArtist}>` : '<unknown>';
          if (otherFavAlbum) otherFavAlbum.textContent = (user.favTrack.album || user.favTrack.title || 'SINGLE').toUpperCase();
          
          const playAction = (e) => {
            if (e) e.stopPropagation();
            if (typeof window.playTrack === 'function') {
              window.playTrack(user.favTrack);
              if (typeof window.showToast === 'function') window.showToast('Воспроизведение: ' + user.favTrack.title);
            }
            if (typeof closeUserProfile === 'function') {
              closeUserProfile();
            }
            if (typeof window.openTvKaraoke === 'function') {
              window.openTvKaraoke(true);
            } else if (typeof window.openFullscreenPlayer === 'function') {
              window.openFullscreenPlayer();
            }
          };
          if (otherFavPlayBtn) otherFavPlayBtn.onclick = playAction;
          const otherFavContent = otherFavSec.querySelector('#other-profile-fav-track-content');
          if (otherFavContent) {
            otherFavContent.onclick = playAction;
            otherFavContent.style.cursor = 'pointer';
            applyFavTrackCoverBackground(otherFavContent, user.favTrack.cover, user.favTrack);
          }
          const rowEl = otherFavSec.querySelector('.pc-fav-track-row');
          if (rowEl && rowEl !== otherFavContent) {
            rowEl.onclick = playAction;
            applyFavTrackCoverBackground(rowEl, user.favTrack.cover, user.favTrack);
          }
        } else {
          otherFavSec.style.display = 'none';
        }
      }

      if (addBtn) {
        const isAlreadyFriend = localFriends.some(f => f.uid === user.uid || f.name === user.name);
        if (isAlreadyFriend) {
          addBtn.textContent = '✓ В друзьях';
          addBtn.disabled = true;
          addBtn.style.opacity = '0.6';
        } else {
          addBtn.disabled = false;
          addBtn.style.opacity = '1';
          addBtn.textContent = '+ Добавить в друзья';
        }
        addBtn.onclick = async () => {
          try {
            await addFriend(user.uid || ('user_' + Date.now()), user.name, user.avatar);
            addBtn.textContent = '✓ В друзьях';
            addBtn.disabled = true;
            addBtn.style.opacity = '0.6';
          } catch (e) {
            if (typeof window.showToast === 'function') window.showToast('Добавлен в друзья');
          }
        };
      }

      // Populate user playlists grid (real playlists only)
      const playlistsGrid = document.getElementById('other-profile-playlists-grid');
      const playlistsCount = document.getElementById('other-profile-playlists-count');
      
      let userPlaylists = user.playlists || [];
      if (!userPlaylists || userPlaylists.length === 0) {
        if (state.available && state.db && user.uid) {
          try {
            const libDoc = await syncRef(user.uid, 'library').get().catch(() => null);
            if (libDoc && libDoc.exists && libDoc.data()?.playlists) {
              const rawPl = libDoc.data().playlists;
              if (typeof rawPl === 'object') {
                userPlaylists = Object.keys(rawPl).map(k => {
                  const tracks = Array.isArray(rawPl[k]) ? rawPl[k] : (rawPl[k]?.tracks || []);
                  return {
                    name: k,
                    count: tracks.length,
                    cover: rawPl[k]?.cover || (tracks[0] && tracks[0].cover) || ''
                  };
                });
              }
            }
          } catch (e) {}
        }
      }

      if (playlistsCount) {
        if (!userPlaylists || userPlaylists.length === 0) {
          playlistsCount.textContent = '0 плейлистов';
        } else {
          playlistsCount.textContent = userPlaylists.length + ' ' + (userPlaylists.length === 1 ? 'плейлист' : userPlaylists.length >= 2 && userPlaylists.length <= 4 ? 'плейлиста' : 'плейлистов');
        }
      }

      if (playlistsGrid) {
        if (!userPlaylists || userPlaylists.length === 0) {
          playlistsGrid.innerHTML = '<div style="grid-column: 1/-1; text-align:center; padding: 28px 12px; color: #737373; font-size: 13px;">У пользователя пока нет плейлистов</div>';
        } else {
          const defaultCover = 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128"><rect width="128" height="128" fill="#262626"/><text x="50%" y="54%" dominant-baseline="middle" text-anchor="middle" fill="#666" font-size="40">♫</text></svg>');
          playlistsGrid.innerHTML = userPlaylists.map(pl => `
            <div class="pc-playlist-card" data-pl="${pl.name}" style="background:#181818; border-radius:12px; padding:10px; cursor:pointer; text-align:left;">
              <div style="width:100%; aspect-ratio:1; border-radius:8px; overflow:hidden; margin-bottom:8px; position:relative; background:#262626;">
                <img src="${pl.cover || defaultCover}" style="width:100%; height:100%; object-fit:cover;" onerror="this.src='${defaultCover}'" />
              </div>
              <div style="font-size:12px; font-weight:700; color:#fff; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${pl.name}</div>
              <div style="font-size:11px; color:#a3a3a3;">${pl.count || 0} треков</div>
            </div>
          `).join('');

          playlistsGrid.querySelectorAll('.pc-playlist-card').forEach(card => {
            card.addEventListener('click', () => {
              const plName = card.getAttribute('data-pl');
              if (plName && typeof window.openPlaylist === 'function') {
                closeUserProfile();
                window.openPlaylist(plName);
              }
            });
          });
        }
      }
    } catch (err) {
      console.error('[openUserProfile render error]', err);
    }
  }

  function closeUserProfile() {
    const overlay = document.getElementById('other-profile-overlay');
    if (overlay) overlay.style.display = 'none';
    if (window.navigationHistory && typeof window.navigationHistory.updateButtons === 'function') {
      window.navigationHistory.updateButtons();
    }
  }

  window.openUserProfile = openUserProfile;
  window.closeUserProfile = closeUserProfile;
  window.getUserProfile = getUserProfile;
  window.getAvatarUrl = getAvatarUrl;
  window.openFriendsModal = openFriendsModal;
  window.closeFriendsModal = closeFriendsModal;
  window.openSettings = function() {
    const overlay = document.getElementById('settings-overlay');
    if (overlay) {
      overlay.style.display = 'flex';
      overlay.classList.remove('hidden');
    }
    if (typeof window.syncSettingsModalUI === 'function') {
      try { window.syncSettingsModalUI(); } catch (e) {}
    }
    if (window.navigationHistory && typeof window.navigationHistory.updateButtons === 'function') {
      window.navigationHistory.updateButtons();
    }
  };

  async function searchPublicPlaylists(query) {
    const list = [];
    try {
      const res = await fetch(`${getBackendBaseUrl()}/api/playlists?q=${encodeURIComponent(query || '')}`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data?.playlists)) {
          list.push(...data.playlists);
        }
      }
    } catch (e) {
      console.warn('[searchPublicPlaylists] server api error:', e);
    }

    if (state.db && state.user && query && query.length >= 2) {
      try {
        const snap = await state.db.collection('publicPlaylists').limit(30).get();
        const qLower = query.toLowerCase();
        snap.forEach(doc => {
          const d = doc.data();
          const matchTitle = (d.title || '').toLowerCase().includes(qLower);
          const matchAuthor = (d.author || '').toLowerCase().includes(qLower);
          const matchTrack = Array.isArray(d.tracks) && d.tracks.some(t =>
            (t.title && t.title.toLowerCase().includes(qLower)) ||
            (t.artist && t.artist.toLowerCase().includes(qLower))
          );
          if (matchTitle || matchAuthor || matchTrack) {
            const alreadyInList = list.some(p =>
              p.id === doc.id ||
              ((p.title || p.name || '').toLowerCase() === (d.title || '').toLowerCase() &&
               (p.author || '').toLowerCase() === (d.author || '').toLowerCase())
            );
            if (!alreadyInList) {
              list.push({ id: doc.id, ...d });
            }
          }
        });
      } catch (e) {
        // Silently fallback to server /api/playlists results
      }
    }
    return list;
  }

  async function publishPlaylistsToPublic(playlistsObj, authorName) {
    const pls = playlistsObj || getLocalPlaylistsDictionary();
    const author = authorName || state.user?.displayName || 'Пользователь RIZE';
    const playlistArray = Object.keys(pls)
      .filter(k => k !== '__OFFLINE__' && k !== 'Избранное' && k !== 'Любимые треки')
      .map(name => {
        const tracks = Array.isArray(pls[name]) ? pls[name] : (pls[name]?.tracks || []);
        return {
          title: name,
          name,
          author,
          cover: pls[name]?.cover || (tracks[0] && (tracks[0].cover || tracks[0].c || tracks[0].thumbnail)) || '',
          tracks: tracks.map(t => ({
            id: t.id || '',
            title: t.title || t.name || t.t || 'Без названия',
            artist: t.artist || t.artistName || t.a || 'Неизвестный исполнитель',
            cover: t.cover || t.thumbnail || t.c || '',
            duration: t.duration || t.d || 180,
            album: t.album || ''
          }))
        };
      })
      .filter(p => p.tracks.length > 0);

    if (!playlistArray.length) return { ok: true, count: 0 };

    try {
      await fetch(`${getBackendBaseUrl()}/api/playlists/publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playlists: playlistArray })
      });
    } catch (e) {
      console.warn('[playlists] publish server error:', e);
    }

    if (state.db && state.user && !state.user.isAnonymous) {
      try {
        const batch = state.db.batch();
        playlistArray.forEach(pl => {
          const docId = `${state.user.uid}_${encodeURIComponent(pl.title).replace(/%/g, '_')}`;
          const ref = state.db.collection('publicPlaylists').doc(docId);
          batch.set(ref, {
            title: pl.title,
            author,
            ownerId: state.user.uid,
            cover: pl.cover,
            trackCount: pl.tracks.length,
            tracks: pl.tracks.slice(0, 100),
            updatedAt: window.firebase.firestore.FieldValue.serverTimestamp()
          }, { merge: true });
        });
        await batch.commit();
      } catch (e) {
        console.warn('[firestore] publicPlaylists error:', e);
      }
    }
    return { ok: true, count: playlistArray.length };
  }

  async function deletePublicPlaylist(playlistName) {
    if (!playlistName) return;
    try {
      await fetch(`${getBackendBaseUrl()}/api/playlists/delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: playlistName,
          author: state.user?.displayName || 'Пользователь Votify',
          ownerId: state.user?.uid || ''
        })
      }).catch(() => {});
    } catch (e) {}

    if (state.db && state.user && !state.user.isAnonymous) {
      try {
        const docId = `${state.user.uid}_${encodeURIComponent(playlistName).replace(/%/g, '_')}`;
        await state.db.collection('publicPlaylists').doc(docId).delete().catch(() => {});
      } catch (e) {
        console.warn('[firestore] delete public playlist error:', e);
      }
    }
  }

  window.VotifyCloud = {
    whenReady: () => ready,
    isAvailable: () => state.available,
    getCurrentUser,
    getProfile,
    getUserProfile,
    getAvatarUrl,
    onAuthChanged,
    register,
    signIn,
    signInWithGoogle,
    signInAsGuest,
    sendPasswordReset,
    signOut,
    saveProfile,
    pullState,
    pushState,
    deletePublicPlaylist,
    listWorkshopThemes,
    publishWorkshopTheme,
    deleteWorkshopTheme,
    openAuth,
    openProfile,
    openFriendsModal,
    closeFriendsModal,
    openUserProfile,
    closeUserProfile,
    friendlyError,
    reserveUsername,
    searchUsers,
    addFriend,
    getFriends,
    searchPublicPlaylists,
    publishPlaylistsToPublic,
    updateAccountUi,
  };
  window.updateAccountUi = updateAccountUi;

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', wireUi);
  else wireUi();

  // Режим проверки: открой окно входа сразу, если в URL есть ?auth=1
  if (new URLSearchParams(location.search).has('auth')) {
    const open = () => openAuth('auth-login');
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', open);
    else open();
  }
})();
