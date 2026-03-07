'use strict';

const axios = require('axios');
const config = require('../config');

// Prompt templates for each type - subject and style are injected at call time
const PROMPT_TEMPLATES = {
  basic_insight: `You are a sharp, authoritative voice in data centers, AI infrastructure, hyperscale, and green tech. Generate ONE punchy Threads post (100–280 characters) based on this topic: "{{SUBJECT}}". Style/vocab: {{STYLE}}. Rules: Start with a strong hook. Focus on driving replies. End with open question. Use 2–4 relevant hashtags. Suggest 1–3 image descriptions. Output: POST TEXT: [text]\nIMAGE SUGGESTIONS:\n- 1. [desc]\nTHREAD POTENTIAL: Yes/No`,

  question_poll: `Create a high-engagement Threads post (or poll) on: "{{SUBJECT}}". Vocab style: {{STYLE}}. Lead with provocative question. Keep under 280 chars. Add 2–4 niche hashtags. Encourage debate. Suggest poll options if natural. Propose 1–4 visual ideas. Output: POST TEXT: [text]\nPOLL OPTIONS (if yes): [list]\nIMAGE SUGGESTIONS: [1–4 descriptions]`,

  short_thread: `Generate a concise 4–8 post Thread on "{{SUBJECT}}" for Threads. Tone: {{STYLE}}. Structure: Post 1 hook, Posts 2-6 insights, Final post open question. Use 2–4 hashtags total. Suggest images per post. Output: THREAD POSTS:\n1. [text] | IMAGE: [desc]\n...\nFINAL: [text]\nOVERALL HASHTAGS: [list]\nFOLLOW-UP POTENTIAL: Yes/No`,

  shoutout: `Craft a positive, community-building Threads post congratulating or shouting out something related to "{{SUBJECT}}". Style: {{STYLE}}. Genuine praise. Tag sparingly. End with question. 2–3 hashtags. Suggest 1–2 visuals. Output: POST TEXT: [...]\nIMAGE SUGGESTIONS: [...]`,

  personal: `Write a short, humanizing Threads post from a DC/infra insider perspective on "{{SUBJECT}}". Vocab: {{STYLE}}. Share quick personal observation. Hook with question. Drive replies. 2–4 hashtags. Suggest 1–3 candid images. Output: POST TEXT: [...]\nIMAGE SUGGESTIONS: [...]`,

  sarcastic_hot_take: `You are the most sarcastic, done-with-the-BS voice in data centers, AI infra, hyperscale hypocrisy, and green tech fairy tales. Spit out ONE brutally snarky Threads post (100–280 chars) on: "{{SUBJECT}}". Tone: {{STYLE}} but max sarcasm. Hook with pure venom. End with reply-trap question. 2–4 savage hashtags. Suggest 1–3 sarcastic visuals. Output: POST TEXT: [make it burn]\nIMAGE SUGGESTIONS:\n- 1. [desc]\nTHREAD POTENTIAL: Yes/No`,

  sarcastic_question: `Craft a sarcasm-drenched, reply-exploding Threads post or poll on "{{SUBJECT}}". Tone: {{STYLE}} + peak cynical sarcasm. Lead with a loaded sarcastic question. <280 chars. 2–4 biting hashtags. Poll if it fits with ironic options. Suggest 1–4 satirical visuals. Output: POST TEXT: [...]\nPOLL QUESTION/OPTIONS (if natural): [...]\nIMAGE SUGGESTIONS: [...]`,

  sarcastic_thread: `Build a vicious, sarcasm-soaked 4–8 post Thread tearing apart "{{SUBJECT}}" for Threads. Tone: {{STYLE}} + unhinged eye-rolling sarcasm. Post 1 atomic hook, Posts 2-6 numbered takedowns, Closer brutal reply-bait. 2–4 hashtags. Suggest sarcastic visuals. Output: THREAD POSTS:\n1. [text] | IMAGE: [desc]\n...\nFINAL: [savage closer]\nOVERALL HASHTAGS: [...]\nFOLLOW-UP POTENTIAL: Yes/No`,

  sarcastic_shoutout: `Pen a dripping-with-sarcasm 'congrats' Threads post on "{{SUBJECT}}". Tone: {{STYLE}} + fake enthusiasm that flips to mockery. Opener pretends to applaud then guts it. Close with mocking question. 2–3 snarky hashtags. Suggest ironic visuals. Output: POST TEXT: [...]\nIMAGE SUGGESTIONS: [...]`,

  sarcastic_personal: `Drop a raw, sarcasm-overloaded behind-the-scenes Threads post from a burned-out DC/infra vet on "{{SUBJECT}}". Tone: {{STYLE}} + conversational max snark. Hook: 'Real talk...' energy. Share mocking observation. Reply driver. 2–4 hashtags. Suggest gritty-sarcastic visuals. Output: POST TEXT: [...]\nIMAGE SUGGESTIONS: [...]`,
};

