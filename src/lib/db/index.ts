import { log } from '@/lib/logger';
import { PrismaPg } from '@prisma/adapter-pg';
import { type Prisma, PrismaClient } from '@/prisma/client';
import { metadataSchema } from './models/incompleteFile';
import { metricDataSchema } from './models/metric';
import { userViewSchema } from './models/user';

const building = !!process.env.ZIPLINE_BUILD;

let prisma: ExtendedPrismaClient;

declare global {
  var __db__: ExtendedPrismaClient;
}

if (!global.__db__) {
  if (!building) global.__db__ = getClient();
}

// eslint-disable-next-line prefer-const
prisma = global.__db__;

type ExtendedPrismaClient = ReturnType<typeof getClient>;

function parseDbLog(env: string): Prisma.LogLevel[] {
  if (env === 'true') return ['query'];

  return env
    .split(',')
    .map((v) => v.trim())
    .filter((v) => v) as unknown as Prisma.LogLevel[];
}

function getClient() {
  const logger = log('db');

  logger.info('connecting to database ' + process.env.DATABASE_URL);

  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  const client = new PrismaClient({
    adapter,
    log: process.env.ZIPLINE_DB_LOG ? parseDbLog(process.env.ZIPLINE_DB_LOG) : undefined,
  }).$extends({
    result: {
      file: {
        size: {
          needs: { size: true },
          compute({ size }: { size: bigint }) {
            return Number(size);
          },
        },
      },
      user: {
        view: {
          needs: { view: true },
          compute({ view }: { view: Prisma.JsonValue }) {
            return userViewSchema.parse(view);
          },
        },
      },
      metric: {
        data: {
          needs: { data: true },
          compute({ data }: { data: Prisma.JsonValue }) {
            return metricDataSchema.parse(data);
          },
        },
      },
      incompleteFile: {
        metadata: {
          needs: { metadata: true },
          compute({ metadata }: { metadata: Prisma.JsonValue }) {
            return metadataSchema.parse(metadata);
          },
        },
      },
    },
  });
  client.$connect();

  return client;
}

export { prisma };
