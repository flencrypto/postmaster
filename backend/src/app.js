'use strict';

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const config = require('./config');
const rateLimiter = require('./middleware/rateLimiter');
const authRoutes = require('./routes/auth');
const postRoutes = require('./routes/posts');
const grokRoutes = require('./routes/grok');
const videoRoutes = require('./routes/video');
const schedulerService = require('./services/schedulerService');

const app = express();

// CORS
app.use(cors({
  origin: config.frontendUrl,
  credentials: true,
}));

// Body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rate limiting for all API routes
app.use('/api', rateLimiter);

// Health check (no auth required)
app.get('/health', (req, res) => {
  res.json({ status: 'ok', env: config.nodeEnv, timestamp: new Date().toISOString() });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/grok', grokRoutes);
app.use('/api/video', videoRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('[App] Unhandled error:', err);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

// Initialize scheduler queue (non-blocking — Redis unavailable is handled gracefully)
schedulerService.initQueue();

// Start server and scheduler worker only when run directly (not imported in tests)
if (require.main === module) {
  // Start BullMQ worker so scheduled jobs are processed in this process
  schedulerService.startWorker();
  app.listen(config.port, () => {
    console.log(`[App] ThreadOptimizer backend running on port ${config.port} (${config.nodeEnv})`);
  });
}

module.exports = app;
