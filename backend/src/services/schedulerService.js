'use strict';

const { Queue, Worker } = require('bullmq');
const config = require('../config');

const QUEUE_NAME = 'posts';
let postsQueue = null;
let postsWorker = null;

// Parse "HH:MM" string into { hours, minutes }
function parseTime(timeStr) {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return { hours, minutes };
}

/**
 * Initialize the BullMQ queue. Wrapped in try/catch so Redis being unavailable
 * doesn't crash startup.
 */
function initQueue() {
  try {
    const connection = { url: config.redisUrl };
    postsQueue = new Queue(QUEUE_NAME, { connection });
    console.log('[Scheduler] BullMQ queue initialized');
  } catch (err) {
    console.warn('[Scheduler] Could not initialize BullMQ queue:', err.message);
    postsQueue = null;
  }
}

/**
 * Schedule a post job in BullMQ.
 * @param {string} postId
 * @param {Date|string} scheduledAt
 * @returns {Promise<{jobId: string}|null>}
 */
async function schedulePost(postId, scheduledAt) {
  if (!postsQueue) {
    console.warn('[Scheduler] Queue not available, skipping schedule for post:', postId);
    return null;
  }
  const delay = new Date(scheduledAt).getTime() - Date.now();
  const job = await postsQueue.add(
    'publish-post',
    { postId },
    { delay: Math.max(delay, 0), jobId: `post-${postId}` }
  );
  return { jobId: job.id };
}

/**
 * Calculate the next optimal posting slot within configured windows.
 * @param {string} timezone - IANA timezone string (currently ignored, uses GMT)
 * @param {number} existingPostsToday - Number of posts already scheduled today
 * @param {number} maxPosts - Max allowed posts per day
 * @returns {Date|null} Next optimal slot, or null if daily limit reached
 */
function getNextOptimalSlot(timezone, existingPostsToday, maxPosts) {
  const limit = maxPosts || config.maxPostsPerDay;
  if (existingPostsToday >= limit) return null;

  const now = new Date();
  const windows = [
    config.optimalPostWindows.morning,
    config.optimalPostWindows.afternoon,
  ];

  for (const window of windows) {
    const start = parseTime(window.start);
    const end = parseTime(window.end);

    const windowStart = new Date(now);
    windowStart.setUTCHours(start.hours, start.minutes, 0, 0);

    const windowEnd = new Date(now);
    windowEnd.setUTCHours(end.hours, end.minutes, 0, 0);

    // If we're before the window start, schedule at window start
    if (now < windowStart) {
      return windowStart;
    }
    // If we're within the window, schedule immediately (now)
    if (now >= windowStart && now < windowEnd) {
      return new Date(now.getTime() + 60000); // 1 minute from now
    }
    // Otherwise try next window
  }

  // All windows today have passed — schedule for morning window tomorrow
  const tomorrow = new Date(now);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  const morning = parseTime(config.optimalPostWindows.morning.start);
  tomorrow.setUTCHours(morning.hours, morning.minutes, 0, 0);
  return tomorrow;
}

/**
 * BullMQ worker job processor. Publishes the post via Threads API.
 * @param {import('bullmq').Job} job
 */
async function processPostJob(job) {
  const { postId } = job.data;
  console.log(`[Scheduler] Processing post job for postId: ${postId}`);

  // Import at call time to avoid circular dependencies
  const threadsService = require('./threadsService');

  try {
    // In production this would load post from DB, decrypt token, and publish.
    // Placeholder: log and resolve.
    console.log(`[Scheduler] Would publish post ${postId} via Threads API`);
    return { success: true, postId };
  } catch (err) {
    console.error(`[Scheduler] Failed to process post ${postId}:`, err.message);
    throw err;
  }
}

/**
 * Start the BullMQ worker.
 */
function startWorker() {
  if (!config.redisUrl) return;
  try {
    const connection = { url: config.redisUrl };
    postsWorker = new Worker(QUEUE_NAME, processPostJob, { connection });
    postsWorker.on('completed', job => console.log(`[Scheduler] Job ${job.id} completed`));
    postsWorker.on('failed', (job, err) => console.error(`[Scheduler] Job ${job?.id} failed:`, err.message));
    console.log('[Scheduler] Worker started');
  } catch (err) {
    console.warn('[Scheduler] Could not start worker:', err.message);
  }
}

/**
 * Get current queue stats.
 */
async function getQueueStatus() {
  if (!postsQueue) return { available: false };
  try {
    const [waiting, active, completed, failed] = await Promise.all([
      postsQueue.getWaitingCount(),
      postsQueue.getActiveCount(),
      postsQueue.getCompletedCount(),
      postsQueue.getFailedCount(),
    ]);
    return { available: true, waiting, active, completed, failed };
  } catch (err) {
    return { available: false, error: err.message };
  }
}

module.exports = {
  initQueue,
  startWorker,
  schedulePost,
  getNextOptimalSlot,
  processPostJob,
  getQueueStatus,
  QUEUE_NAME,
};
