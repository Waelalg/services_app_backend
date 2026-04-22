import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const categories = [
    { name: 'Works', slug: 'works', displayOrder: 1 },
    { name: 'Beauty', slug: 'beauty', displayOrder: 2 },
    { name: 'Health', slug: 'health', displayOrder: 3 }
  ];

  const createdCategories = {};

  for (const category of categories) {
    const saved = await prisma.category.upsert({
      where: { slug: category.slug },
      update: {
        name: category.name,
        displayOrder: category.displayOrder
      },
      create: category
    });

    createdCategories[category.slug] = saved;
  }

  const subcategories = [
    { categorySlug: 'works', name: 'Plumbing', slug: 'plumbing', displayOrder: 1 },
    { categorySlug: 'works', name: 'Painting', slug: 'painting', displayOrder: 2 },
    { categorySlug: 'works', name: 'Electricity', slug: 'electricity', displayOrder: 3 },
    { categorySlug: 'works', name: 'Waterproofing', slug: 'waterproofing', displayOrder: 4 },
    { categorySlug: 'works', name: 'Locksmith', slug: 'locksmith', displayOrder: 5 },
    { categorySlug: 'works', name: 'Drywall', slug: 'drywall', displayOrder: 6 },
    { categorySlug: 'beauty', name: 'Hair', slug: 'hair', displayOrder: 1 },
    { categorySlug: 'beauty', name: 'Makeup', slug: 'makeup', displayOrder: 2 },
    { categorySlug: 'health', name: 'Nursing', slug: 'nursing', displayOrder: 1 },
    { categorySlug: 'health', name: 'Physio', slug: 'physio', displayOrder: 2 }
  ];

  for (const item of subcategories) {
    const categoryId = createdCategories[item.categorySlug].id;

    await prisma.subcategory.upsert({
      where: { categoryId_slug: { categoryId, slug: item.slug } },
      update: {
        name: item.name,
        displayOrder: item.displayOrder
      },
      create: {
        categoryId,
        name: item.name,
        slug: item.slug,
        displayOrder: item.displayOrder
      }
    });
  }

  console.log('Seed completed');
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
