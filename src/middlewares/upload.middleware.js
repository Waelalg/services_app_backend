import multer from 'multer';
import { StatusCodes } from 'http-status-codes';
import { AppError } from '../errors/app-error.js';

function imageFileFilter(req, file, cb) {
  if (!file.mimetype.startsWith('image/')) {
    return cb(new AppError('Only image uploads are allowed', StatusCodes.BAD_REQUEST));
  }

  cb(null, true);
}

function createUploader() {
  return multer({
    storage: multer.memoryStorage(),
    fileFilter: imageFileFilter,
    limits: {
      fileSize: 8 * 1024 * 1024
    }
  });
}

export const listingGalleryUpload = createUploader().array('images', 10);
export const clientRequestImagesUpload = createUploader().array('images', 6);
export const taxonomyImageUpload = createUploader().single('image');
