import path from 'path';

export function toPublicUploadPath(filePath) {
  const relative = path.relative(path.join(process.cwd(), 'uploads'), filePath);
  return `/uploads/${relative.split(path.sep).join('/')}`;
}
