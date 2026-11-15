const { sendJson, parseBody, getAuthUser, PERSISTENT_DIR } = require('./utils.js');
const fs = require('fs');
const path = require('path');

const SHARED_STORAGE_FILE = path.join(PERSISTENT_DIR, 'shared_storage.json');

// Per-user settings sync: the mobile app pushes/pulls its customization blob
// (Пресеты, темы, свайпы, фоны…). Files live in PERSISTENT_DIR/userdata/<userId>.json.
function userFile(userId) {
  const dir = path.join(PERSISTENT_DIR, 'userdata');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, userId + '.json');
}

async function handleSyncRoutes(req, res, u) {
  // --- SHARED CROSS-PLATFORM STORAGE (Electron <-> Tauri <-> Web) ---
  if (u.pathname === '/api/sync/shared-storage' && req.method === 'GET') {
    try {
      if (fs.existsSync(SHARED_STORAGE_FILE)) {
        const data = JSON.parse(fs.readFileSync(SHARED_STORAGE_FILE, 'utf8'));
        sendJson(res, 200, { ok: true, data });
        return true;
      }
    } catch (_) {}
    sendJson(res, 200, { ok: true, data: {} });
    return true;
  }

  if (u.pathname === '/api/sync/shared-storage' && req.method === 'POST') {
    try {
      const body = await parseBody(req);
      if (body && typeof body === 'object') {
        let existing = {};
        try {
          if (fs.existsSync(SHARED_STORAGE_FILE)) {
            existing = JSON.parse(fs.readFileSync(SHARED_STORAGE_FILE, 'utf8'));
          }
        } catch (_) {}
        const merged = { ...existing, ...body };
        fs.writeFileSync(SHARED_STORAGE_FILE, JSON.stringify(merged, null, 2), 'utf8');
        sendJson(res, 200, { ok: true });
        return true;
      }
    } catch (e) {
      sendJson(res, 500, { error: e.message });
      return true;
    }
  }

  // --- SYNC GET: the user's saved settings blob ---
  if (u.pathname === '/api/sync/get' && req.method === 'GET') {
    const auth = getAuthUser(req);
    if (!auth) {
      sendJson(res, 401, { error: 'Not authenticated' });
      return true;
    }
    const file = userFile(auth.userId);
    const data = fs.existsSync(file)
      ? JSON.parse(fs.readFileSync(file, 'utf8'))
      : {};
    sendJson(res, 200, { settings: data.settings || '', savedAt: data.savedAt || 0 });
    return true;
  }

  // --- SYNC POST: overwrite the user's settings blob ---
  if (u.pathname === '/api/sync/push' && req.method === 'POST') {
    const auth = getAuthUser(req);
    if (!auth) {
      sendJson(res, 401, { error: 'Not authenticated' });
      return true;
    }
    const body = await parseBody(req);
    if (typeof body.settings !== 'string' || body.settings.length > 256 * 1024) {
      sendJson(res, 400, { error: 'settings (string, <=256KB) required' });
      return true;
    }
    const file = userFile(auth.userId);
    fs.writeFileSync(file, JSON.stringify({ settings: body.settings, savedAt: Date.now() }));
    sendJson(res, 200, { ok: true, savedAt: Date.now() });
    return true;
  }

  return false;
}

module.exports = { handleSyncRoutes };
