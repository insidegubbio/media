import type { Url as PrismaUrl } from '@/prisma/client';

export type Url = PrismaUrl & {
  similarity?: number;
};

export function cleanUrlPasswords(urls: Url[]) {
  for (const url of urls) {
    (url as any).password = !!url.password;
  }

  return urls;
}
