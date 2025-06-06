import { log } from '@/lib/logger';
import { secondlyRatelimit } from '@/lib/ratelimits';
import { administratorMiddleware } from '@/server/middleware/administrator';
import { userMiddleware } from '@/server/middleware/user';
import fastifyPlugin from 'fastify-plugin';

export type ApiServerThumbnailsResponse = {
  status: string;
};

type Body = {
  rerun: boolean;
};

const logger = log('api').c('server').c('thumbnails');

export const PATH = '/api/server/thumbnails';
export default fastifyPlugin(
  (server, _, done) => {
    server.post<{ Body: Body }>(
      PATH,
      {
        preHandler: [userMiddleware, administratorMiddleware],
        ...secondlyRatelimit(1),
      },
      async (req, res) => {
        const thumbnailTask = server.tasks.tasks.find((x) => x.id === 'thumbnails');
        if (!thumbnailTask) return res.notFound('thumbnails task not found');

        thumbnailTask.logger.debug('manually running thumbnails task');

        await server.tasks.runJob(thumbnailTask.id, !!req.body.rerun);

        logger.info('thumbnails task manually run', {
          requester: req.user.username,
          rerun: !!req.body.rerun,
        });

        return res.send({
          status: `Thumbnails are being generated${
            req.body.rerun ? ' (rerun)' : ''
          }. This may take a while, check your logs for progress.`,
        });
      },
    );

    done();
  },
  { name: PATH },
);