/**
 * Parse the raw text response from Grok into a structured object.
 * @param {string} text - Raw Grok API response text
 * @returns {{ postText: string, imageSuggestions: string[], threadPotential: string|null, pollOptions: string[], followUpIdeas: string[] }}
 */
function parseGrokResponse(text) {
  const result = {
    postText: '',
    imageSuggestions: [],
    threadPotential: null,
    pollOptions: [],
    followUpIdeas: [],
    threadPosts: [],
    overallHashtags: [],
  };

  if (!text) return result;

  // Extract POST TEXT
  const postTextMatch = text.match(/POST TEXT:\s*([\s\S]*?)(?=\nIMAGE SUGGESTIONS:|\nPOLL OPTIONS|\nPOLL QUESTION|\nTHREAD POTENTIAL:|$)/i);
  if (postTextMatch) {
    result.postText = postTextMatch[1].trim().replace(/^\[|\]$/g, '').trim();
  }

  // Extract IMAGE SUGGESTIONS (each line starting with - or number)
  const imageSuggestionsMatch = text.match(/IMAGE SUGGESTIONS:\s*([\s\S]*?)(?=\nTHREAD POTENTIAL:|\nPOLL OPTIONS:|\nPOLL QUESTION|\nFOLLOW-UP IDEAS:|\nOVERALL HASHTAGS:|$)/i);
  if (imageSuggestionsMatch) {
    const lines = imageSuggestionsMatch[1].split('\n');
    result.imageSuggestions = lines
      .map(l => l.replace(/^[-\d.)\s]+/, '').trim())
      .filter(l => l.length > 0);
  }

  // Extract THREAD POTENTIAL
  const threadPotentialMatch = text.match(/THREAD POTENTIAL:\s*(Yes|No)/i);
  if (threadPotentialMatch) {
    result.threadPotential = threadPotentialMatch[1];
  }

  // Extract POLL OPTIONS
  const pollOptionsMatch = text.match(/POLL OPTIONS.*?:\s*([\s\S]*?)(?=\nIMAGE SUGGESTIONS:|\nTHREAD POTENTIAL:|$)/i);
  if (pollOptionsMatch) {
    const lines = pollOptionsMatch[1].split('\n');
    result.pollOptions = lines
      .map(l => l.replace(/^[-\d.)\s]+/, '').trim())
      .filter(l => l.length > 0);
  }

  // Extract FOLLOW-UP IDEAS / FOLLOW-UP POTENTIAL
  const followUpMatch = text.match(/FOLLOW-UP(?:\s+(?:IDEAS|POTENTIAL))?:\s*([\s\S]*?)(?=\n[A-Z]|$)/i);
  if (followUpMatch) {
    const val = followUpMatch[1].trim();
    if (val.toLowerCase() === 'yes' || val.toLowerCase() === 'no') {
      result.followUpIdeas = [val];
    } else {
      result.followUpIdeas = val.split('\n')
        .map(l => l.replace(/^[-\d.)\s]+/, '').trim())
        .filter(l => l.length > 0);
    }
  }

  // Extract THREAD POSTS for short_thread / sarcastic_thread types
  const threadPostsMatch = text.match(/THREAD POSTS:\s*([\s\S]*?)(?=\nOVERALL HASHTAGS:|\nFOLLOW-UP POTENTIAL:|$)/i);
  if (threadPostsMatch) {
    const lines = threadPostsMatch[1].split('\n').filter(l => l.trim());
    result.threadPosts = lines.map(l => {
      const parts = l.split('|');
      return {
        text: parts[0].replace(/^\d+\.\s*/, '').trim(),
        image: parts[1] ? parts[1].replace(/^IMAGE:\s*/i, '').trim() : '',
      };
    });
  }

  // Extract OVERALL HASHTAGS
  const hashtagsMatch = text.match(/OVERALL HASHTAGS:\s*([\s\S]*?)(?=\nFOLLOW-UP POTENTIAL:|$)/i);
  if (hashtagsMatch) {
    result.overallHashtags = hashtagsMatch[1]
      .split(/[\s,]+/)
      .map(h => h.trim())
      .filter(h => h.startsWith('#'));
  }

  return result;
}

/**
 * Generate content using xAI Grok API.
 * @param {string} subject - Topic/subject for the post
 * @param {string} style - Writing style/vocabulary hint
 * @param {string} templateType - One of the known template keys
 * @param {object} options - Additional options
 * @returns {Promise<{postText, imageSuggestions, threadPotential, pollOptions, followUpIdeas}>}
 */
async function generateContent(subject, style, templateType = 'basic_insight', options = {}) {
  const template = PROMPT_TEMPLATES[templateType];
  if (!template) {
    throw new Error(`Unknown template type: ${templateType}`);
  }

  const prompt = template
    .replace(/\{\{SUBJECT\}\}/g, subject)
    .replace(/\{\{STYLE\}\}/g, style || 'professional, data-center insider');

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
  const parsed = parseGrokResponse(rawText);

  return {
    ...parsed,
    rawResponse: rawText,
    templateType,
    subject,
    style,
  };
}

module.exports = { generateContent, parseGrokResponse, PROMPT_TEMPLATES };
