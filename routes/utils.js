const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const { URL } = require('url');
const crypto = require('crypto');

const appRoot = path.dirname(__dirname);

const os = require('os');
function getConfigDir() {
  if (process.env.VOTIFY_CONFIG_DIR) {
    return process.env.VOTIFY_CONFIG_DIR;
  }
  if (process.platform === 'win32') {
    return path.join(
      process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'),
      'Votify'
    );
  }
  if (process.platform === 'darwin') {
    return path.join(os.homedir(), 'Library', 'Application Support', 'Votify');
  }
  // Linux and other Unix-like: XDG_CONFIG_HOME or ~/.config
  return path.join(process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config'), 'Votify');
}

const PERSISTENT_DIR = getConfigDir();
if (!fs.existsSync(PERSISTENT_DIR)) {
  fs.mkdirSync(PERSISTENT_DIR, { recursive: true });
}

function findYtDlp() {
  const isWindows = process.platform === 'win32';
  const binaryName = isWindows ? 'yt-dlp.exe' : 'yt-dlp';

  const candidates = [
    path.join(process.resourcesPath || '', 'app.asar.unpacked', 'bin', binaryName),
    path.join(__dirname, '..', 'bin', binaryName),
    path.join(appRoot, 'bin', binaryName),
    path.join(appRoot, binaryName),
    path.join(process.resourcesPath || '', binaryName),
    path.join(process.resourcesPath || '', 'app', 'bin', binaryName),
  ];
  for (const c of candidates) {
    if (c.includes(`app.asar${path.sep}`) && !c.includes(`app.asar.unpacked${path.sep}`)) continue;
    try {
      const stat = fs.statSync(c);
      if (stat.isFile()) return c;
    } catch (e) {
      // ignore missing candidate
    }
  }
  return path.join(process.resourcesPath || appRoot, 'app.asar.unpacked', 'bin', binaryName);
}

const JWT_SECRET = (() => {
  const secretFile = path.join(PERSISTENT_DIR, '.jwt-secret');
  try {
    const existing = fs.readFileSync(secretFile, 'utf-8').trim();
    if (existing) return existing;
  } catch (e) {
    // ignore secret file read errors
  }
  const secret = 'votify-' + crypto.randomBytes(32).toString('hex');
  fs.writeFileSync(secretFile, secret, 'utf-8');
  return secret;
})();
const USERS_FILE = path.join(PERSISTENT_DIR, 'users.json');
const NETWORK_FILE = path.join(PERSISTENT_DIR, 'network.json');
const DATA_DIR = path.join(PERSISTENT_DIR, 'data');

let networkConfig = {
  streamSource: 'yt-dlp',
  audioQuality: 'medium',
  audioEngine: 'ytdlp',
  soundcloudEngine: 'alt', // 'alt' (Bypass DRM/ALT copies) | 'direct' (SoundCloud API v2) | 'ytdlp' (yt-dlp)
  zapretEnabled: false,
  zapretMode: 'auto', // 'auto' | 'socks' | 'http'
  zapretHost: '127.0.0.1',
  zapretPort: 1080,
  proxyEnabled: false,
  proxyHost: '',
  proxyPort: '',
};

function loadNetworkConfig() {
  try {
    if (fs.existsSync(NETWORK_FILE)) {
      const data = JSON.parse(fs.readFileSync(NETWORK_FILE, 'utf-8'));
      if (['low', 'medium', 'high'].includes(data.audioQuality)) networkConfig.audioQuality = data.audioQuality;
      if (['ytdlp', 'audius'].includes(data.audioEngine)) networkConfig.audioEngine = data.audioEngine;
      if (['alt', 'direct', 'ytdlp'].includes(data.soundcloudEngine)) networkConfig.soundcloudEngine = data.soundcloudEngine;
      if (typeof data.zapretEnabled === 'boolean') networkConfig.zapretEnabled = data.zapretEnabled;
      if (typeof data.zapretMode === 'string') networkConfig.zapretMode = data.zapretMode;
      if (data.zapretHost) networkConfig.zapretHost = String(data.zapretHost).trim();
      if (data.zapretPort) networkConfig.zapretPort = Number(data.zapretPort) || 1080;
      if (typeof data.proxyEnabled === 'boolean') networkConfig.proxyEnabled = data.proxyEnabled;
      if (data.proxyHost) networkConfig.proxyHost = String(data.proxyHost).trim();
      if (data.proxyPort) networkConfig.proxyPort = String(data.proxyPort).trim();
    }
  } catch (e) {
    /* ignore */
  }
}
loadNetworkConfig();

function saveNetworkConfig(config) {
  if (config) {
    if (['low', 'medium', 'high'].includes(config.audioQuality)) networkConfig.audioQuality = config.audioQuality;
    if (['ytdlp', 'audius'].includes(config.audioEngine)) networkConfig.audioEngine = config.audioEngine;
    if (['alt', 'direct', 'ytdlp'].includes(config.soundcloudEngine)) networkConfig.soundcloudEngine = config.soundcloudEngine;
    if (typeof config.zapretEnabled === 'boolean') networkConfig.zapretEnabled = config.zapretEnabled;
    if (typeof config.zapretMode === 'string') networkConfig.zapretMode = config.zapretMode;
    if (config.zapretHost) networkConfig.zapretHost = String(config.zapretHost).trim();
    if (config.zapretPort) networkConfig.zapretPort = Number(config.zapretPort) || 1080;
    if (typeof config.proxyEnabled === 'boolean') networkConfig.proxyEnabled = config.proxyEnabled;
    if (config.proxyHost !== undefined) networkConfig.proxyHost = String(config.proxyHost).trim();
    if (config.proxyPort !== undefined) networkConfig.proxyPort = String(config.proxyPort).trim();
  }
  networkConfig.streamSource = 'yt-dlp';
  try {
    fs.writeFileSync(NETWORK_FILE, JSON.stringify(networkConfig, null, 2), 'utf-8');
  } catch (_) {}
  return networkConfig;
}

// Expose the active yt-dlp engine together with the persisted quality setting.
function getNetworkConfig() {
  return networkConfig;
}

function getSoundcloudEngine() {
  return networkConfig.soundcloudEngine || 'alt';
}

function setSoundcloudEngine(engine) {
  if (['alt', 'direct', 'ytdlp'].includes(engine)) {
    networkConfig.soundcloudEngine = engine;
    try {
      saveNetworkConfig(networkConfig);
    } catch (_) {}
  }
  return networkConfig.soundcloudEngine;
}

function getZapretConfig() {
  return {
    enabled: Boolean(networkConfig.zapretEnabled),
    mode: networkConfig.zapretMode || 'auto',
    host: networkConfig.zapretHost || '127.0.0.1',
    port: networkConfig.zapretPort || 1080,
  };
}

function setZapretConfig(cfg) {
  if (cfg) {
    if (typeof cfg.enabled === 'boolean') networkConfig.zapretEnabled = cfg.enabled;
    if (typeof cfg.zapretEnabled === 'boolean') networkConfig.zapretEnabled = cfg.zapretEnabled;
    if (cfg.mode) networkConfig.zapretMode = cfg.mode;
    if (cfg.host) networkConfig.zapretHost = String(cfg.host).trim();
    if (cfg.port) networkConfig.zapretPort = Number(cfg.port) || 1080;
    try {
      saveNetworkConfig(networkConfig);
    } catch (_) {}
  }
  return getZapretConfig();
}

/**
 * Адреса этого компьютера в локальной сети — из них собирается ссылка для телефона.
 * Сначала 192.168.x.x (домашние роутеры), потом 10.x, 172.x и прочее.
 */
function getLanAddresses() {
  const os = require('os');
  const result = [];
  const ifaces = os.networkInterfaces();
  Object.keys(ifaces).forEach(name => {
    (ifaces[name] || []).forEach(item => {
      if (!item || item.internal) return;
      const family = typeof item.family === 'string' ? item.family : '';
      if (family !== 'IPv4' && item.family !== 4) return;
      if (!item.address || item.address.startsWith('169.254.')) return;
      result.push(item.address);
    });
  });
  const rank = ip =>
    ip.startsWith('192.168.') ? 0 : ip.startsWith('10.') ? 1 : ip.startsWith('172.') ? 2 : 3;
  return [...new Set(result)].sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
}

const SEARCH_LIMIT = 12;
const SEARCH_MAX_LIMIT = 100;
const RECOMMENDATION_LIMIT = 16;
// Актуальная ротация: то, что реально в чартах, а не хиты десятилетней давности.
// Живой чарт (Apple Music) подменяет этот список, когда доступен — см. getChartTracks.
const RECOMMENDATION_SEEDS = [
  'ONDA ANDAR official audio',
  'madk1d official audio',
  'VILLIAN official audio',
  'ICEGERGERT official audio',
  'Friendly Thug 52 NGG official audio',
  'ALBLAK 52 official audio',
  'Hugo Loud official audio',
  'Toxi$ official audio',
  'Heronwater official audio',
  'Scally Milano official audio',
  'Big Baby Tape official audio',
  'Kizaru official audio',
  'Bushido Zho official audio',
  'SALUKI official audio',
  'Платина official audio',
  'OG Buda official audio',
  'unki official audio',
  'Voskresenskii official audio',
  'kai angel official audio',
  '9mice official audio',
  'Pepel Nahudi official audio',
  'Aarne official audio',
  '10AGE official audio',
  'Macan official audio',
];

const EXCLUDED_POP_ARTISTS = [
  'anna asti', 'анна асти', 'клава кока', 'klava koka', 'zivert', 'зиверт',
  'мари краймбрери', 'jony', 'джони', 'mia boyka', 'миа бойка', 'artik & asti',
  'люся чеботина', 'niletto', 'инстасамка', 'instasamka', 'шаман', 'shaman',
  'сергей лазарев', 'дима билан', 'руки вверх', 'ваня дмитриенко', 'dabro',
  'хабиб', 'юрий шатунов', 'секрет', 'ленинград',
];

const BLOCKED_KEYWORDS = [
  '1 hour',
  '2 hour',
  '3 hour',
  '10 hour',
  'hour loop',
  'hours',
  '1hr',
  '2hr',
  'megamix',
  'mega mix',
  'dj set',
  'playlist',
  'compilation',
  'non stop',
  'non-stop',
  'full album',
  'album completo',
  'live stream',
  '24/7',
];

const SALT_ROUNDS = 10;
const resetCodes = new Map();

const streamCache = new Map();
const searchCache = new Map();
const STREAM_CACHE_TTL = 4 * 60 * 60 * 1000; // 4 hours, matches mobile EmbeddedMusicSource
const SEARCH_CACHE_TTL = 10 * 60 * 1000;

const YT_UA = (() => {
  if (process.platform === 'win32') {
    return 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
  }
  if (process.platform === 'darwin') {
    return 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
  }
  // Linux
  return 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
})();

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload));
}

