import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const DEFAULT_ADMIN_EMAIL = 'admin@example.com';
const DEFAULT_ADMIN_PASSWORD = 'AdminPass123';
const DEFAULT_CLIENT_PASSWORD = 'ClientPass123';
const DEFAULT_WORKER_PASSWORD = 'WorkerPass123';

function startOfUtcDay() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

function dateOffset(days) {
  const value = startOfUtcDay();
  value.setUTCDate(value.getUTCDate() + days);
  return value;
}

function dateTimeOffset(days, hours, minutes = 0) {
  const value = dateOffset(days);
  value.setUTCHours(hours, minutes, 0, 0);
  return value;
}

function imageUrl(label, width = 1200, height = 800) {
  return `https://placehold.co/${width}x${height}/png?text=${encodeURIComponent(label)}`;
}

async function resetDemoRecords(demoEmails) {
  const users = await prisma.user.findMany({
    where: {
      email: {
        in: demoEmails
      }
    },
    include: {
      workerProfile: {
        include: {
          listings: {
            select: { id: true }
          }
        }
      },
      clientRequests: {
        select: { id: true }
      }
    }
  });

  if (!users.length) {
    return;
  }

  const userIds = users.map((user) => user.id);
  const workerProfileIds = users
    .map((user) => user.workerProfile?.id)
    .filter(Boolean);
  const listingIds = users.flatMap((user) => user.workerProfile?.listings.map((listing) => listing.id) ?? []);
  const requestIds = users.flatMap((user) => user.clientRequests.map((request) => request.id));

  await prisma.$transaction(async (tx) => {
    await tx.favorite.deleteMany({
      where: {
        OR: [
          { clientId: { in: userIds } },
          { workerProfileId: { in: workerProfileIds } }
        ]
      }
    });

    await tx.review.deleteMany({
      where: {
        OR: [
          { reviewerId: { in: userIds } },
          { reviewedWorkerId: { in: workerProfileIds } }
        ]
      }
    });

    await tx.booking.deleteMany({
      where: {
        OR: [
          { clientId: { in: userIds } },
          { workerProfileId: { in: workerProfileIds } },
          { clientRequestId: { in: requestIds } }
        ]
      }
    });

    await tx.clientRequestOffer.deleteMany({
      where: {
        OR: [
          { requestId: { in: requestIds } },
          { workerProfileId: { in: workerProfileIds } }
        ]
      }
    });

    await tx.clientRequestImage.deleteMany({
      where: {
        requestId: { in: requestIds }
      }
    });

    await tx.clientRequest.deleteMany({
      where: {
        id: { in: requestIds }
      }
    });

    await tx.workerTimeOff.deleteMany({
      where: {
        listingId: { in: listingIds }
      }
    });

    await tx.workerAvailabilityRule.deleteMany({
      where: {
        listingId: { in: listingIds }
      }
    });

    await tx.portfolioImage.deleteMany({
      where: {
        listingId: { in: listingIds }
      }
    });

    await tx.listingWorkArea.deleteMany({
      where: {
        listingId: { in: listingIds }
      }
    });

    await tx.workerListing.deleteMany({
      where: {
        id: { in: listingIds }
      }
    });

    await tx.workerProfile.deleteMany({
      where: {
        id: { in: workerProfileIds }
      }
    });

    await tx.user.deleteMany({
      where: {
        id: { in: userIds }
      }
    });
  });
}

async function syncWorkerMetrics(workerProfileIds) {
  for (const workerProfileId of workerProfileIds) {
    const [completedRequests, reviewAggregate] = await Promise.all([
      prisma.booking.count({
        where: {
          workerProfileId,
          status: 'COMPLETED'
        }
      }),
      prisma.review.aggregate({
        where: {
          reviewedWorkerId: workerProfileId
        },
        _avg: {
          rating: true
        },
        _count: {
          id: true
        }
      })
    ]);

    await prisma.workerProfile.update({
      where: { id: workerProfileId },
      data: {
        completedRequests,
        ratingAvg: reviewAggregate._avg.rating ?? null,
        ratingCount: reviewAggregate._count.id
      }
    });
  }
}

