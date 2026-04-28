import { StatusCodes } from 'http-status-codes';
import { prisma } from '../config/prisma.js';
import { AppError } from '../errors/app-error.js';
import { buildPaginationMeta, getPagination } from '../utils/pagination.js';
import { serializeCategory, serializeSubcategory } from '../utils/serializers.js';
import { slugify } from '../utils/slug.js';
import {
  destroyUploadedAssets,
  extractCloudinaryPublicId,
  uploadImageFile
} from '../utils/uploads.js';

async function resolveImageAsset(payload, file, folder) {
  if (file) {
    return uploadImageFile(file, { folder });
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'imageUrl')) {
    return {
      imageUrl: payload.imageUrl ?? null,
      publicId: null
    };
  }

  return {
    imageUrl: undefined,
    publicId: null
  };
}

function buildSlug(payload, fallbackName) {
  return payload.slug ?? slugify(fallbackName);
}

function assertSlug(slug) {
  if (!slug) {
    throw new AppError('Slug could not be generated from name', StatusCodes.BAD_REQUEST);
  }
}

export async function getAllCategories() {
  const categories = await prisma.category.findMany({
    orderBy: { displayOrder: 'asc' },
    include: {
      subcategories: {
        orderBy: { displayOrder: 'asc' }
      }
    }
  });

  return categories.map((category) => serializeCategory(category, { includeSubcategories: true }));
}

export async function getSubcategoriesByCategory(categoryId) {
  const subcategories = await prisma.subcategory.findMany({
    where: { categoryId },
    orderBy: { displayOrder: 'asc' }
  });

  return subcategories.map(serializeSubcategory);
}

export async function adminListCategories(query) {
  const pagination = getPagination(query);
  const where = query.search
    ? {
        OR: [
          { name: { contains: query.search, mode: 'insensitive' } },
          { slug: { contains: query.search, mode: 'insensitive' } }
        ]
      }
    : {};

  const [total, categories] = await prisma.$transaction([
    prisma.category.count({ where }),
    prisma.category.findMany({
      where,
      include: {
        subcategories: {
          orderBy: { displayOrder: 'asc' }
        },
        _count: {
          select: {
            listings: true,
            clientRequests: true
          }
        }
      },
      orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
      skip: pagination.skip,
      take: pagination.take
    })
  ]);

  return {
    items: categories.map((category) => ({
      ...serializeCategory(category, { includeSubcategories: true }),
      counts: {
        listings: category._count.listings,
        clientRequests: category._count.clientRequests,
        subcategories: category.subcategories.length
      }
    })),
    meta: buildPaginationMeta({ ...pagination, total })
  };
}

export async function adminCreateCategory(payload, file) {
  const slug = buildSlug(payload, payload.name);
  assertSlug(slug);
  const asset = await resolveImageAsset(payload, file, 'taxonomy/images/categories');

  try {
    const category = await prisma.category.create({
      data: {
        name: payload.name,
        slug,
        imageUrl: asset.imageUrl ?? null,
        displayOrder: payload.displayOrder
      },
      include: {
        subcategories: {
          orderBy: { displayOrder: 'asc' }
        }
      }
    });

    return serializeCategory(category, { includeSubcategories: true });
  } catch (error) {
    await destroyUploadedAssets([asset.publicId]);
    throw error;
  }
}

export async function adminUpdateCategory(categoryId, payload, file) {
  const existing = await prisma.category.findUnique({
    where: { id: categoryId }
  });

  if (!existing) {
    throw new AppError('Category not found', StatusCodes.NOT_FOUND);
  }

  const asset = await resolveImageAsset(payload, file, 'taxonomy/images/categories');
  const nextSlug = payload.slug;

  const data = {
    ...(payload.name ? { name: payload.name } : {}),
    ...(nextSlug ? { slug: nextSlug } : {}),
    ...(typeof asset.imageUrl !== 'undefined' ? { imageUrl: asset.imageUrl } : {}),
    ...(Object.prototype.hasOwnProperty.call(payload, 'displayOrder')
      ? { displayOrder: payload.displayOrder }
      : {})
  };

  if (Object.keys(data).length === 0) {
    throw new AppError('At least one field or image file is required', StatusCodes.BAD_REQUEST);
  }

  const previousPublicId = extractCloudinaryPublicId(existing.imageUrl);
  const nextPublicId =
    asset.publicId ??
    (typeof asset.imageUrl !== 'undefined' ? extractCloudinaryPublicId(asset.imageUrl) : previousPublicId);

  try {
    const updated = await prisma.category.update({
      where: { id: categoryId },
      data,
      include: {
        subcategories: {
          orderBy: { displayOrder: 'asc' }
        }
      }
    });

    if (previousPublicId && previousPublicId !== nextPublicId) {
      await destroyUploadedAssets([previousPublicId]);
    }

    return serializeCategory(updated, { includeSubcategories: true });
  } catch (error) {
    await destroyUploadedAssets([asset.publicId]);
    throw error;
  }
}

