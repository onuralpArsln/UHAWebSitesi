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

function sanitizePathSegment(segment) {
  return segment.replace(/[^a-zA-Z0-9._-]/g, '_');
}

function sanitizeRelativePath(value) {
  if (!value) return '';
  const decoded = decodeURIComponent(value).trim();
  if (!decoded) return '';
  const normalized = decoded.replace(/\\/g, '/');
  const parts = normalized
    .split('/')
    .filter(Boolean)
    .map((segment) => sanitizePathSegment(segment));
  return parts.join('/');
}

function resolvePath(relativePath = '') {
  const safeRelative = sanitizeRelativePath(relativePath);
  const absolutePath = path.join(MEDIA_UPLOAD_DIR, safeRelative);
  ensureWithinMediaDir(absolutePath);
  return { absolutePath, relativePath: safeRelative };
}

function ensureWithinMediaDir(absolutePath) {
  if (!absolutePath.startsWith(MEDIA_UPLOAD_DIR)) {
    throw new Error('Geçersiz dosya yolu');
  }
}

function ensureFolderExists(absolutePath) {
  if (!fs.existsSync(absolutePath)) {
    fs.mkdirSync(absolutePath, { recursive: true });
  }
}

function toWebPath(relativePath) {
  if (!relativePath) return MEDIA_WEB_PATH;
  const posixPath = relativePath.split(path.sep).join('/');
  return `${MEDIA_WEB_PATH}/${posixPath
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/')}`;
}

function buildMediaResponse(relativePath, stats) {
  const extension = path.extname(relativePath).slice(1);
  const dir = path.posix.dirname(relativePath);
  const filename = path.posix.basename(relativePath);
  return {
    filename,
    path: relativePath,
    folder: dir === '.' ? '' : dir,
    url: toWebPath(relativePath),
    size: stats.size,
    uploadedAt: stats.birthtime,
    extension
  };
}

function listFolders(relativePath = '') {
  const { absolutePath, relativePath: safeRelative } = resolvePath(relativePath);
  ensureFolderExists(absolutePath);
  const entries = fs.readdirSync(absolutePath, { withFileTypes: true });

  return entries
    .filter((entry) => entry.isDirectory())
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((entry) => {
      const childRelative = safeRelative ? `${safeRelative}/${entry.name}` : entry.name;
      return {
        name: entry.name,
        path: childRelative
      };
    });
}

