'use strict';

const axios = require('axios');

const BASE_URL = 'https://graph.threads.net/v1.0';
const MAX_RETRIES = 3;
const MAX_BACKOFF_MS = 10000; // Cap backoff at 10 seconds

/**
 * Sleep for ms milliseconds.
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Make an API call with exponential backoff retry on rate limit (429) or server errors.
 */
async function apiCallWithRetry(fn, retries = MAX_RETRIES) {
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      const status = err.response?.status;
      // Retry on rate limit or 5xx
      if (status === 429 || (status >= 500 && status < 600)) {
        const backoff = Math.min(Math.pow(2, attempt) * 1000, MAX_BACKOFF_MS);
        await sleep(backoff);
        continue;
      }
      throw err;
    }
  }
  throw lastError;
}

/**
 * Create a Threads media container.
 * @param {string} userId - Threads user ID
 * @param {string} accessToken - Valid access token
 * @param {{ text: string, imageUrl?: string, videoUrl?: string, mediaType?: string, replyToId?: string }} postData
 * @returns {Promise<{ id: string }>}
 */
async function createMediaContainer(userId, accessToken, { text, imageUrl, videoUrl, mediaType = 'TEXT', replyToId }) {
  return apiCallWithRetry(async () => {
    const params = {
      media_type: mediaType,
      access_token: accessToken,
    };
    if (text) params.text = text;
    if (imageUrl) {
      params.image_url = imageUrl;
      params.media_type = 'IMAGE';
    }
    if (videoUrl) {
      params.video_url = videoUrl;
      params.media_type = 'VIDEO';
    }
    if (replyToId) {
      params.reply_to_id = replyToId;
    }

    const response = await axios.post(`${BASE_URL}/${userId}/threads`, null, { params });
    return response.data;
  });
}

/**
 * Publish a Threads media container.
 * @param {string} userId
 * @param {string} accessToken
 * @param {string} containerId
 * @returns {Promise<{ id: string }>}
 */
async function publishContainer(userId, accessToken, containerId) {
  return apiCallWithRetry(async () => {
    const response = await axios.post(`${BASE_URL}/${userId}/threads_publish`, null, {
      params: {
        creation_id: containerId,
        access_token: accessToken,
      },
    });
    return response.data;
  });
}

/**
 * Create and publish a single Threads post.
 * @param {string} userId
 * @param {string} accessToken
 * @param {{ text: string, imageUrl?: string, videoUrl?: string }} postData
 * @returns {Promise<{ containerId: string, postId: string }>}
 */
async function createThreadPost(userId, accessToken, postData) {
  const container = await createMediaContainer(userId, accessToken, postData);
  // Threads requires a short delay between container creation and publishing
  await sleep(500);
  const published = await publishContainer(userId, accessToken, container.id);
  return { containerId: container.id, postId: published.id };
}

/**
 * Create and publish a video post on Threads.
 * @param {string} userId
 * @param {string} accessToken
 * @param {{ text: string, videoUrl: string }} postData
 * @returns {Promise<{ containerId: string, postId: string }>}
 */
async function createVideoPost(userId, accessToken, postData) {
  if (!postData.videoUrl) throw new Error('videoUrl is required for video posts');
  return createThreadPost(userId, accessToken, { ...postData, mediaType: 'VIDEO' });
}

/**
 * Create a reply chain (thread) by posting each item as a reply to the previous.
 * @param {string} userId
 * @param {string} accessToken
 * @param {Array<{ text: string, imageUrl?: string }>} posts
 * @returns {Promise<Array<{ containerId: string, postId: string }>>}
 */
async function createThreadChain(userId, accessToken, posts) {
  const results = [];
  let replyToId = null;

  for (const post of posts) {
    const postData = { ...post };
    if (replyToId) {
      postData.replyToId = replyToId;
    }

    const container = await createMediaContainer(userId, accessToken, postData);
    await sleep(500);
    const published = await publishContainer(userId, accessToken, container.id);

    results.push({ containerId: container.id, postId: published.id });
    replyToId = published.id;
  }

  return results;
}

/**
 * Refresh a long-lived Threads access token.
 * @param {string} accessToken
 * @returns {Promise<{ access_token: string, token_type: string, expires_in: number }>}
 */
async function refreshToken(accessToken) {
  return apiCallWithRetry(async () => {
    const response = await axios.get(`${BASE_URL}/refresh_access_token`, {
      params: {
        grant_type: 'th_refresh_token',
        access_token: accessToken,
      },
    });
    return response.data;
  });
}

/**
 * Get a user's Threads profile.
 * @param {string} accessToken
 * @returns {Promise<{ id: string, username: string, threads_profile_picture_url: string }>}
 */
async function getUserProfile(accessToken) {
  return apiCallWithRetry(async () => {
    const response = await axios.get(`${BASE_URL}/me`, {
      params: {
        fields: 'id,username,threads_profile_picture_url,threads_biography',
        access_token: accessToken,
      },
    });
    return response.data;
  });
}

module.exports = {
  createMediaContainer,
  publishContainer,
  createThreadPost,
  createVideoPost,
  createThreadChain,
  refreshToken,
  getUserProfile,
};
