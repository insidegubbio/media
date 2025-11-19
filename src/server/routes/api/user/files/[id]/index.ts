import { Prisma } from '@/prisma/client';
import { bytes } from '@/lib/bytes';
import { hashPassword } from '@/lib/crypto';
import { datasource } from '@/lib/datasource';
import { prisma } from '@/lib/db';
import { File, fileSelect } from '@/lib/db/models/file';
import { log } from '@/lib/logger';
import { userMiddleware } from '@/server/middleware/user';
import fastifyPlugin from 'fastify-plugin';
import { canInteract } from '@/lib/role';

export type ApiUserFilesIdResponse = File;

type Body = {
  favorite?: boolean;
  maxViews?: number;
  password?: string | null;
  originalName?: string;
  type?: string;
  tags?: string[];
  name?: string;
};

type Params = {
  id: string;
};

const logger = log('api').c('user').c('files').c('[id]');

export const PATH = '/api/user/files/:id';
export default fastifyPlugin(
  (server, _, done) => {
    server.get<{ Params: Params }>(PATH, { preHandler: [userMiddleware] }, async (req, res) => {
      const file = await prisma.file.findFirst({
        where: {
          OR: [{ id: req.params.id }, { name: req.params.id }],
        },
        select: { User: true, ...fileSelect },
      });
      if (!file) return res.notFound();

      if (req.user.id !== file.User?.id && !canInteract(req.user.role, file.User?.role ?? 'USER'))
        return res.notFound();

      return res.send(file);
    });

    server.patch<{
      Body: Body;
      Params: Params;
    }>(PATH, { preHandler: [userMiddleware] }, async (req, res) => {
      const file = await prisma.file.findFirst({
        where: {
          OR: [{ id: req.params.id }, { name: req.params.id }],
        },
        select: { User: true, ...fileSelect },
      });
      if (!file) return res.notFound();

      if (req.user.id !== file.User?.id && !canInteract(req.user.role, file.User?.role ?? 'USER'))
        return res.notFound();

      const data: Prisma.FileUpdateInput = {};

      if (req.body.favorite !== undefined) data.favorite = req.body.favorite;
      if (req.body.originalName !== undefined) data.originalName = req.body.originalName;
      if (req.body.type !== undefined) data.type = req.body.type;

      if (req.body.maxViews !== undefined) {
        if (req.body.maxViews < 0) return res.badRequest('maxViews must be >= 0');

        data.maxViews = req.body.maxViews;
      }

      if (req.body.password !== undefined) {
        if (req.body.password === null || req.body.password === '') {
          data.password = null;
        } else if (typeof req.body.password === 'string') {
          data.password = await hashPassword(req.body.password);
        } else {
          return res.badRequest('password must be a string');
        }
      }

      if (req.body.tags !== undefined) {
        const tags = await prisma.tag.findMany({
          where: {
            userId: req.user.id,
            id: {
              in: req.body.tags,
            },
          },
        });

        if (tags.length !== req.body.tags.length) return res.badRequest('invalid tag somewhere');

        data.tags = {
          set: req.body.tags.map((tag) => ({ id: tag })),
        };
      }

      if (req.body.name !== undefined && req.body.name !== file.name) {
        const name = req.body.name.trim();
        const existingFile = await prisma.file.findFirst({
          where: {
            name,
          },
        });

        if (existingFile && existingFile.id !== file.id)
          return res.badRequest('File with this name already exists');

        data.name = name;

        try {
          await datasource.rename(file.name, data.name);
        } catch (error) {
          logger.error('Failed to rename file in datasource', { error });
          return res.internalServerError('Failed to rename file in datasource');
        }
      }

      const newFile = await prisma.file.update({
        where: {
          id: req.params.id,
        },
        data,
        select: fileSelect,
      });

      logger.info(`${req.user.username} updated file ${newFile.name}`, {
        updated: Object.keys(req.body),
        id: newFile.id,
        owner: file.User?.id,
      });

      return res.send(newFile);
    });

    server.delete<{ Params: Params }>(PATH, { preHandler: [userMiddleware] }, async (req, res) => {
      const file = await prisma.file.findFirst({
        where: {
          OR: [{ id: req.params.id }, { name: req.params.id }],
        },
        include: {
          User: true,
        },
      });
      if (!file) return res.notFound();

      if (req.user.id !== file.User?.id && !canInteract(req.user.role, file.User?.role ?? 'USER'))
        return res.notFound();

      const deletedFile = await prisma.file.delete({
        where: {
          id: file.id,
        },
        select: fileSelect,
      });

      await datasource.delete(deletedFile.name);

      logger.info(`${req.user.username} deleted file ${deletedFile.name}`, {
        size: bytes(deletedFile.size),
        owner: file.User?.id,
      });

      return res.send(deletedFile);
    });

    done();
  },
  { name: PATH },
);
