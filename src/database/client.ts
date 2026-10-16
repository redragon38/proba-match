import { PrismaClient } from '@prisma/client';
import { runtimeDatabaseUrl, selectedDatabaseUrl } from './connection';
const globalDatabase = globalThis as unknown as { prisma?: PrismaClient };
const selectedUrl = selectedDatabaseUrl();
// Keep existing availability guards consistent with the explicitly selected datasource.
if (process.env.USE_AIVEN_DATABASE === 'true' && selectedUrl) process.env.DATABASE_URL = selectedUrl;
const serverless = !!process.env.VERCEL;
const datasourceUrl = runtimeDatabaseUrl(
  selectedUrl,
  serverless || process.env.APP_ENV === 'production',
  serverless ? 1 : 3,
);
export const db =
  globalDatabase.prisma ??
  new PrismaClient({
    log: [],
    ...(datasourceUrl ? { datasourceUrl } : {}),
  });
globalDatabase.prisma = db;