function isBlockedTitle(title) {
  const lower = String(title || '').toLowerCase();
  return BLOCKED_KEYWORDS.some(k => lower.includes(k));
}

function generateToken(userId, email) {
  return jwt.sign({ userId, email }, JWT_SECRET, { expiresIn: '30d' });
}

function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

function getAuthUser(req) {
  const auth = req.headers['authorization'];
  if (!auth || !auth.startsWith('Bearer ')) return null;
  return verifyToken(auth.slice(7));
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => (body += chunk));
    req.on('end', () => {
      try {
        resolve(JSON.parse(body || '{}'));
      } catch {
        resolve({});
      }
    });
    req.on('error', reject);
  });
}

function generateResetCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function createEmailTransporter(config) {
  if (!config || !config.host) return null;
  return nodemailer.createTransport({
    host: config.host,
    port: config.port || 587,
    secure: config.port === 465,
    auth: { user: config.user, pass: config.pass },
  });
}

function loadUsers() {
  try {
    if (fs.existsSync(USERS_FILE)) {
      return JSON.parse(fs.readFileSync(USERS_FILE, 'utf-8'));
    }
  } catch (e) {
    // ignore users file read errors
  }
  return [];
}

function saveUsers(users) {
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), 'utf-8');
}

function httpGet(url, timeout) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), timeout);
    const parsed = new URL(url);
    const transport = parsed.protocol === 'https:' ? https : http;
    const req = transport.get(
      url,
      {
        headers: {
          'User-Agent': YT_UA,
          'Accept-Language': 'en-US,en;q=0.9',
          Cookie:
            'CONSENT=PENDING+987; SOCS=CAESNQgDEitib3FfaWRlbnRpdHlmcm9udGVuZHVpc2VydmVyXzIwMjMwODI5LjA3X3AxGgJlbiACGgYIgJnRpwY',
        },
      },
      res => {
        if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
          clearTimeout(timer);
          const loc = res.headers.location.startsWith('http')
            ? res.headers.location
            : parsed.origin + res.headers.location;
          httpGet(loc, timeout).then(resolve).catch(reject);
          return;
        }
        let data = '';
        res.on('data', c => (data += c));
        res.on('end', () => {
          clearTimeout(timer);
          try {
            resolve(JSON.parse(data));
          } catch {
            resolve(data);
          }
        });
      }
    );
    req.on('error', e => {
      clearTimeout(timer);
      reject(e);
    });
  });
}

const innerTubeHttpsAgent = new https.Agent({
  keepAlive: true,
  maxSockets: 32,
  keepAliveMsecs: 15000,
});
const innerTubeHttpAgent = new http.Agent({
  keepAlive: true,
  maxSockets: 32,
  keepAliveMsecs: 15000,
});

function httpPostJSON(url, body, timeout) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), timeout);
    const parsed = new URL(url);
    const transport = parsed.protocol === 'https:' ? https : http;
    const agent = parsed.protocol === 'https:' ? innerTubeHttpsAgent : innerTubeHttpAgent;
    const payload = JSON.stringify(body);
    const req = transport.request(
      parsed,
      {
        method: 'POST',
        agent,
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
          'User-Agent': YT_UA,
          Origin: 'https://music.youtube.com',
          Referer: 'https://music.youtube.com/',
        },
      },
      res => {
        let data = '';
        res.on('data', c => (data += c));
        res.on('end', () => {
          clearTimeout(timer);
          try {
            resolve(JSON.parse(data));
          } catch {
            resolve(data);
          }
        });
      }
    );
    req.on('error', e => {
      clearTimeout(timer);
      reject(e);
    });
    req.write(payload);
    req.end();
  });
}

function extractVideoId(raw) {
  if (!raw) return null;
  if (/^[a-zA-Z0-9_-]{11}$/.test(raw)) return raw;
  const m = raw.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
  return m ? m[1] : null;
}

function parseDurationToSeconds(val) {
  if (typeof val === 'number') return isNaN(val) || val < 0 ? 0 : Math.round(val);
  if (!val || typeof val !== 'string') return 0;
  const str = val.trim();
  if (/^\d+$/.test(str)) return parseInt(str, 10);
  const parts = str.split(':').map(p => parseInt(p, 10));
  if (parts.some(isNaN)) return 0;
  if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  } else if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }
  return 0;
}

function extractFeaturingArtists(title, baseArtist) {
  if (!title || typeof title !== 'string') return baseArtist || 'Unknown';
  let artistStr = String(baseArtist || '').trim();
  const featMatch = title.match(/[\(\[](?:feat\.|ft\.|featuring)\s+([^\)\]]+)[\)\]]/i) ||
                    title.match(/\b(?:feat\.|ft\.|featuring)\s+([^-_|]+)/i);
  if (featMatch && featMatch[1]) {
    const rawFeats = featMatch[1].split(/[,&+]|\band\b/i).map(s => s.trim()).filter(Boolean);
    const existing = artistStr ? artistStr.split(',').map(s => s.trim().toLowerCase()) : [];
    for (const f of rawFeats) {
      if (f.length >= 2 && !existing.includes(f.toLowerCase())) {
        artistStr = artistStr ? `${artistStr}, ${f}` : f;
        existing.push(f.toLowerCase());
      }
    }
  }
  return artistStr || 'Unknown';
}

function makeTrack(id, title, artist, cover, duration = 0) {
  const c = cover || (id ? 'https://img.youtube.com/vi/' + id + '/hqdefault.jpg' : '');
  const durSec = parseDurationToSeconds(duration);
  const tStr = String(title || 'Unknown');
  const fullArtist = extractFeaturingArtists(tStr, artist);
  return {
    id,
    title: tStr,
    artist: fullArtist,
    url: '/api/audio?id=' + encodeURIComponent(id),
    cover: c,
    thumbnail: c,
    duration: durSec,
  };
}

function extractYTTracksFromContents(contents, limit) {
  const tracks = [],
    seen = new Set();
  if (!Array.isArray(contents)) return tracks;
  for (const item of contents) {
    if (tracks.length >= limit) break;
    const v = item.videoRenderer || item.playlistVideoRenderer;
    if (!v) continue;
    const id = v.videoId;
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const title = v.title?.runs?.map(r => r.text).join('') || v.title?.simpleText || 'Unknown';
    if (isBlockedTitle(title)) continue;
    const artist =
      (v.ownerText?.runs?.map(r => r.text?.trim()).filter(Boolean).filter(t => !['•', ',', '&'].includes(t)) || []).join(', ') ||
      (v.shortBylineText?.runs?.map(r => r.text?.trim()).filter(Boolean).filter(t => !['•', ',', '&'].includes(t)) || []).join(', ') ||
      (v.longBylineText?.runs?.map(r => r.text?.trim()).filter(Boolean).filter(t => !['•', ',', '&'].includes(t)) || []).join(', ') ||
      'Unknown';
    const cover = v.thumbnail?.thumbnails?.pop()?.url;
    const lengthText =
      v.lengthText?.simpleText ||
      v.lengthText?.runs?.[0]?.text ||
      v.thumbnailOverlays?.find(o => o.thumbnailOverlayTimeStatusRenderer?.text)
        ?.thumbnailOverlayTimeStatusRenderer?.text?.simpleText ||
      '';
    tracks.push(
      makeTrack(id, title, artist, cover && cover.startsWith('//') ? 'https:' + cover : cover, lengthText)
    );
  }
  return tracks;
}

