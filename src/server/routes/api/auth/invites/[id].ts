import { Prisma } from '../../../../../../generated/client';
import { prisma } from '@/lib/db';
import { Invite, inviteInviterSelect } from '@/lib/db/models/invite';
import { log } from '@/lib/logger';
import { administratorMiddleware } from '@/server/middleware/administrator';
import { userMiddleware } from '@/server/middleware/user';
import fastifyPlugin from 'fastify-plugin';

export type ApiAuthInvitesIdResponse = Invite;

type Params = {
  id: string;
};

const logger = log('api').c('auth').c('invites').c('[id]');

export const PATH = '/api/auth/invites/:id';
export default fastifyPlugin(
  (server, _, done) => {
    server.get<{ Params: Params }>(
      PATH,
      { preHandler: [userMiddleware, administratorMiddleware] },
      async (req, res) => {
        const { id } = req.params;

        const invite = await prisma.invite.findFirst({
          where: {
            OR: [{ id }, { code: id }],
          },
          include: {
            inviter: inviteInviterSelect,
          },
        });
        if (!invite) return res.notFound('Invite not found through id or code');

        return res.send(invite);
      },
    );

    server.delete<{ Params: Params }>(
      PATH,
      { preHandler: [userMiddleware, administratorMiddleware] },
      async (req, res) => {
        const { id } = req.params;

        try {
          const invite = await prisma.invite.delete({
            where: {
              id: id,
            },
            include: {
              inviter: inviteInviterSelect,
            },
          });

          logger.info(`${req.user.username} deleted an invite`, {
            id: invite.id,
            code: invite.code,
          });

          return res.send(invite);
        } catch (error) {
          if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
            return res.notFound('Invite not found');
          }

          logger.error(`Failed to delete invite with id ${id}`, { error });
          return res.internalServerError('Failed to delete invite');
        }
      },
    );

    done();
  },
  { name: PATH },
);
