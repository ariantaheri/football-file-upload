'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const express = require('express');
const multer = require('multer');

const app = express();
app.disable('x-powered-by');
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});
const projectRoot = path.resolve(__dirname, '../..');
const uploadDirectory = path.resolve(
  process.env.UPLOAD_DIR || path.join(__dirname, 'uploads')
);
const port = Number(process.env.PORT) || 3000;
const defaultMaxFileSizeBytes = 25 * 1024 * 1024;
const requestedMaxFileSizeBytes = Number(process.env.MAX_FILE_SIZE_BYTES);
const maxFileSizeBytes = Number.isSafeInteger(requestedMaxFileSizeBytes) && requestedMaxFileSizeBytes > 0
  ? requestedMaxFileSizeBytes
  : defaultMaxFileSizeBytes;
const uploadTimeoutMs = Number(process.env.UPLOAD_TIMEOUT_MS) > 0
  ? Number(process.env.UPLOAD_TIMEOUT_MS)
  : 60_000;

fs.mkdirSync(uploadDirectory, { recursive: true });

const storage = multer.diskStorage({
  destination(_req, _file, callback) {
    callback(null, uploadDirectory);
  },
  filename(_req, file, callback) {
    // Never use a user-supplied filename as the stored path.
    const extension = path.extname(file.originalname)
      .toLowerCase()
      .replace(/[^.a-z0-9]/g, '')
      .slice(0, 12);
    callback(null, `${crypto.randomUUID()}${extension}`);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: maxFileSizeBytes,
    files: 1
  }
});

app.get('/api/health', (_req, res) => {
  res.status(200).json({ status: 'ok' });
});

app.post('/api/upload', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file was received.' });
  }

  // Files are stored outside the public static paths by default.
  return res.status(201).json({
    message: 'Upload received.',
    fileId: path.basename(req.file.filename),
    originalName: req.file.originalname,
    size: req.file.size
  });
});

// Serve the app with uploads enabled. The upload directory is never exposed as a static path.
app.get('/', (_req, res) => {
  res.sendFile(path.join(projectRoot, 'index.html'));
});
app.get('/favicon.svg', (_req, res) => {
  res.sendFile(path.join(projectRoot, 'favicon.svg'));
});
app.get('/src/config.js', (_req, res) => {
  res.type('application/javascript').send(`window.FILE_UPLOAD_CONFIG = Object.freeze(${JSON.stringify({
    uploadEndpoint: '/api/upload',
    maxFileSizeBytes,
    uploadTimeoutMs
  })});`);
});
app.use('/assets', express.static(path.join(projectRoot, 'assets'), {
  dotfiles: 'deny',
  index: false
}));
app.use('/src', express.static(path.join(projectRoot, 'src'), {
  dotfiles: 'deny',
  index: false
}));

app.use((error, _req, res, _next) => {
  if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({
      error: `File exceeds the ${Math.round(maxFileSizeBytes / 1024 / 1024)} MB upload limit.`
    });
  }
  if (error instanceof multer.MulterError) {
    return res.status(400).json({ error: 'The upload request is invalid.' });
  }
  console.error(error);
  return res.status(500).json({ error: 'The upload could not be completed.' });
});

app.listen(port, () => {
  console.log(`Upload demo available at http://localhost:${port}`);
  console.log(`Files are stored in: ${uploadDirectory}`);
  console.log(`Maximum file size: ${Math.round(maxFileSizeBytes / 1024 / 1024)} MB`);
});
