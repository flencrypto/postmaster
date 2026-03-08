'use strict';

const {
  parseVideoScriptResponse,
  shouldSuggestVideo,
  VIDEO_SCRIPT_TEMPLATE,
} = require('../src/services/videoService');

describe('parseVideoScriptResponse', () => {
  test('parses VIDEO SCRIPT section', () => {
    const text = [
      'VIDEO SCRIPT:',
      '0-3s: Dark data center render, text overlay "Net-Zero? Cute."',
      '3-20s: Quick cuts: exec yacht vs blacked-out neighborhood',
      '20-30s: Freeze on clown emoji, text "Change my mind below."',
      'VOICEOVER SCRIPT:',
      'Saving the planet one gas plant at a time.',
      'CAPTION TEXT:',
      '- NET-ZERO? CUTE.',
      '- ONE GAS PLANT AT A TIME',
      '- CHANGE MY MIND BELOW',
      'VIDEO HOOK:',
      'Dark render of data center exploding power lines, text flash "NET-ZERO? CUTE."',
    ].join('\n');

    const result = parseVideoScriptResponse(text);
    expect(result.videoScript).toContain('data center');
    expect(result.voiceoverScript).toContain('gas plant');
    expect(result.captionText).toHaveLength(3);
    expect(result.captionText[0]).toContain('NET-ZERO');
    expect(result.videoHook).toContain('power lines');
  });

  test('handles empty input gracefully', () => {
    const result = parseVideoScriptResponse('');
    expect(result.videoScript).toBe('');
    expect(result.voiceoverScript).toBe('');
    expect(result.captionText).toEqual([]);
    expect(result.videoHook).toBe('');
  });

  test('handles null input gracefully', () => {
    const result = parseVideoScriptResponse(null);
    expect(result.videoScript).toBe('');
    expect(result.captionText).toEqual([]);
  });

  test('extracts only VIDEO HOOK when other sections absent', () => {
    const text = 'VIDEO HOOK:\nBold text: "AI ate your power bill"';
    const result = parseVideoScriptResponse(text);
    expect(result.videoHook).toContain('AI ate your power bill');
    expect(result.videoScript).toBe('');
  });

  test('returns partial data when only some sections present', () => {
    const text = 'VIDEO SCRIPT:\nScene: grid explodes\nCAPTION TEXT:\n- GRID DOWN\n- NICE WORK BIG TECH';
    const result = parseVideoScriptResponse(text);
    expect(result.videoScript).toContain('grid explodes');
    expect(result.captionText).toHaveLength(2);
    expect(result.voiceoverScript).toBe('');
  });
});

describe('shouldSuggestVideo', () => {
  test('returns true for sarcastic hot take', () => {
    expect(shouldSuggestVideo('sarcastic_hot_take')).toBe(true);
  });

  test('returns true for question_poll', () => {
    expect(shouldSuggestVideo('question_poll')).toBe(true);
  });

  test('returns true for basic_insight', () => {
    expect(shouldSuggestVideo('basic_insight')).toBe(true);
  });

  test('returns true for sarcastic_thread', () => {
    expect(shouldSuggestVideo('sarcastic_thread')).toBe(true);
  });

  test('returns false for shoutout', () => {
    expect(shouldSuggestVideo('shoutout')).toBe(false);
  });

  test('returns false for personal', () => {
    expect(shouldSuggestVideo('personal')).toBe(false);
  });
});

describe('VIDEO_SCRIPT_TEMPLATE', () => {
  test('contains required placeholders', () => {
    expect(VIDEO_SCRIPT_TEMPLATE).toContain('{{SUBJECT}}');
    expect(VIDEO_SCRIPT_TEMPLATE).toContain('{{STYLE}}');
    expect(VIDEO_SCRIPT_TEMPLATE).toContain('{{DURATION}}');
    expect(VIDEO_SCRIPT_TEMPLATE).toContain('{{MID_POINT}}');
  });

  test('references required output sections', () => {
    expect(VIDEO_SCRIPT_TEMPLATE).toContain('VIDEO SCRIPT:');
    expect(VIDEO_SCRIPT_TEMPLATE).toContain('VOICEOVER SCRIPT:');
    expect(VIDEO_SCRIPT_TEMPLATE).toContain('CAPTION TEXT:');
    expect(VIDEO_SCRIPT_TEMPLATE).toContain('VIDEO HOOK:');
  });

  test('specifies 9:16 vertical format', () => {
    expect(VIDEO_SCRIPT_TEMPLATE).toContain('9:16');
  });
});
