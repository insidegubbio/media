import { config } from '@/lib/config';
import { prisma } from '@/lib/db';
import { Invite } from '@/lib/db/models/invite';
import { secondlyRatelimit } from '@/lib/ratelimits';
import fastifyPlugin from 'fastify-plugin';

export type ApiAuthInvitesWebResponse = Invite & {
  inviter: {
    username: string;
  };
};

type Query = {
  code: string;
};

export const PATH = '/api/auth/invites/web';
export default fastifyPlugin(
  (server, _, done) => {
    server.get<{ Querystring: Query }>(PATH, secondlyRatelimit(10), async (req, res) => {
      const { code } = req.query;

      if (!code) return res.send({ invite: null });
      if (!config.invites.enabled) return res.notFound();

      const invite = await prisma.invite.findFirst({
        where: {
          OR: [{ id: code }, { code }],
        },
        select: {
          code: true,
          maxUses: true,
          uses: true,
          expiresAt: true,
          inviter: {
            select: { username: true },
          },
        },
      });

      if (
        !invite ||
        (invite.expiresAt && new Date(invite.expiresAt) < new Date()) ||
        (invite.maxUses && invite.uses >= invite.maxUses)
      ) {
        return res.notFound();
      }

      delete (invite as any).expiresAt;

      return res.send({ invite });
    });

    done();
  },
  { name: PATH },
);
