import { prisma } from '../config/prisma.js';

export async function getAllCategories() {
  const categories = await prisma.category.findMany({
    orderBy: { displayOrder: 'asc' },
    include: {
      subcategories: {
        orderBy: { displayOrder: 'asc' }
      }
    }
  });

  return categories.map((category) => ({
    id: category.id,
    name: category.name,
    slug: category.slug,
    icon: category.icon,
    displayOrder: category.displayOrder,
    subcategories: category.subcategories.map((subcategory) => ({
      id: subcategory.id,
      categoryId: subcategory.categoryId,
      name: subcategory.name,
      slug: subcategory.slug,
      displayOrder: subcategory.displayOrder
    }))
  }));
}

export async function getSubcategoriesByCategory(categoryId) {
  const subcategories = await prisma.subcategory.findMany({
    where: { categoryId },
    orderBy: { displayOrder: 'asc' }
  });

  return subcategories.map((subcategory) => ({
    id: subcategory.id,
    categoryId: subcategory.categoryId,
    name: subcategory.name,
    slug: subcategory.slug,
    displayOrder: subcategory.displayOrder
  }));
}
