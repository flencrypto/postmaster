'use strict';

const { parseGrokResponse, PROMPT_TEMPLATES } = require('../src/services/grokService');

describe('parseGrokResponse', () => {
  test('parses POST TEXT from basic_insight response', () => {
    const text = `POST TEXT: Is your data center ready for 400G? The race to hyperscale just got real. #DataCenter #AI #Hyperscale\nIMAGE SUGGESTIONS:\n- 1. A dense server rack lit with blue LEDs in a dark data center\n- 2. Aerial shot of a hyperscale campus\nTHREAD POTENTIAL: Yes`;
    const result = parseGrokResponse(text);
    expect(result.postText).toBeTruthy();
    expect(result.postText).toContain('400G');
    expect(result.imageSuggestions).toHaveLength(2);
    expect(result.threadPotential).toBe('Yes');
  });

  test('parses POLL OPTIONS from question_poll response', () => {
    const text = `POST TEXT: Will AI inference kill traditional HPC clusters by 2026? Drop your take 👇 #AI #HPC #DataCenter\nPOLL OPTIONS (if yes):\n- Yes, completely replaced\n- No, they'll coexist\n- HPC evolves into AI clusters\nIMAGE SUGGESTIONS:\n- 1. Side-by-side comparison of HPC and GPU cluster racks`;
    const result = parseGrokResponse(text);
    expect(result.pollOptions).toHaveLength(3);
    expect(result.imageSuggestions).toHaveLength(1);
  });

  test('parses THREAD POSTS for short_thread response', () => {
    const text = `THREAD POSTS:\n1. AI training costs are spiraling out of control. Here's why 🧵 | IMAGE: Graph showing GPU costs rising steeply\n2. Power density per rack has gone from 5kW to 50kW in a decade | IMAGE: Heat map of data center floor\nFINAL: What's your org doing to contain AI infra costs? #AI #DataCenter #Hyperscale\nOVERALL HASHTAGS: #AI #DataCenter #Hyperscale\nFOLLOW-UP POTENTIAL: Yes`;
    const result = parseGrokResponse(text);
    expect(result.threadPosts.length).toBeGreaterThanOrEqual(2);
    expect(result.overallHashtags).toContain('#AI');
    expect(result.followUpIdeas).toContain('Yes');
  });

  test('returns empty defaults for empty input', () => {
    const result = parseGrokResponse('');
    expect(result.postText).toBe('');
    expect(result.imageSuggestions).toEqual([]);
    expect(result.threadPotential).toBeNull();
    expect(result.pollOptions).toEqual([]);
    expect(result.followUpIdeas).toEqual([]);
  });

  test('handles malformed response gracefully', () => {
    const result = parseGrokResponse('This is not a structured response at all');
    expect(result.postText).toBe('');
    expect(result).toHaveProperty('imageSuggestions');
  });

  test('all template types exist in PROMPT_TEMPLATES', () => {
    const expectedTypes = [
      'basic_insight', 'question_poll', 'short_thread', 'shoutout', 'personal',
      'sarcastic_hot_take', 'sarcastic_question', 'sarcastic_thread',
      'sarcastic_shoutout', 'sarcastic_personal', 'video_script',
    ];
    expectedTypes.forEach(type => {
      expect(PROMPT_TEMPLATES).toHaveProperty(type);
      expect(typeof PROMPT_TEMPLATES[type]).toBe('string');
    });
  });

  test('prompt templates contain SUBJECT and STYLE placeholders', () => {
    // video_script also has DURATION/MID_POINT — check the rest for SUBJECT/STYLE
    Object.entries(PROMPT_TEMPLATES).forEach(([key, template]) => {
      expect(template).toContain('{{SUBJECT}}');
      expect(template).toContain('{{STYLE}}');
    });
  });
});
