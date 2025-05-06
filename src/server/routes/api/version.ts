import { userMiddleware } from '@/server/middleware/user';
import fastifyPlugin from 'fastify-plugin';
import { getVersion } from '@/lib/version';

export type ApiVersionResponse = {
  version: string;
};

export const PATH = '/api/version';
export default fastifyPlugin(
  (server, _, done) => {
    server.get(PATH, { preHandler: [userMiddleware] }, async (_, res) => {
      const details = getVersion();

      return res.send(details);
    });

    done();
  },
  { name: PATH },
);