export async function adminDeleteCategory(categoryId) {
  const category = await prisma.category.findUnique({
    where: { id: categoryId },
    include: {
      _count: {
        select: {
          listings: true,
          clientRequests: true
        }
      }
    }
  });

  if (!category) {
    throw new AppError('Category not found', StatusCodes.NOT_FOUND);
  }

  if (category._count.listings || category._count.clientRequests) {
    throw new AppError('Category cannot be deleted while listings or client requests depend on it', StatusCodes.CONFLICT);
  }

  await prisma.category.delete({
    where: { id: categoryId }
  });

  await destroyUploadedAssets([extractCloudinaryPublicId(category.imageUrl)]);
}

export async function adminCreateSubcategory(categoryId, payload, file) {
  const category = await prisma.category.findUnique({
    where: { id: categoryId },
    select: { id: true }
  });

  if (!category) {
    throw new AppError('Category not found', StatusCodes.NOT_FOUND);
  }

  const slug = buildSlug(payload, payload.name);
  assertSlug(slug);
  const asset = await resolveImageAsset(payload, file, 'taxonomy/images/subcategories');

  try {
    const subcategory = await prisma.subcategory.create({
      data: {
        categoryId,
        name: payload.name,
        slug,
        imageUrl: asset.imageUrl ?? null,
        displayOrder: payload.displayOrder
      }
    });

    return serializeSubcategory(subcategory);
  } catch (error) {
    await destroyUploadedAssets([asset.publicId]);
    throw error;
  }
}

export async function adminUpdateSubcategory(subcategoryId, payload, file) {
  const existing = await prisma.subcategory.findUnique({
    where: { id: subcategoryId }
  });

  if (!existing) {
    throw new AppError('Subcategory not found', StatusCodes.NOT_FOUND);
  }

  const asset = await resolveImageAsset(payload, file, 'taxonomy/images/subcategories');
  const nextSlug = payload.slug;

  const data = {
    ...(payload.name ? { name: payload.name } : {}),
    ...(nextSlug ? { slug: nextSlug } : {}),
    ...(typeof asset.imageUrl !== 'undefined' ? { imageUrl: asset.imageUrl } : {}),
    ...(Object.prototype.hasOwnProperty.call(payload, 'displayOrder')
      ? { displayOrder: payload.displayOrder }
      : {})
  };

  if (Object.keys(data).length === 0) {
    throw new AppError('At least one field or image file is required', StatusCodes.BAD_REQUEST);
  }

  const previousPublicId = extractCloudinaryPublicId(existing.imageUrl);
  const nextPublicId =
    asset.publicId ??
    (typeof asset.imageUrl !== 'undefined' ? extractCloudinaryPublicId(asset.imageUrl) : previousPublicId);

  try {
    const updated = await prisma.subcategory.update({
      where: { id: subcategoryId },
      data
    });

    if (previousPublicId && previousPublicId !== nextPublicId) {
      await destroyUploadedAssets([previousPublicId]);
    }

    return serializeSubcategory(updated);
  } catch (error) {
    await destroyUploadedAssets([asset.publicId]);
    throw error;
  }
}

export async function adminDeleteSubcategory(subcategoryId) {
  const subcategory = await prisma.subcategory.findUnique({
    where: { id: subcategoryId },
    include: {
      _count: {
        select: {
          listings: true,
          clientRequests: true
        }
      }
    }
  });

  if (!subcategory) {
    throw new AppError('Subcategory not found', StatusCodes.NOT_FOUND);
  }

  if (subcategory._count.listings || subcategory._count.clientRequests) {
    throw new AppError('Subcategory cannot be deleted while listings or client requests depend on it', StatusCodes.CONFLICT);
  }

  await prisma.subcategory.delete({
    where: { id: subcategoryId }
  });

  await destroyUploadedAssets([extractCloudinaryPublicId(subcategory.imageUrl)]);
}
