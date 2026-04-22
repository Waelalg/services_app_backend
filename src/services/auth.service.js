import bcrypt from 'bcryptjs';
import { StatusCodes } from 'http-status-codes';
import { prisma } from '../config/prisma.js';
import { AppError } from '../errors/app-error.js';
import { toUtcDateOnly } from '../utils/date-time.js';
import { serializeUser, serializeWorkerProfile } from '../utils/serializers.js';
import { signToken } from '../utils/jwt.js';

function buildAuthResponse(user) {
  return {
    token: signToken({
      sub: user.id,
      role: user.role,
      email: user.email
    }),
    user: {
      ...serializeUser(user),
      workerProfile: user.workerProfile
        ? serializeWorkerProfile(
            {
              ...user.workerProfile,
              user
            },
            { includeUser: false }
          )
        : null
    }
  };
}

export async function registerUser(payload) {
  const email = payload.email.trim().toLowerCase();

  const existingUser = await prisma.user.findUnique({
    where: { email }
  });

  if (existingUser) {
    throw new AppError('Email already registered', StatusCodes.CONFLICT);
  }

  const passwordHash = await bcrypt.hash(payload.password, 12);

  const user = await prisma.$transaction(async (tx) => {
    const createdUser = await tx.user.create({
      data: {
        firstName: payload.firstName,
        lastName: payload.lastName,
        email,
        phone: payload.phone,
        gender: payload.gender,
        dateOfBirth: toUtcDateOnly(payload.dateOfBirth),
        passwordHash,
        role: payload.role
      }
    });

    if (payload.role === 'WORKER') {
      await tx.workerProfile.create({
        data: {
          userId: createdUser.id
        }
      });
    }

    return tx.user.findUnique({
      where: { id: createdUser.id },
      include: { workerProfile: true }
    });
  });

  return buildAuthResponse(user);
}

export async function loginUser(payload) {
  const email = payload.email.trim().toLowerCase();

  const user = await prisma.user.findUnique({
    where: { email },
    include: { workerProfile: true }
  });

  if (!user || !(await bcrypt.compare(payload.password, user.passwordHash))) {
    throw new AppError('Invalid credentials', StatusCodes.UNAUTHORIZED);
  }

  if (!user.isActive) {
    throw new AppError('This account is inactive', StatusCodes.FORBIDDEN);
  }

  return buildAuthResponse(user);
}

export async function getCurrentUser(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { workerProfile: true }
  });

  if (!user) {
    throw new AppError('User not found', StatusCodes.NOT_FOUND);
  }

  return {
    ...serializeUser(user),
    workerProfile: user.workerProfile
      ? serializeWorkerProfile(
          {
            ...user.workerProfile,
            user
          },
          { includeUser: false }
        )
      : null
  };
}

export async function updateCurrentUser(userId, payload) {
  const existing = await prisma.user.findUnique({
    where: { id: userId },
    include: { workerProfile: true }
  });

  if (!existing) {
    throw new AppError('User not found', StatusCodes.NOT_FOUND);
  }

  const userData = {};
  const workerData = {};

  for (const key of ['firstName', 'lastName', 'phone', 'avatarUrl', 'gender']) {
    if (key in payload) {
      userData[key] = payload[key];
    }
  }

  if ('dateOfBirth' in payload) {
    userData.dateOfBirth = payload.dateOfBirth ? toUtcDateOnly(payload.dateOfBirth) : null;
  }

  for (const key of ['headline', 'bio', 'yearsExperience', 'avgResponseMinutes']) {
    if (key in payload) {
      workerData[key] = payload[key];
    }
  }

  const user = await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: userId },
      data: userData
    });

    if (existing.role === 'WORKER' && Object.keys(workerData).length > 0) {
      await tx.workerProfile.update({
        where: { userId },
        data: workerData
      });
    }

    return tx.user.findUnique({
      where: { id: userId },
      include: { workerProfile: true }
    });
  });

  return {
    ...serializeUser(user),
    workerProfile: user.workerProfile
      ? serializeWorkerProfile(
          {
            ...user.workerProfile,
            user
          },
          { includeUser: false }
        )
      : null
  };
}
