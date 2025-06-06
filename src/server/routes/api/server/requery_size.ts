import { log } from '@/lib/logger';
import { secondlyRatelimit } from '@/lib/ratelimits';
import { requerySize } from '@/lib/server-util/requerySize';
import { administratorMiddleware } from '@/server/middleware/administrator';
import { userMiddleware } from '@/server/middleware/user';
import fastifyPlugin from 'fastify-plugin';

export type ApiServerRequerySizeResponse = {
  status?: string;
};

type Body = {
  forceDelete?: boolean;
  forceUpdate?: boolean;
};

const logger = log('api').c('server').c('requery_size');

export const PATH = '/api/server/requery_size';
export default fastifyPlugin(
  (server, _, done) => {
    server.post<{ Body: Body }>(
      PATH,
      {
        preHandler: [userMiddleware, administratorMiddleware],
        ...secondlyRatelimit(1),
      },
      async (req, res) => {
        const status = await requerySize({
          forceDelete: req.body.forceDelete || false,
          forceUpdate: req.body.forceUpdate || false,
        });

        logger.info('requerying size', {
          status,
          requester: req.user.username,
          forceDelete: req.body.forceDelete || false,
          forceUpdate: req.body.forceUpdate || false,
        });

        return res.send({ status });
      },
    );

    done();
  },
  { name: PATH },
);
