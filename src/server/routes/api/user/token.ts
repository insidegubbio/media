import { config } from '@/lib/config';
import { createToken, encryptToken } from '@/lib/crypto';
import { prisma } from '@/lib/db';
import { User, userSelect } from '@/lib/db/models/user';
import { log } from '@/lib/logger';
import { secondlyRatelimit } from '@/lib/ratelimits';
import { userMiddleware } from '@/server/middleware/user';
import fastifyPlugin from 'fastify-plugin';

export type ApiUserTokenResponse = {
  user?: User;
  token?: string;
};

const logger = log('api').c('user').c('token');

export const PATH = '/api/user/token';
export default fastifyPlugin(
  (server, _, done) => {
    server.get(PATH, { preHandler: [userMiddleware] }, async (req, res) => {
      const user = await prisma.user.findUnique({
        where: {
          id: req.user.id,
        },
        select: {
          token: true,
        },
      });

      const token = encryptToken(user!.token, config.core.secret);

      return res.send({
        token,
      });
    });

    server.patch(PATH, { preHandler: [userMiddleware], ...secondlyRatelimit(1) }, async (req, res) => {
      const user = await prisma.user.update({
        where: {
          id: req.user.id,
        },
        data: {
          token: createToken(),
        },
        select: {
          ...userSelect,
          token: true,
        },
      });

      delete (user as any).password;

      logger.info('user reset their token', {
        user: user.username,
      });

      return res.send({
        user,
        token: encryptToken(user.token, config.core.secret),
      });
    });

    done();
  },
  { name: PATH },
);
