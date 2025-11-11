const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const router = express.Router();

const MEDIA_UPLOAD_DIR = path.join(__dirname, '../../public/uploads/media');
const MEDIA_WEB_PATH = '/uploads/media';

function ensureUploadDir() {
  if (!fs.existsSync(MEDIA_UPLOAD_DIR)) {
    fs.mkdirSync(MEDIA_UPLOAD_DIR, { recursive: true });
  }
}

ensureUploadDir();

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, MEDIA_UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    const sanitizedOriginalName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    const baseName = sanitizedOriginalName.length ? sanitizedOriginalName : 'media';
    cb(null, `${timestamp}-${baseName}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 }
});

function decodeSafeFilename(value) {
  const decoded = decodeURIComponent(value || '');
  const trimmed = decoded.trim();
  if (!trimmed) return '';
  const base = path.basename(trimmed);
  return base.replace(/[^a-zA-Z0-9._-]/g, '_');
}

function ensureWithinMediaDir(absolutePath) {
  if (!absolutePath.startsWith(MEDIA_UPLOAD_DIR)) {
    throw new Error('Geçersiz dosya yolu');
  }
}

function buildMediaResponse(filename) {
  const filePath = path.join(MEDIA_UPLOAD_DIR, filename);
  const stats = fs.statSync(filePath);
  const ext = path.extname(filename).slice(1);
  return {
    filename,
    url: `${MEDIA_WEB_PATH}/${encodeURIComponent(filename)}`,
    size: stats.size,
    uploadedAt: stats.birthtime,
    extension: ext
  };
}

router.get('/', (req, res) => {
  try {
    ensureUploadDir();
    const files = fs
      .readdirSync(MEDIA_UPLOAD_DIR)
      .filter((file) => fs.statSync(path.join(MEDIA_UPLOAD_DIR, file)).isFile())
      .sort((a, b) => fs.statSync(path.join(MEDIA_UPLOAD_DIR, b)).birthtimeMs - fs.statSync(path.join(MEDIA_UPLOAD_DIR, a)).birthtimeMs)
      .map(buildMediaResponse);

    res.json({ media: files });
  } catch (error) {
    console.error('CMS Media list error:', error);
    res.status(500).json({ error: 'Medya dosyaları listelenemedi' });
  }
});

router.post('/upload', upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Yüklenecek dosya bulunamadı' });
    }

    const media = buildMediaResponse(req.file.filename);

    res.status(201).json({
      success: true,
      media
    });
  } catch (error) {
    console.error('CMS Media upload error:', error);
    res.status(500).json({ error: 'Medya dosyası yüklenemedi' });
  }
});

router.delete('/:filename', (req, res) => {
  try {
    const { filename } = req.params;
    if (!filename) {
      return res.status(400).json({ error: 'Dosya adı gerekli' });
    }

    const safeFilename = decodeSafeFilename(filename);
    const absolutePath = path.join(MEDIA_UPLOAD_DIR, safeFilename);
    ensureWithinMediaDir(absolutePath);

    if (!fs.existsSync(absolutePath) || !fs.statSync(absolutePath).isFile()) {
      return res.status(404).json({ error: 'Dosya bulunamadı' });
    }

    fs.unlinkSync(absolutePath);

    res.json({ success: true });
  } catch (error) {
    console.error('CMS Media delete error:', error);
    res.status(500).json({ error: 'Medya dosyası silinemedi' });
  }
});

router.put('/:filename', (req, res) => {
  try {
    const { filename } = req.params;
    const { newName } = req.body || {};

    if (!filename) {
      return res.status(400).json({ error: 'Dosya adı gerekli' });
    }

    if (!newName || typeof newName !== 'string') {
      return res.status(400).json({ error: 'Yeni dosya adı gerekli' });
    }

    const safeFilename = decodeSafeFilename(filename);
    const absolutePath = path.join(MEDIA_UPLOAD_DIR, safeFilename);
    ensureWithinMediaDir(absolutePath);

    if (!fs.existsSync(absolutePath) || !fs.statSync(absolutePath).isFile()) {
      return res.status(404).json({ error: 'Dosya bulunamadı' });
    }

    const originalExt = path.extname(safeFilename);
    const sanitizedNewName = decodeSafeFilename(newName);

    if (!sanitizedNewName) {
      return res.status(400).json({ error: 'Geçerli bir dosya adı girin' });
    }

    const newExt = path.extname(sanitizedNewName);
    let finalFilename = sanitizedNewName;

    if (!newExt) {
      finalFilename = `${sanitizedNewName}${originalExt}`;
    } else if (newExt.toLowerCase() !== originalExt.toLowerCase()) {
      return res.status(400).json({ error: 'Dosya uzantısı değiştirilemez' });
    }

    if (finalFilename === safeFilename) {
      return res.json({ success: true, media: buildMediaResponse(safeFilename) });
    }

    const targetAbsolutePath = path.join(MEDIA_UPLOAD_DIR, finalFilename);
    ensureWithinMediaDir(targetAbsolutePath);

    if (fs.existsSync(targetAbsolutePath)) {
      return res.status(409).json({ error: 'Bu ada sahip başka bir dosya zaten mevcut' });
    }

    fs.renameSync(absolutePath, targetAbsolutePath);

    res.json({
      success: true,
      media: buildMediaResponse(finalFilename)
    });
  } catch (error) {
    console.error('CMS Media rename error:', error);
    const message = error && error.message ? error.message : 'Dosya yeniden adlandırılamadı';
    const statusCode = message === 'Geçersiz dosya yolu' ? 400 : 500;
    res.status(statusCode).json({ error: message });
  }
});

module.exports = router;