function buildFolderTree(relativePath = '') {
  const { absolutePath, relativePath: safeRelative } = resolvePath(relativePath);
  ensureFolderExists(absolutePath);
  const entries = fs.readdirSync(absolutePath, { withFileTypes: true });

  const folders = entries
    .filter((entry) => entry.isDirectory())
    .sort((a, b) => a.name.localeCompare(b.name));

  return {
    name: safeRelative ? path.posix.basename(safeRelative) : '',
    path: safeRelative,
    children: folders.map((entry) => {
      const childRelative = safeRelative ? `${safeRelative}/${entry.name}` : entry.name;
      return buildFolderTree(childRelative);
    })
  };
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    try {
      const folderParam = sanitizeRelativePath(req.query.folder || req.body?.folder || '');
      const { absolutePath } = resolvePath(folderParam);
      ensureFolderExists(absolutePath);
      cb(null, absolutePath);
    } catch (error) {
      cb(error);
    }
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

router.get('/', (req, res) => {
  try {
    ensureUploadDir();

    const folderParam = sanitizeRelativePath(req.query.folder || '');
    const search = (req.query.search || '').toString().trim().toLowerCase();

    const { absolutePath, relativePath } = resolvePath(folderParam);
    ensureFolderExists(absolutePath);

    const entries = fs.readdirSync(absolutePath, { withFileTypes: true });
    const now = Date.now();

    const files = entries
      .filter((entry) => entry.isFile())
      .map((entry) => {
        const relativeFilePath = relativePath ? `${relativePath}/${entry.name}` : entry.name;
        const stats = fs.statSync(path.join(absolutePath, entry.name));
        return buildMediaResponse(relativeFilePath, stats);
      })
      .filter((item) => {
        if (!search) return true;
        return item.filename.toLowerCase().includes(search);
      })
      .sort((a, b) => {
        const timeDiff = new Date(b.uploadedAt || now) - new Date(a.uploadedAt || now);
        if (timeDiff !== 0) return timeDiff;
        return a.filename.localeCompare(b.filename);
      });

    const folders = entries
      .filter((entry) => entry.isDirectory())
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((entry) => {
        const childPath = relativePath ? `${relativePath}/${entry.name}` : entry.name;
        return {
          name: entry.name,
          path: childPath
        };
      });

    const breadcrumbs = relativePath
      ? relativePath.split('/').map((segment, index, array) => ({
          name: segment,
          path: array.slice(0, index + 1).join('/')
        }))
      : [];

    const tree = buildFolderTree('');

    res.json({
      media: files,
      folders,
      tree,
      currentFolder: relativePath,
      breadcrumbs
    });
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

    const relativeFilePath = path
      .relative(MEDIA_UPLOAD_DIR, req.file.path)
      .split(path.sep)
      .join('/');

    const stats = fs.statSync(req.file.path);
    const media = buildMediaResponse(relativeFilePath, stats);

    res.status(201).json({
      success: true,
      media
    });
  } catch (error) {
    console.error('CMS Media upload error:', error);
    res.status(500).json({ error: 'Medya dosyası yüklenemedi' });
  }
});

function deleteMedia(relativePath) {
  const { absolutePath } = resolveFilePath(relativePath);

  if (!fs.existsSync(absolutePath) || !fs.statSync(absolutePath).isFile()) {
    const error = new Error('Dosya bulunamadı');
    error.statusCode = 404;
    throw error;
  }

  fs.unlinkSync(absolutePath);
}

router.delete('/', (req, res) => {
  try {
    const { path: rawPath } = req.query;
    if (!rawPath) {
      return res.status(400).json({ error: 'Dosya yolu gerekli' });
    }

    deleteMedia(rawPath);

    res.json({ success: true });
  } catch (error) {
    console.error('CMS Media delete error:', error);
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({ error: error.message || 'Medya dosyası silinemedi' });
  }
});

router.delete('/:filename', (req, res) => {
  try {
    const { filename } = req.params;
    if (!filename) {
      return res.status(400).json({ error: 'Dosya adı gerekli' });
    }

    deleteMedia(filename);

    res.json({ success: true });
  } catch (error) {
    console.error('CMS Media delete error:', error);
    res.status(500).json({ error: 'Medya dosyası silinemedi' });
  }
});

function renameMedia({ path: rawPath, newName, newFolder }) {
  if (!rawPath) {
    const error = new Error('Dosya yolu gerekli');
    error.statusCode = 400;
    throw error;
  }

  if (!newName || typeof newName !== 'string') {
    const error = new Error('Yeni dosya adı gerekli');
    error.statusCode = 400;
    throw error;
  }

  const { absolutePath, relativePath } = resolveFilePath(rawPath);

  if (!fs.existsSync(absolutePath) || !fs.statSync(absolutePath).isFile()) {
    const error = new Error('Dosya bulunamadı');
    error.statusCode = 404;
    throw error;
  }

  const originalExt = path.extname(relativePath);
  const sanitizedNewName = sanitizePathSegment(newName.trim());
  if (!sanitizedNewName) {
    const error = new Error('Geçerli bir dosya adı girin');
    error.statusCode = 400;
    throw error;
  }

  const newExt = path.extname(sanitizedNewName);
  let finalName = sanitizedNewName;

  if (!newExt) {
    finalName = `${sanitizedNewName}${originalExt}`;
  } else if (newExt.toLowerCase() !== originalExt.toLowerCase()) {
    const error = new Error('Dosya uzantısı değiştirilemez');
    error.statusCode = 400;
    throw error;
  }

  const targetFolderRelative = newFolder
    ? sanitizeRelativePath(newFolder)
    : path.posix.dirname(relativePath);

  const {
    absolutePath: targetFolderAbsolute,
    relativePath: targetFolderSafe
  } = resolvePath(targetFolderRelative);
  ensureFolderExists(targetFolderAbsolute);

  const targetRelativePath = targetFolderSafe
    ? `${targetFolderSafe}/${finalName}`
    : finalName;
  const targetAbsolutePath = path.join(targetFolderAbsolute, finalName);
  ensureWithinMediaDir(targetAbsolutePath);

  if (targetAbsolutePath === absolutePath) {
    const stats = fs.statSync(absolutePath);
    return buildMediaResponse(relativePath, stats);
  }

  if (fs.existsSync(targetAbsolutePath)) {
    const error = new Error('Bu ada sahip başka bir dosya zaten mevcut');
    error.statusCode = 409;
    throw error;
  }

  fs.renameSync(absolutePath, targetAbsolutePath);
  const stats = fs.statSync(targetAbsolutePath);
  return buildMediaResponse(targetRelativePath, stats);
}

router.put('/', (req, res) => {
  try {
    const media = renameMedia(req.body || {});
    res.json({ success: true, media });
  } catch (error) {
    console.error('CMS Media rename error:', error);
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({ error: error.message || 'Dosya yeniden adlandırılamadı' });
  }
});

router.put('/:filename', (req, res) => {
  try {
    const { filename } = req.params;
    const { newName } = req.body || {};
    const media = renameMedia({ path: filename, newName });
    res.json({ success: true, media });
  } catch (error) {
    console.error('CMS Media rename error:', error);
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({ error: error.message || 'Dosya yeniden adlandırılamadı' });
  }
});

router.get('/folders/tree', (req, res) => {
  try {
    const tree = buildFolderTree('');
    res.json({ tree });
  } catch (error) {
    console.error('CMS Media folder tree error:', error);
    res.status(500).json({ error: 'Klasörler alınamadı' });
  }
});

router.get('/folders', (req, res) => {
  try {
    const folderParam = sanitizeRelativePath(req.query.folder || '');
    const folders = listFolders(folderParam);
    res.json({ folders });
  } catch (error) {
    console.error('CMS Media folder list error:', error);
    res.status(500).json({ error: 'Klasör listesi alınamadı' });
  }
});

function createFolder({ parent = '', name }) {
  if (!name || typeof name !== 'string') {
    const error = new Error('Klasör adı gerekli');
    error.statusCode = 400;
    throw error;
  }

  const sanitizedName = sanitizePathSegment(name.trim());
  if (!sanitizedName) {
    const error = new Error('Geçerli bir klasör adı girin');
    error.statusCode = 400;
    throw error;
  }

  const { absolutePath: parentAbsolute, relativePath: parentRelative } = resolvePath(parent);
  ensureFolderExists(parentAbsolute);

  const newRelativePath = parentRelative ? `${parentRelative}/${sanitizedName}` : sanitizedName;
  const newAbsolutePath = path.join(parentAbsolute, sanitizedName);
  ensureWithinMediaDir(newAbsolutePath);

  if (fs.existsSync(newAbsolutePath)) {
    const error = new Error('Bu klasör zaten mevcut');
    error.statusCode = 409;
    throw error;
  }

  fs.mkdirSync(newAbsolutePath, { recursive: true });

  return {
    name: sanitizedName,
    path: newRelativePath
  };
}

router.post('/folders', (req, res) => {
  try {
    const folder = createFolder(req.body || {});
    res.status(201).json({ success: true, folder });
  } catch (error) {
    console.error('CMS Media create folder error:', error);
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({ error: error.message || 'Klasör oluşturulamadı' });
  }
});

function renameFolder({ path: rawPath, newName }) {
  if (!rawPath) {
    const error = new Error('Klasör yolu gerekli');
    error.statusCode = 400;
    throw error;
  }

  if (!newName || typeof newName !== 'string') {
    const error = new Error('Yeni klasör adı gerekli');
    error.statusCode = 400;
    throw error;
  }

  const { absolutePath, relativePath } = resolvePath(rawPath);
  if (!relativePath) {
    const error = new Error('Kök klasör yeniden adlandırılamaz');
    error.statusCode = 400;
    throw error;
  }

  if (!fs.existsSync(absolutePath) || !fs.statSync(absolutePath).isDirectory()) {
    const error = new Error('Klasör bulunamadı');
    error.statusCode = 404;
    throw error;
  }

  const sanitizedNewName = sanitizePathSegment(newName.trim());
  if (!sanitizedNewName) {
    const error = new Error('Geçerli bir klasör adı girin');
    error.statusCode = 400;
    throw error;
  }

  const parentRelative = path.posix.dirname(relativePath);
  const { absolutePath: parentAbsolute, relativePath: parentSafe } = resolvePath(
    parentRelative === '.' ? '' : parentRelative
  );

  const newRelativePath = parentSafe ? `${parentSafe}/${sanitizedNewName}` : sanitizedNewName;
  const newAbsolutePath = path.join(parentAbsolute, sanitizedNewName);
  ensureWithinMediaDir(newAbsolutePath);

  if (fs.existsSync(newAbsolutePath)) {
    const error = new Error('Bu adda başka bir klasör zaten mevcut');
    error.statusCode = 409;
    throw error;
  }

  fs.renameSync(absolutePath, newAbsolutePath);

  return {
    name: sanitizedNewName,
    path: newRelativePath
  };
}

router.put('/folders', (req, res) => {
  try {
    const folder = renameFolder(req.body || {});
    res.json({ success: true, folder });
  } catch (error) {
    console.error('CMS Media rename folder error:', error);
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({ error: error.message || 'Klasör yeniden adlandırılamadı' });
  }
});

module.exports = router;