function extractYTMArtist(runs, fallback) {
  if (!Array.isArray(runs) || runs.length === 0) return fallback || 'Unknown Artist';

  const firstText = runs[0]?.text?.trim();
  if (['Выпуск', 'Подкаст', 'Профиль', 'Плейлист'].includes(firstText)) {
    return null;
  }

  // 1. Collect all explicit artist runs
  const explicitArtists = runs.filter(
    r =>
      (r.navigationEndpoint?.browseEndpoint?.browseEndpointContextSupportedConfigs?.browseEndpointContextMusicConfig
        ?.pageType === 'MUSIC_PAGE_TYPE_ARTIST' ||
      r.navigationEndpoint?.browseEndpoint?.browseId?.startsWith('UC')) &&
      r.text?.trim() &&
      !['Исполнитель', 'Artist', 'Песня', 'Song', 'Видео', 'Video', 'Композиция'].includes(r.text.trim())
  );
  if (explicitArtists.length > 0) {
    const names = [];
    for (const ar of explicitArtists) {
      const name = ar.text.trim();
      if (name && !names.includes(name)) names.push(name);
    }
    if (names.length > 0) return names.join(', ');
  }

  // 2. Fallback: extract all artist tokens before the dot delimiter '•'
  const dotIndex = runs.findIndex(r => r.text?.trim() === '•');
  const candidateRuns = dotIndex > 0 ? runs.slice(0, dotIndex) : runs;
  const filtered = candidateRuns
    .map(r => r.text?.trim())
    .filter(Boolean)
    .filter(
      t =>
        ![
          '•',
          ',',
          '&',
          'feat.',
          'ft.',
          'featuring',
          'Композиция',
          'Песня',
          'Видео',
          'Выпуск',
          'Подкаст',
          'Профиль',
          'Плейлист',
          'Альбом',
          'Сингл',
          'Исполнитель',
          'Artist',
          'Song',
          'Video',
          'Track',
          'Single',
          'Album',
          'Playlist',
        ].includes(t)
    )
    .filter(t => !/^\d+:\d+$/.test(t))
    .filter(t => !/\d+\s*(тыс|млн|млрд|k|m|b|views|просмотр)/i.test(t))
    .filter(t => !/^\d{4}$/.test(t))
    .filter(t => !/^\d+\s+[а-яёa-z]+(\s+\d{4})?/i.test(t));

  if (filtered.length > 0) {
    const names = [];
    for (const t of filtered) {
      if (!names.includes(t)) names.push(t);
    }
    return names.join(', ');
  }

  return fallback || 'Unknown Artist';
}

async function ytInnerTubeSearch(query, limit) {
  // 1. YouTube Web Search with exact video durations (WEB client)
  try {
    const body = {
      query: String(query).trim() + ' music',
      context: {
        client: {
          clientName: 'WEB',
          clientVersion: '2.20241126.01.00',
          hl: 'ru',
          gl: 'RU',
        },
      },
      params: 'EgIQAQ%3D%3D',
    };
    const data = await httpPostJSON(
      'https://www.youtube.com/youtubei/v1/search?prettyPrint=false',
      body,
      5000
    );
    if (data && typeof data === 'object') {
      const contents =
        data.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer
          ?.contents?.[0]?.itemSectionRenderer?.contents;
      const tracks = extractYTTracksFromContents(contents, limit);
      if (tracks.length >= 3) {
        return tracks.slice(0, limit);
      }
    }
  } catch (e) {}

  // 2. YouTube Music (WEB_REMIX) fallback
  try {
    const ytmBody = {
      query: String(query),
      context: {
        client: {
          clientName: 'WEB_REMIX',
          clientVersion: '1.20241126.01.00',
          hl: 'ru',
          gl: 'RU',
        },
      },
    };
    const ytmData = await httpPostJSON('https://music.youtube.com/youtubei/v1/search?prettyPrint=false', ytmBody, 4000);
    if (ytmData && typeof ytmData === 'object') {
      const tracks = [];
      const seen = new Set();
      const sections = ytmData?.contents?.tabbedSearchResultsRenderer?.tabs?.[0]?.tabRenderer?.content?.sectionListRenderer?.contents || [];

      for (const sec of sections) {
        if (tracks.length >= limit) break;
        if (sec.musicCardShelfRenderer) {
          const card = sec.musicCardShelfRenderer;
          const title = card.title?.runs?.map(r => r.text).join('') || '';
          const rawRuns = card.subtitle?.runs || [];
          const artist = extractYTMArtist(rawRuns, 'Unknown');
          const durRun = rawRuns.find(r => /^\d{1,2}:\d{2}(:\d{2})?$/.test(r.text?.trim()));
          const cardDuration = durRun ? durRun.text.trim() : 0;
          const videoId = card.buttons?.find(b => b.buttonRenderer?.navigationEndpoint?.watchEndpoint?.videoId)?.buttonRenderer?.navigationEndpoint?.watchEndpoint?.videoId || card.onTap?.watchEndpoint?.videoId;
          let rawCover = card.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails?.pop()?.url || '';
          let cover = rawCover.trim();
          if (cover.startsWith('//')) cover = 'https:' + cover;
          if (cover.includes('googleusercontent.com')) {
            cover = cover.replace(/=w\d+-h\d+[^?]*/, '=w544-h544-l90-rj');
          } else if (!cover) {
            cover = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
          }
          if (videoId && title && artist && !isBlockedTitle(title) && !seen.has(videoId)) {
            seen.add(videoId);
            tracks.push(makeTrack(videoId, title, artist, cover, cardDuration));
          }
        }
        const items = sec.musicShelfRenderer?.contents || sec.itemSectionRenderer?.contents || [];
        for (const item of items) {
          if (tracks.length >= limit) break;
          const r = item.musicResponsiveListItemRenderer || item.videoRenderer;
          if (!r) continue;
          const videoId =
            r.videoId ||
            r.playlistItemData?.videoId ||
            r.flexColumns?.[0]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs?.[0]?.navigationEndpoint?.watchEndpoint?.videoId ||
            r.overlay?.musicItemThumbnailOverlayRenderer?.content?.musicPlayButtonRenderer?.playNavigationEndpoint?.watchEndpoint?.videoId;
          if (!videoId || seen.has(videoId)) continue;
          let title = r.title?.runs?.map(x => x.text).join('') || r.title?.simpleText || '';
          let fallbackArtist = r.ownerText?.runs?.[0]?.text || r.shortBylineText?.runs?.[0]?.text || '';
          let colRuns = r.flexColumns?.[1]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs;
          if (r.flexColumns?.[0]) {
            title = r.flexColumns[0]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs?.map(x => x.text).join('') || title;
          }
          let artist = extractYTMArtist(colRuns, fallbackArtist);
          if (!artist || artist === 'Unknown' || artist === 'Unknown Artist') {
            const playLabel = r.overlay?.musicItemThumbnailOverlayRenderer?.content?.musicPlayButtonRenderer?.accessibilityPlayData?.accessibilityData?.label || '';
            const dashIdx = playLabel.indexOf(' - ');
            if (dashIdx !== -1) {
              artist = playLabel.slice(dashIdx + 3).trim();
            }
          }
          if (!artist) artist = fallbackArtist || 'Unknown Artist';
          if (!artist || !title || isBlockedTitle(title)) continue;
          const thumbnails = r.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails || r.thumbnail?.thumbnails || [];
          let rawCover = thumbnails.pop()?.url || '';
          let cover = rawCover.trim();
          if (cover.startsWith('//')) cover = 'https:' + cover;
          if (cover.includes('googleusercontent.com')) {
            cover = cover.replace(/=w\d+-h\d+[^?]*/, '=w544-h544-l90-rj');
          } else if (!cover) {
            cover = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
          }

          let durText = '';
          const allCols = [...(r.fixedColumns || []), ...(r.flexColumns || [])];
          for (const col of allCols) {
            const colRenderer = col.musicResponsiveListItemFixedColumnRenderer || col.musicResponsiveListItemFlexColumnRenderer;
            const runs = colRenderer?.text?.runs || [];
            for (const run of runs) {
              const txt = (run.text || '').trim();
              if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(txt)) {
                durText = txt;
                break;
              }
            }
            if (durText) break;
          }
          if (!durText) {
            durText =
              r.lengthText?.simpleText ||
              r.lengthText?.runs?.[0]?.text ||
              '';
          }
          if (!durText && Array.isArray(r.thumbnailOverlays)) {
            const timeOverlay = r.thumbnailOverlays.find(o => o.thumbnailOverlayTimeStatusRenderer?.text);
            durText =
              timeOverlay?.thumbnailOverlayTimeStatusRenderer?.text?.simpleText ||
              timeOverlay?.thumbnailOverlayTimeStatusRenderer?.text?.runs?.[0]?.text ||
              '';
          }
          if (!durText) {
            for (const col of (r.flexColumns || [])) {
              const text = col.musicResponsiveListItemFlexColumnRenderer?.text?.runs?.map(x => x.text).join('') || '';
              const m = text.match(/\b(\d{1,2}:\d{2}(:\d{2})?)\b/);
              if (m) {
                durText = m[1];
                break;
              }
            }
          }
          if (!durText) {
            for (const col of allCols) {
              const colRenderer = col.musicResponsiveListItemFixedColumnRenderer || col.musicResponsiveListItemFlexColumnRenderer;
              const label = colRenderer?.text?.accessibility?.accessibilityData?.label || '';
              const m = label.match(/(\d{1,2}:\d{2}(:\d{2})?)/);
              if (m) {
                durText = m[1];
                break;
              }
            }
          }

          seen.add(videoId);
          tracks.push(makeTrack(videoId, title, artist, cover, durText));
        }
      }
      if (tracks.length > 0) {
        return tracks.slice(0, limit);
      }
    }
  } catch (e) {}

  return [];
}

