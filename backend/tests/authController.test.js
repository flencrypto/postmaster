'use strict';

jest.mock('axios');
jest.mock('../src/services/threadsService');

const axios = require('axios');
const threadsService = require('../src/services/threadsService');

// Provide deterministic config values for tests
process.env.JWT_SECRET = 'test-jwt-secret-32-chars-xxxxxxxxx';
process.env.META_APP_ID = 'test-app-id';
process.env.META_APP_SECRET = 'test-app-secret';
process.env.META_REDIRECT_URI = 'http://localhost:3001/api/auth/threads/callback';
process.env.FRONTEND_URL = 'http://localhost:3000';

// Load authController AFTER env vars are set so config picks them up
const authController = require('../src/controllers/authController');

// ─── helpers ────────────────────────────────────────────────────────────────

/** Build a minimal Express-style mock request */
function mockReq(query = {}, user = null) {
  return { query, user };
}

/** Build a mock Express response that captures the last send/json/redirect call */
function mockRes() {
  const res = {
    _status: 200,
    _body: null,
    _redirect: null,
  };
  res.status = (code) => { res._status = code; return res; };
  res.json = (body) => { res._body = body; return res; };
  res.send = (body) => { res._body = body; return res; };
  res.redirect = (url) => { res._redirect = url; return res; };
  return res;
}

/** Generate a valid state using the same HMAC logic as the controller */
const crypto = require('crypto');
function makeValidState() {
  const random = crypto.randomBytes(16).toString('hex');
  const hmac = crypto
    .createHmac('sha256', process.env.JWT_SECRET)
    .update(random)
    .digest('hex');
  return `${random}.${hmac}`;
}

// ─── initiateOAuth ───────────────────────────────────────────────────────────

describe('initiateOAuth', () => {
  test('redirects to the Threads OAuth authorization URL', async () => {
    const req = mockReq();
    const res = mockRes();

    await authController.initiateOAuth(req, res);

    expect(res._redirect).toMatch(/^https:\/\/threads\.net\/oauth\/authorize\?/);
  });

  test('includes required OAuth query parameters in the redirect URL', async () => {
    const req = mockReq();
    const res = mockRes();

    await authController.initiateOAuth(req, res);

    const url = new URL(res._redirect);
    expect(url.searchParams.get('client_id')).toBe('test-app-id');
    expect(url.searchParams.get('redirect_uri')).toBe('http://localhost:3001/api/auth/threads/callback');
    expect(url.searchParams.get('response_type')).toBe('code');
    expect(url.searchParams.get('scope')).toContain('threads_basic');
  });

  test('includes a state parameter for CSRF protection', async () => {
    const req = mockReq();
    const res = mockRes();

    await authController.initiateOAuth(req, res);

    const url = new URL(res._redirect);
    const state = url.searchParams.get('state');
    expect(state).toBeTruthy();
    // State must contain exactly one dot separating random and HMAC
    expect(state.split('.').length).toBe(2);
  });

  test('generates a different state on each call', async () => {
    const res1 = mockRes();
    const res2 = mockRes();

    await authController.initiateOAuth(mockReq(), res1);
    await authController.initiateOAuth(mockReq(), res2);

    const state1 = new URL(res1._redirect).searchParams.get('state');
    const state2 = new URL(res2._redirect).searchParams.get('state');
    expect(state1).not.toBe(state2);
  });
});

// ─── handleCallback ──────────────────────────────────────────────────────────

describe('handleCallback', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ── error path: provider returned an error ──────────────────────────────

  test('sends oauth_error postMessage when provider returns error param', async () => {
    const req = mockReq({ error: 'access_denied', error_description: 'User denied' });
    const res = mockRes();

    await authController.handleCallback(req, res);

    expect(res._status).toBe(400);
    expect(res._body).toContain('oauth_error');
    expect(res._body).toContain('access_denied');
    // Must be an HTML page, not raw JSON
    expect(res._body).toContain('<!DOCTYPE html>');
    expect(res._body).toContain('postMessage');
  });

  // ── error path: missing code ─────────────────────────────────────────────

  test('sends oauth_error postMessage when authorization code is missing', async () => {
    const req = mockReq({}); // no code, no error
    const res = mockRes();

    await authController.handleCallback(req, res);

    expect(res._status).toBe(400);
    expect(res._body).toContain('oauth_error');
    expect(res._body).toContain('<!DOCTYPE html>');
  });

  // ── error path: invalid / missing state (CSRF protection) ───────────────

  test('sends oauth_error postMessage when state is absent', async () => {
    const req = mockReq({ code: 'valid-code' }); // no state
    const res = mockRes();

    await authController.handleCallback(req, res);

    expect(res._status).toBe(400);
    expect(res._body).toContain('oauth_error');
    expect(res._body).toContain('Invalid state parameter');
  });

  test('sends oauth_error postMessage when state signature is tampered', async () => {
    const validState = makeValidState();
    const tampered = validState.slice(0, -4) + 'ffff'; // corrupt last 2 bytes of HMAC
    const req = mockReq({ code: 'valid-code', state: tampered });
    const res = mockRes();

    await authController.handleCallback(req, res);

    expect(res._status).toBe(400);
    expect(res._body).toContain('oauth_error');
    expect(res._body).toContain('Invalid state parameter');
  });

  test('sends oauth_error postMessage when state has wrong format', async () => {
    const req = mockReq({ code: 'valid-code', state: 'no-dot-here' });
    const res = mockRes();

    await authController.handleCallback(req, res);

    expect(res._status).toBe(400);
    expect(res._body).toContain('oauth_error');
  });

  // ── success path ─────────────────────────────────────────────────────────

  test('sends oauth_success postMessage on successful OAuth exchange', async () => {
    // Arrange mocks
    axios.post.mockResolvedValueOnce({ data: { access_token: 'short-token' } });
    axios.get.mockResolvedValueOnce({ data: { access_token: 'long-token', expires_in: 5183944 } });
    threadsService.getUserProfile.mockResolvedValueOnce({
      id: 'threads-user-1',
      username: 'testuser',
      threads_profile_picture_url: 'https://pic.example.com/avatar.jpg',
    });

    const state = makeValidState();
    const req = mockReq({ code: 'auth-code-123', state });
    const res = mockRes();

    await authController.handleCallback(req, res);

    expect(res._status).toBe(200);
    expect(res._body).toContain('oauth_success');
    expect(res._body).toContain('<!DOCTYPE html>');
    expect(res._body).toContain('postMessage');
  });

  test('sends oauth_error postMessage when token exchange fails', async () => {
    axios.post.mockRejectedValueOnce(new Error('Network error'));

    const state = makeValidState();
    const req = mockReq({ code: 'bad-code', state });
    const res = mockRes();

    await authController.handleCallback(req, res);

    expect(res._status).toBe(500);
    expect(res._body).toContain('oauth_error');
    expect(res._body).toContain('<!DOCTYPE html>');
  });

  // ── postMessage uses configured targetOrigin ──────────────────────────────

  test('postMessage targets the configured FRONTEND_URL', async () => {
    const req = mockReq({ error: 'access_denied' });
    const res = mockRes();

    await authController.handleCallback(req, res);

    // The serialized targetOrigin should appear in the HTML
    expect(res._body).toContain('http://localhost:3000');
  });
});

// ─── logout ──────────────────────────────────────────────────────────────────

describe('logout', () => {
  test('returns 200 with a logout confirmation message', async () => {
    const req = mockReq({}, { userId: 'user-uuid-123' });
    const res = mockRes();

    await authController.logout(req, res);

    expect(res._body).toEqual({ message: 'Logged out successfully' });
  });
});
