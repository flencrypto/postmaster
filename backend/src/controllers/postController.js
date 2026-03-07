'use strict';

const grokService = require('../services/grokService');
const schedulerService = require('../services/schedulerService');
const threadsService = require('../services/threadsService');
const config = require('../config');

const MAX_POSTS_HARD_LIMIT = 10;

/**
 * Create a new post draft.
 * Body: { subject, style, templateType, scheduledAt, maxPosts, followUpEnabled, imageStyle }
 */
async function createPost(req, res) {
  const { subject, style, templateType, scheduledAt, maxPosts, followUpEnabled } = req.body;

  if (!subject) return res.status(400).json({ error: 'subject is required' });

  if (maxPosts && maxPosts > MAX_POSTS_HARD_LIMIT) {
    return res.status(400).json({ error: `maxPosts cannot exceed ${MAX_POSTS_HARD_LIMIT}` });
  }

  const warnings = [];
  if (maxPosts && maxPosts > config.maxPostsPerDay) {
    warnings.push(`maxPosts (${maxPosts}) exceeds recommended daily limit of ${config.maxPostsPerDay}`);
  }

  try {
    const { Post } = require('../models');
    const post = await Post.create({
      userId: req.user.userId,
      subject,
      style,
      status: 'draft',
      scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
      maxPosts: maxPosts || 1,
      followUpEnabled: followUpEnabled || false,
    });

    return res.status(201).json({ post, warnings });
  } catch (err) {
    console.error('[Post] Create post error:', err.message);
    return res.status(500).json({ error: 'Failed to create post', details: err.message });
  }
}

/**
 * Full pipeline: generate content via Grok, save post, and schedule it.
 * Body: { subject, style, templateType, scheduledAt, maxPosts, followUpEnabled }
 */
async function generateAndSchedule(req, res) {
  const { subject, style, templateType = 'basic_insight', scheduledAt, maxPosts, followUpEnabled } = req.body;

  if (!subject) return res.status(400).json({ error: 'subject is required' });

  try {
    // Step 1: Generate content
    const generated = await grokService.generateContent(subject, style, templateType);

    // Step 2: Determine schedule time
    const scheduleTime = scheduledAt
      ? new Date(scheduledAt)
      : schedulerService.getNextOptimalSlot('GMT', 0, maxPosts || config.maxPostsPerDay);

    // Step 3: Persist post
    let post;
    let jobInfo = null;
    try {
      const { Post, ScheduledJob } = require('../models');
      post = await Post.create({
        userId: req.user.userId,
        subject,
        style,
        postText: generated.postText,
        hashtags: generated.overallHashtags || [],
        status: 'scheduled',
        scheduledAt: scheduleTime,
        maxPosts: maxPosts || 1,
        followUpEnabled: followUpEnabled || false,
      });

      // Step 4: Queue job
      jobInfo = await schedulerService.schedulePost(post.id, scheduleTime);
      if (jobInfo) {
        await ScheduledJob.create({
          postId: post.id,
          bullmqJobId: jobInfo.jobId,
          queueName: 'posts',
          status: 'pending',
        });
      }
    } catch (dbErr) {
      console.warn('[Post] DB operation failed:', dbErr.message);
      post = { id: 'no-db', subject, postText: generated.postText, status: 'generated' };
    }

    return res.status(201).json({ post, generated, scheduledAt: scheduleTime, jobInfo });
  } catch (err) {
    console.error('[Post] Generate and schedule error:', err.message);
    return res.status(500).json({ error: 'Pipeline failed', details: err.message });
  }
}

/**
 * List user's posts with pagination.
 * Query: ?page=1&limit=20&status=scheduled
 */
async function listPosts(req, res) {
  const { page = 1, limit = 20, status } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  try {
    const { Post } = require('../models');
    const where = { userId: req.user.userId };
    if (status) where.status = status;

    const { rows, count } = await Post.findAndCountAll({
      where,
      limit: parseInt(limit),
      offset,
      order: [['createdAt', 'DESC']],
    });

    return res.json({
      posts: rows,
      total: count,
      page: parseInt(page),
      totalPages: Math.ceil(count / parseInt(limit)),
    });
  } catch (err) {
    console.error('[Post] List posts error:', err.message);
    return res.status(500).json({ error: 'Failed to list posts', details: err.message });
  }
}

/**
 * Get a single post by ID.
 */
async function getPost(req, res) {
  try {
    const { Post } = require('../models');
    const post = await Post.findOne({ where: { id: req.params.id, userId: req.user.userId } });
    if (!post) return res.status(404).json({ error: 'Post not found' });
    return res.json(post);
  } catch (err) {
    console.error('[Post] Get post error:', err.message);
    return res.status(500).json({ error: 'Failed to fetch post', details: err.message });
  }
}

/**
 * Approve a draft post for publishing.
 */
async function approvePost(req, res) {
  try {
    const { Post } = require('../models');
    const post = await Post.findOne({ where: { id: req.params.id, userId: req.user.userId } });
    if (!post) return res.status(404).json({ error: 'Post not found' });
    if (post.status !== 'draft') return res.status(400).json({ error: 'Only draft posts can be approved' });

    const scheduleTime = post.scheduledAt || schedulerService.getNextOptimalSlot('GMT', 0, config.maxPostsPerDay);
    await post.update({ status: 'scheduled', scheduledAt: scheduleTime });

    const jobInfo = await schedulerService.schedulePost(post.id, scheduleTime);
    if (jobInfo) {
      const { ScheduledJob } = require('../models');
      await ScheduledJob.create({ postId: post.id, bullmqJobId: jobInfo.jobId, queueName: 'posts', status: 'pending' });
    }

    return res.json({ post, scheduledAt: scheduleTime });
  } catch (err) {
    console.error('[Post] Approve post error:', err.message);
    return res.status(500).json({ error: 'Failed to approve post', details: err.message });
  }
}

/**
 * Immediately publish a post via Threads API.
 */
async function publishNow(req, res) {
  try {
    const { Post, User } = require('../models');
    const post = await Post.findOne({ where: { id: req.params.id, userId: req.user.userId } });
    if (!post) return res.status(404).json({ error: 'Post not found' });

    const user = await User.findByPk(req.user.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const result = await threadsService.createThreadPost(
      user.threadsUserId,
      user.accessToken,
      { text: post.postText }
    );

    await post.update({ status: 'published', publishedAt: new Date(), threadPostId: result.postId });

    return res.json({ post, result });
  } catch (err) {
    console.error('[Post] Publish now error:', err.message);
    try {
      const { Post } = require('../models');
      await Post.update({ status: 'failed', errorMessage: err.message }, { where: { id: req.params.id } });
    } catch (_) {}
    return res.status(500).json({ error: 'Failed to publish post', details: err.message });
  }
}

module.exports = { createPost, generateAndSchedule, listPosts, getPost, approvePost, publishNow };
