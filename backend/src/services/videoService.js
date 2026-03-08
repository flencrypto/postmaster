'use strict';

const axios = require('axios');
const config = require('../config');

/**
 * Grok prompt template for generating a structured 30-second vertical video script.
 * Injected with {{SUBJECT}}, {{STYLE}}, {{DURATION}}.
 */
const VIDEO_SCRIPT_TEMPLATE = `Generate a {{DURATION}}-second vertical 9:16 video script for Threads on "{{SUBJECT}}".
Tone: {{STYLE}}.
Structure:
- 0–3s: Brutal hook text overlay + strong visual (bold caption, attention-grabbing scene)
- 3–{{MID_POINT}}s: Key points with meme transitions, text pops, fast cuts (sound-off friendly bold captions)
- {{MID_POINT}}–{{DURATION}}s: Polarizing CTA question + freeze-frame or outro visual
Style notes: dark humor acceptable, fast cuts, bold captions (80%+ watch muted), optional voiceover script, sound-off friendly.
Output:
VIDEO SCRIPT:
[Scene-by-scene description]
VOICEOVER SCRIPT:
[Optional spoken script matching the scenes]
CAPTION TEXT:
[Bold on-screen text overlays, one per scene]
VIDEO HOOK:
[First 1-3 second attention grabber description]`;

/**
 * Parse a Grok video script response into a structured object.
 * @param {string} text - Raw Grok API response
 * @returns {{ videoScript: string, voiceoverScript: string, captionText: string[], videoHook: string }}
 */
function parseVideoScriptResponse(text) {
  const result = {
    videoScript: '',
    voiceoverScript: '',
    captionText: [],
    videoHook: '',
  };

  if (!text) return result;

  // Extract VIDEO SCRIPT section
  const scriptMatch = text.match(/VIDEO SCRIPT:\s*([\s\S]*?)(?=\nVOICEOVER SCRIPT:|\nCAPTION TEXT:|\nVIDEO HOOK:|$)/i);
  if (scriptMatch) {
    result.videoScript = scriptMatch[1].trim().replace(/^\[|\]$/g, '').trim();
  }

  // Extract VOICEOVER SCRIPT section
  const voiceoverMatch = text.match(/VOICEOVER SCRIPT:\s*([\s\S]*?)(?=\nCAPTION TEXT:|\nVIDEO HOOK:|$)/i);
  if (voiceoverMatch) {
    result.voiceoverScript = voiceoverMatch[1].trim().replace(/^\[|\]$/g, '').trim();
  }

  // Extract CAPTION TEXT (one caption per line)
  const captionMatch = text.match(/CAPTION TEXT:\s*([\s\S]*?)(?=\nVIDEO HOOK:|$)/i);
  if (captionMatch) {
    result.captionText = captionMatch[1]
      .split('\n')
      .map(l => l.replace(/^[-\d.)\s]+/, '').trim().replace(/^\[|\]$/g, '').trim())
      .filter(l => l.length > 0);
  }

  // Extract VIDEO HOOK
  const hookMatch = text.match(/VIDEO HOOK:\s*([\s\S]*?)$/i);
  if (hookMatch) {
    result.videoHook = hookMatch[1].trim().replace(/^\[|\]$/g, '').trim();
  }

  return result;
}

/**
 * Generate a video script via Grok.
 * @param {string} subject - Topic/subject for the video
 * @param {string} style - Writing style/tone
 * @param {number} duration - Video duration in seconds (15–90)
 * @returns {Promise<{ videoScript, voiceoverScript, captionText, videoHook, rawResponse }>}
 */
