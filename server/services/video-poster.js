const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const sharp = require('sharp');
const ffmpegPath = require('ffmpeg-static');

const DEFAULT_TIME_OFFSET = '00:00:01';

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function runFfmpeg({ videoDiskPath, outputDiskPath, timeOffset = DEFAULT_TIME_OFFSET }) {
  return new Promise((resolve, reject) => {
    const args = [
      '-y',
      '-ss',
      timeOffset,
      '-i',
      videoDiskPath,
      '-frames:v',
      '1',
      '-q:v',
      '2',
      outputDiskPath
    ];

    const proc = spawn(ffmpegPath, args, { stdio: 'ignore' });

    proc.on('error', reject);
    proc.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`ffmpeg exited with code ${code}`));
      }
    });
  });
}

async function createPosterFromVideo({
  videoDiskPath,
  filenameBase,
  outputDir,
  webBasePath,
  timeOffset = DEFAULT_TIME_OFFSET
}) {
  if (!ffmpegPath) {
    return { image: null, reason: 'ffmpeg-missing' };
  }

  ensureDir(outputDir);

  const thumbnailFilename = `${filenameBase}.jpg`;
  const outputDiskPath = path.join(outputDir, thumbnailFilename);
  const webPath = `${webBasePath}/${thumbnailFilename}`;

  try {
    if (!fs.existsSync(outputDiskPath)) {
      await runFfmpeg({ videoDiskPath, outputDiskPath, timeOffset });
    }

    let metadata = {};
    try {
      metadata = await sharp(outputDiskPath).metadata();
    } catch (error) {
      metadata = {};
    }

    const width = metadata.width || 800;
    const height = metadata.height || 450;

    const image = {
      url: webPath,
      lowRes: webPath,
      highRes: webPath,
      width,
      height,
      alt: 'Video thumbnail'
    };

    return { image, reason: null };
  } catch (error) {
    return { image: null, reason: error.message };
  }
}

module.exports = {
  createPosterFromVideo
};

