import { v2 as cloudinary } from 'cloudinary';
import { env } from './env.js';

function parseCloudinaryUrl(urlString) {
  const parsed = new URL(urlString);

  if (parsed.protocol !== 'cloudinary:') {
    throw new Error('CLOUDINARY_URL must use the cloudinary:// scheme');
  }

  if (!parsed.username || !parsed.password || !parsed.hostname) {
    throw new Error('CLOUDINARY_URL is missing the API key, API secret, or cloud name');
  }

  return {
    cloud_name: parsed.hostname,
    api_key: decodeURIComponent(parsed.username),
    api_secret: decodeURIComponent(parsed.password)
  };
}

if (env.cloudinaryUrl) {
  cloudinary.config({
    ...parseCloudinaryUrl(env.cloudinaryUrl),
    secure: true
  });
}

export { cloudinary };
