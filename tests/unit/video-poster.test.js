const path = require('path');

describe('createPosterFromVideo', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  it('returns null image when ffmpeg is unavailable', async () => {
    jest.doMock('ffmpeg-static', () => null);
    const { createPosterFromVideo } = require('../../server/services/video-poster');

    const result = await createPosterFromVideo({
      videoDiskPath: '',
      filenameBase: 'thumb',
      outputDir: path.join(__dirname, 'tmp'),
      webBasePath: '/uploads/media/rss/video-thumbnails'
    });

    expect(result.image).toBeNull();
    expect(result.reason).toBe('ffmpeg-missing');
  });
});