async function main() {
  const adminEmail = (process.env.ADMIN_EMAIL || DEFAULT_ADMIN_EMAIL).trim().toLowerCase();
  const adminPassword = process.env.ADMIN_PASSWORD || DEFAULT_ADMIN_PASSWORD;
  const adminFirstName = process.env.ADMIN_FIRST_NAME || 'Admin';
  const adminLastName = process.env.ADMIN_LAST_NAME || 'User';
  const adminGender = process.env.ADMIN_GENDER || null;
  const adminDateOfBirth = process.env.ADMIN_DATE_OF_BIRTH
    ? new Date(`${process.env.ADMIN_DATE_OF_BIRTH}T00:00:00.000Z`)
    : null;

  const demoAccounts = {
    admin: {
      email: adminEmail,
      password: adminPassword,
      firstName: adminFirstName,
      lastName: adminLastName,
      role: 'ADMIN',
      phone: null,
      gender: adminGender,
      dateOfBirth: adminDateOfBirth,
      avatarUrl: imageUrl('Admin User', 400, 400)
    },
    clientPrimary: {
      email: 'client@example.com',
      password: DEFAULT_CLIENT_PASSWORD,
      firstName: 'Sara',
      lastName: 'Client',
      role: 'CLIENT',
      phone: '+213555000001',
      gender: 'FEMALE',
      dateOfBirth: new Date('1997-05-14T00:00:00.000Z'),
      avatarUrl: imageUrl('Sara Client', 400, 400)
    },
    clientSecondary: {
      email: 'client2@example.com',
      password: DEFAULT_CLIENT_PASSWORD,
      firstName: 'Nadia',
      lastName: 'Requester',
      role: 'CLIENT',
      phone: '+213555000002',
      gender: 'FEMALE',
      dateOfBirth: new Date('1994-09-21T00:00:00.000Z'),
      avatarUrl: imageUrl('Nadia Requester', 400, 400)
    },
    workerPrimary: {
      email: 'worker@example.com',
      password: DEFAULT_WORKER_PASSWORD,
      firstName: 'Yacine',
      lastName: 'Bensaid',
      role: 'WORKER',
      phone: '+213555000101',
      gender: 'MALE',
      dateOfBirth: new Date('1990-02-11T00:00:00.000Z'),
      avatarUrl: imageUrl('Yacine Bensaid', 400, 400),
      profile: {
        headline: 'Home repair artisan',
        bio: 'Plumbing, electricity, and general maintenance for apartments and houses.',
        yearsExperience: 8,
        avgResponseMinutes: 28,
        isTrusted: true
      }
    },
    workerBeauty: {
      email: 'beauty.worker@example.com',
      password: DEFAULT_WORKER_PASSWORD,
      firstName: 'Lina',
      lastName: 'Khelifi',
      role: 'WORKER',
      phone: '+213555000102',
      gender: 'FEMALE',
      dateOfBirth: new Date('1993-06-19T00:00:00.000Z'),
      avatarUrl: imageUrl('Lina Khelifi', 400, 400),
      profile: {
        headline: 'Beauty artist',
        bio: 'Hair styling and makeup services for events and home visits.',
        yearsExperience: 6,
        avgResponseMinutes: 35,
        isTrusted: true
      }
    },
    workerHealth: {
      email: 'health.worker@example.com',
      password: DEFAULT_WORKER_PASSWORD,
      firstName: 'Samir',
      lastName: 'Hamlaoui',
      role: 'WORKER',
      phone: '+213555000103',
      gender: 'MALE',
      dateOfBirth: new Date('1988-11-03T00:00:00.000Z'),
      avatarUrl: imageUrl('Samir Hamlaoui', 400, 400),
      profile: {
        headline: 'Health support specialist',
        bio: 'Home nursing support, monitoring, and mobility care.',
        yearsExperience: 10,
        avgResponseMinutes: 42,
        isTrusted: false
      }
    }
  };

  await resetDemoRecords(Object.values(demoAccounts).map((account) => account.email));

  const categories = [
    {
      name: 'Works',
      slug: 'works',
      imageUrl: imageUrl('Works Category'),
      displayOrder: 1,
      subcategories: [
        { name: 'Plumbing', slug: 'plumbing', imageUrl: imageUrl('Plumbing'), displayOrder: 1 },
        { name: 'Painting', slug: 'painting', imageUrl: imageUrl('Painting'), displayOrder: 2 },
        { name: 'Electricity', slug: 'electricity', imageUrl: imageUrl('Electricity'), displayOrder: 3 },
        { name: 'Waterproofing', slug: 'waterproofing', imageUrl: imageUrl('Waterproofing'), displayOrder: 4 },
        { name: 'Locksmith', slug: 'locksmith', imageUrl: imageUrl('Locksmith'), displayOrder: 5 },
        { name: 'Drywall', slug: 'drywall', imageUrl: imageUrl('Drywall'), displayOrder: 6 }
      ]
    },
    {
      name: 'Beauty',
      slug: 'beauty',
      imageUrl: imageUrl('Beauty Category'),
      displayOrder: 2,
      subcategories: [
        { name: 'Hair', slug: 'hair', imageUrl: imageUrl('Hair'), displayOrder: 1 },
        { name: 'Makeup', slug: 'makeup', imageUrl: imageUrl('Makeup'), displayOrder: 2 }
      ]
    },
    {
      name: 'Health',
      slug: 'health',
      imageUrl: imageUrl('Health Category'),
      displayOrder: 3,
      subcategories: [
        { name: 'Nursing', slug: 'nursing', imageUrl: imageUrl('Nursing'), displayOrder: 1 },
        { name: 'Physio', slug: 'physio', imageUrl: imageUrl('Physio'), displayOrder: 2 }
      ]
    }
  ];

  const categoryBySlug = {};
  const subcategoryBySlug = {};

  for (const category of categories) {
    const savedCategory = await prisma.category.upsert({
      where: { slug: category.slug },
      update: {
        name: category.name,
        imageUrl: category.imageUrl,
        displayOrder: category.displayOrder
      },
      create: {
        name: category.name,
        slug: category.slug,
        imageUrl: category.imageUrl,
        displayOrder: category.displayOrder
      }
    });

    categoryBySlug[category.slug] = savedCategory;

    for (const subcategory of category.subcategories) {
      const savedSubcategory = await prisma.subcategory.upsert({
        where: {
          categoryId_slug: {
            categoryId: savedCategory.id,
            slug: subcategory.slug
          }
        },
        update: {
          name: subcategory.name,
          imageUrl: subcategory.imageUrl,
          displayOrder: subcategory.displayOrder
        },
        create: {
          categoryId: savedCategory.id,
          name: subcategory.name,
          slug: subcategory.slug,
          imageUrl: subcategory.imageUrl,
          displayOrder: subcategory.displayOrder
        }
      });

      subcategoryBySlug[subcategory.slug] = savedSubcategory;
    }
  }

  const adminPasswordHash = await bcrypt.hash(demoAccounts.admin.password, 12);
  const clientPasswordHash = await bcrypt.hash(DEFAULT_CLIENT_PASSWORD, 12);
  const workerPasswordHash = await bcrypt.hash(DEFAULT_WORKER_PASSWORD, 12);

  const admin = await prisma.user.create({
    data: {
      firstName: demoAccounts.admin.firstName,
      lastName: demoAccounts.admin.lastName,
      email: demoAccounts.admin.email,
      phone: demoAccounts.admin.phone,
      passwordHash: adminPasswordHash,
      role: 'ADMIN',
      avatarUrl: demoAccounts.admin.avatarUrl,
      gender: demoAccounts.admin.gender,
      dateOfBirth: demoAccounts.admin.dateOfBirth,
      isActive: true
    }
  });

  const clientPrimary = await prisma.user.create({
    data: {
      firstName: demoAccounts.clientPrimary.firstName,
      lastName: demoAccounts.clientPrimary.lastName,
      email: demoAccounts.clientPrimary.email,
      phone: demoAccounts.clientPrimary.phone,
      passwordHash: clientPasswordHash,
      role: 'CLIENT',
      avatarUrl: demoAccounts.clientPrimary.avatarUrl,
      gender: demoAccounts.clientPrimary.gender,
      dateOfBirth: demoAccounts.clientPrimary.dateOfBirth,
      isActive: true
    }
  });

  const clientSecondary = await prisma.user.create({
    data: {
      firstName: demoAccounts.clientSecondary.firstName,
      lastName: demoAccounts.clientSecondary.lastName,
      email: demoAccounts.clientSecondary.email,
      phone: demoAccounts.clientSecondary.phone,
      passwordHash: clientPasswordHash,
      role: 'CLIENT',
      avatarUrl: demoAccounts.clientSecondary.avatarUrl,
      gender: demoAccounts.clientSecondary.gender,
      dateOfBirth: demoAccounts.clientSecondary.dateOfBirth,
      isActive: true
    }
  });

  const workerPrimaryUser = await prisma.user.create({
    data: {
      firstName: demoAccounts.workerPrimary.firstName,
      lastName: demoAccounts.workerPrimary.lastName,
      email: demoAccounts.workerPrimary.email,
      phone: demoAccounts.workerPrimary.phone,
      passwordHash: workerPasswordHash,
      role: 'WORKER',
      avatarUrl: demoAccounts.workerPrimary.avatarUrl,
      gender: demoAccounts.workerPrimary.gender,
      dateOfBirth: demoAccounts.workerPrimary.dateOfBirth,
      isActive: true
    }
  });

  const workerBeautyUser = await prisma.user.create({
    data: {
      firstName: demoAccounts.workerBeauty.firstName,
      lastName: demoAccounts.workerBeauty.lastName,
      email: demoAccounts.workerBeauty.email,
      phone: demoAccounts.workerBeauty.phone,
      passwordHash: workerPasswordHash,
      role: 'WORKER',
      avatarUrl: demoAccounts.workerBeauty.avatarUrl,
      gender: demoAccounts.workerBeauty.gender,
      dateOfBirth: demoAccounts.workerBeauty.dateOfBirth,
      isActive: true
    }
  });

  const workerHealthUser = await prisma.user.create({
    data: {
      firstName: demoAccounts.workerHealth.firstName,
      lastName: demoAccounts.workerHealth.lastName,
      email: demoAccounts.workerHealth.email,
      phone: demoAccounts.workerHealth.phone,
      passwordHash: workerPasswordHash,
      role: 'WORKER',
      avatarUrl: demoAccounts.workerHealth.avatarUrl,
      gender: demoAccounts.workerHealth.gender,
      dateOfBirth: demoAccounts.workerHealth.dateOfBirth,
      isActive: true
    }
  });

  const workerPrimaryProfile = await prisma.workerProfile.create({
    data: {
      userId: workerPrimaryUser.id,
      ...demoAccounts.workerPrimary.profile
    }
  });

  const workerBeautyProfile = await prisma.workerProfile.create({
    data: {
      userId: workerBeautyUser.id,
      ...demoAccounts.workerBeauty.profile
    }
  });

  const workerHealthProfile = await prisma.workerProfile.create({
    data: {
      userId: workerHealthUser.id,
      ...demoAccounts.workerHealth.profile
    }
  });

  const plumbingListing = await prisma.workerListing.create({
    data: {
      workerProfileId: workerPrimaryProfile.id,
      categoryId: categoryBySlug.works.id,
      subcategoryId: subcategoryBySlug.plumbing.id,
      title: 'Emergency plumbing repairs',
      description: 'Leak fixing, pipe replacement, pressure checks, and quick interventions for apartments and homes.',
      pricingType: 'QUOTE',
      priceFrom: 2500,
      currency: 'DZD',
      status: 'PUBLISHED',
      isPublished: true,
      workAreas: {
        create: [
          { wilaya: 'Biskra', commune: 'Doucen' },
          { wilaya: 'Biskra', commune: 'Tolga' }
        ]
      },
      portfolioImages: {
        create: [
          { imageUrl: imageUrl('Plumbing Portfolio 1'), caption: 'Kitchen pipe repair', displayOrder: 0 },
          { imageUrl: imageUrl('Plumbing Portfolio 2'), caption: 'Bathroom fitting replacement', displayOrder: 1 }
        ]
      },
      availabilityRules: {
        create: [
          { dayOfWeek: 1, startTime: '09:00', endTime: '17:00', slotDurationMinutes: 60, isActive: true },
          { dayOfWeek: 2, startTime: '09:00', endTime: '17:00', slotDurationMinutes: 60, isActive: true },
          { dayOfWeek: 3, startTime: '09:00', endTime: '17:00', slotDurationMinutes: 60, isActive: true },
          { dayOfWeek: 4, startTime: '09:00', endTime: '17:00', slotDurationMinutes: 60, isActive: true },
          { dayOfWeek: 5, startTime: '09:00', endTime: '16:00', slotDurationMinutes: 60, isActive: true }
        ]
      },
      timeOff: {
        create: [
          {
            startDateTime: dateTimeOffset(7, 12, 0),
            endDateTime: dateTimeOffset(7, 14, 0),
            reason: 'Family appointment'
          }
        ]
      }
    }
  });

  const electricityListing = await prisma.workerListing.create({
    data: {
      workerProfileId: workerPrimaryProfile.id,
      categoryId: categoryBySlug.works.id,
      subcategoryId: subcategoryBySlug.electricity.id,
      title: 'Home electrical troubleshooting',
      description: 'Socket replacement, breaker diagnostics, lighting installation, and short-circuit checks.',
      pricingType: 'HOURLY',
      priceFrom: 1800,
      currency: 'DZD',
      status: 'PUBLISHED',
      isPublished: true,
      workAreas: {
        create: [
          { wilaya: 'Biskra', commune: 'Biskra' }
        ]
      },
      portfolioImages: {
        create: [
          { imageUrl: imageUrl('Electricity Portfolio 1'), caption: 'Lighting panel work', displayOrder: 0 }
        ]
      },
      availabilityRules: {
        create: [
          { dayOfWeek: 0, startTime: '10:00', endTime: '15:00', slotDurationMinutes: 60, isActive: true },
          { dayOfWeek: 6, startTime: '10:00', endTime: '15:00', slotDurationMinutes: 60, isActive: true }
        ]
      }
    }
  });

  await prisma.workerListing.create({
    data: {
      workerProfileId: workerPrimaryProfile.id,
      categoryId: categoryBySlug.works.id,
      subcategoryId: subcategoryBySlug.painting.id,
      title: 'Interior painting packages',
      description: 'Wall prep, paint application, finishing details, and room refresh packages.',
      pricingType: 'QUOTE',
      priceFrom: 9000,
      currency: 'DZD',
      status: 'DRAFT',
      isPublished: false,
      workAreas: {
        create: [
          { wilaya: 'Biskra', commune: 'Sidi Okba' }
        ]
      },
      portfolioImages: {
        create: [
          { imageUrl: imageUrl('Painting Draft Portfolio'), caption: 'Draft service preview', displayOrder: 0 }
        ]
      }
    }
  });

  const hairListing = await prisma.workerListing.create({
    data: {
      workerProfileId: workerBeautyProfile.id,
      categoryId: categoryBySlug.beauty.id,
      subcategoryId: subcategoryBySlug.hair.id,
      title: 'Home hair styling',
      description: 'Cuts, styling, and event-ready looks with at-home service for women and girls.',
      pricingType: 'FIXED',
      priceFrom: 3000,
      currency: 'DZD',
      status: 'PUBLISHED',
      isPublished: true,
      workAreas: {
        create: [
          { wilaya: 'Algiers', commune: 'Bab Ezzouar' },
          { wilaya: 'Algiers', commune: 'Dar El Beida' }
        ]
      },
      portfolioImages: {
        create: [
          { imageUrl: imageUrl('Hair Portfolio 1'), caption: 'Wedding hairstyle', displayOrder: 0 },
          { imageUrl: imageUrl('Hair Portfolio 2'), caption: 'Braids and finishing', displayOrder: 1 }
        ]
      },
      availabilityRules: {
        create: [
          { dayOfWeek: 4, startTime: '13:00', endTime: '19:00', slotDurationMinutes: 60, isActive: true },
          { dayOfWeek: 5, startTime: '10:00', endTime: '18:00', slotDurationMinutes: 60, isActive: true },
          { dayOfWeek: 6, startTime: '10:00', endTime: '18:00', slotDurationMinutes: 60, isActive: true }
        ]
      }
    }
  });

  const makeupListing = await prisma.workerListing.create({
    data: {
      workerProfileId: workerBeautyProfile.id,
      categoryId: categoryBySlug.beauty.id,
      subcategoryId: subcategoryBySlug.makeup.id,
      title: 'Event makeup artist',
      description: 'Natural, bridal, and evening makeup sessions with home-visit availability.',
      pricingType: 'QUOTE',
      priceFrom: 5000,
      currency: 'DZD',
      status: 'PUBLISHED',
      isPublished: true,
      workAreas: {
        create: [
          { wilaya: 'Algiers', commune: 'Hussein Dey' }
        ]
      },
      portfolioImages: {
        create: [
          { imageUrl: imageUrl('Makeup Portfolio 1'), caption: 'Soft glam makeup', displayOrder: 0 }
        ]
      },
      availabilityRules: {
        create: [
          { dayOfWeek: 5, startTime: '11:00', endTime: '19:00', slotDurationMinutes: 60, isActive: true },
          { dayOfWeek: 6, startTime: '11:00', endTime: '19:00', slotDurationMinutes: 60, isActive: true }
        ]
      }
    }
  });

  const nursingListing = await prisma.workerListing.create({
    data: {
      workerProfileId: workerHealthProfile.id,
      categoryId: categoryBySlug.health.id,
      subcategoryId: subcategoryBySlug.nursing.id,
      title: 'Home nursing assistance',
      description: 'Medication support, routine checks, mobility help, and post-care monitoring at home.',
      pricingType: 'HOURLY',
      priceFrom: 2200,
      currency: 'DZD',
      status: 'PUBLISHED',
      isPublished: true,
      workAreas: {
        create: [
          { wilaya: 'Constantine', commune: 'El Khroub' },
          { wilaya: 'Constantine', commune: 'Constantine' }
        ]
      },
      portfolioImages: {
        create: [
          { imageUrl: imageUrl('Nursing Portfolio 1'), caption: 'Home care preparation', displayOrder: 0 }
        ]
      },
      availabilityRules: {
        create: [
          { dayOfWeek: 1, startTime: '08:00', endTime: '16:00', slotDurationMinutes: 60, isActive: true },
          { dayOfWeek: 2, startTime: '08:00', endTime: '16:00', slotDurationMinutes: 60, isActive: true },
          { dayOfWeek: 3, startTime: '08:00', endTime: '16:00', slotDurationMinutes: 60, isActive: true }
        ]
      }
    }
  });

  const physioListing = await prisma.workerListing.create({
    data: {
      workerProfileId: workerHealthProfile.id,
      categoryId: categoryBySlug.health.id,
      subcategoryId: subcategoryBySlug.physio.id,
      title: 'At-home physio sessions',
      description: 'Mobility exercises, recovery support, and guided rehabilitation sessions at home.',
      pricingType: 'QUOTE',
      priceFrom: 4000,
      currency: 'DZD',
      status: 'PUBLISHED',
      isPublished: true,
      workAreas: {
        create: [
          { wilaya: 'Constantine', commune: 'Didouche Mourad' }
        ]
      },
      portfolioImages: {
        create: [
          { imageUrl: imageUrl('Physio Portfolio 1'), caption: 'Exercise session setup', displayOrder: 0 }
        ]
      },
      availabilityRules: {
        create: [
          { dayOfWeek: 4, startTime: '09:00', endTime: '15:00', slotDurationMinutes: 60, isActive: true }
        ]
      }
    }
  });

  const openRequest = await prisma.clientRequest.create({
    data: {
      clientId: clientPrimary.id,
      categoryId: categoryBySlug.works.id,
      subcategoryId: subcategoryBySlug.plumbing.id,
      title: 'Need urgent sink leak repair',
      description: 'Kitchen sink is leaking under the cabinet and needs same-day repair.',
      wilaya: 'Biskra',
      commune: 'Doucen',
      addressLine: 'Lot 12, near the mosque',
      preferredDate: dateOffset(3),
      preferredTime: '10:00',
      requestMode: 'OPEN_REQUEST',
      status: 'OPEN',
      images: {
        create: [
          { imageUrl: imageUrl('Open Request Leak 1'), displayOrder: 0 },
          { imageUrl: imageUrl('Open Request Leak 2'), displayOrder: 1 }
        ]
      }
    }
  });

  const offeredRequest = await prisma.clientRequest.create({
    data: {
      clientId: clientPrimary.id,
      categoryId: categoryBySlug.beauty.id,
      subcategoryId: subcategoryBySlug.makeup.id,
      title: 'Makeup artist for engagement party',
      description: 'Need an at-home makeup artist for an evening event with a soft glam style.',
      wilaya: 'Algiers',
      commune: 'Hussein Dey',
      addressLine: 'Apartment 5, Block C',
      preferredDate: dateOffset(4),
      preferredTime: '16:00',
      requestMode: 'OPEN_REQUEST',
      status: 'OFFERED',
      images: {
        create: [
          { imageUrl: imageUrl('Offered Request Makeup Reference'), displayOrder: 0 }
        ]
      }
    }
  });

  const bookedRequest = await prisma.clientRequest.create({
    data: {
      clientId: clientSecondary.id,
      categoryId: categoryBySlug.health.id,
      subcategoryId: subcategoryBySlug.nursing.id,
      title: 'Home nursing follow-up needed',
      description: 'Elderly parent needs follow-up support and monitoring for the next few days.',
      wilaya: 'Constantine',
      commune: 'El Khroub',
      addressLine: 'Residence El Amal',
      preferredDate: dateOffset(5),
      preferredTime: '09:00',
      requestMode: 'OPEN_REQUEST',
      status: 'BOOKED',
      images: {
        create: [
          { imageUrl: imageUrl('Booked Request Nursing 1'), displayOrder: 0 }
        ]
      }
    }
  });

  const closedRequest = await prisma.clientRequest.create({
    data: {
      clientId: clientSecondary.id,
      categoryId: categoryBySlug.works.id,
      subcategoryId: subcategoryBySlug.electricity.id,
      title: 'Electrical outlet repair completed',
      description: 'One wall outlet was damaged and needed inspection and replacement.',
      wilaya: 'Biskra',
      commune: 'Biskra',
      addressLine: 'Rue des Jardins',
      preferredDate: dateOffset(-2),
      preferredTime: '11:00',
      requestMode: 'OPEN_REQUEST',
      status: 'CLOSED',
      images: {
        create: [
          { imageUrl: imageUrl('Closed Request Electricity 1'), displayOrder: 0 }
        ]
      }
    }
  });

  await prisma.clientRequestOffer.create({
    data: {
      requestId: offeredRequest.id,
      workerProfileId: workerBeautyProfile.id,
      message: 'I am available that evening and can come prepared for a soft glam look.',
      proposedPrice: 5500,
      proposedDate: dateOffset(4),
      proposedStartTime: '16:00',
      proposedEndTime: '17:00',
      status: 'SENT'
    }
  });

  const acceptedBookedOffer = await prisma.clientRequestOffer.create({
    data: {
      requestId: bookedRequest.id,
      workerProfileId: workerHealthProfile.id,
      message: 'I can handle the follow-up visits starting tomorrow morning.',
      proposedPrice: 3200,
      proposedDate: dateOffset(5),
      proposedStartTime: '09:00',
      proposedEndTime: '10:00',
      status: 'ACCEPTED'
    }
  });

  await prisma.clientRequestOffer.create({
    data: {
      requestId: bookedRequest.id,
      workerProfileId: workerPrimaryProfile.id,
      message: 'I can refer a colleague if health support is still needed.',
      proposedPrice: 3500,
      proposedDate: dateOffset(5),
      proposedStartTime: '12:00',
      proposedEndTime: '13:00',
      status: 'REJECTED'
    }
  });

  const acceptedClosedOffer = await prisma.clientRequestOffer.create({
    data: {
      requestId: closedRequest.id,
      workerProfileId: workerPrimaryProfile.id,
      message: 'I can replace the outlet and verify the circuit in one visit.',
      proposedPrice: 4000,
      proposedDate: dateOffset(-2),
      proposedStartTime: '11:00',
      proposedEndTime: '12:00',
      status: 'ACCEPTED'
    }
  });

  const directPendingBooking = await prisma.booking.create({
    data: {
      clientId: clientPrimary.id,
      workerProfileId: workerPrimaryProfile.id,
      listingId: plumbingListing.id,
      source: 'DIRECT_LISTING',
      bookingType: 'DIRECT',
      scheduledDate: null,
      slotStart: null,
      slotEnd: null,
      note: null,
      contactPhone: null,
      wilaya: 'Biskra',
      commune: 'Doucen',
      addressLine: 'Lot 14, near the primary school',
      status: 'PENDING'
    }
  });

  const directConfirmedBooking = await prisma.booking.create({
    data: {
      clientId: clientPrimary.id,
      workerProfileId: workerBeautyProfile.id,
      listingId: hairListing.id,
      source: 'DIRECT_LISTING',
      bookingType: 'SCHEDULED',
      scheduledDate: dateOffset(2),
      slotStart: '13:00',
      slotEnd: '14:00',
      note: 'Please come prepared for an engagement hairstyle.',
      contactPhone: null,
      wilaya: 'Algiers',
      commune: 'Bab Ezzouar',
      addressLine: 'Residence Nour, Block B',
      status: 'CONFIRMED'
    }
  });

  const directCompletedBooking = await prisma.booking.create({
    data: {
      clientId: clientSecondary.id,
      workerProfileId: workerBeautyProfile.id,
      listingId: makeupListing.id,
      source: 'DIRECT_LISTING',
      bookingType: 'SCHEDULED',
      scheduledDate: dateOffset(-3),
      slotStart: '15:00',
      slotEnd: '16:00',
      note: 'Completed bridal makeup session.',
      contactPhone: '+213555222222',
      wilaya: 'Algiers',
      commune: 'Hussein Dey',
      addressLine: 'Villa 8, Rue des Fleurs',
      status: 'COMPLETED'
    }
  });

  await prisma.booking.create({
    data: {
      clientId: clientPrimary.id,
      workerProfileId: workerHealthProfile.id,
      listingId: nursingListing.id,
      source: 'DIRECT_LISTING',
      bookingType: 'DIRECT',
      scheduledDate: null,
      slotStart: null,
      slotEnd: null,
      note: 'No longer needed.',
      contactPhone: '+213555333333',
      wilaya: 'Constantine',
      commune: 'Constantine',
      addressLine: 'Cite 600 Logements',
      status: 'CANCELLED'
    }
  });

  const bookedOfferBooking = await prisma.booking.create({
    data: {
      clientId: clientSecondary.id,
      workerProfileId: workerHealthProfile.id,
      listingId: null,
      clientRequestId: bookedRequest.id,
      offerId: acceptedBookedOffer.id,
      source: 'REQUEST_OFFER',
      bookingType: 'SCHEDULED',
      scheduledDate: dateOffset(5),
      slotStart: '09:00',
      slotEnd: '10:00',
      note: null,
      contactPhone: clientSecondary.phone,
      wilaya: bookedRequest.wilaya,
      commune: bookedRequest.commune,
      addressLine: bookedRequest.addressLine,
      status: 'CONFIRMED'
    }
  });

  const closedOfferBooking = await prisma.booking.create({
    data: {
      clientId: clientSecondary.id,
      workerProfileId: workerPrimaryProfile.id,
      listingId: null,
      clientRequestId: closedRequest.id,
      offerId: acceptedClosedOffer.id,
      source: 'REQUEST_OFFER',
      bookingType: 'SCHEDULED',
      scheduledDate: dateOffset(-2),
      slotStart: '11:00',
      slotEnd: '12:00',
      note: null,
      contactPhone: clientSecondary.phone,
      wilaya: closedRequest.wilaya,
      commune: closedRequest.commune,
      addressLine: closedRequest.addressLine,
      status: 'COMPLETED'
    }
  });

  await prisma.review.create({
    data: {
      bookingId: directCompletedBooking.id,
      reviewerId: clientSecondary.id,
      reviewedWorkerId: workerBeautyProfile.id,
      rating: 5,
      comment: 'Very professional, on time, and the result matched exactly what I wanted.'
    }
  });

  await prisma.review.create({
    data: {
      bookingId: closedOfferBooking.id,
      reviewerId: clientSecondary.id,
      reviewedWorkerId: workerPrimaryProfile.id,
      rating: 4,
      comment: 'Problem solved quickly and everything was tested before leaving.'
    }
  });

  await prisma.favorite.createMany({
    data: [
      { clientId: clientPrimary.id, workerProfileId: workerPrimaryProfile.id },
      { clientId: clientPrimary.id, workerProfileId: workerBeautyProfile.id },
      { clientId: clientSecondary.id, workerProfileId: workerHealthProfile.id }
    ]
  });

  await syncWorkerMetrics([
    workerPrimaryProfile.id,
    workerBeautyProfile.id,
    workerHealthProfile.id
  ]);

  console.log('Seed completed');
  console.log(`Admin: ${admin.email} / ${demoAccounts.admin.password}`);
  console.log(`Client: ${clientPrimary.email} / ${DEFAULT_CLIENT_PASSWORD}`);
  console.log(`Worker: ${workerPrimaryUser.email} / ${DEFAULT_WORKER_PASSWORD}`);
  console.log(`Sample records:`);
  console.log(`- Plumbing listing: ${plumbingListing.id}`);
  console.log(`- Pending direct booking: ${directPendingBooking.id}`);
  console.log(`- Confirmed direct booking: ${directConfirmedBooking.id}`);
  console.log(`- Confirmed request-offer booking: ${bookedOfferBooking.id}`);
  console.log(`- Open request: ${openRequest.id}`);
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
