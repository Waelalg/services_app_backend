import path from 'path';
import { StatusCodes } from 'http-status-codes';
import { cloudinary } from '../config/cloudinary.js';
import { env } from '../config/env.js';
import { AppError } from '../errors/app-error.js';

function ensureCloudinaryConfigured() {
  if (!env.cloudinaryUrl) {
    throw new AppError(
      'Image storage is not configured. Set CLOUDINARY_URL before uploading files.',
      StatusCodes.SERVICE_UNAVAILABLE
    );
  }
}

function sanitizeBaseName(filename) {
  return (
    path
      .basename(filename || 'image', path.extname(filename || ''))
      .replace(/[^a-zA-Z0-9-_]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 80) || 'image'
  );
}

function buildFolder(folder) {
  return [env.cloudinaryUploadFolder, folder].filter(Boolean).join('/');
}

export async function uploadImageFile(file, { folder }) {
  ensureCloudinaryConfigured();

  if (!file?.buffer?.length) {
    throw new AppError('Uploaded image payload is empty', StatusCodes.BAD_REQUEST);
  }

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: buildFolder(folder),
        resource_type: 'image',
        use_filename: true,
        unique_filename: true,
        overwrite: false,
        filename_override: sanitizeBaseName(file.originalname)
      },
      (error, result) => {
        if (error) {
          reject(new AppError('Image upload failed. Please try again.', StatusCodes.BAD_GATEWAY));
          return;
        }

        resolve({
          imageUrl: result.secure_url,
          publicId: result.public_id
        });
      }
    );

    stream.end(file.buffer);
  });
}

export async function uploadImageFiles(files, options) {
  return Promise.all((files || []).map((file) => uploadImageFile(file, options)));
}

export function extractCloudinaryPublicId(imageUrl) {
  if (!imageUrl) {
    return null;
  }

  try {
    const parsed = new URL(imageUrl);

    if (!parsed.hostname.includes('cloudinary.com')) {
      return null;
    }

    const marker = '/upload/';
    const markerIndex = parsed.pathname.indexOf(marker);

    if (markerIndex === -1) {
      return null;
    }

    let publicPath = parsed.pathname.slice(markerIndex + marker.length);
    publicPath = publicPath.replace(/^v\d+\//, '');

    if (!publicPath) {
      return null;
    }

    return publicPath.replace(/\.[^.\/]+$/, '');
  } catch {
    return null;
  }
}

export async function destroyUploadedAssets(publicIds) {
  if (!env.cloudinaryUrl) {
    return;
  }

  const ids = [...new Set((publicIds || []).filter(Boolean))];

  if (!ids.length) {
    return;
  }

  await Promise.allSettled(
    ids.map((publicId) =>
      cloudinary.uploader.destroy(publicId, {
        resource_type: 'image',
        invalidate: true
      })
    )
  );
}
