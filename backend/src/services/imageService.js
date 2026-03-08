'use strict';

const axios = require('axios');
const config = require('../config');

/**
 * Search for images on Unsplash.
 * @param {string} query - Search query
 * @param {number} count - Number of images to return
 * @returns {Promise<Array<{ url: string, altText: string, photographer: string }>>}
 */
async function searchImages(query, count = 3) {
  if (!config.unsplash.accessKey) {
    console.warn('[ImageService] Unsplash API key not configured, returning placeholders');
    return Array.from({ length: count }, (_, i) => ({
      url: `https://via.placeholder.com/800x600?text=${encodeURIComponent(query)}`,
      altText: `${query} image ${i + 1}`,
      photographer: 'Placeholder',
    }));
  }

  try {
    const response = await axios.get(`${config.unsplash.apiUrl}/search/photos`, {
      params: {
        query,
        per_page: count,
        orientation: 'landscape',
      },
      headers: {
        Authorization: `Client-ID ${config.unsplash.accessKey}`,
      },
      timeout: 10000,
    });

    return (response.data.results || []).map(photo => ({
      url: photo.urls?.regular || photo.urls?.small,
      altText: photo.alt_description || query,
      photographer: photo.user?.name || 'Unknown',
    }));
  } catch (err) {
    console.error('[ImageService] Unsplash search failed:', err.message);
    return [];
  }
}

/**
 * Upload an image to S3 (placeholder — returns a mock URL).
 * @param {string} imageUrl - Source image URL
 * @param {string} filename - Desired filename
 * @returns {Promise<string>} Mock S3 URL
 */
async function uploadToS3(imageUrl, filename) {
  // TODO: Implement actual S3 upload using AWS SDK
  console.warn('[ImageService] uploadToS3 is not yet implemented; returning placeholder URL');
  const mockKey = `uploads/${Date.now()}-${filename}`;
  return `https://your-s3-bucket.s3.amazonaws.com/${mockKey}`;
}

module.exports = { searchImages, uploadToS3 };