async function ytSearchScrape(query, limit) {
  console.log(
    `[search] Searching for: "${query}" (limit: ${limit}) using ${networkConfig.streamSource}`
  );
  const cacheKey = query.toLowerCase().trim() + ':' + networkConfig.streamSource;
  const cached = searchCache.get(cacheKey);
  if (cached && cached.expires > Date.now()) {
    console.log(`[search] Cache hit for: "${query}"`);
    return cached.tracks.slice(0, limit);
  }

  let tracks = [];

  if (networkConfig.streamSource === 'soundcloud') {
    try {
      tracks = await scSearch(query, limit);
      console.log(`[search] SoundCloud found ${tracks.length} tracks`);
    } catch (e) {
      console.error(`[search] SoundCloud error:`, e.message);
    }
    searchCache.set(cacheKey, { tracks, expires: Date.now() + SEARCH_CACHE_TTL });
    return tracks.slice(0, limit);
  }

  if (networkConfig.streamSource === 'invidious') {
    try {
      const instance = networkConfig.invidiousInstance.replace(/\/$/, '');
      const data = await httpGet(
        `${instance}/api/v1/search?q=${encodeURIComponent(query + ' music')}&type=video`,
        10000
      );
      if (Array.isArray(data)) {
        tracks = data
          .slice(0, limit)
          .map(v =>
            makeTrack(
              v.videoId,
              v.title,
              v.author,
              v.videoThumbnails?.find(t => t.quality === 'high')?.url || v.videoThumbnails?.[0]?.url,
              v.lengthSeconds || v.length_seconds || v.duration || 0
            )
          );
        console.log(`[search] Invidious found ${tracks.length} tracks`);
      }
    } catch (e) {
      console.error(`[search] Invidious search error:`, e.message);
    }
    // Fallback to InnerTube/HTML when Invidious fails
    if (tracks.length < 3) {
      console.log(`[search] Invidious returned few results, falling back to InnerTube...`);
      try {
        tracks = await ytInnerTubeSearch(query, limit);
        console.log(`[search] InnerTube fallback found ${tracks.length} tracks`);
      } catch (e) {
        console.error(`[search] InnerTube fallback error:`, e.message);
      }
      if (tracks.length < 3) {
        console.log(`[search] Falling back to HTML scraping...`);
        try {
          const html = await httpGet(
            'https://www.youtube.com/results?search_query=' +
              encodeURIComponent(query + ' music') +
              '&sp=EgIQAQ%3D%3D',
            8000
          );
          if (typeof html === 'string') {
            let m = html.match(/var ytInitialData\s*=\s*(\{.+?\});\s*<\/script>/s);
            if (!m) {
              m = html.match(/ytInitialData\s*=\s*(\{.+?\});\s*<\/script>/s);
            }
            if (m) {
              let data;
              try {
                data = JSON.parse(m[1]);
              } catch (e) {
                console.error(`[search] HTML parse error:`, e.message);
                data = null;
              }
              if (data) {
                const contents =
                  data?.contents?.twoColumnSearchResultsRenderer?.primaryContents
                    ?.sectionListRenderer?.contents?.[0]?.itemSectionRenderer?.contents;
                if (Array.isArray(contents)) {
                  tracks = extractYTTracksFromContents(contents, limit);
                  console.log(`[search] HTML scrape fallback found ${tracks.length} tracks`);
                } else {
                  console.warn(`[search] No valid contents found in HTML data`);
                }
              }
            } else {
              console.warn(`[search] Could not find ytInitialData in HTML`);
              console.log(
                `[search] Available patterns:`,
                html.match(/ytInitialData/g)?.length || 0
              );
            }
          } else {
            console.warn(`[search] Invalid HTML response type:`, typeof html);
          }
        } catch (e) {
          console.error(`[search] HTML scrape fallback error:`, e.message);
        }
      }
    }
  } else {
    try {
      tracks = await ytInnerTubeSearch(query, limit);
      console.log(`[search] InnerTube found ${tracks.length} tracks`);
    } catch (e) {
      console.error(`[search] InnerTube error:`, e.message);
    }

    if (tracks.length < 3) {
      console.log(`[search] Falling back to HTML scraping...`);
      try {
        const html = await httpGet(
          'https://www.youtube.com/results?search_query=' +
            encodeURIComponent(query + ' music') +
            '&sp=EgIQAQ%3D%3D',
          8000
        );
        if (typeof html === 'string') {
          let m = html.match(/var ytInitialData\s*=\s*(\{.+?\});\s*<\/script>/s);
          if (!m) {
            m = html.match(/ytInitialData\s*=\s*(\{.+?\});\s*<\/script>/s);
          }
          if (m) {
            let data;
            try {
              data = JSON.parse(m[1]);
            } catch (e) {
              console.error(`[search] HTML parse error:`, e.message);
              data = null;
            }
            if (data) {
              const contents =
                data?.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer
                  ?.contents?.[0]?.itemSectionRenderer?.contents;
              if (Array.isArray(contents)) {
                tracks = extractYTTracksFromContents(contents, limit);
                console.log(`[search] HTML scrape fallback found ${tracks.length} tracks`);
              } else {
                console.warn(`[search] No valid contents found in HTML data`);
              }
            }
          } else {
            console.warn(`[search] Could not find ytInitialData in HTML`);
            console.log(`[search] Available patterns:`, html.match(/ytInitialData/g)?.length || 0);
          }
        } else {
          console.warn(`[search] Invalid HTML response type:`, typeof html);
        }
      } catch (e) {
        console.error(`[search] HTML scrape fallback error:`, e.message);
      }
    }
  }

  if (tracks.length < limit) {
    const subQueries = [`${query} song`, `${query} full`, `${query} audio`, `${query} official`];
    const existingIds = new Set(tracks.map(t => t.id));
    for (const sq of subQueries) {
      if (tracks.length >= limit) break;
      try {
        const more = await ytInnerTubeSearch(sq, limit);
        if (Array.isArray(more)) {
          for (const tr of more) {
            if (tr && tr.id && !existingIds.has(tr.id)) {
              tracks.push(tr);
              existingIds.add(tr.id);
              if (tracks.length >= limit) break;
            }
          }
        }
      } catch (e) {
        /* ignore fallback search errors */
      }
    }
  }

  searchCache.set(cacheKey, { tracks, expires: Date.now() + SEARCH_CACHE_TTL });
  return tracks.slice(0, limit);
}

async function searchTracks(query, limit, useCache = true) {
  const cacheKey = query.toLowerCase().trim() + ':' + networkConfig.streamSource;
  if (useCache) {
    const cached = searchCache.get(cacheKey);
    if (cached && cached.expires > Date.now() && cached.tracks.length >= limit) {
      console.log(`[search] Cache hit for: "${query}"`);
      return cached.tracks.slice(0, limit);
    }
  }
  const tracks = await ytSearchScrape(query, limit);
  // Офлайн-фолбэк: нет сети — показываем локальный демо-каталог
  if (!tracks.length) {
    const demo = require('./demo.js').searchDemo(query, limit);
    if (demo.length) {
      console.log(`[demo] Offline catalog fallback for: "${query}"`);
      return demo;
    }
  }
  if (useCache) {
    searchCache.set(cacheKey, { tracks, expires: Date.now() + SEARCH_CACHE_TTL });
  }
  return tracks.slice(0, limit);
}

function transliterateCyrillic(str) {
  if (!str) return '';
  const ru = 'абвгдеёжзийклмнопрстуфхцчшщъыьэюя';
  const en = ['a','b','v','g','d','e','yo','zh','z','i','y','k','l','m','n','o','p','r','s','t','u','f','kh','ts','ch','sh','shch','','y','','e','yu','ya'];
  let res = '';
  for (const ch of str.toLowerCase()) {
    const idx = ru.indexOf(ch);
    res += idx !== -1 ? en[idx] : ch;
  }
  return res.trim();
}

