import { datasource } from '@/lib/datasource';
import { prisma } from '@/lib/db';
import { log } from '@/lib/logger';
import { secondlyRatelimit } from '@/lib/ratelimits';
import { userMiddleware } from '@/server/middleware/user';
import fastifyPlugin from 'fastify-plugin';

export type ApiUserFilesTransactionResponse = {
  count: number;
  name?: string;
};

type Body = {
  files: string[];

  favorite?: boolean;

  folder?: string;

  delete_datasourceFiles?: boolean;
};

const logger = log('api').c('user').c('files').c('transaction');

export const PATH = '/api/user/files/transaction';
export default fastifyPlugin(
  (server, _, done) => {
    server.patch<{ Body: Body }>(
      PATH,
      { preHandler: [userMiddleware], ...secondlyRatelimit(2) },
      async (req, res) => {
        const { files, favorite, folder } = req.body;

        if (!files || !files.length) return res.badRequest('Cannot process transaction without files');

        if (typeof favorite === 'boolean') {
          const resp = await prisma.file.updateMany({
            where: {
              id: {
                in: files,
              },
              userId: req.user.id,
            },

            data: {
              favorite: favorite,
            },
          });

          if (resp.count === 0) return res.badRequest('No files were updated.');

          logger.info(`${req.user.username} ${favorite ? 'favorited' : 'unfavorited'} ${resp.count} files`, {
            user: req.user.id,
          });

          return res.send(resp);
        }

        if (!folder) return res.badRequest("can't PATCH without an action");

        const f = await prisma.folder.findUnique({
          where: {
            id: folder,
            userId: req.user.id,
          },
        });
        if (!f) return res.notFound('folder not found');

        const resp = await prisma.file.updateMany({
          where: {
            id: {
              in: files,
            },
            userId: req.user.id,
          },

          data: {
            folderId: folder,
          },
        });

        if (resp.count === 0) return res.notFound('No files were moved.');

        logger.info(`${req.user.username} moved ${resp.count} files to ${f.name}`, {
          user: req.user.id,
          folderId: f.id,
        });

        return res.send({
          ...resp,
          name: f.name,
        });
      },
    );

    server.delete<{ Body: Body }>(
      PATH,
      { preHandler: [userMiddleware], ...secondlyRatelimit(2) },
      async (req, res) => {
        const { files } = req.body;

        if (!files || !files.length) return res.badRequest('Cannot process transaction without files');

        const { delete_datasourceFiles } = req.body;

        logger.debug('preparing transaction', {
          action: 'delete',
          files: files.length,
        });

        if (delete_datasourceFiles) {
          const dFiles = await prisma.file.findMany({
            where: {
              id: {
                in: files,
              },
              userId: req.user.id,
            },
          });

          for (let i = 0; i !== dFiles.length; ++i) {
            await datasource.delete(dFiles[i].name);
          }

          logger.info(`${req.user.username} deleted ${dFiles.length} files from datasource`, {
            user: req.user.id,
          });
        }

        const resp = await prisma.file.deleteMany({
          where: {
            id: {
              in: files,
            },
            userId: req.user.id,
          },
        });

        if (resp.count === 0) return res.badRequest('No files were deleted.');

        logger.info(`${req.user.username} deleted ${resp.count} files`, {
          user: req.user.id,
        });

        return res.send(resp);
      },
    );

    done();
  },
  { name: PATH },
);
