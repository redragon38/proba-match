import { PrismaClient } from '@prisma/client';
const globalDatabase = globalThis as unknown as { prisma?: PrismaClient };
export const db = globalDatabase.prisma ?? new PrismaClient({ log: [] });
if (process.env.NODE_ENV !== 'production') globalDatabase.prisma = db;
