'use strict';

jest.mock('axios');

const axios = require('axios');
const threadsService = require('../src/services/threadsService');

describe('threadsService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createMediaContainer', () => {
    test('calls Threads API with correct params and returns container id', async () => {
      axios.post.mockResolvedValueOnce({ data: { id: 'container-123' } });

      const result = await threadsService.createMediaContainer(
        'user-456',
        'token-abc',
        { text: 'Hello Threads!', mediaType: 'TEXT' }
      );

      expect(axios.post).toHaveBeenCalledWith(
        'https://graph.threads.net/v1.0/user-456/threads',
        null,
        expect.objectContaining({
          params: expect.objectContaining({
            media_type: 'TEXT',
            text: 'Hello Threads!',
            access_token: 'token-abc',
          }),
        })
      );
      expect(result).toEqual({ id: 'container-123' });
    });

    test('sets media_type to IMAGE when imageUrl is provided', async () => {
      axios.post.mockResolvedValueOnce({ data: { id: 'container-img-789' } });

      await threadsService.createMediaContainer(
        'user-456',
        'token-abc',
        { text: 'With image', imageUrl: 'https://example.com/img.jpg' }
      );

      expect(axios.post).toHaveBeenCalledWith(
        expect.any(String),
        null,
        expect.objectContaining({
          params: expect.objectContaining({ media_type: 'IMAGE' }),
        })
      );
    });

    test('retries on 429 rate limit error', async () => {
      const rateLimitError = { response: { status: 429 } };
      axios.post
        .mockRejectedValueOnce(rateLimitError)
        .mockResolvedValueOnce({ data: { id: 'container-retry' } });

      const result = await threadsService.createMediaContainer('u', 'tok', { text: 'test' });
      expect(result).toEqual({ id: 'container-retry' });
      expect(axios.post).toHaveBeenCalledTimes(2);
    });

    test('throws non-retriable errors immediately', async () => {
      const clientError = { response: { status: 400, data: { error: 'bad request' } } };
      axios.post.mockRejectedValueOnce(clientError);

      await expect(
        threadsService.createMediaContainer('u', 'tok', { text: 'bad' })
      ).rejects.toEqual(clientError);
      expect(axios.post).toHaveBeenCalledTimes(1);
    });
  });

  describe('publishContainer', () => {
    test('calls threads_publish endpoint with containerId', async () => {
      axios.post.mockResolvedValueOnce({ data: { id: 'post-999' } });

      const result = await threadsService.publishContainer('user-1', 'tok', 'container-123');

      expect(axios.post).toHaveBeenCalledWith(
        'https://graph.threads.net/v1.0/user-1/threads_publish',
        null,
        expect.objectContaining({
          params: expect.objectContaining({
            creation_id: 'container-123',
            access_token: 'tok',
          }),
        })
      );
      expect(result).toEqual({ id: 'post-999' });
    });

    test('retries on 500 server error', async () => {
      const serverError = { response: { status: 500 } };
      axios.post
        .mockRejectedValueOnce(serverError)
        .mockResolvedValueOnce({ data: { id: 'post-retry' } });

      const result = await threadsService.publishContainer('u', 'tok', 'c-id');
      expect(result).toEqual({ id: 'post-retry' });
    });
  });

  describe('getUserProfile', () => {
    test('fetches user profile from /me endpoint', async () => {
      const mockProfile = { id: 'threads-user-1', username: 'testuser', threads_profile_picture_url: 'https://pic.url' };
      axios.get.mockResolvedValueOnce({ data: mockProfile });

      const result = await threadsService.getUserProfile('my-token');
      expect(axios.get).toHaveBeenCalledWith(
        'https://graph.threads.net/v1.0/me',
        expect.objectContaining({
          params: expect.objectContaining({ access_token: 'my-token' }),
        })
      );
      expect(result).toEqual(mockProfile);
    });
  });
});
