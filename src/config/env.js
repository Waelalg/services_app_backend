import dotenv from 'dotenv';

dotenv.config();

export const env = {
  port: process.env.PORT || 4000,
  nodeEnv: process.env.NODE_ENV || 'development',
  clientUrl: process.env.CLIENT_URL || 'http://localhost:3000',
  databaseUrl: process.env.DATABASE_URL,
  jwtSecret: process.env.JWT_SECRET || 'change_me',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  cloudinaryUrl: process.env.CLOUDINARY_URL || '',
  cloudinaryUploadFolder: process.env.CLOUDINARY_UPLOAD_FOLDER || 'artisan-marketplace'
};
