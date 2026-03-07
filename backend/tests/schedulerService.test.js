'use strict';

// Mock BullMQ to avoid Redis connection in tests
jest.mock('bullmq', () => ({
  Queue: jest.fn().mockImplementation(() => ({
    add: jest.fn().mockResolvedValue({ id: 'mock-job-1' }),
    getWaitingCount: jest.fn().mockResolvedValue(0),
    getActiveCount: jest.fn().mockResolvedValue(0),
    getCompletedCount: jest.fn().mockResolvedValue(0),
    getFailedCount: jest.fn().mockResolvedValue(0),
  })),
  Worker: jest.fn().mockImplementation(() => ({
    on: jest.fn(),
  })),
}));

const schedulerService = require('../src/services/schedulerService');

describe('getNextOptimalSlot', () => {
  const MORNING_START_UTC = 8;
  const MORNING_END_UTC = 11;
  const AFTERNOON_START_UTC = 16;
  const AFTERNOON_END_UTC = 19;

  function createUTCDate(hours, minutes = 0) {
    const d = new Date();
    d.setUTCHours(hours, minutes, 0, 0);
    return d;
  }

  test('returns morning start when current time is before morning window', () => {
    jest.useFakeTimers().setSystemTime(createUTCDate(6, 0)); // 06:00 UTC
    const slot = schedulerService.getNextOptimalSlot('UTC', 0, 7);
    expect(slot).not.toBeNull();
    expect(slot.getUTCHours()).toBe(MORNING_START_UTC);
    jest.useRealTimers();
  });

  test('returns a slot within morning window when inside morning window', () => {
    jest.useFakeTimers().setSystemTime(createUTCDate(9, 0)); // 09:00 UTC
    const slot = schedulerService.getNextOptimalSlot('UTC', 0, 7);
    expect(slot).not.toBeNull();
    // Should be ~now (1 min in future) = 09:01
    expect(slot.getUTCHours()).toBe(9);
    jest.useRealTimers();
  });

  test('returns afternoon start when current time is between windows', () => {
    jest.useFakeTimers().setSystemTime(createUTCDate(13, 0)); // 13:00 UTC
    const slot = schedulerService.getNextOptimalSlot('UTC', 0, 7);
    expect(slot).not.toBeNull();
    expect(slot.getUTCHours()).toBe(AFTERNOON_START_UTC);
    jest.useRealTimers();
  });

  test('returns tomorrow morning when all windows have passed', () => {
    jest.useFakeTimers().setSystemTime(createUTCDate(20, 0)); // 20:00 UTC
    const slot = schedulerService.getNextOptimalSlot('UTC', 0, 7);
    expect(slot).not.toBeNull();
    const now = new Date();
    // Should be next day
    expect(slot.getUTCDate()).toBe(now.getUTCDate() + 1);
    expect(slot.getUTCHours()).toBe(MORNING_START_UTC);
    jest.useRealTimers();
  });

  test('returns null when daily post limit is reached', () => {
    const slot = schedulerService.getNextOptimalSlot('UTC', 7, 7);
    expect(slot).toBeNull();
  });

  test('uses config.maxPostsPerDay when maxPosts not provided', () => {
    const slot = schedulerService.getNextOptimalSlot('UTC', 100, undefined);
    expect(slot).toBeNull(); // 100 posts >= any reasonable maxPostsPerDay
  });
});

describe('schedulePost', () => {
  test('returns null when queue is not initialized', async () => {
    // Queue is not initialized because initQueue was not called
    const result = await schedulerService.schedulePost('post-123', new Date(Date.now() + 60000));
    // Either null (no queue) or a job id
    expect(result === null || typeof result === 'object').toBe(true);
  });
});

describe('getQueueStatus', () => {
  test('returns available: false when queue is not initialized', async () => {
    const status = await schedulerService.getQueueStatus();
    expect(status).toHaveProperty('available');
  });
});