async function searchTracksByArtist(name, limit = 50) {
  const clean = String(name || '')
    .replace(/\s*-\s*Topic\b/gi, '')
    .replace(/\s*-\s*Тема\b/gi, '')
    .replace(/\b(VEVO|Official|Records|Music|Channel)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim() || String(name || '').trim();

  const translit = transliterateCyrillic(clean);
  const searchQueries = [`${clean} songs`, `${clean} official audio`, clean];
  if (translit && translit !== clean) {
    searchQueries.unshift(`${translit} songs`);
  }

  const rawTracks = await searchTracks(searchQueries[0], Math.max(limit * 2, 40), false);

  // Filter out completely unrelated tracks that YouTube recommends (e.g. P.O.D., Beck, Dire Straits)
  const tokens = Array.from(new Set([
    ...clean.toLowerCase().split(/\s+/),
    ...(translit ? translit.toLowerCase().split(/\s+/) : [])
  ].filter(t => t.length >= 2)));

  const matched = rawTracks.filter(t => {
    const artist = String(t.artist || '').toLowerCase();
    const title = String(t.title || '').toLowerCase();
    const combined = `${artist} ${title}`;
    return tokens.some(tok => combined.includes(tok));
  });

  const finalTracks = matched.length >= 2 ? matched : rawTracks.slice(0, Math.min(matched.length, limit));
  if (!finalTracks.length) {
    const demo = require('./demo.js').searchDemoByArtist(clean, limit);
    if (demo.length) return demo;
  }
  return finalTracks.slice(0, limit);
}

async function getRecommendations(limit = RECOMMENDATION_LIMIT) {
  // Pick a fresh randomized selection of seeds on each call
  const shuffledSeeds = [...RECOMMENDATION_SEEDS].sort(() => Math.random() - 0.5);
  const seedCount = Math.min(8, shuffledSeeds.length);
  const seeds = shuffledSeeds.slice(0, seedCount);
  const results = await Promise.allSettled(seeds.map(seed => searchTracks(seed, 3, false)));
  const allTracks = results.flatMap(result => (result.status === 'fulfilled' ? result.value : []));

  const normTrackKey = t => {
    const a = String(t.artist || '').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
    const tit = String(t.title || '').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
    return `${a}::${tit}`;
  };
  const seenIds = new Set();
  const seenNames = new Set();
  const unique = allTracks.filter(t => {
    if (!t || !t.id) return false;
    if (seenIds.has(t.id)) return false;
    const key = normTrackKey(t);
    if (key.length > 5 && seenNames.has(key)) return false;
    seenIds.add(t.id);
    if (key.length > 5) seenNames.add(key);
    return true;
  });
  if (!unique.length) {
    const demo = require('./demo.js').demoAll(limit);
    if (demo.length) {
      console.log('[demo] Offline recommendations fallback');
      return demo;
    }
  }
  return unique.slice(0, limit);
}

// ------------------------------------------------------------------ чарты

const CHART_CACHE_TTL = 30 * 60 * 1000; // чарт обновляется ~раз в сутки, хватит и получаса
const chartCache = new Map();

/** Минимальный GET → JSON (без внешних зависимостей). */
function httpsGetJson(url, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    const req = https.get(
      url,
      { headers: { 'User-Agent': 'Votify/1.0', Accept: 'application/json' } },
      res => {
        if (res.statusCode !== 200) {
          res.resume();
          reject(new Error('HTTP ' + res.statusCode));
          return;
        }
        let data = '';
        res.setEncoding('utf8');
        res.on('data', chunk => {
          data += chunk;
        });
        res.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(e);
          }
        });
      },
    );
    req.setTimeout(timeoutMs, () => req.destroy(new Error('timeout')));
    req.on('error', reject);
  });
}

/**
 * Живой чарт Apple Music — то, что слушают прямо сейчас, а не «популярное когда-то».
 * Позиции чарта резолвим в треки (каждый запрос — отдельный yt-dlp, поэтому
 * небольшими пачками) и кэшируем на полчаса.
 */
async function getChartTracks(region = 'ru', limit = 30) {
  const key = String(region).toLowerCase() + ':' + limit;
  const cached = chartCache.get(key);
  if (cached && cached.expires > Date.now()) return cached.tracks;

  const url =
    'https://rss.marketingtools.apple.com/api/v2/' +
    encodeURIComponent(String(region).toLowerCase()) +
    '/music/most-played/50/songs.json';
  const data = await httpsGetJson(url);
  const entries = (data && data.feed && data.feed.results ? data.feed.results : [])
    .map(r => ({ title: r && r.name, artist: (r && r.artistName) || '' }))
    .filter(e => {
      if (!e.title) return false;
      const lower = `${e.artist} ${e.title}`.toLowerCase();
      return !EXCLUDED_POP_ARTISTS.some(k => lower.includes(k));
    })
    .slice(0, limit);
  if (!entries.length) return [];

  const tracks = [];
  const CONCURRENCY = 4;
  for (let i = 0; i < entries.length; i += CONCURRENCY) {
    const batch = entries.slice(i, i + CONCURRENCY);
    const results = await Promise.allSettled(
      batch.map(e => searchTracks(`${e.artist} ${e.title}`.trim(), 1, true)),
    );
    results.forEach(r => {
      if (r.status === 'fulfilled' && r.value && r.value.length) tracks.push(r.value[0]);
    });
  }

  const seen = new Set();
  const unique = tracks.filter(t => t && t.id && !seen.has(t.id) && seen.add(t.id));
  if (unique.length) chartCache.set(key, { tracks: unique, expires: Date.now() + CHART_CACHE_TTL });
  return unique;
}

const AUDIO_QUALITY_FORMATS = {
  high: 'bestaudio[acodec=opus]/bestaudio[ext=webm]/bestaudio[abr>=160]/bestaudio/best',
  medium: 'bestaudio[acodec=opus][abr<=160]/bestaudio[ext=webm]/bestaudio[abr<=160]/bestaudio/best',
  low: 'worstaudio/bestaudio[acodec=opus][abr<=96]/bestaudio[abr<=96]/bestaudio/best',
};

// --- Audius REST API Integration (Open 320 kbps streaming) ---
const AUDIUS_APP_NAME = 'RIZE';
const AUDIUS_API_BASE = 'https://api.audius.co';
let currentAudioEngine = 'ytdlp'; // 'ytdlp' | 'audius'

function getAudioEngine() {
  return currentAudioEngine;
}

function setAudioEngine(engine) {
  if (engine === 'audius' || engine === 'ytdlp') {
    currentAudioEngine = engine;
    networkConfig.audioEngine = engine;
    try {
      saveNetworkConfig(networkConfig);
    } catch (_) {}
  }
  return currentAudioEngine;
}

async function searchAudiusTracks(query, limit = 20) {
  if (!query || !query.trim()) return [];
  try {
    const url = `${AUDIUS_API_BASE}/v1/tracks/search?query=${encodeURIComponent(query.trim())}&app_name=${AUDIUS_APP_NAME}`;
    const data = await httpGet(url, 4000);
    if (data && Array.isArray(data.data)) {
      return data.data.slice(0, limit).map(t => {
        const rawId = t.id || t.track_id;
        const artworkObj = t.artwork || {};
        const artworkUrl = artworkObj['480x480'] || artworkObj['1000x1000'] || artworkObj['150x150'] || '';
        return {
          id: `audius_${rawId}`,
          title: t.title || 'Untitled',
          artist: (t.user && (t.user.name || t.user.handle)) || 'Audius Artist',
          duration: t.duration || 0,
          thumbnail: artworkUrl,
          cover: artworkUrl,
          platform: 'audius',
          streamUrl: `${AUDIUS_API_BASE}/v1/tracks/${rawId}/stream?app_name=${AUDIUS_APP_NAME}`,
          bitrate: 320,
          codec: 'mp3',
        };
      });
    }
  } catch (e) {
    console.error('[Audius] search error:', e.message);
  }
  return [];
}

async function resolveAudiusStreamUrl(trackIdOrQuery) {
  if (!trackIdOrQuery) return null;
  const raw = String(trackIdOrQuery).trim();
  if (raw.startsWith('audius_')) {
    const audiusId = raw.replace(/^audius_/, '').trim();
    if (/^[a-zA-Z0-9]{5,12}$/.test(audiusId) || /^\d+$/.test(audiusId)) {
      return `${AUDIUS_API_BASE}/v1/tracks/${encodeURIComponent(audiusId)}/stream?app_name=${AUDIUS_APP_NAME}`;
    }
    try {
      const q = audiusId.replace(/[_-]/g, ' ');
      const results = await searchAudiusTracks(q, 1);
      if (results.length > 0 && results[0].streamUrl) {
        return results[0].streamUrl;
      }
    } catch (_) {}
    return null;
  }
  // Check if raw is a pure YouTube video ID without artist/title
  if (/^[a-zA-Z0-9_-]{11}$/.test(raw) && !raw.includes(' ')) {
    return null;
  }
  if (/^\d{3,10}$/.test(raw)) {
    return `${AUDIUS_API_BASE}/v1/tracks/${raw}/stream?app_name=${AUDIUS_APP_NAME}`;
  }
  try {
    const results = await searchAudiusTracks(raw, 1);
    if (results.length > 0 && results[0].streamUrl) {
      return results[0].streamUrl;
    }
  } catch (_) {}
  return null;
}