async function generateVideoScript(subject, style, duration = 30) {
  const clampedDuration = Math.max(15, Math.min(90, duration));
  const midPoint = Math.round(clampedDuration * 0.65);

  const prompt = VIDEO_SCRIPT_TEMPLATE
    .replace(/\{\{SUBJECT\}\}/g, subject)
    .replace(/\{\{STYLE\}\}/g, style || 'conversational tech-expert')
    .replace(/\{\{DURATION\}\}/g, clampedDuration)
    .replace(/\{\{MID_POINT\}\}/g, midPoint);

  const response = await axios.post(
    config.xai.apiUrl,
    {
      model: config.xai.model,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 1024,
      temperature: 0.8,
    },
    {
      headers: {
        Authorization: `Bearer ${config.xai.apiKey}`,
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    }
  );

  const rawText = response.data.choices[0]?.message?.content || '';
  const parsed = parseVideoScriptResponse(rawText);

  return { ...parsed, rawResponse: rawText, subject, style, duration: clampedDuration };
}

/**
 * Generate a video using an AI video generation API.
 * Supports multiple providers: runway, pika, kling, luma.
 * Falls back to a placeholder URL if no API key is configured.
 *
 * @param {object} scriptData - Output from generateVideoScript
 * @param {object} options - { provider, apiKey, aspectRatio, resolution }
 * @returns {Promise<{ videoUrl: string, provider: string, status: string }>}
 */
async function createVideoFromScript(scriptData, options = {}) {
  const {
    provider = config.video.defaultProvider,
    aspectRatio = '9:16',
    resolution = '1080x1920',
  } = options;

  const apiKey = options.apiKey || config.video.apiKey;

  if (!apiKey) {
    console.warn(`[VideoService] No API key for provider "${provider}". Returning placeholder.`);
    return {
      videoUrl: `https://your-storage.example.com/placeholder-video-${Date.now()}.mp4`,
      provider: 'placeholder',
      status: 'placeholder',
    };
  }

  try {
    switch (provider) {
      case 'runway': {
        // Runway ML Gen-3 Alpha — https://docs.dev.runwayml.com/
        const res = await axios.post(
          'https://api.dev.runwayml.com/v1/image_to_video',
          {
            promptText: scriptData.videoScript,
            duration: scriptData.duration || 30,
            ratio: aspectRatio,
          },
          {
            headers: {
              Authorization: `Bearer ${apiKey}`,
              'Content-Type': 'application/json',
              'X-Runway-Version': '2024-11-06',
            },
            timeout: 60000,
          }
        );
        return { videoUrl: res.data.output?.[0] || res.data.url, provider: 'runway', status: 'complete' };
      }

      case 'pika': {
        // Pika Labs API — https://pika.art
        const res = await axios.post(
          'https://api.pika.art/generate',
          {
            prompt: scriptData.videoScript,
            options: { aspectRatio, frameRate: 24 },
          },
          {
            headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
            timeout: 60000,
          }
        );
        return { videoUrl: res.data.video?.url, provider: 'pika', status: 'complete' };
      }

      case 'kling': {
        // Kling AI — https://klingai.com
        // NOTE: Kling currently supports up to 10 seconds per generation.
        // We cap the API call at 10s and note this in the response.
        const klingDuration = Math.min(scriptData.duration || 10, 10);
        const res = await axios.post(
          'https://api.klingai.com/v1/videos/text2video',
          {
            prompt: scriptData.videoScript,
            duration: klingDuration,
            aspect_ratio: aspectRatio,
            mode: 'pro',
          },
          {
            headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
            timeout: 120000,
          }
        );
        return {
          videoUrl: res.data.data?.works?.[0]?.video?.url,
          provider: 'kling',
          status: 'complete',
          note: klingDuration < (scriptData.duration || 30)
            ? `Kling capped at ${klingDuration}s (max 10s); full script is ${scriptData.duration}s`
            : undefined,
        };
      }

      case 'luma': {
        // Luma Dream Machine — https://lumalabs.ai
        const res = await axios.post(
          'https://api.lumalabs.ai/dream-machine/v1/generations',
          {
            prompt: scriptData.videoScript,
            aspect_ratio: aspectRatio,
          },
          {
            headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
            timeout: 120000,
          }
        );
        return { videoUrl: res.data.assets?.video, provider: 'luma', status: 'complete' };
      }

      default:
        throw new Error(`Unknown video provider: ${provider}`);
    }
  } catch (err) {
    console.error(`[VideoService] Video generation failed (${provider}):`, err.message);
    // Fallback: return placeholder so the rest of the pipeline does not break
    return {
      videoUrl: `https://your-storage.example.com/fallback-video-${Date.now()}.mp4`,
      provider: 'fallback',
      status: 'failed',
      error: err.message,
    };
  }
}

/**
 * Generate a TTS voiceover from text.
 * Uses ElevenLabs or PlayHT; falls back to placeholder if no key.
 *
 * @param {string} script - Voiceover script text
 * @param {object} options - { provider, voiceStyle, apiKey }
 * @returns {Promise<{ audioUrl: string, provider: string }>}
 */
async function generateVoiceover(script, options = {}) {
  const {
    provider = 'elevenlabs',
    voiceStyle = 'sarcastic_male',
    apiKey = config.video.elevenLabsApiKey,
  } = options;

  if (!apiKey) {
    console.warn('[VideoService] No TTS API key configured. Returning placeholder audio URL.');
    return {
      audioUrl: `https://your-storage.example.com/placeholder-audio-${Date.now()}.mp3`,
      provider: 'placeholder',
    };
  }

  // ElevenLabs voice IDs for different styles (common voice IDs)
  const VOICE_MAP = {
    sarcastic_male: 'TxGEqnHWrfWFTfGW9XjX',   // Josh
    sarcastic_female: 'EXAVITQu4vr4xnSDxMaL',  // Bella
    professional_male: 'pNInz6obpgDQGcFmaJgB',  // Adam
    professional_female: 'ThT5KcBeYPX3keUQqHPh', // Dorothy
  };

  try {
    if (provider === 'elevenlabs') {
      const voiceId = VOICE_MAP[voiceStyle] || VOICE_MAP.sarcastic_male;
      const res = await axios.post(
        `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
        {
          text: script,
          model_id: 'eleven_monolingual_v1',
          voice_settings: { stability: 0.4, similarity_boost: 0.75 },
        },
        {
          headers: {
            'xi-api-key': apiKey,
            'Content-Type': 'application/json',
            Accept: 'audio/mpeg',
          },
          responseType: 'arraybuffer',
          timeout: 30000,
        }
      );
      // TODO: upload audio buffer to S3 and return public URL
      console.warn('[VideoService] ElevenLabs audio received; S3 upload not yet implemented.');
      return {
        audioUrl: `https://your-storage.example.com/tts-${Date.now()}.mp3`,
        provider: 'elevenlabs',
        note: 'Audio buffer received; upload to storage required',
      };
    }

    throw new Error(`Unsupported TTS provider: ${provider}`);
  } catch (err) {
    console.error('[VideoService] TTS generation failed:', err.message);
    return {
      audioUrl: `https://your-storage.example.com/tts-fallback-${Date.now()}.mp3`,
      provider: 'fallback',
      error: err.message,
    };
  }
}

/**
 * Upload a video file to cloud storage (S3/GCS placeholder).
 * @param {string} videoUrl - Source video URL to re-upload
 * @param {string} filename - Desired filename
 * @returns {Promise<string>} Public storage URL
 */
async function uploadVideoToStorage(videoUrl, filename) {
  // TODO: implement actual upload via AWS SDK (@aws-sdk/client-s3) or GCS
  console.warn('[VideoService] uploadVideoToStorage: S3 upload not yet implemented; returning source URL');
  return videoUrl;
}

/**
 * Determine whether a template type benefits from video.
 * Edgy/sarcastic and question types perform best with video.
 * @param {string} templateType
 * @returns {boolean}
 */
function shouldSuggestVideo(templateType) {
  const VIDEO_PREFERRED = [
    'sarcastic_hot_take',
    'sarcastic_question',
    'sarcastic_thread',
    'sarcastic_personal',
    'question_poll',
    'basic_insight',
  ];
  return VIDEO_PREFERRED.includes(templateType);
}

module.exports = {
  generateVideoScript,
  parseVideoScriptResponse,
  createVideoFromScript,
  generateVoiceover,
  uploadVideoToStorage,
  shouldSuggestVideo,
  VIDEO_SCRIPT_TEMPLATE,
};
