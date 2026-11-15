const assert = require('node:assert/strict');
const http = require('node:http');
const test = require('node:test');
const {
  GOOGLE_AUTH_ENDPOINT,
  GOOGLE_TOKEN_ENDPOINT,
  buildAuthorizationUrl,
  createPkcePair,
  isGoogleClientId,
  startGoogleOAuth,
} = require('../google-oauth.js');

test('builds a Google desktop authorization URL with PKCE', () => {
  const { verifier, challenge } = createPkcePair();
  const url = new URL(
    buildAuthorizationUrl({
      clientId: '123456-example.apps.googleusercontent.com',
      redirectUri: 'http://127.0.0.1:54321/oauth/google/callback',
      state: 'secure-state',
      challenge,
    })
  );
  assert.equal(`${url.origin}${url.pathname}`, GOOGLE_AUTH_ENDPOINT);
  assert.equal(url.searchParams.get('response_type'), 'code');
  assert.equal(url.searchParams.get('code_challenge_method'), 'S256');
  assert.equal(url.searchParams.get('code_challenge'), challenge);
  assert.equal(url.searchParams.get('state'), 'secure-state');
  assert.match(verifier, /^[A-Za-z0-9_-]{43,128}$/);
  assert.match(challenge, /^[A-Za-z0-9_-]{43}$/);
});

test('validates Google OAuth client IDs', () => {
  assert.equal(isGoogleClientId('123456-example.apps.googleusercontent.com'), true);
  assert.equal(isGoogleClientId('not-a-client-id'), false);
  assert.equal(isGoogleClientId(''), false);
});

test('completes the loopback OAuth flow and exchanges the code', async () => {
  let tokenRequest = null;
  const result = await startGoogleOAuth({
    clientId: '123456-example.apps.googleusercontent.com',
    clientSecret: 'desktop-client-key',
    timeoutMs: 2000,
    openExternal: async authorizationUrl => {
      const authUrl = new URL(authorizationUrl);
      const callbackUrl = new URL(authUrl.searchParams.get('redirect_uri'));
      callbackUrl.searchParams.set('code', 'authorization-code');
      callbackUrl.searchParams.set('state', authUrl.searchParams.get('state'));
      setImmediate(() => {
        http.get(callbackUrl, response => response.resume());
      });
    },
    fetchImpl: async (url, options) => {
      tokenRequest = { url, options };
      return {
        ok: true,
        json: async () => ({ id_token: 'google-id-token', access_token: 'google-access-token' }),
      };
    },
  });

  assert.deepEqual(result, {
    idToken: 'google-id-token',
    accessToken: 'google-access-token',
  });
  assert.equal(tokenRequest.url, GOOGLE_TOKEN_ENDPOINT);
  assert.equal(tokenRequest.options.body.get('code'), 'authorization-code');
  assert.equal(tokenRequest.options.body.get('client_secret'), 'desktop-client-key');
  assert.ok(tokenRequest.options.body.get('code_verifier'));
});

test('firebase-client gracefully catches credential-already-in-use during anonymous Google login and falls back to signInWithCredential', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const clientCode = fs.readFileSync(path.join(__dirname, '..', 'src', 'firebase-client.js'), 'utf8');

  // Verify linkWithCredential has catch fallback for auth/credential-already-in-use
  assert.match(
    clientCode,
    /current\.linkWithCredential\(googleCredential\)[\s\S]*?catch\s*\((?:linkErr|err)\)\s*\{[\s\S]*?auth\/credential-already-in-use[\s\S]*?signInWithCredential\(googleCredential\)/,
    'signInWithGoogle must catch auth/credential-already-in-use and fall back to signInWithCredential'
  );

  // Verify linkWithPopup has catch fallback for auth/credential-already-in-use
  assert.match(
    clientCode,
    /current\.linkWithPopup\(provider\)[\s\S]*?catch\s*\((?:linkErr|err)\)\s*\{[\s\S]*?auth\/credential-already-in-use[\s\S]*?signInWithPopup\(provider\)/,
    'signInWithGoogle popup mode must catch auth/credential-already-in-use and fall back to signInWithPopup'
  );
});
