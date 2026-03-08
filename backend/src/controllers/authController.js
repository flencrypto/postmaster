'use strict';

const axios = require('axios');
const jwt = require('jsonwebtoken');
const config = require('../config');
const threadsService = require('../services/threadsService');

const META_AUTH_URL = 'https://threads.net/oauth/authorize';
const META_TOKEN_URL = 'https://graph.threads.net/oauth/access_token';
const META_LONG_LIVED_URL = 'https://graph.threads.net/access_token';

/**
 * Redirect user to Meta Threads OAuth authorization page.
 */
async function initiateOAuth(req, res) {
  const params = new URLSearchParams({
    client_id: config.meta.appId,
    redirect_uri: config.meta.redirectUri,
    scope: 'threads_basic,threads_content_publish,threads_manage_replies',
    response_type: 'code',
  });

  return res.redirect(`${META_AUTH_URL}?${params.toString()}`);
}

/**
 * Handle Meta OAuth callback, exchange code for tokens, upsert user.
 */
async function handleCallback(req, res) {
  const { code, error, error_description } = req.query;

  if (error) {
    return res.status(400).json({ error, error_description });
  }
  if (!code) {
    return res.status(400).json({ error: 'No authorization code provided' });
  }

  try {
    // Exchange code for short-lived token
    const tokenResponse = await axios.post(META_TOKEN_URL, null, {
      params: {
        client_id: config.meta.appId,
        client_secret: config.meta.appSecret,
        grant_type: 'authorization_code',
        redirect_uri: config.meta.redirectUri,
        code,
      },
    });

    const { access_token: shortToken } = tokenResponse.data;

    // Exchange for long-lived token
    const longLivedResponse = await axios.get(META_LONG_LIVED_URL, {
      params: {
        grant_type: 'th_exchange_token',
        client_secret: config.meta.appSecret,
        access_token: shortToken,
      },
    });

    const { access_token: longToken, expires_in } = longLivedResponse.data;

    // Fetch user profile
    const profile = await threadsService.getUserProfile(longToken);

    // Upsert user in DB (requires Sequelize models to be initialized)
    // Dynamically require to avoid circular dep and to allow testing without DB
    let user;
    try {
      const { User } = require('../models');
      [user] = await User.findOrCreate({
        where: { threadsUserId: profile.id },
        defaults: {
          accessToken: longToken,
          tokenExpiresAt: new Date(Date.now() + expires_in * 1000),
          username: profile.username,
          profilePic: profile.threads_profile_picture_url,
        },
      });

      if (user) {
        await user.update({
          accessToken: longToken,
          tokenExpiresAt: new Date(Date.now() + expires_in * 1000),
          username: profile.username,
          profilePic: profile.threads_profile_picture_url,
        });
      }
    } catch (dbErr) {
      console.warn('[Auth] DB upsert failed (DB may not be initialized):', dbErr.message);
      user = { id: profile.id, username: profile.username };
    }

    // Issue JWT
    const jwtToken = jwt.sign(
      { userId: user.id, threadsUserId: profile.id, username: profile.username },
      config.jwtSecret,
      { expiresIn: '7d' }
    );

    // Respond with an HTML page that notifies the opener window (popup flow).
    // JSON.stringify handles most special characters; additionally escape <, >, & to prevent
    // any script injection if this page is ever rendered outside the intended context.
    const payload = {
      type: 'oauth_success',
      token: jwtToken,
      user: {
        id: user.id,
        username: profile.username,
        profilePic: profile.threads_profile_picture_url,
      },
    };
    const serializedPayload = JSON.stringify(payload)
      .replace(/</g, '\\u003c')
      .replace(/>/g, '\\u003e')
      .replace(/&/g, '\\u0026');

    // Use the configured frontend URL as targetOrigin to prevent token leakage to other origins.
    const targetOrigin = config.frontendUrl || 'http://localhost:3000';

    return res.status(200).send(`<!DOCTYPE html>
<html>
  <head><meta charset="utf-8" /><title>Authentication Successful</title></head>
  <body>
    <script>
      (function () {
        var data = ${serializedPayload};
        try {
          if (window.opener && !window.opener.closed) {
            window.opener.postMessage(data, ${JSON.stringify(targetOrigin)});
          }
        } catch (e) { /* ignore postMessage errors */ }
        window.close();
      })();
    </script>
  </body>
</html>`);
  } catch (err) {
    console.error('[Auth] OAuth callback error:', err.message);
    return res.status(500).json({ error: 'OAuth authentication failed', details: err.message });
  }
}

/**
 * Refresh a Threads access token.
 */
async function refreshToken(req, res) {
  const { userId } = req.user;
  try {
    const { User } = require('../models');
    const user = await User.findByPk(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const refreshed = await threadsService.refreshToken(user.accessToken);
    await user.update({
      accessToken: refreshed.access_token,
      tokenExpiresAt: new Date(Date.now() + refreshed.expires_in * 1000),
    });

    return res.json({ message: 'Token refreshed successfully' });
  } catch (err) {
    console.error('[Auth] Token refresh error:', err.message);
    return res.status(500).json({ error: 'Token refresh failed', details: err.message });
  }
}

/**
 * Get current user profile.
 */
async function getProfile(req, res) {
  try {
    const { User } = require('../models');
    const user = await User.findByPk(req.user.userId, {
      attributes: ['id', 'threadsUserId', 'username', 'profilePic', 'tokenExpiresAt', 'createdAt'],
    });
    if (!user) return res.status(404).json({ error: 'User not found' });
    return res.json(user);
  } catch (err) {
    console.error('[Auth] Get profile error:', err.message);
    return res.status(500).json({ error: 'Failed to fetch profile' });
  }
}

module.exports = { initiateOAuth, handleCallback, refreshToken, getProfile };
