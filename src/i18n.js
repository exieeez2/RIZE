/* RIZE i18n — переключение языка интерфейса ru/en.
 * Словарь применяется к статической разметке по data-i18n* атрибутам:
 *   data-i18n       → textContent
 *   data-i18n-ph    → placeholder
 *   data-i18n-title → title
 *   data-i18n-aria  → aria-label
 * Динамические строки app.js в текущей версии не переводятся.
 */
(function () {
  'use strict';

  var DICT = {
    en: {
      'nav.home': 'Home',
      'nav.library': 'My Library',
      'nav.settings': 'Settings',
      'nav.pins': 'Pinned playlists',

      'home.myWave': 'My Wave',
      'home.recommendations': 'Recommendations',
      'home.refreshWave': 'Refresh wave',
      'home.playWave': 'Play wave',
      'home.jumpBack': 'Jump back in',
      'home.forYou': 'For you',
      'home.tracks': 'Tracks',
      'home.refresh': 'Refresh',
      'home.playlists': 'Playlists',
      'home.artists': 'Artists',
      'search.artist': 'Artist',
      'home.releases': 'Releases',
      'home.prevPlaylists': 'Previous playlists',
      'home.nextPlaylists': 'Next playlists',
      'home.prevArtists': 'Previous artists',
      'home.nextArtists': 'Next artists',
      'home.prevReleases': 'Previous releases',
      'home.nextReleases': 'Next releases',

      'common.back': 'Back',
      'common.forward': 'Forward',

      'search.music': 'Music',
      'search.playlists': 'Playlists',

      'lib.title': 'My Library',
      'lib.newPlaylist': 'Create playlist',
      'lib.importPlaylist': 'Import playlist',
      'lib.uploadTracks': 'Upload your tracks',
      'lib.tabAll': 'All',
      'lib.tabFavorites': 'Favorite tracks',
      'lib.tabPlaylists': 'Playlists',
      'lib.tabLocal': 'Local files',
      'lib.sort': 'Sorting',
      'lib.sortManual': 'Manual order',
      'lib.sortNewest': 'Newest first',
      'lib.sortOldest': 'Oldest first',
      'lib.sortTitle': 'By title (A-Z)',
      'lib.sortArtist': 'By artist (A-Z)',
      'lib.sortDuration': 'By duration',
      'lib.empty': 'No tracks in your library yet. Tap the heart on any track to save it.',

      'local.title': 'Local files',
      'local.addFiles': 'Add files',
      'local.empty': 'No files in your local library yet.',

      'history.title': 'History',
      'history.clear': 'Clear history',
      'history.empty': 'No recently played tracks.',

      'queue.title': 'Playback queue',
      'queue.clear': 'Clear queue',
      'queue.empty': 'Queue is empty. Play a track to start.',

      'settings.title': 'Settings',
      'settings.subtitle': 'Personalize how RIZE looks and behaves',
      'settings.language': 'Language',
      'settings.languageHint': 'Interface language — applied instantly',

      'cat.interface': 'Interface',
      'cat.theme': 'Theme',
      'cat.background': 'Background',
      'cat.audio': 'Audio',
      'cat.tracks': 'Tracks',
      'cat.integrations': 'Integrations',
      'cat.about': 'About',

      'audio.title': 'Audio & Playback',
      'audio.subtitle': 'DSP effects, 10-band equalizer, speed, pitch and dynamics',
      'audio.equalizer': 'Equalizer',
      'audio.eq10Band': '10-Band Equalizer',
      'audio.quickTone': 'Quick Tone',
      'audio.low': 'Low',
      'audio.mid': 'Mid',
      'audio.high': 'High',
      'audio.presets': 'Sound Presets',
      'audio.speed': 'Playback Speed',
      'audio.pitch': 'Musical Pitch',
      'audio.pitchSemis': 'Semitones',
      'audio.preservePitch': 'Preserve Pitch',
      'audio.preservePitchHint': 'Keep original key when speeding up or slowing down',
      'audio.preamp': 'Volume Gain (Preamp)',
      'audio.engine': 'Audio Streaming Engine',
      'audio.engineHint': 'Default (yt-dlp + Opus 160 kbps) or Audius REST API (up to 320 kbps)',
      'audio.downloadFormat': 'Download Format',
      'audio.downloadFormatHint': 'Export file format with embedded tags and cover art',
      'audio.enhancer': 'Sound Enhancer',
      'audio.enhancerHint': 'Hardware-quality harmonics, clarity and depth',
      'audio.vocalClarity': 'Vocal Clarity',
      'audio.highAir': 'High-End Air',
      'audio.bassDepth': 'Bass Depth',
      'audio.normalize': 'Volume Normalization',
      'audio.normalizeHint': 'Keeps loudness balanced between tracks (up to 9 dB)',
      'audio.crossfade': 'Crossfade',
      'audio.crossfadeHint': 'Smooth transition between consecutive tracks',
      'audio.effects': 'Audio FX',
      'audio.reverb': 'Reverb',
      'audio.reverbHint': 'Spatial acoustic room simulation',
      'audio.echo': 'Echo & Delay',
      'audio.echoHint': 'Stereo delay with feedback loop',
      'audio.distortion': 'Warm Saturation',
      'audio.distortionHint': 'Tube warmth and soft harmonic overdrive',
      'audio.sleep': 'Sleep Timer',
      'audio.sleepHint': 'Fades out volume and pauses playback automatically',
      'audio.sleepMin15': '15 min',
      'audio.sleepMin30': '30 min',
      'audio.sleepMin45': '45 min',
      'audio.sleepMin60': '60 min',
      'audio.sleepEndTrack': 'End of track',
      'audio.sleepOff': 'Turn off',
      'audio.resetAll': 'Reset audio settings',

      'set.uiScale': 'UI scale',
      'set.searchPos': 'Position of searchbar',
      'set.uiOpacity': 'Interface opacity',
      'set.shapedCover': 'Shaped cover in the bottom bar',
      'set.shapedCoverHint': 'Morphing Material 3 shape with a wavy progress ring around the cover',
      'set.perfMode': 'Performance mode',
      'set.perfModeHint': 'Disables visualizers, animated gradient and blur effects, limits animations to 30 FPS',
      'set.showRecommendations': 'Recommendations on home screen',
      'set.showRecommendationsHint': 'Display the recommendations block on the home screen',
      'set.themeMode': 'Theme mode',
      'set.accent': 'Accent color',
      'set.hue': 'Hue',
      'set.intensity': 'Intensity',
      'set.bannerBlur': 'Banner blur',
      'set.bannerOpacity': 'Banner opacity',
      'set.bannerFade': 'Banner fade',
      'set.bgMedia': 'Background media',
      'set.bgOpacity': 'Opacity',
      'set.bgBlur': 'Blur',
      'set.coverBg': 'Cover background',
      'set.coverBgHint': 'Uses a blurred version of the current cover as the background',
      'set.coverBgBrightness': 'Cover background brightness',
      'set.showArtists': 'Show artists in search',
      'set.showLocalTab': 'Show My files tab',
      'set.smoothPresets': 'Smooth preset transitions',
      'set.persistSound': 'Save sound settings',
      'set.persistSoundHint': 'Automatically save High Quality, effects and the active preset',
      'set.wavyProgress': 'Wavy progress bar',
      'set.progressKnob': 'Progress bar knob',
      'set.progressBg': 'Progress bar background',
      'set.progressBgHint': 'Show the uncompleted track rail in the playbar',
      'set.crossfade': 'Crossfade',
      'set.lyricsTranslation': 'Lyrics translation',
      'set.trLang': 'Translation language',
      'set.searchLanguage': 'Search language...',
      'set.autoTranslate': 'Auto-translate',
      'set.lyricsAnim': 'Lyrics animation',
      'set.lyricsAnimHint': 'How the active line moves',
      'set.lyricsSpeed': 'Lyrics animation speed',
      'set.wordStyle': 'Word mode style',
      'set.wordStyleHint': 'How the active line is highlighted in Word mode',
      'set.gradientTightness': 'Gradient tightness',
      'set.shortcuts': 'Keyboard shortcuts',
      'set.diagnostics': 'Diagnostics',
      'set.logs': 'Logs',

      'hint.compact': 'Compact',
      'hint.default': 'Default',
      'hint.large': 'Large',
      'hint.gray': 'Gray',
      'hint.soft': 'Soft',
      'hint.vivid': 'Vivid',
      'hint.top': 'Top',
      'hint.deep': 'Deep',
      'hint.slow': '0.5x (Slow)',
      'hint.normal': '1.0x (Normal)',
      'hint.fast': '2.5x (Fast)',
      'hint.sharp': '2% (Sharp)',
      'hint.softTight': '24% (Soft)',

      'pos.left': 'Left',
      'pos.middle': 'Middle',
      'pos.right': 'Right',

      'theme.light': 'Light',
      'theme.dark': 'Dark',
      'theme.auto': 'Auto (album)',
      'theme.custom': 'Custom',
      'theme.autoHint': 'Auto — match the track cover',
      'theme.purple': 'Purple',
      'theme.blue': 'Blue',
      'theme.teal': 'Teal',
      'theme.green': 'Green',
      'theme.amber': 'Amber',
      'theme.red': 'Red',
      'theme.pink': 'Pink',
      'theme.customColor': 'Choose custom color',

      'lang.en': 'English (en)',
      'lang.ru': 'Russian (ru)',
      'lang.es': 'Spanish (es)',
      'lang.de': 'German (de)',
      'lang.fr': 'French (fr)',
      'lang.pt': 'Portuguese (pt)',
      'lang.ja': 'Japanese (ja)',
      'lang.ko': 'Korean (ko)',
      'lang.zh': 'Chinese (zh-CN)',

      'ease.inout': 'Ease in-out',
      'ease.inoutFull': 'Ease in-out (Cubic)',
      'ease.quad': 'Smooth (Quad)',
      'ease.sine': 'Gentle (Sine)',
      'ease.out': 'Ease out (Quart)',
      'ease.outsine': 'Soft ease out',
      'ease.expo': 'Snappy (Expo)',
      'ease.linear': 'Linear',

      'wordstyle.gradient': 'Gradient',
      'wordstyle.words': 'Words',

      'int.discord': 'Discord Rich Presence',
      'int.spotify': 'Spotify',
      'int.youtube': 'YouTube',
      'int.ytmusic': 'YouTube Music',
      'int.soundcloud': 'SoundCloud',
      'int.apple': 'Apple Music',
      'int.yandex': 'Yandex Music',
      'audio.scEngine': 'SoundCloud Engine',
      'audio.scEngineHint': 'Playback and DRM/preview bypass mode for SoundCloud',
      'audio.zapret': 'Zapret Mode (DPI Bypass)',
      'audio.zapretHint': 'Route SoundCloud and CDN requests through zapret / ByeDPI',

      'about.playerName': 'RIZE Music Player',

      'btn.reset': 'Reset',
      'btn.chooseFile': 'Choose file',
      'btn.remove': 'Remove',
      'btn.import': 'Import',
      'btn.checkUpdates': 'Check for updates',
      'btn.shortcuts': 'Keyboard shortcuts',
      'btn.copyDiagnostics': 'Copy diagnostics',
      'btn.openLogs': 'Open logs folder',

      'panel.nowPlaying': 'Now playing',
      'panel.download': 'Download track',
      'panel.editLyrics': 'Edit lyrics',
      'panel.syncLyrics': 'Sync lyrics',
      'panel.translateLyrics': 'Translate lyrics',
      'panel.karaoke': 'Fullscreen karaoke',
      'panel.close': 'Close panel',
      'panel.toggleLyrics': 'Toggle lyrics',

      'player.prev': 'Previous',
      'player.playPause': 'Play or pause',
      'player.next': 'Next',
      'player.seek': 'Seek position',
      'player.mute': 'Mute or unmute',
      'player.volume': 'Volume',

      'tvk.lyricsBtn': 'Lyrics (text / player)',
      'tvk.customize': 'Customize lyrics',
      'tvk.font': 'Font',
      'tvk.alignment': 'Alignment',
      'tvk.size': 'Size',
      'tvk.weight': 'Weight',
      'tvk.lineSpacing': 'Line spacing',
      'tvk.animation': 'Animation',
      'tvk.animSpeed': 'Animation speed',
      'tvk.visNoLyrics': 'No-lyrics visualizer',
      'tvk.visWithLyrics': 'Visualizer with lyrics',
      'tvk.visOpacity': 'Visualizer opacity',
      'tvk.alignLeft': 'Align left',
      'tvk.alignCenter': 'Align center',
      'tvk.alignRight': 'Align right',
      'tvk.lyricsTitle': 'Lyrics',
      'tvk.audioOutput': 'Audio output device',
      'tvk.battery': 'Battery level',

      'auth.title': 'Sign in to RIZE',
      'auth.email': 'Email',
      'auth.next': 'Next',
      'auth.or': 'or',
      'auth.google': 'Sign in with Google',
      'auth.guest': 'Continue as guest',
      'auth.noAccount': 'No account?',
      'auth.createAccount': 'Create one'
    },

    ru: {
      'nav.home': 'Главная',
      'nav.library': 'Моя медиатека',
      'nav.settings': 'Настройки',
      'nav.pins': 'Закреплённые плейлисты',

      'home.myWave': 'Моя волна',
      'home.recommendations': 'Рекомендации',
      'home.refreshWave': 'Обновить волну',
      'home.playWave': 'Запустить волну',
      'home.jumpBack': 'Продолжить прослушивание',
      'home.forYou': 'Для вас',
      'home.tracks': 'Треки',
      'home.refresh': 'Обновить',
      'home.playlists': 'Плейлисты',
      'home.artists': 'Артисты',
      'search.artist': 'Исполнитель',
      'home.releases': 'Релизы',
      'home.prevPlaylists': 'Предыдущие плейлисты',
      'home.nextPlaylists': 'Следующие плейлисты',
      'home.prevArtists': 'Предыдущие артисты',
      'home.nextArtists': 'Следующие артисты',
      'home.prevReleases': 'Предыдущие релизы',
      'home.nextReleases': 'Следующие релизы',

      'common.back': 'Назад',
      'common.forward': 'Вперёд',

      'search.music': 'Музыка',
      'search.playlists': 'Плейлисты',

      'lib.title': 'Моя медиатека',
      'lib.newPlaylist': 'Создать плейлист',
      'lib.importPlaylist': 'Импорт плейлиста',
      'lib.uploadTracks': 'Загрузить свои треки',
      'lib.tabAll': 'Все',
      'lib.tabFavorites': 'Любимые треки',
      'lib.tabPlaylists': 'Плейлисты',
      'lib.tabLocal': 'Локальные файлы',
      'lib.sort': 'Сортировка',
      'lib.sortManual': 'По порядку',
      'lib.sortNewest': 'Сначала новые',
      'lib.sortOldest': 'Сначала старые',
      'lib.sortTitle': 'По названию (А-Я)',
      'lib.sortArtist': 'По исполнителю (А-Я)',
      'lib.sortDuration': 'По длительности',
      'lib.empty': 'В медиатеке пока нет треков. Нажмите на сердечко на любом треке, чтобы сохранить его.',

      'local.title': 'Локальные файлы',
      'local.addFiles': 'Добавить файлы',
      'local.empty': 'В локальной библиотеке пока нет файлов.',

      'history.title': 'История',
      'history.clear': 'Очистить историю',
      'history.empty': 'Недавно прослушанных треков нет.',

      'queue.title': 'Очередь воспроизведения',
      'queue.clear': 'Очистить очередь',
      'queue.empty': 'Очередь пуста. Включите трек, чтобы начать.',

      'settings.title': 'Настройки',
      'settings.subtitle': 'Настройте внешний вид и поведение RIZE',
      'settings.language': 'Язык',
      'settings.languageHint': 'Язык интерфейса — применяется сразу',

      'cat.interface': 'Интерфейс',
      'cat.theme': 'Тема',
      'cat.background': 'Фон',
      'cat.audio': 'Аудио',
      'cat.tracks': 'Треки',
      'cat.integrations': 'Интеграции',
      'cat.about': 'О приложении',

      'audio.title': 'Звук и аудио',
      'audio.subtitle': 'DSP-эффекты, 10-полосный эквалайзер, скорость, тональность и динамика',
      'audio.equalizer': 'Эквалайзер',
      'audio.eq10Band': '10-полосный эквалайзер',
      'audio.quickTone': 'Быстрый тон',
      'audio.low': 'Низкие',
      'audio.mid': 'Средние',
      'audio.high': 'Высокие',
      'audio.presets': 'Звуковые пресеты',
      'audio.speed': 'Скорость воспроизведения',
      'audio.pitch': 'Тональность',
      'audio.pitchSemis': 'Полутоны',
      'audio.preservePitch': 'Сохранять тональность',
      'audio.preservePitchHint': 'Не менять тональность при ускорении или замедлении',
      'audio.preamp': 'Преамп / Усиление',
      'audio.engine': 'Аудио-движок стриминга',
      'audio.engineHint': 'Основной (yt-dlp + Opus 160 kbps) или Audius REST API (до 320 kbps)',
      'audio.downloadFormat': 'Формат скачивания',
      'audio.downloadFormatHint': 'Формат файлов при экспорте (теги и обложка вшиваются)',
      'audio.enhancer': 'Улучшение звука',
      'audio.enhancerHint': 'Гармоники, четкость вокала и глубина баса',
      'audio.vocalClarity': 'Чёткость вокала',
      'audio.highAir': 'Воздушность ВЧ',
      'audio.bassDepth': 'Глубина баса',
      'audio.normalize': 'Нормализация громкости',
      'audio.normalizeHint': 'Выравнивает громкость между разными треками (до 9 дБ)',
      'audio.crossfade': 'Кроссфейд',
      'audio.crossfadeHint': 'Плавный переход между следующими друг за другом треками',
      'audio.effects': 'Звуковые эффекты',
      'audio.reverb': 'Реверберация',
      'audio.reverbHint': 'Акустическое пространственное эхо комнаты',
      'audio.echo': 'Эхо и дилэй',
      'audio.echoHint': 'Задержка звука с настраиваемым фидбеком',
      'audio.distortion': 'Тёплая сатурация',
      'audio.distortionHint': 'Мягкий ламповый овердрайв и гармоники',
      'audio.sleep': 'Таймер сна',
      'audio.sleepHint': 'Плавно снижает громкость и останавливает музыку по таймеру',
      'audio.sleepMin15': '15 мин',
      'audio.sleepMin30': '30 мин',
      'audio.sleepMin45': '45 мин',
      'audio.sleepMin60': '60 мин',
      'audio.sleepEndTrack': 'Конец трека',
      'audio.sleepOff': 'Выключить',
      'audio.resetAll': 'Сбросить все настройки звука',

      'set.uiScale': 'Масштаб интерфейса',
      'set.searchPos': 'Положение поиска',
      'set.uiOpacity': 'Прозрачность интерфейса',
      'set.shapedCover': 'Фигурная обложка в нижней панели',
      'set.shapedCoverHint': 'Морфинг формы Material 3 с волнистым кольцом прогресса вокруг обложки',
      'set.perfMode': 'Режим производительности',
      'set.perfModeHint': 'Отключает визуализаторы, анимированный градиент и blur-эффекты, ограничивает анимации до 30 FPS',
      'set.showRecommendations': 'Рекомендации на главной',
      'set.showRecommendationsHint': 'Показывать блок рекомендаций на главной странице',
      'set.themeMode': 'Режим темы',
      'set.accent': 'Акцентный цвет',
      'set.hue': 'Оттенок',
      'set.intensity': 'Насыщенность',
      'set.bannerBlur': 'Размытие баннера',
      'set.bannerOpacity': 'Прозрачность баннера',
      'set.bannerFade': 'Затухание баннера',
      'set.bgMedia': 'Фоновое медиа',
      'set.bgOpacity': 'Прозрачность',
      'set.bgBlur': 'Размытие',
      'set.coverBg': 'Фон из обложки',
      'set.coverBgHint': 'Использует размытую версию текущей обложки как фон',
      'set.coverBgBrightness': 'Яркость фона из обложки',
      'set.showArtists': 'Показывать артистов в поиске',
      'set.showLocalTab': 'Показывать вкладку «Мои файлы»',
      'set.smoothPresets': 'Плавные переходы пресетов',
      'set.persistSound': 'Сохранять настройки звука',
      'set.persistSoundHint': 'Автоматически сохранять High Quality, эффекты и активный пресет',
      'set.wavyProgress': 'Волнистая полоса прогресса',
      'set.progressKnob': 'Ползунок полосы прогресса',
      'set.progressBg': 'Фон полосы прогресса',
      'set.progressBgHint': 'Показывать незавершённую часть дорожки в плеере',
      'set.crossfade': 'Кроссфейд',
      'set.lyricsTranslation': 'Перевод текста',
      'set.trLang': 'Язык перевода',
      'set.searchLanguage': 'Найти язык...',
      'set.autoTranslate': 'Автоперевод',
      'set.lyricsAnim': 'Анимация текста',
      'set.lyricsAnimHint': 'Как перемещается активная строка',
      'set.lyricsSpeed': 'Скорость анимации текста',
      'set.wordStyle': 'Стиль режима слов',
      'set.wordStyleHint': 'Как подсвечивается активная строка в режиме слов',
      'set.gradientTightness': 'Резкость градиента',
      'set.shortcuts': 'Горячие клавиши',
      'set.diagnostics': 'Диагностика',
      'set.logs': 'Логи',

      'hint.compact': 'Компактно',
      'hint.default': 'Обычно',
      'hint.large': 'Крупно',
      'hint.gray': 'Серый',
      'hint.soft': 'Мягко',
      'hint.vivid': 'Ярко',
      'hint.top': 'Верх',
      'hint.deep': 'Глубоко',
      'hint.slow': '0.5x (Медленно)',
      'hint.normal': '1.0x (Обычно)',
      'hint.fast': '2.5x (Быстро)',
      'hint.sharp': '2% (Резко)',
      'hint.softTight': '24% (Мягко)',

      'pos.left': 'Слева',
      'pos.middle': 'По центру',
      'pos.right': 'Справа',

      'theme.light': 'Светлая',
      'theme.dark': 'Тёмная',
      'theme.auto': 'Авто (обложка)',
      'theme.custom': 'Свой',
      'theme.autoHint': 'Авто — под обложку трека',
      'theme.purple': 'Фиолетовый',
      'theme.blue': 'Синий',
      'theme.teal': 'Бирюзовый',
      'theme.green': 'Зелёный',
      'theme.amber': 'Янтарный',
      'theme.red': 'Красный',
      'theme.pink': 'Розовый',
      'theme.customColor': 'Выбрать свой цвет',

      'lang.en': 'Английский (en)',
      'lang.ru': 'Русский (ru)',
      'lang.es': 'Испанский (es)',
      'lang.de': 'Немецкий (de)',
      'lang.fr': 'Французский (fr)',
      'lang.pt': 'Португальский (pt)',
      'lang.ja': 'Японский (ja)',
      'lang.ko': 'Корейский (ko)',
      'lang.zh': 'Китайский (zh-CN)',

      'ease.inout': 'Плавно (in-out)',
      'ease.inoutFull': 'Ease in-out (Cubic)',
      'ease.quad': 'Мягко (Quad)',
      'ease.sine': 'Нежно (Sine)',
      'ease.out': 'Затухание (Quart)',
      'ease.outsine': 'Мягкое затухание',
      'ease.expo': 'Резко (Expo)',
      'ease.linear': 'Линейно',

      'wordstyle.gradient': 'Градиент',
      'wordstyle.words': 'Слова',

      'int.discord': 'Discord Rich Presence',
      'int.spotify': 'Spotify',
      'int.youtube': 'YouTube',
      'int.ytmusic': 'YouTube Music',
      'int.soundcloud': 'SoundCloud',
      'int.apple': 'Apple Music',
      'int.yandex': 'Яндекс Музыка',
      'audio.scEngine': 'Движок SoundCloud',
      'audio.scEngineHint': 'Воспроизведение, обход DRM и превью SoundCloud',
      'audio.zapret': 'Режим Zapret (обход DPI)',
      'audio.zapretHint': 'Маршрутизация SoundCloud и CDN через zapret / ByeDPI',

      'about.playerName': 'Музыкальный плеер RIZE',

      'btn.reset': 'Сбросить',
      'btn.chooseFile': 'Выбрать файл',
      'btn.remove': 'Убрать',
      'btn.import': 'Импорт',
      'btn.checkUpdates': 'Проверить обновления',
      'btn.shortcuts': 'Горячие клавиши',
      'btn.copyDiagnostics': 'Скопировать диагностику',
      'btn.openLogs': 'Открыть папку логов',

      'panel.nowPlaying': 'Сейчас играет',
      'panel.download': 'Скачать трек',
      'panel.editLyrics': 'Редактировать текст',
      'panel.syncLyrics': 'Синхронизировать текст',
      'panel.translateLyrics': 'Перевести текст',
      'panel.karaoke': 'Караоке во весь экран',
      'panel.close': 'Закрыть панель',
      'panel.toggleLyrics': 'Показать текст',

      'player.prev': 'Предыдущий',
      'player.playPause': 'Играть или пауза',
      'player.next': 'Следующий',
      'player.seek': 'Перейти к позиции',
      'player.mute': 'Выключить или включить звук',
      'player.volume': 'Громкость',

      'tvk.lyricsBtn': 'Текст песни (текст / плеер)',
      'tvk.customize': 'Настроить текст',
      'tvk.font': 'Шрифт',
      'tvk.alignment': 'Выравнивание',
      'tvk.size': 'Размер',
      'tvk.weight': 'Жирность',
      'tvk.lineSpacing': 'Межстрочный интервал',
      'tvk.animation': 'Анимация',
      'tvk.animSpeed': 'Скорость анимации',
      'tvk.visNoLyrics': 'Визуализатор без текста',
      'tvk.visWithLyrics': 'Визуализатор с текстом',
      'tvk.visOpacity': 'Прозрачность визуализатора',
      'tvk.alignLeft': 'По левому краю',
      'tvk.alignCenter': 'По центру',
      'tvk.alignRight': 'По правому краю',
      'tvk.lyricsTitle': 'Текст песни',
      'tvk.audioOutput': 'Устройство вывода звука',
      'tvk.battery': 'Уровень заряда',

      'auth.title': 'Вход в RIZE',
      'auth.email': 'Эл. почта',
      'auth.next': 'Далее',
      'auth.or': 'или',
      'auth.google': 'Войти через Google',
      'auth.guest': 'Продолжить как гость',
      'auth.noAccount': 'Нет аккаунта?',
      'auth.createAccount': 'Создать аккаунт'
    }
  };

  var LANG_KEY = 'rize_lang';
  var current = 'en';

  function detectLang() {
    var saved = null;
    try { saved = localStorage.getItem(LANG_KEY); } catch (e) {}
    if (saved === 'ru' || saved === 'en') return saved;
    try {
      var nav = (navigator.language || 'en').toLowerCase();
      if (nav.indexOf('ru') === 0) return 'ru';
    } catch (e) {}
    return 'en';
  }

  function t(key) {
    var d = DICT[current] || DICT.en;
    if (key && d[key] !== undefined) return d[key];
    if (key && DICT.en[key] !== undefined) return DICT.en[key];
    return null;
  }

  function apply(root) {
    var scope = root || document;
    var nodes = scope.querySelectorAll('[data-i18n],[data-i18n-ph],[data-i18n-title],[data-i18n-aria]');
    for (var i = 0; i < nodes.length; i++) {
      var n = nodes[i];
      var k, val;
      if ((k = n.getAttribute('data-i18n'))) {
        val = t(k);
        if (val !== null) n.textContent = val;
      }
      if ((k = n.getAttribute('data-i18n-ph'))) {
        val = t(k);
        if (val !== null) n.setAttribute('placeholder', val);
      }
      if ((k = n.getAttribute('data-i18n-title'))) {
        val = t(k);
        if (val !== null) n.setAttribute('title', val);
      }
      if ((k = n.getAttribute('data-i18n-aria'))) {
        val = t(k);
        if (val !== null) n.setAttribute('aria-label', val);
      }
    }
    document.documentElement.setAttribute('lang', current);
  }

  function setLang(lang, skipPersist) {
    if (lang !== 'ru' && lang !== 'en') lang = 'en';
    current = lang;
    if (!skipPersist) {
      try { localStorage.setItem(LANG_KEY, lang); } catch (e) {}
    }
    apply();
    syncLangSeg();
    try { document.dispatchEvent(new CustomEvent('rize:langchange', { detail: { lang: lang } })); } catch (e) {}
  }

  function syncLangSeg() {
    var seg = document.getElementById('lang-seg');
    if (!seg) return;
    var btns = seg.querySelectorAll('.lang-seg-btn');
    for (var i = 0; i < btns.length; i++) {
      btns[i].classList.toggle('active', btns[i].getAttribute('data-lang') === current);
    }
  }

  function bindLangEvents() {
    if (typeof document === 'undefined' || document._hasRizeLangDelegate) return;
    document._hasRizeLangDelegate = true;
    document.addEventListener('click', function (e) {
      var btn = e.target && e.target.closest ? e.target.closest('.lang-seg-btn') : null;
      if (!btn) return;
      var lang = btn.getAttribute('data-lang');
      if (lang && lang !== current) {
        setLang(lang);
      }
    });
  }

  function getLang() { return current; }

  current = detectLang();

  window.RizeI18n = {
    t: t,
    apply: apply,
    setLang: setLang,
    getLang: getLang,
    syncLangSeg: syncLangSeg,
    bindLangEvents: bindLangEvents
  };

  // Первичное применение после готовности DOM (скрипт подключён в конце body).
  bindLangEvents();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      bindLangEvents();
      apply();
      syncLangSeg();
    });
  } else {
    apply();
    syncLangSeg();
  }
})();
