import { PrismaClient } from '@prisma/client';
import { runtimeDatabaseUrl } from './connection';
const globalDatabase = globalThis as unknown as { prisma?: PrismaClient };
const datasourceUrl = runtimeDatabaseUrl(process.env.DATABASE_URL, !!process.env.VERCEL);
export const db =
  globalDatabase.prisma ??
  new PrismaClient({
    log: [],
    ...(datasourceUrl ? { datasourceUrl } : {}),
  });
globalDatabase.prisma = db;