async function fetchFastInnerTubeStreamUrl(videoId) {
  const clients = [
    { clientName: 'ANDROID_VR', clientVersion: '1.58.19', androidSdkVersion: 32 },
    { clientName: 'ANDROID_MUSIC', clientVersion: '6.42.52', androidSdkVersion: 31 },
    { clientName: 'ANDROID', clientVersion: '19.29.37', androidSdkVersion: 30 },
  ];

  for (const c of clients) {
    try {
      const payload = {
        videoId: String(videoId),
        context: {
          client: {
            clientName: c.clientName,
            clientVersion: c.clientVersion,
            androidSdkVersion: c.androidSdkVersion,
            hl: 'en',
            gl: 'US',
          },
        },
      };
      const resData = await httpPostJSON('https://www.youtube.com/youtubei/v1/player', payload, 2000);
      if (resData && resData.streamingData && Array.isArray(resData.streamingData.adaptiveFormats)) {
        const formats = resData.streamingData.adaptiveFormats;
        const audioFormats = formats.filter(f => f.mimeType && f.mimeType.startsWith('audio/') && f.url);
        if (audioFormats.length > 0) {
          // Strict priority for Opus codec (WebM/Ogg container, 128-160 kbps) for minimal latency & clean sound
          audioFormats.sort((a, b) => {
            const aOpus = a.mimeType && a.mimeType.toLowerCase().includes('opus') ? 1 : 0;
            const bOpus = b.mimeType && b.mimeType.toLowerCase().includes('opus') ? 1 : 0;
            if (aOpus !== bOpus) return bOpus - aOpus;
            return (b.bitrate || 0) - (a.bitrate || 0);
          });
          return audioFormats[0].url;
        }
      }
    } catch (e) {}
  }
  return null;
}

// --- Persistent In-Memory Stream Resolver Daemon ---
let resolverDaemonProc = null;
const resolverPending = new Map();
let resolverReqCounter = 0;
let resolverDaemonDisabled = false;

function getResolverDaemon() {
  if (resolverDaemonDisabled) return null;
  if (resolverDaemonProc && !resolverDaemonProc.killed && resolverDaemonProc.exitCode === null) {
    return resolverDaemonProc;
  }

  const daemonPath = path.join(__dirname, 'resolver_daemon.py');
  if (!fs.existsSync(daemonPath)) return null;

  try {
    const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';
    const proc = spawn(pythonCmd, [daemonPath], {
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
    });

    let buffer = '';
    proc.stdout.on('data', data => {
      buffer += data.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop();
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed === 'READY') continue;
        try {
          const res = JSON.parse(trimmed);
          if (res && res.id && resolverPending.has(res.id)) {
            const { resolve, reject, timer } = resolverPending.get(res.id);
            clearTimeout(timer);
            resolverPending.delete(res.id);
            if (res.url) resolve(res.url);
            else reject(new Error(res.error || 'No url returned'));
          }
        } catch (e) {}
      }
    });

    proc.on('error', err => {
      console.warn('[resolver_daemon] Python daemon spawn error:', err.message);
      resolverDaemonProc = null;
      resolverDaemonDisabled = true;
    });

    proc.on('close', code => {
      if (resolverDaemonProc === proc) resolverDaemonProc = null;
      for (const [id, { reject, timer }] of resolverPending.entries()) {
        clearTimeout(timer);
        reject(new Error('daemon closed with code ' + code));
      }
      resolverPending.clear();
    });

    resolverDaemonProc = proc;
    return resolverDaemonProc;
  } catch (err) {
    console.warn('[resolver_daemon] Init error:', err.message);
    resolverDaemonDisabled = true;
    return null;
  }
}

const inflightStreams = new Map();

async function fetchFromDaemon(videoId, quality, timeoutMs = 8000) {
  const daemon = getResolverDaemon();
  if (!daemon || !daemon.stdin || daemon.stdin.destroyed) return null;

  return new Promise((resolve, reject) => {
    const reqId = 'req_' + (++resolverReqCounter) + '_' + Date.now();
    const timer = setTimeout(() => {
      resolverPending.delete(reqId);
      if (daemon && daemon.stdin && !daemon.stdin.destroyed) {
        try { daemon.stdin.write(JSON.stringify({ cancel: reqId }) + '\n'); } catch (e) {}
      }
      reject(new Error('daemon timeout'));
    }, timeoutMs);

    resolverPending.set(reqId, { resolve, reject, timer });
    try {
      daemon.stdin.write(JSON.stringify({ id: reqId, videoId, quality }) + '\n');
    } catch (e) {
      clearTimeout(timer);
      resolverPending.delete(reqId);
      reject(e);
    }
  });
}

