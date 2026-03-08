'use strict';

const { Post } = require('../models');
const videoService = require('../services/videoService');
const config = require('../config');

/**
 * Generate a Grok video script for a post without saving to DB.
 * Body: { subject, style, duration }
 */
async function generateVideoScriptPreview(req, res) {
  const { subject, style, duration } = req.body;

  if (!subject) return res.status(400).json({ error: 'subject is required' });

  const targetDuration = Math.max(
    config.video.minDuration,
    Math.min(config.video.maxDuration, parseInt(duration, 10) || config.video.defaultDuration)
  );

  try {
    const scriptData = await videoService.generateVideoScript(subject, style, targetDuration);
    return res.json(scriptData);
  } catch (err) {
    console.error('[Video] Script generation error:', err.message);
    return res.status(500).json({ error: 'Video script generation failed', details: err.message });
  }
}

/**
 * Generate a video for an existing post and attach it.
 * Params: id (post ID)
 * Body: { duration, voiceoverEnabled, voiceoverStyle, captionsEnabled, provider }
 */
async function generateVideoForPost(req, res) {
  const { duration, voiceoverEnabled = false, voiceoverStyle = 'sarcastic_male', captionsEnabled = true, provider } = req.body;

  const targetDuration = Math.max(
    config.video.minDuration,
    Math.min(config.video.maxDuration, parseInt(duration, 10) || config.video.defaultDuration)
  );

  try {
    let post;
    try {
      post = await Post.findOne({ where: { id: req.params.id, userId: req.user.userId } });
      if (!post) return res.status(404).json({ error: 'Post not found' });
    } catch (dbErr) {
      console.warn('[Video] DB lookup failed:', dbErr.message);
      return res.status(500).json({ error: 'Database error', details: dbErr.message });
    }

    // Step 1: Generate video script via Grok
    const scriptData = await videoService.generateVideoScript(post.subject, post.style, targetDuration);

    // Step 2: Generate voiceover if requested
    let audioUrl = null;
    if (voiceoverEnabled && scriptData.voiceoverScript) {
      const ttsResult = await videoService.generateVoiceover(scriptData.voiceoverScript, {
        voiceStyle: voiceoverStyle,
      });
      audioUrl = ttsResult.audioUrl;
    }

    // Step 3: Create video via AI provider
    const videoResult = await videoService.createVideoFromScript(scriptData, {
      provider: provider || config.video.defaultProvider,
    });

    const publicVideoUrl = await videoService.uploadVideoToStorage(
      videoResult.videoUrl,
      `post-${post.id}-video.mp4`
    );

    // Step 4: Update post record
    try {
      await Post.update(
        {
          videoEnabled: true,
          videoUrl: publicVideoUrl,
          videoDuration: targetDuration,
          voiceoverEnabled,
          voiceoverStyle,
          captionsEnabled,
          videoScript: scriptData.videoScript,
          videoProvider: videoResult.provider,
        },
        { where: { id: req.params.id } }
      );
      const updatedPost = await Post.findByPk(req.params.id);

      return res.json({
        post: updatedPost,
        scriptData,
        videoResult: { ...videoResult, publicUrl: publicVideoUrl },
        audioUrl,
      });
    } catch (dbErr) {
      console.warn('[Video] DB update failed:', dbErr.message);
      // Return result even if DB update fails
      return res.json({
        post: { id: post.id, videoUrl: publicVideoUrl, videoScript: scriptData.videoScript },
        scriptData,
        videoResult: { ...videoResult, publicUrl: publicVideoUrl },
        audioUrl,
      });
    }
  } catch (err) {
    console.error('[Video] Generate video error:', err.message);
    return res.status(500).json({ error: 'Video generation failed', details: err.message });
  }
}

module.exports = { generateVideoScriptPreview, generateVideoForPost };
