import fs from 'fs';
import path from 'path';
import multer from 'multer';
import { StatusCodes } from 'http-status-codes';
import { AppError } from '../errors/app-error.js';

const uploadRoot = path.join(process.cwd(), 'uploads');

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function buildDiskStorage(folderName) {
  const targetDir = path.join(uploadRoot, folderName);
  ensureDir(targetDir);

  return multer.diskStorage({
    destination: (req, file, cb) => cb(null, targetDir),
    filename: (req, file, cb) => {
      const safeBase = path
        .basename(file.originalname, path.extname(file.originalname))
        .replace(/[^a-zA-Z0-9-_]/g, '-')
        .slice(0, 60) || 'image';
      const ext = (path.extname(file.originalname) || '.jpg').toLowerCase();
      cb(null, `${Date.now()}-${safeBase}${ext}`);
    }
  });
}

function imageFileFilter(req, file, cb) {
  if (!file.mimetype.startsWith('image/')) {
    return cb(new AppError('Only image uploads are allowed', StatusCodes.BAD_REQUEST));
  }

  cb(null, true);
}

function createUploader(folderName) {
  return multer({
    storage: buildDiskStorage(folderName),
    fileFilter: imageFileFilter,
    limits: {
      fileSize: 8 * 1024 * 1024
    }
  });
}

export const listingGalleryUpload = createUploader(path.join('listings', 'gallery')).array('images', 10);
export const clientRequestImagesUpload = createUploader(path.join('requests', 'images')).array('images', 6);
export const taxonomyImageUpload = createUploader(path.join('taxonomy', 'images')).single('image');
