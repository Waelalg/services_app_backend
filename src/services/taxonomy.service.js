import { StatusCodes } from 'http-status-codes';
import { prisma } from '../config/prisma.js';
import { AppError } from '../errors/app-error.js';
import { buildPaginationMeta, getPagination } from '../utils/pagination.js';
import { serializeCategory, serializeSubcategory } from '../utils/serializers.js';
import { slugify } from '../utils/slug.js';
import { toPublicUploadPath } from '../utils/uploads.js';

function resolveImageUrl(payload, file) {
  if (file) {
    return toPublicUploadPath(file.path);
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'imageUrl')) {
    return payload.imageUrl ?? null;
  }

  return undefined;
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

  const category = await prisma.category.create({
    data: {
      name: payload.name,
      slug,
      imageUrl: resolveImageUrl(payload, file) ?? null,
      displayOrder: payload.displayOrder
    },
    include: {
      subcategories: {
        orderBy: { displayOrder: 'asc' }
      }
    }
  });

  return serializeCategory(category, { includeSubcategories: true });
}

export async function adminUpdateCategory(categoryId, payload, file) {
  const existing = await prisma.category.findUnique({
    where: { id: categoryId }
  });

  if (!existing) {
    throw new AppError('Category not found', StatusCodes.NOT_FOUND);
  }

  const imageUrl = resolveImageUrl(payload, file);
  const nextSlug = payload.slug;

  const data = {
    ...(payload.name ? { name: payload.name } : {}),
    ...(nextSlug ? { slug: nextSlug } : {}),
    ...(typeof imageUrl !== 'undefined' ? { imageUrl } : {}),
    ...(Object.prototype.hasOwnProperty.call(payload, 'displayOrder')
      ? { displayOrder: payload.displayOrder }
      : {})
  };

  if (Object.keys(data).length === 0) {
    throw new AppError('At least one field or image file is required', StatusCodes.BAD_REQUEST);
  }

  const updated = await prisma.category.update({
    where: { id: categoryId },
    data,
    include: {
      subcategories: {
        orderBy: { displayOrder: 'asc' }
      }
    }
  });

  return serializeCategory(updated, { includeSubcategories: true });
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

  const subcategory = await prisma.subcategory.create({
    data: {
      categoryId,
      name: payload.name,
      slug,
      imageUrl: resolveImageUrl(payload, file) ?? null,
      displayOrder: payload.displayOrder
    }
  });

  return serializeSubcategory(subcategory);
}

export async function adminUpdateSubcategory(subcategoryId, payload, file) {
  const existing = await prisma.subcategory.findUnique({
    where: { id: subcategoryId }
  });

  if (!existing) {
    throw new AppError('Subcategory not found', StatusCodes.NOT_FOUND);
  }

  const imageUrl = resolveImageUrl(payload, file);
  const nextSlug = payload.slug;

  const data = {
    ...(payload.name ? { name: payload.name } : {}),
    ...(nextSlug ? { slug: nextSlug } : {}),
    ...(typeof imageUrl !== 'undefined' ? { imageUrl } : {}),
    ...(Object.prototype.hasOwnProperty.call(payload, 'displayOrder')
      ? { displayOrder: payload.displayOrder }
      : {})
  };

  if (Object.keys(data).length === 0) {
    throw new AppError('At least one field or image file is required', StatusCodes.BAD_REQUEST);
  }

  const updated = await prisma.subcategory.update({
    where: { id: subcategoryId },
    data
  });

  return serializeSubcategory(updated);
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
}
