'use strict';

require('dotenv').config();

const config = {
  port: parseInt(process.env.PORT, 10) || 3001,
  nodeEnv: process.env.NODE_ENV || 'development',
  databaseUrl: process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/threadoptimizer',
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  jwtSecret: process.env.JWT_SECRET || '',
  encryptionKey: process.env.ENCRYPTION_KEY || '',
  meta: {
    appId: process.env.META_APP_ID || '',
    appSecret: process.env.META_APP_SECRET || '',
    redirectUri: process.env.META_REDIRECT_URI || 'http://localhost:3001/api/auth/threads/callback',
  },
  xai: {
    apiKey: process.env.XAI_API_KEY || '',
    apiUrl: 'https://api.x.ai/v1/chat/completions',
    model: 'grok-2-1212',
  },
  unsplash: {
    accessKey: process.env.UNSPLASH_ACCESS_KEY || '',
    apiUrl: 'https://api.unsplash.com',
  },
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
  maxPostsPerDay: parseInt(process.env.MAX_POSTS_PER_DAY, 10) || 7,
  optimalPostWindows: {
    morning: { start: '08:00', end: '11:00' },
    afternoon: { start: '16:00', end: '19:00' },
  },
};

// Fail fast in production if critical secrets are not set
if (config.nodeEnv === 'production') {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET environment variable must be set in production');
  }
  if (!process.env.ENCRYPTION_KEY) {
    throw new Error('ENCRYPTION_KEY environment variable must be set in production');
  }
}

module.exports = config;
