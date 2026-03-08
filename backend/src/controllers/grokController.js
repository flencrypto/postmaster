'use strict';

const grokService = require('../services/grokService');

/**
 * Generate a content preview using Grok without saving to DB.
 * Body: { subject, style, templateType }
 */
async function generateContent(req, res) {
  const { subject, style, templateType = 'basic_insight' } = req.body;

  if (!subject) return res.status(400).json({ error: 'subject is required' });

  try {
    const generated = await grokService.generateContent(subject, style, templateType);
    return res.json(generated);
  } catch (err) {
    console.error('[Grok] Generate content error:', err.message);
    return res.status(500).json({ error: 'Content generation failed', details: err.message });
  }
}

module.exports = { generateContent };
