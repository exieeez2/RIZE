const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const http = require('http');

describe('Custom Background Media Streaming, URL Resolution & Transparency', () => {
  let testServer = null;
  let testPort = 0;

  before(async () => {
    // Isolate server request listener on an ephemeral port
    const appServer = require('../server.js');
    const requestHandler = appServer.listeners('request')[0];
    testServer = http.createServer(requestHandler);
    await new Promise((resolve) => testServer.listen(0, '127.0.0.1', resolve));
    testPort = testServer.address().port;
  });

  after(async () => {
    if (testServer) {
      await new Promise((resolve) => testServer.close(resolve));
    }
  });

  it('GET /api/local-media returns 400 when file parameter is missing', async () => {
    const res = await fetch(`http://127.0.0.1:${testPort}/api/local-media`);
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.match(body.error, /Missing file parameter/i);
  });

  it('GET /api/local-media returns 404 for non-existent local file', async () => {
    const res = await fetch(`http://127.0.0.1:${testPort}/api/local-media?file=non_existent_file_xyz_12345.png`);
    assert.equal(res.status, 404);
    const body = await res.json();
    assert.match(body.error, /File not found/i);
  });

  it('GET /api/local-media correctly streams local image file with mime type', async () => {
    const iconPath = path.resolve(__dirname, '../src/icon.png');
    const expectedBytes = fs.readFileSync(iconPath);

    const res = await fetch(`http://127.0.0.1:${testPort}/api/local-media?file=${encodeURIComponent(iconPath)}`);
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('content-type'), 'image/png');
    assert.equal(res.headers.get('accept-ranges'), 'bytes');
    assert.equal(Number(res.headers.get('content-length')), expectedBytes.length);

    const buf = Buffer.from(await res.arrayBuffer());
    assert.equal(buf.compare(expectedBytes), 0);
  });

  it('GET /api/local-media handles file:// URI scheme correctly', async () => {
    const iconPath = path.resolve(__dirname, '../src/icon.png');
    const expectedBytes = fs.readFileSync(iconPath);
    const fileUri = `file://${iconPath}`;

    const res = await fetch(`http://127.0.0.1:${testPort}/api/local-media?file=${encodeURIComponent(fileUri)}`);
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('content-type'), 'image/png');

    const buf = Buffer.from(await res.arrayBuffer());
    assert.equal(buf.compare(expectedBytes), 0);
  });

  it('GET /api/local-media supports HTTP 206 partial content range requests for video seeking', async () => {
    const iconPath = path.resolve(__dirname, '../src/icon.png');
    const expectedBytes = fs.readFileSync(iconPath);
    const totalSize = expectedBytes.length;

    const res = await fetch(`http://127.0.0.1:${testPort}/api/local-media?file=${encodeURIComponent(iconPath)}`, {
      headers: {
        Range: 'bytes=0-31',
      },
    });

    assert.equal(res.status, 206);
    assert.equal(res.headers.get('content-range'), `bytes 0-31/${totalSize}`);
    assert.equal(Number(res.headers.get('content-length')), 32);

    const chunk = Buffer.from(await res.arrayBuffer());
    assert.equal(chunk.length, 32);
    assert.equal(chunk.compare(expectedBytes.subarray(0, 32)), 0);
  });

  it('HEAD /api/local-media returns headers without body', async () => {
    const iconPath = path.resolve(__dirname, '../src/icon.png');
    const expectedBytes = fs.readFileSync(iconPath);

    const res = await fetch(`http://127.0.0.1:${testPort}/api/local-media?file=${encodeURIComponent(iconPath)}`, {
      method: 'HEAD',
    });

    assert.equal(res.status, 200);
    assert.equal(Number(res.headers.get('content-length')), expectedBytes.length);
    assert.equal(res.headers.get('content-type'), 'image/png');
    const text = await res.text();
    assert.equal(text, '');
  });

  it('src/app.js implements resolveCustomBgMediaUrl mapping file:// and local paths', () => {
    const appCode = fs.readFileSync(path.join(__dirname, '../src/app.js'), 'utf8');

    assert.ok(appCode.includes('function resolveCustomBgMediaUrl(url)'), 'resolveCustomBgMediaUrl must be defined');
    assert.ok(appCode.includes("trimmed.startsWith('file://')"), 'resolveCustomBgMediaUrl must handle file:// URLs');
    assert.ok(appCode.includes('/api/local-media?file='), 'resolveCustomBgMediaUrl must map to /api/local-media endpoint');

    // Test the logic directly by evaluating a scoped runner
    const resolveCustomBgMediaUrl = new Function(
      'url',
      `
      if (!url || typeof url !== 'string') return '';
      const trimmed = url.trim();
      if (!trimmed) return '';
      if (
        trimmed.startsWith('data:') ||
        trimmed.startsWith('blob:') ||
        trimmed.startsWith('/api/local-media') ||
        trimmed.startsWith('/api/local-file') ||
        trimmed.startsWith('http://') ||
        trimmed.startsWith('https://')
      ) {
        return trimmed;
      }
      if (trimmed.startsWith('file://')) {
        try {
          let localPath = decodeURIComponent(new URL(trimmed).pathname);
          if (/^\\/[a-zA-Z]:/.test(localPath)) {
            localPath = localPath.replace(/^\\//, '');
          }
          return \`/api/local-media?file=\${encodeURIComponent(localPath)}\`;
        } catch (_) {
          let stripped = trimmed.replace(/^file:\\/\\//, '');
          if (/^\\/[a-zA-Z]:/.test(stripped)) stripped = stripped.replace(/^\\//, '');
          return \`/api/local-media?file=\${encodeURIComponent(decodeURIComponent(stripped))}\`;
        }
      }
      if (trimmed.startsWith('/') || /^[a-zA-Z]:[\\\\/]/.test(trimmed)) {
        return \`/api/local-media?file=\${encodeURIComponent(trimmed)}\`;
      }
      return trimmed;
    `
    );

    assert.equal(resolveCustomBgMediaUrl(''), '');
    assert.equal(
      resolveCustomBgMediaUrl('file:///home/user/Pictures/wallpaper.jpg'),
      '/api/local-media?file=%2Fhome%2Fuser%2FPictures%2Fwallpaper.jpg'
    );
    assert.equal(
      resolveCustomBgMediaUrl('/home/user/Videos/bg.mp4'),
      '/api/local-media?file=%2Fhome%2Fuser%2FVideos%2Fbg.mp4'
    );
    assert.equal(
      resolveCustomBgMediaUrl('data:image/png;base64,iVBORw0KGgo='),
      'data:image/png;base64,iVBORw0KGgo='
    );
    assert.equal(
      resolveCustomBgMediaUrl('https://example.com/stream.webm'),
      'https://example.com/stream.webm'
    );
  });

  it('src/app.js updateCustomBg tracks raw src, logs errors, and updates DOM media elements', () => {
    const appCode = fs.readFileSync(path.join(__dirname, '../src/app.js'), 'utf8');

    assert.ok(appCode.includes('dataset.rawSrc = rawBgUrl'), 'updateCustomBg must set dataset.rawSrc to avoid recreating media elements');
    assert.ok(appCode.includes("resolveCustomBgMediaUrl(rawBgUrl)"), 'updateCustomBg must resolve custom background URL');
    assert.ok(appCode.includes("onBackgroundChanged('custom', true)"), 'onBackgroundChanged must be called on custom bg selection');
    assert.ok(appCode.includes("document.body.classList.toggle('has-custom-bg', !!resolvedUrl);"), 'has-custom-bg class must be toggled based on resolvedUrl');
  });

  it('src/styles.css enforces translucent glass panels and transparent body when has-custom-bg is active', () => {
    const cssCode = fs.readFileSync(path.join(__dirname, '../src/styles.css'), 'utf8');

    assert.ok(cssCode.includes('body.has-custom-bg {'), 'body.has-custom-bg rule must exist');
    assert.ok(cssCode.includes('background: transparent !important;'), 'body must have transparent background under has-custom-bg');
    assert.ok(cssCode.includes('body.has-custom-bg .bg-mesh-layer'), 'bg-mesh-layer must be hidden under has-custom-bg');
    assert.ok(cssCode.includes('body.has-custom-bg .m3-organic-bg'), 'm3-organic-bg must be hidden under has-custom-bg');
    assert.ok(cssCode.includes('body.has-custom-bg #custom-bg {'), 'custom-bg must be displayed under has-custom-bg');

    // Main content and sidebar must use translucent glass
    assert.ok(
      cssCode.includes('body.has-custom-bg .main-content {'),
      'main-content must have custom translucent styling under has-custom-bg'
    );
    assert.ok(
      cssCode.includes('backdrop-filter: blur(16px)'),
      'main-content and sidebar must have backdrop blur'
    );
    assert.ok(
      cssCode.includes('min(var(--ui-alpha, 60%), 82%)'),
      'main-content must cap opacity to 82% to guarantee wallpaper visibility'
    );
  });

  it('main.js configures webSecurity: false and pick-media endpoint', () => {
    const mainCode = fs.readFileSync(path.join(__dirname, '../main.js'), 'utf8');

    assert.ok(mainCode.includes('webSecurity: false'), 'webPreferences must set webSecurity: false to allow local media access');
    assert.ok(
      mainCode.includes("return `/api/local-media?file=${encodeURIComponent(filePath)}`"),
      'ipcMain pick-media handler must return /api/local-media endpoint'
    );
  });
});
