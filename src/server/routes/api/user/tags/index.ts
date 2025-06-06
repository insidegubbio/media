import { prisma } from '@/lib/db';
import { Tag, tagSelect } from '@/lib/db/models/tag';
import { log } from '@/lib/logger';
import { secondlyRatelimit } from '@/lib/ratelimits';
import { userMiddleware } from '@/server/middleware/user';
import fastifyPlugin from 'fastify-plugin';

export type ApiUserTagsResponse = Tag | Tag[];

type Body = {
  name: string;
  color: string;
};

const logger = log('api').c('user').c('tags');

export const PATH = '/api/user/tags';
export default fastifyPlugin(
  (server, _, done) => {
    server.get(PATH, { preHandler: [userMiddleware] }, async (req, res) => {
      const tags = await prisma.tag.findMany({
        where: {
          userId: req.user.id,
        },
        select: tagSelect,
      });

      return res.send(tags);
    });

    server.post<{ Body: Body }>(
      PATH,
      { preHandler: [userMiddleware], ...secondlyRatelimit(1) },
      async (req, res) => {
        const { name, color } = req.body;

        if (!name) return res.badRequest('Name is required');
        if (!color) return res.badRequest('Color is required');

        const existingTag = await prisma.tag.findFirst({
          where: {
            name,
            userId: req.user.id,
          },
        });

        if (existingTag) return res.badRequest('Cannot create tag with the same name');

        const tag = await prisma.tag.create({
          data: {
            name,
            color,
            userId: req.user.id,
          },
          select: tagSelect,
        });

        logger.info('tag created', {
          id: tag.id,
          name: tag.name,
          user: req.user.username,
        });

        return res.send(tag);
      },
    );

    done();
  },
  { name: PATH },
);
