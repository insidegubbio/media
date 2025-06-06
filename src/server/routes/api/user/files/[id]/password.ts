import { verifyPassword } from '@/lib/crypto';
import { prisma } from '@/lib/db';
import { log } from '@/lib/logger';
import { secondlyRatelimit } from '@/lib/ratelimits';
import fastifyPlugin from 'fastify-plugin';

export type ApiUserFilesIdPasswordResponse = {
  success: boolean;
};

type Body = {
  password: string;
};

type Params = {
  id: string;
};

const logger = log('api').c('user').c('files').c('[id]').c('password');

export const PATH = '/api/user/files/:id/password';
export default fastifyPlugin(
  (server, _, done) => {
    server.post<{ Body: Body; Params: Params }>(PATH, { ...secondlyRatelimit(2) }, async (req, res) => {
      const file = await prisma.file.findFirst({
        where: {
          OR: [{ id: req.params.id }, { name: req.params.id }],
        },
        select: {
          name: true,
          password: true,
          id: true,
        },
      });
      if (!file) return res.notFound();
      if (!file.password) return res.notFound();

      const verified = await verifyPassword(req.body.password, file.password);
      if (!verified) {
        logger.warn('invalid password for file', {
          file: file.name,
          ip: req.ip ?? 'unknown',
          ua: req.headers['user-agent'],
        });

        return res.forbidden('Incorrect password');
      }
      logger.info(`${file.name} was accessed with the correct password`, { ua: req.headers['user-agent'] });

      res.cookie('file_pw_' + file.id, req.body.password, {
        sameSite: 'lax',
        maxAge: 60,
        httpOnly: false,
        secure: false,
        path: '/',
      });

      return res.send({ success: true });
    });

    done();
  },
  { name: PATH },
);
