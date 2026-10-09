import { PrismaClient } from '@prisma/client';
import { runtimeDatabaseUrl, selectedDatabaseUrl } from './connection';
const globalDatabase = globalThis as unknown as { prisma?: PrismaClient };
const selectedUrl = selectedDatabaseUrl();
// Keep existing availability guards consistent with the explicitly selected datasource.
if (process.env.USE_AIVEN_DATABASE === 'true' && selectedUrl) process.env.DATABASE_URL = selectedUrl;
const datasourceUrl = runtimeDatabaseUrl(selectedUrl, !!process.env.VERCEL);
export const db =
  globalDatabase.prisma ??
  new PrismaClient({
    log: [],
    ...(datasourceUrl ? { datasourceUrl } : {}),
  });
globalDatabase.prisma = db;