async function fetchStreamUrl(videoId) {
  if (!videoId || typeof videoId !== 'string') return null;
  const vid = videoId.trim();
  if (vid.startsWith('local_') || vid.startsWith('demo_') || vid.startsWith('mock-') || vid.startsWith('fb-')) {
    return null;
  }

  const quality = networkConfig.audioQuality || 'medium';
  const cacheKey = `${vid}::${quality}`;
  const cached = streamCache.get(cacheKey);
  if (cached && cached.expires > Date.now()) {
    return cached.url;
  }

  if (inflightStreams.has(cacheKey)) {
    return inflightStreams.get(cacheKey);
  }

  const resolvePromise = (async () => {
    // Audius tracks (audius_<id>)
    if (vid.startsWith('audius_')) {
      const rawId = vid.replace(/^audius_/, '').trim();
      if (/^[a-zA-Z0-9]{5,12}$/.test(rawId) || /^\d+$/.test(rawId)) {
        const audiusStream = `${AUDIUS_API_BASE}/v1/tracks/${encodeURIComponent(rawId)}/stream?app_name=${AUDIUS_APP_NAME}`;
        streamCache.set(cacheKey, { url: audiusStream, expires: Date.now() + STREAM_CACHE_TTL });
        return audiusStream;
      }
      // If audius_ contains artist/title query (e.g. audius_bushido_zho), search YouTube
      const cleanQ = rawId.replace(/[_-]/g, ' ');
      try {
        const ytTracks = await searchTracks(cleanQ, 1);
        if (ytTracks.length > 0 && ytTracks[0].id) {
          const ytStream = await fetchStreamUrl(ytTracks[0].id);
          if (ytStream) {
            streamCache.set(cacheKey, { url: ytStream, expires: Date.now() + STREAM_CACHE_TTL });
            return ytStream;
          }
        }
      } catch (_) {}
      return null;
    }

    // SoundCloud tracks
    if (vid.startsWith('sc_')) {
      try {
        const url = await scGetStreamUrl(vid);
        if (url) {
          streamCache.set(cacheKey, { url, expires: Date.now() + STREAM_CACHE_TTL });
          return url;
        }
      } catch (e) {
        console.log('[soundcloud] Stream error for', vid, ':', e.message);
      }
      return null;
    }

    // Deezer tracks (dz_<id>)
    if (vid.startsWith('dz_')) {
      const rawId = vid.replace('dz_', '');
      try {
        const dzRes = await httpGet(`https://api.deezer.com/track/${rawId}`, 6000);
        const dzData = typeof dzRes === 'string' ? JSON.parse(dzRes) : dzRes;
        const title = dzData?.title || '';
        const artist = dzData?.artist?.name || '';
        const preview = dzData?.preview || '';
        if (title) {
          const query = artist ? `${artist} - ${title}` : title;
          const ytResults = await searchTracks(query, 1, false);
          if (ytResults && ytResults.length > 0 && ytResults[0].id) {
            const ytStream = await fetchStreamUrl(ytResults[0].id);
            if (ytStream) {
              streamCache.set(cacheKey, { url: ytStream, expires: Date.now() + STREAM_CACHE_TTL });
              return ytStream;
            }
          }
        }
        if (preview) {
          streamCache.set(cacheKey, { url: preview, expires: Date.now() + STREAM_CACHE_TTL });
          return preview;
        }
      } catch (e) {
        console.warn('[deezer] Stream resolve error for', vid, ':', e.message);
      }
      return null;
    }

    // 1. Try persistent in-memory python resolver daemon (~1.2s on cold, ~300ms warm)
    try {
      const daemonUrl = await fetchFromDaemon(vid, quality, 8000);
      if (daemonUrl) {
        streamCache.set(cacheKey, { url: daemonUrl, expires: Date.now() + STREAM_CACHE_TTL });
        return daemonUrl;
      }
    } catch (e) {}

    // 2. Try fast InnerTube HTTP direct stream extraction fallback
    try {
      const fastUrl = await fetchFastInnerTubeStreamUrl(vid);
      if (fastUrl) {
        streamCache.set(cacheKey, { url: fastUrl, expires: Date.now() + STREAM_CACHE_TTL });
        return fastUrl;
      }
    } catch (e) {}

    // 3. Fallback to bundled yt-dlp binary
    const fetchYtDlp = async () => {
      const ytdlpPath = process.env.YT_DLP_PATH || findYtDlp();
      const ytdlpArgs = [
        '--no-check-certificates',
        '--no-warnings',
        '--no-playlist',
        '--quiet',
        '--extractor-args',
        'youtube:player_client=android',
        '-g',
        '-f',
        AUDIO_QUALITY_FORMATS[quality] || 'ba/b',
        '--socket-timeout',
        '6',
        '--user-agent',
        YT_UA,
      ];
      ytdlpArgs.push('https://www.youtube.com/watch?v=' + vid);

      const proc = spawn(ytdlpPath, ytdlpArgs, { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
      return new Promise((resolve, reject) => {
        let out = '';
        proc.stdout.on('data', d => {
          out += d;
          const line = out.trim();
          if (line && line.startsWith('http')) {
            proc.kill();
            resolve(line.split('\n')[0]);
          }
        });
        proc.on('error', reject);
        proc.on('close', code => {
          if (out.trim()) resolve(out.trim().split('\n')[0]);
          else reject(new Error('exit ' + code));
        });
        setTimeout(() => {
          proc.kill();
          reject(new Error('timeout'));
        }, 10000);
      });
    };

    try {
      const url = await fetchYtDlp();
      if (url) {
        streamCache.set(cacheKey, { url, expires: Date.now() + STREAM_CACHE_TTL });
        return url;
      }
    } catch (error) {
      console.error('[yt-dlp] Stream resolution failed for', vid, ':', error.message);
    }

    return null;
  })();

  inflightStreams.set(cacheKey, resolvePromise);
  try {
    return await resolvePromise;
  } finally {
    inflightStreams.delete(cacheKey);
  }
}

// --- SOUNDCLOUD ---
let scClientId = '';
let scClientIdExpiry = 0;

async function scGetClientId() {
  if (scClientId && Date.now() < scClientIdExpiry) return scClientId;
  try {
    const html = await httpGet('https://soundcloud.com', 10000);
    if (typeof html !== 'string') return '';
    // SoundCloud changes asset names and client_id syntax regularly. Search
    // several current bundles instead of relying on one exact filename.
    const scriptUrls = [...html.matchAll(/(?:src|href)="(https?:\/\/[^" ]+\.js[^" ]*)"/gi)].map(
      m => m[1]
    );
    const scripts = await Promise.all([
      Promise.resolve(html),
      ...scriptUrls.slice(-10).map(url => httpGet(url, 10000).catch(() => '')),
    ]);
    for (const script of scripts) {
      if (typeof script !== 'string') continue;
      const idMatch =
        script.match(/client_id["']?\s*[:=]\s*["']([a-zA-Z0-9_-]{16,})["']/) ||
        script.match(/client_id(?:=|%3D|["':])([a-zA-Z0-9_-]{16,})/i);
      if (idMatch) {
        scClientId = idMatch[1];
        break;
      }
    }
    if (!scClientId) return '';
    scClientIdExpiry = Date.now() + 3600000;
    console.log('[soundcloud] Got client_id:', scClientId.slice(0, 8) + '...');
    return scClientId;
  } catch (e) {
    console.error('[soundcloud] Failed to get client_id:', e.message);
    return '';
  }
}

async function scSearch(query, limit = 12) {
  const clientId = await scGetClientId();
  if (!clientId) return [];
  try {
    const url = `https://api-v2.soundcloud.com/search/tracks?q=${encodeURIComponent(query)}&limit=${limit}&client_id=${clientId}`;
    const data = await httpGet(url, 10000);
    if (!data || !data.collection) return [];
    return data.collection
      .filter(t => t.streamable && t.kind === 'track')
      .slice(0, limit)
      .map(t => {
        const id = 'sc_' + t.id;
        const artwork = (t.artwork_url || '').replace('-large', '-t500x500');
        const durationSec = Math.round((t.duration || 0) / 1000);
        return makeTrack(id, t.title, t.user?.username || 'Unknown', artwork, durationSec);
      });
  } catch (e) {
    console.error('[soundcloud] Search error:', e.message);
    return [];
  }
}

async function scGetTrackMeta(trackId) {
  const numericId = String(trackId).replace('sc_', '');
  const clientId = await scGetClientId();
  if (!clientId) return null;
  try {
    const track = await httpGet(
      `https://api-v2.soundcloud.com/tracks/${numericId}?client_id=${clientId}`,
      10000
    );
    if (!track || !track.title) return null;
    return {
      id: 'sc_' + track.id,
      title: track.title,
      artist: track.user?.username || track.publisher_metadata?.artist || '',
      duration: Math.round((track.duration || 0) / 1000),
      artwork: (track.artwork_url || '').replace('-large', '-t500x500'),
      monetization_model: track.monetization_model,
      policy: track.policy,
      streamable: track.streamable,
    };
  } catch (e) {
    return null;
  }
}

async function scGetStreamUrlDirect(numericId) {
  const clientId = await scGetClientId();
  if (!clientId) return null;
  try {
    const url = `https://api-v2.soundcloud.com/tracks/${numericId}/streams?client_id=${clientId}`;
    const data = await httpGet(url, 10000);
    if (data && data.http_mp3_128_url) return data.http_mp3_128_url;

    // The legacy /streams endpoint is no longer returned consistently.
    // Resolve an advertised transcoding endpoint and prefer progressive MP3;
    // an HLS manifest cannot be passed through our byte-stream proxy as audio.
    const track = await httpGet(
      `https://api-v2.soundcloud.com/tracks/${numericId}?client_id=${clientId}`,
      10000
    );
    const transcodings = track?.media?.transcodings || [];
    const progressive =
      transcodings.find(t => t?.format?.protocol === 'progressive') ||
      transcodings.find(t => t?.format?.mime_type?.includes('audio/mpeg'));
    if (progressive?.url) {
      const separator = progressive.url.includes('?') ? '&' : '?';
      const resolved = await httpGet(`${progressive.url}${separator}client_id=${clientId}`, 10000);
      if (resolved?.url) return resolved.url;
    }

    // Last resort for older tracks/accounts where only the legacy HLS URL is
    // available. Chromium may still handle it on supported platforms.
    if (data && data.hls_mp3_128_url) return data.hls_mp3_128_url;
    return null;
  } catch (e) {
    console.error('[soundcloud] Stream error:', e.message);
    return null;
  }
}

/**
 * Функция ALT (Обход DRM и превью, как в sc-player):
 * Если трек заблокирован, защищен DRM или доступен на SoundCloud только в виде 30-секундного
 * превью, автоматически ищет другую копию этой же аудиозаписи, сверяет её по длительности/названию
 * и возвращает альтернативный поток.
 */
async function scFindAltStream(numericId) {
  try {
    const meta = await scGetTrackMeta(numericId);
    const title = meta?.title;
    const artist = meta?.artist;
    if (!title && !artist) return null;

    const query = [artist, title].filter(Boolean).join(' - ');

    // 1. Поиск альтернативных копий на SoundCloud
    const alts = await scSearch(query, 6);
    for (const alt of alts) {
      const altNumId = String(alt.id).replace('sc_', '');
      if (altNumId === String(numericId)) continue;
      // Если длительность совпадает в пределах 15 секунд — это альтернативная копия трека
      if (meta?.duration > 0 && Math.abs((alt.duration || 0) - meta.duration) <= 15) {
        const stream = await scGetStreamUrlDirect(altNumId);
        if (stream && !stream.includes('preview')) {
          console.log(`[soundcloud-alt] Найдена альтернативная копия трека на SoundCloud: ${alt.title} (${alt.id})`);
          return stream;
        }
      }
    }

    // 2. Fallback на полный поток из внешнего каталога / YouTube
    const ytTracks = await searchTracks(query, 1, false);
    if (ytTracks && ytTracks.length > 0 && ytTracks[0].id) {
      const ytStream = await fetchStreamUrl(ytTracks[0].id);
      if (ytStream) {
        console.log(`[soundcloud-alt] Подключен альтернативный поток через YouTube/Opus: ${ytTracks[0].title}`);
        return ytStream;
      }
    }
  } catch (e) {
    console.warn('[soundcloud-alt] Ошибка поиска альтернативного трека:', e.message);
  }
  return null;
}

async function scGetStreamUrl(trackId) {
  const numericId = String(trackId).replace('sc_', '');
  const engine = networkConfig.soundcloudEngine || 'alt';

  // 1. Движок yt-dlp: прямое извлечение через экстрактор yt-dlp
  if (engine === 'ytdlp') {
    try {
      const ytdlpPath = process.env.YT_DLP_PATH || findYtDlp();
      const scUrl = `https://api.soundcloud.com/tracks/${numericId}`;
      const args = [
        '--no-check-certificates',
        '--no-warnings',
        '--no-playlist',
        '--quiet',
        '-g',
        '-f',
        'bestaudio/best',
        '--socket-timeout',
        '8',
        '--user-agent',
        YT_UA,
      ];
      if (networkConfig.zapretEnabled) {
        const zapretProxy = (networkConfig.zapretMode === 'socks')
          ? `socks5://${networkConfig.zapretHost || '127.0.0.1'}:${networkConfig.zapretPort || 1080}`
          : `http://${networkConfig.zapretHost || '127.0.0.1'}:${networkConfig.zapretPort || 1080}`;
        args.push('--proxy', zapretProxy);
      }
      args.push(scUrl);
      const proc = spawn(ytdlpPath, args, { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
      const stream = await new Promise((resolve) => {
        let out = '';
        proc.stdout.on('data', d => { out += d; });
        proc.on('close', () => resolve(out.trim().split('\n')[0] || null));
        setTimeout(() => { proc.kill(); resolve(null); }, 10000);
      });
      if (stream && stream.startsWith('http')) return stream;
    } catch (_) {}
  }

  // 2. Прямой поток SoundCloud API v2
  const directUrl = await scGetStreamUrlDirect(numericId);

  // Если выбран режим direct — возвращаем только прямой поток SoundCloud
  if (engine === 'direct') {
    return directUrl;
  }

  // 3. Режим ALT (Умный обход DRM, превью и блокировок) — по умолчанию
  if (engine === 'alt') {
    // Проверяем, не является ли трек 30-секундным превью или заблокированным
    const meta = await scGetTrackMeta(numericId);
    const isShortPreview = meta && meta.duration > 45 && directUrl && (directUrl.includes('preview') || directUrl.includes('/snippets/'));
    if (directUrl && !isShortPreview) {
      return directUrl;
    }
    // Если прямой стрим не получен или это 30s превью/DRM: запускаем автопоиск копии!
    const altStream = await scFindAltStream(numericId);
    if (altStream) return altStream;
    if (directUrl) return directUrl; // Если копий не нашлось, отдаем хотя бы превью
  }

  return directUrl;
}

function resolveHttpRedirect(rawUrl, maxRedirects = 5) {
  return new Promise((resolve) => {
    let current = rawUrl;
    let count = 0;
    function check(u) {
      if (count++ >= maxRedirects) return resolve(u);
      try {
        const parsed = new URL(u);
        const transport = parsed.protocol === 'https:' ? https : http;
        const req = transport.request(u, { method: 'HEAD', headers: { 'User-Agent': YT_UA } }, (res) => {
          if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
            const loc = res.headers.location.startsWith('http')
              ? res.headers.location
              : new URL(res.headers.location, u).href;
            return check(loc);
          }
          resolve(u);
        });
        req.on('error', () => {
          const getReq = transport.get(u, { headers: { 'User-Agent': YT_UA } }, (res) => {
            if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
              const loc = res.headers.location.startsWith('http')
                ? res.headers.location
                : new URL(res.headers.location, u).href;
              res.destroy();
              return check(loc);
            }
            res.destroy();
            resolve(u);
          });
          getReq.on('error', () => resolve(u));
        });
        req.end();
      } catch {
        resolve(u);
      }
    }
    check(current);
  });
}

async function scImportPlaylist(playlistUrl) {
  const clientId = await scGetClientId();
  if (!clientId) return { error: 'No client_id' };
  try {
    let resolvedUrl = playlistUrl;
    try {
      resolvedUrl = await resolveHttpRedirect(playlistUrl);
    } catch (_) {}
    const cleanUrl = resolvedUrl.split('?')[0];

    // Resolve the URL to get playlist/user/track info
    const resolveUrl = `https://api-v2.soundcloud.com/resolve?url=${encodeURIComponent(cleanUrl)}&client_id=${clientId}`;
    const data = await httpGet(resolveUrl, 15000);
    if (!data) return { error: 'Not found' };

    let tracks = [];
    let name = 'SoundCloud Playlist';

    if (data.kind === 'playlist') {
      name = data.title || 'SoundCloud Playlist';
      const rawTracks = data.tracks || [];
      const fullTracks = [];
      const missingIds = [];

      for (const t of rawTracks) {
        if (!t) continue;
        if (t.title) {
          fullTracks.push(t);
        } else if (t.id) {
          missingIds.push(t.id);
        }
      }

      // Batch fetch missing track stubs in groups of 50
      if (missingIds.length > 0) {
        for (let i = 0; i < missingIds.length; i += 50) {
          const chunk = missingIds.slice(i, i + 50);
          try {
            const batchUrl = `https://api-v2.soundcloud.com/tracks?ids=${chunk.join('%2C')}&client_id=${clientId}`;
            const batchRes = await httpGet(batchUrl, 12000);
            if (Array.isArray(batchRes)) {
              fullTracks.push(...batchRes);
            }
          } catch (err) {
            console.warn('[soundcloud] batch tracks fetch error:', err.message);
          }
        }
      }

      tracks = fullTracks
        .filter(t => t && t.title)
        .map(t => {
          const artwork = (t.artwork_url || '').replace('-large', '-t500x500') || (data.artwork_url || '').replace('-large', '-t500x500');
          const trk = makeTrack('sc_' + t.id, t.title, t.user?.username || t.publisher_metadata?.artist || 'Unknown', artwork);
          trk.duration = Math.round((t.duration || 0) / 1000);
          return trk;
        });
    } else if (data.kind === 'track') {
      name = data.title || 'SoundCloud Track';
      const artwork = (data.artwork_url || '').replace('-large', '-t500x500');
      const trk = makeTrack('sc_' + data.id, data.title, data.user?.username || data.publisher_metadata?.artist || 'Unknown', artwork);
      trk.duration = Math.round((data.duration || 0) / 1000);
      tracks = [trk];
    } else if (data.kind === 'user') {
      name = data.username || 'SoundCloud Likes';
      const tracksUrl = `https://api-v2.soundcloud.com/users/${data.id}/tracks?limit=50&client_id=${clientId}`;
      const tracksData = await httpGet(tracksUrl, 15000);
      if (tracksData && tracksData.collection) {
        tracks = tracksData.collection
          .filter(t => t && t.title)
          .map(t => {
            const artwork = (t.artwork_url || '').replace('-large', '-t500x500');
            const trk = makeTrack('sc_' + t.id, t.title, t.user?.username || 'Unknown', artwork);
            trk.duration = Math.round((t.duration || 0) / 1000);
            return trk;
          });
      }
    }

    return { name, tracks };
  } catch (e) {
    console.error('[soundcloud] Import error:', e.message);
    return { error: e.message };
  }
}

/* ------------------------------------------------------------
   Статика UI (src/) — веб-превью без Electron
   ------------------------------------------------------------ */
const fsPromises = require('fs/promises');
const srcDir = path.resolve(process.env.VOTIFY_SRC_DIR || path.join(appRoot, 'src'));

const STATIC_MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.mp3': 'audio/mpeg',
  '.m4a': 'audio/mp4',
  '.ogg': 'audio/ogg',
  '.wav': 'audio/wav',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.mp4': 'video/mp4',
};

async function serveStatic(reqPath, res) {
  const norm = reqPath === '/' ? '/index.html' : reqPath;
  const fp = path.normalize(path.join(srcDir, norm));
  if (!fp.startsWith(srcDir)) {
    sendJson(res, 403, { error: 'Forbidden' });
    return;
  }
  try {
    const content = await fsPromises.readFile(fp);
    res.writeHead(200, {
      'Content-Type':
        STATIC_MIME_TYPES[path.extname(fp).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-cache, must-revalidate',
    });
    res.end(content);
  } catch {
    sendJson(res, 404, { error: 'Not found' });
  }
}

module.exports = {
  // http helpers
  sendJson,
  parseBody,
  httpGet,
  httpPostJSON,
  YT_UA,
  // config / storage
  appRoot,
  PERSISTENT_DIR,
  networkConfig,
  loadNetworkConfig,
  saveNetworkConfig,
  getNetworkConfig,
  getLanAddresses,
  findYtDlp,
  // auth helpers
  bcrypt,
  SALT_ROUNDS,
  generateToken,
  verifyToken,
  getAuthUser,
  generateResetCode,
  createEmailTransporter,
  loadUsers,
  saveUsers,
  resetCodes,
  // music
  SEARCH_LIMIT,
  SEARCH_MAX_LIMIT,
  searchTracks,
  parseDurationToSeconds,
  makeTrack,
  transliterateCyrillic,
  extractYTTracksFromContents,
  searchTracksByArtist,
  getRecommendations,
  getChartTracks,
  fetchStreamUrl,
  streamCache,
  STREAM_CACHE_TTL,
  // soundcloud
  scSearch,
  scGetStreamUrl,
  scGetStreamUrlDirect,
  scGetTrackMeta,
  scFindAltStream,
  scImportPlaylist,
  getSoundcloudEngine,
  setSoundcloudEngine,
  // zapret
  getZapretConfig,
  setZapretConfig,
  // audius & audio engine
  AUDIUS_APP_NAME,
  AUDIUS_API_BASE,
  searchAudiusTracks,
  resolveAudiusStreamUrl,
  getAudioEngine,
  setAudioEngine,
  // static UI
  serveStatic,
  STATIC_MIME_TYPES,
};

// Pre-warm resolver daemon on server startup for fast instant playback
if (!process.env.NODE_TEST_CONTEXT && process.env.NODE_ENV !== 'test') {
  setTimeout(() => {
    try {
      getResolverDaemon();
    } catch (_) {}
  }, 250).unref();
}

