import { log } from '@/lib/logger';
import { secondlyRatelimit } from '@/lib/ratelimits';
import { clearTemp } from '@/lib/server-util/clearTemp';
import { administratorMiddleware } from '@/server/middleware/administrator';
import { userMiddleware } from '@/server/middleware/user';
import fastifyPlugin from 'fastify-plugin';

export type ApiServerClearTempResponse = {
  status?: string;
};

const logger = log('api').c('server').c('clear_temp');

export const PATH = '/api/server/clear_temp';
export default fastifyPlugin(
  (server, _, done) => {
    server.delete(
      PATH,
      {
        preHandler: [userMiddleware, administratorMiddleware],
        ...secondlyRatelimit(1),
      },
      async (req, res) => {
        const status = await clearTemp();

        logger.info('cleared temp files', {
          status,
          requester: req.user.username,
        });

        return res.send({ status });
      },
    );

    done();
  },
  { name: PATH },
);
